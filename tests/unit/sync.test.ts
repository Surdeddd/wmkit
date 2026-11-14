import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { type SyncChannel, type SyncController, sync } from '../../src/plugins/sync'
import { stateDrift } from './support/dom-state'
import { fuzz, patience } from './support/fuzz'

type Listener = (event: { data: unknown }) => void

function hub() {
  const ends: Array<Set<Listener>> = []
  const queue: Array<{ to: Set<Listener>; data: unknown }> = []
  const sent: unknown[] = []
  return {
    queue,
    sent,
    channel(): SyncChannel & { closed: boolean } {
      const listeners = new Set<Listener>()
      ends.push(listeners)
      return {
        closed: false,
        postMessage(data) {
          sent.push(data)
          for (const other of ends) {
            if (other !== listeners) queue.push({ to: other, data: structuredClone(data) })
          }
        },
        addEventListener: (_type, listener) => void listeners.add(listener),
        removeEventListener: (_type, listener) => void listeners.delete(listener),
        close() {
          this.closed = true
        },
      }
    },
    deliver(at = 0) {
      const [message] = queue.splice(at, 1)
      if (message) for (const listener of [...message.to]) listener({ data: message.data })
    },
    drain() {
      for (let guard = 0; queue.length > 0 && guard < 10_000; guard += 1) this.deliver(0)
    },
  }
}

const makeWm = () => createWindowManager({ viewport: { width: 1000, height: 800 } })
const picture = (wm: WindowManager) => JSON.stringify(wm.serialize())
const kinds = (sent: unknown[]) =>
  sent.map((message) => ((message as { ask?: boolean }).ask ? 'ask' : 'state'))

