// Local-first draft store for surgery fichas.
//
// Why this exists: see PROXIMOS_PASSOS.md → Sprint 0. localStorage is unreliable on iOS Safari
// (7-day eviction, quota pressure) and stored a single overwriting key per surgery, so any bug
// could wipe hours of in-surgery data. This module replaces that with an IndexedDB journal of
// snapshots, plus a per-surgery metadata index. Only the snapshots reaching the server through
// confirmed PUT/POST get marked as `synced`; everything else stays on the device until the user
// either restores it or explicitly discards it.

const DB_NAME = 'vetanestesia_drafts';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';
const STORE_SURGERIES = 'surgeries';

// Cap snapshots per surgery to keep storage bounded. Anything beyond this is pruned, oldest first,
// but a synced snapshot is never pruned alone — we always keep the latest synced as a safety floor.
const MAX_SNAPSHOTS_PER_SURGERY = 30;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const store = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_surgery', 'surgeryKey', { unique: false });
        store.createIndex('by_savedAt', 'savedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SURGERIES)) {
        db.createObjectStore(STORE_SURGERIES, { keyPath: 'surgeryKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// surgeryKey: string identifier. For server-backed fichas, the numeric id (`'70'`).
// For brand-new fichas not yet posted, `'new'` (existing convention) or a UUID for multi-tab
// safety in the future. We keep `'new'` for backwards compatibility with localStorage drafts.
export function makeSurgeryKey(id) {
  return id != null && id !== '' ? String(id) : 'new';
}

function tx(db, storeNames, mode) {
  const t = db.transaction(storeNames, mode);
  return { t, store: (n) => t.objectStore(n) };
}

function awaitTx(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// Lightweight content fingerprint to detect identical-back-to-back saves and avoid bloating the
// journal. Not cryptographic; just a fast string hash.
function contentHash(data) {
  const s = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return `${h}:${s.length}`;
}

// Counts the number of "filled" fields in a draft. Used by the anti-zero invariant: we never let
// a smaller snapshot overwrite a larger one without flagging it.
function fieldsFilled(data) {
  let count = 0;
  const f = data?.form || {};
  for (const k in f) if (f[k] != null && f[k] !== '' && f[k] !== false) count++;
  count += (data?.drugs?.length || 0);
  count += (data?.blocks?.length || 0);
  count += (data?.vitals?.length || 0);
  count += (data?.complications?.length || 0);
  count += (data?.disposables?.length || 0);
  count += (data?.priorMeds?.length || 0);
  return count;
}

/**
 * Append a new snapshot to the journal for `surgeryKey`. Returns the snapshot id.
 *
 * If the previous snapshot has the same content hash, this is a no-op (returns null) — useful
 * for the periodic heartbeat where data hasn't changed.
 *
 * If the new snapshot is suspicious (much smaller than the latest synced snapshot), it's still
 * stored but flagged so the form doesn't auto-restore it.
 */
export async function appendSnapshot(surgeryKey, data, opts = {}) {
  const key = makeSurgeryKey(surgeryKey);
  const db = await openDB();

  // Fast read: latest snapshot for this surgery + the metadata row.
  let latest = null;
  let latestSynced = null;
  {
    const { t, store } = tx(db, [STORE_SNAPSHOTS], 'readonly');
    const idx = store(STORE_SNAPSHOTS).index('by_surgery');
    await new Promise((resolve) => {
      const req = idx.openCursor(IDBKeyRange.only(key), 'prev');
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        const row = cursor.value;
        if (!latest) latest = row;
        if (!latestSynced && row.syncStatus === 'synced') latestSynced = row;
        if (latest && latestSynced) return resolve();
        cursor.continue();
      };
      req.onerror = () => resolve();
    });
    await awaitTx(t);
  }

  const hash = contentHash(data);
  if (latest && latest.contentHash === hash && !opts.force) return null;

  const filled = fieldsFilled(data);
  const suspicious =
    !!latestSynced &&
    fieldsFilled(latestSynced.data) - filled > 5 &&
    filled < fieldsFilled(latestSynced.data) * 0.5;

  const snap = {
    surgeryKey: key,
    savedAt: new Date().toISOString(),
    savedAtMs: Date.now(),
    contentHash: hash,
    fieldsFilled: filled,
    suspicious,
    syncStatus: 'pending', // 'pending' | 'synced' | 'error'
    syncStatusDetail: null,
    retryCount: 0,
    data,
    source: opts.source || 'autosave', // 'autosave' | 'visibility' | 'submit' | 'manual'
  };

  let snapshotId;
  {
    const { t, store } = tx(db, [STORE_SNAPSHOTS, STORE_SURGERIES], 'readwrite');
    snapshotId = await new Promise((resolve) => {
      const req = store(STORE_SNAPSHOTS).add(snap);
      req.onsuccess = () => resolve(req.result);
    });

    // Update or insert per-surgery metadata
    const meta = {
      surgeryKey: key,
      lastEditAt: snap.savedAt,
      lastSnapshotId: snapshotId,
      lastSyncStatus: 'pending',
      patientName: data?.form?.patient_name || '',
      procedureName: data?.form?.procedure_name || '',
      surgeryId: data?.form?.id || (key !== 'new' ? key : null),
    };
    store(STORE_SURGERIES).put(meta);
    await awaitTx(t);
  }

  // Prune older snapshots beyond cap, but never the latest-synced.
  await pruneOldSnapshots(key);

  return snapshotId;
}

async function pruneOldSnapshots(surgeryKey) {
  const db = await openDB();
  const { t, store } = tx(db, [STORE_SNAPSHOTS], 'readwrite');
  const idx = store(STORE_SNAPSHOTS).index('by_surgery');

  const all = await new Promise((resolve) => {
    const out = [];
    const req = idx.openCursor(IDBKeyRange.only(surgeryKey), 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(out);
      out.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => resolve(out);
  });

  if (all.length <= MAX_SNAPSHOTS_PER_SURGERY) {
    await awaitTx(t);
    return;
  }

  const keep = new Set();
  // Always keep the latest snapshot
  keep.add(all[0].id);
  // Always keep the most recent synced snapshot (safety floor)
  const lastSynced = all.find((r) => r.syncStatus === 'synced');
  if (lastSynced) keep.add(lastSynced.id);
  // Keep the most recent N (oldest first deletion otherwise)
  for (let i = 0; i < Math.min(MAX_SNAPSHOTS_PER_SURGERY, all.length); i++) keep.add(all[i].id);

  for (const row of all) {
    if (!keep.has(row.id)) store(STORE_SNAPSHOTS).delete(row.id);
  }
  await awaitTx(t);
}

/**
 * Returns the latest non-suspicious snapshot for a surgery, or null. The form uses this on load
 * to decide whether to show the restore banner.
 */
export async function latestSnapshot(surgeryKey) {
  const key = makeSurgeryKey(surgeryKey);
  const db = await openDB();
  const { t, store } = tx(db, [STORE_SNAPSHOTS], 'readonly');
  const idx = store(STORE_SNAPSHOTS).index('by_surgery');
  const result = await new Promise((resolve) => {
    const req = idx.openCursor(IDBKeyRange.only(key), 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(null);
      const row = cursor.value;
      if (!row.suspicious) return resolve(row);
      cursor.continue();
    };
    req.onerror = () => resolve(null);
  });
  await awaitTx(t);
  return result;
}

/** Returns ALL snapshots for a surgery, newest first. Used by the timeline view in /rascunhos. */
export async function listSnapshots(surgeryKey) {
  const key = makeSurgeryKey(surgeryKey);
  const db = await openDB();
  const { t, store } = tx(db, [STORE_SNAPSHOTS], 'readonly');
  const idx = store(STORE_SNAPSHOTS).index('by_surgery');
  const out = await new Promise((resolve) => {
    const acc = [];
    const req = idx.openCursor(IDBKeyRange.only(key), 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(acc);
      acc.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => resolve(acc);
  });
  await awaitTx(t);
  return out;
}

/**
 * Lists every surgery that has at least one snapshot whose syncStatus is not 'synced'. This
 * powers the "Rascunhos" page badge.
 */
export async function listPendingSurgeries() {
  const db = await openDB();
  const { t, store } = tx(db, [STORE_SURGERIES], 'readonly');
  const all = await new Promise((resolve) => {
    const acc = [];
    const req = store(STORE_SURGERIES).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(acc);
      if (cursor.value.lastSyncStatus !== 'synced') acc.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => resolve(acc);
  });
  await awaitTx(t);
  return all.sort((a, b) => (b.lastEditAt || '').localeCompare(a.lastEditAt || ''));
}

/** Total count of pending surgeries — used for the nav badge. Cheap call. */
export async function countPendingSurgeries() {
  const list = await listPendingSurgeries();
  return list.length;
}

/**
 * Mark the most recent snapshot for a surgery as synced. Called from FichaForm.submit() after a
 * successful PUT/POST. We don't delete the snapshot — we tag it so the journal preserves history
 * and so future suspicious-snapshot checks have a baseline.
 */
export async function markLatestAsSynced(surgeryKey, opts = {}) {
  const key = makeSurgeryKey(surgeryKey);
  const db = await openDB();
  const { t, store } = tx(db, [STORE_SNAPSHOTS, STORE_SURGERIES], 'readwrite');
  const idx = store(STORE_SNAPSHOTS).index('by_surgery');

  await new Promise((resolve) => {
    const req = idx.openCursor(IDBKeyRange.only(key), 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      const row = cursor.value;
      row.syncStatus = 'synced';
      row.syncStatusDetail = opts.detail || null;
      row.syncedAt = new Date().toISOString();
      cursor.update(row);
      resolve();
    };
    req.onerror = () => resolve();
  });

  // Update metadata row
  await new Promise((resolve) => {
    const req = store(STORE_SURGERIES).get(key);
    req.onsuccess = () => {
      const meta = req.result;
      if (meta) {
        meta.lastSyncStatus = 'synced';
        meta.lastSyncedAt = new Date().toISOString();
        if (opts.serverSurgeryId) meta.surgeryId = opts.serverSurgeryId;
        store(STORE_SURGERIES).put(meta);
      }
      resolve();
    };
    req.onerror = () => resolve();
  });

  await awaitTx(t);
}

/**
 * Re-key a surgery's snapshots from `'new'` to its server-assigned id. Called once after the
 * first successful POST creating the surgery. Without this, the local journal would diverge
 * from the server forever.
 */
export async function rekeySurgery(fromKey, toKey) {
  if (fromKey === toKey) return;
  const db = await openDB();
  const { t, store } = tx(db, [STORE_SNAPSHOTS, STORE_SURGERIES], 'readwrite');
  const idx = store(STORE_SNAPSHOTS).index('by_surgery');

  await new Promise((resolve) => {
    const req = idx.openCursor(IDBKeyRange.only(fromKey));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      const row = cursor.value;
      row.surgeryKey = toKey;
      cursor.update(row);
      cursor.continue();
    };
    req.onerror = () => resolve();
  });

  // Move metadata row
  await new Promise((resolve) => {
    const req = store(STORE_SURGERIES).get(fromKey);
    req.onsuccess = () => {
      const meta = req.result;
      if (meta) {
        const newMeta = { ...meta, surgeryKey: toKey, surgeryId: toKey };
        store(STORE_SURGERIES).delete(fromKey);
        store(STORE_SURGERIES).put(newMeta);
      }
      resolve();
    };
    req.onerror = () => resolve();
  });

  await awaitTx(t);
}

/** Discard all snapshots for a surgery. Triggered only by explicit user action. */
export async function purgeSurgery(surgeryKey) {
  const key = makeSurgeryKey(surgeryKey);
  const db = await openDB();
  const { t, store } = tx(db, [STORE_SNAPSHOTS, STORE_SURGERIES], 'readwrite');
  const idx = store(STORE_SNAPSHOTS).index('by_surgery');

  await new Promise((resolve) => {
    const req = idx.openCursor(IDBKeyRange.only(key));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      store(STORE_SNAPSHOTS).delete(cursor.primaryKey);
      cursor.continue();
    };
    req.onerror = () => resolve();
  });

  store(STORE_SURGERIES).delete(key);
  await awaitTx(t);

  // Also clear the localStorage fallback. Without this, migrateFromLocalStorage on the next boot
  // would re-import the localStorage draft and the "discarded" surgery would come back as a zombie.
  try {
    const lsKey = `vetanestesia_draft_${key}`;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(lsKey);
      try {
        const list = JSON.parse(localStorage.getItem('vetanestesia_drafts') || '[]');
        localStorage.setItem('vetanestesia_drafts', JSON.stringify(list.filter((d) => d.key !== lsKey)));
      } catch { /* malformed list — leave as is */ }
    }
  } catch { /* localStorage unavailable */ }
}

/**
 * One-time migration from the old localStorage scheme to IndexedDB. Imports each `vetanestesia_draft_*`
 * key as a single snapshot. Idempotent — running twice is safe (we check by hash).
 */
export async function migrateFromLocalStorage() {
  if (typeof localStorage === 'undefined') return { migrated: 0 };
  let migrated = 0;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('vetanestesia_draft_')) keys.push(k);
  }
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const draft = JSON.parse(raw);
      const surgeryKey = k.slice('vetanestesia_draft_'.length);
      const id = await appendSnapshot(surgeryKey, draft, { source: 'localStorage-migration' });
      if (id != null) migrated++;
    } catch {
      // skip malformed entries
    }
  }
  return { migrated };
}
