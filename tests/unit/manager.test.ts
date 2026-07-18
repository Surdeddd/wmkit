import { describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { ManagerOptions, SerializedState } from '../../src/core/types'

function makeWm(options: ManagerOptions = {}) {
  return createWindowManager({ viewport: { width: 1000, height: 800 }, ...options })
}

function rawWindow(data: SerializedState, index = 0): Record<string, unknown> {
  return data.windows[index] as unknown as Record<string, unknown>
}

describe('open', () => {
  it('opens with defaults, cascades and focuses', () => {
    const wm = makeWm()
    const first = wm.open()
    const second = wm.open()
    expect(first.id).toBe('wm-1')
    expect(first.title).toBe('Window')
    expect(first.bounds).toEqual({ x: 32, y: 32, width: 480, height: 320 })
    expect(second.bounds.x).toBe(64)
    expect(wm.getState().focusedId).toBe(second.id)
    expect(wm.getState().order).toEqual(['wm-1', 'wm-2'])
  })

  it('respects explicit position without consuming a cascade slot', () => {
    const wm = makeWm()
    wm.open({ x: 200, y: 150 })
    const auto = wm.open()
    expect(auto.bounds.x).toBe(32)
  })

  it('fills a partially specified position from the cascade base', () => {
    const wm = makeWm()
    const xOnly = wm.open({ x: 300 })
    expect(xOnly.bounds).toMatchObject({ x: 300, y: 32 })
    const yOnly = wm.open({ y: 300 })
    expect(yOnly.bounds).toMatchObject({ x: 64, y: 300 })
  })

  it('honours custom cascade and id prefix options', () => {
    const wm = makeWm({ cascadeOrigin: { x: 10, y: 20 }, cascadeOffset: 5, idPrefix: 'win' })
    const first = wm.open()
    const second = wm.open()
    expect(first.id).toBe('win-1')
    expect(first.bounds).toMatchObject({ x: 10, y: 20 })
    expect(second.bounds).toMatchObject({ x: 15, y: 25 })
  })

  it('clamps requested size to min and max constraints', () => {
    const wm = makeWm()
    const win = wm.open({ width: 10, height: 10, minWidth: 200, minHeight: 150 })
    expect(win.bounds.width).toBe(200)
    expect(win.bounds.height).toBe(150)
    const capped = wm.open({ width: 5000, height: 5000, maxWidth: 600, maxHeight: 400 })
    expect(capped.bounds.width).toBe(600)
    expect(capped.bounds.height).toBe(400)
    const heightCapOnly = wm.open({ width: 900, height: 900, maxHeight: 500 })
    expect(heightCapOnly.bounds.width).toBe(900)
    expect(heightCapOnly.bounds.height).toBe(500)
  })

  it('clamps the opening position into the viewport', () => {
    const wm = makeWm()
    const win = wm.open({ x: 5000, y: 5000 })
    expect(win.bounds.x).toBe(1000 - 48)
    expect(win.bounds.y).toBe(800 - 48)
  })

  it('skips viewport clamping when disabled or viewport is unknown', () => {
    const free = createWindowManager({
      keepInViewport: false,
      viewport: { width: 1000, height: 800 },
    })
    expect(free.open({ x: 5000, y: 5000 }).bounds.x).toBe(5000)
    const ssr = createWindowManager()
    expect(ssr.open({ x: 5000, y: 5000 }).bounds.x).toBe(5000)
  })

  it('throws on duplicate ids', () => {
    const wm = makeWm()
    wm.open({ id: 'dup' })
    expect(() => wm.open({ id: 'dup' })).toThrowError(/already exists/)
  })

  it('opens maximized with restore bounds captured', () => {
    const wm = makeWm()
    const win = wm.open({ stage: 'maximized', x: 100, y: 100, width: 300, height: 200 })
    expect(win.stage).toBe('maximized')
    expect(win.bounds).toEqual({ x: 0, y: 0, width: 1000, height: 800 })
    expect(win.restoreBounds).toEqual({ x: 100, y: 100, width: 300, height: 200 })
  })

  it('opens minimized without stealing focus', () => {
    const wm = makeWm()
    const active = wm.open()
    const hidden = wm.open({ stage: 'minimized' })
    expect(hidden.stage).toBe('minimized')
    expect(hidden.restoreStage).toBe('normal')
    expect(wm.getState().focusedId).toBe(active.id)
  })

  it('coerces a snapped opening stage to normal', () => {
    const wm = makeWm()
    expect(wm.open({ stage: 'snapped' }).stage).toBe('normal')
  })

  it('emits open, focus and order in sequence', () => {
    const wm = makeWm()
    const sequence: string[] = []
    wm.on('open', () => sequence.push('open'))
    wm.on('focus', () => sequence.push('focus'))
    wm.on('order', () => sequence.push('order'))
    wm.open()
    expect(sequence).toEqual(['open', 'focus', 'order'])
  })
})

describe('close', () => {
  it('returns false for unknown ids', () => {
    expect(makeWm().close('ghost')).toBe(false)
  })

  it('moves focus to the next top window and reports the closure', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const closed = vi.fn()
    const focused = vi.fn()
    wm.on('close', closed)
    wm.on('focus', focused)
    expect(wm.close(b.id)).toBe(true)
    expect(closed).toHaveBeenCalledWith({ window: expect.objectContaining({ id: b.id }) })
    expect(focused).toHaveBeenCalledWith({
      window: expect.objectContaining({ id: a.id }),
      previous: b.id,
    })
    expect(wm.getState().order).toEqual([a.id])
  })

  it('keeps focus when closing an unfocused window', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    wm.close(a.id)
    expect(wm.getState().focusedId).toBe(b.id)
  })

  it('clears focus when the last window closes', () => {
    const wm = makeWm()
    const only = wm.open()
    wm.close(only.id)
    expect(wm.getState().focusedId).toBeNull()
    expect(wm.getState().order).toEqual([])
  })

  it('closeAll empties the manager in one change notification', () => {
    const wm = makeWm()
    wm.open()
    wm.open()
    wm.open()
    const onChange = vi.fn()
    wm.subscribe(onChange)
    wm.closeAll()
    expect(wm.getState().order).toEqual([])
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('focus and stacking', () => {
  it('raises the focused window within its layer', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const float = wm.open({ layer: 'floating' })
    wm.focus(a.id)
    expect(wm.getState().order).toEqual([b.id, a.id, float.id])
  })

  it('returns false for unknown ids', () => {
    expect(makeWm().focus('ghost')).toBe(false)
  })

  it('skips notifications when the window is already focused on top', () => {
    const wm = makeWm()
    const win = wm.open()
    const onChange = vi.fn()
    wm.subscribe(onChange)
    expect(wm.focus(win.id)).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('restores a minimized window when focused', () => {
    const wm = makeWm()
    const win = wm.open()
    wm.minimize(win.id)
    expect(wm.focus(win.id)).toBe(true)
    expect(wm.get(win.id)?.stage).toBe('normal')
    expect(wm.getState().focusedId).toBe(win.id)
  })

  it('keeps floating windows above raised normal windows', () => {
    const wm = makeWm()
    const float = wm.open({ layer: 'floating' })
    const normal = wm.open()
    wm.focus(normal.id)
    expect(wm.getState().order).toEqual([normal.id, float.id])
  })

  it('blur clears focus once and ignores repeats', () => {
    const wm = makeWm()
    wm.open()
    const onChange = vi.fn()
    wm.subscribe(onChange)
    wm.blur()
    expect(wm.getState().focusedId).toBeNull()
    wm.blur()
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('modal layer', () => {
  it('blocks focusing non-modal windows and reports it', () => {
    const wm = makeWm()
    const doc = wm.open()
    const modal = wm.open({ layer: 'modal' })
    const blocked = vi.fn()
    wm.on('modalblocked', blocked)
    expect(wm.focus(doc.id)).toBe(false)
    expect(blocked).toHaveBeenCalledWith({ window: expect.objectContaining({ id: modal.id }) })
    expect(wm.getState().focusedId).toBe(modal.id)
  })

  it('keeps the modal focused when new normal windows open', () => {
    const wm = makeWm()
    const modal = wm.open({ layer: 'modal' })
    const win = wm.open()
    expect(wm.getState().focusedId).toBe(modal.id)
    expect(wm.getState().order).toEqual([win.id, modal.id])
  })

  it('releases the block once the modal closes or minimizes', () => {
    const wm = makeWm()
    const doc = wm.open()
    const modal = wm.open({ layer: 'modal' })
    wm.minimize(modal.id)
    expect(wm.focus(doc.id)).toBe(true)
    wm.restore(modal.id)
    expect(wm.getState().focusedId).toBe(modal.id)
    wm.close(modal.id)
    expect(wm.getState().focusedId).toBe(doc.id)
  })

  it('allows focusing the modal itself', () => {
    const wm = makeWm()
    wm.open()
    const modal = wm.open({ layer: 'modal' })
    wm.blur()
    expect(wm.focus(modal.id)).toBe(true)
  })
})

describe('cycleFocus', () => {
  it('returns null when nothing is focusable', () => {
    const wm = makeWm()
    expect(wm.cycleFocus()).toBeNull()
    const win = wm.open()
    wm.minimize(win.id)
    expect(wm.cycleFocus()).toBeNull()
  })

  it('cycles through the stacking order with wrap-around and raise', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const c = wm.open()
    expect(wm.cycleFocus()).toBe(a.id)
    expect(wm.cycleFocus()).toBe(b.id)
    expect(wm.cycleFocus(-1)).toBe(a.id)
    wm.focus(c.id)
    expect(wm.getState().order).toEqual([b.id, a.id, c.id])
    expect(wm.cycleFocus(1)).toBe(b.id)
  })

  it('starts from the edges when nothing is focused', () => {
    const forward = makeWm()
    const fa = forward.open()
    forward.open()
    forward.blur()
    expect(forward.cycleFocus(1)).toBe(fa.id)

    const backward = makeWm()
    backward.open()
    const bb = backward.open()
    backward.blur()
    expect(backward.cycleFocus(-1)).toBe(bb.id)
  })

  it('cycles only modal windows while a modal is open', () => {
    const wm = makeWm()
    wm.open()
    const modalA = wm.open({ layer: 'modal' })
    const modalB = wm.open({ layer: 'modal' })
    expect(wm.cycleFocus()).toBe(modalA.id)
    expect(wm.cycleFocus()).toBe(modalB.id)
  })
})

describe('stages', () => {
  it('minimize hides, saves the previous stage and hands focus over', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    expect(wm.minimize(b.id)).toBe(true)
    const minimizedWin = wm.get(b.id)
    expect(minimizedWin?.stage).toBe('minimized')
    expect(minimizedWin?.restoreStage).toBe('normal')
    expect(wm.getState().focusedId).toBe(a.id)
    expect(wm.minimize(b.id)).toBe(false)
  })

  it('minimizing the only window leaves nothing focused', () => {
    const wm = makeWm()
    const win = wm.open()
    wm.minimize(win.id)
    expect(wm.getState().focusedId).toBeNull()
  })

  it('minimizing an unfocused window keeps current focus silently', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    wm.focus(a.id)
    const focused = vi.fn()
    wm.on('focus', focused)
    wm.minimize(b.id)
    expect(focused).not.toHaveBeenCalled()
    expect(wm.getState().focusedId).toBe(a.id)
  })

  it('maximize fills the viewport and restore brings bounds back', () => {
    const wm = makeWm()
    const win = wm.open({ x: 100, y: 120, width: 300, height: 200 })
    expect(wm.maximize(win.id)).toBe(true)
    expect(wm.get(win.id)?.bounds).toEqual({ x: 0, y: 0, width: 1000, height: 800 })
    expect(wm.maximize(win.id)).toBe(false)
    expect(wm.restore(win.id)).toBe(true)
    expect(wm.get(win.id)?.bounds).toEqual({ x: 100, y: 120, width: 300, height: 200 })
    expect(wm.restore(win.id)).toBe(false)
  })

  it('maximize from snapped keeps the original restore bounds', () => {
    const wm = makeWm()
    const win = wm.open({ x: 100, y: 120, width: 300, height: 200 })
    wm.snap(win.id, 'left')
    wm.maximize(win.id)
    wm.restore(win.id)
    expect(wm.get(win.id)?.bounds).toEqual({ x: 100, y: 120, width: 300, height: 200 })
  })

  it('toggleMaximize flips between stages and rejects unknown ids', () => {
    const wm = makeWm()
    const win = wm.open()
    wm.toggleMaximize(win.id)
    expect(wm.get(win.id)?.stage).toBe('maximized')
    wm.toggleMaximize(win.id)
    expect(wm.get(win.id)?.stage).toBe('normal')
    expect(wm.toggleMaximize('ghost')).toBe(false)
  })

  it('restore returns a minimized window to its previous stage', () => {
    const wm = makeWm()
    const win = wm.open({ x: 50, y: 60, width: 300, height: 200 })
    wm.maximize(win.id)
    wm.minimize(win.id)
    wm.restore(win.id)
    expect(wm.get(win.id)?.stage).toBe('maximized')
    wm.restore(win.id)
    wm.snap(win.id, 'right')
    wm.minimize(win.id)
    wm.restore(win.id)
    expect(wm.get(win.id)?.stage).toBe('snapped')
    expect(wm.get(win.id)?.bounds).toEqual({ x: 500, y: 0, width: 500, height: 800 })
  })

  it('restore falls back to normal when the saved stage is gone', () => {
    const wm = makeWm()
    const win = wm.open()
    wm.minimize(win.id)
    wm.restore(win.id)
    expect(wm.get(win.id)?.stage).toBe('normal')
  })

  it('restore rejects unknown ids', () => {
    expect(makeWm().restore('ghost')).toBe(false)
  })

  it('restore from a snap made while minimized falls back to current bounds', () => {
    const wm = makeWm()
    const win = wm.open()
    wm.minimize(win.id)
    wm.snap(win.id, 'left')
    expect(wm.get(win.id)?.restoreBounds).toBeNull()
    wm.restore(win.id)
    expect(wm.get(win.id)).toMatchObject({
      stage: 'normal',
      bounds: { x: 0, y: 0, width: 500, height: 800 },
    })
  })

  it('restore and restoreTo skip clamping when keepInViewport is off', () => {
    const wm = createWindowManager({
      keepInViewport: false,
      viewport: { width: 1000, height: 800 },
    })
    const win = wm.open({ x: 100, y: 100 })
    wm.maximize(win.id)
    wm.restore(win.id)
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 100, y: 100 })
    wm.restoreTo(win.id, { x: 5000, y: 5000, width: 300, height: 200 })
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 5000, y: 5000 })
  })

  it('restoreTo places a window at explicit bounds from any stage', () => {
    const wm = makeWm()
    const win = wm.open()
    wm.maximize(win.id)
    expect(wm.restoreTo(win.id, { x: 10, y: 20, width: 300, height: 200 })).toBe(true)
    expect(wm.get(win.id)).toMatchObject({
      stage: 'normal',
      bounds: { x: 10, y: 20, width: 300, height: 200 },
      restoreBounds: null,
    })
  })

  it('restoreTo clamps the requested size to window constraints', () => {
    const wm = makeWm()
    const win = wm.open({ minWidth: 200, minHeight: 150 })
    wm.maximize(win.id)
    wm.restoreTo(win.id, { x: 10, y: 20, width: 20, height: 20 })
    expect(wm.get(win.id)?.bounds).toMatchObject({ width: 200, height: 150 })
  })

  it('snap moves a window into a zone and stores restore bounds', () => {
    const wm = makeWm()
    const win = wm.open({ x: 100, y: 120, width: 300, height: 200 })
    expect(wm.snap(win.id, 'top-right')).toBe(true)
    expect(wm.get(win.id)).toMatchObject({
      stage: 'snapped',
      snapZone: 'top-right',
      bounds: { x: 500, y: 0, width: 500, height: 400 },
      restoreBounds: { x: 100, y: 120, width: 300, height: 200 },
    })
    expect(wm.restore(win.id)).toBe(true)
    expect(wm.get(win.id)?.bounds).toEqual({ x: 100, y: 120, width: 300, height: 200 })
  })

  it('snap from maximized keeps the original restore bounds', () => {
    const wm = makeWm()
    const win = wm.open({ x: 100, y: 120, width: 300, height: 200 })
    wm.maximize(win.id)
    wm.snap(win.id, 'left')
    expect(wm.get(win.id)?.restoreBounds).toEqual({ x: 100, y: 120, width: 300, height: 200 })
    wm.restore(win.id)
    expect(wm.get(win.id)?.bounds).toEqual({ x: 100, y: 120, width: 300, height: 200 })
  })

  it('stage events carry the previous stage', () => {
    const wm = makeWm()
    const win = wm.open()
    const stages: Array<[string, string]> = []
    wm.on('stage', ({ window: w, previous }) => stages.push([previous, w.stage]))
    wm.maximize(win.id)
    wm.minimize(win.id)
    wm.restore(win.id)
    expect(stages).toEqual([
      ['normal', 'maximized'],
      ['maximized', 'minimized'],
      ['minimized', 'maximized'],
    ])
  })
})

describe('move and resize', () => {
  it('moves normal windows and clamps into the viewport', () => {
    const wm = makeWm()
    const win = wm.open({ width: 200, height: 100 })
    expect(wm.move(win.id, 300, 250)).toBe(true)
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 300, y: 250 })
    wm.move(win.id, -5000, -5000)
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 48 - 200, y: 0 })
  })

  it('ignores moves for unknown or non-normal windows', () => {
    const wm = makeWm()
    expect(wm.move('ghost', 0, 0)).toBe(false)
    const win = wm.open()
    wm.maximize(win.id)
    expect(wm.move(win.id, 10, 10)).toBe(false)
  })

  it('treats a same-position move as a silent success', () => {
    const wm = makeWm()
    const win = wm.open({ x: 100, y: 100 })
    const moved = vi.fn()
    wm.on('move', moved)
    expect(wm.move(win.id, 100, 100)).toBe(true)
    expect(moved).not.toHaveBeenCalled()
  })

  it('moveBy shifts relative to current position', () => {
    const wm = makeWm()
    const win = wm.open({ x: 100, y: 100 })
    expect(wm.moveBy(win.id, 15, -20)).toBe(true)
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 115, y: 80 })
    expect(wm.moveBy('ghost', 1, 1)).toBe(false)
  })

  it('resizes with partial patches and constraint clamping', () => {
    const wm = makeWm()
    const win = wm.open({ x: 10, y: 10, width: 300, height: 200, minWidth: 200, maxWidth: 500 })
    expect(wm.resize(win.id, { width: 400 })).toBe(true)
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 10, y: 10, width: 400, height: 200 })
    wm.resize(win.id, { width: 50 })
    expect(wm.get(win.id)?.bounds.width).toBe(200)
    wm.resize(win.id, { width: 900 })
    expect(wm.get(win.id)?.bounds.width).toBe(500)
    wm.resize(win.id, { x: 40, y: 50 })
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 40, y: 50 })
  })

  it('rejects resizing unknown, maximized or minimized windows', () => {
    const wm = makeWm()
    expect(wm.resize('ghost', { width: 100 })).toBe(false)
    const win = wm.open()
    wm.maximize(win.id)
    expect(wm.resize(win.id, { width: 100 })).toBe(false)
    wm.restore(win.id)
    wm.minimize(win.id)
    expect(wm.resize(win.id, { width: 100 })).toBe(false)
  })

  it('resizing a snapped window unsnaps it', () => {
    const wm = makeWm()
    const win = wm.open()
    wm.snap(win.id, 'left')
    const stages: string[] = []
    wm.on('stage', ({ window: w }) => stages.push(w.stage))
    expect(wm.resize(win.id, { width: 400 })).toBe(true)
    expect(wm.get(win.id)).toMatchObject({ stage: 'normal', snapZone: null, restoreBounds: null })
    expect(stages).toEqual(['normal'])
  })

  it('treats a no-op resize as a silent success', () => {
    const wm = makeWm()
    const win = wm.open({ width: 300, height: 200 })
    const resized = vi.fn()
    wm.on('resize', resized)
    expect(wm.resize(win.id, { width: 300, height: 200 })).toBe(true)
    expect(resized).not.toHaveBeenCalled()
  })
})

