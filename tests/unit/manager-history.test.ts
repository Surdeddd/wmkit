import { describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { ManagerEvents, WindowManager } from '../../src/core/types'

const VIEWPORT = { width: 800, height: 600 }

function makeWm(historyLimit?: number) {
  return createWindowManager({ viewport: VIEWPORT, historyLimit })
}

function record(wm: WindowManager, names: (keyof ManagerEvents)[]): string[] {
  const seen: string[] = []
  for (const name of names) {
    wm.on(name, (payload) => {
      const p = payload as { window?: { id: string; stage: string }; previous?: unknown }
      if (name === 'stage') seen.push(`stage:${p.window?.id}:${p.previous}->${p.window?.stage}`)
      else seen.push(p.window ? `${name}:${p.window.id}` : name)
    })
  }
  return seen
}

describe('focus changes share one history entry', () => {
  it('keeps a move in a short history however often the focus changes after it', () => {
    const wm = makeWm(5)
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    wm.open({ id: 'b', x: 0, y: 0, width: 200, height: 150 })
    wm.clearHistory()
    wm.move('a', 300, 300)
    for (let i = 0; i < 6; i += 1) wm.focus(i % 2 === 0 ? 'a' : 'b')
    expect(wm.undo()).toBe(true)
    expect(wm.getState().order).toEqual(['a', 'b'])
    expect(wm.get('a')?.bounds.x).toBe(300)
    expect(wm.undo()).toBe(true)
    expect(wm.get('a')?.bounds.x).toBe(0)
    expect(wm.canUndo()).toBe(false)
  })

  it('starts a new entry for focus changes that follow a real change', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    wm.open({ id: 'b', x: 0, y: 0, width: 200, height: 150 })
    wm.focus('a')
    wm.move('b', 50, 50)
    wm.focus('b')
    wm.undo()
    expect(wm.get('b')?.bounds.x).toBe(50)
    wm.undo()
    expect(wm.get('b')?.bounds.x).toBe(0)
  })

  it('does not merge a tab reorder with the focus changes around it', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.open({ id: 'c' })
    wm.group(['a', 'b'])
    wm.focus('c')
    wm.moveTab('b', 0)
    wm.focus('a')
    wm.undo()
    expect(wm.groupMembers(wm.get('a')?.groupId as string).map((win) => win.id)).toEqual(['b', 'a'])
    wm.undo()
    expect(wm.groupMembers(wm.get('a')?.groupId as string).map((win) => win.id)).toEqual(['a', 'b'])
  })

  it('does not merge focus changes made inside an interaction', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.focus('a')
    wm.beginInteraction()
    wm.focus('b')
    wm.move('b', 300, 300)
    wm.endInteraction()
    wm.undo()
    expect(wm.getState().focusedId).toBe('a')
    expect(wm.canUndo()).toBe(true)
  })
})

