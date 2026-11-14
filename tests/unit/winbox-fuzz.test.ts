// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, describe, it, vi } from 'vitest'
import type { WindowManager } from '../../src/core/types'
import { WinBox, type WinBoxOptions } from '../../src/plugins/winbox'
import { domDrift, stateDrift } from './support/dom-state'
import { breathe, fuzz, junkNumber, patience } from './support/fuzz'
import { type Resources, trackResources } from './support/resources'

type Length = number | string | undefined

interface Tracked {
  box: WinBox
  veto: boolean
  closes: number
  focuses: number
  blurs: number
}

interface Room {
  root: HTMLElement | null
  wm: WindowManager | null
  made: Tracked[]
  extras: HTMLElement[]
  resources: Resources
}

type Action =
  | { do: 'create'; options: WinBoxOptions; veto: boolean }
  | { do: 'clone'; slot: number }
  | { do: 'move' | 'resize'; slot: number; first: Length; second: Length }
  | { do: 'set'; slot: number; field: (typeof FIELDS)[number]; value: number }
  | { do: (typeof TOGGLES)[number]; slot: number; state: boolean | undefined }
  | { do: 'close'; slot: number; force: boolean | undefined }
  | { do: 'restore' | 'click-min' | 'click-max' | 'click-close' | 'strip'; slot: number }
  | { do: 'title'; slot: number; title: string }
  | { do: 'class'; slot: number; how: 'add' | 'remove' | 'toggle'; name: string }
  | { do: 'veto'; slot: number; veto: boolean }
  | { do: 'mount'; slot: number }
  | { do: 'unmount'; slot: number }
  | { do: 'undo' }
  | { do: 'redo' }
  | { do: 'cycle' }

const FIELDS = [
  'x',
  'y',
  'width',
  'height',
  'minwidth',
  'minheight',
  'maxwidth',
  'maxheight',
] as const
const TOGGLES = ['focus', 'blur', 'hide', 'show', 'minimize', 'maximize', 'fullscreen'] as const
const CLASSES = [
  'no-move',
  'no-resize',
  'no-close',
  'no-min',
  'no-max',
  'no-full',
  'modern',
  'x',
] as const

function live(room: Room): Tracked[] {
  return room.made.filter((entry) => WinBox.stack().includes(entry.box))
}

function pick(room: Room, slot: number): Tracked | undefined {
  return room.made[slot % Math.max(room.made.length, 1)]
}

function create(room: Room, options: WinBoxOptions, veto: boolean): void {
  const entry: Tracked = { box: null as unknown as WinBox, veto, closes: 0, focuses: 0, blurs: 0 }
  const box = new WinBox({
    ...options,
    root: room.root ?? undefined,
    onclose: () => {
      entry.closes += 1
      return entry.veto
    },
    onfocus: () => {
      entry.focuses += 1
    },
    onblur: () => {
      entry.blurs += 1
    },
  })
  entry.box = box
  room.made.push(entry)
}

