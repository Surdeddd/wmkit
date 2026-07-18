import type { Bounds, Size, SnapZone } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function clampSize(size: Size, min: Size, max: Size | null): Size {
  return {
    width: clamp(size.width, min.width, max ? max.width : Number.POSITIVE_INFINITY),
    height: clamp(size.height, min.height, max ? max.height : Number.POSITIVE_INFINITY),
  }
}

export function clampToViewport(bounds: Bounds, viewport: Size, minVisible: number): Bounds {
  if (viewport.width <= 0 || viewport.height <= 0) return bounds
  const x = clamp(bounds.x, minVisible - bounds.width, viewport.width - minVisible)
  const y = clamp(bounds.y, 0, Math.max(0, viewport.height - minVisible))
  return x === bounds.x && y === bounds.y ? bounds : { ...bounds, x, y }
}

export function boundsEqual(a: Bounds, b: Bounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export function zoneBounds(zone: SnapZone, viewport: Size): Bounds {
  const w = viewport.width
  const h = viewport.height
  const halfW = Math.round(w / 2)
  const halfH = Math.round(h / 2)
  switch (zone) {
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

function nearestEdge(low: number, high: number, targetLow: number, targetHigh: number): number[] {
  return [targetLow - low, targetHigh - low, targetLow - high, targetHigh - high]
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
    for (const delta of nearestEdge(
      bounds.x,
      bounds.x + bounds.width,
      target.x,
      target.x + target.width,
    )) {
      if (Math.abs(delta) <= threshold && Math.abs(delta) < Math.abs(bestX)) bestX = delta
    }
    for (const delta of nearestEdge(
      bounds.y,
      bounds.y + bounds.height,
      target.y,
      target.y + target.height,
    )) {
      if (Math.abs(delta) <= threshold && Math.abs(delta) < Math.abs(bestY)) bestY = delta
    }
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
