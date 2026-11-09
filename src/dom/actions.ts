import type { SnapZone, WindowManager, WindowState } from '../core/types'

export interface WindowActions {
  focus(): boolean
  close(): boolean
  minimize(): boolean
  maximize(): boolean
  toggleMaximize(): boolean
  restore(): boolean
  center(): boolean
  sendToBack(): boolean
  snap(zone: SnapZone): boolean
  moveToWorkspace(workspace: number): boolean
}

export function createActions(
  wm: WindowManager,
  id: string,
  // biome-ignore lint/suspicious/noConfusingVoidType: a handler may return nothing
  beforeClose?: (window: WindowState) => boolean | void,
): WindowActions {
  return {
    focus: () => wm.focus(id),
    close: () => {
      const win = wm.get(id)
      return !!win && beforeClose?.(win) !== false && wm.close(id)
    },
    minimize: () => wm.minimize(id),
    maximize: () => wm.maximize(id),
    toggleMaximize: () => wm.toggleMaximize(id),
    restore: () => wm.restore(id),
    center: () => wm.center(id),
    sendToBack: () => wm.sendToBack(id),
    snap: (zone) => wm.snap(id, zone),
    moveToWorkspace: (workspace) => wm.moveToWorkspace(id, workspace),
  }
}
