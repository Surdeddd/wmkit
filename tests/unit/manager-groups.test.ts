import { describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'

const VIEWPORT = { width: 1280, height: 800 }

function pair() {
  const wm = createWindowManager({ viewport: VIEWPORT })
  wm.open({ id: 'wide', x: 40, y: 40, width: 480, height: 320 })
  wm.open({ id: 'small', x: 80, y: 80, width: 280, height: 220, maxWidth: 300, maxHeight: 300 })
  wm.group(['wide', 'small'])
  return wm
}

function snappedPair() {
  const wm = pair()
  wm.snap('wide', 'left')
  wm.activateTab('small')
  return wm
}

describe('a tab group honours the limits of every member', () => {
  it('fits the frame into the maximum of a member when the group forms', () => {
    const wm = pair()
    expect(wm.get('small')?.bounds).toEqual({ x: 40, y: 40, width: 300, height: 300 })
    expect(wm.get('wide')?.bounds).toEqual(wm.get('small')?.bounds)
  })

  it('gives the same frame whichever member is resized', () => {
    const viaWide = pair()
    viaWide.resize('wide', { width: 900, height: 600 })
    const viaSmall = pair()
    viaSmall.resize('small', { width: 900, height: 600 })
    expect(viaWide.get('small')?.bounds.width).toBe(300)
    expect(viaSmall.get('wide')?.bounds).toEqual(viaWide.get('wide')?.bounds)
  })

  it('grows the frame to the largest minimum and keeps the smallest aspect ratio', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a', width: 300, height: 200, minWidth: 400 })
    wm.open({ id: 'b', width: 300, height: 200, aspectRatio: 3 })
    wm.open({ id: 'c', width: 300, height: 200, aspectRatio: 2 })
    wm.group(['a', 'b', 'c'])
    expect(wm.get('b')?.bounds).toMatchObject({ width: 400, height: 200 })
    wm.resize('a', { height: 400 })
    expect(wm.get('b')?.bounds).toMatchObject({ width: 800, height: 400 })
    wm.moveTab('c', 0)
    const copy = createWindowManager({ viewport: VIEWPORT })
    copy.hydrate(wm.serialize())
    expect(copy.get('b')?.bounds).toEqual(wm.get('b')?.bounds)
  })

  it('applies a changed limit of a member to the whole group', () => {
    const wm = pair()
    wm.update('wide', { maxSize: { width: 250, height: 250 } })
    expect(wm.get('small')?.bounds).toMatchObject({ width: 250, height: 250 })
  })

  it('puts a window that leaves the group back inside its own limits', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'square', x: 40, y: 40, width: 400, height: 400, aspectRatio: 1 })
    wm.open({ id: 'wide', width: 480, height: 240, aspectRatio: 2, maxHeight: 150 })
    wm.group(['square', 'wide'])
    expect(wm.get('wide')?.bounds).toMatchObject({ width: 150, height: 150 })
    wm.ungroup('wide')
    expect(wm.get('wide')).toMatchObject({ groupId: null, bounds: { width: 200, height: 100 } })
  })

  it('puts the last member back inside its own limits when the group dissolves', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'square', x: 40, y: 40, width: 200, height: 200, aspectRatio: 1 })
    wm.open({ id: 'wide', width: 480, height: 240, aspectRatio: 2 })
    wm.group(['square', 'wide'])
    expect(wm.get('wide')?.bounds).toMatchObject({ width: 200, height: 200 })
    wm.close('square')
    expect(wm.get('wide')).toMatchObject({ groupId: null, bounds: { width: 200, height: 100 } })
  })

  it('lets the frame grow again when the member that limited it leaves', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.open({ id: 'small', maxWidth: 300 })
    wm.group(['a', 'b', 'small'])
    wm.snap('a', 'left')
    expect(wm.get('b')?.bounds.width).toBe(300)
    wm.close('small')
    expect(wm.get('b')?.bounds).toEqual({ x: 0, y: 0, width: 640, height: 800 })
  })
})

describe('the frame of a snapped tab group is stable', () => {
  it('survives an unrelated undo', () => {
    const wm = snappedPair()
    wm.open({ id: 'other', x: 700, y: 100, width: 200, height: 150 })
    wm.move('other', 720, 120)
    const before = wm.get('small')
    wm.undo()
    expect(wm.get('other')?.bounds.x).toBe(700)
    expect(wm.get('small')).toEqual(before)
  })

  it('comes back to the same state after undo and redo', () => {
    const wm = snappedPair()
    wm.open({ id: 'other', x: 700, y: 100, width: 200, height: 150 })
    const before = JSON.stringify(wm.getState().windows)
    wm.undo()
    wm.redo()
    expect(JSON.stringify(wm.getState().windows)).toBe(before)
  })

  it('survives hydrate(serialize())', () => {
    const wm = snappedPair()
    const copy = createWindowManager({ viewport: VIEWPORT })
    copy.hydrate(JSON.parse(JSON.stringify(wm.serialize())))
    expect(copy.get('small')?.bounds).toEqual(wm.get('small')?.bounds)
    expect(copy.get('wide')?.bounds).toEqual({ x: 0, y: 0, width: 300, height: 300 })
  })

  it('moves by a pixel, not by hundreds, on a one pixel viewport change', () => {
    const wm = snappedPair()
    const before = wm.get('small')?.bounds.width as number
    wm.setViewport({ width: VIEWPORT.width, height: VIEWPORT.height - 1 })
    expect(Math.abs((wm.get('small')?.bounds.width as number) - before)).toBeLessThan(10)
  })

  it('holds for a group snapped to a rectangle, as a docked tab stack is', () => {
    const wm = pair()
    wm.snapTo('wide', { x: 0, y: 0, width: 0.5, height: 1 })
    wm.activateTab('small')
    const before = wm.get('small')?.bounds
    wm.open({ id: 'other', x: 700, y: 100, width: 200, height: 150 })
    wm.undo()
    expect(wm.get('small')?.bounds).toEqual(before)
  })
})

