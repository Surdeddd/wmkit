export interface StackingTarget {
  length: number
  zAt(index: number): number
  assign(index: number, z: number): void
}

export interface StackingOptions {
  base?: number
  gap?: number
}

export const UNASSIGNED = Number.NEGATIVE_INFINITY

let tails: Int32Array = new Int32Array(0)
let parents: Int32Array = new Int32Array(0)
let kept: Uint8Array = new Uint8Array(0)

function reserve(length: number): void {
  if (tails.length >= length) return
  const size = Math.max(length, 64)
  tails = new Int32Array(size)
  parents = new Int32Array(size)
  kept = new Uint8Array(size)
}

function markLongestIncreasing(target: StackingTarget): number {
  const length = target.length
  reserve(length)
  kept.fill(0, 0, length)
  let size = 0
  for (let i = 0; i < length; i += 1) {
    const value = target.zAt(i)
    parents[i] = -1
    if (!Number.isFinite(value)) continue
    let low = 0
    let high = size
    while (low < high) {
      const mid = (low + high) >> 1
      if (target.zAt(tails[mid] as number) < value) low = mid + 1
      else high = mid
    }
    if (low > 0) parents[i] = tails[low - 1] as number
    tails[low] = i
    if (low === size) size += 1
  }
  let cursor = size > 0 ? (tails[size - 1] as number) : -1
  let count = 0
  while (cursor !== -1) {
    kept[cursor] = 1
    count += 1
    cursor = parents[cursor] as number
  }
  return count
}

function between(low: number, high: number, base: number, gap: number): number | null {
  if (!Number.isFinite(high)) return Number.isFinite(low) ? low + gap : base + gap
  if (!Number.isFinite(low)) {
    const candidate = high - gap > base ? high - gap : Math.floor((base + high) / 2)
    return candidate > base && candidate < high ? candidate : null
  }
  const candidate = Math.floor((low + high) / 2)
  return candidate > low && candidate < high ? candidate : null
}

function renormalize(target: StackingTarget, base: number, gap: number): number {
  let writes = 0
  for (let i = 0; i < target.length; i += 1) {
    const z = base + (i + 1) * gap
    if (target.zAt(i) === z) continue
    target.assign(i, z)
    writes += 1
  }
  return writes
}

export function restack(target: StackingTarget, options: StackingOptions = {}): number {
  const base = options.base ?? 0
  const gap = options.gap ?? 32
  const length = target.length
  if (length === 0) return 0

  const keepCount = markLongestIncreasing(target)
  if (length - keepCount > length / 3) return renormalize(target, base, gap)

  let writes = 0
  for (let i = 0; i < length; i += 1) {
    if (kept[i] === 1) continue
    const low = i > 0 ? target.zAt(i - 1) : UNASSIGNED
    let high = Number.POSITIVE_INFINITY
    for (let j = i + 1; j < length; j += 1) {
      if (kept[j] !== 1) continue
      high = target.zAt(j)
      break
    }
    const z = between(low, high, base, gap)
    if (z === null) return renormalize(target, base, gap)
    target.assign(i, z)
    writes += 1
  }
  return writes
}