describe('calls that change nothing', () => {
  function expectNoop(setup: (wm: WindowManager) => void, run: (wm: WindowManager) => unknown) {
    const wm = makeWm()
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    wm.open({ id: 'b', x: 300, y: 10, width: 200, height: 150 })
    setup(wm)
    wm.clearHistory()
    const before = wm.getState()
    const change = vi.fn()
    wm.subscribe(change)
    const events = record(wm, ['stage', 'move', 'resize', 'update', 'group', 'order', 'focus'])
    const result = run(wm)
    expect(wm.getState()).toBe(before)
    expect(change).not.toHaveBeenCalled()
    expect(events).toEqual([])
    expect(wm.canUndo()).toBe(false)
    return result
  }

  it('snap to the zone the window already has', () => {
    const result = expectNoop(
      (wm) => wm.snap('b', 'left'),
      (wm) => wm.snap('b', 'left'),
    )
    expect(result).toBe(true)
  })

  it('snapTo the rectangle the window already has', () => {
    const rect = { x: 0.5, y: 0, width: 0.5, height: 1 }
    const result = expectNoop(
      (wm) => wm.snapTo('b', rect),
      (wm) => wm.snapTo('b', { ...rect }),
    )
    expect(result).toBe(true)
  })

  it('restoreTo the bounds the window already has', () => {
    const result = expectNoop(
      () => {},
      (wm) => wm.restoreTo('b', { x: 300, y: 10, width: 200, height: 150 }),
    )
    expect(result).toBe(true)
  })

  it('group of windows that already form that group', () => {
    let groupId: string | null = null
    const result = expectNoop(
      (wm) => {
        groupId = wm.group(['b', 'a'])
      },
      (wm) => wm.group(['b', 'a']),
    )
    expect(result).toBe(groupId)
  })

  it('resize with an empty patch of a snapped window', () => {
    expectNoop(
      (wm) => wm.snap('b', 'right'),
      (wm) => wm.resize('b', {}),
    )
  })

  it('focus of the focused top window', () => {
    expectNoop(
      () => {},
      (wm) => wm.focus('b'),
    )
  })

  it('arrange into the arrangement the windows already have', () => {
    expectNoop(
      (wm) => wm.arrange('cascade'),
      (wm) => wm.arrange('cascade'),
    )
    expectNoop(
      (wm) => wm.arrange('tile'),
      (wm) => wm.arrange('tile'),
    )
  })

  it('keeps the order array and the groups of the state on a focus of the top window', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.open({ id: 'c' })
    wm.group(['a', 'b'])
    wm.focus('c')
    const s1 = wm.getState()
    wm.focus('c')
    wm.move('c', 5, 5)
    const s2 = wm.getState()
    expect(s2.order).toBe(s1.order)
    expect(s2.groups).toBe(s1.groups)
  })

  it('keeps a snapped window snapped on a resize to its own size', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.snap('a', 'left')
    const bounds = wm.get('a')?.bounds
    expect(wm.resize('a', { ...bounds })).toBe(true)
    expect(wm.get('a')?.stage).toBe('snapped')
    wm.resize('a', { width: 300 })
    expect(wm.get('a')?.stage).toBe('normal')
  })
})

describe('update with a meta or size limit object', () => {
  it('counts as a change whatever the value, so an in-place change can be announced', () => {
    const wm = makeWm()
    const data = { n: 1 }
    wm.open({ id: 'a', meta: { data } })
    wm.clearHistory()
    const before = wm.get('a')
    const change = vi.fn()
    wm.subscribe(change)
    const events = record(wm, ['update'])
    data.n = 2
    expect(wm.update('a', { meta: { data } })).toBe(true)
    expect(wm.get('a')).not.toBe(before)
    expect(events).toEqual(['update:a'])
    expect(change).toHaveBeenCalledTimes(1)
    expect(wm.canUndo()).toBe(true)
    wm.update('a', { minSize: { ...(before?.minSize as { width: number; height: number }) } })
    wm.update('a', { maxSize: { width: 900, height: 700 } })
    wm.update('a', { maxSize: { width: 900, height: 700 } })
    expect(events).toHaveLength(4)
    events.length = 0
    expect(wm.undo()).toBe(true)
    expect(events).toEqual(['update:a'])
    wm.undo()
    wm.undo()
    wm.undo()
    expect(wm.get('a')).toBe(before)
  })

  it('compares primitives and the stored objects by value', () => {
    const wm = makeWm()
    const a = wm.open({ id: 'a', title: 'T' })
    wm.clearHistory()
    expect(wm.update('a', { title: 'T', minSize: a.minSize, maxSize: null })).toBe(true)
    expect(wm.get('a')).toBe(a)
    expect(wm.canUndo()).toBe(false)
  })
})

