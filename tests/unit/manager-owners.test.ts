import { describe, expect, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { SerializedState, WindowManager } from '../../src/core/types'

const VIEWPORT = { width: 1280, height: 800 }

function desk(): WindowManager {
  return createWindowManager({ viewport: VIEWPORT })
}

function family(): WindowManager {
  const wm = desk()
  wm.open({ id: 'other' })
  wm.open({ id: 'doc' })
  wm.open({ id: 'find', owner: 'doc' })
  return wm
}

function asking(): WindowManager {
  const wm = family()
  wm.open({ id: 'ask', owner: 'doc', layer: 'modal' })
  return wm
}

const order = (wm: WindowManager) => wm.getState().order
const focused = (wm: WindowManager) => wm.getState().focusedId
const stages = (wm: WindowManager, ...ids: string[]) => ids.map((id) => wm.get(id)?.stage)
const owners = (wm: WindowManager) =>
  Object.fromEntries(order(wm).map((id) => [id, wm.get(id)?.ownerId]))

function saved(wm: WindowManager, edit: (data: SerializedState) => void): WindowManager {
  const data = wm.serialize()
  edit(data)
  const copy = desk()
  copy.hydrate(data)
  return copy
}

const entry = (data: SerializedState, id: string) =>
  data.windows.find((win) => win.id === id) as SerializedState['windows'][number]

describe('a window opened with an owner', () => {
  it('remembers its owner, and a window opened without one has none', () => {
    const wm = family()
    expect(wm.get('find')?.ownerId).toBe('doc')
    expect(wm.get('doc')?.ownerId).toBeNull()
  })

  it('has no owner when the one it names is missing or sits in a tab group', () => {
    const wm = desk()
    wm.open({ id: 'a' })
    wm.open({ id: 'b' })
    wm.group(['a', 'b'])
    expect(wm.open({ id: 'c', owner: 'nobody' }).ownerId).toBeNull()
    expect(wm.open({ id: 'd', owner: 'a' }).ownerId).toBeNull()
  })

  it('opens on the workspace of its owner whatever workspace it asks for', () => {
    const wm = desk()
    wm.open({ id: 'here' })
    wm.open({ id: 'doc', workspace: 2 })
    const child = wm.open({ id: 'find', owner: 'doc', workspace: 0 })
    expect(child.workspace).toBe(2)
    expect(focused(wm)).toBe('here')
  })

  it('opens minimized under a minimized owner and shown under a shown one', () => {
    const wm = family()
    wm.minimize('doc')
    expect(wm.open({ id: 'late', owner: 'doc', stage: 'maximized' })).toMatchObject({
      stage: 'minimized',
      restoreStage: 'normal',
    })
    expect(focused(wm)).toBe('other')
    expect(wm.open({ id: 'tool', owner: 'other', stage: 'minimized' }).stage).toBe('normal')
    expect(wm.open({ id: 'wide', owner: 'other', stage: 'maximized' }).stage).toBe('maximized')
  })

  it('takes the focus when it opens', () => {
    expect(focused(family())).toBe('find')
  })

  it('is one step of history', () => {
    const wm = family()
    wm.undo()
    expect(order(wm)).toEqual(['other', 'doc'])
    wm.redo()
    expect(owners(wm)).toEqual({ other: null, doc: null, find: 'doc' })
  })
})

describe('a family keeps together in the stacking order', () => {
  it('puts a child right above its owner', () => {
    expect(order(family())).toEqual(['other', 'doc', 'find'])
  })

  it('raises the whole family when the owner takes the focus', () => {
    const wm = family()
    wm.focus('other')
    expect(order(wm)).toEqual(['doc', 'find', 'other'])
    expect(wm.focus('doc')).toBe(true)
    expect(order(wm)).toEqual(['other', 'doc', 'find'])
    expect(focused(wm)).toBe('doc')
  })

  it('raises the whole family when a child takes the focus', () => {
    const wm = family()
    wm.focus('other')
    wm.focus('find')
    expect(order(wm)).toEqual(['other', 'doc', 'find'])
    expect(focused(wm)).toBe('find')
  })

  it('keeps every owner below its children among siblings and grandchildren', () => {
    const wm = family()
    wm.open({ id: 'replace', owner: 'doc' })
    wm.open({ id: 'regex', owner: 'find' })
    expect(order(wm)).toEqual(['other', 'doc', 'replace', 'find', 'regex'])
    wm.focus('replace')
    expect(order(wm)).toEqual(['other', 'doc', 'find', 'regex', 'replace'])
    wm.focus('regex')
    expect(order(wm)).toEqual(['other', 'doc', 'replace', 'find', 'regex'])
    wm.focus('find')
    expect(order(wm)).toEqual(['other', 'doc', 'replace', 'find', 'regex'])
    expect(focused(wm)).toBe('find')
  })

  it('lives in the layer of the root of its family', () => {
    const wm = desk()
    wm.open({ id: 'pinned', layer: 'floating' })
    wm.open({ id: 'plain' })
    wm.open({ id: 'tool', owner: 'pinned' })
    expect(order(wm)).toEqual(['plain', 'pinned', 'tool'])
    wm.focus('plain')
    expect(order(wm)).toEqual(['plain', 'pinned', 'tool'])
    wm.open({ id: 'low', owner: 'plain', layer: 'floating' })
    expect(order(wm)).toEqual(['plain', 'low', 'pinned', 'tool'])
    wm.update('pinned', { layer: 'normal' })
    wm.update('plain', { layer: 'floating' })
    expect(order(wm)).toEqual(['pinned', 'tool', 'plain', 'low'])
  })

  it('goes to the back as a whole', () => {
    const wm = family()
    expect(wm.sendToBack('find')).toBe(true)
    expect(order(wm)).toEqual(['doc', 'find', 'other'])
    expect(focused(wm)).toBe('other')
  })

  it('lets the focus cycle through every member in both directions', () => {
    for (const direction of [1, -1] as const) {
      const wm = family()
      const seen = [wm.cycleFocus(direction), wm.cycleFocus(direction), wm.cycleFocus(direction)]
      expect([...seen].sort()).toEqual(['doc', 'find', 'other'])
      expect(order(wm).indexOf('doc')).toBeLessThan(order(wm).indexOf('find'))
    }
  })

  it('lets a round of the cycle visit every window once, however many children an owner has', () => {
    for (const direction of [1, -1] as const) {
      const wm = family()
      wm.open({ id: 'replace', owner: 'doc' })
      wm.open({ id: 'regex', owner: 'find' })
      const round = [0, 1, 2, 3, 4].map(() => wm.cycleFocus(direction))
      expect([...round].sort()).toEqual(['doc', 'find', 'other', 'regex', 'replace'])
      expect(wm.cycleFocus(direction)).toBe(round[0])
    }
  })

  it('stays whole when the windows are arranged', () => {
    const wm = family()
    wm.open({ id: 'last' })
    wm.arrange('cascade')
    expect(order(wm)).toEqual(['other', 'doc', 'find', 'last'])
    wm.focus('find')
    wm.arrange('tile')
    expect(order(wm)).toEqual(['other', 'last', 'doc', 'find'])
  })
})

describe('what happens to one member happens to its family', () => {
  it('closes the descendants with their owner, children first, in one step of history', () => {
    const wm = family()
    wm.open({ id: 'regex', owner: 'find' })
    const closed: string[] = []
    wm.on('close', ({ window: win }) => closed.push(win.id))
    expect(wm.close('doc')).toBe(true)
    expect(closed).toEqual(['regex', 'find', 'doc'])
    expect(order(wm)).toEqual(['other'])
    expect(focused(wm)).toBe('other')
    wm.undo()
    expect(owners(wm)).toEqual({ other: null, doc: null, find: 'doc', regex: 'find' })
  })

  it('closes only what a child owns when the child closes', () => {
    const wm = family()
    wm.open({ id: 'regex', owner: 'find' })
    wm.close('find')
    expect(order(wm)).toEqual(['other', 'doc'])
    expect(focused(wm)).toBe('doc')
  })

  it('minimizes and restores the family as one', () => {
    const wm = family()
    const staged: string[] = []
    wm.on('stage', ({ window: win }) => staged.push(`${win.id}:${win.stage}`))
    wm.minimize('doc')
    expect(staged).toEqual(['doc:minimized', 'find:minimized'])
    expect(focused(wm)).toBe('other')
    expect(wm.restore('find')).toBe(true)
    expect(stages(wm, 'doc', 'find')).toEqual(['normal', 'normal'])
    expect(focused(wm)).toBe('find')
    expect(order(wm)).toEqual(['other', 'doc', 'find'])
    wm.minimize('find')
    expect(stages(wm, 'doc', 'find')).toEqual(['minimized', 'minimized'])
    wm.maximize('doc')
    expect(stages(wm, 'doc', 'find')).toEqual(['maximized', 'normal'])
  })

  it('brings a maximized child back maximized when everything is restored', () => {
    const wm = family()
    wm.maximize('find')
    wm.minimizeAll()
    expect(stages(wm, 'other', 'doc', 'find')).toEqual(['minimized', 'minimized', 'minimized'])
    wm.restoreAll()
    expect(stages(wm, 'other', 'doc', 'find')).toEqual(['normal', 'normal', 'maximized'])
    expect(order(wm)).toEqual(['other', 'doc', 'find'])
  })

  it('stays up with a root that cannot be minimized when everything else goes down', () => {
    const wm = desk()
    wm.open({ id: 'kiosk', minimizable: false })
    wm.open({ id: 'panel', owner: 'kiosk' })
    wm.open({ id: 'plain' })
    wm.minimizeAll()
    expect(stages(wm, 'kiosk', 'panel', 'plain')).toEqual(['normal', 'normal', 'minimized'])
  })

  it('moves to another workspace together, whichever member is moved', () => {
    const wm = family()
    const updated: string[] = []
    wm.on('update', ({ window: win }) => updated.push(win.id))
    expect(wm.moveToWorkspace('find', 1)).toBe(true)
    expect([wm.get('doc')?.workspace, wm.get('find')?.workspace]).toEqual([1, 1])
    expect([...updated].sort()).toEqual(['doc', 'find'])
    expect(focused(wm)).toBe('other')
    wm.moveToWorkspace('doc', 0)
    expect([wm.get('doc')?.workspace, wm.get('find')?.workspace]).toEqual([0, 0])
    wm.focus('find')
    wm.moveToWorkspace('doc', 2)
    expect(focused(wm)).toBe('other')
  })

  it('never joins a tab group', () => {
    const wm = family()
    expect(wm.group(['doc', 'other'])).toBeNull()
    expect(wm.group(['other', 'find'])).toBeNull()
    expect(wm.getState().groups).toEqual({})
    wm.open({ id: 'free' })
    expect(wm.group(['other', 'free'])).not.toBeNull()
  })
})

describe('a modal window with an owner is modal for its family', () => {
  it('opens on top of the family and leaves the rest of the desktop usable', () => {
    const wm = asking()
    expect(order(wm)).toEqual(['other', 'doc', 'find', 'ask'])
    expect(focused(wm)).toBe('ask')
    expect(wm.focus('other')).toBe(true)
    expect(order(wm)).toEqual(['doc', 'find', 'ask', 'other'])
    expect(wm.open({ id: 'fresh' }).id).toBe(focused(wm))
  })

  it('refuses the focus to the windows below it and takes the focus itself', () => {
    const wm = asking()
    wm.focus('other')
    const blocked: string[] = []
    wm.on('modalblocked', ({ window: win }) => blocked.push(win.id))
    expect(wm.focus('doc')).toBe(false)
    expect(focused(wm)).toBe('ask')
    expect(order(wm)).toEqual(['other', 'doc', 'find', 'ask'])
    expect(wm.focus('find')).toBe(false)
    expect(blocked).toEqual(['ask', 'ask'])
  })

  it('lets only what it owns take the focus and keeps a window opened beside it underneath', () => {
    const wm = asking()
    wm.open({ id: 'pick', owner: 'ask' })
    expect(focused(wm)).toBe('pick')
    expect(wm.focus('ask')).toBe(true)
    wm.focus('pick')
    expect(wm.open({ id: 'late', owner: 'doc' }).ownerId).toBe('doc')
    expect(order(wm)).toEqual(['other', 'doc', 'find', 'late', 'ask', 'pick'])
    expect(focused(wm)).toBe('ask')
    expect(wm.focus('late')).toBe(false)
    expect(wm.open({ id: 'deep', owner: 'find' }).ownerId).toBe('find')
    expect(order(wm)).toEqual(['other', 'doc', 'late', 'find', 'deep', 'ask', 'pick'])
    expect(wm.focus('deep')).toBe(false)
  })

  it('rules the family from wherever it stands once it turns modal', () => {
    const wm = family()
    wm.open({ id: 'replace', owner: 'doc' })
    wm.update('find', { layer: 'modal' })
    expect(focused(wm)).toBe('find')
    expect(order(wm)).toEqual(['other', 'doc', 'replace', 'find'])
    expect(wm.focus('replace')).toBe(false)
    wm.focus('other')
    wm.close('other')
    expect(focused(wm)).toBe('find')
  })

  it('yields to a modal that opens over it and takes the family back when that one closes', () => {
    const wm = asking()
    wm.open({ id: 'sure', owner: 'doc', layer: 'modal' })
    expect(focused(wm)).toBe('sure')
    expect(wm.focus('ask')).toBe(false)
    expect(focused(wm)).toBe('sure')
    wm.close('sure')
    expect(focused(wm)).toBe('ask')
    expect(wm.focus('find')).toBe(false)
  })

  it('is skipped over by the focus cycle together with the windows it blocks', () => {
    for (const direction of [1, -1] as const) {
      const wm = asking()
      const seen = [wm.cycleFocus(direction), wm.cycleFocus(direction), wm.cycleFocus(direction)]
      expect([...new Set(seen)].sort()).toEqual(['ask', 'other'])
    }
  })

  it('gives the family back when it closes', () => {
    const wm = asking()
    wm.close('ask')
    expect(focused(wm)).toBe('find')
    expect(wm.focus('doc')).toBe(true)
  })

  it('takes the focus from a window it starts to block', () => {
    const wm = family()
    wm.focus('doc')
    wm.update('find', { layer: 'modal' })
    expect(focused(wm)).toBe('find')
    wm.update('find', { layer: 'normal' })
    expect(wm.focus('doc')).toBe(true)
  })

  it('comes back in front when its minimized family is asked for', () => {
    const wm = asking()
    wm.minimize('doc')
    expect(stages(wm, 'doc', 'find', 'ask')).toEqual(['minimized', 'minimized', 'minimized'])
    expect(wm.restore('doc')).toBe(true)
    expect(stages(wm, 'doc', 'find', 'ask')).toEqual(['normal', 'normal', 'normal'])
    expect(focused(wm)).toBe('ask')
    wm.minimize('ask')
    expect(wm.focus('find')).toBe(false)
    expect(stages(wm, 'doc', 'find', 'ask')).toEqual(['normal', 'normal', 'normal'])
    expect(focused(wm)).toBe('ask')
  })
})

describe('a modal window without an owner still rules the desktop', () => {
  it('keeps its own family usable and everything else blocked', () => {
    const wm = desk()
    wm.open({ id: 'other' })
    wm.open({ id: 'dialog', layer: 'modal' })
    wm.open({ id: 'picker', owner: 'dialog' })
    expect(order(wm)).toEqual(['other', 'dialog', 'picker'])
    expect(focused(wm)).toBe('picker')
    const blocked: string[] = []
    wm.on('modalblocked', ({ window: win }) => blocked.push(win.id))
    expect(wm.focus('other')).toBe(false)
    expect(blocked).toEqual(['dialog'])
    expect(focused(wm)).toBe('picker')
    expect(wm.focus('dialog')).toBe(true)
    expect([wm.cycleFocus(), wm.cycleFocus()].sort()).toEqual(['dialog', 'picker'])
  })

  it('hands the focus to the modal when a window of its family leaves the modal layer', () => {
    const wm = desk()
    wm.open({ id: 'plain' })
    wm.open({ id: 'dialog', layer: 'modal' })
    wm.open({ id: 'second', layer: 'modal' })
    wm.open({ id: 'picker', owner: 'second' })
    wm.update('second', { layer: 'normal' })
    expect(focused(wm)).toBe('dialog')
    expect(order(wm)).toEqual(['plain', 'second', 'picker', 'dialog'])
  })
})

describe('a saved desktop keeps its families', () => {
  it('comes back with the same owners in the same order', () => {
    const wm = asking()
    wm.open({ id: 'regex', owner: 'find' })
    const copy = saved(wm, () => {})
    expect(owners(copy)).toEqual(owners(wm))
    expect(order(copy)).toEqual(['other', 'doc', 'find', 'regex', 'ask'])
    expect(order(copy)).toEqual(order(wm))
    expect(focused(copy)).toBe('ask')
  })

  it('reads a desktop saved before windows had owners', () => {
    const copy = saved(family(), (data) => {
      for (const win of data.windows) delete win.ownerId
    })
    expect(owners(copy)).toEqual({ other: null, doc: null, find: null })
  })

  it('drops an owner that is missing, is the window itself or closes a circle', () => {
    const copy = saved(family(), (data) => {
      entry(data, 'other').ownerId = 'nobody'
      entry(data, 'doc').ownerId = 'find'
      entry(data, 'find').ownerId = 'doc'
    })
    expect(owners(copy)).toEqual({ other: null, doc: null, find: 'doc' })
    const self = saved(family(), (data) => {
      entry(data, 'find').ownerId = 'find'
      entry(data, 'doc').ownerId = 7 as unknown as string
    })
    expect(owners(self)).toEqual({ other: null, doc: null, find: null })
  })

  it('drops an owner when either window sits in a tab group', () => {
    const wm = family()
    wm.open({ id: 'tab' })
    wm.group(['other', 'tab'])
    const copy = saved(wm, (data) => {
      entry(data, 'find').ownerId = 'other'
      entry(data, 'tab').ownerId = 'doc'
    })
    expect(owners(copy)).toMatchObject({ find: null, tab: null })
    expect(Object.keys(copy.getState().groups)).toHaveLength(1)
  })

  it('drops an owner on another workspace or in another minimized state', () => {
    const apart = saved(family(), (data) => {
      entry(data, 'find').workspace = 3
    })
    expect(apart.get('find')).toMatchObject({ ownerId: null, workspace: 3 })
    const hidden = saved(family(), (data) => {
      entry(data, 'find').stage = 'minimized'
    })
    expect(hidden.get('find')).toMatchObject({ ownerId: null, stage: 'minimized' })
  })

  it('puts a family back together when the saved order scatters it', () => {
    const wm = family()
    wm.open({ id: 'regex', owner: 'find' })
    const copy = saved(wm, (data) => {
      data.order = ['regex', 'find', 'other', 'doc']
    })
    expect(order(copy)).toEqual(['other', 'doc', 'find', 'regex'])
  })

  it('keeps the layer of the root when the saved order mixes the layers', () => {
    const wm = desk()
    wm.open({ id: 'pinned', layer: 'floating' })
    wm.open({ id: 'tool', owner: 'pinned' })
    wm.open({ id: 'plain' })
    const copy = saved(wm, (data) => {
      data.order = ['tool', 'pinned', 'plain']
    })
    expect(order(copy)).toEqual(['plain', 'pinned', 'tool'])
  })

  it('hands the focus to the modal of the family when the saved focus sits behind it', () => {
    const copy = saved(asking(), (data) => {
      data.focusedId = 'doc'
    })
    expect(focused(copy)).toBe('ask')
  })
})

describe('a request to close an owner asks for its whole family', () => {
  it('shows every guard the window and each of its descendants', async () => {
    const wm = family()
    wm.open({ id: 'regex', owner: 'find' })
    const asked: string[] = []
    wm.onBeforeClose((win) => {
      asked.push(win.id)
    })
    await expect(wm.requestClose('doc')).resolves.toBe(true)
    expect(asked).toEqual(['doc', 'find', 'regex'])
    expect(order(wm)).toEqual(['other'])
  })

  it('keeps the whole family when a guard refuses a descendant', async () => {
    const wm = family()
    wm.onBeforeClose((win) => win.id !== 'find')
    await expect(wm.requestClose('doc')).resolves.toBe(false)
    expect(order(wm)).toEqual(['other', 'doc', 'find'])
  })

  it('waits for a guard of a descendant that answers later', async () => {
    const wm = family()
    let answer!: (close: boolean) => void
    wm.onBeforeClose((win) =>
      win.id === 'find' ? new Promise<boolean>((resolve) => (answer = resolve)) : undefined,
    )
    const request = wm.requestClose('doc')
    expect(order(wm)).toEqual(['other', 'doc', 'find'])
    answer(true)
    await expect(request).resolves.toBe(true)
    expect(order(wm)).toEqual(['other'])
  })

  it('does not ask for a descendant that closed while a guard was thinking', async () => {
    const wm = family()
    const asked: string[] = []
    let answer!: (close: boolean) => void
    wm.onBeforeClose((win) => {
      asked.push(win.id)
      return win.id === 'doc' ? new Promise<boolean>((resolve) => (answer = resolve)) : undefined
    })
    const request = wm.requestClose('doc')
    wm.close('find')
    answer(true)
    await expect(request).resolves.toBe(true)
    expect(asked).toEqual(['doc'])
  })
})
