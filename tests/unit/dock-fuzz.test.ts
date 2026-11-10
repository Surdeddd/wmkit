// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import {
  createDock,
  type Dock,
  type DockNode,
  type DockStack,
  dockLayout,
} from '../../src/plugins/dock'

const POOL = ['a', 'b', 'c', 'd', 'e', 'f']
const SIDES = ['left', 'right', 'top', 'bottom', 'center'] as const

interface World {
  wm: WindowManager
  dock: Dock
  element: HTMLElement
}

type Op = [string, (w: World, random: () => number) => void]

function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)] as T

function stacksOf(node: DockNode | null): DockStack[] {
  if (!node) return []
  return node.kind === 'stack' ? [node] : node.children.flatMap(stacksOf)
}

function world(): World {
  const element = document.createElement('div')
  document.body.append(element)
  const wm = createWindowManager({ viewport: { width: 1400, height: 900 } })
  const desktop = attachDesktop(wm, element, {
    autoViewport: false,
    magnetism: false,
    announce: false,
  })
  const dock = createDock(desktop)
  POOL.forEach((id, i) => {
    wm.open({ id, title: id, x: 20 + i * 30, y: 20 + i * 30, width: 300, height: 200 })
  })
  wm.clearHistory()
  return { wm, dock, element }
}

function check({ wm, dock }: World): string | null {
  const layout = dock.layout()
  if (!dockLayout.validate(layout)) return 'tree fails validate'
  const state = wm.getState()
  const placed = dockLayout.rects(
    layout,
    { x: 0, y: 0, ...state.viewport },
    {
      sash: 6,
      minSize: { width: 0, height: 0 },
      minOf: (stack) =>
        stack.windows.reduce(
          (size, id) => {
            const min = wm.get(id)?.minSize ?? size
            return {
              width: Math.max(size.width, min.width),
              height: Math.max(size.height, min.height),
            }
          },
          { width: 0, height: 0 },
        ),
    },
  ).stacks
  const docked = new Set(dockLayout.windowsOf(layout))
  for (const stack of stacksOf(layout.root)) {
    const rect = placed.find((entry) => entry.id === stack.id)?.bounds
    const fits = stack.windows.every((id) => {
      const min = wm.get(id)?.minSize
      return !min || !rect || (min.width <= rect.width + 1 && min.height <= rect.height + 1)
    })
    const groups = new Set<string | null>()
    for (const id of stack.windows) {
      const win = wm.get(id)
      if (!win) return `tree names missing window ${id}`
      if (win.stage === 'normal') return `docked ${id} floats`
      if (win.resizable || win.maxSize || win.aspectRatio) return `docked ${id} is not locked`
      groups.add(win.groupId)
      const b = win.bounds
      if (
        win.stage === 'snapped' &&
        rect &&
        fits &&
        (Math.abs(b.x - rect.x) > 1 ||
          Math.abs(b.y - rect.y) > 1 ||
          Math.abs(b.width - rect.width) > 1 ||
          Math.abs(b.height - rect.height) > 1)
      ) {
        return `docked ${id} at ${JSON.stringify(b)}, its panel is ${JSON.stringify(rect)}`
      }
    }
    if (stack.windows.length === 1 && !groups.has(null)) return `single ${stack.windows} is a tab`
    if (stack.windows.length > 1) {
      const [groupId] = [...groups]
      if (groups.size !== 1 || !groupId) return `stack ${stack.windows} is not one tab group`
      const members = wm.groupMembers(groupId).map((win) => win.id)
      if (members.sort().join() !== [...stack.windows].sort().join()) {
        return `stack ${stack.windows} but group ${members}`
      }
      if (state.groups[groupId]?.activeId !== stack.active) {
        return `stack shows ${stack.active}, group shows ${state.groups[groupId]?.activeId}`
      }
    }
  }
  for (const group of Object.values(state.groups)) {
    const inside = group.members.filter((id) => docked.has(id))
    if (inside.length > 0 && inside.length !== group.members.length) {
      return `group ${group.members} is half docked`
    }
  }
  for (const id of state.order) {
    if (docked.has(id)) continue
    const win = wm.get(id)
    if (win && !win.resizable) return `undocked ${id} is still locked`
    if (win?.snapRect) return `undocked ${id} sits in a panel rectangle`
  }
  return null
}

