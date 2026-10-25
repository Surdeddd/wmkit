export type Length = number | string

export function resolveLength(value: Length | undefined, total: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  if (!Number.isFinite(parsed)) return fallback
  return typeof value === 'string' && value.trim().endsWith('%') ? (total * parsed) / 100 : parsed
}

export function resolvePosition(
  value: Length | undefined,
  size: number,
  total: number,
  far: 'right' | 'bottom',
): number {
  if (value === far) return total - size
  return resolveLength(value === 'center' ? undefined : value, total, (total - size) / 2)
}
