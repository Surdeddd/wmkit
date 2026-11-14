// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, describe, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowFlags, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import { touchGestures } from '../../src/plugins/gestures'
import { domDrift, gestureResidue, stateDrift } from './support/dom-state'
import { type Frames, stubFrames } from './support/frames'
import { breathe, fuzz, patience } from './support/fuzz'
import { type Resources, trackResources } from './support/resources'

const VIEWPORT = { width: 1024, height: 720 }
const SLOTS = [0, 1, 2, 3] as const
const EDGES = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const
const FLAGS = [
  'draggable',
  'resizable',
  'closable',
  'minimizable',
  'maximizable',
  'snappable',
] as const
const PARTS = ['handle', 'title', 'content', 'field', 'close', 'minimize', 'maximize'] as const
const CALLS = [
  'close',
  'minimize',
  'maximize',
  'restore',
  'focus',
  'ungroup',
  'activateTab',
  'center',
  'sendToBack',
] as const

type Kind = 'mouse' | 'touch' | 'pen'

type Where =
  | { on: (typeof PARTS)[number]; slot: number }
  | { on: 'grip'; slot: number; edge: (typeof EDGES)[number] }
  | { on: 'desktop' }
  | { on: 'outside' }

type Action =
  | { do: 'open'; slot: number; x: number; y: number; width: number; height: number }
  | { do: 'down'; pointer: number; kind: Kind; where: Where; x: number; y: number; button: number }
  | { do: 'move' | 'up'; pointer: number; x: number; y: number }
  | { do: 'cancel' | 'lost'; pointer: number }
  | { do: 'key'; key: string; mods: number; where: Where }
  | { do: 'click' | 'dblclick' | 'contextmenu'; where: Where }
  | { do: 'frame' | 'blur' | 'undo' | 'redo' | 'settle' }
  | { do: 'call'; call: (typeof CALLS)[number]; slot: number }
  | { do: 'group'; slot: number; other: number }
  | { do: 'workspace'; index: number }
  | { do: 'send'; slot: number; index: number }
  | { do: 'flag'; slot: number; flag: keyof WindowFlags; value: boolean }
  | { do: 'viewport'; width: number; height: number }

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  outside: HTMLElement
  frames: Frames
  captured: Map<number, Element>
  pointers: Map<number, { kind: Kind; target: Element }>
  depth: number
  resources: Resources
  baseline: string
}

function pointerEvent(
  type: string,
  pointer: number,
  kind: Kind,
  x: number,
  y: number,
  primary: boolean,
  button = 0,
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    button,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: pointer })
  Object.defineProperty(event, 'pointerType', { value: kind })
  Object.defineProperty(event, 'isPrimary', { value: primary })
  return event as PointerEvent
}

function outer(resources: Resources): string {
  return resources
    .leaks()
    .filter((entry) => / on (window|document)/.test(entry))
    .sort()
    .join('\n')
}

function build(): Harness {
  const frames = stubFrames()
  const captured = new Map<number, Element>()
  Element.prototype.setPointerCapture = function setPointerCapture(id: number) {
    captured.set(id, this)
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(id: number) {
    if (captured.get(id) === this) captured.delete(id)
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(id: number) {
    return captured.get(id) === this
  }
  const resources = trackResources()
  const outside = document.createElement('aside')
  const element = document.createElement('div')
  document.body.append(outside, element)
  const wm = createWindowManager({ viewport: VIEWPORT, historyLimit: 20 })
  const harness: Harness = {
    wm,
    desktop: null as unknown as DesktopController,
    element,
    outside,
    frames,
    captured,
    pointers: new Map(),
    depth: 0,
    resources,
    baseline: '',
  }
  const { beginInteraction, endInteraction, abortInteraction } = wm
  wm.beginInteraction = () => {
    harness.depth += 1
    beginInteraction()
  }
  wm.endInteraction = () => {
    harness.depth -= 1
    endInteraction()
  }
  wm.abortInteraction = () => {
    harness.depth -= 1
    abortInteraction()
  }
  harness.desktop = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    gestures: [touchGestures()],
  })
  wm.on('close', ({ window: win }) => {
    element.querySelector(`[data-testid="${win.id}"]`)?.remove()
  })
  wm.on('open', ({ window: win }) => {
    if (element.querySelector(`[data-testid="${win.id}"]`)) return
    const root = document.createElement('section')
    root.dataset.testid = win.id
    root.innerHTML =
      '<header data-wm-drag><span data-wm-title>t</span>' +
      '<button data-wm-minimize></button><button data-wm-maximize></button>' +
      '<button data-wm-close></button></header>' +
      '<div data-wm-content><input><p>text</p></div>'
    element.append(root)
    harness.desktop.attachWindow(win.id, root)
  })
  harness.baseline = outer(resources)
  return harness
}

function flush(harness: Harness): void {
  harness.frames.flush(3)
}