const OPS: Op[] = [
  ['dock', (w, r) => void w.dock.dock(pick(r, POOL), { side: pick(r, SIDES) })],
  [
    'dock-stack',
    (w, r) => {
      const stacks = stacksOf(w.dock.layout().root)
      if (stacks.length > 0) {
        w.dock.dock(pick(r, POOL), { stackId: pick(r, stacks).id, side: pick(r, SIDES) })
      }
    },
  ],
  ['undock', (w, r) => void w.dock.undock(pick(r, POOL))],
  [
    'set-layout',
    (w, r) => {
      const ids = POOL.filter(() => r() < 0.5)
      if (ids.length === 0) return
      w.dock.setLayout({
        root: {
          kind: 'split',
          id: 'r',
          axis: 'row',
          sizes: ids.map(() => 1 / ids.length),
          children: ids.map((id, i) => ({ kind: 'stack', id: `s${i}`, windows: [id], active: id })),
        } as DockNode,
      })
    },
  ],
  ['close', (w, r) => void w.wm.close(pick(r, POOL))],
  [
    'reopen',
    (w, r) => {
      const id = pick(r, POOL)
      if (!w.wm.get(id)) w.wm.open({ id, title: id, x: 40, y: 40, width: 300, height: 200 })
    },
  ],
  [
    'viewport',
    (w, r) =>
      w.wm.setViewport({
        width: 1200 + Math.floor(r() * 600),
        height: 800 + Math.floor(r() * 400),
      }),
  ],
  [
    'sash',
    (w, r) => {
      const sashes = [...w.element.querySelectorAll('[data-wm-sash]')]
      if (sashes.length === 0) return
      const key = pick(r, ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'])
      pick(r, sashes).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      )
    },
  ],
  ['maximize', (w, r) => void w.wm.maximize(pick(r, POOL))],
  ['restore', (w, r) => void w.wm.restore(pick(r, POOL))],
  ['focus', (w, r) => void w.wm.focus(pick(r, POOL))],
  ['activate-tab', (w, r) => void w.wm.activateTab(pick(r, POOL))],
  ['minimize', (w, r) => void w.wm.minimize(pick(r, POOL))],
  ['ungroup', (w, r) => void w.wm.ungroup(pick(r, POOL))],
  ['group', (w, r) => void w.wm.group([pick(r, POOL), pick(r, POOL)])],
  [
    'workspace',
    (w, r) =>
      void (r() < 0.5
        ? w.wm.setWorkspace(Math.floor(r() * 2))
        : w.wm.moveToWorkspace(pick(r, POOL), Math.floor(r() * 2))),
  ],
  [
    'geometry',
    (w, r) =>
      void (r() < 0.5
        ? w.wm.move(pick(r, POOL), r() * 800, r() * 500)
        : w.wm.resize(pick(r, POOL), { width: 200 + r() * 400 })),
  ],
  [
    'snap',
    (w, r) => void w.wm.snap(pick(r, POOL), pick(r, ['left', 'right', 'top-left'] as const)),
  ],
  [
    'limits',
    (w, r) =>
      void w.wm.update(pick(r, POOL), {
        minSize: { width: 100 + Math.floor(r() * 200), height: 80 + Math.floor(r() * 100) },
      }),
  ],
  ['arrange', (w, r) => void w.wm.arrange(pick(r, ['tile', 'cascade'] as const))],
  ['minimize-all', (w) => w.wm.minimizeAll()],
  ['undo', (w) => void w.wm.undo()],
  ['redo', (w) => void w.wm.redo()],
]

function run(seeds: number, steps: number, offset: number): string[] {
  const problems: string[] = []
  for (let seed = offset; seed < offset + seeds; seed += 1) {
    const random = rng(seed * 7919)
    const w = world()
    const trail: string[] = []
    for (let step = 0; step < steps; step += 1) {
      const [label, op] = pick(random, OPS)
      trail.push(label)
      let problem: string | null = null
      try {
        const before = label === 'undo' ? JSON.stringify(w.wm.serialize()) : null
        op(w, random)
        problem = check(w)
        const undone = JSON.stringify(w.wm.serialize())
        if (!problem && before !== null && before !== undone) {
          w.wm.redo()
          if (JSON.stringify(w.wm.serialize()) !== before) problem = 'undo then redo changed state'
          else problem = check(w)
          w.wm.undo()
          if (!problem && JSON.stringify(w.wm.serialize()) !== undone) {
            problem = 'redo then undo changed state'
          }
        }
      } catch (error) {
        problem = `threw ${error instanceof Error ? error.message : String(error)}`
      }
      if (problem) {
        problems.push(`seed ${seed}: ${problem} after ${trail.slice(-8).join(' > ')}`)
        break
      }
    }
    document.body.replaceChildren()
  }
  return problems
}

afterEach(() => {
  document.body.replaceChildren()
})

it('keeps the layout and the manager in step through random operations', () => {
  expect(run(100, 60, 1)).toEqual([])
})

it('keeps them in step through more random operations with other seeds', () => {
  expect(run(100, 60, 1000)).toEqual([])
})
