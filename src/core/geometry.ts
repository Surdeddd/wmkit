import type { Bounds, Size, SnapZone } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function atLeastOne(limit: Size): Size {
  return { width: Math.max(1, limit.width), height: Math.max(1, limit.height) }
}

const NONE: Size = { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY }

export function clampSize(size: Size, min: Size, max: Size | null): Size {
  const low = atLeastOne(min)
  const high = max ? atLeastOne(max) : NONE
  return {
    width: clamp(size.width, low.width, high.width),
    height: clamp(size.height, low.height, high.height),
  }
}

export function clampToViewport(bounds: Bounds, viewport: Size, minVisible: number): Bounds {
  if (viewport.width <= 0 || viewport.height <= 0) return bounds
  const visibleX = Math.min(minVisible, bounds.width)
  const visibleY = Math.min(minVisible, bounds.height)
  const x = clamp(bounds.x, visibleX - bounds.width, Math.max(0, viewport.width - visibleX))
  const y = clamp(bounds.y, 0, Math.max(0, viewport.height - visibleY))
  return x === bounds.x && y === bounds.y ? bounds : { ...bounds, x, y }
}

export function boundsEqual(a: Bounds, b: Bounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export function applyAspect(
  size: Size,
  ratio: number,
  min: Size,
  max: Size | null,
  drive: 'width' | 'height',
): Size {
  const plain = clampSize(size, min, max)
  if (!Number.isFinite(ratio) || ratio <= 0) return plain
  const low = atLeastOne(min)
  const high = max ? atLeastOne(max) : NONE
  let fitted: Size
  if (drive === 'height') {
    const height = clamp(
      size.height,
      Math.max(low.height, low.width / ratio),
      Math.min(high.height, high.width / ratio),
    )
    fitted = { width: height * ratio, height }
  } else {
    const width = clamp(
      size.width,
      Math.max(low.width, low.height * ratio),
      Math.min(high.width, high.height * ratio),
    )
    fitted = { width, height: width / ratio }
  }
  const whole = fitted.width >= 1 && fitted.height >= 1
  return whole && Number.isFinite(fitted.width + fitted.height) ? fitted : plain
}

export function zoneBounds(zone: SnapZone, viewport: Size): Bounds {
  const w = viewport.width
  const h = viewport.height
  const halfW = Math.round(w / 2)
  const halfH = Math.round(h / 2)
  const oneThird = Math.round(w / 3)
  const twoThirds = Math.round((w * 2) / 3)
  switch (zone) {
    case 'left-third':
      return { x: 0, y: 0, width: oneThird, height: h }
    case 'center-third':
      return { x: oneThird, y: 0, width: twoThirds - oneThird, height: h }
    case 'right-third':
      return { x: twoThirds, y: 0, width: w - twoThirds, height: h }
    case 'left':
      return { x: 0, y: 0, width: halfW, height: h }
    case 'right':
      return { x: halfW, y: 0, width: w - halfW, height: h }
    case 'top':
      return { x: 0, y: 0, width: w, height: halfH }
    case 'bottom':
      return { x: 0, y: halfH, width: w, height: h - halfH }
    case 'top-left':
      return { x: 0, y: 0, width: halfW, height: halfH }
    case 'top-right':
      return { x: halfW, y: 0, width: w - halfW, height: halfH }
    case 'bottom-left':
      return { x: 0, y: halfH, width: halfW, height: h - halfH }
    case 'bottom-right':
      return { x: halfW, y: halfH, width: w - halfW, height: h - halfH }
  }
}

export interface SnapDetectOptions {
  threshold?: number
  cornerSize?: number
}

export function detectSnapZone(
  x: number,
  y: number,
  viewport: Size,
  options: SnapDetectOptions = {},
): SnapZone | null {
  const threshold = options.threshold ?? 12
  const cornerSize = options.cornerSize ?? 64
  const w = viewport.width
  const h = viewport.height
  if (w <= 0 || h <= 0) return null

  const nearLeft = x <= threshold
  const nearRight = x >= w - threshold
  const nearTop = y <= threshold
  const nearBottom = y >= h - threshold

  if (nearLeft || nearRight) {
    const side = nearLeft ? 'left' : 'right'
    if (y <= cornerSize) return `top-${side}` as SnapZone
    if (y >= h - cornerSize) return `bottom-${side}` as SnapZone
    return side
  }
  if (nearTop) {
    if (x <= cornerSize) return 'top-left'
    if (x >= w - cornerSize) return 'top-right'
    return 'top'
  }
  if (nearBottom) {
    if (x <= cornerSize) return 'bottom-left'
    if (x >= w - cornerSize) return 'bottom-right'
    return 'bottom'
  }
  return null
}

export interface MagnetResult {
  x: number
  y: number
  snappedX: boolean
  snappedY: boolean
}

function closer(best: number, delta: number, threshold: number): number {
  return Math.abs(delta) <= threshold && Math.abs(delta) < Math.abs(best) ? delta : best
}

function nearestEdge(
  best: number,
  low: number,
  high: number,
  targetLow: number,
  targetHigh: number,
  threshold: number,
): number {
  best = closer(best, targetLow - low, threshold)
  best = closer(best, targetHigh - low, threshold)
  best = closer(best, targetLow - high, threshold)
  return closer(best, targetHigh - high, threshold)
}

export function magnetize(
  bounds: Bounds,
  targets: readonly Bounds[],
  threshold: number,
): MagnetResult {
  const result: MagnetResult = { x: bounds.x, y: bounds.y, snappedX: false, snappedY: false }
  if (threshold <= 0 || targets.length === 0) return result
  let bestX = threshold + 1
  let bestY = threshold + 1
  for (const target of targets) {
    bestX = nearestEdge(
      bestX,
      bounds.x,
      bounds.x + bounds.width,
      target.x,
      target.x + target.width,
      threshold,
    )
    bestY = nearestEdge(
      bestY,
      bounds.y,
      bounds.y + bounds.height,
      target.y,
      target.y + target.height,
      threshold,
    )
  }
  if (Math.abs(bestX) <= threshold) {
    result.x = bounds.x + bestX
    result.snappedX = true
  }
  if (Math.abs(bestY) <= threshold) {
    result.y = bounds.y + bestY
    result.snappedY = true
  }
  return result
}
