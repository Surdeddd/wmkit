import { createEmitter } from './emitter'
import { boundsEqual, clampSize, clampToViewport, zoneBounds } from './geometry'
import type {
  Bounds,
  ManagerEvents,
  ManagerOptions,
  ManagerState,
  SerializedState,
  Size,
  SnapZone,
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
]

export function createWindowManager(options: ManagerOptions = {}): WindowManager {
  const emitter = createEmitter<ManagerEvents>()
  const keepInViewport = options.keepInViewport ?? true
  const minVisible = options.minVisible ?? 48
  const defaultSize = options.defaultSize ?? { width: 480, height: 320 }
  const cascadeOffset = options.cascadeOffset ?? 32
  const cascadeOrigin = options.cascadeOrigin ?? { x: 32, y: 32 }
  const idPrefix = options.idPrefix ?? 'wm'

  let windows: Record<string, WindowState> = {}
  let order: string[] = []
  let focusedId: string | null = null
  let viewport: Size = options.viewport ?? { width: 0, height: 0 }
  let seq = 0
  let idCounter = 0
  let cascadeIndex = 0
  let snapshot: ManagerState | null = null
  let batchDepth = 0
  let batchDirty = false
  const pendingEvents: Array<() => void> = []

  function getState(): ManagerState {
    if (!snapshot) {
      snapshot = { windows, order, focusedId, viewport }
    }
    return snapshot
  }

  function commit(): void {
    snapshot = null
    if (batchDepth > 0) {
      batchDirty = true
      return
    }
    flushEvents()
    emitter.emit('change', { state: getState() })
  }

  function flushEvents(): void {
    while (pendingEvents.length > 0) {
      for (const emit of pendingEvents.splice(0)) emit()
    }
  }

  function queueEvent(emit: () => void): void {
    pendingEvents.push(emit)
    if (batchDepth === 0) flushEvents()
  }

  function setWindow(next: WindowState): void {
    windows = { ...windows, [next.id]: next }
  }

  function removeWindow(id: string): void {
    const { [id]: _removed, ...rest } = windows
    windows = rest
    order = order.filter((entry) => entry !== id)
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

  function raise(id: string): boolean {
    const win = windows[id] as WindowState
    const without = order.filter((entry) => entry !== id)
    const rank = LAYER_RANK[win.layer]
    let insertAt = without.length
    for (let i = without.length - 1; i >= 0; i -= 1) {
      if (layerRankOf(without[i] as string) > rank) insertAt = i
      else break
    }
    const next = [...without.slice(0, insertAt), id, ...without.slice(insertAt)]
    const changed = next.length !== order.length || next.some((entry, i) => entry !== order[i])
    order = next
    return changed
  }

  function topModalId(): string | null {
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const win = windows[order[i] as string] as WindowState
      if (win.layer === 'modal' && win.stage !== 'minimized') return win.id
    }
    return null
  }

  function focusTargets(): string[] {
    const modal = topModalId()
    return order.filter((id) => {
      const win = windows[id] as WindowState
      if (win.stage === 'minimized') return false
      if (modal && win.layer !== 'modal') return false
      return true
    })
  }

  function focusTop(): void {
    const targets = focusTargets()
    focusedId = targets.length > 0 ? (targets[targets.length - 1] as string) : null
  }

  function emitFocus(win: WindowState, previous: string | null): void {
    queueEvent(() => emitter.emit('focus', { window: win, previous }))
  }

  function normalizeSize(size: Size, win: Pick<WindowState, 'minSize' | 'maxSize'>): Size {
    return clampSize(size, win.minSize, win.maxSize)
  }

  function positionForOpen(init: WindowInit): { x: number; y: number } {
    if (init.x !== undefined && init.y !== undefined) return { x: init.x, y: init.y }
    const offset = (cascadeIndex % 10) * cascadeOffset
    cascadeIndex += 1
    const base = { x: cascadeOrigin.x + offset, y: cascadeOrigin.y + offset }
    return { x: init.x ?? base.x, y: init.y ?? base.y }
  }

  function open(init: WindowInit = {}): WindowState {
    const id = init.id ?? `${idPrefix}-${++idCounter}`
    if (windows[id]) throw new Error(`wmkit: window id "${id}" already exists`)

    const minSize = { width: init.minWidth ?? 160, height: init.minHeight ?? 100 }
    const maxSize =
      init.maxWidth !== undefined || init.maxHeight !== undefined
        ? {
            width: init.maxWidth ?? Number.POSITIVE_INFINITY,
            height: init.maxHeight ?? Number.POSITIVE_INFINITY,
          }
        : null
    const size = clampSize(
      { width: init.width ?? defaultSize.width, height: init.height ?? defaultSize.height },
      minSize,
      maxSize,
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
      layer: init.layer ?? 'normal',
      minSize,
      maxSize,
      openedSeq: ++seq,
      draggable: init.draggable ?? true,
      resizable: init.resizable ?? true,
      closable: init.closable ?? true,
      minimizable: init.minimizable ?? true,
      maximizable: init.maximizable ?? true,
      snappable: init.snappable ?? true,
      meta: init.meta ?? {},
    }

    if (stage === 'maximized') {
      win = { ...win, stage, restoreBounds: bounds, bounds: fullBounds() }
    } else if (stage === 'minimized') {
      win = { ...win, stage, restoreStage: 'normal' }
    }

    setWindow(win)
    raise(id)
    let focusPayload: { window: WindowState; previous: string | null } | null = null
    if (stage !== 'minimized') {
      const previous = focusedId
      const modal = topModalId()
      if (!modal || win.layer === 'modal') {
        focusedId = id
        focusPayload = { window: win, previous }
      } else {
        focusTop()
      }
    }
    queueEvent(() => emitter.emit('open', { window: win }))
    if (focusPayload) {
      const payload = focusPayload
      queueEvent(() => emitter.emit('focus', payload))
    }
    queueEvent(() => emitter.emit('order', { order }))
    commit()
    return win
  }

  function close(id: string): boolean {
    const win = windows[id]
    if (!win) return false
    removeWindow(id)
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
    batch(() => {
      for (const id of [...order]) close(id)
    })
  }

  function focus(id: string): boolean {
    const win = windows[id]
    if (!win) return false
    const modal = topModalId()
    if (modal && modal !== id && win.layer !== 'modal') {
      const modalWin = windows[modal]
      if (modalWin) queueEvent(() => emitter.emit('modalblocked', { window: modalWin }))
      commit()
      return false
    }
    if (win.stage === 'minimized') {
      restore(id)
      return focusedId === id
    }
    const previous = focusedId
    const raised = raise(id)
    const changed = focusedId !== id || raised
    focusedId = id
    if (changed) {
      emitFocus(win, previous)
      if (raised) queueEvent(() => emitter.emit('order', { order }))
      commit()
    }
    return true
  }

  function blur(): void {
    if (focusedId === null) return
    focusedId = null
    commit()
  }

  function cycleFocus(direction: 1 | -1 = 1): string | null {
    const targets = focusTargets()
    if (targets.length === 0) return null
    const current = focusedId ? targets.indexOf(focusedId) : -1
    const nextIndex =
      current === -1
        ? direction === 1
          ? 0
          : targets.length - 1
        : (current + direction + targets.length) % targets.length
    const id = targets[nextIndex] as string
    focus(id)
    return id
  }

  function fullBounds(): Bounds {
    return { x: 0, y: 0, width: viewport.width, height: viewport.height }
  }

  function applyStage(id: string, build: (win: WindowState) => WindowState | null): boolean {
    const win = windows[id]
    if (!win) return false
    const next = build(win)
    if (!next) return false
    setWindow(next)
    queueEvent(() => emitter.emit('stage', { window: next, previous: win.stage }))
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
      const restoreBounds = win.stage === 'normal' ? win.bounds : win.restoreBounds
      return {
        ...win,
        stage: 'maximized',
        snapZone: null,
        restoreBounds,
        restoreStage: null,
        bounds: fullBounds(),
      }
    })
    if (result) focus(id)
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
          return { ...win, stage: 'maximized', restoreStage: null, bounds: fullBounds() }
        }
        if (target === 'snapped' && win.snapZone) {
          return {
            ...win,
            stage: 'snapped',
            restoreStage: null,
            bounds: zoneBounds(win.snapZone, viewport),
          }
        }
        return { ...win, stage: 'normal', restoreStage: null }
      }
      if (win.stage === 'normal') return null
      const bounds = win.restoreBounds ?? win.bounds
      return {
        ...win,
        stage: 'normal',
        snapZone: null,
        restoreBounds: null,
        restoreStage: null,
        bounds: keepInViewport ? clampToViewport(bounds, viewport, minVisible) : bounds,
      }
    })
    if (result) focus(id)
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
        restoreBounds: null,
        restoreStage: null,
        bounds: keepInViewport ? clampToViewport(next, viewport, minVisible) : next,
      }
    })
    if (result) focus(id)
    return result
  }

  function snap(id: string, zone: SnapZone): boolean {
    const result = applyStage(id, (win) => {
      const restoreBounds = win.stage === 'normal' ? win.bounds : win.restoreBounds
      return {
        ...win,
        stage: 'snapped',
        snapZone: zone,
        restoreBounds,
        restoreStage: null,
        bounds: zoneBounds(zone, viewport),
      }
    })
    if (result) focus(id)
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
    const size = normalizeSize(merged, win)
    let bounds: Bounds = { x: merged.x, y: merged.y, ...size }
    if (keepInViewport) bounds = clampToViewport(bounds, viewport, minVisible)
    const becameNormal = win.stage === 'snapped'
    if (boundsEqual(bounds, win.bounds) && !becameNormal) return true
    const next: WindowState = becameNormal
      ? { ...win, stage: 'normal', snapZone: null, restoreBounds: null, bounds }
      : { ...win, bounds }
    setWindow(next)
    if (becameNormal) queueEvent(() => emitter.emit('stage', { window: next, previous: 'snapped' }))
    queueEvent(() => emitter.emit('resize', { window: next }))
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
      draggable: patch.draggable ?? win.draggable,
      resizable: patch.resizable ?? win.resizable,
      closable: patch.closable ?? win.closable,
      minimizable: patch.minimizable ?? win.minimizable,
      maximizable: patch.maximizable ?? win.maximizable,
      snappable: patch.snappable ?? win.snappable,
      meta: patch.meta ? { ...win.meta, ...patch.meta } : win.meta,
    }
    const size = normalizeSize(next.bounds, next)
    const resized = size.width !== next.bounds.width || size.height !== next.bounds.height
    const finalWin = resized ? { ...next, bounds: { ...next.bounds, ...size } } : next
    setWindow(finalWin)
    if (patch.layer && patch.layer !== win.layer) {
      order = sortByLayer(order)
      queueEvent(() => emitter.emit('order', { order }))
    }
    queueEvent(() => emitter.emit('update', { window: finalWin }))
    if (resized) queueEvent(() => emitter.emit('resize', { window: finalWin }))
    commit()
    return true
  }

  function setViewport(next: Size): void {
    if (next.width === viewport.width && next.height === viewport.height) return
    viewport = { ...next }
    batch(() => {
      for (const id of order) {
        const win = windows[id] as WindowState
        if (win.stage === 'maximized') {
          const updated = { ...win, bounds: fullBounds() }
          setWindow(updated)
          queueEvent(() => emitter.emit('resize', { window: updated }))
        } else if (win.stage === 'snapped' && win.snapZone) {
          const updated = { ...win, bounds: zoneBounds(win.snapZone, viewport) }
          setWindow(updated)
          queueEvent(() => emitter.emit('resize', { window: updated }))
        } else if (win.stage === 'normal' && keepInViewport) {
          const bounds = clampToViewport(win.bounds, viewport, minVisible)
          if (!boundsEqual(bounds, win.bounds)) {
            const updated = { ...win, bounds }
            setWindow(updated)
            queueEvent(() => emitter.emit('move', { window: updated }))
          }
        }
      }
      snapshot = null
      batchDirty = true
    })
  }

  function minimized(): readonly WindowState[] {
    return Object.values(windows)
      .filter((win) => win.stage === 'minimized')
      .sort((a, b) => a.openedSeq - b.openedSeq)
  }

  function batch(run: () => void): void {
    batchDepth += 1
    try {
      run()
    } finally {
      batchDepth -= 1
      if (batchDepth === 0 && batchDirty) {
        batchDirty = false
        snapshot = null
        flushEvents()
        emitter.emit('change', { state: getState() })
      }
    }
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
          minSize: { ...win.minSize },
          maxSize: win.maxSize ? { ...win.maxSize } : null,
          meta: { ...win.meta },
        })),
      order: [...order],
      focusedId,
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

  function isSerializedWindow(value: unknown): value is WindowState {
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

  function hydrate(data: SerializedState): boolean {
    if (typeof data !== 'object' || data === null) return false
    if (data.version !== 1 || !Array.isArray(data.windows)) return false
    if (!data.windows.every(isSerializedWindow)) return false

    const nextWindows: Record<string, WindowState> = {}
    let maxSeq = 0
    for (const raw of data.windows) {
      if (nextWindows[raw.id]) return false
      const win: WindowState = {
        id: raw.id,
        title: typeof raw.title === 'string' ? raw.title : 'Window',
        bounds: { ...raw.bounds },
        restoreBounds:
          raw.restoreBounds && isBounds(raw.restoreBounds) ? { ...raw.restoreBounds } : null,
        restoreStage: STAGES.includes(raw.restoreStage as WindowStage) ? raw.restoreStage : null,
        stage: raw.stage,
        snapZone: ZONES.includes(raw.snapZone as SnapZone) ? raw.snapZone : null,
        layer: raw.layer,
        minSize: isSize(raw.minSize) ? { ...raw.minSize } : { width: 160, height: 100 },
        maxSize: isSize(raw.maxSize) ? { ...raw.maxSize } : null,
        openedSeq: typeof raw.openedSeq === 'number' ? raw.openedSeq : ++maxSeq,
        draggable: raw.draggable !== false,
        resizable: raw.resizable !== false,
        closable: raw.closable !== false,
        minimizable: raw.minimizable !== false,
        maximizable: raw.maximizable !== false,
        snappable: raw.snappable !== false,
        meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
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
    order = nextOrder
    order = sortByLayer(order)
    seq = maxSeq
    focusedId = data.focusedId && windows[data.focusedId] ? data.focusedId : null
    if (focusedId && windows[focusedId]?.stage === 'minimized') focusedId = null
    if (!focusedId) focusTop()
    commit()
    return true
  }

  function destroy(): void {
    emitter.clear()
  }

  return {
    open,
    close,
    closeAll,
    focus,
    blur,
    cycleFocus,
    minimize,
    maximize,
    toggleMaximize,
    restore,
    restoreTo,
    snap,
    move,
    moveBy,
    resize,
    update,
    get: (id) => windows[id],
    getState,
    minimized,
    setViewport,
    batch,
    serialize,
    hydrate,
    subscribe: (listener) => emitter.on('change', ({ state }) => listener(state)),
    on: (event, listener) => emitter.on(event, listener),
    destroy,
  }
}