function nodeAt(harness: Harness, where: Where): Element {
  if (where.on === 'desktop') return harness.element
  if (where.on === 'outside') return harness.outside
  const order = harness.wm.getState().order
  const id = order[where.slot % Math.max(order.length, 1)]
  const root = id === undefined ? null : harness.element.querySelector(`[data-testid="${id}"]`)
  if (!root) return harness.element
  const selector =
    where.on === 'grip'
      ? `[data-wm-resize="${where.edge}"]`
      : {
          handle: '[data-wm-drag]',
          title: '[data-wm-title]',
          content: '[data-wm-content] p',
          field: 'input',
          close: '[data-wm-close]',
          minimize: '[data-wm-minimize]',
          maximize: '[data-wm-maximize]',
        }[where.on]
  return root.querySelector(selector) ?? root
}

function idAt(harness: Harness, slot: number): string | undefined {
  const order = harness.wm.getState().order
  return order[slot % Math.max(order.length, 1)]
}

function routed(harness: Harness, pointer: number): Element {
  const holder = harness.captured.get(pointer) ?? harness.pointers.get(pointer)?.target
  return holder?.isConnected ? holder : harness.element
}

function lift(harness: Harness, pointer: number, type: 'pointerup' | 'pointercancel'): void {
  const known = harness.pointers.get(pointer)
  const kind = known?.kind ?? 'mouse'
  const target = routed(harness, pointer)
  harness.pointers.delete(pointer)
  target.dispatchEvent(pointerEvent(type, pointer, kind, 0, 0, kind !== 'touch'))
  const holder = harness.captured.get(pointer)
  if (!holder) return
  harness.captured.delete(pointer)
  holder.dispatchEvent(pointerEvent('lostpointercapture', pointer, kind, 0, 0, true))
}

function act(harness: Harness, action: Action): void {
  const { wm } = harness
  switch (action.do) {
    case 'open': {
      const id = `w${action.slot}`
      if (!wm.get(id)) wm.open({ id, ...action, do: undefined } as never)
      return
    }
    case 'down': {
      const target = nodeAt(harness, action.where)
      const touches = [...harness.pointers.values()].filter((held) => held.kind === 'touch')
      const primary = action.kind !== 'touch' || touches.length === 0
      harness.pointers.set(action.pointer, { kind: action.kind, target })
      target.dispatchEvent(
        pointerEvent(
          'pointerdown',
          action.pointer,
          action.kind,
          action.x,
          action.y,
          primary,
          action.button,
        ),
      )
      return
    }
    case 'move':
    case 'up': {
      const known = harness.pointers.get(action.pointer)
      const kind = known?.kind ?? 'mouse'
      if (action.do === 'up') {
        const target = routed(harness, action.pointer)
        harness.pointers.delete(action.pointer)
        target.dispatchEvent(
          pointerEvent('pointerup', action.pointer, kind, action.x, action.y, kind !== 'touch'),
        )
        const holder = harness.captured.get(action.pointer)
        if (holder) {
          harness.captured.delete(action.pointer)
          holder.dispatchEvent(pointerEvent('lostpointercapture', action.pointer, kind, 0, 0, true))
        }
        return
      }
      routed(harness, action.pointer).dispatchEvent(
        pointerEvent('pointermove', action.pointer, kind, action.x, action.y, kind !== 'touch'),
      )
      return
    }
    case 'cancel':
      lift(harness, action.pointer, 'pointercancel')
      return
    case 'lost': {
      const holder = harness.captured.get(action.pointer)
      if (!holder) return
      harness.captured.delete(action.pointer)
      holder.dispatchEvent(pointerEvent('lostpointercapture', action.pointer, 'mouse', 0, 0, true))
      return
    }
    case 'key': {
      const target = nodeAt(harness, action.where) as HTMLElement
      target.focus?.()
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: action.key,
          bubbles: true,
          cancelable: true,
          altKey: (action.mods & 1) !== 0,
          ctrlKey: (action.mods & 2) !== 0,
          metaKey: (action.mods & 4) !== 0,
          shiftKey: (action.mods & 8) !== 0,
        }),
      )
      target.dispatchEvent(new KeyboardEvent('keyup', { key: action.key, bubbles: true }))
      return
    }
    case 'click':
    case 'dblclick':
    case 'contextmenu':
      nodeAt(harness, action.where).dispatchEvent(
        new MouseEvent(action.do, { bubbles: true, cancelable: true, composed: true }),
      )
      return
    case 'frame':
      flush(harness)
      return
    case 'blur':
      window.dispatchEvent(new Event('blur'))
      return
    case 'undo':
    case 'redo':
      wm[action.do]()
      return
    case 'call': {
      const id = idAt(harness, action.slot)
      if (id !== undefined) wm[action.call](id)
      return
    }
    case 'group': {
      const first = idAt(harness, action.slot)
      const second = idAt(harness, action.other)
      if (first !== undefined && second !== undefined) wm.group([first, second])
      return
    }
    case 'workspace':
      wm.setWorkspace(action.index)
      return
    case 'send': {
      const id = idAt(harness, action.slot)
      if (id !== undefined) wm.moveToWorkspace(id, action.index)
      return
    }
    case 'flag': {
      const id = idAt(harness, action.slot)
      if (id !== undefined) wm.update(id, { [action.flag]: action.value })
      return
    }
    case 'viewport':
      wm.setViewport({ width: action.width, height: action.height })
      return
    case 'settle':
      rest(harness)
      return
  }
}

