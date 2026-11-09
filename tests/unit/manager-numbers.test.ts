import { describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { Bounds, SerializedState, WindowLayer } from '../../src/core/types'

const VIEWPORT = { width: 800, height: 600 }

function makeWm() {
  const wm = createWindowManager({ viewport: VIEWPORT })
  wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
  return wm
}

function finite(bounds: Bounds | undefined): boolean {
  return bounds !== undefined && Object.values(bounds).every(Number.isFinite)
}

function snapshot(window: Record<string, unknown>): SerializedState {
  return {
    version: 1,
    windows: [
      {
        id: 'a',
        bounds: { x: 0, y: 0, width: 300, height: 200 },
        stage: 'normal',
        layer: 'normal',
        ...window,
      },
    ],
    order: ['a'],
    focusedId: 'a',
    workspace: 0,
    activeTabs: {},
  } as unknown as SerializedState
}

describe('non-finite numbers never enter the state', () => {
  it('refuses a move to a non-finite position and changes nothing', () => {
    const wm = makeWm()
    const before = wm.getState()
    const change = vi.fn()
    wm.subscribe(change)
    expect(wm.move('a', Number.NaN, 20)).toBe(false)
    expect(wm.move('a', 20, Number.POSITIVE_INFINITY)).toBe(false)
    expect(wm.moveBy('a', Number.NaN, 0)).toBe(false)
    expect(wm.getState()).toBe(before)
    expect(change).not.toHaveBeenCalled()
  })

  it('keeps the current value for a field a resize patch leaves out or sets to undefined', () => {
    const wm = makeWm()
    expect(wm.resize('a', { width: 400, height: undefined })).toBe(true)
    expect(wm.get('a')?.bounds).toEqual({ x: 10, y: 10, width: 400, height: 150 })
    wm.resize('a', { height: 300 })
    expect(wm.get('a')?.bounds).toEqual({ x: 10, y: 10, width: 400, height: 300 })
  })

  it('refuses a resize with a non-finite field', () => {
    const wm = makeWm()
    const before = wm.get('a')
    expect(wm.resize('a', { width: Number.NaN })).toBe(false)
    expect(wm.resize('a', { x: Number.NEGATIVE_INFINITY })).toBe(false)
    expect(wm.get('a')).toBe(before)
  })

  it('falls back to the defaults for bad numbers and an unknown layer in open', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    const win = wm.open({
      id: 'a',
      x: Number.NaN,
      y: 10,
      width: -50,
      height: Number.POSITIVE_INFINITY,
      minWidth: Number.NaN,
      minHeight: -1,
      maxWidth: Number.NaN,
      maxHeight: 0,
      layer: 'bogus' as WindowLayer,
    })
    expect(win.bounds).toEqual({ x: 32, y: 10, width: 480, height: 320 })
    expect(win.minSize).toEqual({ width: 160, height: 100 })
    expect(win.maxSize).toBeNull()
    expect(win.layer).toBe('normal')
  })

  it('keeps an infinite maximum, where Infinity already means unbounded', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    const win = wm.open({ id: 'a', maxWidth: Number.POSITIVE_INFINITY, maxHeight: 300 })
    expect(win.maxSize).toEqual({ width: Number.POSITIVE_INFINITY, height: 300 })
  })

  it('refuses a snapTo rectangle with a non-finite number', () => {
    const wm = makeWm()
    const before = wm.get('a')
    expect(wm.snapTo('a', { x: Number.NaN, y: 0, width: 0.5, height: 1 })).toBe(false)
    expect(wm.snapTo('a', { x: 0, y: 0, width: Number.POSITIVE_INFINITY, height: 1 })).toBe(false)
    expect(wm.get('a')).toBe(before)
  })

  it('clamps a snapTo rectangle into the viewport and refuses one that starts outside it', () => {
    const wm = makeWm()
    expect(wm.snapTo('a', { x: 2, y: 2, width: 3, height: 3 })).toBe(false)
    expect(wm.snapTo('a', { x: -1, y: 0.5, width: 3, height: 3 })).toBe(false)
    expect(wm.snapTo('a', { x: 0.5, y: 0, width: -0.25, height: 1 })).toBe(false)
    expect(wm.get('a')?.stage).toBe('normal')
    expect(wm.snapTo('a', { x: 0, y: 0.5, width: 3, height: 3 })).toBe(true)
    expect(wm.get('a')).toMatchObject({
      snapRect: { x: 0, y: 0.5, width: 1, height: 0.5 },
      bounds: { x: 0, y: 300, width: 800, height: 300 },
    })
  })

  it('accepts an empty snapTo rectangle inside the viewport at the minimum size', () => {
    const wm = makeWm()
    expect(wm.snapTo('a', { x: 0.5, y: 1, width: 0, height: 0 })).toBe(true)
    expect(wm.get('a')).toMatchObject({
      stage: 'snapped',
      snapRect: { x: 0.5, y: 1, width: 0, height: 0 },
      bounds: { x: 400, y: 500, width: 160, height: 100 },
    })
    const copy = createWindowManager({ viewport: VIEWPORT })
    copy.hydrate(JSON.parse(JSON.stringify(wm.serialize())))
    expect(copy.get('a')).toEqual(wm.get('a'))
  })

  it('refuses an unknown snap zone', () => {
    const wm = makeWm()
    expect(wm.snap('a', 'middle' as 'left')).toBe(false)
    expect(wm.get('a')?.stage).toBe('normal')
  })

  it('ignores a non-finite viewport', () => {
    const wm = makeWm()
    wm.maximize('a')
    wm.setViewport({ width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY })
    wm.setViewport({ width: Number.NaN, height: 600 })
    expect(wm.getState().viewport).toEqual(VIEWPORT)
    expect(wm.get('a')?.bounds).toEqual({ x: 0, y: 0, ...VIEWPORT })
  })

  it('refuses an update with an impossible size limit or layer and changes nothing', () => {
    const wm = makeWm()
    const before = wm.get('a')
    expect(wm.update('a', { minSize: { width: Number.NaN, height: 100 } })).toBe(false)
    expect(wm.update('a', { minSize: { width: -1, height: 100 } })).toBe(false)
    expect(wm.update('a', { maxSize: { width: 0, height: 300 } })).toBe(false)
    expect(wm.update('a', { title: 'x', maxSize: { width: Number.NaN, height: 300 } })).toBe(false)
    expect(wm.update('a', { layer: 'bogus' as WindowLayer })).toBe(false)
    expect(wm.get('a')).toBe(before)
  })

  it('refuses a size limit with a missing axis', () => {
    const wm = makeWm()
    const before = wm.get('a')
    expect(wm.update('a', { minSize: { width: 250 } as never })).toBe(false)
    expect(wm.update('a', { maxSize: { height: 400 } as never })).toBe(false)
    expect(wm.get('a')).toBe(before)
    wm.update('a', { maxSize: { width: Number.POSITIVE_INFINITY, height: 400 } })
    expect(wm.get('a')?.maxSize).toEqual({ width: Number.POSITIVE_INFINITY, height: 400 })
  })

  it('stores a copy of the size limits it was handed', () => {
    const wm = makeWm()
    const minSize = { width: 180, height: 120 }
    wm.update('a', { minSize })
    minSize.width = 5
    expect(wm.get('a')?.minSize).toEqual({ width: 180, height: 120 })
    const before = wm.get('a')
    expect(wm.update('a', { minSize: before?.minSize })).toBe(true)
    expect(wm.get('a')).toBe(before)
  })

  it('does not center a window before the viewport is known', () => {
    const wm = createWindowManager()
    wm.open({ id: 'a', x: 50, y: 50, width: 300, height: 200 })
    expect(wm.center('a')).toBe(false)
    expect(wm.get('a')?.bounds).toMatchObject({ x: 50, y: 50 })
  })

  it('never makes a window smaller than one pixel', () => {
    const wm = makeWm()
    wm.update('a', { minSize: { width: 0, height: 0 } })
    wm.resize('a', { width: 0, height: 0.2 })
    expect(wm.get('a')?.bounds).toMatchObject({ width: 1, height: 1 })
  })

  it('keeps a saved layout loadable after a bad number was offered', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a', x: 10, y: 10, width: 300, height: 200 })
    wm.open({ id: 'b', x: 50, y: 50, width: 300, height: 200 })
    wm.move('a', Number.NaN, 5)
    const fresh = createWindowManager({ viewport: VIEWPORT })
    expect(fresh.hydrate(JSON.parse(JSON.stringify(wm.serialize())))).toBe(true)
    expect(fresh.getState().order).toEqual(['a', 'b'])
  })
})

