import { bench, describe } from 'vitest'
import { magnetize } from '../../src/core/geometry'
import { createWindowManager } from '../../src/core/manager'
import type { Bounds } from '../../src/core/types'

const VIEWPORT = { viewport: { width: 1920, height: 1080 } }

describe('manager throughput', () => {
  bench('open 1000 windows', () => {
    const wm = createWindowManager({ ...VIEWPORT, historyLimit: 0 })
    for (let i = 0; i < 1000; i += 1) wm.open({ width: 300, height: 200 })
  })

  bench('move one window 5000 times among 50', () => {
    const wm = createWindowManager({ ...VIEWPORT, historyLimit: 0 })
    for (let i = 0; i < 50; i += 1) wm.open({ id: `w${i}`, width: 240, height: 160 })
    for (let i = 0; i < 5000; i += 1) wm.move('w25', 100 + (i % 500), 100 + (i % 300))
  })

  bench('serialize + hydrate 100 windows', () => {
    const wm = createWindowManager(VIEWPORT)
    for (let i = 0; i < 100; i += 1) wm.open({ width: 300, height: 200 })
    const data = wm.serialize()
    const target = createWindowManager(VIEWPORT)
    target.hydrate(data)
  })

  bench('undo/redo cycle over 100 moves', () => {
    const wm = createWindowManager({ ...VIEWPORT, historyLimit: 100 })
    wm.open({ id: 'w', width: 300, height: 200 })
    for (let i = 0; i < 100; i += 1) wm.move('w', 10 + i, 10 + i)
    while (wm.undo()) {}
    while (wm.redo()) {}
  })
})

describe('geometry throughput', () => {
  const targets: Bounds[] = Array.from({ length: 50 }, (_, i) => ({
    x: (i % 10) * 190,
    y: Math.floor(i / 10) * 210,
    width: 180,
    height: 200,
  }))

  bench('magnetize against 50 targets x 10000', () => {
    for (let i = 0; i < 10000; i += 1) {
      magnetize({ x: 400 + (i % 37), y: 300 + (i % 29), width: 320, height: 240 }, targets, 8)
    }
  })
})
