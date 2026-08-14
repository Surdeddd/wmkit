import type { WindowStage } from '../../core/types'

export interface DevtoolsMessages {
  title: string
  windows: string
  events: string
  empty: string
  quiet: string
  focus: string
  minimize: string
  maximize: string
  close: string
  undo: string
  redo: string
  copyState: string
  copied: string
  workspace(index: number): string
  stage(stage: WindowStage): string
}

const EN_STAGES: Record<WindowStage, string> = {
  normal: 'normal',
  minimized: 'minimized',
  maximized: 'maximized',
  snapped: 'snapped',
}

const RU_STAGES: Record<WindowStage, string> = {
  normal: 'обычное',
  minimized: 'свёрнуто',
  maximized: 'развёрнуто',
  snapped: 'прилипло',
}

export const devtoolsMessages: DevtoolsMessages = {
  title: 'wmkit devtools',
  windows: 'windows',
  events: 'events',
  empty: 'no windows open',
  quiet: 'nothing has happened yet',
  focus: 'focus',
  minimize: 'minimize',
  maximize: 'maximize',
  close: 'close',
  undo: 'undo',
  redo: 'redo',
  copyState: 'copy state',
  copied: 'copied',
  workspace: (index) => `workspace ${index + 1}`,
  stage: (stage) => EN_STAGES[stage],
}

export const devtoolsMessagesRu: DevtoolsMessages = {
  title: 'wmkit devtools',
  windows: 'окна',
  events: 'события',
  empty: 'открытых окон нет',
  quiet: 'пока ничего не происходило',
  focus: 'фокус',
  minimize: 'свернуть',
  maximize: 'развернуть',
  close: 'закрыть',
  undo: 'отменить',
  redo: 'вернуть',
  copyState: 'скопировать состояние',
  copied: 'скопировано',
  workspace: (index) => `рабочий стол ${index + 1}`,
  stage: (stage) => RU_STAGES[stage],
}