describe('manager options fall back to the defaults for bad numbers', () => {
  it('ignores a bad viewport, default size, cascade, visibility and history limit', () => {
    const wm = createWindowManager({
      viewport: { width: Number.NaN, height: 600 },
      defaultSize: { width: -1, height: 300 },
      cascadeOffset: Number.NaN,
      cascadeOrigin: { x: Number.POSITIVE_INFINITY, y: 0 },
      minVisible: -5,
      historyLimit: Number.NaN,
    })
    expect(wm.getState().viewport).toEqual({ width: 0, height: 0 })
    expect(wm.open({ id: 'a' }).bounds).toEqual({ x: 32, y: 32, width: 480, height: 320 })
    expect(wm.open({ id: 'b' }).bounds).toMatchObject({ x: 64, y: 64 })
    wm.setViewport(VIEWPORT)
    wm.move('a', -1000, 0)
    expect(wm.get('a')?.bounds.x).toBe(48 - 480)
    for (let i = 0; i < 60; i += 1) wm.move('b', i, 100)
    let steps = 0
    while (wm.undo()) steps += 1
    expect(steps).toBe(50)
  })

  it('keeps zero and unbounded limits where they mean something', () => {
    const none = createWindowManager({ viewport: VIEWPORT, historyLimit: 0, minVisible: 0 })
    none.open({ id: 'a', width: 200, height: 150 })
    none.move('a', -150, 0)
    expect(none.get('a')?.bounds.x).toBe(-150)
    expect(none.canUndo()).toBe(false)
    const all = createWindowManager({
      viewport: VIEWPORT,
      historyLimit: Number.POSITIVE_INFINITY,
      cascadeOffset: 0,
      cascadeOrigin: { x: 0, y: 0 },
    })
    expect(all.open({ id: 'a' }).bounds).toMatchObject({ x: 0, y: 0 })
    expect(all.open({ id: 'b' }).bounds).toMatchObject({ x: 0, y: 0 })
    for (let i = 1; i <= 80; i += 1) all.move('a', i, 0)
    let steps = 0
    while (all.undo()) steps += 1
    expect(steps).toBe(82)
  })
})

