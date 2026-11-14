import type { AnnouncerMessages } from '../dom/announcer'

const ZONES_RU: Record<string, string> = {
  left: 'к левой половине',
  right: 'к правой половине',
  top: 'к верхней половине',
  bottom: 'к нижней половине',
  'top-left': 'к левому верхнему углу',
  'top-right': 'к правому верхнему углу',
  'bottom-left': 'к левому нижнему углу',
  'bottom-right': 'к правому нижнему углу',
  'left-third': 'к левой трети',
  'center-third': 'к средней трети',
  'right-third': 'к правой трети',
}

function windowsRu(count: number): string {
  const one = count % 10
  const two = count % 100
  const few = one > 1 && one < 5 && (two < 12 || two > 14)
  return `${count} ${one === 1 && two !== 11 ? 'окно' : few ? 'окна' : 'окон'}`
}

export const announcerMessagesRu: AnnouncerMessages = {
  opened: (title) => `Окно «${title}» открыто`,
  closed: (title) => `Окно «${title}» закрыто`,
  minimized: (title) => `Окно «${title}» свёрнуто`,
  restored: (title) => `Окно «${title}» восстановлено`,
  maximized: (title) => `Окно «${title}» развёрнуто`,
  snapped: (title, zone) => `Окно «${title}» прикреплено ${ZONES_RU[zone] ?? zone}`,
  focused: (title) => `Окно «${title}» в фокусе`,
  workspace: (index) => `Рабочий стол ${index + 1}`,
  openedMany: (count) => `Открыто ${windowsRu(count)}`,
  closedMany: (count) => `Закрыто ${windowsRu(count)}`,
  minimizedMany: (count) => `Свёрнуто ${windowsRu(count)}`,
  restoredMany: (count) => `Восстановлено ${windowsRu(count)}`,
}
