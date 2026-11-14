// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { Bounds, WindowInit, WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import {
  layoutMessagesRu,
  linkSnapped,
  type SnapLink,
  snapLayouts,
} from '../../src/plugins/layouts'
import { findSeams } from '../../src/plugins/layouts/seams'
import { stubFrames } from './support/frames'
import { fuzz } from './support/fuzz'
import { trackResources } from './support/resources'

const rect = (x: number, y: number, width: number, height: number): Bounds => ({
  x,
  y,
  width,
  height,
})
const named = (rects: Record<string, Bounds>) =>
  Object.entries(rects).map(([id, box]) => ({ id, rect: box }))
const brief = (items: ReturnType<typeof named>) =>
  findSeams(items).map((seam) => [
    seam.vertical ? 'v' : 'h',
    seam.at,
    seam.from,
    seam.to,
    seam.before.join(),
    seam.after.join(),
  ])

describe('the seams between snapped rectangles', () => {
  it('finds the one line two halves share', () => {
    const [left, right] = snapLayouts.halves
    expect(brief(named({ left, right }))).toEqual([['v', 0.5, 0, 1, 'left', 'right']])
  })

  it('finds both lines of three thirds', () => {
    const [a, b, c] = snapLayouts.thirds
    expect(brief(named({ a, b, c }))).toEqual([
      ['v', 1 / 3, 0, 1, 'a', 'b'],
      ['v', 1 / 3 + 1 / 3, 0, 1, 'b', 'c'],
    ])
  })

  it('splits the cross of four quarters into four seams that move apart', () => {
    const [tl, tr, bl, br] = snapLayouts.quarters
    expect(brief(named({ tl, tr, bl, br }))).toEqual([
      ['v', 0.5, 0, 0.5, 'tl', 'tr'],
      ['v', 0.5, 0.5, 1, 'bl', 'br'],
      ['h', 0.5, 0, 0.5, 'tl', 'bl'],
      ['h', 0.5, 0.5, 1, 'tr', 'br'],
    ])
  })

  it('makes one seam of a tall window and the two stacked beside it', () => {
    const items = named({
      main: rect(0, 0, 0.5, 1),
      top: rect(0.5, 0, 0.5, 0.5),
      bottom: rect(0.5, 0.5, 0.5, 0.5),
    })
    expect(brief(items)).toEqual([
      ['v', 0.5, 0, 1, 'main', 'top,bottom'],
      ['h', 0.5, 0.5, 1, 'top', 'bottom'],
    ])
  })

  it('sees no seam where rectangles only meet at a corner, leave a gap or overlap', () => {
    expect(brief(named({ a: rect(0, 0, 0.5, 0.5), b: rect(0.5, 0.5, 0.5, 0.5) }))).toEqual([])
    expect(brief(named({ a: rect(0, 0, 0.4, 1), b: rect(0.5, 0, 0.5, 1) }))).toEqual([])
    expect(brief(named({ a: rect(0, 0, 0.6, 1), b: rect(0.5, 0, 0.5, 1) }))).toEqual([])
    expect(brief(named({ a: rect(0, 0, 1, 1) }))).toEqual([])
    expect(brief([])).toEqual([])
  })

  it('holds for any tiling: every seam has a window on each side, flush with it and inside its span', () => {
    const lines = fc.uniqueArray(fc.integer({ min: 1, max: 9 }), { maxLength: 3 })
    fc.assert(
      fc.property(
        lines,
        lines,
        fc.array(fc.boolean(), { minLength: 16, maxLength: 16 }),
        (xs, ys, keep) => {
          const cuts = (given: number[]) => [
            0,
            ...given.sort((a, b) => a - b).map((n) => n / 10),
            1,
          ]
          const [columns, rows] = [cuts(xs), cuts(ys)]
          const boxes: Record<string, Bounds> = {}
          columns.slice(0, -1).forEach((x, column) => {
            rows.slice(0, -1).forEach((y, row) => {
              if (!keep[column * 4 + row]) return
              boxes[`${column}${row}`] = rect(
                x,
                y,
                (columns[column + 1] as number) - x,
                (rows[row + 1] as number) - y,
              )
            })
          })
          const items = named(boxes)
          const seams = findSeams(items)
          for (const seam of seams) {
            expect(seam.before.length).toBeGreaterThan(0)
            expect(seam.after.length).toBeGreaterThan(0)
            for (const id of [...seam.before, ...seam.after]) {
              const box = boxes[id] as Bounds
              const [near, size, low, span] = seam.vertical
                ? [box.x, box.width, box.y, box.height]
                : [box.y, box.height, box.x, box.width]
              const edge = seam.before.includes(id) ? near + size : near
              expect(edge).toBeCloseTo(seam.at, 9)
              expect(low).toBeGreaterThanOrEqual(seam.from - 1e-9)
              expect(low + span).toBeLessThanOrEqual(seam.to + 1e-9)
            }
          }
          for (const [a, first] of Object.entries(boxes)) {
            for (const [b, second] of Object.entries(boxes)) {
              const beside =
                Math.abs(first.x + first.width - second.x) < 1e-9 &&
                Math.min(first.y + first.height, second.y + second.height) -
                  Math.max(first.y, second.y) >
                  1e-9
              if (!beside) continue
              expect(
                seams.filter(
                  (seam) => seam.vertical && seam.before.includes(a) && seam.after.includes(b),
                ),
              ).toHaveLength(1)
            }
          }
        },
      ),
      fuzz(200),
    )
  })
})

