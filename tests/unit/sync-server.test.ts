import { describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'

describe('sync where a page has neither a window nor a storage', () => {
  it('imports, speaks to nobody and breaks nothing', async () => {
    expect(typeof document).toBe('undefined')
    const { sync } = await import('../../src/plugins/sync')
    const wm = createWindowManager()
    const link = sync(wm, { channel: 'server', wait: 1 })
    wm.open({ id: 'a' })
    expect(await link.ready).toBe(false)
    link.destroy()
    expect(wm.get('a')).toBeDefined()
  })
})
