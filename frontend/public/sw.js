const CACHE_NAME = 'vetanestesia-v2';
const OFFLINE_QUEUE_KEY = 'vetanestesia_offline_queue';

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

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// --- Offline Queue helpers (using IndexedDB for reliability) ---
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vetanestesia_offline', 1);
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

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        if (response.ok || response.status < 500) {
          succeeded.push(item.id);
        }
      } catch {
        // Still offline or server down, stop trying
        break;
      }
    }

    // Remove succeeded items
    if (succeeded.length > 0) {
      const db2 = await openOfflineDB();
      const tx2 = db2.transaction('queue', 'readwrite');
      const store2 = tx2.objectStore('queue');
      for (const id of succeeded) {
        store2.delete(id);
      }
      await new Promise((resolve) => { tx2.oncomplete = resolve; });
      db2.close();

      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({ type: 'QUEUE_FLUSHED', count: succeeded.length });
      });
    }
  } catch (e) {
    console.error('[SW] Queue flush error:', e);
  }
}

// Flush queue when coming back online
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ONLINE') {
    flushQueue();
  }
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

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

  // API GET requests - network only (no caching of API data)
  if (url.pathname.startsWith('/api/')) return;

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
