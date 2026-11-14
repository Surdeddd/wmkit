import fc from 'fast-check'
import { describe, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { ManagerEvents, WindowManager } from '../../src/core/types'
import { stateDrift } from './support/dom-state'
import { fuzz, junkNumber, junkString, junkValue, patience } from './support/fuzz'

const VIEWPORT = { width: 1280, height: 800 }
const IDS = ['a', 'b', 'c', '__proto__', 'constructor', '42', ''] as const

const METHODS = [
  'open',
  'close',
  'closeAll',
  'focus',
  'blur',
  'cycleFocus',
  'minimize',
  'maximize',
  'toggleMaximize',
  'restore',
  'restoreTo',
  'snap',
  'snapTo',
  'move',
  'moveBy',
  'center',
  'sendToBack',
  'resize',
  'update',
  'get',
  'getState',
  'minimized',
  'setViewport',
  'workspace',
  'setWorkspace',
  'moveToWorkspace',
  'group',
  'ungroup',
  'activateTab',
  'moveTab',
  'cycleTab',
  'groupMembers',
  'batch',
  'setExtension',
  'serialize',
  'hydrate',
  'undo',
  'redo',
  'canUndo',
  'canRedo',
  'beginInteraction',
  'endInteraction',
  'abortInteraction',
  'clearHistory',
  'saveLayout',
  'loadLayout',
  'getLayout',
  'setLayout',
  'deleteLayout',
  'layoutNames',
  'arrange',
  'minimizeAll',
  'restoreAll',
  'subscribe',
  'on',
] as const

const EVENTS = [
  'open',
  'close',
  'focus',
  'move',
  'resize',
  'stage',
  'update',
  'order',
  'workspace',
  'group',
  'change',
] as const

const REACTIONS = [
  'focus',
  'blur',
  'minimize',
  'maximize',
  'restore',
  'close',
  'open',
  'move',
  'resize',
  'undo',
  'redo',
  'group',
  'ungroup',
  'workspace',
  'closeAll',
  'rename',
] as const

interface Call {
  method: (typeof METHODS)[number]
  args: unknown[]
}

interface Reaction {
  on: (typeof EVENTS)[number]
  act: (typeof REACTIONS)[number]
  id: string
  times: number
}

const EXPECTED =
  /already exists|is not a function|is not iterable|Cannot (read|convert|destructure)/

function pristine(): string {
  return Object.getOwnPropertyNames(Object.prototype).sort().join()
}

function sound(wm: WindowManager): string[] {
  const found = stateDrift(wm)
  let saved: unknown
  try {
    saved = JSON.parse(JSON.stringify(wm.serialize()))
  } catch {
    return found
  }
  const copy = createWindowManager({ viewport: VIEWPORT })
  try {
    copy.hydrate(saved as never)
    found.push(...stateDrift(copy).map((line) => `after a reload: ${line}`))
  } catch (error) {
    found.push(`a saved state did not load: ${(error as Error).message}`)
  }
  return found
}

function react(wm: WindowManager, reaction: Reaction): void {
  const { id } = reaction
  switch (reaction.act) {
    case 'open':
      if (!wm.get(id)) wm.open({ id })
      return
    case 'move':
      wm.move(id, 40, 60)
      return
    case 'resize':
      wm.resize(id, { width: 420 })
      return
    case 'group':
      wm.group([id, 'a'])
      return
    case 'workspace':
      wm.setWorkspace(wm.workspace() === 0 ? 1 : 0)
      return
    case 'rename':
      wm.update(id, { title: `${wm.get(id)?.title ?? ''}!`.slice(0, 12) })
      return
    case 'blur':
    case 'undo':
    case 'redo':
    case 'closeAll':
      wm[reaction.act]()
      return
    default:
      wm[reaction.act](id)
  }
}

const anyId = fc.oneof(fc.constantFrom(...IDS), junkString)
const argument = fc.oneof(
  { weight: 4, arbitrary: anyId },
  { weight: 3, arbitrary: junkNumber },
  { weight: 2, arbitrary: fc.integer({ min: -500, max: 2000 }) },
  {
    weight: 3,
    arbitrary: fc.record(
      {
        id: anyId,
        x: junkNumber,
        y: junkNumber,
        width: junkNumber,
        height: junkNumber,
        title: junkValue,
        layer: junkValue,
        stage: junkValue,
        minSize: junkValue,
        maxSize: junkValue,
        aspectRatio: junkNumber,
        meta: junkValue,
        workspace: junkNumber,
      },
      { requiredKeys: [] },
    ),
  },
  { weight: 1, arbitrary: fc.array(anyId, { maxLength: 4 }) },
  { weight: 3, arbitrary: junkValue },
)

const call: fc.Arbitrary<Call> = fc.record({
  method: fc.constantFrom(...METHODS),
  args: fc.array(argument, { maxLength: 3 }),
})

const reaction: fc.Arbitrary<Reaction> = fc.record({
  on: fc.constantFrom(...EVENTS),
  act: fc.constantFrom(...REACTIONS),
  id: fc.constantFrom('a', 'b', 'c'),
  times: fc.integer({ min: 1, max: 3 }),
})

describe('a manager called with anything at all', () => {
  it(
    'never breaks its state, its saved form or the prototypes around it',
    () => {
      const before = pristine()
      fc.assert(
        fc.property(fc.array(call, { minLength: 1, maxLength: 80, size: 'max' }), (calls) => {
          const wm = createWindowManager({ viewport: VIEWPORT })
          wm.open({ id: 'a', x: 20, y: 20, width: 300, height: 200 })
          wm.open({ id: 'b', x: 400, y: 80, width: 300, height: 200 })
          for (const { method, args } of calls) {
            try {
              ;(wm[method] as (...given: unknown[]) => unknown)(...args)
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              if (!EXPECTED.test(message)) {
                throw new Error(`${method}(${JSON.stringify(args)}) threw: ${message}`)
              }
            }
            const found = sound(wm)
            if (pristine() !== before) found.push('Object.prototype gained a property')
            if (found.length > 0) {
              throw new Error(`${found.join('\n')}\nafter: ${method}(${fc.stringify(args)})`)
            }
          }
        }),
        fuzz(300),
      )
    },
    patience(120_000),
  )
})

describe('listeners that call the manager back', () => {
  it(
    'leave the events, the subscribers and the state telling the same story',
    () => {
      fc.assert(
        fc.property(
          fc.array(reaction, { maxLength: 6 }),
          fc.array(reaction, { minLength: 1, maxLength: 40, size: 'max' }),
          (reactions, steps) => {
            const wm = createWindowManager({ viewport: VIEWPORT })
            const live = new Set<string>()
            let seen = wm.getState()
            let budget = 0
            wm.on('open', ({ window: win }) => void live.add(win.id))
            wm.on('close', ({ window: win }) => void live.delete(win.id))
            wm.subscribe((state) => {
              seen = state
            })
            for (const planned of reactions) {
              let left = planned.times
              wm.on(planned.on as keyof ManagerEvents, () => {
                if (left <= 0 || budget <= 0) return
                left -= 1
                budget -= 1
                react(wm, planned)
              })
            }
            wm.open({ id: 'a', x: 20, y: 20, width: 300, height: 200 })
            wm.open({ id: 'b', x: 400, y: 80, width: 300, height: 200 })
            for (const step of steps) {
              budget = 4
              try {
                react(wm, step)
              } catch (error) {
                throw new Error(`${step.act}(${step.id}) threw: ${(error as Error).message}`)
              }
              const found = sound(wm)
              const ids = Object.keys(wm.getState().windows).sort().join()
              if ([...live].sort().join() !== ids) {
                found.push(
                  `open and close events left [${[...live].sort()}], the state holds [${ids}]`,
                )
              }
              if (seen !== wm.getState())
                found.push('subscribers saw an older state than getState()')
              if (found.length > 0) {
                throw new Error(`${found.join('\n')}\nafter: ${step.act}(${step.id})`)
              }
            }
          },
        ),
        fuzz(300),
      )
    },
    patience(120_000),
  )
})
