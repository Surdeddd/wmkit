import fc from 'fast-check'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { type PersistStorage, persist } from '../../src/plugins/persist'
import { fuzz, patience } from './support/fuzz'

type Action =
  | { do: 'change'; id: 'a' | 'b' | 'c' }
  | { do: 'wait'; ms: number }
  | { do: 'save' | 'clear' | 'restore' }
  | { do: 'finish'; at: number; fails: boolean }

interface Pending {
  kind: 'get' | 'set' | 'remove'
  read?: string | null
  finish(fails: boolean): void
}

const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      do: fc.constant('change' as const),
      id: fc.constantFrom('a', 'b', 'c'),
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({ do: fc.constant('wait' as const), ms: fc.constantFrom(1, 20, 60, 400) }),
  },
  {
    weight: 3,
    arbitrary: fc.record({ do: fc.constantFrom('save' as const, 'clear' as const, 'restore') }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      do: fc.constant('finish' as const),
      at: fc.nat({ max: 3 }),
      fails: fc.boolean(),
    }),
  },
)

async function settle(): Promise<void> {
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
}

async function run(actions: Action[]): Promise<void> {
  const data = new Map<string, string>()
  const pending: Pending[] = []
  const found: string[] = []
  const wm = createWindowManager({ viewport: { width: 1000, height: 800 } })
  let renames = 0
  let byHand = false
  let handQueued = false

  const later = <T>(kind: Pending['kind'], act: () => T, read?: string | null): Promise<T> => {
    const writes = pending.filter((op) => op.kind !== 'get').length
    const reads = pending.length - writes
    if (kind !== 'get' && writes > 0) found.push(`${kind} was sent while a write was in flight`)
    if (kind !== 'get' && reads > 0 && !byHand && !handQueued) {
      found.push(`${kind} was sent on its own while a read was in flight`)
    }
    if (kind !== 'get') handQueued = false
    return new Promise<T>((resolve, reject) => {
      pending.push({
        kind,
        read,
        finish: (fails) => (fails ? reject(new Error(`${kind} failed`)) : resolve(act())),
      })
    })
  }
  const storage: PersistStorage = {
    getItem: (key) => {
      const value = data.get(key) ?? null
      return later('get', () => value, value)
    },
    setItem: (key, value) => later('set', () => void data.set(key, value)),
    removeItem: (key) => later('remove', () => void data.delete(key)),
  }
  const store = persist(wm, { storage, debounce: 50, maxWait: 200, onError: () => {} })
  const readies = new Set<Promise<boolean>>([store.ready])
  const watch = () => {
    readies.add(store.ready)
  }

  async function finish(at: number, fails: boolean): Promise<void> {
    const op = pending.splice(at % Math.max(1, pending.length), 1)[0]
    if (!op) return
    op.finish(fails)
    await settle()
    if (op.kind === 'get' && !fails && typeof op.read === 'string') {
      const now = JSON.stringify(wm.serialize())
      if (now !== JSON.stringify(JSON.parse(op.read).state)) {
        found.push('a read that succeeded did not put the stored desktop back')
      }
    }
  }

  for (const next of actions) {
    switch (next.do) {
      case 'change':
        if (wm.get(next.id)) {
          renames += 1
          wm.update(next.id, { title: `${next.id}${renames}` })
        } else wm.open({ id: next.id, title: next.id })
        break
      case 'wait':
        vi.advanceTimersByTime(next.ms)
        break
      case 'finish':
        await finish(next.at, next.fails)
        break
      default:
        byHand = next.do !== 'restore'
        if (byHand && pending.some((op) => op.kind !== 'get')) handQueued = true
        store[next.do]()
        byHand = false
        watch()
    }
    await settle()
    if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${JSON.stringify(next)}`)
  }

  for (let round = 0; round < 50 && pending.length > 0; round += 1) await finish(0, false)
  renames += 1
  if (wm.get('a')) wm.update('a', { title: `last${renames}` })
  else wm.open({ id: 'a', title: 'last' })
  for (let round = 0; round < 50; round += 1) {
    vi.advanceTimersByTime(500)
    await settle()
    if (pending.length === 0) break
    await finish(0, false)
  }
  if (pending.length > 0) throw new Error('the storage never came to rest')
  const stored = data.get('wmkit')
  if (stored === undefined) throw new Error('the last change was never written')
  if (JSON.stringify(JSON.parse(stored).state) !== JSON.stringify(wm.serialize())) {
    throw new Error('what is stored at rest is not the desktop as it is')
  }
  const answers = await Promise.race([
    Promise.all(readies),
    settle().then(() => 'a ready promise never settled' as const),
  ])
  if (typeof answers === 'string') throw new Error(answers)
  store.destroy()
  if (found.length > 0) throw new Error(found.join('\n'))
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('persist over a storage that answers late, out of order and sometimes not at all', () => {
  it(
    'never sends two writes at once, restores what a read brings, and ends with the desktop stored',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(action, { minLength: 1, maxLength: 60, size: 'max' }), run),
        fuzz(200),
      )
    },
    patience(120_000),
  )
})
