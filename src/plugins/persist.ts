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
  onError?: (error: unknown, phase: 'load' | 'migrate' | 'save') => void
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
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function persist(wm: WindowManager, options: PersistOptions = {}): PersistController {
  const key = options.key ?? 'wmkit'
  const storage = options.storage ?? defaultStorage()
  const debounce = options.debounce ?? 150
  const version = options.version ?? 0
  const report = options.onError ?? ((error: unknown) => globalThis.reportError?.(error))
  let timer: ReturnType<typeof setTimeout> | undefined
  let suspended = false

  function save(): void {
    if (!storage) return
    try {
      storage.setItem(key, JSON.stringify({ version, state: wm.serialize() }))
    } catch (error) {
      report(error, 'save')
    }
  }

  function restore(): boolean {
    if (!storage) return false
    let phase: 'load' | 'migrate' = 'load'
    let data: SerializedState | null
    let stale: boolean
    try {
      const raw = storage.getItem(key)
      if (!raw) return false
      const envelope = unwrap(JSON.parse(raw))
      if (!envelope) return false
      data = envelope.state
      stale = envelope.version !== version
      if (stale) {
        phase = 'migrate'
        data = options.migrate ? options.migrate(envelope.state, envelope.version) : null
      }
    } catch (error) {
      report(error, phase)
      return false
    }
    if (!data) return false
    suspended = true
    let restored: boolean
    try {
      restored = wm.hydrate(data)
    } finally {
      suspended = false
    }
    if (restored && stale) save()
    return restored
  }

  function cancel(): void {
    clearTimeout(timer)
    timer = undefined
  }

  function flush(): void {
    if (timer === undefined) return
    cancel()
    save()
  }

  function clear(): void {
    cancel()
    if (!storage) return
    try {
      storage.removeItem(key)
    } catch (error) {
      report(error, 'save')
    }
  }

  const unsubscribe = wm.subscribe(() => {
    if (suspended || !storage) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      save()
    }, debounce)
  })

  const host: Partial<Pick<Window, 'addEventListener' | 'removeEventListener'>> = globalThis
  host.addEventListener?.('pagehide', flush)

  if (options.autoRestore !== false) restore()

  return {
    restore,
    save,
    clear,
    destroy() {
      unsubscribe()
      host.removeEventListener?.('pagehide', flush)
      flush()
    },
  }
}