describe('update', () => {
  it('patches title, flags and merges meta', () => {
    const wm = makeWm()
    const win = wm.open({ meta: { a: 1 } })
    expect(wm.update(win.id, { title: 'Docs', draggable: false, meta: { b: 2 } })).toBe(true)
    expect(wm.get(win.id)).toMatchObject({
      title: 'Docs',
      draggable: false,
      meta: { a: 1, b: 2 },
    })
    expect(wm.update('ghost', { title: 'x' })).toBe(false)
  })

  it('re-sorts stacking when the layer changes', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const orderEvents = vi.fn()
    wm.on('order', orderEvents)
    wm.update(a.id, { layer: 'floating' })
    expect(wm.getState().order).toEqual([b.id, a.id])
    expect(orderEvents).toHaveBeenCalled()
  })

  it('grows bounds when a larger minimum size arrives', () => {
    const wm = makeWm()
    const win = wm.open({ width: 200, height: 150 })
    const resized = vi.fn()
    wm.on('resize', resized)
    wm.update(win.id, { minSize: { width: 400, height: 300 } })
    expect(wm.get(win.id)?.bounds).toMatchObject({ width: 400, height: 300 })
    expect(resized).toHaveBeenCalledTimes(1)
  })

  it('updates max size including clearing it', () => {
    const wm = makeWm()
    const win = wm.open({ width: 300, height: 200 })
    wm.update(win.id, { maxSize: { width: 250, height: 180 } })
    expect(wm.get(win.id)?.bounds).toMatchObject({ width: 250, height: 180 })
    wm.update(win.id, { maxSize: null })
    expect(wm.get(win.id)?.maxSize).toBeNull()
    wm.resize(win.id, { width: 900 })
    expect(wm.get(win.id)?.bounds.width).toBe(900)
  })
})

