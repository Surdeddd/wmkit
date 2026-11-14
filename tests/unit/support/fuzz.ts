import fc from 'fast-check'

export interface FuzzBudget {
  numRuns: number
  seed: number
}

function positive(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

export function seedCount(base: number): number {
  return positive(process.env.WMKIT_FUZZ) ?? base
}

export function fuzz(base: number): FuzzBudget {
  const long = positive(process.env.WMKIT_FUZZ)
  const pinned = positive(process.env.WMKIT_FUZZ_SEED)
  return {
    numRuns: long ?? base,
    seed: pinned ?? (long === null ? 1 : Date.now() % 2147483647),
  }
}

export function breathe(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

export const junkNumber: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0,
    0,
    -1,
    0.5,
    1e21,
    -1e21,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_VALUE,
    Number.MIN_VALUE,
  ),
  fc.double(),
  fc.integer(),
)

export const junkString: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(
    '',
    ' ',
    '__proto__',
    'constructor',
    'prototype',
    'toString',
    'valueOf',
    'hasOwnProperty',
    '0',
    '42',
    '-1',
    '1e3',
    'a b',
    'a"b',
    "a'b",
    'a]b',
    '<b>x</b>',
    '\u0000',
    'é',
    '😀',
  ),
  fc.string(),
)

export const junkValue: fc.Arbitrary<unknown> = fc.oneof(
  junkNumber,
  junkString,
  fc.constantFrom<unknown>(null, undefined, true, false, [], {}, () => {}),
  fc.anything(),
)
