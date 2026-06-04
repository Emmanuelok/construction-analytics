/* Tiny promise-based IndexedDB key/value store — for payloads too big for
 * localStorage (e.g. an imported IFC rationalized into a BuildingModel). One DB,
 * one object store; get / set / del. Guards when IndexedDB is unavailable. */

const DB = 'aec-studio', STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE) }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

const available = () => typeof indexedDB !== 'undefined'

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (!available()) return
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
  } finally { db.close() }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (!available()) return null
  const db = await open()
  try {
    return await new Promise<T | null>((resolve, reject) => { const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key); rq.onsuccess = () => resolve((rq.result as T) ?? null); rq.onerror = () => reject(rq.error) })
  } finally { db.close() }
}

export async function idbDel(key: string): Promise<void> {
  if (!available()) return
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
  } finally { db.close() }
}
