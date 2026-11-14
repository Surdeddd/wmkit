// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, describe, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { SerializedState, WindowManager } from '../../src/core/types'
import { type PersistController, type PersistStorage, persist } from '../../src/plugins/persist'
import { fuzz, junkString, patience } from './support/fuzz'
import { trackResources } from './support/resources'

const KEY = 'layout'
const VIEWPORT = { width: 1280, height: 800 }
const LONGEST = 2 ** 31 - 1

type Migration = 'none' | 'identity' | 'drop' | 'throw'

class Memory implements PersistStorage {
  readonly data = new Map<string, string>()
  broken = false

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.broken) throw new Error('the storage is full')
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    if (this.broken) throw new Error('the storage is locked')
    this.data.delete(key)
  }
}

interface Setup {
  debounce: number
  maxWait: number | undefined
  listens: boolean
}

interface Model {
  stored: string | null
  ours: boolean
  dirty: boolean
  idle: number
  waiting: number
  version: number
  migration: Migration
  errors: number
  reports: number
  streaks: Set<string>
}

interface Real {
  setup: Setup
  storage: Memory
  wm: WindowManager
  store: PersistController
  changes: number
  errors: string[]
  reports: number
  stop(): void
}

type Step = fc.Command<Model, Real>

function longest(setup: Setup): number {
  const wait = setup.maxWait
  const usable = typeof wait === 'number' && wait >= 0
  return Math.min(usable ? wait : Math.max(2000, setup.debounce), LONGEST)
}

function connect(real: Real, version: number, migration: Migration): void {
  const wm = createWindowManager({ viewport: VIEWPORT })
  const migrate = {
    none: undefined,
    identity: (state: unknown) => state as SerializedState,
    drop: () => null,
    throw: () => {
      throw new Error('the migration failed')
    },
  }[migration]
  real.wm = wm
  real.stop = wm.subscribe(() => {
    real.changes += 1
  })
  real.store = persist(wm, {
    key: KEY,
    storage: real.storage,
    debounce: real.setup.debounce,
    maxWait: real.setup.maxWait,
    version,
    migrate,
    onError: real.setup.listens ? (_error, phase) => real.errors.push(phase) : undefined,
  })
}

function picture(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? `${item}n` : item))
}

function envelope(real: Real, version: number): string | null {
  try {
    return JSON.stringify({ version, state: real.wm.serialize() })
  } catch {
    return null
  }
}

function complain(model: Model, real: Real, phase: string): void {
  if (real.setup.listens) model.errors += 1
  else if (!model.streaks.has(phase)) {
    model.streaks.add(phase)
    model.reports += 1
  }
}

function written(model: Model, real: Real): void {
  const next = real.storage.broken ? null : envelope(real, model.version)
  if (next === null) {
    complain(model, real, 'save')
    return
  }
  model.stored = next
  model.ours = true
  model.streaks.delete('save')
}

function trust(model: Model, real: Real): void {
  model.errors = real.errors.length
  model.reports = real.reports
  model.stored = real.storage.getItem(KEY)
}

function reloaded(model: Model, real: Real, state: string, restored: boolean | null): void {
  if (!model.ours) {
    trust(model, real)
    return
  }
  const saved = model.stored === null ? null : JSON.parse(model.stored)
  const stale = saved !== null && saved.version !== model.version
  const kept = saved !== null && (!stale || model.migration === 'identity')
  if (stale && model.migration === 'throw') complain(model, real, 'migrate')
  if (restored !== null && restored !== kept) {
    throw new Error(`restore() answered ${restored} over a stored ${model.stored}`)
  }
  const now = picture(real.wm.serialize())
  const expected = kept ? picture(saved.state) : state
  if (now !== expected) {
    throw new Error(`a restore left the manager with\n  ${now}\n  expected\n  ${expected}`)
  }
  if (!kept || !stale) return
  model.streaks.delete('migrate')
  written(model, real)
}

function flushed(model: Model, real: Real): void {
  if (!model.dirty) return
  model.dirty = false
  model.idle = 0
  model.waiting = 0
  written(model, real)
}

function sane(wm: WindowManager): string[] {
  const found: string[] = []
  const state = wm.getState()
  const ids = Object.keys(state.windows)
  if ([...state.order].sort().join('\n') !== [...ids].sort().join('\n')) {
    found.push('the order lists other windows than the state holds')
  }
  if (state.focusedId !== null && !state.windows[state.focusedId]) {
    found.push(`focus points at ${state.focusedId}, which is gone`)
  }
  for (const id of ids) {
    const win = state.windows[id]
    const numbers = win ? [win.bounds.x, win.bounds.y, win.bounds.width, win.bounds.height] : []
    if (!numbers.every(Number.isFinite)) found.push(`${JSON.stringify(id)} has broken bounds`)
  }
  return found
}

