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