function alone(wm: WindowManager, net: ReturnType<typeof hub>): SyncController {
  const link = sync(wm, { channel: net.channel() })
  vi.advanceTimersByTime(300)
  net.drain()
  return link
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('desktops kept in step over a channel', () => {
  it('asks who is there, hears nobody and says so through ready', async () => {
    const net = hub()
    const link = sync(makeWm(), { channel: net.channel() })
    expect(kinds(net.sent)).toEqual(['ask'])
    vi.advanceTimersByTime(299)
    let answered: boolean | undefined
    void link.ready.then((found) => {
      answered = found
    })
    await Promise.resolve()
    expect(answered).toBeUndefined()
    vi.advanceTimersByTime(1)
    await expect(link.ready).resolves.toBe(false)
  })

  it('waits as long as it is told to before it decides that it is alone', async () => {
    const net = hub()
    const link = sync(makeWm(), { channel: net.channel(), wait: 20 })
    vi.advanceTimersByTime(20)
    await expect(link.ready).resolves.toBe(false)
  })

  it('carries a change to the other desktop and does not send it back', () => {
    const net = hub()
    const [first, second] = [makeWm(), makeWm()]
    alone(first, net)
    alone(second, net)
    net.sent.length = 0
    first.open({ id: 'a', title: 'Shared' })
    expect(kinds(net.sent)).toEqual(['state'])
    net.drain()
    expect(second.get('a')?.title).toBe('Shared')
    expect(picture(second)).toBe(picture(first))
    expect(kinds(net.sent)).toEqual(['state'])
    second.move('a', 300, 200)
    net.drain()
    expect(first.get('a')?.bounds).toMatchObject({ x: 300, y: 200 })
    expect(kinds(net.sent)).toEqual(['state', 'state'])
  })

  it('starts the history of the desktop that takes a state over, the way hydrate does', () => {
    const net = hub()
    const [first, second] = [makeWm(), makeWm()]
    alone(first, net)
    alone(second, net)
    second.open({ id: 'mine' })
    net.drain()
    expect(second.canUndo()).toBe(true)
    first.open({ id: 'a' })
    net.drain()
    expect(second.canUndo()).toBe(false)
    expect(first.canUndo()).toBe(true)
  })

  it('lets the later of two changes win, and breaks a tie the same way on both sides', () => {
    const net = hub()
    const [first, second] = [makeWm(), makeWm()]
    alone(first, net)
    alone(second, net)
    first.open({ id: 'a', title: 'From the first' })
    second.open({ id: 'b', title: 'From the second' })
    net.drain()
    expect(picture(first)).toBe(picture(second))
    expect(Object.keys(first.getState().windows)).toHaveLength(1)

    first.update(Object.keys(first.getState().windows)[0] as string, { title: 'Later' })
    net.deliver()
    second.open({ id: 'c' })
    net.drain()
    expect(picture(first)).toBe(picture(second))
    expect(first.get('c')).toBeDefined()
  })

  it('drops a state that is older than the one it holds', () => {
    const net = hub()
    const [first, second] = [makeWm(), makeWm()]
    alone(first, net)
    alone(second, net)
    first.open({ id: 'a', title: 'One' })
    first.update('a', { title: 'Two' })
    expect(net.queue).toHaveLength(2)
    net.deliver(1)
    expect(second.get('a')?.title).toBe('Two')
    net.deliver(0)
    expect(second.get('a')?.title).toBe('Two')
  })

  it('joins the desktops that are already there instead of replacing them with its own', async () => {
    const net = hub()
    const old = makeWm()
    alone(old, net)
    old.open({ id: 'kept', title: 'Arranged long ago' })
    net.drain()

    const fresh = makeWm()
    const link = sync(fresh, { channel: net.channel() })
    fresh.open({ id: 'default-1' })
    fresh.open({ id: 'default-2' })
    fresh.open({ id: 'default-3' })
    net.drain()
    await expect(link.ready).resolves.toBe(true)
    expect(Object.keys(fresh.getState().windows)).toEqual(['kept'])
    expect(Object.keys(old.getState().windows)).toEqual(['kept'])
    expect(picture(fresh)).toBe(picture(old))

    fresh.open({ id: 'after' })
    net.drain()
    expect(old.get('after')).toBeDefined()
    vi.advanceTimersByTime(1000)
    expect(picture(fresh)).toBe(picture(old))
  })

  it('says what it changed while it waited once nobody answered, so a late desktop is not left behind', () => {
    const net = hub()
    const early = makeWm()
    sync(early, { channel: net.channel() })
    early.open({ id: 'a', title: 'Opened while waiting' })
    expect(kinds(net.sent)).toEqual(['ask'])
    vi.advanceTimersByTime(300)
    expect(kinds(net.sent)).toEqual(['ask', 'state'])

    const quiet = makeWm()
    sync(quiet, { channel: net.channel() })
    vi.advanceTimersByTime(300)
    expect(kinds(net.sent)).toEqual(['ask', 'state', 'ask'])
    net.drain()
    expect(quiet.get('a')?.title).toBe('Opened while waiting')
  })

  it('does not answer while it is still finding out who is there', () => {
    const net = hub()
    const [first, second] = [makeWm(), makeWm()]
    sync(first, { channel: net.channel() })
    sync(second, { channel: net.channel() })
    net.drain()
    expect(kinds(net.sent)).toEqual(['ask', 'ask'])
  })

  it('ignores what is not a message of its own kind, and reports a state that cannot be taken', () => {
    const net = hub()
    const wm = makeWm()
    const onError = vi.fn()
    const mine = net.channel()
    sync(wm, { channel: mine, onError })
    vi.advanceTimersByTime(300)
    wm.open({ id: 'a' })
    const before = picture(wm)
    const stranger = net.channel()
    for (const junk of [
      null,
      'text',
      42,
      {},
      { wmkit: 2, from: 'x', by: 'x', stamp: 9, state: {} },
      { wmkit: 1, from: 7, by: 'x', stamp: 9, state: {} },
      { wmkit: 1, from: 'x', by: 7, stamp: 9, state: {} },
      { wmkit: 1, from: 'x', by: 'x', stamp: Number.NaN, state: {} },
      { wmkit: 1, from: 'x', by: 'x', stamp: '9', state: {} },
      { wmkit: 1, from: 'x', by: 'x', stamp: 9, state: { windows: 'no' } },
      { wmkit: 1, from: 'x', by: 'x', stamp: 9 },
    ]) {
      stranger.postMessage(junk)
    }
    net.drain()
    expect(picture(wm)).toBe(before)
    expect(onError).not.toHaveBeenCalled()

    const throwing = { ...wm.serialize() }
    Object.defineProperty(throwing, 'windows', {
      get() {
        throw new Error('poisoned')
      },
      enumerable: true,
    })
    for (const listener of [...(net as unknown as { queue: unknown[] }).queue]) void listener
    const direct = { data: { wmkit: 1, from: 'x', by: 'x', stamp: 99, state: throwing } }
    const listeners: Listener[] = []
    const tapped: SyncChannel = {
      postMessage() {},
      addEventListener: (_type, listener) => void listeners.push(listener),
      removeEventListener() {},
    }
    const other = makeWm()
    sync(other, { channel: tapped, onError })
    vi.advanceTimersByTime(300)
    for (const listener of listeners) listener(direct)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(Object.keys(other.getState().windows)).toEqual([])
  })

  it('does not hear its own messages when the channel plays them back', () => {
    const listeners: Listener[] = []
    const echo: SyncChannel = {
      postMessage: (data) => {
        for (const listener of listeners) listener({ data: structuredClone(data) })
      },
      addEventListener: (_type, listener) => void listeners.push(listener),
      removeEventListener() {},
    }
    const wm = makeWm()
    sync(wm, { channel: echo })
    vi.advanceTimersByTime(300)
    wm.open({ id: 'a' })
    expect(wm.canUndo()).toBe(true)
  })

  it('reports a channel that refuses a message and goes on', () => {
    const onError = vi.fn()
    const wm = makeWm()
    const broken: SyncChannel = {
      postMessage() {
        throw new Error('closed')
      },
      addEventListener() {},
      removeEventListener() {},
    }
    sync(wm, { channel: broken, onError })
    vi.advanceTimersByTime(300)
    wm.open({ id: 'a' })
    expect(onError).toHaveBeenCalledTimes(2)
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    sync(makeWm(), { channel: broken })
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('stops in both directions when it is destroyed and closes only a channel it opened', async () => {
    const net = hub()
    const [first, second] = [makeWm(), makeWm()]
    const given = net.channel()
    const link = sync(first, { channel: given })
    alone(second, net)
    vi.advanceTimersByTime(300)
    net.sent.length = 0
    link.destroy()
    link.destroy()
    expect(given.closed).toBe(false)
    first.open({ id: 'a' })
    second.open({ id: 'b' })
    net.drain()
    expect(kinds(net.sent)).toEqual(['state'])
    expect(first.get('b')).toBeUndefined()
    await expect(link.ready).resolves.toBe(false)

    const pending = sync(makeWm(), { channel: net.channel() })
    pending.destroy()
    await expect(pending.ready).resolves.toBe(false)
  })

  it('opens a BroadcastChannel of the name it is given and closes it at the end', () => {
    const made: Array<{ name: string; closed: boolean; posted: unknown[] }> = []
    class Fake {
      readonly record: { name: string; closed: boolean; posted: unknown[] }
      constructor(name: string) {
        this.record = { name, closed: false, posted: [] }
        made.push(this.record)
      }
      postMessage(data: unknown) {
        this.record.posted.push(data)
      }
      addEventListener() {}
      removeEventListener() {}
      close() {
        this.record.closed = true
      }
    }
    vi.stubGlobal('BroadcastChannel', Fake)
    vi.stubGlobal('document', {})
    const named = sync(makeWm(), { channel: 'desk' })
    const plain = sync(makeWm())
    expect(made.map((record) => record.name)).toEqual(['desk', 'wmkit'])
    expect(made[0]?.posted).toHaveLength(1)
    named.destroy()
    plain.destroy()
    expect(made.map((record) => record.closed)).toEqual([true, true])
  })

  it('falls back to storage events where there is no BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    vi.stubGlobal('document', {})
    const data = new Map<string, string>()
    const heard: Array<(event: { key: string | null; newValue: string | null }) => void> = []
    vi.stubGlobal('localStorage', {
      setItem: (key: string, value: string) => void data.set(key, value),
    })
    vi.stubGlobal('addEventListener', (type: string, listener: never) => {
      if (type === 'storage') heard.push(listener)
    })
    const removed = vi.fn()
    vi.stubGlobal('removeEventListener', removed)

    const wm = makeWm()
    const link = sync(wm, { channel: 'desk' })
    vi.advanceTimersByTime(300)
    expect(JSON.parse(data.get('wmkit-sync:desk') as string)[0]).toMatchObject({ ask: true })
    const donor = makeWm()
    donor.open({ id: 'far', title: 'From another tab' })
    const message = { wmkit: 1, from: 'other', by: 'other', stamp: 5, state: donor.serialize() }
    const fire = (key: string | null, newValue: string | null) => {
      for (const listener of heard) listener({ key, newValue })
    }
    fire('something-else', JSON.stringify([message, 0.1]))
    fire('wmkit-sync:desk', null)
    fire('wmkit-sync:desk', 'not json')
    expect(wm.get('far')).toBeUndefined()
    fire('wmkit-sync:desk', JSON.stringify([message, 0.2]))
    expect(wm.get('far')?.title).toBe('From another tab')
    wm.update('far', { title: 'Changed here' })
    const posted = JSON.parse(data.get('wmkit-sync:desk') as string)
    expect(posted[0].state.windows[0].title).toBe('Changed here')
    expect(typeof posted[1]).toBe('number')
    link.destroy()
    expect(removed).toHaveBeenCalledTimes(1)
  })

  it('does nothing where there is neither a channel nor a storage to speak through', async () => {
    const made = vi.fn()
    vi.stubGlobal('BroadcastChannel', made)
    const server = sync(makeWm(), { channel: 'desk' })
    await expect(server.ready).resolves.toBe(false)
    expect(made).not.toHaveBeenCalled()

    vi.stubGlobal('BroadcastChannel', undefined)
    vi.stubGlobal('document', {})
    const wm = makeWm()
    const link = sync(wm)
    await expect(link.ready).resolves.toBe(false)
    wm.open({ id: 'a' })
    link.destroy()

    vi.stubGlobal('addEventListener', () => {})
    vi.stubGlobal('removeEventListener', () => {})
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    await expect(sync(makeWm()).ready).resolves.toBe(false)
    Reflect.deleteProperty(globalThis, 'localStorage')
  })
})

type Step =
  | { do: 'open' | 'close' | 'move' | 'focus' | 'minimize'; peer: number; id: 'a' | 'b' | 'c' }
  | { do: 'deliver'; at: number }
  | { do: 'join' }

const step: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.record({
      do: fc.constantFrom(
        'open' as const,
        'close' as const,
        'move' as const,
        'focus' as const,
        'minimize' as const,
      ),
      peer: fc.nat({ max: 3 }),
      id: fc.constantFrom('a' as const, 'b' as const, 'c' as const),
    }),
  },
  {
    weight: 10,
    arbitrary: fc.record({ do: fc.constant('deliver' as const), at: fc.nat({ max: 8 }) }),
  },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('join' as const) }) },
)

