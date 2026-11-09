import { describe, expect, it } from 'vitest'

describe('the web components on a server', () => {
  it('import without a DOM, define nothing and build plain objects', async () => {
    expect(typeof globalThis.HTMLElement).toBe('undefined')
    const elements = await import('../../src/plugins/elements')
    await import('../../src/plugins/elements/define')
    expect(() => elements.defineWmElements({ prefix: 'ssr' })).not.toThrow()
    expect('customElements' in globalThis).toBe(false)
    expect('document' in globalThis).toBe(false)
    expect(new elements.WmDesktopElement().manager).toBeNull()
    expect(new elements.WmWindowElement().windowId).toBeNull()
  })
})