function compare(model: Model, real: Real): void {
  const found = sane(real.wm)
  const stored = real.storage.getItem(KEY)
  if (stored !== model.stored) {
    found.push(`the storage holds ${stored}\n  but the last save should have left ${model.stored}`)
  }
  if (real.errors.length !== model.errors) {
    found.push(`onError ran ${real.errors.length} times [${real.errors}], expected ${model.errors}`)
  }
  if (real.reports !== model.reports) {
    found.push(`reportError ran ${real.reports} times, expected ${model.reports}`)
  }
  if (found.length > 0) throw new Error(found.join('\n'))
}

function step(name: string, run: (model: Model, real: Real) => void): Step {
  return {
    check: () => true,
    run(model, real) {
      run(model, real)
      compare(model, real)
    },
    toString: () => name,
  }
}

function touched(model: Model, real: Real, before: number): void {
  if (real.changes === before) return
  if (!model.dirty) model.waiting = 0
  model.dirty = true
  model.idle = 0
}

function elapse(model: Model, real: Real, ms: number): void {
  vi.advanceTimersByTime(ms)
  if (!model.dirty) return
  model.idle += ms
  model.waiting += ms
  if (model.idle >= real.setup.debounce || model.waiting >= longest(real.setup)) {
    flushed(model, real)
  }
}

const change = (name: string, act: (wm: WindowManager, target: string | undefined) => void) =>
  fc.nat({ max: 7 }).map((slot) =>
    step(`${name} #${slot}`, (model, real) => {
      const before = real.changes
      const order = real.wm.getState().order
      act(real.wm, order.length > 0 ? order[slot % order.length] : undefined)
      touched(model, real, before)
    }),
  )

const opening = fc
  .record({
    id: fc.option(junkString, { nil: undefined }),
    title: fc.string(),
    x: fc.integer({ min: -200, max: 1400 }),
    y: fc.integer({ min: -200, max: 900 }),
    width: fc.integer({ min: 0, max: 1500 }),
    height: fc.integer({ min: 0, max: 1000 }),
    meta: fc.dictionary(junkString, fc.jsonValue(), { maxKeys: 3 }),
  })
  .map((init) =>
    step(`open(${JSON.stringify(init)})`, (model, real) => {
      const before = real.changes
      if (init.id === undefined || !real.wm.get(init.id)) real.wm.open(init)
      touched(model, real, before)
    }),
  )

const unsavable = change('give a window a value JSON cannot hold', (wm, id) => {
  if (id !== undefined) wm.update(id, { meta: { big: 1n } })
})

