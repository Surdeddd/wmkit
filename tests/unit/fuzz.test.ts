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

function numbersOf(win: WindowState): number[] {
  const boxes = [win.bounds, win.restoreBounds, win.snapRect].flatMap((box) =>
    box ? [box.x, box.y, box.width, box.height] : [],
  )
  const caps = win.maxSize
    ? [win.maxSize.width, win.maxSize.height].filter((value) => value !== Infinity)
    : []
  return [
    ...boxes,
    ...caps,
    win.minSize.width,
    win.minSize.height,
    win.openedSeq,
    win.workspace,
    win.aspectRatio ?? 1,
  ]
}

function sizeRange(
  state: ManagerState,
  win: WindowState,
): { width: [number, number]; height: [number, number] } {
  const members = win.groupId ? (state.groups[win.groupId]?.members ?? [win.id]) : [win.id]
  let [minW, minH, maxW, maxH] = [1, 1, Infinity, Infinity]
  let ratio: number | null = null
  for (const id of members) {
    const member = state.windows[id] as WindowState
    minW = Math.max(minW, member.minSize.width)
    minH = Math.max(minH, member.minSize.height)
    maxW = Math.min(maxW, member.maxSize?.width ?? Infinity)
    maxH = Math.min(maxH, member.maxSize?.height ?? Infinity)
    if (member.aspectRatio !== null) ratio = Math.min(ratio ?? Infinity, member.aspectRatio)
  }
  if (ratio !== null) {
    ;[minW, maxW, minH, maxH] = [
      Math.max(minW, minH * ratio),
      Math.min(maxW, maxH * ratio),
      Math.max(minH, minW / ratio),
      Math.min(maxH, maxW / ratio),
    ]
  }
  return { width: [Math.min(minW, maxW), maxW], height: [Math.min(minH, maxH), maxH] }
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
    const fullSize = win.stage === 'maximized' || win.restoreStage === 'maximized'
    const range = sizeRange(state, win)
    if (!fullSize && win.bounds.width < range.width[0] - 0.5) {
      found.push(`${label}: ${id} is narrower than its minimum`)
    }
    if (!fullSize && win.bounds.height < range.height[0] - 0.5) {
      found.push(`${label}: ${id} is shorter than its minimum`)
    }
    if (!fullSize && win.bounds.width > range.width[1] + 0.5) {
      found.push(`${label}: ${id} is wider than its maximum`)
    }
    if (!fullSize && win.bounds.height > range.height[1] + 0.5) {
      found.push(`${label}: ${id} is taller than its maximum`)
    }
    for (const value of numbersOf(win)) {
      if (!Number.isFinite(value)) found.push(`${label}: ${id} holds the number ${value}`)
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

const BAD = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined, -5, 0]

function hostile(wm: WindowManager, id: string, pick: <T>(items: readonly T[]) => T): void {
  const bad = () => pick(BAD) as number
  switch (pick([0, 1, 2, 3, 4, 5, 6] as const)) {
    case 0:
      wm.move(id, bad(), 10)
      break
    case 1:
      wm.resize(id, { width: bad(), height: pick([undefined, 300, bad()]) })
      break
    case 2:
      wm.snapTo(id, { x: bad(), y: pick([0, 2, -1]), width: pick([0.5, 3, bad()]), height: 1 })
      break
    case 3:
      wm.update(id, {
        minSize: { width: bad(), height: 100 },
        maxSize: { width: bad(), height: 400 },
      })
      break
    case 4:
      wm.open({
        x: bad(),
        y: bad(),
        width: bad(),
        height: bad(),
        minWidth: bad(),
        maxHeight: bad(),
      })
      break
    case 5:
      wm.restoreTo(id, { x: bad(), y: 0, width: 300, height: bad() })
      break
    default:
      wm.setViewport({ width: bad(), height: 600 })
      break
  }
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
      case 23:
        if (id) hostile(wm, id, pick)
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

interface Picture {
  windows: Record<string, unknown>
  order: readonly string[]
  focusedId: string | null
  workspace: number
  groups: Record<string, unknown>
  extensions: Record<string, unknown>
}

function picture(state: ManagerState): Picture {
  return JSON.parse(
    JSON.stringify({
      windows: { ...state.windows },
      order: state.order,
      focusedId: state.focusedId,
      workspace: state.workspace,
      groups: { ...state.groups },
      extensions: state.extensions,
    }),
  )
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonical((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

function focusOnly(a: Picture, b: Picture): boolean {
  return (
    !same(a, b) && same({ ...a, order: [], focusedId: null }, { ...b, order: [], focusedId: null })
  )
}

function forced(a: ManagerState, b: ManagerState): boolean {
  return Object.keys(b.windows).some((id) => {
    const x = a.windows[id]
    const y = b.windows[id] as WindowState
    return !!x && (x.meta !== y.meta || x.minSize !== y.minSize || x.maxSize !== y.maxSize)
  })
}

const READS = new Set(['on', 'subscribe', 'getState', 'get', 'canUndo', 'canRedo', 'minimized'])

function mirror(real: WindowManager, twin: WindowManager, mismatch: (name: string) => void) {
  return new Proxy(real, {
    get(target, name: string) {
      const value = (target as unknown as Record<string, unknown>)[name]
      if (typeof value !== 'function' || READS.has(name)) return value
      if (name === 'batch') return (run: () => void) => real.batch(() => twin.batch(run))
      return (...args: unknown[]) => {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args)
        const echo = (twin as unknown as Record<string, (...a: unknown[]) => unknown>)[name]
        const other = echo?.apply(twin, args)
        if (typeof result === 'boolean' && result !== other) mismatch(name)
        return result
      }
    },
  })
}

function cancelledGesture(
  wm: WindowManager,
  id: string,
  pick: <T>(items: readonly T[]) => T,
): void {
  const win = wm.get(id)
  if (win?.stage !== 'normal') return
  const { x, y } = win.bounds
  const gesture = () => {
    wm.beginInteraction()
    wm.move(id, x + 37, y + 23)
    if (pick([false, true])) {
      wm.beginInteraction()
      wm.move(id, x - 41, y + 5)
      wm.abortInteraction()
    }
    wm.move(id, x, y)
    wm.abortInteraction()
  }
  if (pick([false, true])) wm.batch(gesture)
  else gesture()
}

function audit(seed: number, steps: number, report: string[]): void {
  const random = rng(seed)
  const options = { viewport: { width: 1280, height: 800 }, historyLimit: 30 }
  const real = createWindowManager(options)
  const twin = createWindowManager(options)
  let label = `seed ${seed} start`
  const wm = mirror(real, twin, (name) =>
    report.push(`${label}: ${name}() differs after a cancelled gesture`),
  )
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const anyId = (): string | null => {
    const ids = wm.getState().order
    return ids.length === 0 ? null : (pick(ids) as string)
  }
  const live = new Set<string>()
  wm.on('open', ({ window: win }) => {
    if (live.has(win.id)) report.push(`seed ${seed}: open twice for ${win.id}`)
    live.add(win.id)
  })
  wm.on('close', ({ window: win }) => {
    if (!live.has(win.id)) report.push(`seed ${seed}: close for unknown ${win.id}`)
    live.delete(win.id)
  })
  let changes = 0
  wm.subscribe(() => {
    changes += 1
  })

  const act = (): string => {
    const id = anyId()
    const name = pick([
      'open',
      'close',
      'focus',
      'focus',
      'focus',
      'minimize',
      'maximize',
      'restore',
      'snap',
      'snapTo',
      'move',
      'resize',
      'restoreTo',
      'group',
      'ungroup',
      'activateTab',
      'workspace',
      'extension',
      'constraints',
      'layer',
      'sendToBack',
      'arrange',
      'minimizeAll',
      'restoreAll',
      'closeAll',
      'hostile',
      'roundTrip',
      'roundTrip',
    ] as const)
    switch (name) {
      case 'roundTrip': {
        const state = wm.getState()
        const { order, focusedId } = state
        const below = order.at(-2)
        const win = below ? state.windows[below] : undefined
        const hidden = win?.groupId && state.groups[win.groupId]?.activeId !== below
        if (!below || !win || focusedId !== order.at(-1) || hidden) break
        if (win.stage === 'minimized' || win.workspace !== state.workspace) break
        wm.focus(below)
        if (random() < 0.5) cancelledGesture(real, below, pick)
        wm.focus(focusedId)
        break
      }
      case 'open':
        wm.open({
          width: 120 + Math.floor(random() * 400),
          height: 120 + Math.floor(random() * 300),
          minWidth: 100 + Math.floor(random() * 120),
          minHeight: 80 + Math.floor(random() * 120),
          maxWidth: random() < 0.3 ? 300 + Math.floor(random() * 400) : undefined,
          maxHeight: random() < 0.3 ? 250 + Math.floor(random() * 300) : undefined,
          aspectRatio: random() < 0.2 ? 0.5 + random() * 2 : undefined,
          layer: pick(['normal', 'normal', 'floating', 'modal'] as const),
          workspace: Math.floor(random() * 3),
          stage: pick(['normal', 'normal', 'normal', 'minimized', 'maximized'] as const),
        })
        break
      case 'group': {
        const ids = wm.getState().order
        if (ids.length >= 2) wm.group([pick(ids) as string, pick(ids) as string])
        break
      }
      case 'workspace':
        if (random() < 0.5) wm.setWorkspace(Math.floor(random() * 3))
        else if (id) wm.moveToWorkspace(id, Math.floor(random() * 3))
        break
      case 'extension':
        wm.setExtension(
          pick(['dock', 'notes']),
          random() < 0.2 ? undefined : { n: Math.floor(random() * 5) },
        )
        break
      case 'arrange':
        wm.arrange(random() < 0.5 ? 'tile' : 'cascade')
        break
      case 'minimizeAll':
        wm.minimizeAll()
        break
      case 'restoreAll':
        wm.restoreAll()
        break
      case 'closeAll':
        if (random() < 0.15) wm.closeAll()
        break
      default:
        if (!id) break
        if (name === 'close') wm.close(id)
        else if (name === 'focus') wm.focus(id)
        else if (name === 'minimize') wm.minimize(id)
        else if (name === 'maximize') wm.maximize(id)
        else if (name === 'restore') wm.restore(id)
        else if (name === 'snap') wm.snap(id, pick(ZONES))
        else if (name === 'ungroup') wm.ungroup(id)
        else if (name === 'activateTab') wm.activateTab(id)
        else if (name === 'sendToBack') wm.sendToBack(id)
        else if (name === 'hostile') hostile(wm, id, pick)
        else if (name === 'layer') {
          wm.update(id, { layer: pick(['normal', 'floating', 'modal'] as const) })
        } else if (name === 'snapTo') {
          const x = Math.floor(random() * 3) / 4
          const y = Math.floor(random() * 3) / 4
          wm.snapTo(id, { x, y, width: (1 - x) * (0.5 + random() / 2), height: 1 - y })
        } else if (name === 'move') {
          wm.move(id, Math.floor(random() * 1400) - 200, Math.floor(random() * 900) - 200)
        } else if (name === 'resize') {
          wm.resize(id, { width: Math.floor(random() * 700), height: Math.floor(random() * 500) })
        } else if (name === 'restoreTo') {
          wm.restoreTo(id, {
            x: Math.floor(random() * 1400) - 200,
            y: Math.floor(random() * 900) - 200,
            width: Math.floor(random() * 700),
            height: Math.floor(random() * 500),
          })
        } else {
          wm.update(id, {
            minSize:
              random() < 0.5
                ? {
                    width: 80 + Math.floor(random() * 300),
                    height: 60 + Math.floor(random() * 200),
                  }
                : undefined,
            maxSize:
              random() < 0.4
                ? random() < 0.3
                  ? null
                  : {
                      width: 200 + Math.floor(random() * 600),
                      height: 150 + Math.floor(random() * 500),
                    }
                : undefined,
            aspectRatio: random() < 0.3 ? (random() < 0.5 ? null : 0.5 + random() * 2) : undefined,
          })
        }
        break
    }
    return name
  }

  const compare = () => {
    if (
      !same(picture(real.getState()), picture(twin.getState())) ||
      real.canUndo() !== twin.canUndo() ||
      real.canRedo() !== twin.canRedo()
    ) {
      report.push(`${label}: a cancelled gesture changed the state or the history`)
    }
  }
  let chain: Picture | 'unknown' | null = null
  for (let step = 0; step < steps; step += 1) {
    compare()
    const gestureId = random() < 0.15 ? anyId() : null
    if (gestureId) cancelledGesture(real, gestureId, pick)
    const stateBefore = wm.getState()
    const before = picture(stateBefore)
    const changesBefore = changes
    const mode = random()
    const names: string[] = []
    let recorded = true
    let merges = true
    if (mode < 0.05) {
      names.push('setViewport')
      recorded = false
      wm.setViewport({
        width: 320 + Math.floor(random() * 1600),
        height: 240 + Math.floor(random() * 900),
      })
    } else if (mode < 0.08) {
      names.push('hydrate')
      recorded = false
      wm.hydrate(JSON.parse(JSON.stringify(wm.serialize())))
    } else if (mode < 0.16) {
      names.push('batch')
      wm.batch(() => {
        for (let i = 1 + Math.floor(random() * 3); i > 0; i -= 1) names.push(act())
      })
    } else if (mode < 0.24) {
      names.push('interaction')
      merges = false
      wm.beginInteraction()
      for (let i = 1 + Math.floor(random() * 4); i > 0; i -= 1) names.push(act())
      if (random() < 0.3) {
        wm.beginInteraction()
        names.push(act())
        wm.abortInteraction()
      }
      wm.endInteraction()
    } else {
      names.push(act())
    }
    label = `seed ${seed} step ${step} [${names.join(',')}]`
    const stateAfter = wm.getState()
    const after = picture(stateAfter)

    if (!same(picture(stateBefore), before)) report.push(`${label}: an earlier snapshot changed`)
    if ((stateAfter !== stateBefore) !== changes > changesBefore) {
      report.push(`${label}: snapshot identity disagrees with the change events`)
    }
    if (!same([...live].sort(), Object.keys(stateAfter.windows).sort())) {
      report.push(`${label}: open and close events disagree with state.windows`)
    }
    for (const id of Object.keys(stateAfter.windows)) {
      const next = stateAfter.windows[id] as WindowState
      const prev = stateBefore.windows[id]
      const owned = prev && forced({ ...stateBefore, windows: { [id]: prev } }, stateAfter)
      if (
        names.length === 1 &&
        names[0] !== 'roundTrip' &&
        prev &&
        prev !== next &&
        same(prev, next) &&
        !owned
      ) {
        report.push(`${label}: ${id} was replaced by an equal object`)
      }
      if (next.stage === 'snapped' && next.snapZone === null && next.snapRect === null) {
        report.push(`${label}: ${id} is snapped to nothing`)
      }
    }
    for (const message of violations(stateAfter, label)) report.push(message)

    const copy = createWindowManager({ viewport: stateAfter.viewport })
    if (!copy.hydrate(JSON.parse(JSON.stringify(wm.serialize())))) {
      report.push(`${label}: hydrate refused the serialized state`)
    } else if (!same(picture(copy.getState()), after)) {
      report.push(`${label}: hydrate(serialize()) differs`)
    }

    const owned = forced(stateBefore, stateAfter)
    let target: Picture | undefined
    if (recorded && (owned || !same(before, after))) {
      const merged = merges && chain !== null && focusOnly(before, after)
      const known = merged && chain !== 'unknown' && !same(chain, after)
      target = !merged ? before : known ? (chain as Picture) : undefined
      if (target && !wm.canUndo()) report.push(`${label}: the state changed but canUndo() is false`)
    }
    chain = null
    const pre = wm.getState()
    if (!wm.undo()) continue
    const post = wm.getState()
    const undone = picture(post)
    if (same(undone, picture(pre)) && !forced(pre, post)) {
      report.push(`${label}: undo returned true but changed nothing`)
    }
    if (target && !same(undone, target)) report.push(`${label}: undo missed its target`)
    if (random() < 0.2) {
      chain = 'unknown'
      continue
    }
    wm.redo()
    if (!same(picture(wm.getState()), after)) report.push(`${label}: redo missed its target`)
    chain = focusOnly(undone, after) ? undone : null
  }
  compare()
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

  it('keeps history, events and persistence truthful over long random runs', () => {
    const report: string[] = []
    for (let seed = 1; seed <= 24; seed += 1) audit(seed, 200, report)
    for (const seed of [59, 127, 185]) audit(seed, 250, report)
    expect(report.slice(0, 6)).toEqual([])
  }, 120_000)

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
