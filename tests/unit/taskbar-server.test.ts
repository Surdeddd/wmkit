import { describe, expect, it } from 'vitest'

describe('the taskbar on a server', () => {
  it('imports and defines nothing where there is no document', async () => {
    expect(typeof document).toBe('undefined')
    const taskbar = await import('../../src/plugins/taskbar')
    await import('../../src/plugins/taskbar/define')
    expect(() => taskbar.defineWmTaskbar({ prefix: 'ssr' })).not.toThrow()
    expect(taskbar.taskbarMessages.tabs('Notes', 3)).toBe('Notes, 3 tabs')
  })
})
