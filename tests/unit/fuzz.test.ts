import { describe, expect, it } from 'vitest'
import { boundsEqual, clampToViewport } from '../../src/core/geometry'
import { createWindowManager } from '../../src/core/manager'
import type { ManagerState, SnapZone, WindowManager, WindowState } from '../../src/core/types'

const LAYER_RANK = { normal: 0, floating: 1, modal: 2 } as const
const ZONES: SnapZone[] = [
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'left-third',
  'center-third',
  'right-third',
]

function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function visibleIds(state: ManagerState): string[] {
  return state.order.filter((id) => {
    const win = state.windows[id]
    return (
      win !== undefined &&
      win.stage !== 'minimized' &&
      win.workspace === state.workspace &&
      (win.groupId === null || state.groups[win.groupId]?.activeId === id)
    )
  })
}

function modalsOf(state: ManagerState, ids: string[]): string[] {
  return ids.filter((id) => state.windows[id]?.layer === 'modal')
}

function unreachable(wm: WindowManager, label: string): string[] {
  const found: string[] = []
  for (const direction of [1, -1] as const) {
    const copy = createWindowManager({ viewport: wm.getState().viewport })
    copy.hydrate(wm.serialize())
    const visible = visibleIds(copy.getState())
    const modals = modalsOf(copy.getState(), visible)
    const targets = modals.length > 0 ? modals : visible
    const seen = new Set(
      targets.flatMap(() => [copy.cycleFocus(direction), copy.cycleFocus(direction)]),
    )
    for (const id of targets) {
      if (!seen.has(id)) found.push(`${label}: cycleFocus(${direction}) never reaches ${id}`)
    }
  }
  return found
}

function violations(state: ManagerState, label: string): string[] {
  const found: string[] = []
  const ids = Object.keys(state.windows)

  if (state.order.length !== ids.length) {
    found.push(`${label}: order holds ${state.order.length} of ${ids.length} windows`)
  }
  if (new Set(state.order).size !== state.order.length) {
    found.push(`${label}: order holds a duplicate`)
  }
  for (const id of state.order) {
    if (!state.windows[id]) found.push(`${label}: order holds unknown window ${id}`)
  }

  let rank = -1
  for (const id of state.order) {
    const win = state.windows[id]
    if (!win) continue
    const next = LAYER_RANK[win.layer]
    if (next < rank) found.push(`${label}: ${id} (${win.layer}) sits above a higher layer`)
    rank = Math.max(rank, next)
  }

  for (const id of ids) {
    const win = state.windows[id] as WindowState
    if (win.bounds.width < win.minSize.width - 0.5) {
      found.push(`${label}: ${id} is narrower than its minimum`)
    }
    if (win.bounds.height < win.minSize.height - 0.5) {
      found.push(`${label}: ${id} is shorter than its minimum`)
    }
    if (win.maxSize && win.bounds.width > win.maxSize.width + 0.5) {
      found.push(`${label}: ${id} is wider than its maximum`)
    }
    if (!Number.isFinite(win.bounds.x) || !Number.isFinite(win.bounds.y)) {
      found.push(`${label}: ${id} has non-finite bounds`)
    }
    if (win.stage !== 'minimized' && win.restoreStage === 'minimized') {
      found.push(`${label}: ${id} would restore into a minimized stage`)
    }
    if (
      win.stage === 'normal' &&
      !boundsEqual(clampToViewport(win.bounds, state.viewport, 48), win.bounds)
    ) {
      found.push(`${label}: ${id} sits outside the viewport`)
    }
  }

  const modal = modalsOf(state, visibleIds(state))[0]
  const focused = state.focusedId ? state.windows[state.focusedId] : undefined
  if (modal && focused && focused.layer !== 'modal') {
    found.push(`${label}: focus sits on ${focused.id} behind modal ${modal}`)
  }

  if (state.focusedId !== null) {
    const win = state.windows[state.focusedId]
    if (!win) found.push(`${label}: focus points at a missing window`)
    else if (win.stage === 'minimized') found.push(`${label}: focus sits on a minimized window`)
    else if (win.workspace !== state.workspace) {
      found.push(`${label}: focus sits on another workspace`)
    } else if (win.groupId && state.groups[win.groupId]?.activeId !== win.id) {
      found.push(`${label}: focus sits on a hidden tab`)
    }
  }

  for (const [groupId, group] of Object.entries(state.groups)) {
    if (group.members.length < 2) {
      found.push(`${label}: group ${groupId} kept ${group.members.length} member(s)`)
    }
    if (!group.members.includes(group.activeId)) {
      found.push(`${label}: group ${groupId} points at a non-member`)
    }
    const host = state.windows[group.activeId]
    for (const memberId of group.members) {
      const member = state.windows[memberId]
      if (!member) {
        found.push(`${label}: group ${groupId} lists missing ${memberId}`)
        continue
      }
      if (member.groupId !== groupId) found.push(`${label}: ${memberId} disowns ${groupId}`)
      if (!host) continue
      if (member.stage !== host.stage) found.push(`${label}: ${memberId} drifted in stage`)
      if (member.workspace !== host.workspace) {
        found.push(`${label}: ${memberId} drifted to another workspace`)
      }
      if (member.layer !== host.layer) found.push(`${label}: ${memberId} drifted in layer`)
      if (
        member.bounds.x !== host.bounds.x ||
        member.bounds.y !== host.bounds.y ||
        member.bounds.width !== host.bounds.width ||
        member.bounds.height !== host.bounds.height
      ) {
        found.push(`${label}: ${memberId} drifted in bounds`)
      }
    }
  }

  for (const id of ids) {
    const win = state.windows[id] as WindowState
    if (win.groupId !== null && !state.groups[win.groupId]) {
      found.push(`${label}: ${id} points at a dissolved group`)
    }
  }

  return found
}

