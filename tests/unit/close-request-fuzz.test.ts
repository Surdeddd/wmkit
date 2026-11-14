import fc from 'fast-check'
import { describe, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowState } from '../../src/core/types'
import { stateDrift } from './support/dom-state'
import { breathe, fuzz, patience } from './support/fuzz'

const IDS = ['a', 'b', 'c'] as const
type Id = (typeof IDS)[number]
type Kind = 'yes' | 'nothing' | 'no' | 'throw' | 'late'
type Reply = 'yes' | 'no' | 'fail'

type Action =
  | { do: 'guard'; kind: Kind }
  | { do: 'unguard'; at: number }
  | { do: 'ask' | 'open' | 'close' | 'swap' | 'rename'; id: Id }
  | { do: 'reply'; at: number; with: Reply }
  | { do: 'closeAll' | 'undo' | 'redo' }

interface Request {
  id: Id
  born: number | undefined
  promise: Promise<boolean> | null
  state: 'pending' | 'true' | 'false' | 'rejected'
  refused: boolean
  asked: number[]
}

interface Late {
  request: Request
  open(value: boolean): void
  fail(error: unknown): void
}

const id = fc.constantFrom(...IDS)
const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constant('guard' as const),
      kind: fc.constantFrom<Kind>('yes', 'nothing', 'no', 'throw', 'late', 'late', 'late'),
    }),
  },
  { weight: 2, arbitrary: fc.record({ do: fc.constant('unguard' as const), at: fc.nat(9) }) },
  { weight: 8, arbitrary: fc.record({ do: fc.constant('ask' as const), id }) },
  {
    weight: 8,
    arbitrary: fc.record({
      do: fc.constant('reply' as const),
      at: fc.nat(9),
      with: fc.constantFrom<Reply>('yes', 'yes', 'yes', 'no', 'fail'),
    }),
  },
  { weight: 3, arbitrary: fc.record({ do: fc.constant('open' as const), id }) },
  { weight: 2, arbitrary: fc.record({ do: fc.constant('close' as const), id }) },
  { weight: 2, arbitrary: fc.record({ do: fc.constant('swap' as const), id }) },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('rename' as const), id }) },
  {
    weight: 3,
    arbitrary: fc.record({ do: fc.constantFrom('closeAll' as const, 'undo', 'redo') }),
  },
)

