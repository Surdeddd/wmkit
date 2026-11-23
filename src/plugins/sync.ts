import type { SerializedState, WindowManager } from '../core/types'

export interface SyncChannel {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  close?(): void
}

export interface SyncOptions {
  channel?: string | SyncChannel
  wait?: number
  onError?: (error: unknown) => void
}

export interface SyncController {
  readonly ready: Promise<boolean>
  destroy(): void
}

interface Wire {
  wmkit?: unknown
  from?: unknown
  ask?: unknown
  by?: unknown
  stamp?: unknown
  state?: unknown
}

type Listener = (event: { data: unknown }) => void

function open(name: string): SyncChannel | null {
  if (typeof document === 'undefined') return null
  if (typeof BroadcastChannel === 'function') return new BroadcastChannel(name)
  const host = globalThis as Partial<Pick<Window, 'addEventListener' | 'removeEventListener'>>
  let store: Storage | undefined
  try {
    store = globalThis.localStorage
  } catch {
    return null
  }
  if (!store || !host.addEventListener || !host.removeEventListener) return null
  const key = `wmkit-sync:${name}`
  const relays = new Map<Listener, (event: StorageEvent) => void>()
  const kept = store
  return {
    postMessage(message) {
      kept.setItem(key, JSON.stringify([message, Math.random()]))
    },
    addEventListener(_type, listener) {
      const relay = (event: StorageEvent) => {
        if (event.key !== key || !event.newValue) return
        let data: unknown
        try {
          data = (JSON.parse(event.newValue) as unknown[])[0]
        } catch {
          return
        }
        listener({ data })
      }
      relays.set(listener, relay)
      host.addEventListener?.('storage', relay)
    },
    removeEventListener(_type, listener) {
      host.removeEventListener?.('storage', relays.get(listener) as (event: StorageEvent) => void)
      relays.delete(listener)
    },
  }
}

export function sync(wm: WindowManager, options: SyncOptions = {}): SyncController {
  const given = options.channel
  const own = typeof given !== 'object'
  const channel = own ? open(given ?? 'wmkit') : given
  if (!channel) return { ready: Promise.resolve(false), destroy() {} }

  const self = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const report = (error: unknown) => {
    if (options.onError) options.onError(error)
    else globalThis.reportError?.(error)
  }
  let alive = true
  let joined = false
  let applying = false
  let clock = 0
  let stamp = 0
  let by = self
  let settle!: (found: boolean) => void
  const ready = new Promise<boolean>((resolve) => {
    settle = resolve
  })

  function post(message: Wire): void {
    try {
      channel?.postMessage({ wmkit: 1, from: self, ...message })
    } catch (error) {
      report(error)
    }
  }

  function join(found: boolean): void {
    if (joined) return
    joined = true
    clearTimeout(timer)
    settle(found)
  }

  function onMessage(event: { data: unknown }): void {
    const data = event.data as Wire | null
    if (!alive || data?.wmkit !== 1 || typeof data.from !== 'string' || data.from === self) return
    if (data.ask) {
      if (joined) post({ by, stamp, state: wm.serialize() })
      return
    }
    const theirs = data.stamp
    const author = data.by
    if (typeof theirs !== 'number' || !Number.isFinite(theirs) || typeof author !== 'string') return
    if (joined && !(theirs > stamp || (theirs === stamp && author > by))) return
    let done = false
    applying = true
    try {
      done = wm.hydrate(data.state as SerializedState)
    } catch (error) {
      report(error)
    } finally {
      applying = false
    }
    if (!done) return
    stamp = theirs
    by = author
    clock = Math.max(clock, theirs)
    join(true)
  }

  const stop = wm.subscribe(() => {
    if (applying) return
    clock += 1
    stamp = clock
    by = self
    if (joined) post({ by, stamp, state: wm.serialize() })
  })
  channel.addEventListener('message', onMessage)
  const timer = setTimeout(() => {
    join(false)
    if (stamp > 0) post({ by, stamp, state: wm.serialize() })
  }, options.wait ?? 300)
  post({ ask: true })

  return {
    ready,
    destroy() {
      if (!alive) return
      alive = false
      stop()
      channel.removeEventListener('message', onMessage)
      if (own) channel.close?.()
      join(false)
    },
  }
}