describe('hydrate repairs a window instead of rejecting the snapshot', () => {
  it('replaces a non-finite position and size with what open would give', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    const data = JSON.parse(
      '{"version":1,"windows":[{"id":"a","bounds":{"x":null,"y":5,"width":1e999,"height":null},"stage":"normal","layer":"normal"},{"id":"b","bounds":{"x":40,"y":40,"width":200,"height":150},"stage":"normal","layer":"normal"}],"order":["a","b"],"focusedId":"a","workspace":0,"activeTabs":{}}',
    )
    expect(wm.hydrate(data)).toBe(true)
    expect(wm.get('a')?.bounds).toEqual({ x: 32, y: 5, width: 480, height: 320 })
    expect(wm.get('b')?.bounds).toEqual({ x: 40, y: 40, width: 200, height: 150 })
  })

  it('replaces a non-positive size and clamps a size to the window limits', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.hydrate(snapshot({ bounds: { x: 0, y: 0, width: -500, height: 0 } }))
    expect(wm.get('a')?.bounds).toEqual({ x: 0, y: 0, width: 480, height: 320 })
    wm.hydrate(
      snapshot({
        bounds: { x: 0, y: 0, width: 900, height: 20 },
        minSize: { width: 100, height: 120 },
        maxSize: { width: 600, height: null },
      }),
    )
    expect(wm.get('a')?.bounds).toEqual({ x: 0, y: 0, width: 600, height: 120 })
  })

  it('repairs broken limits, restore bounds and snap rectangles', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.hydrate(
      snapshot({
        minSize: { width: Number.NaN, height: 'x' },
        maxSize: { width: -5, height: 0 },
        restoreBounds: { x: 0, y: 0, width: Number.NaN, height: 10 },
        snapRect: { x: 0.5, y: 0, width: 2, height: 1 },
        stage: 'snapped',
      }),
    )
    expect(wm.get('a')).toMatchObject({
      minSize: { width: 160, height: 100 },
      maxSize: null,
      restoreBounds: null,
      stage: 'snapped',
      snapRect: { x: 0.5, y: 0, width: 0.5, height: 1 },
      bounds: { x: 400, y: 0, width: 400, height: 600 },
    })
  })

  it('reassigns a non-finite opening sequence', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.hydrate(
      JSON.parse(
        '{"version":1,"windows":[{"id":"a","bounds":{"x":0,"y":0,"width":300,"height":200},"stage":"normal","layer":"normal","openedSeq":1e999}],"order":["a"],"focusedId":"a","workspace":0,"activeTabs":{}}',
      ),
    )
    const b = wm.open({ id: 'b' })
    const c = wm.open({ id: 'c' })
    expect(wm.get('a')?.openedSeq).toBe(1)
    expect([b.openedSeq, c.openedSeq]).toEqual([2, 3])
  })

  it('turns a window snapped to nothing into a normal one', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.hydrate(snapshot({ stage: 'snapped' }))
    expect(wm.get('a')?.stage).toBe('normal')
    expect(wm.move('a', 30, 30)).toBe(true)
  })

  it('still rejects data that is not a snapshot', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    expect(wm.hydrate(snapshot({ bounds: null }))).toBe(false)
    expect(wm.hydrate(snapshot({ layer: 'bogus' }))).toBe(false)
  })
})

