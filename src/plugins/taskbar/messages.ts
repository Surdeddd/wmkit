export interface TaskbarMessages {
  label: string
  tabs(title: string, count: number): string
}

export const taskbarMessages: TaskbarMessages = {
  label: 'Windows',
  tabs: (title, count) => `${title}, ${count} tabs`,
}

export const taskbarMessagesRu: TaskbarMessages = {
  label: 'Окна',
  tabs: (title, count) => `${title}, вкладок: ${count}`,
}