describe('undo, redo and hydrate keep what did not change', () => {
  it('keeps maximized and snapped windows when an unrelated move is undone', () => {
    const wm = makeWm()
    wm.open({ id: 'max', stage: 'maximized' })
    wm.open({ id: 's1' })
    wm.open({ id: 's2' })
    wm.snap('s1', 'left')
    wm.snapTo('s2', { x: 0.5, y: 0, width: 0.5, height: 1 })
    wm.open({ id: 'b', x: 10, y: 10, width: 200, height: 150 })
    wm.move('b', 100, 100)
    const kept = ['max', 's1', 's2'].map((id) => wm.get(id))
    const events = record(wm, ['resize', 'stage', 'update'])
    wm.undo()
    expect(wm.get('b')?.bounds.x).toBe(10)
    expect(['max', 's1', 's2'].map((id) => wm.get(id))).toEqual(kept)
    expect(['max', 's1', 's2'].every((id, i) => wm.get(id) === kept[i])).toBe(true)
    expect(events).toEqual([])
  })

  it('emits the granular events for the windows that did change', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    wm.open({ id: 'b', x: 0, y: 0, width: 200, height: 150 })
    wm.focus('a')
    wm.maximize('a')
    wm.update('b', { title: 'B' })
    const events = record(wm, ['stage', 'order', 'move', 'resize', 'update', 'focus'])
    wm.undo()
    wm.undo()
    wm.undo()
    expect(wm.get('a')?.stage).toBe('normal')
    expect(wm.getState().order).toEqual(['a', 'b'])
    expect(events).toEqual([
      'update:b',
      'stage:a:maximized->normal',
      'move:a',
      'resize:a',
      'order',
      'focus:b',
    ])
    events.length = 0
    wm.redo()
    expect(events).toEqual(['order', 'focus:a'])
  })

  it('reports moves, closes, opens and group changes on undo', () => {
    const wm = makeWm()
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    const group = wm.group(['a', 'b'])
    wm.close('a')
    const groups: unknown[] = []
    wm.on('group', (payload) => groups.push(payload))
    const events = record(wm, ['open', 'close'])
    wm.undo()
    expect(events).toEqual(['open:a'])
    expect(groups).toEqual([{ groupId: group, members: ['a', 'b'], activeId: 'a', previous: null }])
    wm.activateTab('b')
    groups.length = 0
    wm.undo()
    expect(groups).toEqual([{ groupId: group, members: ['a', 'b'], activeId: 'a', previous: 'b' }])
    wm.undo()
    expect(wm.get('a')?.groupId).toBeNull()
    expect(groups.at(-1)).toEqual({ groupId: group, members: [], activeId: '', previous: null })
  })

  it('keeps unchanged windows and reports the rest on hydrate and loadLayout', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    wm.open({ id: 'b', x: 20, y: 20, width: 200, height: 150 })
    wm.saveLayout('l')
    const a = wm.get('a')
    wm.move('b', 300, 300)
    wm.open({ id: 'c' })
    const events = record(wm, ['open', 'close', 'move', 'resize'])
    expect(wm.loadLayout('l')).toBe(true)
    expect(wm.get('a')).toBe(a)
    expect(events).toEqual(['move:b', 'close:c'])
    events.length = 0
    wm.hydrate(wm.serialize())
    expect(wm.get('a')).toBe(a)
    expect(events).toEqual([])
  })
})

describe('restoreTo and arrange emit what changed', () => {
  it('emits move and resize but no stage event for a normal window', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    const events = record(wm, ['stage', 'move', 'resize'])
    wm.restoreTo('a', { x: 300, y: 200, width: 400, height: 300 })
    expect(events).toEqual(['move:a', 'resize:a'])
  })

  it('emits a stage event with the old stage for a maximized window', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    wm.maximize('a')
    const events = record(wm, ['stage', 'move', 'resize'])
    wm.restoreTo('a', { x: 300, y: 200, width: 400, height: 300 })
    expect(events).toEqual(['stage:a:maximized->normal', 'move:a', 'resize:a'])
  })

  it('emits the geometry events of a cascade', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 500, y: 300, width: 200, height: 150 })
    wm.open({ id: 'b', x: 400, y: 100, width: 200, height: 150 })
    const events = record(wm, ['move', 'resize', 'focus', 'order'])
    wm.arrange('cascade')
    expect(wm.get('a')?.bounds).toMatchObject({ x: 32, y: 32 })
    expect(events).toEqual(['move:a', 'move:b'])
  })
})