function act(room: Room, action: Action): void {
  if (action.do === 'create') {
    create(room, action.options, action.veto)
    return
  }
  if (action.do === 'undo' || action.do === 'redo') {
    room.wm?.[action.do]()
    return
  }
  if (action.do === 'cycle') {
    room.wm?.cycleFocus(1)
    return
  }
  const entry = pick(room, action.slot)
  if (!entry) return
  const { box } = entry
  switch (action.do) {
    case 'clone': {
      const open = WinBox.stack().includes(box)
      let refused = false
      try {
        new WinBox({ id: box.id, root: room.root ?? undefined })
      } catch {
        refused = true
      }
      if (open && !refused) throw new Error(`a second box took the id ${box.id}`)
      if (!refused) {
        const twin = WinBox.stack().find((other) => other.id === box.id && other !== box)
        twin?.close(true)
      }
      return
    }
    case 'move':
      box.move(action.first, action.second)
      return
    case 'resize':
      box.resize(action.first, action.second)
      return
    case 'set':
      box[action.field] = action.value
      return
    case 'close': {
      const open = WinBox.stack().includes(box)
      const before = entry.closes
      const answer = box.close(action.force)
      if (!open) return
      const vetoed = !action.force && entry.veto
      if (!action.force && entry.closes !== before + 1)
        throw new Error('close() never asked onclose')
      if ((answer === true) !== vetoed)
        throw new Error(`close() answered ${answer}, veto ${vetoed}`)
      if (WinBox.stack().includes(box) !== vetoed) {
        throw new Error(`a ${vetoed ? 'vetoed' : 'permitted'} close left the box the wrong way`)
      }
      return
    }
    case 'restore':
      box.restore()
      return
    case 'click-min':
    case 'click-max':
    case 'click-close':
      box.window.querySelector<HTMLElement>(`.wb-${action.do.slice(6)}`)?.click()
      return
    case 'strip':
      document.querySelectorAll<HTMLElement>('.wb-strip button')[action.slot % 8]?.click()
      return
    case 'title':
      box.setTitle(action.title)
      return
    case 'class':
      if (action.how === 'add') box.addClass(action.name)
      else if (action.how === 'remove') box.removeClass(action.name)
      else box.toggleClass(action.name)
      return
    case 'veto':
      entry.veto = action.veto
      return
    case 'mount': {
      const node = document.createElement('article')
      document.body.append(node)
      room.extras.push(node)
      box.mount(node)
      return
    }
    case 'unmount':
      box.unmount()
      return
    default: {
      const toggle = action as Extract<Action, { state: boolean | undefined }>
      box[toggle.do](toggle.state)
    }
  }
}

function drift(room: Room): string[] {
  const found: string[] = []
  const stack = WinBox.stack()
  if (new Set(stack).size !== stack.length) found.push('the stack lists a box twice')
  for (const entry of room.made) {
    const { box } = entry
    const open = stack.includes(box)
    const win = room.wm?.get(box.id)
    if (!open) {
      if (box.window.isConnected) found.push(`${box.id}: closed but still on the page`)
      continue
    }
    if (!box.window.isConnected) found.push(`${box.id}: open but off the page`)
    if (document.getElementById(box.id) !== box.window)
      found.push(`${box.id}: its id finds another node`)
    const marks = box.window.classList
    if (marks.contains('min') !== box.min) found.push(`${box.id}: min class is ${!box.min}`)
    if (marks.contains('max') !== box.max) found.push(`${box.id}: max class is ${!box.max}`)
    if (marks.contains('focus') !== box.focused)
      found.push(`${box.id}: focus class is ${!box.focused}`)
    if (marks.contains('hide') !== box.hidden) found.push(`${box.id}: hide class is ${!box.hidden}`)
    if (box.hidden && box.focused) found.push(`${box.id}: hidden and focused at once`)
    if (entry.focuses - entry.blurs !== (box.focused ? 1 : 0)) {
      found.push(
        `${box.id}: ${entry.focuses} onfocus and ${entry.blurs} onblur, focused ${box.focused}`,
      )
    }
    for (const value of [box.x, box.y, box.width, box.height, box.minwidth, box.minheight]) {
      if (!Number.isFinite(value)) found.push(`${box.id}: reports the number ${value}`)
    }
    if (!room.wm) continue
    if (!win) {
      found.push(`${box.id}: open but unknown to the manager`)
      continue
    }
    const { x, y, width, height } = win.bounds
    if (box.x !== x || box.y !== y || box.width !== width || box.height !== height) {
      found.push(`${box.id}: reports other bounds than the manager holds`)
    }
  }
  if (room.wm) {
    const known = Object.keys(room.wm.getState().windows).length
    if (known !== stack.length)
      found.push(`the manager holds ${known} windows, the stack ${stack.length}`)
    const layer = room.root?.querySelector<HTMLElement>('[data-winbox-root]')
    if (layer) found.push(...stateDrift(room.wm), ...domDrift(room.wm, layer))
  }
  return found
}

