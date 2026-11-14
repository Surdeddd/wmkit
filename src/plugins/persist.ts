import type { SerializedState, WindowManager } from '../core/types'

type Later<T> = T | PromiseLike<T>

export interface PersistStorage {
  getItem(key: string): Later<string | null>
  setItem(key: string, value: string): Later<void>
  removeItem(key: string): Later<void>
}

export interface PersistOptions {
  key?: string
  storage?: PersistStorage
  debounce?: number
  autoRestore?: boolean
  version?: number
  migrate?: (state: unknown, from: number) => SerializedState | null
  onError?: (error: unknown, phase: 'load' | 'migrate' | 'save') => void
  maxWait?: number
}

type Phase = 'load' | 'migrate' | 'save'

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
  readonly ready: Promise<boolean>
  restore(): boolean
  save(): void
  clear(): void
  destroy(): void
}

function later(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === 'function'
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
  const wait = options.maxWait
  const maxWait = Math.min(
    typeof wait === 'number' && wait >= 0 ? wait : Math.max(2000, debounce),
    2 ** 31 - 1,
  )
  const reported = new Set<Phase>()
  const report = (error: unknown, phase: Phase) => {
    if (options.onError) options.onError(error, phase)
    else if (!reported.has(phase)) {
      reported.add(phase)
      globalThis.reportError?.(error)
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let suspended = false
  let alive = true
  let loading = 0
  let held = false
  let busy = false
  let queued: (() => unknown) | undefined
  let ready = Promise.resolve(false)

  function write(op: () => unknown): void {
    if (busy) {
      queued = op
      return
    }
    const done = () => {
      reported.delete('save')
    }
    const fail = (error: unknown) => report(error, 'save')
    try {
      const out = op()
      if (!later(out)) {
        done()
        return
      }
      busy = true
      Promise.resolve(out)
        .then(done, fail)
        .then(() => {
          const next = queued
          busy = false
          queued = undefined
          if (next === push && loading) held = true
          else if (next) write(next)
        })
    } catch (error) {
      fail(error)
    }
  }

  const push = () =>
    (storage as PersistStorage).setItem(key, JSON.stringify({ version, state: wm.serialize() }))

  function save(): void {
    if (storage) write(() => push())
  }

  function restore(): boolean {
    ready = Promise.resolve(false)
    if (!storage) return false
    let raw: Later<string | null>
    try {
      raw = storage.getItem(key)
    } catch (error) {
      report(error, 'load')
      return false
    }
    if (!later(raw)) {
      const done = apply(raw)
      ready = Promise.resolve(done)
      return done
    }
    loading += 1
    ready = Promise.resolve(raw)
      .then(
        (text) => alive && apply(text),
        (error) => {
          report(error, 'load')
          return false
        },
      )
      .then((done) => {
        loading -= 1
        if (!loading && held) {
          held = false
          if (!done) write(push)
        }
        return done
      })
    return false
  }

  function apply(raw: string | null): boolean {
    let phase: Phase = 'load'
    let data: SerializedState | null
    let stale: boolean
    try {
      const envelope = raw ? unwrap(JSON.parse(raw)) : null
      reported.delete(phase)
      if (!envelope) return false
      data = envelope.state
      stale = envelope.version !== version
      if (stale) {
        phase = 'migrate'
        data = options.migrate ? options.migrate(envelope.state, envelope.version) : null
        reported.delete(phase)
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
    clearTimeout(deadline)
    timer = deadline = undefined
  }

  function flush(): void {
    if (timer === undefined) return
    cancel()
    if (loading) held = true
    else if (storage) write(push)
  }

  function clear(): void {
    cancel()
    if (storage) write(() => storage.removeItem(key))
  }

  const unsubscribe = wm.subscribe(() => {
    if (suspended || !storage) return
    clearTimeout(timer)
    timer = setTimeout(flush, debounce)
    deadline ??= setTimeout(flush, maxWait)
  })

  const host: Partial<Pick<Window, 'addEventListener' | 'removeEventListener'>> = globalThis
  host.addEventListener?.('pagehide', flush)

  if (options.autoRestore !== false) restore()

  return {
    get ready() {
      return ready
    },
    restore,
    save,
    clear,
    destroy() {
      unsubscribe()
      host.removeEventListener?.('pagehide', flush)
      flush()
      alive = false
    },
  }
}
