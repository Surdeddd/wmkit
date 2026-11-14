import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { persist } from '../../src/plugins/persist'
import { idbStorage } from '../../src/plugins/persist-idb'

type Tables = Map<string, Map<string, unknown>>

interface FakeRequest {
  result: unknown
  error: unknown
  onsuccess: (() => void) | null
  onerror: (() => void) | null
  onupgradeneeded: (() => void) | null
}

function fakeIndexedDB() {
  const databases = new Map<string, Tables>()
  const opened: string[] = []
  const state = { refuse: false, broken: false }
  const blank = (): FakeRequest => ({
    result: undefined,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  })
  const request = (run: () => unknown): FakeRequest => {
    const made = blank()
    queueMicrotask(() => {
      try {
        if (state.broken) throw new Error('the store failed')
        made.result = run()
        made.onsuccess?.()
      } catch (error) {
        made.error = error
        made.onerror?.()
      }
    })
    return made
  }
  const factory = {
    open(name: string): FakeRequest {
      const made = blank()
      opened.push(name)
      queueMicrotask(() => {
        if (state.refuse) {
          made.error = new Error('blocked')
          made.onerror?.()
          return
        }
        const fresh = !databases.has(name)
        const tables: Tables = databases.get(name) ?? new Map()
        databases.set(name, tables)
        made.result = {
          createObjectStore: (store: string) => void tables.set(store, new Map()),
          transaction: (store: string) => {
            const table = tables.get(store)
            if (!table) throw new Error('NotFoundError')
            return {
              objectStore: () => ({
                get: (key: string) => request(() => table.get(key)),
                put: (value: unknown, key: string) => request(() => void table.set(key, value)),
                delete: (key: string) => request(() => void table.delete(key)),
              }),
            }
          },
        }
        if (fresh) made.onupgradeneeded?.()
        made.onsuccess?.()
      })
      return made
    },
  }
  return { factory, databases, opened, state }
}

const turns = async () => {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve()
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a storage in IndexedDB', () => {
  it('keeps a value under its key and gives null for what it does not hold', async () => {
    const fake = fakeIndexedDB()
    vi.stubGlobal('indexedDB', fake.factory)
    const storage = idbStorage()
    await expect(storage.getItem('layout')).resolves.toBeNull()
    await storage.setItem('layout', 'one')
    await storage.setItem('other', 'two')
    await expect(storage.getItem('layout')).resolves.toBe('one')
    await storage.removeItem('layout')
    await expect(storage.getItem('layout')).resolves.toBeNull()
    await expect(storage.getItem('other')).resolves.toBe('two')
    expect(fake.opened).toEqual(['wmkit'])
    expect([...(fake.databases.get('wmkit') as Tables).keys()]).toEqual(['state'])
  })

  it('takes the names of the database and of the store', async () => {
    const fake = fakeIndexedDB()
    vi.stubGlobal('indexedDB', fake.factory)
    const storage = idbStorage({ database: 'app', store: 'desk' })
    await storage.setItem('layout', 'kept')
    expect(fake.databases.get('app')?.get('desk')?.get('layout')).toBe('kept')
  })

  it('gives null for a value that is not text', async () => {
    const fake = fakeIndexedDB()
    vi.stubGlobal('indexedDB', fake.factory)
    const storage = idbStorage()
    await storage.setItem('layout', 'text')
    fake.databases.get('wmkit')?.get('state')?.set('layout', { not: 'text' })
    await expect(storage.getItem('layout')).resolves.toBeNull()
  })

  it('rejects when the database does not open and tries again the next time', async () => {
    const fake = fakeIndexedDB()
    vi.stubGlobal('indexedDB', fake.factory)
    fake.state.refuse = true
    const storage = idbStorage()
    await expect(storage.getItem('layout')).rejects.toThrow('blocked')
    await expect(storage.setItem('layout', 'x')).rejects.toThrow('blocked')
    fake.state.refuse = false
    await expect(storage.setItem('layout', 'x')).resolves.toBeUndefined()
    await expect(storage.getItem('layout')).resolves.toBe('x')
    expect(fake.opened).toHaveLength(3)
  })

  it('rejects where there is no IndexedDB, and when the store is not in the database', async () => {
    const none = idbStorage()
    await expect(none.getItem('layout')).rejects.toThrow()
    await expect(none.removeItem('layout')).rejects.toThrow()

    const fake = fakeIndexedDB()
    vi.stubGlobal('indexedDB', fake.factory)
    await idbStorage().setItem('layout', 'x')
    await expect(idbStorage({ store: 'another' }).getItem('layout')).rejects.toThrow(
      'NotFoundError',
    )
  })

  it('carries a desktop through persist: saved, restored, cleared', async () => {
    vi.useFakeTimers()
    const fake = fakeIndexedDB()
    vi.stubGlobal('indexedDB', fake.factory)
    const first = createWindowManager({ viewport: { width: 1000, height: 800 } })
    const store = persist(first, { storage: idbStorage(), debounce: 10 })
    await expect(store.ready).resolves.toBe(false)
    first.open({ id: 'a', title: 'Kept' })
    vi.advanceTimersByTime(10)
    await turns()

    const second = createWindowManager({ viewport: { width: 1000, height: 800 } })
    const again = persist(second, { storage: idbStorage() })
    await expect(again.ready).resolves.toBe(true)
    expect(second.get('a')?.title).toBe('Kept')

    again.clear()
    await turns()
    const third = createWindowManager({ viewport: { width: 1000, height: 800 } })
    await expect(persist(third, { storage: idbStorage() }).ready).resolves.toBe(false)
  })

  it('reports to onError when there is no IndexedDB to read or write', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    const wm = createWindowManager({ viewport: { width: 1000, height: 800 } })
    const store = persist(wm, { storage: idbStorage(), debounce: 10, onError })
    await expect(store.ready).resolves.toBe(false)
    wm.open({ id: 'a' })
    vi.advanceTimersByTime(10)
    await turns()
    expect(onError.mock.calls.map((call) => call[1])).toEqual(['load', 'save'])
  })
})

describe('a store that fails in the middle', () => {
  it('rejects the call and works again when the store does', async () => {
    const fake = fakeIndexedDB()
    vi.stubGlobal('indexedDB', fake.factory)
    const storage = idbStorage()
    await storage.setItem('layout', 'kept')
    fake.state.broken = true
    await expect(storage.getItem('layout')).rejects.toThrow('the store failed')
    await expect(storage.setItem('layout', 'lost')).rejects.toThrow('the store failed')
    await expect(storage.removeItem('layout')).rejects.toThrow('the store failed')
    fake.state.broken = false
    await expect(storage.getItem('layout')).resolves.toBe('kept')
  })
})
