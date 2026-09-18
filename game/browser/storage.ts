// IndexedDB persistence for the browser demo: one serialized writer, resumable
// snapshots, and cross-tab exclusion so two tabs cannot overwrite the same save.

const DB_NAME = 'infinite-pokemon-demo';
const STORE = 'snapshots';
const KEY = 'demo-save-v1';
const LOCK_NAME = 'infinite-pokemon-demo-save';

export interface DemoStorage {
  available: boolean;
  /** True when another tab already holds the save lock. */
  busy: boolean;
  load(): Promise<unknown | undefined>;
  save(snapshot: unknown): Promise<void>;
  clear(): Promise<void>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function createDemoStorage(): Promise<DemoStorage> {
  if (typeof indexedDB === 'undefined') return { available: false, busy: false, load: async () => undefined, save: async () => { throw new Error('storage unavailable'); }, clear: async () => {} };
  let locks: typeof navigator.locks | undefined;
  try { locks = navigator.locks; } catch { /* unsupported */ }
  if (!locks) return { available: false, busy: false, load: async () => undefined, save: async () => { throw new Error('storage unavailable'); }, clear: async () => {} };
  try { await openDb(); } catch { return { available: false, busy: false, load: async () => undefined, save: async () => { throw new Error('storage unavailable'); }, clear: async () => {} }; }

  // Cross-tab exclusion: hold the save lock for the life of this tab.
  let released = false;
  let resolveHeld: () => void = () => {};
  const held = new Promise<void>(resolve => { resolveHeld = resolve; });
  const busy = await new Promise<boolean>(resolve => {
    let settled = false;
    navigator.locks.request(LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock) { if (!settled) { settled = true; resolve(true); } return; }
      if (!settled) { settled = true; resolve(false); }
      return held.then(() => { released = true; });
    });
    setTimeout(() => { if (!settled) { settled = true; resolve(true); } }, 30_000);
  });
  addEventListener('beforeunload', () => { resolveHeld(); });

  // Serialize writes through a simple promise queue.
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>) => { queue = queue.then(task, task); return queue; };

  return {
    available: !busy,
    busy,
    load: () => withStore('readonly', store => store.get(KEY) as IDBRequest<unknown | undefined>),
    save: snapshot => enqueue(async () => { await withStore('readwrite', store => store.put(snapshot, KEY) as IDBRequest<unknown>); }),
    clear: () => enqueue(async () => { await withStore('readwrite', store => store.delete(KEY) as IDBRequest<undefined>); }),
  };
}