describe('named layouts take what serialize and JSON take', () => {
  it('keeps cyclic meta, dates and infinite limits exactly as before', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    const cyclic: Record<string, unknown> = { n: 1 }
    cyclic.self = cyclic
    const at = new Date(0)
    wm.open({ id: 'a', meta: { cyclic, at } })
    wm.update('a', { maxSize: { width: Number.POSITIVE_INFINITY, height: 500 } })
    const saved = wm.saveLayout('x')
    expect(saved.windows[0]?.meta.at).toBe(at)
    const stored = wm.getLayout('x')?.windows[0]
    const copy = stored?.meta.cyclic as Record<string, unknown>
    expect(stored?.meta.at).toEqual(at)
    expect(copy.self).toBe(copy)
    expect(wm.loadLayout('x')).toBe(true)
    expect(wm.get('a')?.meta.at).toBeInstanceOf(Date)
    expect(wm.get('a')?.maxSize).toEqual({ width: Number.POSITIVE_INFINITY, height: 500 })
    const data = wm.serialize()
    ;(data.windows[0] as { maxSize: unknown }).maxSize = {
      width: Number.POSITIVE_INFINITY,
      height: 400,
    }
    expect(wm.setLayout('y', data)).toBe(true)
    expect(wm.getLayout('y')?.windows[0]?.maxSize).toEqual({
      width: Number.POSITIVE_INFINITY,
      height: 400,
    })
  })

  it('saves and loads a layout with a function in meta or in an extension', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a', meta: { onSave: () => {}, n: 1 } })
    wm.setExtension('plugin', { render: () => {}, size: 2 })
    expect(() => wm.saveLayout('x')).not.toThrow()
    expect(wm.getLayout('x')?.extensions).toEqual({ plugin: { size: 2 } })
    expect(wm.loadLayout('x')).toBe(true)
    expect(wm.get('a')?.meta).toEqual({ n: 1 })
    expect(wm.setLayout('y', wm.serialize())).toBe(true)
    expect(wm.getLayout('y')?.windows[0]?.meta).toEqual({ n: 1 })
  })

  it('loads a stored layout whose numbers turned into null', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    const data = snapshot({ bounds: { x: Number.NaN, y: 0, width: 300, height: 200 } })
    expect(wm.setLayout('x', data)).toBe(true)
    expect(wm.loadLayout('x')).toBe(true)
    expect(finite(wm.get('a')?.bounds)).toBe(true)
  })
})

describe('the key order of state.windows', () => {
  it('is the opening order after hydrate and loadLayout', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.open({ id: 'c' })
    wm.focus('a')
    wm.saveLayout('now')
    wm.loadLayout('now')
    expect(Object.keys(wm.getState().windows)).toEqual(['a', 'b', 'c'])
    const copy = createWindowManager({ viewport: VIEWPORT })
    copy.hydrate(wm.serialize())
    expect(Object.keys(copy.getState().windows)).toEqual(['a', 'b', 'c'])
  })
})
