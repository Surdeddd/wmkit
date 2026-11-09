import { readdirSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { landingPages } from '../../site/landing-plugin'
import { themeNames, themeShadowCss } from '../../src/themes/index'

const root = new URL('../../', import.meta.url).pathname

function loadVirtual(id: string): unknown {
  const plugin = landingPages()
  const resolve = plugin.resolveId as (this: unknown, source: string) => unknown
  const load = plugin.load as (this: unknown, id: string) => unknown
  const resolved = resolve.call(null, id)
  return typeof resolved === 'string' ? load.call(null, resolved) : null
}

async function pagesBuilt(e2e: string): Promise<string[]> {
  vi.resetModules()
  vi.stubEnv('WMKIT_E2E', e2e)
  const { default: config } = await import('../../site/vite.config')
  const input = config.build?.rollupOptions?.input
  return typeof input === 'object' && !Array.isArray(input) ? Object.keys(input).sort() : []
}

const testPages = readdirSync(`${root}site/test`)
  .filter((file) => file.endsWith('.html'))
  .map((file) => file.slice(0, -5))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the pages the site build publishes', () => {
  it('leaves out every page that only the end-to-end tests need', async () => {
    const built = await pagesBuilt('')
    expect(built).toContain('main')
    for (const name of testPages) expect(built, name).not.toContain(name)
  })

  it('builds the end-to-end pages when WMKIT_E2E=1 asks for them', async () => {
    const built = await pagesBuilt('1')
    for (const name of testPages) expect(built, name).toContain(name)
  })

  it('asks for them in the server the end-to-end tests start', () => {
    const playwright = readFileSync(`${root}playwright.config.ts`, 'utf8')
    expect(playwright).toMatch(/command: `WMKIT_E2E=1 pnpm site:build && /)
  })
})

describe('the themes the landing ships', () => {
  it('keeps every theme string out of the landing script', () => {
    const main = readFileSync(`${root}site/src/main.ts`, 'utf8')
    expect(main).not.toMatch(/from '@surdeddd\/wmkit\/themes'/)
    expect(main).toMatch(/from 'virtual:wmkit-shadow-themes'/)
  })

  it('loads the shadow flavour of each theme as a module of its own', () => {
    const index = String(loadVirtual('virtual:wmkit-shadow-themes'))
    for (const name of themeNames) {
      expect(index).toContain(`${name}: () => import('virtual:wmkit-shadow-themes/${name}')`)
      expect(loadVirtual(`virtual:wmkit-shadow-themes/${name}`)).toBe(
        `export default ${JSON.stringify(themeShadowCss[name])}\n`,
      )
    }
    expect(() => loadVirtual('virtual:wmkit-shadow-themes/nope')).toThrow(/no theme/)
  })
})