describe('bulk commands', () => {
  it('arrange leaves windows snapped to a rectangle where they are', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'docked' })
    wm.open({ id: 'max' })
    wm.open({ id: 'f', x: 900, y: 500 })
    wm.open({ id: 'g', x: 700, y: 300 })
    wm.snapTo('docked', { x: 0, y: 0, width: 0.5, height: 1 })
    wm.snapTo('max', { x: 0.5, y: 0, width: 0.5, height: 1 })
    wm.maximize('max')
    const docked = wm.get('docked')
    const max = wm.get('max')
    wm.arrange('tile')
    expect(wm.get('docked')).toBe(docked)
    expect(wm.get('max')).toBe(max)
    expect(wm.get('f')?.bounds).toEqual({ x: 0, y: 0, width: 640, height: 800 })
    expect(wm.get('g')?.bounds).toEqual({ x: 640, y: 0, width: 640, height: 800 })
    wm.arrange('cascade')
    expect(wm.get('docked')).toBe(docked)
  })

  it('arrange raises the arranged windows and focuses the last one', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a' })
    wm.open({ id: 'm' })
    wm.open({ id: 'b' })
    wm.open({ id: 'f', layer: 'floating' })
    wm.minimize('m')
    wm.focus('a')
    wm.arrange('cascade')
    expect(wm.getState().order).toEqual(['m', 'b', 'a', 'f'])
    expect(wm.getState().focusedId).toBe('f')
  })

  it('minimizeAll leaves windows that may not be minimized', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a' })
    wm.open({ id: 'pinned', minimizable: false })
    wm.minimizeAll()
    expect(wm.get('a')?.stage).toBe('minimized')
    expect(wm.get('pinned')?.stage).toBe('normal')
    expect(wm.getState().focusedId).toBe('pinned')
  })

  it('restoreAll restores in opening order and focuses the last one', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.open({ id: 'c' })
    wm.focus('a')
    wm.minimizeAll()
    wm.restoreAll()
    expect(wm.getState().order).toEqual(['a', 'b', 'c'])
    expect(wm.getState().focusedId).toBe('c')
    expect(wm.minimized()).toEqual([])
  })

  it('closeAll reports every window once and leaves an empty desktop', () => {
    const wm = createWindowManager({ viewport: VIEWPORT })
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.open({ id: 'c' })
    const group = wm.group(['a', 'b'])
    const seen: string[] = []
    wm.on('close', ({ window: win }) => seen.push(win.id))
    wm.on('group', ({ groupId, members }) => seen.push(`${groupId}:${members.length}`))
    wm.on('order', ({ order }) => seen.push(`order:${order.length}`))
    let changes = 0
    wm.subscribe(() => {
      changes += 1
    })
    wm.closeAll()
    expect(seen).toEqual(['a', 'b', 'c', 'order:0', `${group}:0`])
    expect(changes).toBe(1)
    expect(wm.getState()).toMatchObject({ windows: {}, order: [], focusedId: null, groups: {} })
    wm.undo()
    expect(wm.getState().order).toHaveLength(3)
    wm.redo()
    wm.closeAll()
    expect(changes).toBe(3)
  })

  it('costs linear time in the number of windows', () => {
    const make = (n: number) => {
      const wm = createWindowManager({ viewport: { width: 4000, height: 3000 }, historyLimit: 0 })
      wm.batch(() => {
        for (let i = 0; i < n; i += 1) wm.open({ id: `w${i}`, x: i % 500, y: i % 300 })
      })
      return wm
    }
    const time = (n: number, run: (wm: ReturnType<typeof make>) => void) => {
      let best = Number.POSITIVE_INFINITY
      for (let i = 0; i < 3; i += 1) {
        const wm = make(n)
        const start = performance.now()
        run(wm)
        best = Math.min(best, performance.now() - start)
      }
      return best
    }
    const runs: Record<string, (wm: ReturnType<typeof make>) => void> = {
      closeAll: (wm) => wm.closeAll(),
      arrange: (wm) => wm.arrange('cascade'),
      minimizeAll: (wm) => wm.minimizeAll(),
      restoreAll: (wm) => {
        wm.minimizeAll()
        wm.restoreAll()
      },
    }
    for (const [name, run] of Object.entries(runs)) {
      time(250, run)
      const ratio = time(2000, run) / Math.max(0.5, time(500, run))
      expect(ratio, name).toBeLessThan(8)
    }
  }, 30_000)
})
