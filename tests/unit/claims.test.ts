import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = new URL('../../', import.meta.url).pathname
const read = (file: string) => readFileSync(`${root}${file}`, 'utf8')

function budgetKb(): number {
  const pkg = JSON.parse(read('package.json')) as {
    'size-limit': Array<{ name: string; limit: string }>
  }
  const core = pkg['size-limit'].find((entry) => entry.name === 'core')
  return Number(/(\d+(?:\.\d+)?)/.exec(core?.limit ?? '')?.[1])
}

function ownClaims(): Array<{ where: string; size: number }> {
  const i18n = read('site/src/i18n.ts')
  const html = read('site/index.html')
  const found: Array<{ where: string; size: number }> = []

  for (const match of i18n.matchAll(/'<\s*(\d+(?:\.\d+)?)\s*(?:kB|кБ)'/g)) {
    found.push({ where: 'i18n badge', size: Number(match[1]) })
  }
  for (const match of i18n.matchAll(/(?:core under|ядро меньше)\s*(\d+(?:\.\d+)?)\s*(?:kB|кБ)/g)) {
    found.push({ where: 'i18n description', size: Number(match[1]) })
  }
  for (const match of html.matchAll(/core under\s*(\d+(?:\.\d+)?)\s*kB/g)) {
    found.push({ where: 'index.html description', size: Number(match[1]) })
  }
  for (const match of i18n.matchAll(/cells: \[\s*\{ text: '~(\d+(?:\.\d+)?)\s*(?:kB|кБ)'/g)) {
    found.push({ where: 'comparison row', size: Number(match[1]) })
  }
  return found
}

describe('the numbers the project advertises', () => {
  it('never promises a core smaller than the size budget', () => {
    const budget = budgetKb()
    expect(budget).toBeGreaterThan(0)

    const claims = ownClaims()
    expect(claims.length, 'no size claim was found to check').toBeGreaterThanOrEqual(6)
    expect(
      claims.filter((claim) => claim.where === 'comparison row').length,
      'both languages carry a comparison row',
    ).toBe(2)
    for (const claim of claims) {
      expect(
        claim.size,
        `${claim.where} advertises ${claim.size} kB against a ${budget} kB budget`,
      ).toBeGreaterThanOrEqual(budget - 1)
    }
  })

  it('keeps both languages offering the same features', () => {
    const i18n = read('site/src/i18n.ts')
    const blocks = [...i18n.matchAll(/features: \[([\s\S]*?)\n {2}\],/g)].map(
      (match) => (match[1] as string).match(/title: '/g)?.length ?? 0,
    )
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toBe(blocks[1])

    const shortcuts = [...i18n.matchAll(/shortcuts: \[([\s\S]*?)\n {2}\],/g)].map(
      (match) => (match[1] as string).match(/\n {4}\[/g)?.length ?? 0,
    )
    expect(shortcuts).toHaveLength(2)
    expect(shortcuts[0]).toBe(shortcuts[1])
  })

  it('quotes the same sizes in both READMEs and the recipes', () => {
    const sizes = (file: string, unit: string) =>
      [...read(file).matchAll(new RegExp(`(\\d+(?:\\.\\d+)?) ${unit}`, 'g'))].map(
        (match) => match[1] as string,
      )
    const english = sizes('README.md', 'kB')
    expect(english.length).toBeGreaterThanOrEqual(3)
    expect(sizes('README.ru.md', 'кБ')).toEqual(english)
    const gestures = /gestures`\s+costs (\d+(?:\.\d+)?) kB/.exec(read('docs/recipes.md'))?.[1]
    expect(english).toContain(gestures)
  })

  it('ships every theme the demo lets you pick', () => {
    const main = read('site/src/main.ts')
    for (const theme of ['glass', 'light', 'retro']) {
      expect(main).toContain(`themes/${theme}.css`)
      expect(() => read(`src/themes/${theme}.css`)).not.toThrow()
    }
  })
})
