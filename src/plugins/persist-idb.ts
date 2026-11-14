import type { PersistStorage } from './persist'

export interface IdbStorageOptions {
  database?: string
  store?: string
}

export function idbStorage(options: IdbStorageOptions = {}): PersistStorage {
  const name = options.database ?? 'wmkit'
  const table = options.store ?? 'state'
  let opening: Promise<IDBDatabase> | undefined

  function open(): Promise<IDBDatabase> {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(table)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }).catch((error) => {
      opening = undefined
      throw error
    })
    return opening
  }

  function run<T>(
    mode: IDBTransactionMode,
    act: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return open().then(
      (database) =>
        new Promise<T>((resolve, reject) => {
          const request = act(database.transaction(table, mode).objectStore(table))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        }),
    )
  }

  return {
    getItem: (key) =>
      run('readonly', (store) => store.get(key)).then((value) =>
        typeof value === 'string' ? value : null,
      ),
    setItem: (key, value) => run('readwrite', (store) => store.put(value, key)).then(() => {}),
    removeItem: (key) => run('readwrite', (store) => store.delete(key)).then(() => {}),
  }
}