describe('any number of desktops, changes and orders of delivery', () => {
  it(
    'end with one picture on every desktop once every message has arrived',
    () => {
      fc.assert(
        fc.property(fc.array(step, { minLength: 1, maxLength: 80, size: 'max' }), (steps) => {
          const net = hub()
          const peers: WindowManager[] = []
          let moves = 0
          const join = () => {
            if (peers.length >= 4) return
            const wm = makeWm()
            peers.push(wm)
            sync(wm, { channel: net.channel(), wait: 50 })
          }
          join()
          join()
          vi.advanceTimersByTime(50)
          for (const next of steps) {
            if (next.do === 'join') join()
            else if (next.do === 'deliver') net.deliver(next.at % Math.max(1, net.queue.length))
            else {
              const wm = peers[next.peer % peers.length] as WindowManager
              if (next.do === 'open') {
                if (!wm.get(next.id)) wm.open({ id: next.id, title: next.id })
              } else if (next.do === 'move') {
                moves += 1
                wm.move(next.id, 10 * moves, 5 * moves)
              } else wm[next.do](next.id)
            }
            for (const wm of peers) {
              const drift = stateDrift(wm)
              if (drift.length > 0) throw new Error(drift.join('\n'))
            }
          }
          vi.advanceTimersByTime(50)
          net.drain()
          const pictures = new Set(peers.map(picture))
          if (pictures.size !== 1) {
            throw new Error(
              `${pictures.size} different desktops are left: ${[...pictures].join('\n')}`,
            )
          }
        }),
        fuzz(300),
      )
    },
    patience(120_000),
  )
})
