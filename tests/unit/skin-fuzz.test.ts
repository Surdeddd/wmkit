// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController, MountedWindow, WindowSkin } from '../../src/dom/shared'

const VIEWPORT = { width: 1024, height: 720 }
const SKINS = ['plain', 'compact', 'wrapped'] as const

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

function makeSkin(look: string, depth: number): WindowSkin {
  return ({ doc, actions }) => {
    const element = doc.createElement('section')
    element.dataset.look = look
    const bar = doc.createElement('header')
    bar.dataset.wmDrag = ''
    const title = doc.createElement('span')
    title.dataset.wmTitle = ''
    const shut = doc.createElement('button')
    shut.dataset.shut = ''
    shut.addEventListener('click', () => actions.close())
    bar.append(title, shut)

    let content = doc.createElement('div')
    const inner = content
    for (let i = 0; i < depth; i += 1) {
      const wrap = doc.createElement('div')
      wrap.append(content)
      content = wrap
    }
    element.append(bar, content)
    return { element, content: inner }
  }
}

interface Harness {
  wm: WindowManager
  desktop: DesktopController
  element: HTMLElement
  mounts: Map<string, MountedWindow>
  frames: Array<() => void>
  flush(): void
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
  const desktop = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    skins: {
      plain: makeSkin('plain', 0),
      compact: makeSkin('compact', 1),
      wrapped: makeSkin('wrapped', 3),
    },
  })

  return {
    wm,
    desktop,
    element,
    mounts: new Map(),
    frames,
    flush() {
      for (const frame of frames.splice(0)) frame()
    },
  }
}

function violations(h: Harness, label: string): string[] {
  const found: string[] = []
  const state = h.wm.getState()
  const nodes = [...h.element.querySelectorAll<HTMLElement>('[data-wm-window]')]

  const seen = new Set<string>()
  for (const node of nodes) {
    const id = node.dataset.wmWindow as string
    if (seen.has(id)) found.push(`${label}: ${id} is in the page twice`)
    seen.add(id)
    if (!state.windows[id]) found.push(`${label}: ${id} is attached but gone from state`)
  }

  for (const [id, mount] of h.mounts) {
    const win = state.windows[id]
    if (!win) continue
    if (!mount.element.isConnected) {
      found.push(`${label}: the mount of ${id} points at a detached element`)
      continue
    }
    if (mount.element.dataset.wmWindow !== id) {
      found.push(`${label}: the mount of ${id} points at ${mount.element.dataset.wmWindow}`)
    }
    const marker = mount.element.querySelector(`[data-marker="${id}"]`)
    if (!marker) found.push(`${label}: ${id} lost the content it was carrying`)
    else if (marker.parentElement !== mount.content) {
      found.push(`${label}: the content of ${id} is no longer where the skin puts it`)
    }
    if (mount.element.dataset.look !== (win.meta.skin as string)) {
      found.push(
        `${label}: ${id} wears ${mount.element.dataset.look} but asks for ${win.meta.skin}`,
      )
    }
    const wanted = `translate3d(${win.bounds.x}px, ${win.bounds.y}px, 0)`
    if (mount.element.style.transform !== wanted) {
      found.push(`${label}: ${id} at ${mount.element.style.transform} want ${wanted}`)
    }
    if (mount.element.querySelector('[data-wm-resize]') === null) {
      found.push(`${label}: ${id} lost its resize grips`)
    }
    const stage = mount.element.dataset.wmStage
    if (stage !== win.stage) found.push(`${label}: ${id} stage ${stage} want ${win.stage}`)
  }

  for (const node of nodes) {
    if (node.dataset.wmDragging !== undefined) {
      found.push(`${label}: ${node.dataset.wmWindow} still marked dragging`)
    }
    if (node.dataset.wmTabTarget !== undefined) {
      found.push(`${label}: ${node.dataset.wmWindow} still marked a tab target`)
    }
  }
  return found
}

function drive(h: Harness, seed: number, steps: number): string[] {
  const random = rng(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  let opened = 0

  function mount(id: string, name: string): void {
    const mounted = h.desktop.mountWindow(id, name, { removeOnClose: true })
    const marker = document.createElement('i')
    marker.dataset.marker = id
    mounted.content.append(marker)
    h.mounts.set(id, mounted)
  }

  for (let step = 0; step < steps; step += 1) {
    const label = `seed ${seed} step ${step}`
    const list = h.wm.getState().order
    const id = list.length > 0 ? pick(list) : null
    const action = Math.floor(random() * 10)

    if (action === 0 || list.length === 0) {
      const next = `w${opened++}`
      const name = pick(SKINS)
      h.wm.open({
        id: next,
        width: 200 + Math.floor(random() * 300),
        height: 160,
        meta: { skin: name },
      })
      mount(next, name)
    } else if (action === 1 && id) {
      h.wm.update(id, { meta: { ...h.wm.get(id)?.meta, skin: pick(SKINS) } })
    } else if (action === 2 && id) {
      const name = pick(SKINS)
      h.wm.update(id, { meta: { ...h.wm.get(id)?.meta, skin: name } })
      mount(id, name)
    } else if (action === 3 && id) {
      const handle = h.mounts.get(id)?.element.querySelector<HTMLElement>('[data-wm-drag]')
      if (handle) {
        handle.dispatchEvent(pointerEvent('pointerdown', 200, 100))
        handle.dispatchEvent(pointerEvent('pointermove', 400, 300))
        h.flush()
        if (random() < 0.4) {
          // rebuild the window out from under a live drag
          h.wm.update(id, { meta: { ...h.wm.get(id)?.meta, skin: pick(SKINS) } })
          h.flush()
        }
        handle.dispatchEvent(pointerEvent('pointerup', 400, 300))
      }
    } else if (action === 4 && id) {
      h.mounts.get(id)?.element.querySelector<HTMLElement>('[data-shut]')?.click()
      h.mounts.delete(id)
    } else if (action === 5 && id) {
      h.wm.focus(id)
    } else if (action === 6 && list.length >= 2) {
      h.wm.group([pick(list) as string, pick(list) as string])
    } else if (action === 7 && id) {
      random() < 0.5 ? h.wm.minimize(id) : h.wm.toggleMaximize(id)
    } else if (action === 8) {
      h.wm.setWorkspace(Math.floor(random() * 3))
    } else if (id) {
      const mounted = h.mounts.get(id)
      if (mounted) {
        mounted.detach()
        h.mounts.delete(id)
        h.wm.close(id)
      }
    }

    h.flush()
    for (const [known] of h.mounts) {
      if (!h.wm.get(known)) h.mounts.delete(known)
    }
    const found = violations(h, label)
    if (found.length > 0) return found
  }
  return []
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('random skin changes keep every window whole', () => {
  for (const seed of [2, 7, 8, 10, 11, 14, 16, 18, 23, 41]) {
    it(`holds every mount invariant for seed ${seed}`, () => {
      const h = harness()
      expect(drive(h, seed, 140)).toEqual([])
    })
  }
})
