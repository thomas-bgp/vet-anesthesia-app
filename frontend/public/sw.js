const CACHE_NAME = 'anestify-v6';
const API_CACHE = 'anestify-api-v1';
const OFFLINE_QUEUE_KEY = 'anestify_offline_queue';
// Max retries before surfacing the request to the user instead of dropping silently.
const MAX_QUEUE_RETRIES = 8;

// Assets to cache on install
const PRECACHE = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Install - cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate - clean old caches (keep only current static + API caches)
self.addEventListener('activate', (event) => {
  const keepCaches = [CACHE_NAME, API_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// --- Offline Queue helpers (using IndexedDB for reliability) ---
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('anestify_offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueueRequest(url, method, headers, body) {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add({
      url,
      method,
      headers: Object.fromEntries(
        [...headers].filter(([k]) => k.toLowerCase() !== 'content-length')
      ),
      body,
      timestamp: Date.now(),
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  } catch (e) {
    console.error('[SW] Failed to enqueue request:', e);
  }
}

async function flushQueue() {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const items = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (items.length === 0) return;

    console.log(`[SW] Flushing ${items.length} queued requests`);
    const succeeded = [];
    const retryUpdates = []; // { id, retry_count, last_status, last_error }
    const stuck = [];        // items that exceeded MAX_QUEUE_RETRIES

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        // CRITICAL: only 2xx counts as success. 4xx (validation/auth) and 5xx
        // must remain in the queue so data is never silently dropped.
        if (response.ok) {
          succeeded.push(item.id);
        } else {
          const nextRetry = (item.retry_count || 0) + 1;
          if (nextRetry >= MAX_QUEUE_RETRIES) {
            stuck.push({ id: item.id, status: response.status });
          } else {
            retryUpdates.push({ id: item.id, retry_count: nextRetry, last_status: response.status });
          }
          // 401/403 likely means auth expired — stop flushing now, let client re-auth
          if (response.status === 401 || response.status === 403) break;
        }
      } catch {
        // Network failure: keep item in queue, stop trying for now
        break;
      }
    }

    // Apply updates: remove succeeded, bump retry counters on the rest.
    if (succeeded.length > 0 || retryUpdates.length > 0) {
      const db2 = await openOfflineDB();
      const tx2 = db2.transaction('queue', 'readwrite');
      const store2 = tx2.objectStore('queue');
      for (const id of succeeded) store2.delete(id);
      for (const upd of retryUpdates) {
        const getReq = store2.get(upd.id);
        await new Promise((resolve) => {
          getReq.onsuccess = () => {
            const row = getReq.result;
            if (row) {
              row.retry_count = upd.retry_count;
              row.last_status = upd.last_status;
              row.last_attempt_at = Date.now();
              store2.put(row);
            }
            resolve();
          };
          getReq.onerror = () => resolve();
        });
      }
      await new Promise((resolve) => { tx2.oncomplete = resolve; });
      db2.close();
    }

    // Notify clients of progress (success + stuck items)
    if (succeeded.length > 0 || stuck.length > 0) {
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'QUEUE_FLUSHED',
          count: succeeded.length,
          stuck: stuck.length,
          stuckItems: stuck,
        });
      });
    }
  } catch (e) {
    console.error('[SW] Queue flush error:', e);
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ONLINE') {
    flushQueue();
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // --- Signature mutations — NEVER queue, require internet ---
  if (url.pathname.includes('/signatures/sign') && request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'A assinatura eletrônica requer conexão com a internet.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // --- API mutation requests (POST/PUT/DELETE) - queue if offline ---
  if (url.pathname.startsWith('/api/') && request.method !== 'GET') {
    event.respondWith(
      request.clone().text().then((body) =>
        fetch(request).catch(async () => {
          // Network failed — queue the request
          await enqueueRequest(request.url, request.method, request.headers, body);
          return new Response(
            JSON.stringify({ queued: true, message: 'Salvo offline. Será enviado quando houver conexão.' }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          );
        })
      )
    );
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // --- API GET requests — network-first with cache fallback ---
  if (url.pathname.startsWith('/api/')) {
    // Never cache signature endpoints
    if (url.pathname.includes('/signatures/sign')) return;

    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For navigation requests (HTML pages) - network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // For assets (JS, CSS, images) - cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
