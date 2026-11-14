import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { ENTRIES, surface } from './support/surface'

const root = fileURLToPath(new URL('../../', import.meta.url))

it('lists an entry for every export of the package', () => {
  const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as {
    exports: Record<string, unknown>
  }
  const published = Object.keys(pkg.exports).filter(
    (key) => key !== './package.json' && !key.includes('*'),
  )
  expect(Object.keys(ENTRIES).sort()).toEqual(published.sort())
})

it('exports exactly the recorded names from every entry point', () => {
  expect(surface()).toMatchSnapshot()
}, 120_000)
