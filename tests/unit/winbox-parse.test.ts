import { describe, expect, it } from 'vitest'
import { resolveLength, resolvePosition } from '../../src/plugins/winbox/parse'

describe('winbox lengths', () => {
  it('takes numbers, pixel strings and percentages of the area', () => {
    expect(resolveLength(120, 1000, 5)).toBe(120)
    expect(resolveLength('80px', 1000, 5)).toBe(80)
    expect(resolveLength('80', 1000, 5)).toBe(80)
    expect(resolveLength('50%', 800, 5)).toBe(400)
    expect(resolveLength(' 25% ', 800, 5)).toBe(200)
  })

  it('falls back on anything it cannot read', () => {
    expect(resolveLength(undefined, 1000, 5)).toBe(5)
    expect(resolveLength('', 1000, 5)).toBe(5)
    expect(resolveLength('wide', 1000, 5)).toBe(5)
    expect(resolveLength(Number.NaN, 1000, 5)).toBe(5)
  })
})

describe('winbox positions', () => {
  it('centres, pins to the far edge, or reads a length', () => {
    expect(resolvePosition('center', 200, 1000, 'right')).toBe(400)
    expect(resolvePosition('right', 200, 1000, 'right')).toBe(800)
    expect(resolvePosition('bottom', 100, 600, 'bottom')).toBe(500)
    expect(resolvePosition('10%', 200, 1000, 'right')).toBe(100)
    expect(resolvePosition(30, 200, 1000, 'right')).toBe(30)
  })

  it('centres by default and treats the other axis keyword as unknown', () => {
    expect(resolvePosition(undefined, 200, 1000, 'right')).toBe(400)
    expect(resolvePosition('bottom', 200, 1000, 'right')).toBe(400)
  })
})
