import { describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager, WindowState } from '../../src/core/types'

interface Gate<T> {
  promise: Promise<T>
  open(value: T): void
  fail(error: unknown): void
}

function gate<T = boolean | undefined>(): Gate<T> {
  let open!: (value: T) => void
  let fail!: (error: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    open = resolve
    fail = reject
  })
  return { promise, open, fail }
}

const turn = () => new Promise<void>((resolve) => setImmediate(resolve))

function desk(): WindowManager {
  const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  wm.open({ id: 'a', title: 'A' })
  wm.open({ id: 'b', title: 'B' })
  return wm
}

function waiting(wm: WindowManager): Array<[string, boolean]> {
  const heard: Array<[string, boolean]> = []
  wm.on('closing', ({ window: win, pending }) => heard.push([win.id, pending]))
  return heard
}

describe('asking a window to close', () => {
  it('closes it at once when nobody objects, as one step of history', async () => {
    const wm = desk()
    const closed = vi.fn()
    const heard = waiting(wm)
    wm.on('close', closed)
    const asked = wm.requestClose('a')
    expect(wm.get('a')).toBeUndefined()
    expect(closed).toHaveBeenCalledTimes(1)
    await expect(asked).resolves.toBe(true)
    expect(heard).toEqual([])
    expect(wm.undo()).toBe(true)
    expect(wm.get('a')?.title).toBe('A')
  })

  it('answers false for a window that is not there and asks nobody', async () => {
    const wm = desk()
    const guard = vi.fn()
    wm.onBeforeClose(guard)
    await expect(wm.requestClose('nope')).resolves.toBe(false)
    expect(guard).not.toHaveBeenCalled()
  })

  it('reads an id that is a number the way every other method does', async () => {
    const wm = desk()
    wm.open({ id: '7' })
    await expect(wm.requestClose(7 as never)).resolves.toBe(true)
    expect(wm.get('7')).toBeUndefined()
    await expect(wm.requestClose({} as never)).resolves.toBe(false)
  })

  it('asks the guards in the order they subscribed and stops at the first no', async () => {
    const wm = desk()
    const calls: string[] = []
    wm.onBeforeClose((win) => {
      calls.push(`first ${win.id} ${win.title}`)
    })
    wm.onBeforeClose(() => {
      calls.push('second')
      return false
    })
    wm.onBeforeClose(() => {
      calls.push('third')
    })
    const before = JSON.stringify(wm.serialize())
    await expect(wm.requestClose('a')).resolves.toBe(false)
    expect(calls).toEqual(['first a A', 'second'])
    expect(JSON.stringify(wm.serialize())).toBe(before)
    expect(wm.undo()).toBe(true)
    expect(wm.get('b')).toBeUndefined()
    expect(wm.get('a')).toBeDefined()
  })

  it.each([
    true,
    undefined,
    null,
    0,
    '',
    'no',
  ])('takes only false for a no, not %o', async (answer) => {
    const wm = desk()
    wm.onBeforeClose(() => answer as never)
    await expect(wm.requestClose('a')).resolves.toBe(true)
    expect(wm.get('a')).toBeUndefined()
  })

  it('waits for a guard that answers later and tells the listeners that it waits', async () => {
    const wm = desk()
    const later = gate()
    const heard = waiting(wm)
    wm.onBeforeClose(() => later.promise)
    const asked = wm.requestClose('a')
    expect(wm.get('a')).toBeDefined()
    expect(heard).toEqual([['a', true]])
    later.open(undefined)
    await expect(asked).resolves.toBe(true)
    expect(wm.get('a')).toBeUndefined()
    expect(heard).toEqual([['a', true]])
  })

  it('keeps the window when a late answer is no and says that the wait is over', async () => {
    const wm = desk()
    const later = gate()
    const heard = waiting(wm)
    wm.onBeforeClose(() => later.promise)
    const asked = wm.requestClose('a')
    later.open(false)
    await expect(asked).resolves.toBe(false)
    expect(wm.get('a')).toBeDefined()
    expect(heard).toEqual([
      ['a', true],
      ['a', false],
    ])
  })

  it('asks the guards that answer at once before it returns, up to the first late one', async () => {
    const wm = desk()
    const later = gate()
    const calls: string[] = []
    wm.onBeforeClose(() => {
      calls.push('at once')
    })
    wm.onBeforeClose(() => {
      calls.push('late')
      return later.promise
    })
    wm.onBeforeClose(() => {
      calls.push('after')
    })
    const heard = waiting(wm)
    const asked = wm.requestClose('a')
    expect(calls).toEqual(['at once', 'late'])
    later.open(true)
    await expect(asked).resolves.toBe(true)
    expect(calls).toEqual(['at once', 'late', 'after'])
    expect(heard).toEqual([['a', true]])
  })

  it('says once that it waits however many guards answer late', async () => {
    const wm = desk()
    const [one, two] = [gate(), gate()]
    const heard = waiting(wm)
    wm.onBeforeClose(() => one.promise)
    wm.onBeforeClose(() => two.promise)
    const asked = wm.requestClose('a')
    one.open(true)
    await turn()
    two.open(false)
    await expect(asked).resolves.toBe(false)
    expect(heard).toEqual([
      ['a', true],
      ['a', false],
    ])
  })

  it('hands back the same promise while it waits and asks each guard once', async () => {
    const wm = desk()
    const later = gate()
    const guard = vi.fn((_win: WindowState) => later.promise)
    wm.onBeforeClose(guard)
    const first = wm.requestClose('a')
    const second = wm.requestClose('a')
    expect(second).toBe(first)
    expect(wm.requestClose('b')).not.toBe(first)
    later.open(true)
    await expect(first).resolves.toBe(true)
    expect(guard.mock.calls.map(([win]) => win.id)).toEqual(['a', 'b'])
    const third = wm.requestClose('a')
    expect(third).not.toBe(first)
    await expect(third).resolves.toBe(false)
  })

  it('gives a guard that asks again from the inside the request it is part of', async () => {
    const wm = desk()
    const inner: Array<Promise<boolean>> = []
    let asks = 0
    wm.onBeforeClose(() => {
      asks += 1
      if (asks < 5) inner.push(wm.requestClose('a'))
    })
    const asked = wm.requestClose('a')
    expect(asks).toBe(1)
    expect(inner).toEqual([asked])
    await expect(asked).resolves.toBe(true)
  })

  it('rejects with what a guard threw, keeps the window and asks nobody after it', async () => {
    const wm = desk()
    const after = vi.fn()
    const heard = waiting(wm)
    const broken = new Error('no disk')
    wm.onBeforeClose(() => {
      throw broken
    })
    wm.onBeforeClose(after)
    await expect(wm.requestClose('a')).rejects.toBe(broken)
    expect(wm.get('a')).toBeDefined()
    expect(after).not.toHaveBeenCalled()
    expect(heard).toEqual([])
  })

  it('rejects with what a late guard rejected with and is ready to be asked again', async () => {
    const wm = desk()
    const later = gate()
    const heard = waiting(wm)
    let fine = false
    wm.onBeforeClose(() => (fine ? undefined : later.promise))
    const asked = wm.requestClose('a')
    later.fail('offline')
    await expect(asked).rejects.toBe('offline')
    expect(wm.get('a')).toBeDefined()
    expect(heard).toEqual([
      ['a', true],
      ['a', false],
    ])
    fine = true
    await expect(wm.requestClose('a')).resolves.toBe(true)
  })

  it('rejects when a guard throws after a late one let it through', async () => {
    const wm = desk()
    const later = gate()
    wm.onBeforeClose(() => later.promise)
    wm.onBeforeClose(() => {
      throw new Error('second thoughts')
    })
    const asked = wm.requestClose('a')
    later.open(true)
    await expect(asked).rejects.toThrow('second thoughts')
    expect(wm.get('a')).toBeDefined()
  })

  it('accepts anything with a then', async () => {
    const wm = desk()
    const slow = {
      // biome-ignore lint/suspicious/noThenProperty: the test is about a thenable
      then(done: (value: boolean) => void) {
        setTimeout(() => done(false), 0)
      },
    }
    wm.onBeforeClose(() => slow as PromiseLike<boolean>)
    const asked = wm.requestClose('a')
    expect(wm.get('a')).toBeDefined()
    await expect(asked).resolves.toBe(false)
  })

  it('shows a guard the window as it is when its turn comes', async () => {
    const wm = desk()
    const later = gate()
    const titles: string[] = []
    wm.onBeforeClose(() => later.promise)
    wm.onBeforeClose((win) => {
      titles.push(win.title)
    })
    const asked = wm.requestClose('a')
    wm.update('a', { title: 'Renamed' })
    later.open(true)
    await asked
    expect(titles).toEqual(['Renamed'])
  })
})

