import { createDock, type DockLayout, dockMessages, dockMessagesRu } from '@surdeddd/wmkit/dock'
import {
  defineWmElements,
  type WmDesktopElement,
  type WmWindowElement,
} from '@surdeddd/wmkit/elements'
import { type ThemeName, themeStyle } from '@surdeddd/wmkit/themes'
import { currentLang, saveLang, texts } from './i18n'
import { appendLog, renderChart, renderKpis, renderOrders } from './panels'
import './style.css'

const lang = currentLang()
const t = texts(lang)
document.documentElement.lang = lang

const THEME_KEY = 'wmkit-dashboard-theme'
const themeStyleEl = document.createElement('style')
document.head.append(themeStyleEl)
const themeSelect = document.querySelector('#theme') as HTMLSelectElement
function applyTheme(name: ThemeName): void {
  themeStyleEl.textContent = themeStyle(name)
  themeSelect.value = name
  document.body.dataset.theme = name
  try {
    localStorage.setItem(THEME_KEY, name)
  } catch {}
}
let savedTheme: string | null = null
try {
  savedTheme = localStorage.getItem(THEME_KEY)
} catch {}
applyTheme((savedTheme as ThemeName | null) ?? 'glass')
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value as ThemeName))

for (const node of document.querySelectorAll<HTMLElement>('[data-text]')) {
  const key = node.dataset.text as keyof typeof t
  const value = t[key]
  if (typeof value === 'string') node.textContent = value
}
const langButton = document.querySelector('#lang') as HTMLButtonElement
langButton.textContent = t.switchTo
langButton.addEventListener('click', () => {
  saveLang(lang === 'ru' ? 'en' : 'ru')
  location.reload()
})

defineWmElements()
const desktop = document.querySelector('wm-desktop') as WmDesktopElement
for (const id of ['kpis', 'chart', 'orders', 'log'] as const) {
  document.querySelector(`wm-window[window-id="${id}"]`)?.setAttribute('label', t[id])
}
const dock = createDock(desktop.controller as NonNullable<WmDesktopElement['controller']>, {
  messages: lang === 'ru' ? dockMessagesRu : dockMessages,
})

const DEFAULT: DockLayout = {
  root: {
    kind: 'split',
    id: 'main',
    axis: 'row',
    sizes: [0.58, 0.42],
    children: [
      {
        kind: 'split',
        id: 'left',
        axis: 'column',
        sizes: [0.34, 0.66],
        children: [
          { kind: 'stack', id: 'top', windows: ['kpis'], active: 'kpis' },
          { kind: 'stack', id: 'graph', windows: ['chart'], active: 'chart' },
        ],
      },
      {
        kind: 'split',
        id: 'right',
        axis: 'column',
        sizes: [0.55, 0.45],
        children: [
          { kind: 'stack', id: 'table', windows: ['orders'], active: 'orders' },
          { kind: 'stack', id: 'events', windows: ['log'], active: 'log' },
        ],
      },
    ],
  },
}

function reset(): void {
  for (const node of document.querySelectorAll<WmWindowElement>('wm-window[closed]')) {
    node.removeAttribute('closed')
  }
  dock.setLayout(DEFAULT)
}

if (!dock.layout().root) {
  dock.setLayout(DEFAULT)
  desktop.manager?.clearHistory()
}
document.querySelector('#reset')?.addEventListener('click', reset)

const kpiList = document.querySelector('#kpi-list') as HTMLElement
const chart = document.querySelector('#chart') as SVGSVGElement
const orderHead = document.querySelector('#order-head') as HTMLElement
const orderRows = document.querySelector('#order-rows') as HTMLElement
const log = document.querySelector('#log') as HTMLElement
const points = Array.from({ length: 30 }, (_, i) => 60 + Math.sin(i / 3) * 20 + i)
let tick = 0

function frame(): void {
  renderKpis(kpiList, t, tick)
  renderChart(chart, t, points)
  renderOrders(orderHead, orderRows, t, Math.floor(tick / 4))
  appendLog(log, t, tick)
}

frame()
setInterval(() => {
  tick += 1
  points.push(Math.max(10, (points.at(-1) ?? 60) + (Math.random() - 0.45) * 12))
  points.shift()
  frame()
}, 1500)

Object.assign(window, { __dashboard: { desktop, dock } })
