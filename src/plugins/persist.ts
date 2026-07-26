import type { SerializedState, WindowManager } from '../core/types'

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
  version?: number
  migrate?: (state: unknown, from: number) => SerializedState | null
}

interface PersistEnvelope {
  version: number
  state: SerializedState
}

function unwrap(raw: unknown): PersistEnvelope | null {
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Record<string, unknown>
  if (typeof candidate.version === 'number' && typeof candidate.state === 'object') {
    return { version: candidate.version, state: candidate.state as SerializedState }
  }
  if (Array.isArray(candidate.windows)) return { version: 0, state: raw as SerializedState }
  return null
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
  const version = options.version ?? 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let suspended = false

  function save(): void {
    if (!storage) return
    try {
      storage.setItem(key, JSON.stringify({ version, state: wm.serialize() }))
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
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return false
    }
    const envelope = unwrap(parsed)
    if (!envelope) return false
    let data: SerializedState | null = envelope.state
    const stale = envelope.version !== version
    if (stale) {
      data = options.migrate ? options.migrate(envelope.state, envelope.version) : null
    }
    if (!data) return false
    suspended = true
    const restored = wm.hydrate(data)
    suspended = false
    if (restored && stale) save()
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
