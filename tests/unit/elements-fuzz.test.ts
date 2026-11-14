// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import type { WindowManager } from '../../src/core/types'
import {
  defineWmElements,
  type WmDesktopElement,
  type WmWindowElement,
} from '../../src/plugins/elements'
import { breathe, fuzz, junkString, patience } from './support/fuzz'
import { trackResources } from './support/resources'

const IDS = ['a', 'b', 'c', 'd'] as const
type Id = (typeof IDS)[number]

const ATTRIBUTES = [
  'label',
  'stage',
  'layer',
  'x',
  'y',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'aspect-ratio',
  'workspace',
  'minimizable',
  'maximizable',
  'resizable',
  'draggable',
  'snappable',
] as const

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

interface Model {
  elements: Set<Id>
  open: Set<Id>
  marked: Set<Id>
  leaving: Map<Id, boolean>
}

interface Page {
  holder: HTMLElement
  desktop: WmDesktopElement
}

interface Op {
  name: string
  applies(model: Readonly<Model>): boolean
  run(model: Model, page: Page): void
}

type Step = fc.AsyncCommand<Model, Page>

async function settle(): Promise<void> {
  for (let turn = 0; turn < 3; turn += 1) await Promise.resolve()
}

function managerOf(page: Page): WindowManager {
  const wm = page.desktop.manager
  if (!wm) throw new Error('the desktop lost its manager')
  return wm
}

function elementsOf(page: Page, id: Id): WmWindowElement[] {
  return [...page.desktop.querySelectorAll<WmWindowElement>(`[window-id="${id}"]`)]
}

function elementOf(page: Page, id: Id): WmWindowElement {
  const element = elementsOf(page, id)[0]
  if (!element) throw new Error(`the page has no element for ${id}`)
  return element
}

function make(id: Id, closed: boolean): WmWindowElement {
  const element = document.createElement('wm-window') as WmWindowElement
  element.setAttribute('window-id', id)
  element.setAttribute('label', id.toUpperCase())
  if (closed) element.setAttribute('closed', '')
  return element
}

function closedMarks(wm: WindowManager): string[] {
  const stored = wm.getState().extensions.elements as { closed?: string[] } | undefined
  return [...(stored?.closed ?? [])].sort()
}

function drift(model: Model, page: Page): string[] {
  const found: string[] = []
  const wm = managerOf(page)
  const state = wm.getState()
  const open = Object.keys(state.windows).sort()
  const expected = [...model.open].sort()
  if (open.join() !== expected.join()) {
    found.push(`open windows are [${open}] but the page calls for [${expected}]`)
  }
  for (const id of IDS) {
    const elements = elementsOf(page, id)
    if (elements.length !== (model.elements.has(id) ? 1 : 0)) {
      found.push(`${id}: the page holds ${elements.length} elements`)
      continue
    }
    const element = elements[0]
    const win = state.windows[id]
    if (!element) {
      if (page.desktop.windows.has(id)) found.push(`${id}: bound to an element that left the page`)
      continue
    }
    if (element.hasAttribute('closed') !== !win) {
      found.push(`${id}: closed attribute is ${element.hasAttribute('closed')}, open is ${!!win}`)
    }
    if (!win) {
      if (element.dataset.wmWindow !== undefined) found.push(`${id}: closed but still attached`)
      if (page.desktop.windows.has(id)) found.push(`${id}: closed but still in the desktop map`)
      continue
    }
    if (page.desktop.windows.get(id) !== element) found.push(`${id}: open but not bound`)
    if (element.dataset.wmWindow !== id) found.push(`${id}: open but not attached`)
    if ((element.getAttribute('stage') ?? 'normal') !== win.stage) {
      found.push(`${id}: stage attribute ${element.getAttribute('stage')}, state ${win.stage}`)
    }
    const group = win.groupId === null ? undefined : state.groups[win.groupId]
    const hidden =
      win.stage === 'minimized' ||
      win.workspace !== state.workspace ||
      (group !== undefined && group.activeId !== id)
    if (element.hidden !== hidden) found.push(`${id}: hidden is ${element.hidden}, not ${hidden}`)
    const at = `translate3d(${win.bounds.x}px, ${win.bounds.y}px, 0)`
    if (element.style.transform !== at) {
      found.push(`${id}: drawn at ${element.style.transform}, not ${at}`)
    }
    if (element.style.width !== `${win.bounds.width}px`) {
      found.push(`${id}: drawn ${element.style.width} wide, not ${win.bounds.width}px`)
    }
  }
  const marks = closedMarks(wm)
  const closed = [...model.elements].filter((id) => !model.open.has(id)).sort()
  if (marks.join() !== closed.join()) {
    found.push(`closed marks are [${marks}] but closed elements are [${closed}]`)
  }
  if ([...model.marked].sort().join() !== closed.join()) {
    found.push(
      `the model marks [${[...model.marked].sort()}] but its closed elements are [${closed}]`,
    )
  }
  return found
}