describe('viewport', () => {
  it('ignores a same-size viewport', () => {
    const wm = makeWm()
    wm.open()
    const onChange = vi.fn()
    wm.subscribe(onChange)
    wm.setViewport({ width: 1000, height: 800 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('recomputes maximized and snapped windows and clamps normal ones', () => {
    const wm = makeWm()
    const maxed = wm.open()
    wm.maximize(maxed.id)
    const snapped = wm.open()
    wm.snap(snapped.id, 'right')
    const normal = wm.open({ x: 900, y: 700, width: 200, height: 100 })
    wm.setViewport({ width: 600, height: 400 })
    expect(wm.get(maxed.id)?.bounds).toEqual({ x: 0, y: 0, width: 600, height: 400 })
    expect(wm.get(snapped.id)?.bounds).toEqual({ x: 300, y: 0, width: 300, height: 400 })
    expect(wm.get(normal.id)?.bounds).toMatchObject({ x: 600 - 48, y: 400 - 48 })
  })

  it('leaves normal windows alone when keepInViewport is off', () => {
    const wm = createWindowManager({
      keepInViewport: false,
      viewport: { width: 1000, height: 800 },
    })
    const win = wm.open({ x: 900, y: 700 })
    wm.setViewport({ width: 600, height: 400 })
    expect(wm.get(win.id)?.bounds).toMatchObject({ x: 900, y: 700 })
  })

  it('collapses viewport reflow into one change notification', () => {
    const wm = makeWm()
    const a = wm.open()
    wm.maximize(a.id)
    const b = wm.open()
    wm.snap(b.id, 'left')
    const onChange = vi.fn()
    wm.subscribe(onChange)
    wm.setViewport({ width: 500, height: 500 })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('batch', () => {
  it('coalesces nested operations into a single change', () => {
    const wm = makeWm()
    const onChange = vi.fn()
    const opened = vi.fn()
    wm.subscribe(onChange)
    wm.on('open', opened)
    wm.batch(() => {
      wm.open()
      wm.batch(() => {
        wm.open()
      })
      wm.open()
    })
    expect(opened).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('emits nothing for an empty batch', () => {
    const wm = makeWm()
    const onChange = vi.fn()
    wm.subscribe(onChange)
    wm.batch(() => {})
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('state snapshots', () => {
  it('caches getState between mutations and shares unchanged windows', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const before = wm.getState()
    expect(wm.getState()).toBe(before)
    const winA = before.windows[a.id]
    wm.move(b.id, 500, 300)
    const after = wm.getState()
    expect(after).not.toBe(before)
    expect(after.windows[a.id]).toBe(winA)
    expect(after.windows[b.id]).not.toBe(before.windows[b.id])
  })

  it('lists minimized windows in opening order', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const c = wm.open()
    wm.minimize(c.id)
    wm.minimize(a.id)
    expect(wm.minimized().map((win) => win.id)).toEqual([a.id, c.id])
    expect(wm.minimized()).not.toContain(b.id)
  })
})

describe('serialize and hydrate', () => {
  it('round-trips the full state', () => {
    const source = makeWm()
    const a = source.open({ title: 'A', x: 10, y: 20, width: 300, height: 200 })
    const b = source.open({ title: 'B', layer: 'floating', meta: { pinned: true } })
    source.snap(a.id, 'left')
    source.minimize(b.id)
    const data = source.serialize()

    const target = makeWm()
    const onChange = vi.fn()
    target.subscribe(onChange)
    expect(target.hydrate(data)).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(target.getState().order).toEqual(source.getState().order)
    expect(target.get(a.id)).toMatchObject({ stage: 'snapped', snapZone: 'left' })
    expect(target.get(b.id)).toMatchObject({ stage: 'minimized', meta: { pinned: true } })
    expect(target.getState().focusedId).toBe(a.id)
  })

  it('serialize produces defensive copies', () => {
    const wm = makeWm()
    const win = wm.open({ maxWidth: 600 })
    wm.maximize(win.id)
    const data = wm.serialize()
    const serialized = rawWindow(data) as unknown as { bounds: { x: number } }
    serialized.bounds.x = 999
    expect(wm.get(win.id)?.bounds.x).toBe(0)
  })

  it('rejects malformed payloads', () => {
    const wm = makeWm()
    expect(wm.hydrate(null as unknown as SerializedState)).toBe(false)
    expect(wm.hydrate({} as SerializedState)).toBe(false)
    expect(wm.hydrate({ version: 2, windows: [] } as unknown as SerializedState)).toBe(false)
    expect(wm.hydrate({ version: 1, windows: 'nope' } as unknown as SerializedState)).toBe(false)
    const base = makeWm().open() && makeWm().serialize()
    const good = makeWm()
    good.open({ id: 'w' })
    const template = good.serialize()
    const broken = structuredClone(template)
    rawWindow(broken).id = 7
    expect(wm.hydrate(broken)).toBe(false)
    const badStage = structuredClone(template)
    rawWindow(badStage).stage = 'flying'
    expect(wm.hydrate(badStage)).toBe(false)
    const badLayer = structuredClone(template)
    rawWindow(badLayer).layer = 'sky'
    expect(wm.hydrate(badLayer)).toBe(false)
    const badBounds = structuredClone(template)
    rawWindow(badBounds).bounds = { x: 'a' }
    expect(wm.hydrate(badBounds)).toBe(false)
    const dupes = structuredClone(template)
    dupes.windows.push(structuredClone(dupes.windows[0]) as (typeof dupes.windows)[0])
    expect(wm.hydrate(dupes)).toBe(false)
    const nullWindow = structuredClone(template)
    nullWindow.windows.push(null as unknown as (typeof nullWindow.windows)[0])
    expect(wm.hydrate(nullWindow)).toBe(false)
    const nullBounds = structuredClone(template)
    rawWindow(nullBounds).bounds = null
    expect(wm.hydrate(nullBounds)).toBe(false)
    expect(base).toBeTruthy()
  })

  it('sanitises questionable field values', () => {
    const wm = makeWm()
    const donor = makeWm()
    donor.open({ id: 'w', title: 'Keep' })
    const data = donor.serialize()
    const raw = rawWindow(data)
    raw.title = 42
    raw.snapZone = 'diagonal'
    raw.minSize = { width: 'wide' }
    raw.maxSize = 'huge'
    raw.meta = 'text'
    raw.restoreBounds = { x: 1 }
    raw.restoreStage = 'flying'
    raw.openedSeq = 'first'
    raw.draggable = false
    expect(wm.hydrate(data)).toBe(true)
    expect(wm.get('w')).toMatchObject({
      title: 'Window',
      snapZone: null,
      minSize: { width: 160, height: 100 },
      maxSize: null,
      meta: {},
      restoreBounds: null,
      restoreStage: null,
      openedSeq: 1,
      draggable: false,
      resizable: true,
    })
  })

  it('repairs the order list and focus target', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    donor.open({ id: 'b' })
    donor.open({ id: 'm', layer: 'modal' })
    const data = donor.serialize()
    data.order = ['ghost', 42, 'b', 'b'] as unknown as string[]
    data.focusedId = 'ghost'
    const wm = makeWm()
    expect(wm.hydrate(data)).toBe(true)
    expect(wm.getState().order).toEqual(['b', 'a', 'm'])
    expect(wm.getState().focusedId).toBe('m')
  })

  it('preserves valid max size constraints through hydration', () => {
    const donor = makeWm()
    donor.open({ id: 'w', maxWidth: 700, maxHeight: 500 })
    const wm = makeWm()
    expect(wm.hydrate(donor.serialize())).toBe(true)
    expect(wm.get('w')?.maxSize).toEqual({ width: 700, height: 500 })
  })

  it('drops focus from a minimized window on hydrate', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    donor.open({ id: 'b' })
    const data = donor.serialize()
    const rawB = data.windows.find((win) => win.id === 'b')
    rawB && Object.assign(rawB, { stage: 'minimized', restoreStage: 'normal' })
    data.focusedId = 'b'
    const wm = makeWm()
    wm.hydrate(data)
    expect(wm.getState().focusedId).toBe('a')
  })

  it('restores a hydrated minimized window without a saved stage to normal', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    donor.open({ id: 'b' })
    const data = donor.serialize()
    const rawA = data.windows.find((win) => win.id === 'a')
    rawA && Object.assign(rawA, { stage: 'minimized', restoreStage: null })
    const wm = makeWm()
    wm.hydrate(data)
    wm.restore('a')
    expect(wm.get('a')?.stage).toBe('normal')
  })

  it('rebuilds order from window list when order is missing', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    donor.open({ id: 'b' })
    const data = donor.serialize()
    delete (data as Partial<SerializedState>).order
    const wm = makeWm()
    expect(wm.hydrate(data)).toBe(true)
    expect(wm.getState().order).toEqual(['a', 'b'])
  })

  it('assigns sequence numbers when they are missing entirely', () => {
    const donor = makeWm()
    donor.open({ id: 'a' })
    donor.open({ id: 'b' })
    const data = donor.serialize()
    for (const raw of data.windows) {
      delete (raw as Partial<Record<'openedSeq', number>>).openedSeq
    }
    data.order = []
    const wm = makeWm()
    expect(wm.hydrate(data)).toBe(true)
    const next = wm.open()
    expect(next.openedSeq).toBeGreaterThan(2)
  })
})

describe('subscriptions and lifecycle', () => {
  it('subscribe delivers fresh state and honours unsubscribe', () => {
    const wm = makeWm()
    const states: string[] = []
    const stop = wm.subscribe((state) => states.push(state.order.join(',')))
    const a = wm.open()
    stop()
    wm.open()
    expect(states).toEqual([a.id])
  })

  it('destroy silences every listener', () => {
    const wm = makeWm()
    const onChange = vi.fn()
    const onOpen = vi.fn()
    wm.subscribe(onChange)
    wm.on('open', onOpen)
    wm.destroy()
    wm.open()
    expect(onChange).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('atomic updates (regression)', () => {
  it('emits exactly one change per operation with the final state', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const changes: Array<{ stage: string | undefined; focusedId: string | null }> = []
    wm.subscribe((state) => {
      changes.push({ stage: state.windows[b.id]?.stage, focusedId: state.focusedId })
    })
    wm.minimize(b.id)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toEqual({ stage: 'minimized', focusedId: a.id })
  })

  it('granular events observe the fully completed state', () => {
    const wm = makeWm()
    const a = wm.open()
    const b = wm.open()
    const observedFocus: Array<string | null> = []
    wm.on('stage', () => observedFocus.push(wm.getState().focusedId))
    wm.minimize(b.id)
    expect(observedFocus).toEqual([a.id])
  })

  it('open emits one change with focus already resolved', () => {
    const wm = makeWm()
    const changes: Array<string | null> = []
    wm.subscribe((state) => changes.push(state.focusedId))
    const win = wm.open()
    expect(changes).toEqual([win.id])
  })

  it('maximize emits a single change despite the internal focus step', () => {
    const wm = makeWm()
    wm.open()
    const b = wm.open()
    wm.focus(b.id)
    const wmChange = vi.fn()
    wm.subscribe(wmChange)
    const a = wm.getState().order[0] as string
    wm.maximize(a)
    expect(wmChange).toHaveBeenCalledTimes(1)
    expect(wm.getState().focusedId).toBe(a)
  })
})

describe('id generation after hydrate (regression)', () => {
  it('skips ids already taken by restored windows', () => {
    const donor = makeWm()
    donor.open()
    donor.open()
    const wm = makeWm()
    expect(wm.hydrate(donor.serialize())).toBe(true)
    const next = wm.open()
    expect(next.id).toBe('wm-3')
    expect(wm.getState().order).toHaveLength(3)
  })

  it('keeps skipping across multiple opens', () => {
    const donor = makeWm()
    donor.open()
    donor.open()
    donor.open()
    const wm = makeWm()
    wm.hydrate(donor.serialize())
    wm.close('wm-2')
    const next = wm.open()
    expect(next.id).toBe('wm-2')
    const after = wm.open()
    expect(after.id).toBe('wm-4')
  })
})

describe('Infinity max size serialization (regression)', () => {
  it('survives a JSON round-trip with a partial max constraint', () => {
    const donor = makeWm()
    donor.open({ id: 'w', width: 300, height: 200, maxWidth: 600 })
    const json = JSON.parse(JSON.stringify(donor.serialize())) as SerializedState
    const wm = makeWm()
    expect(wm.hydrate(json)).toBe(true)
    expect(wm.get('w')?.maxSize).toEqual({
      width: 600,
      height: Number.POSITIVE_INFINITY,
    })
    wm.resize('w', { width: 900, height: 900 })
    expect(wm.get('w')?.bounds.width).toBe(600)
    expect(wm.get('w')?.bounds.height).toBe(900)
  })

  it('collapses an all-infinite max size back to unbounded', () => {
    const donor = makeWm()
    donor.open({ id: 'w' })
    donor.update('w', {
      maxSize: { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY },
    })
    const json = JSON.parse(JSON.stringify(donor.serialize())) as SerializedState
    const wm = makeWm()
    expect(wm.hydrate(json)).toBe(true)
    expect(wm.get('w')?.maxSize).toBeNull()
  })

  it('drops malformed max size axes', () => {
    const donor = makeWm()
    donor.open({ id: 'w', maxWidth: 500 })
    const data = donor.serialize()
    rawWindow(data).maxSize = { width: 'wide', height: 3 }
    const wm = makeWm()
    expect(wm.hydrate(data)).toBe(true)
    expect(wm.get('w')?.maxSize).toBeNull()
  })
})

describe('modal focus (regression)', () => {
  it('hands focus to the top modal after hydration', () => {
    const donor = makeWm()
    donor.open({ id: 'doc' })
    donor.open({ id: 'm', layer: 'modal' })
    const data = donor.serialize()
    data.focusedId = 'doc'
    const wm = makeWm()
    expect(wm.hydrate(data)).toBe(true)
    expect(wm.getState().focusedId).toBe('m')
  })

  it('keeps a hydrated modal focus untouched', () => {
    const donor = makeWm()
    donor.open({ id: 'doc' })
    donor.open({ id: 'm', layer: 'modal' })
    const wm = makeWm()
    wm.hydrate(donor.serialize())
    expect(wm.getState().focusedId).toBe('m')
  })

  it('grabs focus when a window is promoted to the top modal', () => {
    const wm = makeWm()
    const a = wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    const focused = vi.fn()
    wm.on('focus', focused)
    wm.update(a.id, { layer: 'modal' })
    expect(wm.getState().focusedId).toBe(a.id)
    expect(focused).toHaveBeenCalledWith({
      window: expect.objectContaining({ id: a.id }),
      previous: 'b',
    })
  })

  it('does not steal focus when promoted below an existing modal', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.open({ id: 'm', layer: 'modal' })
    wm.update('a', { layer: 'modal' })
    expect(wm.getState().focusedId).toBe('m')
  })

  it('does not re-emit focus when the focused window itself becomes modal', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    const focused = vi.fn()
    wm.on('focus', focused)
    wm.update('a', { layer: 'modal' })
    expect(focused).not.toHaveBeenCalled()
    expect(wm.getState().focusedId).toBe('a')
  })
})

describe('undo/redo history', () => {
  it('undoes and redoes a move', () => {
    const wm = makeWm()
    const win = wm.open({ id: 'w', x: 100, y: 100 })
    wm.move('w', 300, 250)
    expect(wm.canUndo()).toBe(true)
    expect(wm.undo()).toBe(true)
    expect(wm.get('w')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(wm.canRedo()).toBe(true)
    expect(wm.redo()).toBe(true)
    expect(wm.get('w')?.bounds).toMatchObject({ x: 300, y: 250 })
    expect(win.id).toBe('w')
  })

  it('undoes open and close', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.close('a')
    expect(wm.get('a')).toBeUndefined()
    wm.undo()
    expect(wm.get('a')).toBeDefined()
    wm.undo()
    expect(wm.get('b')).toBeUndefined()
    wm.undo()
    expect(wm.getState().order).toEqual([])
    expect(wm.undo()).toBe(false)
  })

  it('clears the redo branch on a new operation', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 100, y: 100 })
    wm.move('a', 200, 200)
    wm.undo()
    wm.move('a', 400, 300)
    expect(wm.canRedo()).toBe(false)
    expect(wm.redo()).toBe(false)
  })

  it('caps history at the configured limit', () => {
    const wm = makeWm({ historyLimit: 3 })
    wm.open({ id: 'a', x: 100, y: 100 })
    for (let i = 1; i <= 10; i += 1) wm.move('a', 100 + i, 100)
    let undone = 0
    while (wm.undo()) undone += 1
    expect(undone).toBe(3)
  })

  it('disables history entirely with limit 0', () => {
    const wm = makeWm({ historyLimit: 0 })
    wm.open({ id: 'a' })
    wm.move('a', 200, 200)
    expect(wm.canUndo()).toBe(false)
    expect(wm.undo()).toBe(false)
  })

  it('collapses an interaction into a single history entry', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 100, y: 100 })
    wm.beginInteraction()
    wm.move('a', 120, 100)
    wm.move('a', 160, 120)
    wm.move('a', 240, 180)
    wm.endInteraction()
    wm.undo()
    expect(wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('handles nested and unbalanced interaction calls', () => {
    const wm = makeWm()
    wm.endInteraction()
    wm.open({ id: 'a', x: 100, y: 100 })
    wm.beginInteraction()
    wm.beginInteraction()
    wm.move('a', 150, 150)
    wm.endInteraction()
    wm.move('a', 200, 200)
    wm.endInteraction()
    wm.undo()
    expect(wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })

  it('treats a batch as one history entry', () => {
    const wm = makeWm()
    wm.batch(() => {
      wm.open({ id: 'a' })
      wm.open({ id: 'b' })
    })
    wm.undo()
    expect(wm.getState().order).toEqual([])
  })

  it('drops history after hydrate', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    const donor = makeWm()
    donor.open({ id: 'z' })
    wm.hydrate(donor.serialize())
    expect(wm.canUndo()).toBe(false)
  })

  it('reflows restored maximized windows against the current viewport', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.maximize('a')
    wm.setViewport({ width: 600, height: 400 })
    wm.undo()
    wm.redo()
    expect(wm.get('a')?.bounds).toEqual({ x: 0, y: 0, width: 600, height: 400 })
  })
})

describe('named layouts', () => {
  it('saves and loads a layout round-trip', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 100, y: 100 })
    wm.saveLayout('work')
    wm.move('a', 400, 300)
    wm.open({ id: 'b' })
    expect(wm.loadLayout('work')).toBe(true)
    expect(wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
    expect(wm.get('b')).toBeUndefined()
  })

  it('returns false for unknown layout', () => {
    expect(makeWm().loadLayout('ghost')).toBe(false)
  })

  it('lists, exports and deletes layouts', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    const data = wm.saveLayout('one')
    expect(data.windows).toHaveLength(1)
    expect(wm.layoutNames()).toEqual(['one'])
    const exported = wm.getLayout('one')
    expect(exported?.windows).toHaveLength(1)
    expect(wm.getLayout('missing')).toBeUndefined()
    expect(wm.deleteLayout('one')).toBe(true)
    expect(wm.deleteLayout('one')).toBe(false)
    expect(wm.layoutNames()).toEqual([])
  })

  it('accepts external layouts through setLayout with validation', () => {
    const wm = makeWm()
    const donor = makeWm()
    donor.open({ id: 'x', x: 50, y: 60 })
    expect(wm.setLayout('imported', donor.serialize())).toBe(true)
    expect(wm.loadLayout('imported')).toBe(true)
    expect(wm.get('x')?.bounds).toMatchObject({ x: 50, y: 60 })
    expect(wm.setLayout('bad', { version: 2 } as unknown as SerializedState)).toBe(false)
    expect(wm.setLayout('bad', null as unknown as SerializedState)).toBe(false)
  })

  it('stored layouts are isolated from later mutations', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 100, y: 100 })
    const returned = wm.saveLayout('snap')
    const raw = rawWindow(returned) as unknown as { bounds: { x: number } }
    raw.bounds.x = 999
    wm.move('a', 500, 300)
    wm.loadLayout('snap')
    expect(wm.get('a')?.bounds).toMatchObject({ x: 100, y: 100 })
  })
})

