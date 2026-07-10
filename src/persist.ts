import type { SerializedState, WindowManager } from './core/types'

export interface PersistStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PersistOptions {
  key?: string
  storage?: PersistStorage
  debounce?: number
  autoRestore?: boolean
}

export interface PersistController {
  restore(): boolean
  save(): void
  clear(): void
  destroy(): void
}

function defaultStorage(): PersistStorage | null {
  try {
    const storage = globalThis.localStorage
    const probe = '__wmkit_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

export function persist(wm: WindowManager, options: PersistOptions = {}): PersistController {
  const key = options.key ?? 'wmkit'
  const storage = options.storage ?? defaultStorage()
  const debounce = options.debounce ?? 150
  let timer: ReturnType<typeof setTimeout> | undefined
  let suspended = false

  function save(): void {
    if (!storage) return
    try {
      storage.setItem(key, JSON.stringify(wm.serialize()))
    } catch {}
  }

  function restore(): boolean {
    if (!storage) return false
    let raw: string | null = null
    try {
      raw = storage.getItem(key)
    } catch {
      return false
    }
    if (!raw) return false
    let data: SerializedState
    try {
      data = JSON.parse(raw) as SerializedState
    } catch {
      return false
    }
    suspended = true
    const restored = wm.hydrate(data)
    suspended = false
    return restored
  }

  function clear(): void {
    if (!storage) return
    try {
      storage.removeItem(key)
    } catch {}
  }

  const unsubscribe = wm.subscribe(() => {
    if (suspended || !storage) return
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(save, debounce)
  })

  if (options.autoRestore !== false) restore()

  return {
    restore,
    save,
    clear,
    destroy() {
      unsubscribe()
      if (timer !== undefined) clearTimeout(timer)
    },
  }
}
