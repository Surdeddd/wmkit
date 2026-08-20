// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'

const VIEWPORT = { width: 1024, height: 720 }
const DIRECTIONS = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'] as const

function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function pointerEvent(type: string, x: number, y: number, pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event as PointerEvent
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  frames: Array<() => void>
  flush(): void
  add(id: string): HTMLElement
}

function harness(): Harness {
  const frames: Array<() => void> = []
  const captured = new Set<number>()
  Element.prototype.setPointerCapture = function setPointerCapture(id: number) {
    captured.add(id)
  }
  Element.prototype.releasePointerCapture = function releasePointerCapture(id: number) {
    captured.delete(id)
  }
  Element.prototype.hasPointerCapture = function hasPointerCapture(id: number) {
    return captured.has(id)
  }
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(() => callback(0))
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})

  const element = document.createElement('div')
  document.body.append(element)
  const wm = createWindowManager({ viewport: VIEWPORT, historyLimit: 12 })
  const desktop = attachDesktop(wm, element, { autoViewport: false, announce: false })
  const live = new Map<string, HTMLElement>()

  function add(id: string): HTMLElement {
    const known = live.get(id)
    if (known) return known
    const root = document.createElement('section')
    root.innerHTML =
      '<header data-wm-drag><span data-wm-title>t</span>' +
      '<button data-wm-close></button><button data-wm-minimize></button>' +
      '<button data-wm-maximize></button></header>'
    element.append(root)
    desktop.attachWindow(id, root)
    live.set(id, root)
    return root
  }

  wm.on('open', ({ window: win }) => add(win.id))
  wm.on('close', ({ window: win }) => {
    live.get(win.id)?.remove()
    live.delete(win.id)
  })

  return {
    wm,
    desktop,
    element,
    frames,
    flush() {
      for (const frame of frames.splice(0)) frame()
    },
    add,
  }
}

function violations(h: Harness, label: string): string[] {
  const found: string[] = []
  const state = h.wm.getState()
  const nodes = [...h.element.querySelectorAll<HTMLElement>('[data-wm-window]')]

  const focused = nodes.filter((node) => node.dataset.wmFocused !== undefined)
  if (focused.length > 1) found.push(`${label}: ${focused.length} windows marked focused`)
  const marked = focused[0]?.dataset.wmWindow ?? null
  if (marked !== state.focusedId) {
    const attached = nodes.some((node) => node.dataset.wmWindow === state.focusedId)
    const inPage = h.element.querySelector(`[data-wm-window="${state.focusedId}"]`) !== null
    found.push(
      `${label}: dom focus ${marked} but state focus ${state.focusedId}` +
        ` (attached=${attached} inPage=${inPage} stage=${
          state.focusedId ? state.windows[state.focusedId]?.stage : '-'
        })`,
    )
  }

  let previousZ = Number.NEGATIVE_INFINITY
  const attachedOrder = state.order.filter((id) =>
    nodes.some((node) => node.dataset.wmWindow === id),
  )
  for (const id of attachedOrder) {
    const node = nodes.find((entry) => entry.dataset.wmWindow === id) as HTMLElement
    const z = Number(node.style.zIndex)
    if (!(z > previousZ)) found.push(`${label}: ${id} breaks the z ladder at ${z}`)
    previousZ = z
  }

  for (const node of nodes) {
    const id = node.dataset.wmWindow as string
    const win = state.windows[id]
    if (!win) {
      found.push(`${label}: ${id} is attached but gone from state`)
      continue
    }
    const activeTab = win.groupId === null || state.groups[win.groupId]?.activeId === win.id
    const hidden = win.stage === 'minimized' || win.workspace !== state.workspace || !activeTab
    if (node.hidden !== hidden) found.push(`${label}: ${id} hidden=${node.hidden} want ${hidden}`)
    if (node.dataset.wmStage !== win.stage) {
      found.push(`${label}: ${id} stage ${node.dataset.wmStage} want ${win.stage}`)
    }
    if (node.dataset.wmLayer !== win.layer) {
      found.push(`${label}: ${id} layer ${node.dataset.wmLayer} want ${win.layer}`)
    }
    if (node.dataset.wmWorkspace !== String(win.workspace)) {
      found.push(`${label}: ${id} workspace drifted`)
    }
    if ((node.dataset.wmGroup ?? null) !== win.groupId) {
      found.push(`${label}: ${id} group ${node.dataset.wmGroup} want ${win.groupId}`)
    }
    const wanted = `translate3d(${win.bounds.x}px, ${win.bounds.y}px, 0)`
    if (node.style.transform !== wanted) {
      found.push(`${label}: ${id} at ${node.style.transform} want ${wanted}`)
    }
    if (node.style.width !== `${win.bounds.width}px`) {
      found.push(`${label}: ${id} width ${node.style.width} want ${win.bounds.width}px`)
    }
  }

  return found
}