describe('hydrate emits open and close', () => {
  it('emits close for removed and open for added windows', () => {
    const wm = makeWm()
    wm.open({ id: 'old' })
    const donor = makeWm()
    donor.open({ id: 'old' })
    donor.open({ id: 'fresh' })
    donor.close('old')
    const opened: string[] = []
    const closed: string[] = []
    wm.on('open', ({ window: win }) => opened.push(win.id))
    wm.on('close', ({ window: win }) => closed.push(win.id))
    wm.hydrate(donor.serialize())
    expect(closed).toEqual(['old'])
    expect(opened).toEqual(['fresh'])
  })
})

describe('arrange and bulk stages', () => {
  it('cascades all non-minimized windows', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 500, y: 500, width: 300, height: 200 })
    wm.open({ id: 'b', x: 600, y: 100, width: 250, height: 180 })
    wm.open({ id: 'c' })
    wm.minimize('c')
    wm.arrange('cascade')
    expect(wm.get('a')?.bounds).toMatchObject({ x: 32, y: 32, width: 300, height: 200 })
    expect(wm.get('b')?.bounds).toMatchObject({ x: 64, y: 64, width: 250, height: 180 })
    expect(wm.get('c')?.stage).toBe('minimized')
  })

  it('cascade uses restore bounds size for maximized windows', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 10, y: 10, width: 320, height: 240 })
    wm.maximize('a')
    wm.arrange('cascade')
    expect(wm.get('a')).toMatchObject({
      stage: 'normal',
      bounds: { x: 32, y: 32, width: 320, height: 240 },
    })
  })

  it('tiles windows into a near-square grid', () => {
    const wm = makeWm()
    for (let i = 0; i < 4; i += 1) wm.open({ width: 200, height: 150 })
    wm.arrange('tile')
    const state = wm.getState()
    const bounds = state.order.map((id) => state.windows[id]?.bounds)
    expect(bounds[0]).toMatchObject({ x: 0, y: 0, width: 500, height: 400 })
    expect(bounds[1]).toMatchObject({ x: 500, y: 0, width: 500, height: 400 })
    expect(bounds[2]).toMatchObject({ x: 0, y: 400, width: 500, height: 400 })
    expect(bounds[3]).toMatchObject({ x: 500, y: 400, width: 500, height: 400 })
  })

  it('tiles odd counts with a trailing partial row', () => {
    const wm = makeWm()
    for (let i = 0; i < 5; i += 1) wm.open()
    wm.arrange('tile')
    const state = wm.getState()
    const last = state.windows[state.order[4] as string]
    expect(last?.bounds).toMatchObject({ x: 333, y: 400 })
  })

  it('arrange on an empty manager is a no-op', () => {
    const wm = makeWm()
    const onChange = vi.fn()
    wm.subscribe(onChange)
    wm.arrange('tile')
    wm.arrange('cascade')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('minimizeAll and restoreAll walk every window', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.minimizeAll()
    expect(wm.minimized().map((win) => win.id)).toEqual(['a', 'b'])
    wm.restoreAll()
    expect(wm.minimized()).toEqual([])
    expect(wm.get('a')?.stage).toBe('normal')
  })
})
