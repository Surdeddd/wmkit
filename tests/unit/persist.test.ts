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

describe('persist errors', () => {
  function seeded(version: number): ReturnType<typeof memoryStorage> {
    const donor = makeWm()
    donor.open({ id: 'a' })
    const storage = memoryStorage()
    storage.setItem('wmkit', JSON.stringify({ version, state: donor.serialize() }))
    return storage
  }

  it('hands a failing migration to onError instead of throwing out of persist()', () => {
    const errors: Array<[unknown, string]> = []
    const broken = new Error('bad migration')
    const wm = makeWm()
    const controller = persist(wm, {
      storage: seeded(1),
      version: 2,
      migrate: () => {
        throw broken
      },
      onError: (error, phase) => errors.push([error, phase]),
    })
    expect(errors).toEqual([[broken, 'migrate']])
    expect(wm.get('a')).toBeUndefined()
    expect(controller.restore()).toBe(false)
    expect(errors).toHaveLength(2)
  })

  it('reports a state it cannot serialize and saves again once the value is gone', () => {
    const errors: Array<[unknown, string]> = []
    const wm = makeWm()
    const storage = memoryStorage()
    persist(wm, { storage, debounce: 10, onError: (error, phase) => errors.push([error, phase]) })
    const loop: Record<string, unknown> = {}
    loop.self = loop
    wm.open({ id: 'a', meta: { loop } })
    vi.advanceTimersByTime(10)
    expect(storage.data.size).toBe(0)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.[0]).toBeInstanceOf(TypeError)
    expect(errors[0]?.[1]).toBe('save')

    wm.update('a', { meta: { loop: null } })
    vi.advanceTimersByTime(10)
    expect(storage.data.has('wmkit')).toBe(true)
    expect(errors).toHaveLength(1)
  })

  it('reports storage that refuses a read, a write or a removal', () => {
    const phases: string[] = []
    const refused = new Error('denied')
    const storage: PersistStorage = {
      getItem: () => {
        throw refused
      },
      setItem: () => {
        throw refused
      },
      removeItem: () => {
        throw refused
      },
    }
    const controller = persist(makeWm(), { storage, onError: (_, phase) => phases.push(phase) })
    controller.save()
    controller.clear()
    expect(phases).toEqual(['load', 'save', 'save'])
  })

  it('reports a payload that is not JSON', () => {
    const storage = memoryStorage()
    storage.setItem('wmkit', '{"version":')
    const onError = vi.fn()
    expect(persist(makeWm(), { storage, onError }).restore()).toBe(false)
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(SyntaxError)
    expect(onError.mock.calls[0]?.[1]).toBe('load')
  })

  it('stays quiet about storage that simply holds nothing', () => {
    const onError = vi.fn()
    expect(persist(makeWm(), { storage: memoryStorage(), onError }).restore()).toBe(false)
    expect(onError).not.toHaveBeenCalled()
  })

  it('falls back to reportError so a failure is never silent', () => {
    const reported: unknown[] = []
    vi.stubGlobal('reportError', (error: unknown) => reported.push(error))
    const broken = new Error('bad migration')
    expect(() =>
      persist(makeWm(), {
        storage: seeded(1),
        version: 2,
        migrate: () => {
          throw broken
        },
      }),
    ).not.toThrow()
    expect(reported).toEqual([broken])
  })

  it('reports only the first failure of a phase to reportError until that phase works again', () => {
    const reported: unknown[] = []
    vi.stubGlobal('reportError', (error: unknown) => reported.push(error))
    let full = true
    const data = new Map<string, string>()
    const storage: PersistStorage = {
      getItem: () => {
        throw new Error('read refused')
      },
      setItem: (key, value) => {
        if (full) throw new Error('quota')
        data.set(key, value)
      },
      removeItem: () => {
        if (full) throw new Error('quota')
      },
    }
    const wm = makeWm()
    const controller = persist(wm, { storage, debounce: 10 })
    controller.restore()
    for (let i = 0; i < 3; i += 1) {
      wm.open()
      vi.advanceTimersByTime(10)
    }
    controller.clear()
    expect(reported.map((error) => (error as Error).message)).toEqual(['read refused', 'quota'])

    full = false
    controller.save()
    expect(data.has('wmkit')).toBe(true)
    full = true
    controller.save()
    controller.save()
    expect(reported.map((error) => (error as Error).message)).toEqual([
      'read refused',
      'quota',
      'quota',
    ])
  })

  it('hands every failure to onError when one is given', () => {
    const phases: string[] = []
    const storage: PersistStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {},
    }
    const controller = persist(makeWm(), { storage, onError: (_, phase) => phases.push(phase) })
    controller.save()
    controller.save()
    controller.save()
    expect(phases).toEqual(['save', 'save', 'save'])
  })

  it('reports a failing migration again after one that worked', () => {
    const reported: unknown[] = []
    vi.stubGlobal('reportError', (error: unknown) => reported.push(error))
    let broken = true
    const storage = seeded(1)
    const controller = persist(makeWm(), {
      storage,
      version: 2,
      migrate: (state) => {
        if (broken) throw new Error('bad migration')
        return state as SerializedState
      },
    })
    controller.restore()
    broken = false
    storage.setItem('wmkit', JSON.stringify({ version: 1, state: makeWm().serialize() }))
    controller.restore()
    broken = true
    storage.setItem('wmkit', JSON.stringify({ version: 1, state: makeWm().serialize() }))
    controller.restore()
    expect(reported).toHaveLength(2)
  })

  it('stays out of the way where there is no reportError', () => {
    vi.stubGlobal('reportError', undefined)
    expect(() =>
      persist(makeWm(), {
        storage: seeded(1),
        version: 2,
        migrate: () => {
          throw new Error('bad migration')
        },
      }),
    ).not.toThrow()
  })
})

