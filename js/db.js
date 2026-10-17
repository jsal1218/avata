// Tiny promise wrapper around IndexedDB. Everything stays on this device.
const DB_NAME = 'avata', VER = 1;
let dbp;
function open() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('models')) db.createObjectStore('models', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('gens')) { const s = db.createObjectStore('gens', { keyPath: 'id' }); s.createIndex('modelId', 'modelId'); s.createIndex('createdAt', 'createdAt'); }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store); let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export const db = {
  all: store => tx(store, 'readonly', s => req(s.getAll())),
  get: (store, id) => tx(store, 'readonly', s => req(s.get(id))),
  put: (store, v, key) => tx(store, 'readwrite', s => req(key === undefined ? s.put(v) : s.put(v, key))),
  del: (store, id) => tx(store, 'readwrite', s => req(s.delete(id))),
  clear: store => tx(store, 'readwrite', s => req(s.clear())),
  byModel: modelId => tx('gens', 'readonly', s => req(s.index('modelId').getAll(modelId))),
};
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