function forget(model: Model): void {
  for (const [id, attached] of model.leaving) {
    if (attached && !model.elements.has(id)) model.open.delete(id)
  }
  model.leaving.clear()
  for (const id of [...model.marked]) {
    if (!model.elements.has(id)) model.marked.delete(id)
  }
}

function shut(model: Model, id: Id): void {
  model.open.delete(id)
  if (model.leaving.has(id)) model.leaving.set(id, false)
  if (model.elements.has(id)) model.marked.add(id)
}

function raise(model: Model, id: Id): void {
  model.open.add(id)
  model.marked.delete(id)
}

function resync(model: Model, page: Page): void {
  const windows = managerOf(page).getState().windows
  for (const id of IDS) {
    if (windows[id] !== undefined) raise(model, id)
    else shut(model, id)
  }
}

async function verify(model: Model, page: Page, ran: string): Promise<void> {
  await settle()
  forget(model)
  const found = drift(model, page)
  if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${ran}`)
}

const present = (id: Id) => (model: Readonly<Model>) => model.elements.has(id)
const opened = (id: Id) => (model: Readonly<Model>) => model.open.has(id)
const always = () => true

const add = (id: Id, closed: boolean, nested: boolean): Op => ({
  name: `add(${id}${closed ? ', closed' : ''}${nested ? ', nested' : ''})`,
  applies: (model) => !model.elements.has(id),
  run(model, page) {
    const element = make(id, closed)
    if (nested) {
      const wrap = document.createElement('div')
      wrap.append(element)
      page.desktop.append(wrap)
    } else {
      page.desktop.append(element)
    }
    const stays = !model.open.has(id) && (closed || model.marked.has(id))
    model.elements.add(id)
    if (stays) model.marked.add(id)
    else raise(model, id)
  },
})

const remove = (id: Id): Op => ({
  name: `remove(${id})`,
  applies: present(id),
  run(model, page) {
    elementOf(page, id).remove()
    model.elements.delete(id)
    model.leaving.set(id, model.leaving.get(id) || model.open.has(id))
  },
})

const reinsert = (id: Id, first: boolean): Op => ({
  name: `reinsert(${id}, ${first ? 'first' : 'last'})`,
  applies: present(id),
  run(_model, page) {
    const element = elementOf(page, id)
    if (first) page.desktop.prepend(element)
    else page.desktop.append(element)
  },
})

function swap(page: Page, id: Id, newcomerFirst: boolean): void {
  const old = elementOf(page, id)
  const next = make(id, false)
  if (newcomerFirst) {
    old.after(next)
    old.remove()
  } else {
    const parent = old.parentElement as HTMLElement
    old.remove()
    parent.append(next)
  }
}

const replace = (id: Id, newcomerFirst: boolean): Op => ({
  name: `replace(${id}, ${newcomerFirst ? 'newcomer first' : 'old first'})`,
  applies: present(id),
  run(_model, page) {
    swap(page, id, newcomerFirst)
  },
})

const setClosed = (id: Id, closed: boolean): Op => ({
  name: `${closed ? 'close' : 'unclose'}(${id})`,
  applies: present(id),
  run(model, page) {
    elementOf(page, id).toggleAttribute('closed', closed)
    if (closed) shut(model, id)
    else raise(model, id)
  },
})

const apiOpen = (id: Id): Op => ({
  name: `wm.open(${id})`,
  applies: (model) => !model.open.has(id),
  run(model, page) {
    managerOf(page).open({ id, title: id.toUpperCase() })
    raise(model, id)
  },
})

const apiClose = (id: Id): Op => ({
  name: `wm.close(${id})`,
  applies: opened(id),
  run(model, page) {
    managerOf(page).close(id)
    shut(model, id)
  },
})

const apiStage = (id: Id, action: 'minimize' | 'maximize' | 'restore'): Op => ({
  name: `wm.${action}(${id})`,
  applies: opened(id),
  run(_model, page) {
    managerOf(page)[action](id)
  },
})

const apiMove = (id: Id, x: number, y: number): Op => ({
  name: `wm.move(${id}, ${x}, ${y})`,
  applies: opened(id),
  run(_model, page) {
    managerOf(page).move(id, x, y)
  },
})

const apiResize = (id: Id, width: number, height: number): Op => ({
  name: `wm.resize(${id}, ${width}, ${height})`,
  applies: opened(id),
  run(_model, page) {
    managerOf(page).resize(id, { width, height })
  },
})

const attribute = (id: Id, name: string, value: string | null): Op => ({
  name: `attr(${id}, ${name}, ${JSON.stringify(value)})`,
  applies: present(id),
  run(_model, page) {
    const element = elementOf(page, id)
    if (value === null) element.removeAttribute(name)
    else element.setAttribute(name, value)
  },
})

const group = (first: Id, second: Id): Op => ({
  name: `wm.group(${first}, ${second})`,
  applies: (model) => model.open.has(first) && model.open.has(second),
  run(_model, page) {
    managerOf(page).group([first, second])
  },
})

const ungroup = (id: Id): Op => ({
  name: `wm.ungroup(${id})`,
  applies: opened(id),
  run(_model, page) {
    managerOf(page).ungroup(id)
  },
})

const activateTab = (id: Id): Op => ({
  name: `wm.activateTab(${id})`,
  applies: opened(id),
  run(_model, page) {
    managerOf(page).activateTab(id)
  },
})

const workspace = (index: number): Op => ({
  name: `wm.setWorkspace(${index})`,
  applies: always,
  run(_model, page) {
    managerOf(page).setWorkspace(index)
  },
})

const toWorkspace = (id: Id, index: number): Op => ({
  name: `wm.moveToWorkspace(${id}, ${index})`,
  applies: opened(id),
  run(_model, page) {
    managerOf(page).moveToWorkspace(id, index)
  },
})

const travel = (direction: 'undo' | 'redo'): Op => ({
  name: `wm.${direction}()`,
  applies: always,
  run(model, page) {
    managerOf(page)[direction]()
    resync(model, page)
  },
})

const control = (id: Id, action: 'close' | 'minimize' | 'maximize'): Op => ({
  name: `click(${id}, ${action})`,
  applies: (model) => model.elements.has(id) && model.open.has(id),
  run(model, page) {
    elementOf(page, id).shadowRoot?.querySelector<HTMLElement>(`[data-wm-${action}]`)?.click()
    if (!managerOf(page).get(id)) shut(model, id)
  },
})

const shuffle = (): Op => ({
  name: 'desktop leaves and returns at once',
  applies: always,
  run(_model, page) {
    page.desktop.remove()
    page.holder.append(page.desktop)
  },
})

const anyId = fc.constantFrom(...IDS)
const coordinate = fc.integer({ min: -300, max: 1500 })
const extent = fc.integer({ min: -50, max: 1600 })
const attributeValue = fc.oneof(
  fc.constant(null),
  fc.constantFrom('false', 'true', '', 'normal', 'minimized', 'maximized', 'snapped', 'modal'),
  fc.constantFrom('floating', '0', '1', '2', '120', '480', '-40', '1e9', '0.5', 'NaN', 'Infinity'),
  junkString,
)

const anyOp: fc.Arbitrary<Op> = fc.oneof(
  { weight: 4, arbitrary: fc.tuple(anyId, fc.boolean(), fc.boolean()).map((a) => add(...a)) },
  { weight: 2, arbitrary: anyId.map(remove) },
  { weight: 1, arbitrary: fc.tuple(anyId, fc.boolean()).map((a) => reinsert(...a)) },
  { weight: 2, arbitrary: fc.tuple(anyId, fc.boolean()).map((a) => replace(...a)) },
  { weight: 2, arbitrary: fc.tuple(anyId, fc.boolean()).map((a) => setClosed(...a)) },
  { weight: 1, arbitrary: anyId.map(apiOpen) },
  { weight: 1, arbitrary: anyId.map(apiClose) },
  {
    weight: 2,
    arbitrary: fc
      .tuple(anyId, fc.constantFrom('minimize', 'maximize', 'restore'))
      .map((a) => apiStage(...a)),
  },
  { weight: 1, arbitrary: fc.tuple(anyId, coordinate, coordinate).map((a) => apiMove(...a)) },
  { weight: 1, arbitrary: fc.tuple(anyId, extent, extent).map((a) => apiResize(...a)) },
  {
    weight: 3,
    arbitrary: fc
      .tuple(anyId, fc.constantFrom(...ATTRIBUTES), attributeValue)
      .map((a) => attribute(...a)),
  },
  { weight: 1, arbitrary: fc.tuple(anyId, anyId).map((a) => group(...a)) },
  { weight: 1, arbitrary: anyId.map(ungroup) },
  { weight: 1, arbitrary: anyId.map(activateTab) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 2 }).map(workspace) },
  {
    weight: 1,
    arbitrary: fc.tuple(anyId, fc.integer({ min: 0, max: 2 })).map((a) => toWorkspace(...a)),
  },
  { weight: 2, arbitrary: fc.constantFrom('undo', 'redo').map(travel) },
  {
    weight: 2,
    arbitrary: fc
      .tuple(anyId, fc.constantFrom('close', 'minimize', 'maximize'))
      .map((a) => control(...a)),
  },
  { weight: 1, arbitrary: fc.constant(shuffle()) },
)

const task = (ops: Op[]): Step => ({
  check: always,
  async run(model, page) {
    const ran: string[] = []
    for (const op of ops) {
      if (!op.applies(model)) continue
      ran.push(op.name)
      op.run(model, page)
    }
    await verify(model, page, ran.join(', '))
  },
  toString: () => `task(${ops.map((op) => op.name).join(', ')})`,
})

const swapAlone = (id: Id, newcomerFirst: boolean): Step => ({
  check: present(id),
  async run(model, page) {
    const wm = managerOf(page)
    const before = JSON.stringify(wm.get(id)?.bounds)
    swap(page, id, newcomerFirst)
    await verify(model, page, `a lone replace of ${id}`)
    const after = JSON.stringify(wm.get(id)?.bounds)
    if (before !== after) throw new Error(`${id}: a replaced element moved ${before} to ${after}`)
  },
  toString: () => `replaceAlone(${id}, ${newcomerFirst ? 'newcomer first' : 'old first'})`,
})

const away = (): Step => ({
  check: always,
  async run(model, page) {
    page.desktop.remove()
    await settle()
    if (page.desktop.manager) throw new Error('a desktop that left the page kept its manager')
    page.holder.append(page.desktop)
    model.leaving.clear()
    model.open = new Set(
      [...model.elements].filter((id) => !elementOf(page, id).hasAttribute('closed')),
    )
    model.marked = new Set([...model.elements].filter((id) => !model.open.has(id)))
    await verify(model, page, 'the desktop left the page and came back later')
  },
  toString: () => 'desktop leaves, returns later',
})

const steps = [
  fc.array(anyOp, { minLength: 1, maxLength: 6 }).map(task),
  fc.array(anyOp, { minLength: 1, maxLength: 6 }).map(task),
  fc.array(anyOp, { minLength: 1, maxLength: 6 }).map(task),
  fc.array(anyOp, { minLength: 1, maxLength: 2 }).map(task),
  fc.tuple(anyId, fc.boolean()).map((args) => swapAlone(...args)),
  fc.constant(away()),
]

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  defineWmElements()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('a page that adds, drops, replaces and edits window elements at random', () => {
  it(
    'keeps every element in step with its window and leaves nothing behind',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.commands(steps, { maxCommands: 24, size: 'max' }), async (commands) => {
          const resources = trackResources()
          const holder = document.createElement('div')
          document.body.append(holder)
          try {
            const desktop = document.createElement('wm-desktop') as WmDesktopElement
            desktop.options = { viewport: { width: 1200, height: 800 } }
            holder.append(desktop)
            const page: Page = { holder, desktop }
            const model: Model = {
              elements: new Set(),
              open: new Set(),
              marked: new Set(),
              leaving: new Map(),
            }
            await fc.asyncModelRun(() => ({ model, real: page }), commands)
            holder.remove()
            await settle()
            const left = resources.leaks()
            if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
          } finally {
            resources.restore()
            holder.remove()
            await breathe()
          }
        }),
        fuzz(80),
      )
    },
    patience(120_000),
  )
})
