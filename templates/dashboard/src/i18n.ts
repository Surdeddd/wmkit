export type Lang = 'en' | 'ru'

const en = {
  title: 'Operations',
  theme: 'Theme',
  reset: 'Reset layout',
  hint: 'Drag a title to move a panel, hold Shift to float it.',
  switchTo: 'RU',
  kpis: 'Key figures',
  chart: 'Revenue',
  orders: 'Orders',
  log: 'Live log',
  revenue: 'Revenue today',
  ordersToday: 'Orders',
  conversion: 'Conversion',
  latency: 'p95 latency',
  chartLabel: 'Revenue over the last minutes',
  columns: ['Order', 'Customer', 'Total', 'Status'],
  statuses: ['paid', 'packed', 'shipped'],
  events: ['payment captured', 'order packed', 'courier assigned', 'refund requested', 'stock low'],
}

const ru: typeof en = {
  title: 'Операции',
  theme: 'Тема',
  reset: 'Сбросить раскладку',
  hint: 'Тащите заголовок, чтобы переставить панель, с Shift — чтобы она плавала.',
  switchTo: 'EN',
  kpis: 'Ключевые цифры',
  chart: 'Выручка',
  orders: 'Заказы',
  log: 'Журнал',
  revenue: 'Выручка за день',
  ordersToday: 'Заказы',
  conversion: 'Конверсия',
  latency: 'Задержка p95',
  chartLabel: 'Выручка за последние минуты',
  columns: ['Заказ', 'Клиент', 'Сумма', 'Статус'],
  statuses: ['оплачен', 'собран', 'отправлен'],
  events: [
    'платёж принят',
    'заказ собран',
    'курьер назначен',
    'запрошен возврат',
    'остаток на исходе',
  ],
}

const KEY = 'wmkit-dashboard-lang'

export function currentLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'ru') return saved
  } catch {}
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang)
  } catch {}
}

export function texts(lang: Lang): typeof en {
  return lang === 'ru' ? ru : en
}