describe('interactions', () => {
  it('keeps the outer interaction as one entry when an inner one is aborted', () => {
    const wm = makeWm()
    wm.open({ id: 'f', x: 700, y: 400, width: 100, height: 100 })
    wm.open({ id: 'b' })
    wm.clearHistory()
    wm.beginInteraction()
    wm.move('f', 600, 300)
    wm.beginInteraction()
    wm.close('b')
    wm.abortInteraction()
    wm.move('f', 500, 200)
    wm.endInteraction()
    expect(wm.undo()).toBe(true)
    expect(wm.get('f')?.bounds.x).toBe(700)
    expect(wm.get('b')).toBeDefined()
    expect(wm.canUndo()).toBe(false)
  })

  it('leaves no step for an interaction that ends where it started', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    wm.move('a', 20, 20)
    wm.undo()
    expect(wm.canRedo()).toBe(true)
    wm.beginInteraction()
    wm.move('a', 300, 300)
    wm.move('a', 10, 10)
    wm.endInteraction()
    expect(wm.get('a')?.bounds.x).toBe(10)
    expect(wm.canRedo()).toBe(true)
    wm.undo()
    expect(wm.getState().order).toEqual([])
  })

  it('drops the entry of an aborted interaction at the outer level', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
    wm.clearHistory()
    wm.beginInteraction()
    wm.move('a', 50, 50)
    wm.abortInteraction()
    expect(wm.canUndo()).toBe(false)
  })

  it('leaves no phantom step after an undo inside an aborted interaction', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    wm.clearHistory()
    wm.move('a', 10, 10)
    wm.beginInteraction()
    wm.undo()
    wm.abortInteraction()
    expect(wm.get('a')?.bounds.x).toBe(0)
    expect(wm.canUndo()).toBe(false)
    expect(wm.canRedo()).toBe(true)
    wm.redo()
    expect(wm.get('a')?.bounds.x).toBe(10)
  })
})

describe('undo and redo inside a batch', () => {
  it('records the change made after an undo and drops the redo branch', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    wm.move('a', 10, 10)
    wm.move('a', 20, 20)
    wm.batch(() => {
      wm.undo()
      wm.move('a', 50, 50)
    })
    expect(wm.get('a')?.bounds.x).toBe(50)
    expect(wm.canRedo()).toBe(false)
    wm.undo()
    expect(wm.get('a')?.bounds.x).toBe(10)
  })

  it('undoes a change made earlier in the same batch', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    wm.move('a', 10, 10)
    wm.batch(() => {
      wm.move('a', 30, 30)
      wm.undo()
    })
    expect(wm.get('a')?.bounds.x).toBe(10)
    wm.redo()
    expect(wm.get('a')?.bounds.x).toBe(30)
    wm.undo()
    wm.undo()
    expect(wm.get('a')?.bounds.x).toBe(0)
  })

  it('finds nothing to redo after a change in the same batch', () => {
    const wm = makeWm()
    wm.open({ id: 'a', x: 0, y: 0, width: 200, height: 150 })
    wm.move('a', 10, 10)
    wm.undo()
    let redone = true
    wm.batch(() => {
      wm.move('a', 40, 40)
      redone = wm.redo()
      wm.move('a', 60, 60)
    })
    expect(redone).toBe(false)
    expect(wm.canRedo()).toBe(false)
    wm.undo()
    expect(wm.get('a')?.bounds.x).toBe(40)
    wm.undo()
    expect(wm.get('a')?.bounds.x).toBe(0)
  })
})
