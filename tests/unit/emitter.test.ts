import { describe, expect, it, vi } from 'vitest'
import { createEmitter } from '../../src/core/emitter'

interface TestEvents {
  ping: { value: number }
  pong: { text: string }
}

describe('createEmitter', () => {
  it('delivers payloads to listeners', () => {
    const emitter = createEmitter<TestEvents>()
    const listener = vi.fn()
    emitter.on('ping', listener)
    emitter.emit('ping', { value: 1 })
    expect(listener).toHaveBeenCalledWith({ value: 1 })
  })

  it('supports multiple listeners on one event', () => {
    const emitter = createEmitter<TestEvents>()
    const first = vi.fn()
    const second = vi.fn()
    emitter.on('ping', first)
    emitter.on('ping', second)
    emitter.emit('ping', { value: 2 })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('does nothing when emitting without listeners', () => {
    const emitter = createEmitter<TestEvents>()
    expect(() => emitter.emit('pong', { text: 'quiet' })).not.toThrow()
  })

  it('stops delivering after unsubscribe', () => {
    const emitter = createEmitter<TestEvents>()
    const listener = vi.fn()
    const off = emitter.on('ping', listener)
    off()
    emitter.emit('ping', { value: 3 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('handles unsubscribe during emit without skipping others', () => {
    const emitter = createEmitter<TestEvents>()
    const calls: string[] = []
    const offFirst = emitter.on('ping', () => {
      calls.push('first')
      offFirst()
    })
    emitter.on('ping', () => calls.push('second'))
    emitter.emit('ping', { value: 4 })
    emitter.emit('ping', { value: 5 })
    expect(calls).toEqual(['first', 'second', 'second'])
  })

  it('clear removes every listener', () => {
    const emitter = createEmitter<TestEvents>()
    const listener = vi.fn()
    emitter.on('ping', listener)
    emitter.on('pong', listener)
    emitter.clear()
    emitter.emit('ping', { value: 6 })
    emitter.emit('pong', { text: 'gone' })
    expect(listener).not.toHaveBeenCalled()
  })
})
