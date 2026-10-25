import { createEmitter } from './emitter'
import { applyAspect, boundsEqual, clampSize, clampToViewport, zoneBounds } from './geometry'
import type {
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

function normalizeWorkspace(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

function sized(size: Size): boolean {
  return size.width > 0 && size.height > 0
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
  let skipNextHistory = false
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
    order = next
    return changed
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

  function sharedSize(ids: readonly string[], size: Size): Size {
    let shared = size
    for (const id of ids) {
      const fit = normalizeSize(shared, windows[id] as WindowState)
      shared = {
        width: Math.max(shared.width, fit.width),
        height: Math.max(shared.height, fit.height),
      }
    }
    return shared
  }

  function fitFrame(win: WindowState, ids: readonly string[]): Bounds {
    if (win.stage === 'maximized') return win.bounds
    const bounds = { ...win.bounds, ...sharedSize(ids, win.bounds) }
    if (win.stage === 'snapped') {
      bounds.x = Math.max(0, Math.min(bounds.x, viewport.width - bounds.width))
      bounds.y = Math.max(0, Math.min(bounds.y, viewport.height - bounds.height))
    }
    return bounds
  }

  function syncGroup(source: WindowState, fit = true): WindowState {
    if (source.groupId === null) return source
    const members = membersOf(source.groupId)
    const fitted = fit ? fitFrame(source, members) : source.bounds
    let effective = source
    if (!boundsEqual(fitted, source.bounds)) {
      effective = { ...source, bounds: fitted }
      setWindow(effective)
    }
    for (const id of members) {
      if (id === effective.id) continue
      const member = windows[id] as WindowState
      if (
        boundsEqual(member.bounds, effective.bounds) &&
        member.stage === effective.stage &&
        member.snapZone === effective.snapZone &&
        member.snapRect === effective.snapRect &&
        member.layer === effective.layer &&
        member.workspace === effective.workspace
      ) {
        continue
      }
      setWindow({
        ...member,
        bounds: effective.bounds,
        stage: effective.stage,
        snapZone: effective.snapZone,
        snapRect: effective.snapRect,
        restoreBounds: effective.restoreBounds,
        restoreStage: effective.restoreStage,
        layer: effective.layer,
        workspace: effective.workspace,
      })
    }
    return effective
  }

  function dissolveIfOrphaned(groupId: string): void {
    const members = membersOf(groupId)
    if (members.length >= 2) return
    for (const id of members) {
      setWindow({ ...(windows[id] as WindowState), groupId: null })
    }
    const { [groupId]: _dropped, ...rest } = activeTabs
    activeTabs = rest
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

  function normalizeSize(
    size: Size,
    win: Pick<WindowState, 'minSize' | 'maxSize' | 'aspectRatio'>,
    drive: 'width' | 'height' = 'width',
  ): Size {
    if (win.aspectRatio === null) return clampSize(size, win.minSize, win.maxSize)
    return applyAspect(size, win.aspectRatio, win.minSize, win.maxSize, drive)
  }

  function positionForOpen(init: WindowInit): { x: number; y: number } {
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

    const minSize = { width: init.minWidth ?? 160, height: init.minHeight ?? 100 }
    const maxSize =
      init.maxWidth !== undefined || init.maxHeight !== undefined
        ? {
            width: init.maxWidth ?? Number.POSITIVE_INFINITY,
            height: init.maxHeight ?? Number.POSITIVE_INFINITY,
          }
        : null
    const aspectRatio =
      init.aspectRatio !== undefined && Number.isFinite(init.aspectRatio) && init.aspectRatio > 0
        ? init.aspectRatio
        : null
    const requested = {
      width: init.width ?? defaultSize.width,
      height: init.height ?? defaultSize.height,
    }
    const size =
      aspectRatio === null
        ? clampSize(requested, minSize, maxSize)
        : applyAspect(
            requested,
            aspectRatio,
            minSize,
            maxSize,
            init.width === undefined && init.height !== undefined ? 'height' : 'width',
          )
    const position = positionForOpen(init)
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
      layer: init.layer ?? 'normal',
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
      dissolveIfOrphaned(win.groupId)
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
    for (const id of [...order]) close(id)
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

  function snapBounds(win: WindowState, rect: Bounds): Bounds {
    const byWidth = normalizeSize(rect, win)
    const size = byWidth.height > rect.height ? normalizeSize(rect, win, 'height') : byWidth
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

  function applyStage(id: string, build: (win: WindowState) => WindowState | null): boolean {
    const win = windows[id]
    if (!win) return false
    const next = build(win)
    if (!next) return false
    setWindow(next)
    const synced = syncGroup(next)
    queueEvent(() => emitter.emit('stage', { window: synced, previous: win.stage }))
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

  function restore(id: string): boolean {
    const result = applyStage(id, (win) => {
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
          return { ...win, stage: 'snapped', restoreStage: null, bounds: snapBounds(win, rect) }
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
      if (docked) return { ...win, stage: 'snapped', bounds: snapBounds(win, docked) }
      const target = win.restoreBounds ?? win.bounds
      const bounds: Bounds = { x: target.x, y: target.y, ...normalizeSize(target, win) }
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
    if (result) focus(id, true)
    return result
  }

  function restoreTo(id: string, bounds: Bounds): boolean {
    const result = applyStage(id, (win) => {
      const size = normalizeSize(bounds, win)
      const next: Bounds = { x: bounds.x, y: bounds.y, ...size }
      return {
        ...win,
        stage: 'normal',
        snapZone: null,
        snapRect: null,
        restoreBounds: null,
        restoreStage: null,
        bounds: keepInViewport ? clampToViewport(next, viewport, minVisible) : next,
      }
    })
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
      return { ...next, bounds: snapBounds(next, snapTarget(next) as Bounds) }
    })
    if (result && snapZone) focus(id, true)
    return result
  }

  function move(id: string, x: number, y: number): boolean {
    const win = windows[id]
    if (win?.stage !== 'normal') return false
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
    const merged: Bounds = { ...win.bounds, ...patch }
    const drive =
      Math.abs(merged.height - win.bounds.height) > Math.abs(merged.width - win.bounds.width)
        ? 'height'
        : 'width'
    const size = normalizeSize(merged, win, drive)
    let bounds: Bounds = { x: merged.x, y: merged.y, ...size }
    if (keepInViewport) bounds = clampToViewport(bounds, viewport, minVisible)
    const becameNormal = win.stage === 'snapped'
    if (boundsEqual(bounds, win.bounds) && !becameNormal) return true
    const next: WindowState = becameNormal
      ? { ...win, stage: 'normal', snapZone: null, snapRect: null, restoreBounds: null, bounds }
      : { ...win, bounds }
    setWindow(next)
    const synced = syncGroup(next)
    if (becameNormal) {
      queueEvent(() => emitter.emit('stage', { window: synced, previous: 'snapped' }))
    }
    queueEvent(() => emitter.emit('resize', { window: synced }))
    commit()
    return true
  }

  function update(id: string, patch: WindowUpdate): boolean {
    const win = windows[id]
    if (!win) return false
    const next: WindowState = {
      ...win,
      title: patch.title ?? win.title,
      layer: patch.layer ?? win.layer,
      minSize: patch.minSize ?? win.minSize,
      maxSize: patch.maxSize === undefined ? win.maxSize : patch.maxSize,
      aspectRatio:
        patch.aspectRatio === undefined
          ? win.aspectRatio
          : patch.aspectRatio !== null &&
              Number.isFinite(patch.aspectRatio) &&
              patch.aspectRatio > 0
            ? patch.aspectRatio
            : null,
      draggable: patch.draggable ?? win.draggable,
      resizable: patch.resizable ?? win.resizable,
      closable: patch.closable ?? win.closable,
      minimizable: patch.minimizable ?? win.minimizable,
      maximizable: patch.maximizable ?? win.maximizable,
      snappable: patch.snappable ?? win.snappable,
      meta: patch.meta ? { ...win.meta, ...patch.meta } : win.meta,
    }
    const bounds =
      next.stage === 'maximized' ||
      !(patch.minSize || patch.maxSize !== undefined || patch.aspectRatio !== undefined)
        ? next.bounds
        : next.stage === 'snapped' && snapTarget(next)
          ? snapBounds(next, snapTarget(next) as Bounds)
          : { ...next.bounds, ...normalizeSize(next.bounds, next) }
    const resized = !boundsEqual(bounds, next.bounds)
    const finalWin = resized ? { ...next, bounds } : next
    if ((Object.keys(win) as (keyof WindowState)[]).every((key) => finalWin[key] === win[key])) {
      return true
    }
    setWindow(finalWin)
    const synced = syncGroup(finalWin)
    if (patch.layer && patch.layer !== win.layer) {
      order = sortByLayer(order)
      queueEvent(() => emitter.emit('order', { order }))
      handOff(id)
    }
    queueEvent(() => emitter.emit('update', { window: synced }))
    if (resized) queueEvent(() => emitter.emit('resize', { window: synced }))
    commit()
    return true
  }

  function setViewport(next: Size): void {
    if (!sized(next) || (next.width === viewport.width && next.height === viewport.height)) return
    viewport = { ...next }
    reflowViewport()
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
    const synced = syncGroup(updated)
    if (!onActiveWorkspace(updated) && focusedId === id) {
      focusTop()
      if (focusedId) emitFocus(windows[focusedId] as WindowState, id)
    } else if (updated.groupId !== null && !onActiveWorkspace(updated)) {
      reconcileFocus()
    } else {
      handOff(id)
    }
    queueEvent(() => emitter.emit('update', { window: synced }))
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

    let groupId = `${idPrefix}-group-${++groupCounter}`
    while (activeTabs[groupId]) groupId = `${idPrefix}-group-${++groupCounter}`
    const bounds = fitFrame(host, expanded)
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
    const hostVisible = onActiveWorkspace(host) && host.stage !== 'minimized'
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
    setWindow({ ...win, groupId: null })
    const remaining = membersOf(groupId)
    if (wasActive) activeTabs = { ...activeTabs, [groupId]: remaining[0] as string }
    const without = order.filter((entry) => entry !== id)
    const at = without.indexOf(remaining.at(-1) as string) + 1
    const next = [...without.slice(0, at), id, ...without.slice(at)]
    if (next.some((entry, i) => entry !== order[i])) {
      order = next
      queueEvent(() => emitter.emit('order', { order }))
    }
    dissolveIfOrphaned(groupId)
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
    return activateTab(next) ? next : null
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
    if (win?.stage !== 'normal') return false
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

  function captureEntry(): HistoryEntry {
    windowsShared = true
    return { windows, order, focusedId, workspace, activeTabs, extensions }
  }

  function recordHistory(): void {
    if (!historyDirty) return
    if (skipNextHistory) {
      skipNextHistory = false
      return
    }
    if (!pendingHistory) return
    if (interactionDepth > 0) interactionRecorded = true
    past.push(pendingHistory)
    if (past.length > historyLimit) past.shift()
    future = []
  }

  function transact<T>(run: () => T): T {
    if (batchDepth === 0) {
      pendingHistory =
        historyLimit > 0 && !(interactionDepth > 0 && interactionRecorded) ? captureEntry() : null
    }
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

  function reflowViewport(known: Readonly<Record<string, WindowState>> = windows): void {
    if (!sized(viewport)) return
    for (const id of order) {
      const win = windows[id] as WindowState
      if (!isVisibleTab(win)) continue
      if (win.stage === 'maximized') {
        const updated = { ...win, bounds: fullBounds(win.bounds) }
        setWindow(updated)
        const synced = syncGroup(updated)
        if (known[id]) queueEvent(() => emitter.emit('resize', { window: synced }))
      } else if (win.stage === 'snapped' && snapTarget(win)) {
        const updated = { ...win, bounds: snapBounds(win, snapTarget(win) as Bounds) }
        setWindow(updated)
        const synced = syncGroup(updated)
        if (known[id]) queueEvent(() => emitter.emit('resize', { window: synced }))
      } else if (win.stage === 'normal' && keepInViewport) {
        const bounds = clampToViewport(win.bounds, viewport, minVisible)
        if (!boundsEqual(bounds, win.bounds)) {
          const updated = { ...win, bounds }
          setWindow(updated)
          const synced = syncGroup(updated)
          if (known[id]) queueEvent(() => emitter.emit('move', { window: synced }))
        }
      }
    }
  }

  function report(
    previousWindows: Readonly<Record<string, WindowState>>,
    previousFocus: string | null,
  ): void {
    for (const id of Object.keys(previousWindows)) {
      const closed = previousWindows[id] as WindowState
      if (!windows[id]) queueEvent(() => emitter.emit('close', { window: closed }))
    }
    reflowViewport(previousWindows)
    for (const id of order) {
      const opened = windows[id] as WindowState
      if (!previousWindows[id]) queueEvent(() => emitter.emit('open', { window: opened }))
    }
    if (focusedId && focusedId !== previousFocus) {
      emitFocus(windows[focusedId] as WindowState, previousFocus)
    }
  }

  function applyEntry(entry: HistoryEntry): void {
    const previousWindows = windows
    const previousFocus = focusedId
    windows = entry.windows
    order = [...entry.order]
    modalCount = countModals()
    groupsDirty = true
    focusedId = entry.focusedId
    activeTabs = entry.activeTabs as Record<string, string>
    extensions = entry.extensions as Record<string, unknown>
    interactionRecorded = false
    switchWorkspace(entry.workspace)
    report(previousWindows, previousFocus)
    commit()
  }

  function undo(): boolean {
    const entry = past.pop()
    if (!entry) return false
    future.push(captureEntry())
    skipNextHistory = true
    applyEntry(entry)
    return true
  }

  function redo(): boolean {
    const entry = future.pop()
    if (!entry) return false
    past.push(captureEntry())
    skipNextHistory = true
    applyEntry(entry)
    return true
  }

  function beginInteraction(): void {
    interactionDepth += 1
    if (interactionDepth === 1) {
      interactionRecorded = false
      interactionMark = { past: [...past], future }
    }
  }

  function endInteraction(): void {
    if (interactionDepth > 0) interactionDepth -= 1
    if (interactionDepth === 0) interactionMark = null
  }

  function abortInteraction(): void {
    if (interactionDepth > 0 && interactionMark) {
      past.length = 0
      past.push(...interactionMark.past)
      future = interactionMark.future
      interactionRecorded = false
    }
    endInteraction()
  }

  function clearHistory(): void {
    past.length = 0
    future = []
    pendingHistory = captureEntry()
    historyDirty = false
  }

  function saveLayout(name: string): SerializedState {
    const data = serialize()
    layouts.set(name, structuredClone(data))
    return data
  }

  function loadLayout(name: string): boolean {
    const data = layouts.get(name)
    if (!data) return false
    return hydrate(structuredClone(data))
  }

  function getLayout(name: string): SerializedState | undefined {
    const data = layouts.get(name)
    return data ? structuredClone(data) : undefined
  }

  function setLayout(name: string, data: SerializedState): boolean {
    if (!isValidSerialized(data)) return false
    layouts.set(name, structuredClone(data))
    return true
  }

  function deleteLayout(name: string): boolean {
    return layouts.delete(name)
  }

  function layoutNames(): string[] {
    return [...layouts.keys()]
  }

  function arrange(mode: 'cascade' | 'tile'): void {
    const ids = order.filter((id) => {
      const win = windows[id] as WindowState
      return win.stage !== 'minimized' && onActiveWorkspace(win) && isVisibleTab(win)
    })
    if (ids.length === 0) return
    if (mode === 'cascade') {
      ids.forEach((id, index) => {
        const win = windows[id] as WindowState
        const size = win.restoreBounds ?? win.bounds
        restoreTo(id, {
          x: cascadeOrigin.x + (index % 10) * cascadeOffset,
          y: cascadeOrigin.y + (index % 10) * cascadeOffset,
          width: size.width,
          height: size.height,
        })
      })
      return
    }
    if (!sized(viewport)) return
    const cols = Math.ceil(Math.sqrt(ids.length))
    const rows = Math.ceil(ids.length / cols)
    const cellWidth = Math.floor(viewport.width / cols)
    const cellHeight = Math.floor(viewport.height / rows)
    ids.forEach((id, index) => {
      restoreTo(id, {
        x: (index % cols) * cellWidth,
        y: Math.floor(index / cols) * cellHeight,
        width: cellWidth,
        height: cellHeight,
      })
    })
  }

  function minimizeAll(): void {
    for (const id of [...order]) {
      const win = windows[id] as WindowState
      if (onActiveWorkspace(win) && isVisibleTab(win)) minimize(id)
    }
  }

  function restoreAll(): void {
    for (const win of minimized()) restore(win.id)
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

  function isBounds(value: unknown): value is Bounds {
    if (typeof value !== 'object' || value === null) return false
    const bounds = value as Record<string, unknown>
    return (
      typeof bounds.x === 'number' &&
      typeof bounds.y === 'number' &&
      typeof bounds.width === 'number' &&
      typeof bounds.height === 'number'
    )
  }

  function isSize(value: unknown): value is Size {
    if (typeof value !== 'object' || value === null) return false
    const size = value as Record<string, unknown>
    return typeof size.width === 'number' && typeof size.height === 'number'
  }

  function isSizeAxis(value: unknown): value is number | null {
    return value === null || typeof value === 'number'
  }

  function readMaxSize(value: unknown): Size | null {
    if (typeof value !== 'object' || value === null) return null
    const size = value as Record<string, unknown>
    if (!isSizeAxis(size.width) || !isSizeAxis(size.height)) return null
    if (size.width === null && size.height === null) return null
    return {
      width: size.width ?? Number.POSITIVE_INFINITY,
      height: size.height ?? Number.POSITIVE_INFINITY,
    }
  }

  function isSerializedWindow(value: unknown): value is SerializedWindowState {
    if (typeof value !== 'object' || value === null) return false
    const win = value as Record<string, unknown>
    return (
      typeof win.id === 'string' &&
      win.id.length > 0 &&
      isBounds(win.bounds) &&
      STAGES.includes(win.stage as WindowStage) &&
      LAYERS.includes(win.layer as WindowLayer)
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

    const previousWindows = windows
    const previousFocus = focusedId
    const nextWindows: Record<string, WindowState> = Object.create(null)
    let maxSeq = 0
    for (const raw of data.windows) {
      const win: WindowState = {
        id: raw.id,
        title: typeof raw.title === 'string' ? raw.title : 'Window',
        bounds: { ...raw.bounds },
        restoreBounds:
          raw.restoreBounds && isBounds(raw.restoreBounds) ? { ...raw.restoreBounds } : null,
        restoreStage: STAGES.includes(raw.restoreStage as WindowStage) ? raw.restoreStage : null,
        stage: raw.stage,
        snapZone: ZONES.includes(raw.snapZone as SnapZone) ? raw.snapZone : null,
        snapRect: isBounds(raw.snapRect) ? { ...raw.snapRect } : null,
        layer: raw.layer,
        workspace: normalizeWorkspace(raw.workspace, 0),
        groupId: typeof raw.groupId === 'string' && raw.groupId.length > 0 ? raw.groupId : null,
        minSize: isSize(raw.minSize) ? { ...raw.minSize } : { width: 160, height: 100 },
        maxSize: readMaxSize(raw.maxSize),
        aspectRatio:
          typeof raw.aspectRatio === 'number' &&
          Number.isFinite(raw.aspectRatio) &&
          raw.aspectRatio > 0
            ? raw.aspectRatio
            : null,
        openedSeq: typeof raw.openedSeq === 'number' ? raw.openedSeq : ++maxSeq,
        draggable: raw.draggable !== false,
        resizable: raw.resizable !== false,
        closable: raw.closable !== false,
        minimizable: raw.minimizable !== false,
        maximizable: raw.maximizable !== false,
        snappable: raw.snappable !== false,
        meta: raw.meta && typeof raw.meta === 'object' ? { ...raw.meta } : {},
      }
      maxSeq = Math.max(maxSeq, win.openedSeq)
      nextWindows[win.id] = win
    }

    const requestedOrder = Array.isArray(data.order) ? data.order : []
    const seen = new Set<string>()
    const nextOrder: string[] = []
    for (const id of requestedOrder) {
      if (typeof id === 'string' && nextWindows[id] && !seen.has(id)) {
        seen.add(id)
        nextOrder.push(id)
      }
    }
    for (const id of Object.keys(nextWindows)) {
      if (!seen.has(id)) nextOrder.push(id)
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
      const wanted =
        typeof rawTabs === 'object' && rawTabs !== null
          ? (rawTabs as Record<string, unknown>)[groupId]
          : undefined
      const members = membersOf(groupId)
      restoredTabs[groupId] =
        typeof wanted === 'string' && members.includes(wanted) ? wanted : (members[0] as string)
    }
    activeTabs = restoredTabs
    const raw = data.extensions
    extensions = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
    for (const groupId of Object.keys(restoredTabs)) dissolveIfOrphaned(groupId)
    for (const host of Object.values(activeTabs)) syncGroup(windows[host] as WindowState, false)
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
    report(previousWindows, previousFocus)
    queueEvent(() => emitter.emit('order', { order }))
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
    snap: (id, zone) => transact(() => snap(id, zone)),
    snapTo: (id, rect) => transact(() => snap(id, null, { ...rect })),
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
    undo: () => transact(undo),
    redo: () => transact(redo),
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