function rest(harness: Harness): void {
  for (const pointer of [...harness.pointers.keys()]) lift(harness, pointer, 'pointerup')
  flush(harness)
  const found = [
    ...stateDrift(harness.wm),
    ...domDrift(harness.wm, harness.element),
    ...gestureResidue(harness.element),
  ]
  if (harness.depth !== 0) found.push(`${harness.depth} interactions were left open`)
  if (harness.frames.waiting() > 0)
    found.push(`${harness.frames.waiting()} frames keep rescheduling`)
  const now = outer(harness.resources)
  if (now !== harness.baseline) {
    found.push(`listeners outside the desktop changed:\n${now}\n  were:\n${harness.baseline}`)
  }
  if (found.length > 0) throw new Error(found.join('\n'))
}

const slot = fc.constantFrom(...SLOTS)
const pointer = fc.constantFrom(1, 2, 3)
const px = fc.integer({ min: -60, max: 1100 })
const py = fc.integer({ min: -60, max: 780 })
const where: fc.Arbitrary<Where> = fc.oneof(
  { weight: 6, arbitrary: fc.record({ on: fc.constantFrom(...PARTS), slot }) },
  {
    weight: 3,
    arbitrary: fc.record({
      on: fc.constant('grip' as const),
      slot,
      edge: fc.constantFrom(...EDGES),
    }),
  },
  { weight: 1, arbitrary: fc.constant({ on: 'desktop' as const }) },
  { weight: 1, arbitrary: fc.constant({ on: 'outside' as const }) },
)
const key = fc.constantFrom(
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'F6',
  'z',
  'Z',
  'Enter',
  ' ',
  'Tab',
)

const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constant('open' as const),
      slot,
      x: fc.integer({ min: -100, max: 900 }),
      y: fc.integer({ min: -100, max: 600 }),
      width: fc.integer({ min: 0, max: 900 }),
      height: fc.integer({ min: 0, max: 700 }),
    }),
  },
  {
    weight: 9,
    arbitrary: fc.record({
      do: fc.constant('down' as const),
      pointer,
      kind: fc.constantFrom<Kind>('mouse', 'mouse', 'touch', 'touch', 'pen'),
      where,
      x: px,
      y: py,
      button: fc.constantFrom(0, 0, 0, 2),
    }),
  },
  {
    weight: 12,
    arbitrary: fc.record({
      do: fc.constantFrom('move' as const, 'move' as const, 'up' as const),
      pointer,
      x: px,
      y: py,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({ do: fc.constantFrom('cancel' as const, 'lost' as const), pointer }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      do: fc.constant('key' as const),
      key,
      mods: fc.nat({ max: 15 }),
      where,
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constantFrom('click' as const, 'dblclick' as const, 'contextmenu' as const),
      where,
    }),
  },
  { weight: 8, arbitrary: fc.record({ do: fc.constant('frame' as const) }) },
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constantFrom('blur' as const, 'undo' as const, 'redo' as const),
    }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      do: fc.constant('call' as const),
      call: fc.constantFrom(...CALLS),
      slot,
    }),
  },
  { weight: 2, arbitrary: fc.record({ do: fc.constant('group' as const), slot, other: slot }) },
  {
    weight: 1,
    arbitrary: fc.record({ do: fc.constant('workspace' as const), index: fc.nat({ max: 2 }) }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ do: fc.constant('send' as const), slot, index: fc.nat({ max: 2 }) }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      do: fc.constant('flag' as const),
      slot,
      flag: fc.constantFrom(...FLAGS),
      value: fc.boolean(),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      do: fc.constant('viewport' as const),
      width: fc.constantFrom(0, 320, 800, 1024, 1920),
      height: fc.constantFrom(0, 480, 720, 1080),
    }),
  },
  { weight: 5, arbitrary: fc.record({ do: fc.constant('settle' as const) }) },
)

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('raw pointer, touch, pen and key events in any order', () => {
  it(
    'never leave a gesture half open, a listener behind or the page out of step',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(action, { minLength: 1, maxLength: 120, size: 'max' }),
          async (actions) => {
            const harness = build()
            let torn = false
            const tear = () => {
              if (torn) return
              torn = true
              harness.desktop.destroy()
              harness.wm.destroy()
            }
            try {
              act(harness, { do: 'open', slot: 0, x: 40, y: 40, width: 320, height: 240 })
              act(harness, { do: 'open', slot: 1, x: 420, y: 80, width: 300, height: 220 })
              for (const next of actions) act(harness, next)
              rest(harness)
              tear()
              const left = harness.resources.leaks()
              if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
            } finally {
              tear()
              harness.resources.restore()
              vi.unstubAllGlobals()
              document.body.replaceChildren()
              await breathe()
            }
          },
        ),
        fuzz(200),
      )
    },
    patience(180_000),
  )
})