const steps = [
  opening,
  opening,
  change('close', (wm, id) => {
    if (id !== undefined) wm.close(id)
  }),
  fc
    .tuple(fc.integer({ min: -300, max: 1500 }), fc.integer({ min: -300, max: 900 }))
    .chain(([x, y]) =>
      change(`move to ${x},${y}`, (wm, id) => {
        if (id !== undefined) wm.move(id, x, y)
      }),
    ),
  fc.constantFrom('minimize', 'maximize', 'restore', 'focus').chain((action) =>
    change(action, (wm, id) => {
      if (id !== undefined) wm[action](id)
    }),
  ),
  fc.dictionary(junkString, fc.jsonValue(), { maxKeys: 3 }).chain((meta) =>
    change(`set meta ${JSON.stringify(meta)}`, (wm, id) => {
      if (id !== undefined) wm.update(id, { meta })
    }),
  ),
  fc.string().chain((title) =>
    change(`rename to ${JSON.stringify(title)}`, (wm, id) => {
      if (id !== undefined) wm.update(id, { title })
    }),
  ),
  fc.constantFrom('undo', 'redo').chain((direction) =>
    change(direction, (wm) => {
      wm[direction]()
    }),
  ),
  unsavable,
  fc.constantFrom(0, 1, 10, 49, 50, 149, 150, 151, 1000, 1999, 2000, 2001, 6000).map((ms) =>
    step(`wait ${ms} ms`, (model, real) => {
      elapse(model, real, ms)
    }),
  ),
  fc
    .tuple(fc.integer({ min: 2, max: 9 }), fc.constantFrom(1, 4, 9, 30, 49, 99, 149, 700, 1900))
    .map(([count, gap]) =>
      step(`${count} changes, ${gap} ms apart`, (model, real) => {
        for (let turn = 0; turn < count; turn += 1) {
          const before = real.changes
          real.wm.open({ title: `burst ${turn}` })
          touched(model, real, before)
          compare(model, real)
          elapse(model, real, gap)
          compare(model, real)
        }
      }),
    ),
  fc.constant(
    step('save now', (model, real) => {
      real.store.save()
      written(model, real)
    }),
  ),
  fc.constant(
    step('clear', (model, real) => {
      real.store.clear()
      model.dirty = false
      if (real.storage.broken) complain(model, real, 'save')
      else {
        model.stored = null
        model.streaks.delete('save')
      }
    }),
  ),
  fc.constant(
    step('the page hides', (model, real) => {
      window.dispatchEvent(new Event('pagehide'))
      flushed(model, real)
    }),
  ),
  fc.boolean().map((broken) =>
    step(broken ? 'the storage breaks' : 'the storage recovers', (_model, real) => {
      real.storage.broken = broken
    }),
  ),
  fc.constant(
    step('restore by hand', (model, real) => {
      const before = picture(real.wm.serialize())
      reloaded(model, real, before, real.store.restore())
    }),
  ),
  fc
    .tuple(fc.boolean(), fc.constantFrom<Migration>('none', 'identity', 'drop', 'throw'))
    .map(([bump, migration]) =>
      step(`reload${bump ? `, a newer version, migrate: ${migration}` : ''}`, (model, real) => {
        real.store.destroy()
        flushed(model, real)
        compare(model, real)
        const idle = real.storage.getItem(KEY)
        real.wm.open({ title: 'after the plugin is gone' })
        vi.advanceTimersByTime(10_000)
        if (real.storage.getItem(KEY) !== idle) {
          throw new Error('a destroyed plugin still wrote to the storage')
        }
        real.stop()
        real.wm.destroy()

        if (bump) model.version += 1
        model.migration = migration
        model.streaks.clear()
        connect(real, model.version, migration)
        const empty = picture(createWindowManager({ viewport: VIEWPORT }).serialize())
        reloaded(model, real, empty, null)
      }),
    ),
  fc
    .oneof(
      fc.constantFrom(
        '',
        'null',
        '[]',
        '{}',
        '{',
        '42',
        '"text"',
        '{"version":"1","state":{}}',
        '{"version":0,"state":null}',
        '{"version":0,"state":[]}',
        '{"version":0,"state":{"windows":"none"}}',
        '{"windows":[{"id":"a"}]}',
        '{"windows":[null,1,"x",{"id":"a","bounds":{"x":"left"}}],"order":["a","ghost"]}',
        '{"version":0,"state":{"version":1,"windows":[{"id":"__proto__","bounds":{}}],"order":{}}}',
      ),
      fc.json(),
      fc.string(),
    )
    .map((raw) =>
      step(`the storage is overwritten with ${JSON.stringify(raw)}`, (model, real) => {
        real.storage.data.set(KEY, raw)
        model.stored = raw
        model.ours = false
      }),
    ),
]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a layout saved through random changes, waits, failures and reloads', () => {
  it(
    'always matches what the last successful save wrote, and never throws',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            debounce: fc.constantFrom(0, 1, 50, 150),
            maxWait: fc.constantFrom(undefined, 0, 10, 100, 5000, -1, Number.NaN, Infinity),
            listens: fc.boolean(),
          }),
          fc.commands(steps, { maxCommands: 60, size: 'max' }),
          (setup, commands) => {
            vi.useFakeTimers()
            const resources = trackResources()
            const real = { setup, storage: new Memory(), changes: 0, errors: [], reports: 0 } as
              | Real
              | (Omit<Real, 'wm' | 'store' | 'stop'> & Partial<Real>)
            vi.stubGlobal('reportError', () => {
              real.reports += 1
            })
            try {
              connect(real as Real, 0, 'identity')
              const model: Model = {
                stored: null,
                ours: true,
                dirty: false,
                idle: 0,
                waiting: 0,
                version: 0,
                migration: 'identity',
                errors: 0,
                reports: 0,
                streaks: new Set(),
              }
              fc.modelRun(() => ({ model, real: real as Real }), commands)
              ;(real as Real).store.destroy()
              ;(real as Real).stop()
              ;(real as Real).wm.destroy()
              const left = [...resources.leaks()]
              if (vi.getTimerCount() > 0) left.push(`${vi.getTimerCount()} timers`)
              if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
            } finally {
              resources.restore()
              vi.clearAllTimers()
              vi.useRealTimers()
            }
          },
        ),
        fuzz(150),
      )
    },
    patience(120_000),
  )
})
