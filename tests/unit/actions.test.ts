import { describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { createActions } from '../../src/dom/actions'

const VIEWPORT = { viewport: { width: 800, height: 600 } }

describe('window actions', () => {
  it('drives the manager and never throws on a window that is gone', () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    const act = createActions(wm, 'a')

    expect(act.minimize()).toBe(true)
    expect(wm.get('a')?.stage).toBe('minimized')
    expect(act.restore()).toBe(true)
    expect(act.snap('left')).toBe(true)
    expect(wm.get('a')?.snapZone).toBe('left')
    expect(act.moveToWorkspace(2)).toBe(true)
    expect(wm.get('a')?.workspace).toBe(2)
    expect(act.close()).toBe(true)

    const gone = createActions(wm, 'a')
    expect([
      gone.focus(),
      gone.close(),
      gone.minimize(),
      gone.maximize(),
      gone.toggleMaximize(),
      gone.restore(),
      gone.center(),
      gone.sendToBack(),
      gone.snap('left'),
      gone.moveToWorkspace(1),
    ]).toEqual(Array.from({ length: 10 }, () => false))
  })

  it('covers the rest of the surface against a live window', () => {
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    wm.open({ id: 'b', x: 40, y: 40, width: 200, height: 150 })
    const act = createActions(wm, 'a')

    expect(act.focus()).toBe(true)
    expect(wm.getState().focusedId).toBe('a')
    expect(act.maximize()).toBe(true)
    expect(wm.get('a')?.stage).toBe('maximized')
    expect(act.toggleMaximize()).toBe(true)
    expect(wm.get('a')?.stage).toBe('normal')
    expect(act.center()).toBe(true)
    expect(wm.get('a')?.bounds.x).toBe(300)
    expect(act.sendToBack()).toBe(true)
    expect(wm.getState().order[0]).toBe('a')
  })
})
