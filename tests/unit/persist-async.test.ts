import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { type PersistStorage, persist } from '../../src/plugins/persist'

interface Pending {
  op: string
  finish(error?: unknown): void
}

function slowStorage() {
  const data = new Map<string, string>()
  const pending: Pending[] = []
  const log: string[] = []
  const later = <T>(op: string, run: () => T): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      log.push(op)
      pending.push({
        op,
        finish: (error) => (error === undefined ? resolve(run()) : reject(error)),
      })
    })
  const storage: PersistStorage = {
    getItem: (key) => later('get', () => data.get(key) ?? null),
    setItem: (key, value) => later('set', () => void data.set(key, value)),
    removeItem: (key) => later('remove', () => void data.delete(key)),
  }
  const finish = async (error?: unknown) => {
    const next = pending.shift()
    if (!next) throw new Error('nothing is in flight')
    next.finish(error)
    await settle()
  }
  return { storage, data, pending, log, finish }
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve()
}

const makeWm = () => createWindowManager({ viewport: { width: 1000, height: 800 } })
const saved = (title: string) => {
  const donor = makeWm()
  donor.open({ id: 'a', title })
  return JSON.stringify({ version: 0, state: donor.serialize() })
}
const titleIn = (raw: string | undefined) => JSON.parse(raw as string).state.windows[0]?.title

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('persist over a storage that answers later', () => {
  it('restores when the answer arrives and says so through ready', async () => {
    const slow = slowStorage()
    slow.data.set('wmkit', saved('Stored'))
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage })
    expect(wm.get('a')).toBeUndefined()
    expect(slow.log).toEqual(['get'])
    await slow.finish()
    await expect(store.ready).resolves.toBe(true)
    expect(wm.get('a')?.title).toBe('Stored')
    vi.advanceTimersByTime(5000)
    expect(slow.log).toEqual(['get'])
  })

  it('answers false from restore itself, and ready follows the latest restore', async () => {
    const slow = slowStorage()
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage, autoRestore: false })
    await expect(store.ready).resolves.toBe(false)
    expect(slow.log).toEqual([])
    slow.data.set('wmkit', saved('Later'))
    expect(store.restore()).toBe(false)
    const second = store.ready
    await slow.finish()
    await expect(second).resolves.toBe(true)
    expect(wm.get('a')?.title).toBe('Later')
  })

  it('gives a ready that is already true or false over a storage that answers at once', async () => {
    const data = new Map([['wmkit', saved('Now')]])
    const storage: PersistStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key),
    }
    const full = persist(makeWm(), { storage })
    await expect(full.ready).resolves.toBe(true)
    data.clear()
    const empty = persist(makeWm(), { storage })
    await expect(empty.ready).resolves.toBe(false)
    expect(empty.restore()).toBe(false)
    await expect(empty.ready).resolves.toBe(false)
    const none = persist(makeWm(), { storage: null as never })
    await expect(none.ready).resolves.toBe(false)
  })

  it('writes nothing while it reads, and lets what was stored replace what happened meanwhile', async () => {
    const slow = slowStorage()
    slow.data.set('wmkit', saved('Stored'))
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage })
    wm.open({ id: 'local', title: 'Local' })
    vi.advanceTimersByTime(5000)
    expect(slow.log).toEqual(['get'])
    await slow.finish()
    await expect(store.ready).resolves.toBe(true)
    expect(wm.get('local')).toBeUndefined()
    expect(wm.get('a')?.title).toBe('Stored')
    vi.advanceTimersByTime(5000)
    expect(slow.log).toEqual(['get'])
    expect(titleIn(slow.data.get('wmkit'))).toBe('Stored')
  })

  it('saves what happened meanwhile once the storage turns out to be empty', async () => {
    const slow = slowStorage()
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage })
    wm.open({ id: 'local', title: 'Local' })
    vi.advanceTimersByTime(5000)
    expect(slow.log).toEqual(['get'])
    await slow.finish()
    await expect(store.ready).resolves.toBe(false)
    expect(slow.log).toEqual(['get', 'set'])
    await slow.finish()
    expect(titleIn(slow.data.get('wmkit'))).toBe('Local')
    expect(wm.get('local')).toBeDefined()
  })

  it('reports a read that fails, answers false and goes on to save', async () => {
    const slow = slowStorage()
    const onError = vi.fn()
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage, onError })
    wm.open({ id: 'local', title: 'Local' })
    vi.advanceTimersByTime(200)
    await slow.finish(new Error('offline'))
    await expect(store.ready).resolves.toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0]?.[1]).toBe('load')
    expect(slow.log).toEqual(['get', 'set'])
  })

  it('still writes at once when save is called by hand in the middle of a read', async () => {
    const slow = slowStorage()
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage })
    wm.open({ id: 'local' })
    store.save()
    expect(slow.log).toEqual(['get', 'set'])
  })

  it('keeps one write in flight and follows it with one more that carries the latest state', async () => {
    const slow = slowStorage()
    const wm = makeWm()
    persist(wm, { storage: slow.storage, autoRestore: false, debounce: 10 })
    wm.open({ id: 'a', title: 'One' })
    vi.advanceTimersByTime(10)
    expect(slow.log).toEqual(['set'])
    wm.update('a', { title: 'Two' })
    vi.advanceTimersByTime(10)
    wm.update('a', { title: 'Three' })
    vi.advanceTimersByTime(10)
    wm.update('a', { title: 'Four' })
    vi.advanceTimersByTime(10)
    expect(slow.log).toEqual(['set'])
    expect(slow.pending).toHaveLength(1)
    await slow.finish()
    expect(titleIn(slow.data.get('wmkit'))).toBe('One')
    expect(slow.log).toEqual(['set', 'set'])
    await slow.finish()
    expect(titleIn(slow.data.get('wmkit'))).toBe('Four')
    vi.advanceTimersByTime(5000)
    await settle()
    expect(slow.log).toEqual(['set', 'set'])
  })

  it('holds a save that waited behind a write when a read starts meanwhile', async () => {
    const slow = slowStorage()
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage, autoRestore: false, debounce: 10 })
    wm.open({ id: 'a', title: 'One' })
    vi.advanceTimersByTime(10)
    wm.update('a', { title: 'Two' })
    vi.advanceTimersByTime(10)
    store.restore()
    expect(slow.log).toEqual(['set', 'get'])
    await slow.finish()
    expect(slow.log).toEqual(['set', 'get'])
    await slow.finish()
    await expect(store.ready).resolves.toBe(true)
    expect(wm.get('a')?.title).toBe('One')
    vi.advanceTimersByTime(5000)
    await settle()
    expect(slow.log).toEqual(['set', 'get'])
  })

  it('reports a write that fails and writes again at the next change', async () => {
    const slow = slowStorage()
    const onError = vi.fn()
    const wm = makeWm()
    persist(wm, { storage: slow.storage, autoRestore: false, debounce: 10, onError })
    wm.open({ id: 'a', title: 'One' })
    vi.advanceTimersByTime(10)
    await slow.finish(new Error('quota'))
    expect(onError.mock.calls.map((call) => call[1])).toEqual(['save'])
    wm.update('a', { title: 'Two' })
    vi.advanceTimersByTime(10)
    await slow.finish()
    expect(titleIn(slow.data.get('wmkit'))).toBe('Two')
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('reports once and stays quiet until a write succeeds when nobody listens for errors', async () => {
    const slow = slowStorage()
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    const wm = makeWm()
    persist(wm, { storage: slow.storage, autoRestore: false, debounce: 10 })
    for (const title of ['One', 'Two']) {
      wm.open({ id: title, title })
      vi.advanceTimersByTime(10)
      await slow.finish(new Error('quota'))
    }
    expect(reportError).toHaveBeenCalledTimes(1)
    wm.open({ id: 'c' })
    vi.advanceTimersByTime(10)
    await slow.finish()
    wm.open({ id: 'd' })
    vi.advanceTimersByTime(10)
    await slow.finish(new Error('quota'))
    expect(reportError).toHaveBeenCalledTimes(2)
  })

  it('clears after the write that is in flight, so the write cannot come back', async () => {
    const slow = slowStorage()
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage, autoRestore: false, debounce: 10 })
    wm.open({ id: 'a' })
    vi.advanceTimersByTime(10)
    wm.open({ id: 'b' })
    vi.advanceTimersByTime(10)
    store.clear()
    expect(slow.log).toEqual(['set'])
    await slow.finish()
    expect(slow.log).toEqual(['set', 'remove'])
    await slow.finish()
    expect(slow.data.size).toBe(0)
    expect(slow.pending).toHaveLength(0)
  })

  it('reports a clear that fails', async () => {
    const slow = slowStorage()
    const onError = vi.fn()
    const store = persist(makeWm(), { storage: slow.storage, autoRestore: false, onError })
    store.clear()
    await slow.finish(new Error('locked'))
    expect(onError.mock.calls.map((call) => call[1])).toEqual(['save'])
  })

  it('sends the last write on destroy without waiting for it', async () => {
    const slow = slowStorage()
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage, autoRestore: false })
    wm.open({ id: 'a', title: 'Last' })
    store.destroy()
    expect(slow.log).toEqual(['set'])
    wm.open({ id: 'b' })
    vi.advanceTimersByTime(5000)
    await slow.finish()
    expect(titleIn(slow.data.get('wmkit'))).toBe('Last')
    expect(slow.log).toEqual(['set'])
  })

  it('does not restore into a manager it has let go of', async () => {
    const slow = slowStorage()
    slow.data.set('wmkit', saved('Stored'))
    const wm = makeWm()
    const store = persist(wm, { storage: slow.storage })
    store.destroy()
    await slow.finish()
    await expect(store.ready).resolves.toBe(false)
    expect(wm.get('a')).toBeUndefined()
  })

  it('migrates what a storage that answers later holds and writes the result back', async () => {
    const slow = slowStorage()
    slow.data.set('wmkit', saved('Old'))
    const wm = makeWm()
    const store = persist(wm, {
      storage: slow.storage,
      version: 2,
      migrate: (state) => state as never,
    })
    await slow.finish()
    await expect(store.ready).resolves.toBe(true)
    expect(slow.log).toEqual(['get', 'set'])
    await slow.finish()
    expect(JSON.parse(slow.data.get('wmkit') as string).version).toBe(2)
  })

  it('takes anything with a then for an answer', async () => {
    const data = new Map([['wmkit', saved('Thenable')]])
    const soon = <T>(value: () => T) => ({
      // biome-ignore lint/suspicious/noThenProperty: the test is about a thenable
      then(done: (value: T) => void) {
        queueMicrotask(() => done(value()))
      },
    })
    const storage = {
      getItem: (key: string) => soon(() => data.get(key) ?? null),
      setItem: (key: string, value: string) => soon(() => void data.set(key, value)),
      removeItem: (key: string) => soon(() => void data.delete(key)),
    } as unknown as PersistStorage
    const wm = makeWm()
    const store = persist(wm, { storage, debounce: 10 })
    await expect(store.ready).resolves.toBe(true)
    expect(wm.get('a')?.title).toBe('Thenable')
    wm.update('a', { title: 'Changed' })
    vi.advanceTimersByTime(10)
    await settle()
    expect(titleIn(data.get('wmkit'))).toBe('Changed')
  })
})
