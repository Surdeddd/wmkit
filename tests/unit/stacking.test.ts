import { describe, expect, it } from 'vitest'
import { restack, type StackingTarget, UNASSIGNED } from '../../src/dom/stacking'

function target(values: number[]): StackingTarget & { writes: number[]; values: number[] } {
  const state = {
    values: [...values],
    writes: [] as number[],
    get length() {
      return state.values.length
    },
    zAt: (index: number) => state.values[index] as number,
    assign(index: number, z: number) {
      state.values[index] = z
      state.writes.push(index)
    },
  }
  return state as StackingTarget & { writes: number[]; values: number[] }
}

function increasing(values: readonly number[]): boolean {
  return values.every((value, index) => index === 0 || value > (values[index - 1] as number))
}

describe('restack', () => {
  it('assigns a gapped ladder to a fresh stack', () => {
    const stack = target([UNASSIGNED, UNASSIGNED, UNASSIGNED])
    expect(restack(stack, { base: 0, gap: 32 })).toBe(3)
    expect(stack.values).toEqual([32, 64, 96])
  })

  it('honours the configured base and gap', () => {
    const stack = target([UNASSIGNED, UNASSIGNED])
    restack(stack, { base: 5000, gap: 10 })
    expect(stack.values).toEqual([5010, 5020])
  })

  it('writes nothing when the stack is already ordered', () => {
    const stack = target([32, 64, 96])
    expect(restack(stack)).toBe(0)
    expect(stack.writes).toEqual([])
  })

  it('moves a single window to the top with one write', () => {
    const stack = target([32, 64, 96, 128])
    const raised = stack.values.splice(1, 1)[0] as number
    stack.values.push(raised)

    expect(restack(stack, { base: 0, gap: 32 })).toBe(1)
    expect(stack.writes).toEqual([3])
    expect(increasing(stack.values)).toBe(true)
  })

  it('sends a single window to the back with one write', () => {
    const stack = target([32, 64, 96, 128])
    const sent = stack.values.splice(2, 1)[0] as number
    stack.values.unshift(sent)

    expect(restack(stack, { base: 0, gap: 32 })).toBe(1)
    expect(stack.writes).toEqual([0])
    expect(increasing(stack.values)).toBe(true)
    expect(stack.values[0]).toBeGreaterThan(0)
  })

  it('slots a window between two neighbours with one write', () => {
    const stack = target([32, 128, 64])
    expect(restack(stack, { base: 0, gap: 32 })).toBe(1)
    expect(increasing(stack.values)).toBe(true)
  })

  it('renormalizes when a gap runs out of room', () => {
    const stack = target([10, 11, 12, 13, 10.5])
    stack.values = [10, 11, 12, 10.5, 13]
    restack(stack, { base: 0, gap: 32 })
    expect(stack.values).toEqual([32, 64, 96, 128, 160])
  })

  it('renormalizes when most of the stack moved', () => {
    const stack = target([128, 96, 64, 32])
    expect(restack(stack, { base: 0, gap: 32 })).toBeGreaterThan(1)
    expect(stack.values).toEqual([32, 64, 96, 128])
  })

  it('never assigns a z below the base when prepending', () => {
    const stack = target([UNASSIGNED, 8])
    restack(stack, { base: 0, gap: 32 })
    expect(increasing(stack.values)).toBe(true)
    expect(stack.values[0]).toBeGreaterThan(0)
  })

  it('is a no-op for an empty stack', () => {
    expect(restack(target([]))).toBe(0)
  })

  it('keeps the order valid through a long shuffle', () => {
    const size = 60
    const stack = target(Array.from({ length: size }, () => UNASSIGNED))
    restack(stack, { base: 0, gap: 32 })
    let seed = 7
    for (let step = 0; step < 300; step += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      const from = seed % size
      seed = (seed * 1103515245 + 12345) % 2147483648
      const to = seed % size
      const moved = stack.values.splice(from, 1)[0] as number
      stack.values.splice(to, 0, moved)
      restack(stack, { base: 0, gap: 32 })
      expect(increasing(stack.values)).toBe(true)
      expect(stack.values.every((value) => value > 0)).toBe(true)
    }
  })
})
