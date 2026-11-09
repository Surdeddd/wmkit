import { readdirSync, readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const root = new URL('../../', import.meta.url).pathname

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
