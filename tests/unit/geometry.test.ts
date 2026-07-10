import { describe, expect, it } from 'vitest'
import {
  boundsEqual,
  clamp,
  clampSize,
  clampToViewport,
  detectSnapZone,
  zoneBounds,
} from '../../src/core/geometry'
import type { SnapZone } from '../../src/core/types'

const viewport = { width: 1000, height: 800 }

describe('clamp', () => {
  it('clamps below, inside and above the range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('clampSize', () => {
  it('enforces minimum size', () => {
    expect(clampSize({ width: 10, height: 10 }, { width: 100, height: 50 }, null)).toEqual({
      width: 100,
      height: 50,
    })
  })

  it('enforces maximum size when provided', () => {
    expect(
      clampSize(
        { width: 900, height: 900 },
        { width: 100, height: 50 },
        { width: 400, height: 300 },
      ),
    ).toEqual({ width: 400, height: 300 })
  })

  it('keeps size unbounded without max', () => {
    expect(clampSize({ width: 9000, height: 9000 }, { width: 100, height: 50 }, null)).toEqual({
      width: 9000,
      height: 9000,
    })
  })
})

describe('clampToViewport', () => {
  it('returns bounds untouched for a zero viewport', () => {
    const bounds = { x: -500, y: -500, width: 200, height: 100 }
    expect(clampToViewport(bounds, { width: 0, height: 0 }, 48)).toBe(bounds)
  })

  it('keeps at least minVisible pixels inside horizontally', () => {
    const clamped = clampToViewport({ x: -400, y: 100, width: 200, height: 100 }, viewport, 48)
    expect(clamped.x).toBe(48 - 200)
    const right = clampToViewport({ x: 2000, y: 100, width: 200, height: 100 }, viewport, 48)
    expect(right.x).toBe(1000 - 48)
  })

  it('never lets the top edge leave the viewport', () => {
    expect(clampToViewport({ x: 10, y: -50, width: 200, height: 100 }, viewport, 48).y).toBe(0)
    expect(clampToViewport({ x: 10, y: 3000, width: 200, height: 100 }, viewport, 48).y).toBe(
      800 - 48,
    )
  })

  it('returns the same object when nothing changes', () => {
    const bounds = { x: 100, y: 100, width: 200, height: 100 }
    expect(clampToViewport(bounds, viewport, 48)).toBe(bounds)
  })
})

describe('boundsEqual', () => {
  it('compares all four fields', () => {
    const a = { x: 1, y: 2, width: 3, height: 4 }
    expect(boundsEqual(a, { ...a })).toBe(true)
    expect(boundsEqual(a, { ...a, x: 9 })).toBe(false)
    expect(boundsEqual(a, { ...a, y: 9 })).toBe(false)
    expect(boundsEqual(a, { ...a, width: 9 })).toBe(false)
    expect(boundsEqual(a, { ...a, height: 9 })).toBe(false)
  })
})

describe('zoneBounds', () => {
  it.each<[SnapZone, { x: number; y: number; width: number; height: number }]>([
    ['left', { x: 0, y: 0, width: 500, height: 800 }],
    ['right', { x: 500, y: 0, width: 500, height: 800 }],
    ['top', { x: 0, y: 0, width: 1000, height: 400 }],
    ['bottom', { x: 0, y: 400, width: 1000, height: 400 }],
    ['top-left', { x: 0, y: 0, width: 500, height: 400 }],
    ['top-right', { x: 500, y: 0, width: 500, height: 400 }],
    ['bottom-left', { x: 0, y: 400, width: 500, height: 400 }],
    ['bottom-right', { x: 500, y: 400, width: 500, height: 400 }],
  ])('computes %s', (zone, expected) => {
    expect(zoneBounds(zone, viewport)).toEqual(expected)
  })

  it('rounds odd viewports without gaps', () => {
    const odd = { width: 1001, height: 801 }
    const left = zoneBounds('left', odd)
    const right = zoneBounds('right', odd)
    expect(left.width + right.width).toBe(1001)
    const top = zoneBounds('top', odd)
    const bottom = zoneBounds('bottom', odd)
    expect(top.height + bottom.height).toBe(801)
  })
})

describe('detectSnapZone', () => {
  it('returns null away from the edges', () => {
    expect(detectSnapZone(500, 400, viewport)).toBeNull()
  })

  it('returns null for a zero viewport', () => {
    expect(detectSnapZone(0, 0, { width: 0, height: 0 })).toBeNull()
  })

  it('detects side halves', () => {
    expect(detectSnapZone(5, 400, viewport)).toBe('left')
    expect(detectSnapZone(995, 400, viewport)).toBe('right')
  })

  it('detects corners near side edges', () => {
    expect(detectSnapZone(5, 10, viewport)).toBe('top-left')
    expect(detectSnapZone(5, 790, viewport)).toBe('bottom-left')
    expect(detectSnapZone(995, 10, viewport)).toBe('top-right')
    expect(detectSnapZone(995, 790, viewport)).toBe('bottom-right')
  })

  it('detects top and bottom edges with their corners', () => {
    expect(detectSnapZone(500, 5, viewport)).toBe('top')
    expect(detectSnapZone(10, 5, viewport)).toBe('top-left')
    expect(detectSnapZone(990, 5, viewport)).toBe('top-right')
    expect(detectSnapZone(500, 795, viewport)).toBe('bottom')
    expect(detectSnapZone(10, 795, viewport)).toBe('bottom-left')
    expect(detectSnapZone(990, 795, viewport)).toBe('bottom-right')
  })

  it('detects top and bottom corners away from the side edges', () => {
    expect(detectSnapZone(30, 5, viewport)).toBe('top-left')
    expect(detectSnapZone(970, 5, viewport)).toBe('top-right')
    expect(detectSnapZone(30, 795, viewport)).toBe('bottom-left')
    expect(detectSnapZone(970, 795, viewport)).toBe('bottom-right')
  })

  it('honours custom threshold and corner size', () => {
    expect(detectSnapZone(30, 400, viewport, { threshold: 40 })).toBe('left')
    expect(detectSnapZone(5, 100, viewport, { cornerSize: 200 })).toBe('top-left')
  })
})
