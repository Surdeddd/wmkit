import { describe, expect, it } from 'vitest'

describe('the switcher on a server', () => {
  it('imports where there is no document', async () => {
    expect(typeof document).toBe('undefined')
    const switcher = await import('../../src/plugins/switcher')
    expect(typeof switcher.createSwitcher).toBe('function')
    expect(switcher.switcherMessages.overview).toBe('All windows')
  })
})
