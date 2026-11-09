import { createEmitter } from './emitter'
import { applyAspect, boundsEqual, clamp, clampSize, clampToViewport, zoneBounds } from './geometry'
import type {
  ArrangeMode,
  Bounds,
  HistoryEntry,
  ManagerEvents,
  ManagerOptions,
  ManagerState,
  SerializedState,
  SerializedWindowState,
  Size,
  SnapZone,
  WindowGroup,
  WindowInit,
  WindowLayer,
  WindowManager,
  WindowStage,
  WindowState,
  WindowUpdate,
} from './types'

type Limits = Pick<WindowState, 'minSize' | 'maxSize' | 'aspectRatio'>

const LAYER_RANK: Record<WindowLayer, number> = { normal: 0, floating: 1, modal: 2 }
const STAGES: readonly WindowStage[] = ['normal', 'minimized', 'maximized', 'snapped']
const LAYERS: readonly WindowLayer[] = ['normal', 'floating', 'modal']
const ZONES: readonly SnapZone[] = [
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
const INFINITE = Number.POSITIVE_INFINITY
const TINY = Number.MIN_VALUE
const PLACEMENT = /^(bounds|restore|stage|snap[RZ]|group|opened)/

function normalizeWorkspace(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

function sized(size: Size): boolean {
  return size.width > 0 && size.height > 0
}

function finite(...values: unknown[]): boolean {
  return values.every(Number.isFinite)
}

function num(value: unknown, min = Number.NEGATIVE_INFINITY): number | undefined {
  return Number.isFinite(value) && (value as number) >= min ? (value as number) : undefined
}

function cap(value: unknown): number {
  return typeof value === 'number' && value > 0 ? value : INFINITE
}

function capped(width: unknown, height: unknown): Size | null {
  const size = { width: cap(width), height: cap(height) }
  return size.width < INFINITE || size.height < INFINITE ? size : null
}

function equal(a: unknown, b: unknown, depth: number): boolean {
  if (a === b) return true
  if (depth < 1 || !a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const x = a as Record<string, unknown>
  const y = b as Record<string, unknown>
  let size = 0
  for (const key in x) {
    if (!(key in y) || !equal(x[key], y[key], depth - 1)) return false
    size += 1
  }
  return size === Object.keys(y).length
}

function span(start: number, size: number): [number, number] {
  const from = clamp(start, 0, 1)
  return [from, from === start && start + size <= 1 ? size : clamp(start + size, 0, 1) - from]
}

function unitRect(rect: Bounds): Bounds | null {
  if (!finite(rect.x, rect.y, rect.width, rect.height)) return null
  const [x, width] = span(rect.x, rect.width)
  const [y, height] = span(rect.y, rect.height)
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

export function createWindowManager(options: ManagerOptions = {}): WindowManager {
  const emitter = createEmitter<ManagerEvents>()
  const keepInViewport = options.keepInViewport ?? true
  const minVisible = options.minVisible ?? 48
  const defaultSize = options.defaultSize ?? { width: 480, height: 320 }
  const cascadeOffset = options.cascadeOffset ?? 32
  const cascadeOrigin = options.cascadeOrigin ?? { x: 32, y: 32 }
  const idPrefix = options.idPrefix ?? 'wm'
  const historyLimit = options.historyLimit ?? 50

  let windows: Readonly<Record<string, WindowState>> = Object.create(null)
  let windowsShared = false
  let modalCount = 0
  let cachedGroups: Record<string, WindowGroup> | null = null
  let cachedOrder: readonly string[] | null = null
  let cachedTabs: Readonly<Record<string, string>> | null = null
  let groupsDirty = false
  let order: string[] = []
  let focusedId: string | null = null
  let viewport: Size = options.viewport ?? { width: 0, height: 0 }
  let workspace = normalizeWorkspace(options.workspace, 0)
  let activeTabs: Record<string, string> = {}
  let extensions: Record<string, unknown> = {}
  let groupCounter = 0
  let seq = 0
  let idCounter = 0
  let cascadeIndex = 0
  let snapshot: ManagerState | null = null
  let batchDepth = 0
  let batchDirty = false
  let flushing = false
  let historyDirty = false
  const pendingEvents: Array<() => void> = []
  const past: HistoryEntry[] = []
  let future: HistoryEntry[] = []
  let interactionDepth = 0
  let interactionRecorded = false
  let interactionMark: { past: HistoryEntry[]; future: HistoryEntry[] } | null = null
  let pendingHistory: HistoryEntry | null = null
  const layouts = new Map<string, SerializedState>()

  function getState(): ManagerState {
    if (!snapshot) {
      windowsShared = true
      snapshot = {
        windows,
        order,
        focusedId,
        viewport,
        workspace,
        groups: buildGroups(),
        extensions,
      }
    }
    return snapshot
  }

  function commit(): void {
    snapshot = null
    batchDirty = true
    historyDirty = true
  }

  function commitQuiet(): void {
    snapshot = null
    batchDirty = true
  }

  function flush(): void {
    let failure: { error: unknown } | undefined
    let rounds = 0
    flushing = true
    while (pendingEvents.length > 0 || batchDirty) {
      if (++rounds > 1e4) {
        flushing = false
        throw new Error('wmkit: listeners keep changing the state')
      }
      if (pendingEvents.length === 0) {
        batchDirty = false
        queueEvent(() => emitter.emit('change', { state: getState() }))
      }
      for (const emit of pendingEvents.splice(0)) {
        try {
          emit()
        } catch (error) {
          failure ??= { error }
        }
      }
    }
    flushing = false
    if (failure) throw failure.error
  }

  function queueEvent(emit: () => void): void {
    pendingEvents.push(emit)
  }

  function ownWindows(): Record<string, WindowState> {
    if (windowsShared) {
      const copy: Record<string, WindowState> = Object.create(null)
      for (const id in windows) copy[id] = windows[id] as WindowState
      windows = copy
      windowsShared = false
    }
    return windows as Record<string, WindowState>
  }

  function setWindow(next: WindowState): void {
    const map = ownWindows()
    const previous = map[next.id]
    const wasModal = previous?.layer === 'modal'
    if (wasModal !== (next.layer === 'modal')) modalCount += wasModal ? -1 : 1
    if (previous?.groupId !== next.groupId) groupsDirty = true
    map[next.id] = next
  }

  function removeWindow(id: string): void {
    const map = ownWindows()
    const previous = map[id]
    if (previous?.layer === 'modal') modalCount -= 1
    if (previous?.groupId != null) groupsDirty = true
    delete map[id]
    order = order.filter((entry) => entry !== id)
  }

  function countModals(): number {
    let total = 0
    for (const id of order) {
      if ((windows[id] as WindowState).layer === 'modal') total += 1
    }
    return total
  }

  function layerRankOf(id: string): number {
    return LAYER_RANK[(windows[id] as WindowState).layer]
  }

  function sortByLayer(ids: string[]): string[] {
    return ids
      .map((id, index) => ({ id, index, rank: layerRankOf(id) }))
      .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index))
      .map((entry) => entry.id)
  }

  function blockOf(id: string): string[] {
    const win = windows[id] as WindowState
    return win.groupId === null ? [id] : membersOf(win.groupId)
  }

  function raise(id: string): boolean {
    const win = windows[id] as WindowState
    const block = blockOf(id)
    const without = order.filter((entry) => !block.includes(entry))
    const rank = LAYER_RANK[win.layer]
    let insertAt = without.length
    for (let i = without.length - 1; i >= 0; i -= 1) {
      if (layerRankOf(without[i] as string) > rank) insertAt = i
      else break
    }
    const next = [...without.slice(0, insertAt), ...block, ...without.slice(insertAt)]
    const changed = next.length !== order.length || next.some((entry, i) => entry !== order[i])
    if (changed) order = next
    return changed
  }

  function lift(ids: string[]): void {
    const last = ids.at(-1)
    if (last === undefined) return
    const rank = new Map<string, number>()
    const keyOf = (id: string) => (windows[id] as WindowState).groupId ?? id
    ids.forEach((id, index) => {
      rank.set(keyOf(id), index)
    })
    const position = (id: string) => rank.get(keyOf(id)) ?? -1
    const next = [...order].sort(
      (a, b) => layerRankOf(a) - layerRankOf(b) || position(a) - position(b),
    )
    if (!equal(next, order, 1)) {
      order = next
      queueEvent(() => emitter.emit('order', { order }))
      commit()
    }
    focus(topModalId() ?? last, true)
  }

  function onActiveWorkspace(win: WindowState): boolean {
    return win.workspace === workspace
  }

  function membersOf(groupId: string): string[] {
    return order.filter((entry) => (windows[entry] as WindowState).groupId === groupId)
  }

  function isVisibleTab(win: WindowState): boolean {
    return win.groupId === null || activeTabs[win.groupId] === win.id
  }

  function buildGroups(): Record<string, WindowGroup> {
    if (cachedGroups && !groupsDirty && cachedOrder === order && cachedTabs === activeTabs) {
      return cachedGroups
    }
    const result: Record<string, WindowGroup> = Object.create(null)
    for (const [groupId, activeId] of Object.entries(activeTabs)) {
      result[groupId] = { id: groupId, activeId, members: membersOf(groupId) }
    }
    cachedGroups = result
    cachedOrder = order
    cachedTabs = activeTabs
    groupsDirty = false
    return result
  }

  function limits(win: WindowState, ids?: readonly string[]): Limits {
    if (!ids) {
      if (win.groupId === null) return win
      ids = membersOf(win.groupId)
    }
    const minSize = { width: 0, height: 0 }
    const maxSize = { width: INFINITE, height: INFINITE }
    let aspectRatio: number | null = null
    for (const id of ids) {
      const member = id === win.id ? win : (windows[id] as WindowState)
      minSize.width = Math.max(minSize.width, member.minSize.width)
      minSize.height = Math.max(minSize.height, member.minSize.height)
      maxSize.width = Math.min(maxSize.width, member.maxSize?.width ?? INFINITE)
      maxSize.height = Math.min(maxSize.height, member.maxSize?.height ?? INFINITE)
      if (member.aspectRatio !== null) {
        aspectRatio = Math.min(aspectRatio ?? INFINITE, member.aspectRatio)
      }
    }
    return { minSize, maxSize, aspectRatio }
  }

  function refit(win: WindowState, lim = limits(win)): WindowState {
    if (win.stage === 'maximized' || win.restoreStage === 'maximized') return win
    const target = win.stage === 'snapped' && sized(viewport) ? snapTarget(win) : null
    let bounds = win.bounds
    if (target) bounds = snapBounds(lim, target)
    else {
      const size = normalizeSize(bounds, lim)
      if (
        Math.abs(size.width - bounds.width) > 0.5 ||
        Math.abs(size.height - bounds.height) > 0.5
      ) {
        bounds = { ...bounds, ...size }
      }
      if (win.stage === 'normal' && keepInViewport) {
        bounds = clampToViewport(bounds, viewport, minVisible)
      }
    }
    return boundsEqual(bounds, win.bounds) ? win : { ...win, bounds }
  }

  function syncGroup(source: WindowState): WindowState {
    if (source.groupId === null) return source
    for (const id of membersOf(source.groupId)) {
      if (id === source.id) continue
      const member = windows[id] as WindowState
      if (
        boundsEqual(member.bounds, source.bounds) &&
        member.stage === source.stage &&
        member.snapZone === source.snapZone &&
        member.snapRect === source.snapRect &&
        member.layer === source.layer &&
        member.workspace === source.workspace
      ) {
        continue
      }
      setWindow({
        ...member,
        bounds: source.bounds,
        stage: source.stage,
        snapZone: source.snapZone,
        snapRect: source.snapRect,
        restoreBounds: source.restoreBounds,
        restoreStage: source.restoreStage,
        layer: source.layer,
        workspace: source.workspace,
      })
    }
    return source
  }

  function settleGroup(groupId: string): void {
    const members = membersOf(groupId)
    if (members.length < 2) {
      for (const id of members) setWindow(refit({ ...(windows[id] as WindowState), groupId: null }))
      const { [groupId]: _dropped, ...rest } = activeTabs
      activeTabs = rest
      return
    }
    const host = windows[activeTabs[groupId] as string] as WindowState
    const next = refit(host)
    if (next !== host) setWindow(next)
    syncGroup(next)
  }

  function topModalId(): string | null {
    if (modalCount === 0) return null
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const win = windows[order[i] as string] as WindowState
      if (
        win.layer === 'modal' &&
        win.stage !== 'minimized' &&
        onActiveWorkspace(win) &&
        isVisibleTab(win)
      ) {
        return win.id
      }
    }
    return null
  }

  function focusTargets(): string[] {
    const modal = topModalId()
    return order.filter((id) => {
      const win = windows[id] as WindowState
      if (win.stage === 'minimized' || !onActiveWorkspace(win) || !isVisibleTab(win)) return false
      if (modal && win.layer !== 'modal') return false
      return true
    })
  }

  function focusTop(): void {
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const win = windows[order[i] as string] as WindowState
      if (win.stage === 'minimized' || !onActiveWorkspace(win) || !isVisibleTab(win)) continue
      focusedId = win.id
      return
    }
    focusedId = null
  }

  function reconcileFocus(): void {
    if (focusedId === null) return
    const win = windows[focusedId]
    if (win && win.stage !== 'minimized' && onActiveWorkspace(win) && isVisibleTab(win)) return
    const previous = focusedId
    focusTop()
    if (focusedId) emitFocus(windows[focusedId] as WindowState, previous)
  }

  function emitFocus(win: WindowState, previous: string | null): void {
    queueEvent(() => emitter.emit('focus', { window: win, previous }))
  }

  function emitDiff(old: WindowState, win: WindowState): void {
    const emit = (type: 'move' | 'resize' | 'update') =>
      queueEvent(() => emitter.emit(type, { window: win }))
    if (old.stage !== win.stage) {
      queueEvent(() => emitter.emit('stage', { window: win, previous: old.stage }))
    }
    if (old.bounds.x !== win.bounds.x || old.bounds.y !== win.bounds.y) emit('move')
    if (old.bounds.width !== win.bounds.width || old.bounds.height !== win.bounds.height) {
      emit('resize')
    }
    if (
      (Object.keys(win) as (keyof WindowState)[]).some(
        (key) => old[key] !== win[key] && !PLACEMENT.test(key) && !equal(old[key], win[key], 1),
      )
    ) {
      emit('update')
    }
  }

  function normalizeSize(size: Size, lim: Limits, drive: 'width' | 'height' = 'width'): Size {
    const min = { width: Math.max(1, lim.minSize.width), height: Math.max(1, lim.minSize.height) }
    if (lim.aspectRatio === null) return clampSize(size, min, lim.maxSize)
    return applyAspect(size, lim.aspectRatio, min, lim.maxSize, drive)
  }

  function positionForOpen(init: { x?: number; y?: number }): { x: number; y: number } {
    if (init.x !== undefined && init.y !== undefined) return { x: init.x, y: init.y }
    const offset = (cascadeIndex % 10) * cascadeOffset
    cascadeIndex += 1
    const base = { x: cascadeOrigin.x + offset, y: cascadeOrigin.y + offset }
    return { x: init.x ?? base.x, y: init.y ?? base.y }
  }

  function open(init: WindowInit = {}): WindowState {
    let id = init.id
    if (!id) {
      do {
        id = `${idPrefix}-${++idCounter}`
      } while (windows[id])
    }
    if (windows[id]) throw new Error(`wmkit: window id "${id}" already exists`)

    const minSize = { width: num(init.minWidth, 0) ?? 160, height: num(init.minHeight, 0) ?? 100 }
    const maxSize = capped(init.maxWidth, init.maxHeight)
    const aspectRatio = num(init.aspectRatio, TINY) ?? null
    const width = num(init.width, TINY)
    const height = num(init.height, TINY)
    const size = normalizeSize(
      { width: width ?? defaultSize.width, height: height ?? defaultSize.height },
      { minSize, maxSize, aspectRatio },
      width === undefined && height !== undefined ? 'height' : 'width',
    )
    const position = positionForOpen({ x: num(init.x), y: num(init.y) })
    let bounds: Bounds = { ...position, ...size }
    if (keepInViewport) bounds = clampToViewport(bounds, viewport, minVisible)

    const requestedStage = init.stage ?? 'normal'
    const stage: WindowStage = requestedStage === 'snapped' ? 'normal' : requestedStage

    let win: WindowState = {
      id,
      title: init.title ?? 'Window',
      bounds,
      restoreBounds: null,
      restoreStage: null,
      stage: 'normal',
      snapZone: null,
      snapRect: null,
      layer: init.layer && LAYERS.includes(init.layer) ? init.layer : 'normal',
      workspace: normalizeWorkspace(init.workspace, workspace),
      groupId: null,
      minSize,
      maxSize,
      aspectRatio,
      openedSeq: ++seq,
      draggable: init.draggable ?? true,
      resizable: init.resizable ?? true,
      closable: init.closable ?? true,
      minimizable: init.minimizable ?? true,
      maximizable: init.maximizable ?? true,
      snappable: init.snappable ?? true,
      meta: { ...init.meta },
    }

    if (stage === 'maximized') {
      win = { ...win, stage, restoreBounds: bounds, bounds: fullBounds(bounds) }
    } else if (stage === 'minimized') {
      win = { ...win, stage, restoreStage: 'normal' }
    }

    setWindow(win)
    raise(id)
    const previous = focusedId
    if (stage !== 'minimized' && onActiveWorkspace(win)) {
      if (!topModalId() || win.layer === 'modal') focusedId = id
      else focusTop()
    }
    queueEvent(() => emitter.emit('open', { window: win }))
    if (focusedId !== previous) emitFocus(windows[focusedId as string] as WindowState, previous)
    queueEvent(() => emitter.emit('order', { order }))
    commit()
    return win
  }

  function close(id: string): boolean {
    const win = windows[id]
    if (!win) return false
    removeWindow(id)
    if (win.groupId !== null) {
      const remaining = membersOf(win.groupId)
      const wasActive = activeTabs[win.groupId] === id
      if (wasActive && remaining[0]) {
        activeTabs = { ...activeTabs, [win.groupId]: remaining[0] }
      }
      settleGroup(win.groupId)
      emitGroup(win.groupId, wasActive && remaining.length > 1 ? id : null)
    }
    queueEvent(() => emitter.emit('close', { window: win }))
    if (focusedId === id) {
      focusTop()
      if (focusedId) emitFocus(windows[focusedId] as WindowState, id)
    }
    queueEvent(() => emitter.emit('order', { order }))
    commit()
    return true
  }

  function closeAll(): void {
    if (order.length === 0) return
    const done = track()
    windows = Object.create(null)
    order = []
    activeTabs = {}
    modalCount = 0
    focusedId = null
    groupsDirty = true
    done()
    commit()
  }

  function focus(id: string, quiet?: boolean): boolean {
    const win = windows[id]
    if (!win) return false
    if (!onActiveWorkspace(win)) setWorkspace(win.workspace)
    const modal = topModalId()
    if (modal && win.layer !== 'modal') {
      const modalWin = windows[modal] as WindowState
      if (!quiet) queueEvent(() => emitter.emit('modalblocked', { window: modalWin }))
      return false
    }
    if (!isVisibleTab(win)) activateTab(id)
    if (win.stage === 'minimized') {
      restore(id)
      return focusedId === id
    }
    const previous = focusedId
    const raised = raise(id)
    focusedId = id
    if (previous !== id) emitFocus(win, previous)
    if (raised) queueEvent(() => emitter.emit('order', { order }))
    if (raised || previous !== id) commit()
    return true
  }

  function blur(): void {
    if (focusedId === null) return
    focusedId = null
    commit()
  }

  function cycleFocus(direction: 1 | -1 = 1): string | null {
    let targets = focusTargets()
    if (targets.length === 0) return null
    const from = focusedId as string
    let index = targets.indexOf(from)
    if (index === -1) index = direction === 1 ? 0 : -1
    else if (direction === 1) index += 1
    else if (targets.length > 1) {
      lower(from)
      targets = focusTargets()
      index = targets.indexOf(from) - 1
    }
    const id = targets[(index + targets.length) % targets.length] as string
    focus(id)
    return id
  }

  function fullBounds(fallback: Bounds): Bounds {
    return sized(viewport)
      ? { x: 0, y: 0, width: viewport.width, height: viewport.height }
      : fallback
  }

  function snapTarget(win: WindowState): Bounds | null {
    const rect = win.snapRect
    if (!rect) return win.snapZone ? zoneBounds(win.snapZone, viewport) : null
    const x = Math.round(rect.x * viewport.width)
    const y = Math.round(rect.y * viewport.height)
    return {
      x,
      y,
      width: Math.round((rect.x + rect.width) * viewport.width) - x,
      height: Math.round((rect.y + rect.height) * viewport.height) - y,
    }
  }

  function snapBounds(lim: Limits, rect: Bounds): Bounds {
    const byWidth = normalizeSize(rect, lim)
    const size = byWidth.height > rect.height ? normalizeSize(rect, lim, 'height') : byWidth
    return {
      x: Math.max(0, Math.min(rect.x, viewport.width - size.width)),
      y: Math.max(0, Math.min(rect.y, viewport.height - size.height)),
      ...size,
    }
  }

  function handOff(id: string): void {
    const modal = topModalId()
    if (
      modal &&
      modal !== focusedId &&
      (blockOf(id).includes(modal) ||
        (focusedId !== null && (windows[focusedId] as WindowState).layer !== 'modal'))
    ) {
      const previous = focusedId
      focusedId = modal
      emitFocus(windows[modal] as WindowState, previous)
    }
  }

  function applyStage(
    id: string,
    build: (win: WindowState) => WindowState | null,
    granular?: boolean,
  ): boolean {
    const win = windows[id]
    if (!win) return false
    const next = build(win)
    if (!next) return false
    if (equal(next, win, 2)) return true
    setWindow(next)
    syncGroup(next)
    if (granular) emitDiff(win, next)
    else queueEvent(() => emitter.emit('stage', { window: next, previous: win.stage }))
    if (next.groupId !== null) reconcileFocus()
    commit()
    return true
  }

  function minimize(id: string): boolean {
    const result = applyStage(id, (win) => {
      if (win.stage === 'minimized') return null
      return { ...win, stage: 'minimized', restoreStage: win.stage }
    })
    if (result && focusedId === id) {
      const previous = focusedId
      focusTop()
      if (focusedId) emitFocus(windows[focusedId] as WindowState, previous)
      commit()
    }
    return result
  }

  function maximize(id: string): boolean {
    const result = applyStage(id, (win) => {
      if (win.stage === 'maximized') return null
      const restoreBounds = win.stage === 'normal' ? win.bounds : (win.restoreBounds ?? win.bounds)
      return {
        ...win,
        stage: 'maximized',
        snapZone: null,
        restoreBounds,
        restoreStage: null,
        bounds: fullBounds(win.bounds),
      }
    })
    if (result) focus(id, true)
    return result
  }

  function toggleMaximize(id: string): boolean {
    const win = windows[id]
    if (!win) return false
    return win.stage === 'maximized' ? restore(id) : maximize(id)
  }

  function unminimize(id: string): boolean {
    return applyStage(id, (win) => {
      if (win.stage === 'minimized') {
        const target = win.restoreStage ?? 'normal'
        if (target === 'maximized') {
          return {
            ...win,
            stage: 'maximized',
            restoreStage: null,
            bounds: fullBounds(win.bounds),
          }
        }
        const rect = target === 'snapped' ? snapTarget(win) : null
        if (rect) {
          return {
            ...win,
            stage: 'snapped',
            restoreStage: null,
            bounds: snapBounds(limits(win), rect),
          }
        }
        return {
          ...win,
          stage: 'normal',
          restoreStage: null,
          bounds: keepInViewport ? clampToViewport(win.bounds, viewport, minVisible) : win.bounds,
        }
      }
      if (win.stage === 'normal') return null
      const docked = win.stage === 'maximized' ? snapTarget(win) : null
      if (docked) return { ...win, stage: 'snapped', bounds: snapBounds(limits(win), docked) }
      const target = win.restoreBounds ?? win.bounds
      const bounds: Bounds = { x: target.x, y: target.y, ...normalizeSize(target, limits(win)) }
      return {
        ...win,
        stage: 'normal',
        snapZone: null,
        snapRect: null,
        restoreBounds: null,
        restoreStage: null,
        bounds: keepInViewport ? clampToViewport(bounds, viewport, minVisible) : bounds,
      }
    })
  }

  function restore(id: string): boolean {
    const result = unminimize(id)
    if (result) focus(id, true)
    return result
  }

  function place(id: string, bounds: Bounds): boolean {
    return applyStage(
      id,
      (win) => {
        const next: Bounds = { x: bounds.x, y: bounds.y, ...normalizeSize(bounds, limits(win)) }
        return {
          ...win,
          stage: 'normal',
          snapZone: null,
          snapRect: null,
          restoreBounds: null,
          restoreStage: null,
          bounds: keepInViewport ? clampToViewport(next, viewport, minVisible) : next,
        }
      },
      true,
    )
  }

  function restoreTo(id: string, bounds: Bounds): boolean {
    const result = finite(bounds.x, bounds.y, bounds.width, bounds.height) && place(id, bounds)
    if (result) focus(id, true)
    return result
  }

  function snap(id: string, snapZone: SnapZone | null, snapRect: Bounds | null = null): boolean {
    const result = applyStage(id, (win) => {
      const restoreBounds = win.stage === 'normal' ? win.bounds : (win.restoreBounds ?? win.bounds)
      const next: WindowState = {
        ...win,
        stage: 'snapped',
        snapZone,
        snapRect,
        restoreBounds,
        restoreStage: null,
      }
      return { ...next, bounds: snapBounds(limits(next), snapTarget(next) as Bounds) }
    })
    if (result) {
      if (snapZone) focus(id, true)
      else handOff(id)
    }
    return result
  }

  function move(id: string, x: number, y: number): boolean {
    const win = windows[id]
    if (win?.stage !== 'normal' || !Number.isFinite(x) || !Number.isFinite(y)) return false
    let bounds: Bounds = { ...win.bounds, x, y }
    if (keepInViewport) bounds = clampToViewport(bounds, viewport, minVisible)
    if (boundsEqual(bounds, win.bounds)) return true
    const next = { ...win, bounds }
    setWindow(next)
    syncGroup(next)
    queueEvent(() => emitter.emit('move', { window: next }))
    commit()
    return true
  }

  function moveBy(id: string, dx: number, dy: number): boolean {
    const win = windows[id]
    if (!win) return false
    return move(id, win.bounds.x + dx, win.bounds.y + dy)
  }

  function resize(id: string, patch: Partial<Bounds>): boolean {
    const win = windows[id]
    if (!win || win.stage === 'maximized' || win.stage === 'minimized') return false
    const pick = (key: keyof Bounds) => patch[key] ?? win.bounds[key]
    const merged: Bounds = {
      x: pick('x'),
      y: pick('y'),
      width: pick('width'),
      height: pick('height'),
    }
    if (!finite(merged.x, merged.y, merged.width, merged.height)) return false
    const drive =
      Math.abs(merged.height - win.bounds.height) > Math.abs(merged.width - win.bounds.width)
        ? 'height'
        : 'width'
    const size = normalizeSize(merged, limits(win), drive)
    let bounds: Bounds = { x: merged.x, y: merged.y, ...size }
    if (keepInViewport) bounds = clampToViewport(bounds, viewport, minVisible)
    if (boundsEqual(bounds, win.bounds)) return true
    const becameNormal = win.stage === 'snapped'
    const next: WindowState = becameNormal
      ? { ...win, stage: 'normal', snapZone: null, snapRect: null, restoreBounds: null, bounds }
      : { ...win, bounds }
    setWindow(next)
    syncGroup(next)
    if (becameNormal) {
      queueEvent(() => emitter.emit('stage', { window: next, previous: 'snapped' }))
    }
    queueEvent(() => emitter.emit('resize', { window: next }))
    commit()
    return true
  }

  function update(id: string, patch: WindowUpdate): boolean {
    const win = windows[id]
    if (!win) return false
    const minSize = patch.minSize ? { ...patch.minSize } : win.minSize
    const maxSize =
      patch.maxSize === undefined ? win.maxSize : patch.maxSize && { ...patch.maxSize }
    if (
      num(minSize.width, 0) === undefined ||
      num(minSize.height, 0) === undefined ||
      (maxSize && !(maxSize.width > 0 && maxSize.height > 0)) ||
      (patch.layer && !LAYERS.includes(patch.layer))
    ) {
      return false
    }
    const next: WindowState = {
      ...win,
      title: patch.title ?? win.title,
      layer: patch.layer ?? win.layer,
      minSize,
      maxSize,
      aspectRatio:
        patch.aspectRatio === undefined ? win.aspectRatio : (num(patch.aspectRatio, TINY) ?? null),
      draggable: patch.draggable ?? win.draggable,
      resizable: patch.resizable ?? win.resizable,
      closable: patch.closable ?? win.closable,
      minimizable: patch.minimizable ?? win.minimizable,
      maximizable: patch.maximizable ?? win.maximizable,
      snappable: patch.snappable ?? win.snappable,
      meta: patch.meta ? { ...win.meta, ...patch.meta } : win.meta,
    }
    const finalWin =
      patch.minSize || patch.maxSize !== undefined || patch.aspectRatio !== undefined
        ? refit(next)
        : next
    if (equal(finalWin, win, 2)) return true
    const resized = !boundsEqual(finalWin.bounds, win.bounds)
    setWindow(finalWin)
    syncGroup(finalWin)
    if (patch.layer && patch.layer !== win.layer) {
      order = sortByLayer(order)
      queueEvent(() => emitter.emit('order', { order }))
      handOff(id)
    }
    queueEvent(() => emitter.emit('update', { window: finalWin }))
    if (resized) queueEvent(() => emitter.emit('resize', { window: finalWin }))
    commit()
    return true
  }

  function setViewport(next: Size): void {
    if (
      !sized(next) ||
      !finite(next.width, next.height) ||
      (next.width === viewport.width && next.height === viewport.height)
    ) {
      return
    }
    viewport = { ...next }
    reflowViewport(true)
    commitQuiet()
  }

  function switchWorkspace(next: number): void {
    const previous = workspace
    workspace = next
    if (next !== previous) {
      queueEvent(() => emitter.emit('workspace', { workspace: next, previous }))
    }
  }

  function setWorkspace(next: number): boolean {
    const target = normalizeWorkspace(next, workspace)
    if (target === workspace) return false
    switchWorkspace(target)
    const previousFocus = focusedId
    focusTop()
    if (focusedId && focusedId !== previousFocus) {
      emitFocus(windows[focusedId] as WindowState, previousFocus)
    }
    commit()
    return true
  }

  function moveToWorkspace(id: string, next: number): boolean {
    const win = windows[id]
    if (!win) return false
    const target = normalizeWorkspace(next, win.workspace)
    if (target === win.workspace) return false
    const updated = { ...win, workspace: target }
    setWindow(updated)
    syncGroup(updated)
    if (!onActiveWorkspace(updated) && focusedId === id) {
      focusTop()
      if (focusedId) emitFocus(windows[focusedId] as WindowState, id)
    } else if (updated.groupId !== null && !onActiveWorkspace(updated)) {
      reconcileFocus()
    } else {
      handOff(id)
    }
    queueEvent(() => emitter.emit('update', { window: updated }))
    commit()
    return true
  }

  function emitGroup(groupId: string, previous: string | null): void {
    const members = membersOf(groupId)
    const activeId = activeTabs[groupId] ?? ''
    queueEvent(() => emitter.emit('group', { groupId, members, activeId, previous }))
  }

  function group(ids: readonly string[]): string | null {
    const seeds = ids.filter((id, index) => windows[id] && ids.indexOf(id) === index)
    const host = seeds[0] ? (windows[seeds[0]] as WindowState) : null
    if (!host) return null
    const expanded: string[] = []
    for (const id of seeds) {
      const win = windows[id] as WindowState
      const siblings = win.groupId === null ? [id] : membersOf(win.groupId)
      for (const entry of siblings) if (!expanded.includes(entry)) expanded.push(entry)
    }
    if (expanded.length < 2) return null
    const hostVisible = onActiveWorkspace(host) && host.stage !== 'minimized'
    const current = host.groupId
    if (current !== null && expanded.length === membersOf(current).length) {
      activateTab(host.id)
      if (hostVisible) focus(host.id, true)
      return current
    }

    let groupId = `${idPrefix}-group-${++groupCounter}`
    while (activeTabs[groupId]) groupId = `${idPrefix}-group-${++groupCounter}`
    const { bounds } = refit(host, limits(host, expanded))
    const retired = new Set<string>()
    for (const id of expanded) {
      const win = windows[id] as WindowState
      if (win.groupId !== null) retired.add(win.groupId)
      setWindow({
        ...win,
        groupId,
        bounds,
        stage: host.stage,
        snapZone: host.snapZone,
        snapRect: host.snapRect,
        restoreBounds: host.restoreBounds,
        restoreStage: host.restoreStage,
        layer: host.layer,
        workspace: host.workspace,
      })
    }
    const next = { ...activeTabs, [groupId]: host.id }
    for (const old of retired) delete next[old]
    activeTabs = next
    raise(host.id)
    emitGroup(groupId, null)
    queueEvent(() => emitter.emit('order', { order }))
    commit()
    if (hostVisible) focus(host.id, true)
    reconcileFocus()
    commit()
    return groupId
  }

  function ungroup(id: string): boolean {
    const win = windows[id]
    if (!win?.groupId) return false
    const groupId = win.groupId
    const wasActive = activeTabs[groupId] === id
    setWindow(refit({ ...win, groupId: null }))
    const remaining = membersOf(groupId)
    if (wasActive) activeTabs = { ...activeTabs, [groupId]: remaining[0] as string }
    const without = order.filter((entry) => entry !== id)
    const at = without.indexOf(remaining.at(-1) as string) + 1
    const next = [...without.slice(0, at), id, ...without.slice(at)]
    if (next.some((entry, i) => entry !== order[i])) {
      order = next
      queueEvent(() => emitter.emit('order', { order }))
    }
    settleGroup(groupId)
    emitGroup(groupId, wasActive && remaining.length > 1 ? id : null)
    commit()
    if (onActiveWorkspace(win) && win.stage !== 'minimized') focus(id, true)
    return true
  }

  function activateTab(id: string): boolean {
    const win = windows[id]
    if (!win?.groupId) return false
    const groupId = win.groupId
    const previous = activeTabs[groupId] as string
    if (previous === id) return false
    activeTabs = { ...activeTabs, [groupId]: id }
    if (focusedId === previous) {
      focusedId = id
      emitFocus(win, previous)
    }
    emitGroup(groupId, previous)
    commit()
    return true
  }

  function moveTab(id: string, index: number): boolean {
    const win = windows[id]
    if (!win?.groupId || !Number.isFinite(index)) return false
    const members = membersOf(win.groupId)
    const from = members.indexOf(id)
    const target = Math.max(0, Math.min(members.length - 1, Math.trunc(index)))
    if (from === -1 || from === target) return false

    const reordered = [...members]
    reordered.splice(from, 1)
    reordered.splice(target, 0, id)
    const next = [...order]
    let cursor = 0
    for (let i = 0; i < next.length; i += 1) {
      if (!members.includes(next[i] as string)) continue
      next[i] = reordered[cursor++] as string
    }
    order = next
    emitGroup(win.groupId, null)
    queueEvent(() => emitter.emit('order', { order }))
    commit()
    return true
  }

  function cycleTab(direction: 1 | -1 = 1): string | null {
    const win = focusedId ? windows[focusedId] : undefined
    if (!win?.groupId) return null
    const members = membersOf(win.groupId)
    const current = members.indexOf(activeTabs[win.groupId] as string)
    const index = (current + direction + members.length) % members.length
    const next = members[index] as string
    activateTab(next)
    return next
  }

  function groupMembers(groupId: string): readonly WindowState[] {
    return membersOf(groupId).map((id) => windows[id] as WindowState)
  }

  function lower(id: string): boolean {
    const block = blockOf(id)
    const without = order.filter((entry) => !block.includes(entry))
    const rank = layerRankOf(id)
    let insertAt = 0
    for (const entry of without) {
      if (layerRankOf(entry) < rank) insertAt += 1
      else break
    }
    const next = [...without.slice(0, insertAt), ...block, ...without.slice(insertAt)]
    if (next.every((entry, i) => entry === order[i])) return false
    order = next
    queueEvent(() => emitter.emit('order', { order }))
    return true
  }

  function sendToBack(id: string): boolean {
    if (!windows[id] || !lower(id)) return false
    if (focusedId === id) {
      focusTop()
      if (focusedId !== id) emitFocus(windows[focusedId as string] as WindowState, id)
    }
    commit()
    return true
  }

  function center(id: string): boolean {
    const win = windows[id]
    if (win?.stage !== 'normal' || !sized(viewport)) return false
    return move(
      id,
      Math.round((viewport.width - win.bounds.width) / 2),
      Math.round((viewport.height - win.bounds.height) / 2),
    )
  }

  function minimized(): readonly WindowState[] {
    return Object.values(windows)
      .filter((win) => win.stage === 'minimized' && onActiveWorkspace(win) && isVisibleTab(win))
      .sort((a, b) => a.openedSeq - b.openedSeq)
  }

  function current(): HistoryEntry {
    return { windows, order, focusedId, workspace, activeTabs, extensions }
  }

  function captureEntry(): HistoryEntry {
    windowsShared = true
    return current()
  }

  function tabsOf(entry: HistoryEntry): Record<string, string[]> {
    const tabs: Record<string, string[]> = Object.create(null)
    for (const id of entry.order) {
      const groupId = (entry.windows[id] as WindowState).groupId
      if (groupId === null) continue
      tabs[groupId] ??= []
      ;(tabs[groupId] as string[]).push(id)
    }
    return tabs
  }

  function focusOnly(a: HistoryEntry, b: HistoryEntry): boolean {
    return (
      equal({ ...a, order: 0, focusedId: 0 }, { ...b, order: 0, focusedId: 0 }, 4) &&
      equal(tabsOf(a), tabsOf(b), 2)
    )
  }

  function recordHistory(): void {
    if (!historyDirty || !pendingHistory) return
    const now = current()
    if (equal(pendingHistory, now, 4)) return
    const top = past.at(-1)
    if (interactionDepth > 0) interactionRecorded = true
    else if (top && focusOnly(top, pendingHistory) && focusOnly(pendingHistory, now)) {
      future = []
      return
    }
    past.push(pendingHistory)
    if (past.length > historyLimit) past.shift()
    future = []
  }

  function openEntry(): void {
    pendingHistory =
      historyLimit > 0 && !(interactionDepth > 0 && interactionRecorded) ? captureEntry() : null
  }

  function restart(): void {
    interactionRecorded = false
    openEntry()
    historyDirty = false
    if (interactionMark) interactionMark = { past: [...past], future }
  }

  function transact<T>(run: () => T): T {
    if (batchDepth === 0) openEntry()
    batchDepth += 1
    try {
      return run()
    } finally {
      batchDepth -= 1
      if (batchDepth === 0) {
        recordHistory()
        historyDirty = false
        pendingHistory = null
        if (!flushing) flush()
      }
    }
  }

  function reflowViewport(emit: boolean): void {
    if (!sized(viewport)) return
    for (const id of order) {
      const win = windows[id] as WindowState
      if (!isVisibleTab(win)) continue
      const target = win.stage === 'snapped' ? snapTarget(win) : null
      let bounds = win.bounds
      if (win.stage === 'maximized') bounds = fullBounds(bounds)
      else if (target) bounds = snapBounds(limits(win), target)
      else if (win.stage === 'normal' && keepInViewport) {
        bounds = clampToViewport(bounds, viewport, minVisible)
      }
      if (boundsEqual(bounds, win.bounds)) continue
      const updated = { ...win, bounds }
      setWindow(updated)
      syncGroup(updated)
      if (emit) {
        queueEvent(() =>
          emitter.emit(win.stage === 'normal' ? 'move' : 'resize', { window: updated }),
        )
      }
    }
  }

  function track(): () => void {
    const before = current()
    const groups = buildGroups()
    return () => {
      reflowViewport(false)
      for (const id in before.windows) {
        const old = before.windows[id] as WindowState
        const win = windows[id]
        if (!win) queueEvent(() => emitter.emit('close', { window: old }))
        else if (equal(old, win, 2)) {
          if (old !== win) setWindow(old)
        } else emitDiff(old, win)
      }
      for (const id of order) {
        const win = windows[id] as WindowState
        if (!before.windows[id]) queueEvent(() => emitter.emit('open', { window: win }))
      }
      if (!equal(order, before.order, 1)) queueEvent(() => emitter.emit('order', { order }))
      const next = buildGroups()
      for (const groupId in { ...groups, ...next }) {
        const old = groups[groupId]
        const now = next[groupId]
        if (equal(old, now, 2)) continue
        emitGroup(groupId, old && now && old.activeId !== now.activeId ? old.activeId : null)
      }
      if (focusedId && focusedId !== before.focusedId) {
        emitFocus(windows[focusedId] as WindowState, before.focusedId)
      }
    }
  }

  function applyEntry(entry: HistoryEntry): void {
    const done = track()
    windows = entry.windows
    windowsShared = true
    order = [...entry.order]
    modalCount = countModals()
    groupsDirty = true
    focusedId = entry.focusedId
    activeTabs = entry.activeTabs as Record<string, string>
    extensions = entry.extensions as Record<string, unknown>
    switchWorkspace(entry.workspace)
    done()
    commit()
  }

  function travel(back: boolean): boolean {
    if (historyDirty) {
      recordHistory()
      restart()
    }
    const entry = (back ? past : future).pop()
    if (!entry) return false
    ;(back ? future : past).push(captureEntry())
    applyEntry(entry)
    restart()
    return true
  }

  function beginInteraction(): void {
    interactionDepth += 1
    if (interactionDepth === 1) {
      interactionRecorded = false
      interactionMark = { past: [...past], future }
    }
  }

  function restoreMark(): void {
    const mark = interactionMark as { past: HistoryEntry[]; future: HistoryEntry[] }
    past.length = 0
    past.push(...mark.past)
    future = mark.future
    interactionRecorded = false
  }

  function endInteraction(): void {
    if (interactionDepth === 1 && interactionRecorded && equal(past.at(-1), current(), 4)) {
      restoreMark()
    }
    if (interactionDepth > 0) interactionDepth -= 1
    if (interactionDepth === 0) interactionMark = null
  }

  function abortInteraction(): void {
    if (interactionDepth === 1) restoreMark()
    endInteraction()
  }

  function clearHistory(): void {
    past.length = 0
    future = []
    pendingHistory = captureEntry()
    historyDirty = false
  }

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
  }

  function saveLayout(name: string): SerializedState {
    const data = clone(serialize())
    layouts.set(name, data)
    return clone(data)
  }

  function loadLayout(name: string): boolean {
    const data = layouts.get(name)
    if (!data) return false
    return hydrate(clone(data))
  }

  function getLayout(name: string): SerializedState | undefined {
    const data = layouts.get(name)
    return data ? clone(data) : undefined
  }

  function setLayout(name: string, data: SerializedState): boolean {
    if (!isValidSerialized(data)) return false
    layouts.set(name, clone(data))
    return true
  }

  function deleteLayout(name: string): boolean {
    return layouts.delete(name)
  }

  function layoutNames(): string[] {
    return [...layouts.keys()]
  }

  function arrange(mode: ArrangeMode): void {
    const ids = order.filter((id) => {
      const win = windows[id] as WindowState
      return (
        win.stage !== 'minimized' && !win.snapRect && onActiveWorkspace(win) && isVisibleTab(win)
      )
    })
    if (ids.length === 0 || (mode === 'tile' && !sized(viewport))) return
    const cols = Math.ceil(Math.sqrt(ids.length))
    const rows = Math.ceil(ids.length / cols)
    const cellWidth = Math.floor(viewport.width / cols)
    const cellHeight = Math.floor(viewport.height / rows)
    ids.forEach((id, index) => {
      const win = windows[id] as WindowState
      const size = win.restoreBounds ?? win.bounds
      const offset = (index % 10) * cascadeOffset
      place(
        id,
        mode === 'cascade'
          ? {
              x: cascadeOrigin.x + offset,
              y: cascadeOrigin.y + offset,
              width: size.width,
              height: size.height,
            }
          : {
              x: (index % cols) * cellWidth,
              y: Math.floor(index / cols) * cellHeight,
              width: cellWidth,
              height: cellHeight,
            },
      )
    })
    lift(ids)
  }

  function minimizeAll(): void {
    for (const id of [...order]) {
      const win = windows[id] as WindowState
      if (win.minimizable && onActiveWorkspace(win) && isVisibleTab(win)) minimize(id)
    }
  }

  function restoreAll(): void {
    lift(
      minimized()
        .map((win) => win.id)
        .filter(unminimize),
    )
  }

  function serialize(): SerializedState {
    return {
      version: 1,
      windows: order
        .map((id) => windows[id] as WindowState)
        .map((win) => ({
          ...win,
          bounds: { ...win.bounds },
          restoreBounds: win.restoreBounds ? { ...win.restoreBounds } : null,
          snapRect: win.snapRect ? { ...win.snapRect } : null,
          minSize: { ...win.minSize },
          maxSize: win.maxSize
            ? {
                width: Number.isFinite(win.maxSize.width) ? win.maxSize.width : null,
                height: Number.isFinite(win.maxSize.height) ? win.maxSize.height : null,
              }
            : null,
          meta: { ...win.meta },
        })),
      order: [...order],
      focusedId,
      workspace,
      activeTabs: { ...activeTabs },
      extensions: { ...extensions },
    }
  }

  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  function fields(value: unknown): Record<string, unknown> {
    return isObject(value) ? value : {}
  }

  function readBounds(value: unknown): Bounds | null {
    const { x, y, width, height } = fields(value)
    return finite(x, y) && num(width, TINY) && num(height, TINY)
      ? ({ x, y, width, height } as Bounds)
      : null
  }

  function isSerializedWindow(value: unknown): value is SerializedWindowState {
    return (
      isObject(value) &&
      typeof value.id === 'string' &&
      value.id.length > 0 &&
      isObject(value.bounds) &&
      STAGES.includes(value.stage as WindowStage) &&
      LAYERS.includes(value.layer as WindowLayer)
    )
  }

  function isValidSerialized(data: SerializedState): boolean {
    if (typeof data !== 'object' || data === null) return false
    if (data.version !== 1 || !Array.isArray(data.windows)) return false
    if (!data.windows.every(isSerializedWindow)) return false
    const ids = new Set(data.windows.map((win) => win.id))
    return ids.size === data.windows.length
  }

  function hydrate(data: SerializedState): boolean {
    if (!isValidSerialized(data)) return false

    const done = track()
    const nextWindows: Record<string, WindowState> = Object.create(null)
    const built: WindowState[] = []
    let maxSeq = 0
    for (const raw of data.windows) {
      const minSize = fields(raw.minSize)
      const maxSize = fields(raw.maxSize)
      const bounds = fields(raw.bounds)
      const snapRect = isObject(raw.snapRect) ? unitRect(raw.snapRect as Bounds) : null
      const snapZone = ZONES.includes(raw.snapZone as SnapZone) ? raw.snapZone : null
      let win: WindowState = {
        id: raw.id,
        title: typeof raw.title === 'string' ? raw.title : 'Window',
        bounds: {
          ...positionForOpen({ x: num(bounds.x), y: num(bounds.y) }),
          width: num(bounds.width, TINY) ?? defaultSize.width,
          height: num(bounds.height, TINY) ?? defaultSize.height,
        },
        restoreBounds: readBounds(raw.restoreBounds),
        restoreStage: STAGES.includes(raw.restoreStage as WindowStage) ? raw.restoreStage : null,
        stage: raw.stage === 'snapped' && !snapZone && !snapRect ? 'normal' : raw.stage,
        snapZone,
        snapRect,
        layer: raw.layer,
        workspace: normalizeWorkspace(raw.workspace, 0),
        groupId: typeof raw.groupId === 'string' && raw.groupId.length > 0 ? raw.groupId : null,
        minSize: { width: num(minSize.width, 0) ?? 160, height: num(minSize.height, 0) ?? 100 },
        maxSize: capped(maxSize.width, maxSize.height),
        aspectRatio: num(raw.aspectRatio, TINY) ?? null,
        openedSeq: num(raw.openedSeq) ?? ++maxSeq,
        draggable: raw.draggable !== false,
        resizable: raw.resizable !== false,
        closable: raw.closable !== false,
        minimizable: raw.minimizable !== false,
        maximizable: raw.maximizable !== false,
        snappable: raw.snappable !== false,
        meta: raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {},
      }
      if (win.groupId === null) win = refit(win)
      maxSeq = Math.max(maxSeq, win.openedSeq)
      built.push(win)
    }
    for (const win of built.sort((a, b) => a.openedSeq - b.openedSeq)) nextWindows[win.id] = win

    const requestedOrder = Array.isArray(data.order) ? data.order : []
    const seen = new Set<string>()
    const nextOrder: string[] = []
    for (const id of requestedOrder) {
      if (typeof id === 'string' && nextWindows[id] && !seen.has(id)) {
        seen.add(id)
        nextOrder.push(id)
      }
    }
    for (const win of data.windows) {
      if (!seen.has(win.id)) nextOrder.push(win.id)
    }

    windows = nextWindows
    windowsShared = false
    order = nextOrder
    modalCount = countModals()
    groupsDirty = true
    seq = maxSeq
    switchWorkspace(normalizeWorkspace(data.workspace, 0))
    const restoredTabs: Record<string, string> = Object.create(null)
    const rawTabs = (data as { activeTabs?: unknown }).activeTabs
    for (const id of order) {
      const groupId = (windows[id] as WindowState).groupId
      if (groupId === null || restoredTabs[groupId]) continue
      const wanted = isObject(rawTabs) ? rawTabs[groupId] : undefined
      const members = membersOf(groupId)
      restoredTabs[groupId] =
        typeof wanted === 'string' && members.includes(wanted) ? wanted : (members[0] as string)
    }
    activeTabs = restoredTabs
    const raw = data.extensions
    extensions = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
    for (const groupId of Object.keys(restoredTabs)) settleGroup(groupId)
    order = sortByLayer(order)

    const candidate = typeof data.focusedId === 'string' ? windows[data.focusedId] : undefined
    focusedId =
      candidate &&
      candidate.stage !== 'minimized' &&
      onActiveWorkspace(candidate) &&
      isVisibleTab(candidate)
        ? candidate.id
        : null
    if (!focusedId && data.focusedId !== null) focusTop()
    const modal = topModalId()
    if (modal && focusedId && (windows[focusedId] as WindowState).layer !== 'modal') {
      focusedId = modal
    }
    done()
    commit()
    clearHistory()
    return true
  }

  function destroy(): void {
    emitter.clear()
  }

  return {
    open: (init) => transact(() => open(init)),
    close: (id) => transact(() => close(id)),
    closeAll: () => transact(closeAll),
    focus: (id) => transact(() => focus(id)),
    blur: () => transact(blur),
    cycleFocus: (direction) => transact(() => cycleFocus(direction)),
    minimize: (id) => transact(() => minimize(id)),
    maximize: (id) => transact(() => maximize(id)),
    toggleMaximize: (id) => transact(() => toggleMaximize(id)),
    restore: (id) => transact(() => restore(id)),
    restoreTo: (id, bounds) => transact(() => restoreTo(id, bounds)),
    snap: (id, zone) => transact(() => ZONES.includes(zone) && snap(id, zone)),
    snapTo: (id, rect) =>
      transact(() => {
        const unit = unitRect(rect)
        return !!unit && snap(id, null, unit)
      }),
    move: (id, x, y) => transact(() => move(id, x, y)),
    moveBy: (id, dx, dy) => transact(() => moveBy(id, dx, dy)),
    center: (id) => transact(() => center(id)),
    sendToBack: (id) => transact(() => sendToBack(id)),
    resize: (id, patch) => transact(() => resize(id, patch)),
    update: (id, patch) => transact(() => update(id, patch)),
    get: (id) => windows[id],
    getState,
    minimized,
    setViewport: (next) => transact(() => setViewport(next)),
    workspace: () => workspace,
    setWorkspace: (next) => transact(() => setWorkspace(next)),
    moveToWorkspace: (id, next) => transact(() => moveToWorkspace(id, next)),
    group: (ids) => transact(() => group(ids)),
    ungroup: (id) => transact(() => ungroup(id)),
    activateTab: (id) => transact(() => activateTab(id)),
    moveTab: (id, index) => transact(() => moveTab(id, index)),
    cycleTab: (direction) => transact(() => cycleTab(direction)),
    groupMembers,
    batch: (run) => transact(run),
    setExtension: (key, value) =>
      transact(() => {
        if (extensions[key] === value) return
        const { [key]: _previous, ...rest } = extensions
        extensions = value === undefined ? rest : { ...rest, [key]: value }
        commit()
      }),
    serialize,
    hydrate: (data) => transact(() => hydrate(data)),
    undo: () => transact(() => travel(true)),
    redo: () => transact(() => travel(false)),
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    beginInteraction,
    endInteraction,
    abortInteraction,
    clearHistory,
    saveLayout,
    loadLayout: (name) => transact(() => loadLayout(name)),
    getLayout,
    setLayout,
    deleteLayout,
    layoutNames,
    arrange: (mode) => transact(() => arrange(mode)),
    minimizeAll: () => transact(minimizeAll),
    restoreAll: () => transact(restoreAll),
    subscribe: (listener) => emitter.on('change', ({ state }) => listener(state)),
    on: (event, listener) => emitter.on(event, listener),
    destroy,
  }
}
