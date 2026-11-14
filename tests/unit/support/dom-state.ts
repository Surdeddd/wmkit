import type { WindowManager } from '../../../src/core/types'

const GESTURE_MARKS = ['wmDragging', 'wmResizing', 'wmPinching', 'wmTabTarget'] as const

export function stateDrift(wm: WindowManager): string[] {
  const found: string[] = []
  const state = wm.getState()
  const ids = Object.keys(state.windows)
  if ([...state.order].sort().join('\n') !== [...ids].sort().join('\n')) {
    found.push('the order lists other windows than the state holds')
  }
  if (state.focusedId !== null && !state.windows[state.focusedId]) {
    found.push(`focus points at ${state.focusedId}, which is gone`)
  }
  for (const id of ids) {
    const win = state.windows[id]
    if (!win) continue
    const { x, y, width, height } = win.bounds
    if (![x, y, width, height].every(Number.isFinite)) {
      found.push(`${id} has broken bounds ${JSON.stringify(win.bounds)}`)
      continue
    }
    if (win.stage !== 'normal') continue
    if (width < win.minSize.width || height < win.minSize.height) {
      found.push(`${id} is ${width}x${height}, under its minimum`)
    }
    if (win.maxSize && (width > win.maxSize.width || height > win.maxSize.height)) {
      found.push(`${id} is ${width}x${height}, over its maximum`)
    }
  }
  return found
}

export function domDrift(wm: WindowManager, desktop: HTMLElement): string[] {
  const found: string[] = []
  const state = wm.getState()
  const nodes = [...desktop.querySelectorAll<HTMLElement>('[data-wm-window]')]
  const byId = new Map<string, HTMLElement>()
  for (const node of nodes) {
    const id = node.dataset.wmWindow as string
    if (byId.has(id)) found.push(`${id} is attached to two elements`)
    byId.set(id, node)
  }

  const focused = nodes.filter((node) => node.dataset.wmFocused !== undefined)
  if (focused.length > 1) found.push(`${focused.length} windows are marked focused`)
  const marked = focused[0]?.dataset.wmWindow ?? null
  const expected = state.focusedId !== null && byId.has(state.focusedId) ? state.focusedId : null
  if (marked !== expected) found.push(`the page marks ${marked} focused, the state ${expected}`)

  let previous = Number.NEGATIVE_INFINITY
  for (const id of state.order) {
    const node = byId.get(id)
    if (!node) continue
    const z = Number(node.style.zIndex)
    if (!(z > previous)) found.push(`${id} breaks the z ladder at ${z}`)
    previous = z
  }

  for (const [id, node] of byId) {
    const win = state.windows[id]
    if (!win) {
      found.push(`${id} is attached but gone from the state`)
      continue
    }
    const group = win.groupId === null ? undefined : state.groups[win.groupId]
    const hidden =
      win.stage === 'minimized' ||
      win.workspace !== state.workspace ||
      (group !== undefined && group.activeId !== id)
    if (node.hidden !== hidden) found.push(`${id} hidden is ${node.hidden}, not ${hidden}`)
    if (node.dataset.wmStage !== win.stage) {
      found.push(`${id} is marked ${node.dataset.wmStage}, its stage is ${win.stage}`)
    }
    if (node.dataset.wmLayer !== win.layer) {
      found.push(`${id} is marked ${node.dataset.wmLayer}, its layer is ${win.layer}`)
    }
    if (node.dataset.wmWorkspace !== String(win.workspace)) {
      found.push(`${id} is marked workspace ${node.dataset.wmWorkspace}, not ${win.workspace}`)
    }
    if ((node.dataset.wmGroup ?? null) !== win.groupId) {
      found.push(`${id} is marked group ${node.dataset.wmGroup}, not ${win.groupId}`)
    }
    const at = `translate3d(${win.bounds.x}px, ${win.bounds.y}px, 0)`
    if (node.style.transform !== at)
      found.push(`${id} is drawn at ${node.style.transform}, not ${at}`)
    if (node.style.width !== `${win.bounds.width}px`) {
      found.push(`${id} is drawn ${node.style.width} wide, not ${win.bounds.width}px`)
    }
    if (node.style.height !== `${win.bounds.height}px`) {
      found.push(`${id} is drawn ${node.style.height} tall, not ${win.bounds.height}px`)
    }
  }
  return found
}

export function gestureResidue(desktop: HTMLElement): string[] {
  const found: string[] = []
  for (const node of desktop.querySelectorAll<HTMLElement>('[data-wm-window]')) {
    for (const mark of GESTURE_MARKS) {
      if (node.dataset[mark] !== undefined)
        found.push(`${node.dataset.wmWindow} still carries ${mark}`)
    }
  }
  const preview = desktop.querySelector<HTMLElement>('[data-wm-snap-preview]')
  if (preview && preview.style.display !== 'none') found.push('the snap preview is still showing')
  return found
}