let wm: WindowManager
let desktop: DesktopController
let host: HTMLElement
let link: SnapLink | undefined

function open(id: string, init: WindowInit = {}): HTMLElement {
  wm.open({ id, x: 100, y: 100, width: 300, height: 200, ...init })
  const root = document.createElement('section')
  root.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
  host.append(root)
  desktop.attachWindow(id, root)
  return root
}

function mount(): void {
  host = document.createElement('div')
  document.body.append(host)
  wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
}

const seams = () => [...host.querySelectorAll<HTMLElement>('[data-wm-seam]')]
const bounds = (id: string) => wm.get(id)?.bounds
const place = (node: HTMLElement) =>
  [node.style.left, node.style.top, node.style.width, node.style.height].join(' ')

function pointer(target: Element, type: string, x: number, y: number, button = 0): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: x,
    clientY: y,
  })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  target.dispatchEvent(event)
  return event
}

const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  stubFrames()
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.hasPointerCapture = () => false
})

afterEach(() => {
  link?.destroy()
  link = undefined
  desktop?.destroy()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('snapped windows linked by their shared edge', () => {
  it('get a separator on the edge two of them share, above both and named', () => {
    mount()
    const left = open('a')
    const right = open('b')
    link = linkSnapped(desktop)
    expect(seams()).toEqual([])
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const [seam] = seams()
    expect(seams()).toHaveLength(1)
    expect(seam?.parentElement).toBe(host)
    expect(seam?.getAttribute('role')).toBe('separator')
    expect(seam?.getAttribute('aria-orientation')).toBe('vertical')
    expect(seam?.getAttribute('aria-label')).toBe('Resize the windows on both sides')
    expect(seam?.tabIndex).toBe(0)
    expect(place(seam as HTMLElement)).toBe('596px 0px 8px 800px')
    expect(Number(seam?.style.zIndex)).toBe(
      Math.max(Number(left.style.zIndex), Number(right.style.zIndex)) + 1,
    )
    expect([
      seam?.getAttribute('aria-valuenow'),
      seam?.getAttribute('aria-valuemin'),
      seam?.getAttribute('aria-valuemax'),
    ]).toEqual(['50', '13', '87'])
  })

  it('resize both windows when the separator is dragged, as one step of history', () => {
    mount()
    const left = open('a')
    const right = open('b')
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    const down = pointer(seam, 'pointerdown', 602, 300)
    expect(down.defaultPrevented).toBe(true)
    expect(seam.hasAttribute('data-wm-active')).toBe(true)
    expect([left.hasAttribute('data-wm-live'), right.hasAttribute('data-wm-live')]).toEqual([
      true,
      true,
    ])
    pointer(seam, 'pointermove', 652, 320)
    pointer(seam, 'pointermove', 702, 500)
    expect(bounds('a')).toEqual({ x: 0, y: 0, width: 700, height: 800 })
    expect(bounds('b')).toEqual({ x: 700, y: 0, width: 500, height: 800 })
    expect(seams()[0]).toBe(seam)
    expect(place(seam)).toBe('696px 0px 8px 800px')
    pointer(seam, 'pointerup', 702, 500)
    expect(seam.hasAttribute('data-wm-active')).toBe(false)
    expect([left.hasAttribute('data-wm-live'), right.hasAttribute('data-wm-live')]).toEqual([
      false,
      false,
    ])
    expect(wm.get('a')?.snapRect?.width).toBeCloseTo(700 / 1200, 9)
    pointer(seam, 'pointermove', 900, 500)
    expect(bounds('a')?.width).toBe(700)

    wm.undo()
    expect(wm.get('a')).toMatchObject({ snapZone: 'left', snapRect: null })
    expect(bounds('a')).toEqual({ x: 0, y: 0, width: 600, height: 800 })
    expect(bounds('b')).toEqual({ x: 600, y: 0, width: 600, height: 800 })
    wm.redo()
    expect(bounds('b')).toEqual({ x: 700, y: 0, width: 500, height: 800 })
  })

  it('stop where the smallest or the largest size of a window on either side says', () => {
    mount()
    open('a', { minWidth: 400 })
    open('b', { maxWidth: 800 })
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    expect([seam.getAttribute('aria-valuemin'), seam.getAttribute('aria-valuemax')]).toEqual([
      '33',
      '87',
    ])
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 100, 300)
    expect(bounds('a')?.width).toBe(400)
    expect(bounds('b')).toEqual({ x: 400, y: 0, width: 800, height: 800 })
    pointer(seam, 'pointermove', 1190, 300)
    expect(bounds('a')?.width).toBe(1040)
    expect(bounds('b')?.width).toBe(160)
    pointer(seam, 'pointerup', 1190, 300)
  })

  it('put everything back on Escape and leave no step behind', () => {
    mount()
    open('a')
    open('b')
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snapTo('b', snapLayouts.halves[1])
    const steps = () => {
      let count = 0
      while (wm.undo()) count += 1
      for (let redo = 0; redo < count; redo += 1) wm.redo()
      return count
    }
    const before = steps()
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 800, 300)
    expect(bounds('a')?.width).toBe(800)
    const pressed = key(document.body, 'Escape')
    expect(pressed.defaultPrevented).toBe(true)
    expect(wm.get('a')).toMatchObject({ snapZone: 'left', snapRect: null })
    expect(wm.get('b')?.snapRect).toEqual(snapLayouts.halves[1])
    expect(bounds('a')?.width).toBe(600)
    expect(steps()).toBe(before)
    pointer(seam, 'pointermove', 900, 300)
    expect(bounds('a')?.width).toBe(600)
    expect(seams()[0]?.hasAttribute('data-wm-active')).toBe(false)
  })

  it('end a drag that the browser cancels the way Escape does, and swallow its context menu', () => {
    mount()
    open('a')
    open('b')
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300, 2)
    pointer(seam, 'pointermove', 800, 300)
    expect(bounds('a')?.width).toBe(600)

    pointer(seam, 'pointerdown', 600, 300)
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    seam.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    pointer(seam, 'pointermove', 800, 300)
    pointer(seam, 'pointercancel', 800, 300)
    expect(bounds('a')?.width).toBe(600)
    expect(wm.get('a')?.snapZone).toBe('left')
    const later = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    seam.dispatchEvent(later)
    expect(later.defaultPrevented).toBe(false)
  })

  it('move with the arrows, Home and End while the separator has the focus', () => {
    mount()
    open('a', { minWidth: 300 })
    open('b', { minWidth: 300 })
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    seam.focus()
    expect(key(seam, 'ArrowRight').defaultPrevented).toBe(true)
    expect(bounds('a')?.width).toBe(616)
    expect(document.activeElement).toBe(seams()[0])
    key(seam, 'ArrowLeft')
    key(seam, 'ArrowLeft')
    expect(bounds('a')?.width).toBe(584)
    expect(bounds('b')).toEqual({ x: 584, y: 0, width: 616, height: 800 })
    key(seam, 'Home')
    expect(bounds('a')?.width).toBe(300)
    key(seam, 'ArrowLeft')
    expect(bounds('a')?.width).toBe(300)
    key(seam, 'End')
    expect(bounds('a')?.width).toBe(900)
    expect(key(seam, 'ArrowUp').defaultPrevented).toBe(false)
    expect(key(seam, 'ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(key(seam, 'x').defaultPrevented).toBe(false)
    expect(bounds('a')?.width).toBe(900)
    wm.undo()
    expect(bounds('a')?.width).toBe(300)
  })

  it('work across as well as down: a separator between a top and a bottom window', () => {
    mount()
    open('a')
    open('b')
    link = linkSnapped(desktop, { size: 10, step: 40 })
    wm.snap('a', 'top')
    wm.snap('b', 'bottom')
    const seam = seams()[0] as HTMLElement
    expect(seam.getAttribute('aria-orientation')).toBe('horizontal')
    expect(place(seam)).toBe('0px 395px 1200px 10px')
    seam.focus()
    key(seam, 'ArrowDown')
    expect(bounds('a')).toEqual({ x: 0, y: 0, width: 1200, height: 440 })
    expect(bounds('b')).toEqual({ x: 0, y: 440, width: 1200, height: 360 })
    key(seam, 'ArrowUp')
    expect(key(seam, 'ArrowLeft').defaultPrevented).toBe(false)
    pointer(seam, 'pointerdown', 300, 400)
    pointer(seam, 'pointermove', 900, 300)
    pointer(seam, 'pointerup', 900, 300)
    expect(bounds('a')?.height).toBe(300)
    expect(bounds('b')).toEqual({ x: 0, y: 300, width: 1200, height: 500 })
  })

  it('move every window that touches the line: a tall one and the two stacked beside it', () => {
    mount()
    open('main')
    open('top')
    open('bottom')
    link = linkSnapped(desktop)
    wm.snap('main', 'left')
    wm.snap('top', 'top-right')
    wm.snap('bottom', 'bottom-right')
    expect(seams().map(place)).toEqual(['596px 0px 8px 800px', '600px 396px 600px 8px'])
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 100)
    pointer(seam, 'pointermove', 500, 100)
    pointer(seam, 'pointerup', 500, 100)
    expect(bounds('main')?.width).toBe(500)
    expect(bounds('top')).toEqual({ x: 500, y: 0, width: 700, height: 400 })
    expect(bounds('bottom')).toEqual({ x: 500, y: 400, width: 700, height: 400 })
    expect(seams().map(place)).toEqual(['496px 0px 8px 800px', '500px 396px 700px 8px'])
  })

  it('follow the windows: gone with a window that leaves its place, back when it returns', () => {
    mount()
    open('a')
    open('b')
    open('c')
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    expect(seams()).toHaveLength(1)
    wm.restore('b')
    expect(seams()).toHaveLength(0)
    wm.snap('b', 'right')
    wm.update('b', { resizable: false })
    expect(seams()).toHaveLength(0)
    wm.update('b', { resizable: true })
    wm.minimize('a')
    expect(seams()).toHaveLength(0)
    wm.restore('a')
    expect(seams()).toHaveLength(1)
    wm.setWorkspace(1)
    expect(seams()).toHaveLength(0)
    wm.setWorkspace(0)
    wm.group(['b', 'c'])
    wm.activateTab('c')
    expect(seams()).toHaveLength(1)
    wm.maximize('a')
    expect(seams()).toHaveLength(0)
    wm.closeAll()
    expect(seams()).toHaveLength(0)
  })

  it('show nothing on a desktop that has no size yet', () => {
    host = document.createElement('div')
    document.body.append(host)
    wm = createWindowManager()
    desktop = attachDesktop(wm, host, { autoViewport: false, announce: false })
    open('a')
    open('b')
    link = linkSnapped(desktop)
    wm.snapTo('a', snapLayouts.halves[0])
    wm.snapTo('b', snapLayouts.halves[1])
    expect(seams()).toHaveLength(0)
    wm.setViewport({ width: 1000, height: 600 })
    expect(seams().map(place)).toEqual(['496px 0px 8px 600px'])
  })

  it('read the pointer in the units of a desktop that is scaled', () => {
    mount()
    open('a')
    open('b')
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    host.getBoundingClientRect = () =>
      ({ left: 100, top: 0, width: 600, height: 400, right: 700, bottom: 400 }) as DOMRect
    Object.defineProperty(host, 'offsetWidth', { value: 1200 })
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 400, 100)
    pointer(seam, 'pointermove', 450, 100)
    pointer(seam, 'pointerup', 450, 100)
    expect(bounds('a')?.width).toBe(700)
  })

  it('name the separator from the catalogue it is given', () => {
    mount()
    open('a')
    open('b')
    link = linkSnapped(desktop, { messages: layoutMessagesRu })
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    expect(seams()[0]?.getAttribute('aria-label')).toBe('Изменить размер окон по обе стороны')
  })

  it('take everything away when it is destroyed, also in the middle of a drag', () => {
    const resources = trackResources()
    mount()
    open('a')
    open('b')
    const before = resources.leaks()
    link = linkSnapped(desktop)
    const other = linkSnapped(desktop)
    expect(document.head.querySelectorAll('style[data-wm-seam-style]')).toHaveLength(1)
    other.destroy()
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 800, 300)
    link.destroy()
    link.destroy()
    expect(bounds('a')?.width).toBe(600)
    expect(seams()).toEqual([])
    expect(document.head.querySelector('style[data-wm-seam-style]')).toBeNull()
    wm.snap('a', 'right')
    expect(seams()).toEqual([])
    expect(resources.leaks()).toEqual(before)
    resources.restore()
  })
})

