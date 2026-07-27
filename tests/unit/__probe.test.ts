import { describe, expect, it } from 'vitest'
import { applyAspect, zoneBounds } from '../../src/core/geometry'
import { createWindowManager } from '../../src/core/manager'

const V = { width: 1200, height: 800 }

describe('probe', () => {
  it('A: snap aspect window to bottom', () => {
    const wm = createWindowManager({ viewport: V })
    const w = wm.open({ id: 'a', width: 400, height: 400, aspectRatio: 1 })
    console.log('open', w.bounds)
    wm.snap('a', 'bottom')
    console.log('snap bottom', wm.get('a')?.bounds)
    wm.snap('a', 'top')
    console.log('snap top', wm.get('a')?.bounds)
    wm.snap('a', 'bottom-right')
    console.log('snap bottom-right', wm.get('a')?.bounds)
    wm.snap('a', 'right')
    console.log('snap right', wm.get('a')?.bounds)
  })

  it('B: snap with minSize larger than zone', () => {
    const wm = createWindowManager({ viewport: { width: 400, height: 800 } })
    wm.open({ id: 'a', minWidth: 300, width: 300, height: 200 })
    wm.snap('a', 'right')
    console.log(
      'right zone',
      zoneBounds('right', { width: 400, height: 800 }),
      'bounds',
      wm.get('a')?.bounds,
    )
    wm.snap('a', 'right-third')
    console.log('right-third bounds', wm.get('a')?.bounds)
  })

  it('C: open with only height + aspect', () => {
    const wm = createWindowManager({ viewport: V })
    const w = wm.open({ id: 'a', height: 300, aspectRatio: 2 })
    console.log('open height-only', w.bounds)
    const w2 = wm.open({ id: 'b', width: 600, aspectRatio: 2 })
    console.log('open width-only', w2.bounds)
  })

  it('D: update aspect on maximized window', () => {
    const wm = createWindowManager({ viewport: V })
    wm.open({ id: 'a', width: 400, height: 300 })
    wm.maximize('a')
    console.log('maximized', wm.get('a')?.bounds, wm.get('a')?.stage)
    wm.update('a', { aspectRatio: 1 })
    console.log('after update aspect', wm.get('a')?.bounds, wm.get('a')?.stage)
    wm.restore('a')
    console.log('after restore', wm.get('a')?.bounds)
  })

  it('E: update aspect on snapped window', () => {
    const wm = createWindowManager({ viewport: V })
    wm.open({ id: 'a', width: 400, height: 300 })
    wm.snap('a', 'left')
    console.log('snapped', wm.get('a')?.bounds)
    wm.update('a', { aspectRatio: 1 })
    console.log(
      'after update aspect',
      wm.get('a')?.bounds,
      wm.get('a')?.stage,
      wm.get('a')?.snapZone,
    )
  })

  it('F: infeasible min/max with ratio', () => {
    console.log(
      applyAspect(
        { width: 300, height: 300 },
        2,
        { width: 400, height: 100 },
        { width: 500, height: 100 },
        'width',
      ),
    )
    console.log(
      applyAspect(
        { width: 300, height: 300 },
        2,
        { width: 400, height: 100 },
        { width: 500, height: 100 },
        'height',
      ),
    )
  })

  it('G: thirds on tiny viewport', () => {
    for (const w of [1, 2, 3, 4, 5, 7, 100]) {
      const vp = { width: w, height: 10 }
      console.log(
        w,
        JSON.stringify([
          zoneBounds('left-third', vp),
          zoneBounds('center-third', vp),
          zoneBounds('right-third', vp),
        ]),
      )
    }
  })
})