const slot = fc.nat({ max: 5 })
const drawable = junkNumber.filter((value) => !(Math.abs(value) >= 1e21))
const length: fc.Arbitrary<Length> = fc.oneof(
  fc.constant(undefined),
  fc.integer({ min: -400, max: 2000 }),
  drawable,
  fc.constantFrom(
    'center',
    'right',
    'bottom',
    'left',
    'top',
    '50%',
    '120%',
    '-10%',
    '200px',
    '',
    'x',
  ),
)
const options: fc.Arbitrary<WinBoxOptions> = fc.record(
  {
    title: fc.string(),
    x: length,
    y: length,
    width: length,
    height: length,
    minwidth: length,
    minheight: length,
    maxwidth: length,
    maxheight: length,
    modal: fc.boolean(),
    max: fc.boolean(),
    min: fc.boolean(),
    hidden: fc.boolean(),
    class: fc.subarray([...CLASSES]),
    html: fc.constantFrom('', '<p>text</p>', '<input><button>go</button>'),
    background: fc.constantFrom('#123', 'red', ''),
  },
  { requiredKeys: [] },
) as fc.Arbitrary<WinBoxOptions>

const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc.record({ do: fc.constant('create' as const), options, veto: fc.boolean() }),
  },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('clone' as const), slot }) },
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constantFrom('move' as const, 'resize' as const),
      slot,
      first: length,
      second: length,
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      do: fc.constant('set' as const),
      slot,
      field: fc.constantFrom(...FIELDS),
      value: fc.oneof(fc.integer({ min: -200, max: 2000 }), drawable),
    }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      do: fc.constantFrom(...TOGGLES),
      slot,
      state: fc.constantFrom(undefined, true, false),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      do: fc.constant('close' as const),
      slot,
      force: fc.constantFrom(undefined, true, false),
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      do: fc.constantFrom(
        'restore' as const,
        'click-min' as const,
        'click-max' as const,
        'click-close' as const,
        'strip' as const,
      ),
      slot,
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ do: fc.constant('title' as const), slot, title: fc.string() }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      do: fc.constant('class' as const),
      slot,
      how: fc.constantFrom('add' as const, 'remove' as const, 'toggle' as const),
      name: fc.constantFrom(...CLASSES),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ do: fc.constant('veto' as const), slot, veto: fc.boolean() }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ do: fc.constantFrom('mount' as const, 'unmount' as const), slot }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constantFrom('undo' as const, 'redo' as const, 'cycle' as const),
    }),
  },
)

async function drive(room: Room, actions: Action[]): Promise<void> {
  try {
    for (const next of actions) {
      act(room, next)
      const found = drift(room)
      if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${JSON.stringify(next)}`)
    }
    for (const entry of live(room)) entry.box.close(true)
    if (WinBox.stack().length > 0) throw new Error('a forced close left boxes open')
    if (room.wm) return
    const left = room.resources.leaks()
    if (document.querySelector('[data-winbox-root]')) left.push('the runtime layer')
    if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
  } finally {
    for (const box of WinBox.stack()) box.close(true)
    room.wm?.clearHistory()
    room.resources.restore()
    for (const node of room.extras) node.remove()
    await breathe()
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  for (const box of WinBox.stack()) box.close(true)
  document.body.replaceChildren()
})

describe('WinBox calls in any order with any arguments', () => {
  it(
    'keep every box consistent and take the whole runtime down with the last box',
    async () => {
      new WinBox().close(true)
      await fc.assert(
        fc.asyncProperty(
          fc.array(action, { minLength: 1, maxLength: 60, size: 'max' }),
          (actions) =>
            drive(
              { root: null, wm: null, made: [], extras: [], resources: trackResources() },
              actions,
            ),
        ),
        fuzz(150),
      )
    },
    patience(120_000),
  )

  it(
    'stay in step with the manager through undo, redo and focus cycling',
    async () => {
      const root = document.createElement('main')
      Object.defineProperty(root, 'clientWidth', { value: 1200 })
      Object.defineProperty(root, 'clientHeight', { value: 800 })
      document.body.append(root)
      const wm = WinBox.manager(root)
      await fc.assert(
        fc.asyncProperty(
          fc.array(action, { minLength: 1, maxLength: 60, size: 'max' }),
          (actions) =>
            drive({ root, wm, made: [], extras: [], resources: trackResources() }, actions),
        ),
        fuzz(150),
      )
    },
    patience(120_000),
  )
})
