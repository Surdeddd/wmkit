import { describe, expect, it } from 'vitest'

describe('the layouts on a server', () => {
  it('import where there is no document and keep their numbers', async () => {
    expect(typeof document).toBe('undefined')
    const layouts = await import('../../src/plugins/layouts')
    expect(layouts.snapLayouts.halves).toHaveLength(2)
    expect(layouts.layoutMessages.cell(2, 1, 3)).toBe('Layout 2, area 1 of 3')
  })
})
