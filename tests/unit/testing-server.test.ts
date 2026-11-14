import { describe, expect, it } from 'vitest'

describe('the testing helpers on a server', () => {
  it('import where there is no document and wait to be called', async () => {
    expect(typeof document).toBe('undefined')
    const testing = await import('../../src/testing')
    expect(Object.keys(testing).sort()).toEqual([
      'drag',
      'pointer',
      'press',
      'resize',
      'stubFrames',
      'stubPointerCapture',
    ])
  })
})