async function run(actions: Action[]): Promise<void> {
  const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  const found: string[] = []
  const live = new Map<string, Request>()
  const every: Request[] = []
  const lates: Late[] = []
  const guards: Array<() => void> = []
  const waits = new Set<string>()
  let renames = 0
  let subscribed = 0

  const born = (name: string) => wm.get(name)?.openedSeq
  const open = (name: Id) => wm.open({ id: name, title: name })

  wm.on('closing', ({ window: win, pending }) => {
    const request = live.get(win.id)
    if (pending) {
      if (request?.state !== 'pending') found.push(`${win.id} waits without a request`)
      if (waits.has(win.id)) found.push(`${win.id} was told twice that it waits`)
      waits.add(win.id)
    } else {
      if (!waits.has(win.id)) found.push(`${win.id} stopped a wait that never began`)
      if (!wm.get(win.id)) found.push(`${win.id} stopped waiting after it was gone`)
      waits.delete(win.id)
    }
  })
  wm.on('close', ({ window: win }) => void waits.delete(win.id))

  function subscribe(kind: Kind): void {
    subscribed += 1
    const order = subscribed
    guards.push(
      wm.onBeforeClose((win: WindowState) => {
        const request = live.get(win.id)
        if (request?.state !== 'pending') {
          found.push(`guard ${order} was asked about ${win.id} outside a request`)
          return
        }
        if (wm.get(win.id) !== win) found.push(`guard ${order} was shown a stale ${win.id}`)
        if (born(win.id) !== request.born) {
          found.push(`guard ${order} was asked about another window that took the id ${win.id}`)
        }
        if (request.asked.some((earlier) => earlier >= order)) {
          found.push(`guard ${order} was asked after ${request.asked.join()} about ${win.id}`)
        }
        request.asked.push(order)
        if (kind === 'yes') return true
        if (kind === 'nothing') return undefined
        if (kind === 'no') {
          request.refused = true
          return false
        }
        if (kind === 'throw') {
          request.refused = true
          throw new Error(`guard ${order}`)
        }
        return new Promise<boolean>((resolve, reject) => {
          lates.push({ request, open: resolve, fail: reject })
        })
      }),
    )
  }

  function ask(name: Id): void {
    const waiting = live.get(name)
    if (waiting?.state === 'pending') {
      if (wm.requestClose(name) !== waiting.promise) {
        found.push(`${name} got a second promise while the first one waits`)
      }
      return
    }
    const request: Request = {
      id: name,
      born: born(name),
      promise: null,
      state: 'pending',
      refused: false,
      asked: [],
    }
    live.set(name, request)
    every.push(request)
    const promise = wm.requestClose(name)
    request.promise = promise
    promise.then(
      (closed) => {
        request.state = closed ? 'true' : 'false'
        const still = request.born !== undefined && born(name) === request.born
        if (closed && request.refused) found.push(`${name} closed against a no`)
        if (closed && still) found.push(`${name} is said to be closed and is still open`)
        if (!closed && request.born !== undefined && !request.refused) {
          found.push(`${name} was kept though nobody refused`)
        }
        if (!closed && request.born !== undefined && !still) {
          found.push(`${name} is said to be kept and is gone`)
        }
      },
      () => {
        request.state = 'rejected'
        if (!request.refused) found.push(`${name} rejected though no guard failed`)
        if (born(name) !== request.born) found.push(`${name} went away with a failed guard`)
      },
    )
  }

  function reply(late: Late, answer: Reply): void {
    if (late.request.state === 'pending' && answer !== 'yes') late.request.refused = true
    if (answer === 'fail') late.fail(new Error('late guard'))
    else late.open(answer === 'yes')
  }

  function check(after: string): void {
    found.push(...stateDrift(wm))
    for (const name of waits) {
      if (live.get(name)?.state !== 'pending') found.push(`${name} is left marked as waiting`)
    }
    if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${after}`)
  }

  open('a')
  open('b')
  for (const next of actions) {
    switch (next.do) {
      case 'guard':
        subscribe(next.kind)
        break
      case 'unguard':
        guards[next.at % Math.max(1, guards.length)]?.()
        break
      case 'ask':
        ask(next.id)
        break
      case 'reply': {
        const late = lates.splice(next.at % Math.max(1, lates.length), 1)[0]
        if (late) reply(late, next.with)
        break
      }
      case 'open':
        if (!wm.get(next.id)) open(next.id)
        break
      case 'close':
        wm.close(next.id)
        break
      case 'swap':
        wm.batch(() => {
          wm.close(next.id)
          open(next.id)
        })
        break
      case 'rename':
        renames += 1
        wm.update(next.id, { title: `${next.id}${renames}` })
        break
      default:
        wm[next.do]()
    }
    await breathe()
    check(JSON.stringify(next))
  }

  for (let rounds = 0; lates.length > 0 && rounds < 100; rounds += 1) {
    for (const late of lates.splice(0)) reply(late, 'yes')
    await breathe()
  }
  check('every late guard said yes')
  const hung = every.filter((request) => request.state === 'pending')
  if (hung.length > 0) {
    throw new Error(`never answered: ${hung.map((request) => request.id).join()}`)
  }
  if (waits.size > 0) throw new Error(`left marked as waiting: ${[...waits].join()}`)
}

describe('guards that answer yes, no, late, never the same way twice', () => {
  it(
    'never close a window against a no, never leave a request unanswered or a window marked',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(action, { minLength: 1, maxLength: 60, size: 'max' }), run),
        fuzz(150),
      )
    },
    patience(120_000),
  )
})