describe('a window that goes away while it is being asked', () => {
  const ways: Array<[string, (wm: WindowManager) => void]> = [
    ['close', (wm) => wm.close('a')],
    ['closeAll', (wm) => wm.closeAll()],
    ['undo', (wm) => wm.undo()],
    ['hydrate', (wm) => wm.hydrate(createWindowManager().serialize())],
    ['loadLayout', (wm) => wm.loadLayout('before')],
    ['redo', (wm) => wm.redo()],
  ]

  it.each(ways)('answers true after %s and asks nobody else', async (_name, leave) => {
    const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
    wm.open({ id: 'b' })
    wm.saveLayout('before')
    wm.open({ id: 'a' })
    wm.close('a')
    wm.undo()
    const later = gate()
    const after = vi.fn()
    const heard = waiting(wm)
    wm.onBeforeClose(() => later.promise)
    wm.onBeforeClose(after)
    const asked = wm.requestClose('a')
    leave(wm)
    expect(wm.get('a')).toBeUndefined()
    await expect(asked).resolves.toBe(true)
    later.open(true)
    await turn()
    expect(after).not.toHaveBeenCalled()
    expect(heard).toEqual([['a', true]])
  })

  it('does not let an answer about it close the next window that takes its id', async () => {
    const wm = desk()
    const later = gate()
    wm.onBeforeClose((win) => (win.title === 'A' ? later.promise : false))
    const asked = wm.requestClose('a')
    wm.batch(() => {
      wm.close('a')
      wm.open({ id: 'a', title: 'Another' })
    })
    await expect(asked).resolves.toBe(true)
    later.open(true)
    await turn()
    expect(wm.get('a')?.title).toBe('Another')
    await expect(wm.requestClose('a')).resolves.toBe(false)
  })

  it('does not take the window that undo puts under its id for the one it asked about', async () => {
    const wm = desk()
    const later = gate()
    const after = vi.fn()
    const heard = waiting(wm)
    wm.batch(() => {
      wm.close('a')
      wm.open({ id: 'a', title: 'Second' })
    })
    wm.onBeforeClose(() => later.promise)
    wm.onBeforeClose(after)
    const asked = wm.requestClose('a')
    wm.undo()
    expect(wm.get('a')?.title).toBe('A')
    await expect(asked).resolves.toBe(true)
    later.open(true)
    await turn()
    expect(after).not.toHaveBeenCalled()
    expect(wm.get('a')?.title).toBe('A')
    expect(heard).toEqual([
      ['a', true],
      ['a', false],
    ])
  })

  it('goes on asking about a window that undo only moved back', async () => {
    const wm = desk()
    const later = gate()
    wm.move('a', 300, 200)
    wm.onBeforeClose(() => later.promise)
    const asked = wm.requestClose('a')
    wm.undo()
    later.open(true)
    await expect(asked).resolves.toBe(true)
    expect(wm.get('a')).toBeUndefined()
  })

  it('lets the window that came back by undo be asked afresh', async () => {
    const wm = desk()
    const later = gate()
    let late = true
    wm.onBeforeClose(() => (late ? later.promise : undefined))
    const asked = wm.requestClose('a')
    wm.close('a')
    await expect(asked).resolves.toBe(true)
    wm.undo()
    expect(wm.get('a')).toBeDefined()
    later.open(true)
    await turn()
    expect(wm.get('a')).toBeDefined()
    late = false
    await expect(wm.requestClose('a')).resolves.toBe(true)
  })
})