describe('a separator in less usual circumstances', () => {
  const halves = () => {
    mount()
    const left = open('a')
    const right = open('b')
    return { left, right }
  }

  it('is thicker under a coarse pointer', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('coarse') }))
    halves()
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    expect(place(seams()[0] as HTMLElement)).toBe('592px 0px 16px 800px')
  })

  it('stays where it is when the windows on both sides cannot give anything, and changes nothing', () => {
    mount()
    open('a', { minWidth: 700 })
    open('b', { minWidth: 700 })
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    expect([seam.getAttribute('aria-valuemin'), seam.getAttribute('aria-valuemax')]).toEqual([
      '50',
      '50',
    ])
    const before = wm.getState()
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 900, 300)
    pointer(seam, 'pointermove', 200, 300)
    pointer(seam, 'pointerup', 200, 300)
    expect(wm.getState()).toBe(before)
    expect(wm.get('a')?.snapZone).toBe('left')
  })

  it('takes no step when the pointer comes back to where it began', () => {
    halves()
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const before = wm.getState()
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 600, 350)
    pointer(seam, 'pointerup', 600, 350)
    expect(wm.getState()).toBe(before)
  })

  it('goes on with its drag when a window leaves in the middle, and is gone at the release', () => {
    halves()
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 700, 300)
    wm.restore('b')
    expect(seams()).toEqual([seam])
    expect(seam.hasAttribute('data-wm-active')).toBe(true)
    pointer(seam, 'pointerup', 700, 300)
    expect(seams()).toEqual([])
  })

  it('does not start when the page refuses the pointer', () => {
    halves()
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    Element.prototype.setPointerCapture = () => {
      throw new Error('no such pointer')
    }
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    expect(seam.hasAttribute('data-wm-active')).toBe(false)
    pointer(seam, 'pointermove', 800, 300)
    expect(bounds('a')?.width).toBe(600)
  })

  it('follows only the pointer that took it, ignores other keys and lets the capture go', () => {
    const { left } = halves()
    const holders = new Map<number, Element>()
    Element.prototype.setPointerCapture = function hold(this: Element, id: number) {
      holders.set(id, this)
    }
    Element.prototype.releasePointerCapture = (id: number) => void holders.delete(id)
    Element.prototype.hasPointerCapture = function holds(this: Element, id: number) {
      return holders.get(id) === this
    }
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    expect(seam.hasPointerCapture(1)).toBe(true)
    const other = new MouseEvent('pointermove', { bubbles: true, clientX: 900, clientY: 300 })
    Object.defineProperty(other, 'pointerId', { value: 2 })
    seam.dispatchEvent(other)
    expect(bounds('a')?.width).toBe(600)
    const lifted = new MouseEvent('pointerup', { bubbles: true, clientX: 900, clientY: 300 })
    Object.defineProperty(lifted, 'pointerId', { value: 2 })
    seam.dispatchEvent(lifted)
    expect(seam.hasAttribute('data-wm-active')).toBe(true)
    expect(key(document.body, 'a').defaultPrevented).toBe(false)
    expect(seam.hasAttribute('data-wm-active')).toBe(true)
    pointer(seam, 'pointermove', 650, 300)
    pointer(seam, 'pointerup', 650, 300)
    expect(bounds('a')?.width).toBe(650)
    expect(seam.hasPointerCapture(1)).toBe(false)
    expect(left.hasAttribute('data-wm-live')).toBe(false)
  })

  const stray = (target: Element, type: string, x: number, buttons: number, kind = 'mouse') => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      buttons,
      clientX: x,
      clientY: 300,
    })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    Object.defineProperty(event, 'pointerType', { value: kind })
    target.dispatchEvent(event)
    return event
  }
  const steps = () => {
    let count = 0
    while (wm.undo()) count += 1
    for (let redo = 0; redo < count; redo += 1) wm.redo()
    return count
  }

  it('ends a drag whose release the page never heard with the next mouse move without a button', () => {
    const { left } = halves()
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const before = steps()
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 700, 300)
    stray(document.body, 'pointermove', 900, 0)
    expect(seam.hasAttribute('data-wm-active')).toBe(false)
    expect(left.hasAttribute('data-wm-live')).toBe(false)
    expect(bounds('a')?.width).toBe(700)
    pointer(seam, 'pointermove', 950, 300)
    expect(bounds('a')?.width).toBe(700)
    expect(steps()).toBe(before + 1)

    const again = seams()[0] as HTMLElement
    pointer(again, 'pointerdown', 700, 300)
    stray(document.body, 'pointermove', 800, 0, 'touch')
    expect(again.hasAttribute('data-wm-active')).toBe(true)
    expect(bounds('a')?.width).toBe(800)
    pointer(again, 'pointerup', 800, 300)
  })

  it('ends such a drag with the next press too, and that press may take the separator again', () => {
    halves()
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const before = steps()
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 700, 300)
    pointer(seam, 'pointerdown', 700, 300)
    expect(seam.hasAttribute('data-wm-active')).toBe(true)
    pointer(seam, 'pointermove', 760, 300)
    pointer(seam, 'pointerup', 760, 300)
    expect(bounds('a')?.width).toBe(760)
    expect(steps()).toBe(before + 2)
  })

  it('asks for the pointer back when the browser takes it away with the button still down', () => {
    halves()
    const holders = new Map<number, Element>()
    Element.prototype.setPointerCapture = function hold(this: Element, id: number) {
      holders.set(id, this)
    }
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 700, 300)
    holders.clear()
    stray(seam, 'lostpointercapture', 700, 1)
    expect(holders.get(1)).toBe(seam)
    expect(seam.hasAttribute('data-wm-active')).toBe(true)
    pointer(seam, 'pointermove', 720, 300)
    expect(bounds('a')?.width).toBe(720)

    stray(seam, 'lostpointercapture', 720, 0)
    expect(seam.hasAttribute('data-wm-active')).toBe(false)
    expect(bounds('a')?.width).toBe(600)
    expect(wm.get('a')?.snapZone).toBe('left')
  })

  it('gives the drag up when the pointer cannot be taken back', () => {
    halves()
    link = linkSnapped(desktop)
    wm.snap('a', 'left')
    wm.snap('b', 'right')
    const seam = seams()[0] as HTMLElement
    pointer(seam, 'pointerdown', 600, 300)
    pointer(seam, 'pointermove', 700, 300)
    Element.prototype.setPointerCapture = () => {
      throw new Error('no such pointer')
    }
    stray(seam, 'lostpointercapture', 700, 1)
    expect(seam.hasAttribute('data-wm-active')).toBe(false)
    expect(bounds('a')?.width).toBe(600)
  })
})
