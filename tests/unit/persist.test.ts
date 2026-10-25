import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { SerializedState } from '../../src/core/types'
import { type PersistStorage, persist } from '../../src/plugins/persist'

function memoryStorage(): PersistStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

function makeWm() {
  return createWindowManager({ viewport: { width: 1000, height: 800 } })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('persist', () => {
  it('saves state to storage after the debounce window', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    persist(wm, { storage, autoRestore: false })
    wm.open({ id: 'a', title: 'Saved' })
    expect(storage.data.size).toBe(0)
    vi.advanceTimersByTime(150)
    const raw = storage.data.get('wmkit')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).state.windows[0].title).toBe('Saved')
  })

  it('coalesces rapid changes into one write', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    persist(wm, { storage, autoRestore: false, debounce: 100 })
    const win = wm.open()
    for (let i = 0; i < 20; i += 1) wm.move(win.id, 100 + i, 100)
    vi.advanceTimersByTime(100)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('restores state and does not echo the restore back into storage', () => {
    const donor = makeWm()
    donor.open({ id: 'a', title: 'Restored' })
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify(donor.serialize()))
    const setItem = vi.spyOn(storage, 'setItem')

    const wm = makeWm()
    const controller = persist(wm, { storage })
    expect(wm.get('a')?.title).toBe('Restored')
    vi.advanceTimersByTime(1000)
    expect(setItem).not.toHaveBeenCalled()
    expect(controller.restore()).toBe(true)
  })

  it('skips auto-restore when disabled', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify(donor.serialize()))
    const wm = makeWm()
    persist(wm, { storage, autoRestore: false })
    expect(wm.get('a')).toBeUndefined()
  })

  it('uses a custom key', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    persist(wm, { storage, key: 'desk', autoRestore: false })
    wm.open()
    vi.advanceTimersByTime(150)
    expect(storage.data.has('desk')).toBe(true)
    expect(storage.data.has('wmkit')).toBe(false)
  })

  it('restore returns false for missing, corrupt or rejected payloads', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const controller = persist(wm, { storage, autoRestore: false })
    expect(controller.restore()).toBe(false)
    storage.setItem('wmkit', '{broken json')
    expect(controller.restore()).toBe(false)
    storage.setItem('wmkit', JSON.stringify({ version: 99 }))
    expect(controller.restore()).toBe(false)
    storage.setItem('wmkit', 'null')
    expect(controller.restore()).toBe(false)
    storage.setItem('wmkit', '42')
    expect(controller.restore()).toBe(false)
  })

  it('reads a legacy payload written without an envelope', () => {
    const donor = makeWm()
    donor.open({ id: 'a', title: 'Legacy' })
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify(donor.serialize()))
    const wm = makeWm()
    persist(wm, { storage })
    expect(wm.get('a')?.title).toBe('Legacy')
  })

  it('drops a payload from another version when no migration is given', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify({ version: 1, state: donor.serialize() }))
    const wm = makeWm()
    expect(persist(wm, { storage, version: 2 }).restore()).toBe(false)
    expect(wm.get('a')).toBeUndefined()
  })

  it('runs the migration hook for an older payload', () => {
    const donor = makeWm()
    donor.open({ id: 'a', title: 'old' })
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify({ version: 1, state: donor.serialize() }))
    const migrate = vi.fn((state: unknown, from: number) => {
      expect(from).toBe(1)
      const data = state as SerializedState
      const first = data.windows[0]
      if (first) first.title = 'migrated'
      return data
    })
    const wm = makeWm()
    persist(wm, { storage, version: 2, migrate })
    expect(migrate).toHaveBeenCalledTimes(1)
    expect(wm.get('a')?.title).toBe('migrated')
    vi.advanceTimersByTime(150)
    expect(JSON.parse(storage.data.get('wmkit') as string).version).toBe(2)
  })

  it('treats a null migration result as unusable', () => {
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify({ version: 1, state: makeWm().serialize() }))
    const wm = makeWm()
    expect(persist(wm, { storage, version: 3, migrate: () => null }).restore()).toBe(false)
  })

  it('survives storage read and write failures', () => {
    const wm = makeWm()
    const storage: PersistStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const controller = persist(wm, { storage, autoRestore: false })
    expect(controller.restore()).toBe(false)
    wm.open()
    expect(() => vi.advanceTimersByTime(150)).not.toThrow()
    expect(() => controller.clear()).not.toThrow()
  })

  it('clear removes the stored payload', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const controller = persist(wm, { storage, autoRestore: false })
    controller.save()
    expect(storage.data.size).toBe(1)
    controller.clear()
    expect(storage.data.size).toBe(0)
  })

  it('destroy writes the pending change once and stops listening', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    const controller = persist(wm, { storage, autoRestore: false })
    wm.open()
    controller.destroy()
    expect(setItem).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    wm.open()
    vi.advanceTimersByTime(1000)
    controller.destroy()
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('writes nothing on destroy when nothing is pending', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    const controller = persist(wm, { storage, autoRestore: false })
    wm.open()
    vi.advanceTimersByTime(150)
    controller.destroy()
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('clear drops a save that was still pending', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const controller = persist(wm, { storage, autoRestore: false })
    wm.open({ id: 'a' })
    vi.advanceTimersByTime(150)
    wm.move('a', 300, 300)
    controller.clear()
    expect(storage.data.has('wmkit')).toBe(false)
    vi.advanceTimersByTime(150)
    expect(storage.data.has('wmkit')).toBe(false)
  })

  it('keeps saving after a listener throws during restore', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify({ version: 0, state: donor.serialize() }))
    const wm = makeWm()
    let fail = true
    wm.on('open', () => {
      if (fail) throw new Error('unknown skin')
    })
    const controller = persist(wm, { storage, autoRestore: false })
    expect(() => controller.restore()).toThrow(/unknown skin/)
    fail = false
    storage.data.clear()
    wm.open({ id: 'b' })
    vi.advanceTimersByTime(150)
    expect(storage.data.has('wmkit')).toBe(true)
  })

  it('restores from a storage whose writes are refused', () => {
    const donor = makeWm()
    donor.open({ id: 'a', title: 'saved' })
    const saved = JSON.stringify({ version: 0, state: donor.serialize() })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === 'wmkit' ? saved : null),
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
      removeItem: () => {},
    })
    const wm = makeWm()
    persist(wm)
    expect(wm.get('a')?.title).toBe('saved')
  })

  it('becomes a no-op when reading localStorage itself throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    try {
      const wm = makeWm()
      const controller = persist(wm)
      expect(controller.restore()).toBe(false)
      controller.save()
      controller.clear()
      wm.open()
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
      else Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('flushes the pending save when the page is hidden', () => {
    const listeners = new Map<string, () => void>()
    vi.stubGlobal('addEventListener', (type: string, handler: () => void) => {
      listeners.set(type, handler)
    })
    vi.stubGlobal('removeEventListener', (type: string) => {
      listeners.delete(type)
    })
    const wm = makeWm()
    const storage = memoryStorage()
    const controller = persist(wm, { storage, autoRestore: false })
    wm.open({ id: 'a' })
    expect(storage.data.size).toBe(0)
    listeners.get('pagehide')?.()
    expect(storage.data.has('wmkit')).toBe(true)
    controller.destroy()
    expect(listeners.has('pagehide')).toBe(false)
  })

  it('falls back to localStorage when it is available', () => {
    const fake = memoryStorage()
    vi.stubGlobal('localStorage', fake)
    const wm = makeWm()
    persist(wm, { autoRestore: false })
    wm.open()
    vi.advanceTimersByTime(150)
    expect(fake.data.has('wmkit')).toBe(true)
  })

  it('degrades to a no-op without any usable storage', () => {
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {},
    }
    vi.stubGlobal('localStorage', throwing)
    const wm = makeWm()
    const controller = persist(wm)
    expect(controller.restore()).toBe(false)
    controller.save()
    controller.clear()
    wm.open()
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
  })
})