describe('the guards of a manager', () => {
  it('are not asked by close or closeAll', () => {
    const wm = desk()
    const guard = vi.fn(() => false)
    wm.onBeforeClose(guard)
    expect(wm.close('a')).toBe(true)
    wm.closeAll()
    expect(wm.getState().order).toEqual([])
    expect(guard).not.toHaveBeenCalled()
  })

  it('stop being asked once they unsubscribe, even in the middle of a wait', async () => {
    const wm = desk()
    const later = gate()
    const gone = vi.fn(() => false)
    wm.onBeforeClose(() => later.promise)
    const leave = wm.onBeforeClose(gone)
    const asked = wm.requestClose('a')
    leave()
    leave()
    later.open(true)
    await expect(asked).resolves.toBe(true)
    expect(gone).not.toHaveBeenCalled()
  })

  it('are asked from the next request on when they subscribe in the middle of a wait', async () => {
    const wm = desk()
    const later = gate()
    const late = vi.fn(() => false)
    const leave = wm.onBeforeClose(() => later.promise)
    const asked = wm.requestClose('a')
    wm.onBeforeClose(late)
    later.open(true)
    await expect(asked).resolves.toBe(true)
    expect(late).not.toHaveBeenCalled()
    leave()
    await expect(wm.requestClose('b')).resolves.toBe(false)
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('count twice when one function subscribes twice, and each handle removes its own', async () => {
    const wm = desk()
    const guard = vi.fn()
    const first = wm.onBeforeClose(guard)
    const second = wm.onBeforeClose(guard)
    first()
    first()
    await wm.requestClose('a')
    expect(guard).toHaveBeenCalledTimes(1)
    second()
    await wm.requestClose('b')
    expect(guard).toHaveBeenCalledTimes(1)
  })

  it('are dropped by destroy, and a request that was waiting still ends', async () => {
    const wm = desk()
    const later = gate()
    const after = vi.fn(() => false)
    wm.onBeforeClose(() => later.promise)
    wm.onBeforeClose(after)
    const asked = wm.requestClose('a')
    wm.destroy()
    later.open(true)
    await expect(asked).resolves.toBe(true)
    expect(after).not.toHaveBeenCalled()
    expect(wm.get('a')).toBeUndefined()
    await expect(wm.requestClose('b')).resolves.toBe(true)
  })

  it('answer inside a batch when they answer at once', () => {
    const wm = desk()
    wm.onBeforeClose((win) => win.id !== 'b')
    const seen: Array<string[]> = []
    wm.subscribe((state) => seen.push([...state.order]))
    wm.batch(() => {
      void wm.requestClose('a')
      void wm.requestClose('b')
      expect(wm.get('a')).toBeUndefined()
      expect(wm.get('b')).toBeDefined()
    })
    expect(seen).toEqual([['b']])
  })
})