function idle(h: Harness, label: string): string[] {
  const found = violations(h, label)
  for (const node of h.element.querySelectorAll<HTMLElement>('[data-wm-window]')) {
    if (node.dataset.wmDragging !== undefined) {
      found.push(`${label}: ${node.dataset.wmWindow} still marked dragging`)
    }
    if (node.dataset.wmResizing !== undefined) {
      found.push(`${label}: ${node.dataset.wmWindow} still marked resizing`)
    }
    if (node.dataset.wmTabTarget !== undefined) {
      found.push(`${label}: ${node.dataset.wmWindow} still marked a tab target`)
    }
  }
  const preview = h.element.querySelector<HTMLElement>('[data-wm-snap-preview]')
  if (preview && preview.style.display !== 'none') found.push(`${label}: snap preview left showing`)
  return found
}

function drive(h: Harness, seed: number, steps: number): string[] {
  const random = rng(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const ids = (): readonly string[] => h.wm.getState().order
  const nodeOf = (id: string) =>
    h.element.querySelector<HTMLElement>(`[data-wm-window="${id}"]`) as HTMLElement | null
  let opened = 0

  for (let step = 0; step < steps; step += 1) {
    const label = `seed ${seed} step ${step}`
    const list = ids()
    const id = list.length > 0 ? pick(list) : null
    const action = Math.floor(random() * 12)

    if (action === 0 || list.length === 0) {
      const next = `w${opened++}`
      h.wm.open({ id: next, width: 200 + Math.floor(random() * 300), height: 160 })
      h.add(next)
    } else if (action === 1 && id) {
      const node = nodeOf(id)
      const handle = node?.querySelector<HTMLElement>('[data-wm-drag]')
      if (handle) {
        const from = { x: Math.floor(random() * 900), y: Math.floor(random() * 600) }
        handle.dispatchEvent(pointerEvent('pointerdown', from.x, from.y))
        for (let i = 0; i < 2; i += 1) {
          handle.dispatchEvent(
            pointerEvent('pointermove', Math.floor(random() * 1100), Math.floor(random() * 700)),
          )
          h.flush()
        }
        if (random() < 0.15) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        } else {
          handle.dispatchEvent(pointerEvent('pointerup', 400, 300))
        }
      }
    } else if (action === 2 && id) {
      const direction = pick(DIRECTIONS)
      const grip = nodeOf(id)?.querySelector<HTMLElement>(`[data-wm-resize="${direction}"]`)
      if (grip) {
        grip.dispatchEvent(pointerEvent('pointerdown', 300, 300))
        grip.dispatchEvent(
          pointerEvent('pointermove', Math.floor(random() * 900), Math.floor(random() * 600)),
        )
        h.flush()
        if (random() < 0.15) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        } else {
          grip.dispatchEvent(pointerEvent('pointerup', 500, 400))
        }
      }
    } else if (action === 3 && id) {
      const control = pick(['[data-wm-close]', '[data-wm-minimize]', '[data-wm-maximize]'])
      nodeOf(id)?.querySelector<HTMLElement>(control)?.click()
    } else if (action === 4 && id) {
      h.wm.focus(id)
    } else if (action === 5 && list.length >= 2) {
      h.wm.group([pick(list) as string, pick(list) as string])
    } else if (action === 6 && id) {
      h.wm.ungroup(id)
    } else if (action === 7 && id) {
      h.wm.activateTab(id)
    } else if (action === 8) {
      h.wm.setWorkspace(Math.floor(random() * 3))
    } else if (action === 9 && id) {
      h.wm.moveToWorkspace(id, Math.floor(random() * 3))
    } else if (action === 10) {
      random() < 0.5 ? h.wm.undo() : h.wm.redo()
    } else if (id) {
      h.wm.moveTab(id, Math.floor(random() * 4) - 1)
    }

    h.flush()
    const found = idle(h, label)
    if (found.length > 0) return found
  }
  return []
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('random gestures keep the dom in step with the state', () => {
  for (const seed of [1, 4, 9, 16, 25, 36]) {
    it(`holds every dom invariant for seed ${seed}`, () => {
      const h = harness()
      expect(drive(h, seed, 160)).toEqual([])
    }, 30_000)
  }
})