describe('persist maxWait', () => {
  it('saves at least every two seconds while changes keep coming', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    persist(wm, { storage, autoRestore: false, debounce: 150 })
    wm.open({ id: 'a' })
    for (let i = 1; i <= 50; i += 1) {
      vi.advanceTimersByTime(100)
      wm.move('a', i, i)
    }
    expect(setItem).toHaveBeenCalledTimes(2)
    expect(JSON.parse(setItem.mock.calls[1]?.[1] as string).state.windows[0].bounds.x).toBe(39)
    vi.advanceTimersByTime(150)
    expect(setItem).toHaveBeenCalledTimes(3)
    expect(JSON.parse(storage.data.get('wmkit') as string).state.windows[0].bounds.x).toBe(50)
  })

  it('takes a custom bound and starts it afresh after each save', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    persist(wm, { storage, autoRestore: false, debounce: 100, maxWait: 250 })
    wm.open({ id: 'a' })
    vi.advanceTimersByTime(90)
    wm.move('a', 1, 1)
    vi.advanceTimersByTime(90)
    wm.move('a', 2, 2)
    vi.advanceTimersByTime(70)
    expect(setItem).toHaveBeenCalledTimes(1)
    wm.move('a', 3, 3)
    vi.advanceTimersByTime(99)
    expect(setItem).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(setItem).toHaveBeenCalledTimes(2)
  })

  it('never cuts a longer debounce short by default', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    persist(wm, { storage, autoRestore: false, debounce: 5000 })
    wm.open({ id: 'a' })
    vi.advanceTimersByTime(4999)
    expect(setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('falls back to the default bound for a maxWait that is not a usable number', () => {
    for (const maxWait of [Number.NaN, -1, '500' as unknown as number]) {
      const wm = makeWm()
      const storage = memoryStorage()
      const setItem = vi.spyOn(storage, 'setItem')
      persist(wm, { storage, autoRestore: false, debounce: 150, maxWait })
      wm.open({ id: 'a' })
      for (let i = 1; i <= 19; i += 1) {
        vi.advanceTimersByTime(100)
        wm.move('a', i, i)
      }
      expect(setItem, String(maxWait)).not.toHaveBeenCalled()
      vi.advanceTimersByTime(100)
      expect(setItem, String(maxWait)).toHaveBeenCalledTimes(1)
    }
  })

  it('treats an infinite bound as no bound at all', () => {
    const wm = makeWm()
    const storage = memoryStorage()
    const setItem = vi.spyOn(storage, 'setItem')
    persist(wm, { storage, autoRestore: false, debounce: 100, maxWait: Number.POSITIVE_INFINITY })
    wm.open({ id: 'a' })
    for (let i = 1; i <= 30; i += 1) {
      vi.advanceTimersByTime(50)
      wm.move('a', i, i)
    }
    expect(setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(setItem).toHaveBeenCalledTimes(1)
  })
})