function drive(wm: WindowManager, seed: number, steps: number): string[] {
  const random = rng(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const anyId = (): string | null => {
    const ids = wm.getState().order
    return ids.length === 0 ? null : (pick(ids) as string)
  }
  const found: string[] = []
  const echoes: string[] = []
  let announced: string | undefined
  wm.on('focus', ({ window: win, previous }) => {
    if (previous === win.id) echoes.push(win.id)
    announced = win.id
  })

  for (let step = 0; step < steps; step += 1) {
    const id = anyId()
    const before = wm.getState().focusedId
    announced = undefined
    const action = Math.floor(random() * 27)
    switch (action) {
      case 0:
        wm.open({
          width: 120 + Math.floor(random() * 400),
          height: 120 + Math.floor(random() * 300),
          minWidth: 100 + Math.floor(random() * 120),
          minHeight: 80 + Math.floor(random() * 120),
          layer: pick(['normal', 'floating', 'modal'] as const),
          workspace: Math.floor(random() * 3),
        })
        break
      case 1:
        if (id) wm.close(id)
        break
      case 2:
        if (id) wm.focus(id)
        break
      case 3:
        if (id) wm.minimize(id)
        break
      case 4:
        if (id) wm.maximize(id)
        break
      case 5:
        if (id) wm.restore(id)
        break
      case 6:
        if (id) wm.snap(id, pick(ZONES))
        break
      case 7:
        if (id) wm.move(id, Math.floor(random() * 1400) - 200, Math.floor(random() * 900) - 200)
        break
      case 8:
        if (id) {
          wm.resize(id, {
            width: Math.floor(random() * 700),
            height: Math.floor(random() * 500),
          })
        }
        break
      case 9:
        wm.setWorkspace(Math.floor(random() * 3))
        break
      case 10:
        if (id) wm.moveToWorkspace(id, Math.floor(random() * 3))
        break
      case 11: {
        const ids = wm.getState().order
        if (ids.length >= 2) wm.group([pick(ids) as string, pick(ids) as string])
        break
      }
      case 12:
        if (id) wm.ungroup(id)
        break
      case 13:
        if (id) wm.activateTab(id)
        break
      case 14:
        wm.undo()
        break
      case 15:
        wm.redo()
        break
      case 16:
        wm.arrange(random() < 0.5 ? 'tile' : 'cascade')
        break
      case 17:
        wm.setViewport({
          width: 320 + Math.floor(random() * 1600),
          height: 240 + Math.floor(random() * 900),
        })
        break
      case 18:
        random() < 0.5 ? wm.minimizeAll() : wm.restoreAll()
        break
      case 19:
        if (id) wm.update(id, { layer: pick(['normal', 'floating', 'modal'] as const) })
        break
      case 20:
        if (id) wm.sendToBack(id)
        break
      case 21:
        if (id) wm.moveTab(id, Math.floor(random() * 5) - 1)
        break
      case 22:
        wm.cycleTab(random() < 0.5 ? 1 : -1)
        break
      case 24:
        wm.blur()
        break
      case 25:
        wm.hydrate(wm.serialize())
        break
      case 26:
        random() < 0.5 ? wm.saveLayout('l') : wm.loadLayout('l')
        break
      default:
        wm.cycleFocus(random() < 0.5 ? 1 : -1)
        break
    }
    const label = `seed ${seed} step ${step} action ${action}`
    found.push(...violations(wm.getState(), label), ...unreachable(wm, label))
    for (const id of echoes.splice(0)) found.push(`${label}: focus re-announced ${id}`)
    const after = wm.getState().focusedId
    if (after !== null && (announced ?? before) !== after) {
      found.push(`${label}: focus moved to ${after} but the last focus event named ${announced}`)
    }
    if (found.length > 0) return found
  }
  return found
}

describe('random operation sequences keep the state machine honest', () => {
  for (const seed of [1, 2, 3, 7, 11, 42, 99, 1234, 31337, 65535]) {
    it(`holds every invariant for seed ${seed}`, () => {
      const wm = createWindowManager({ viewport: { width: 1280, height: 800 }, historyLimit: 20 })
      expect(drive(wm, seed, 400)).toEqual([])
    })
  }

  it('round trips any reachable state through serialize and hydrate', () => {
    for (const seed of [5, 17, 23, 404]) {
      const wm = createWindowManager({ viewport: { width: 1280, height: 800 }, historyLimit: 10 })
      drive(wm, seed, 160)

      const data = wm.serialize()
      const copy = createWindowManager({ viewport: wm.getState().viewport })
      expect(copy.hydrate(data), `seed ${seed} refused its own snapshot`).toBe(true)
      expect(violations(copy.getState(), `hydrated seed ${seed}`)).toEqual([])
      expect(copy.serialize()).toEqual(data)
    }
  })

  it('re-syncs a hand-edited snapshot whose group members drifted apart', () => {
    const viewport = { width: 1280, height: 800 }
    const donor = createWindowManager({ viewport })
    donor.open({ id: 'a', x: 40, y: 40, width: 400, height: 300 })
    donor.open({ id: 'b' })
    donor.open({ id: 'c' })
    donor.group(['a', 'b'])
    donor.open({ id: 'f', layer: 'floating' })
    const data = donor.serialize()
    const raw = (id: string) => data.windows.find((win) => win.id === id) as object
    Object.assign(raw('b'), {
      bounds: { x: 900, y: 500, width: 120, height: 90 },
      stage: 'minimized',
      layer: 'modal',
      workspace: 2,
    })

    const wm = createWindowManager({ viewport })
    expect(wm.hydrate(data)).toBe(true)
    expect(violations(wm.getState(), 'hand-edited')).toEqual([])
    expect(wm.get('b')).toMatchObject({
      bounds: wm.get('a')?.bounds,
      stage: 'normal',
      layer: 'normal',
      workspace: 0,
    })
  })
})
