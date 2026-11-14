type View = Window & typeof globalThis

type Listener = EventListenerOrEventListenerObject | null

type Add = (
  this: unknown,
  type: string,
  listener: Listener,
  options?: boolean | AddEventListenerOptions,
) => void

type Remove = (
  this: unknown,
  type: string,
  listener: Listener,
  options?: boolean | EventListenerOptions,
) => void

interface ListenerHost {
  addEventListener: Add
  removeEventListener: Remove
}

interface Held {
  target: object
  type: string
  capture: boolean
  listener: object
}

type Schedule = (handler: (...args: unknown[]) => void, ...rest: unknown[]) => unknown
type Cancel = (id: unknown) => void

interface ObserverLike {
  observe(target: object, ...rest: unknown[]): void
  unobserve?(target: object): void
  disconnect(): void
}

type ObserverClass = new (...args: never[]) => ObserverLike

export interface Resources {
  live(): string[]
  restore(): void
}

const OBSERVERS = ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'] as const

function captureOf(options: boolean | EventListenerOptions | undefined): boolean {
  return typeof options === 'boolean' ? options : options?.capture === true
}

function nameOf(target: object, view: View): string {
  if (target === view) return 'window'
  if (target === view.document) return 'document'
  const element = target as Partial<Element>
  if (typeof element.tagName !== 'string') return Object.prototype.toString.call(target)
  return `<${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}>`
}

export function trackResources(view: View = window): Resources {
  const held: Held[] = []
  const pending = new Map<unknown, string>()
  const watched = new Map<object, { name: string; targets: Set<object> }>()
  const undo: Array<() => void> = []
  let internal = false

  const indexOf = (target: object, type: string, capture: boolean, listener: object) =>
    held.findIndex(
      (entry) =>
        entry.target === target &&
        entry.type === type &&
        entry.capture === capture &&
        entry.listener === listener,
    )

  function patchListeners(host: ListenerHost, self?: object): void {
    const add = host.addEventListener
    const remove = host.removeEventListener
    host.addEventListener = function addEventListener(this: unknown, type, listener, options) {
      const target = self ?? (this as object | undefined) ?? view
      const settings = typeof options === 'object' ? options : undefined
      if (!internal && listener && !settings?.once && !settings?.signal?.aborted) {
        const capture = captureOf(options)
        if (indexOf(target, type, capture, listener) < 0) {
          const entry: Held = { target, type, capture, listener }
          held.push(entry)
          if (settings?.signal) {
            internal = true
            settings.signal.addEventListener('abort', () => {
              const at = held.indexOf(entry)
              if (at >= 0) held.splice(at, 1)
            })
            internal = false
          }
        }
      }
      return add.call(this, type, listener, options)
    }
    host.removeEventListener = function removeEventListener(
      this: unknown,
      type,
      listener,
      options,
    ) {
      const target = self ?? (this as object | undefined) ?? view
      if (listener) {
        const at = indexOf(target, type, captureOf(options), listener)
        if (at >= 0) held.splice(at, 1)
      }
      return remove.call(this, type, listener, options)
    }
    undo.push(() => {
      host.addEventListener = add
      host.removeEventListener = remove
    })
  }

  function patchSchedule(set: string, clear: string, label: string, repeats: boolean): void {
    const slots = view as unknown as Record<string, unknown>
    const schedule = slots[set] as Schedule | undefined
    const cancel = slots[clear] as Cancel | undefined
    if (typeof schedule !== 'function' || typeof cancel !== 'function') return
    slots[set] = (handler: unknown, ...rest: unknown[]) => {
      if (typeof handler !== 'function') return schedule(handler as never, ...rest)
      const id: unknown = schedule(
        (...args: unknown[]) => {
          if (!repeats) pending.delete(id)
          ;(handler as (...inner: unknown[]) => void)(...args)
        },
        ...rest,
      )
      pending.set(id, label)
      return id
    }
    slots[clear] = (id: unknown) => {
      pending.delete(id)
      cancel(id)
    }
    undo.push(() => {
      slots[set] = schedule
      slots[clear] = cancel
    })
  }

  function patchObserver(name: (typeof OBSERVERS)[number]): void {
    const slots = view as unknown as Record<string, unknown>
    const Original = slots[name] as ObserverClass | undefined
    if (typeof Original !== 'function') return
    const Tracked = class extends Original {
      override observe(target: object, ...rest: unknown[]): void {
        const entry = watched.get(this) ?? { name, targets: new Set<object>() }
        entry.targets.add(target)
        watched.set(this, entry)
        super.observe(target, ...rest)
      }

      override unobserve(target: object): void {
        const entry = watched.get(this)
        entry?.targets.delete(target)
        if (entry?.targets.size === 0) watched.delete(this)
        super.unobserve?.(target)
      }

      override disconnect(): void {
        watched.delete(this)
        super.disconnect()
      }
    }
    slots[name] = Tracked
    undo.push(() => {
      slots[name] = Original
    })
  }

  patchListeners(view.EventTarget.prototype as unknown as ListenerHost)
  if (Object.hasOwn(view, 'addEventListener')) {
    patchListeners(view as unknown as ListenerHost, view)
  }
  patchSchedule('setTimeout', 'clearTimeout', 'timeout', false)
  patchSchedule('setInterval', 'clearInterval', 'interval', true)
  patchSchedule('requestAnimationFrame', 'cancelAnimationFrame', 'frame', false)
  for (const name of OBSERVERS) patchObserver(name)

  return {
    live() {
      return [
        ...held.map(
          (entry) =>
            `listener ${entry.type}${entry.capture ? ' (capture)' : ''} on ${nameOf(entry.target, view)}`,
        ),
        ...[...pending.values()].map((label) => `pending ${label}`),
        ...[...watched.values()].map((entry) => `${entry.name} watching ${entry.targets.size}`),
      ]
    },
    restore() {
      for (const step of undo.splice(0).reverse()) step()
    },
  }
}
