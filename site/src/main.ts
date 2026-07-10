import {
  attachDesktop,
  createWindowManager,
  prefersReducedMotion,
  type WindowInit,
} from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'
import './landing.css'
import { type Dict, dictionaries, type Lang } from './i18n'
import { highlight, snippets } from './snippets'

const winAria: Record<Lang, { minimize: string; maximize: string; close: string }> = {
  en: { minimize: 'Minimize', maximize: 'Maximize', close: 'Close' },
  ru: { minimize: 'Свернуть', maximize: 'Развернуть', close: 'Закрыть' },
}

function resolveLang(): Lang {
  const fromQuery = new URLSearchParams(location.search).get('lang')
  if (fromQuery === 'ru' || fromQuery === 'en') return fromQuery
  const stored = localStorage.getItem('wmkit-lang')
  if (stored === 'ru' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

let lang: Lang = resolveLang()
const dict = (): Dict => dictionaries[lang]

function must<T>(value: T | null, what: string): T {
  if (!value) throw new Error(`wmkit landing: missing ${what}`)
  return value
}

const desktopEl = must(document.querySelector<HTMLElement>('#desktop'), '#desktop')
const dockEl = must(document.querySelector<HTMLElement>('#dock'), '#dock')
const dockWrap = must(dockEl.parentElement, 'dock wrapper')
const dockPlus = must(document.querySelector<HTMLElement>('#dock-plus'), '#dock-plus')

const wm = createWindowManager()
const desktop = attachDesktop(wm, desktopEl, {
  minimizeTarget: () => dockWrap,
})

const mounted = new Map<string, HTMLElement>()

function buildChrome(id: string, title: string, cls?: string): HTMLElement {
  const aria = winAria[lang]
  const el = document.createElement('section')
  if (cls) el.classList.add(cls)
  el.dataset.testid = `window-${id}`
  el.innerHTML = `
    <header data-wm-drag>
      <span data-wm-controls>
        <button data-wm-close aria-label="${aria.close}" type="button"></button>
        <button data-wm-minimize aria-label="${aria.minimize}" type="button"></button>
        <button data-wm-maximize aria-label="${aria.maximize}" type="button"></button>
      </span>
      <span data-wm-title>${title}</span>
    </header>
    <div data-wm-content></div>
  `
  return el
}

function spawn(
  init: WindowInit & { id: string; title: string },
  cls: string | undefined,
  fill: (content: HTMLElement) => void,
): void {
  if (wm.get(init.id)) {
    wm.focus(init.id)
    return
  }
  wm.open(init)
  const el = buildChrome(init.id, init.title, cls)
  const content = must(el.querySelector<HTMLElement>('[data-wm-content]'), 'window content')
  desktopEl.append(el)
  fill(content)
  const detach = desktop.attachWindow(init.id, el)
  const stop = wm.on('close', ({ window: win }) => {
    if (win.id !== init.id) return
    detach()
    el.remove()
    mounted.delete(init.id)
    stop()
  })
  mounted.set(init.id, el)
}

function renderDock(): void {
  dockEl.replaceChildren(
    ...wm.minimized().map((win) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.task = win.id
      button.textContent = win.title
      button.addEventListener('click', () => wm.focus(win.id))
      return button
    }),
  )
}

wm.subscribe(renderDock)

function fillWelcome(content: HTMLElement): void {
  content.innerHTML = dict().windows.welcomeHtml
}

const terminalScript = [
  { cmd: 'pnpm add @surdeddd/wmkit', out: '+ wmkit · 0 dependencies' },
  { cmd: "wm.open({ title: 'hello' })", out: '→ focused · draggable · snappable' },
  { cmd: 'wm.serialize()', out: '{ version: 1, windows: [...] } → localStorage' },
]

function fillTerminal(content: HTMLElement): void {
  content.replaceChildren()
  if (prefersReducedMotion(window)) {
    content.innerHTML = terminalScript
      .map((line) => `<div class="t-line">${line.cmd}</div><div class="t-out">${line.out}</div>`)
      .join('')
    return
  }
  let index = 0
  const typeLine = () => {
    if (!content.isConnected) return
    const line = terminalScript[index % terminalScript.length]
    if (!line) return
    if (index === 0 && content.childElementCount > 8) content.replaceChildren()
    content.querySelector('.t-cursor')?.remove()
    const row = document.createElement('div')
    row.className = 't-line'
    const cursor = document.createElement('span')
    cursor.className = 't-cursor'
    content.append(row, cursor)
    let pos = 0
    const tick = () => {
      if (!content.isConnected) return
      row.textContent = line.cmd.slice(0, ++pos)
      if (pos < line.cmd.length) {
        setTimeout(tick, 34 + Math.sin(pos) * 14)
      } else {
        const out = document.createElement('div')
        out.className = 't-out'
        out.textContent = line.out
        content.insertBefore(out, cursor)
        index += 1
        if (index % terminalScript.length === 0) {
          setTimeout(() => {
            if (content.isConnected) content.replaceChildren()
            setTimeout(typeLine, 400)
          }, 3200)
        } else {
          setTimeout(typeLine, 900)
        }
      }
    }
    setTimeout(tick, 300)
  }
  typeLine()
}

function fillMetrics(content: HTMLElement): void {
  content.replaceChildren(
    ...dict().windows.metrics.map(([value, label]) => {
      const cell = document.createElement('div')
      cell.className = 'metric'
      const big = document.createElement('b')
      big.textContent = value
      const small = document.createElement('span')
      small.textContent = label
      cell.append(big, small)
      return cell
    }),
  )
}

let spawnCounter = 0

function fillPlayground(content: HTMLElement): void {
  const copy = dict().windows
  content.innerHTML = `<p class="win-body">${copy.playgroundHint}</p>`
  const actions = document.createElement('div')
  actions.className = 'win-actions'
  const buttons: Array<[string, () => void]> = [
    [
      copy.actions.open,
      () => {
        spawnCounter += 1
        const id = `play-${spawnCounter}`
        spawn(
          { id, title: `${copy.spawnedTitle} ${spawnCounter}`, width: 280, height: 180 },
          undefined,
          (body) => {
            body.innerHTML = `<p class="win-body">${copy.spawnedBody}</p>`
          },
        )
      },
    ],
    [
      copy.actions.modal,
      () => {
        spawnCounter += 1
        spawn(
          {
            id: `play-modal-${spawnCounter}`,
            title: copy.modalTitle,
            layer: 'modal',
            width: 320,
            height: 190,
          },
          undefined,
          (body) => {
            body.innerHTML = `<p class="win-body">${copy.modalBody}</p>`
          },
        )
      },
    ],
    [
      copy.actions.stress,
      () => {
        wm.batch(() => {
          for (let i = 0; i < 15; i += 1) {
            spawnCounter += 1
            const id = `play-${spawnCounter}`
            spawn(
              {
                id,
                title: `${copy.spawnedTitle} ${spawnCounter}`,
                width: 220,
                height: 140,
                x: 16 + (i % 5) * 64,
                y: 16 + Math.floor(i / 5) * 64,
              },
              undefined,
              (body) => {
                body.innerHTML = `<p class="win-body">#${spawnCounter}</p>`
              },
            )
          }
        })
      },
    ],
    [copy.actions.snap, () => wm.snap('playground', 'left')],
  ]
  for (const [label, run] of buttons) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', run)
    actions.append(button)
  }
  content.append(actions)
}

function openInitialWindows(): void {
  const width = desktopEl.clientWidth
  const height = desktopEl.clientHeight
  const tier: 'wide' | 'medium' | 'compact' =
    width >= 900 ? 'wide' : width >= 480 ? 'medium' : 'compact'
  spawn(
    {
      id: 'welcome',
      title: dict().windows.welcomeTitle,
      x: tier === 'compact' ? 12 : 26,
      y: tier === 'compact' ? 14 : 28,
      width: tier === 'compact' ? Math.max(240, width - 56) : 396,
      height: tier === 'compact' ? 270 : 280,
    },
    undefined,
    fillWelcome,
  )
  spawn(
    {
      id: 'terminal',
      title: dict().windows.terminalTitle,
      x: width - 382,
      y: tier === 'wide' ? 60 : Math.min(330, height - 260),
      width: 356,
      height: 224,
      stage: tier === 'compact' ? 'minimized' : 'normal',
      minHeight: 150,
    },
    'win-terminal',
    fillTerminal,
  )
  spawn(
    {
      id: 'metrics',
      title: dict().windows.metricsTitle,
      x: Math.round(width * 0.42),
      y: Math.max(240, Math.round(height * 0.55)),
      width: 336,
      height: 240,
      stage: tier === 'wide' ? 'normal' : 'minimized',
    },
    'win-metrics',
    fillMetrics,
  )
  wm.focus('welcome')
}

dockPlus.addEventListener('click', () => {
  spawn(
    { id: 'playground', title: dict().windows.playgroundTitle, width: 330, height: 230 },
    undefined,
    fillPlayground,
  )
})

function renderFeatures(): void {
  const grid = must(document.querySelector<HTMLElement>('#feature-grid'), '#feature-grid')
  grid.replaceChildren(
    ...dict().features.map((feature) => {
      const card = document.createElement('article')
      card.className = 'card'
      card.innerHTML = `<div class="icon">${feature.icon}</div><h3>${feature.title}</h3><p>${feature.text}</p>`
      return card
    }),
  )
}

document.addEventListener('pointermove', (event) => {
  const card = (event.target as Element | null)?.closest<HTMLElement>('.card')
  if (!card) return
  const rect = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  card.style.setProperty('--my', `${event.clientY - rect.top}px`)
})

function renderTabs(): void {
  const tabs = must(document.querySelector<HTMLElement>('#fw-tabs'), '#fw-tabs')
  const codeEl = must(document.querySelector<HTMLElement>('#fw-code'), '#fw-code')
  const select = (id: string) => {
    const snippet = snippets.find((entry) => entry.id === id) ?? snippets[0]
    if (!snippet) return
    codeEl.innerHTML = highlight(snippet.code)
    for (const button of tabs.querySelectorAll('button')) {
      button.setAttribute('aria-selected', String(button.dataset.tab === snippet.id))
    }
  }
  tabs.replaceChildren(
    ...snippets.map((snippet) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.role = 'tab'
      button.dataset.tab = snippet.id
      button.textContent = snippet.label
      button.addEventListener('click', () => select(snippet.id))
      return button
    }),
  )
  select('vanilla')
}

function renderCompare(): void {
  const wrap = must(document.querySelector<HTMLElement>('#compare-table'), '#compare-table')
  const data = dict()
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  data.compareHead.forEach((label, index) => {
    const th = document.createElement('th')
    th.textContent = label
    if (index === 1) th.classList.add('col-wmkit')
    headRow.append(th)
  })
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const row of data.compareRows) {
    const tr = document.createElement('tr')
    const th = document.createElement('td')
    th.textContent = row.label
    tr.append(th)
    row.cells.forEach((cell, index) => {
      const td = document.createElement('td')
      td.textContent = cell.text
      if (cell.tone !== 'plain') td.classList.add(cell.tone)
      if (index === 0) td.classList.add('col-wmkit')
      tr.append(td)
    })
    tbody.append(tr)
  }
  table.append(thead, tbody)
  wrap.replaceChildren(table)
}

function applyStaticI18n(): void {
  const data = dict()
  document.documentElement.lang = lang
  document.title = data.meta.title
  document.querySelector('meta[name="description"]')?.setAttribute('content', data.meta.description)
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n
    if (key && data.ui[key]) el.textContent = data.ui[key]
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = el.dataset.i18nAria
    if (key && data.ui[key]) el.setAttribute('aria-label', data.ui[key])
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('.lang button')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === lang))
  }
}

function relabelWindows(): void {
  const copy = dict().windows
  const titles: Array<[string, string]> = [
    ['welcome', copy.welcomeTitle],
    ['terminal', copy.terminalTitle],
    ['metrics', copy.metricsTitle],
    ['playground', copy.playgroundTitle],
  ]
  for (const [id, title] of titles) {
    if (wm.get(id)) wm.update(id, { title })
    const titleEl = mounted.get(id)?.querySelector('[data-wm-title]')
    if (titleEl) titleEl.textContent = title
  }
  const aria = winAria[lang]
  for (const el of mounted.values()) {
    el.querySelector('[data-wm-close]')?.setAttribute('aria-label', aria.close)
    el.querySelector('[data-wm-minimize]')?.setAttribute('aria-label', aria.minimize)
    el.querySelector('[data-wm-maximize]')?.setAttribute('aria-label', aria.maximize)
  }
  const welcome = mounted.get('welcome')?.querySelector<HTMLElement>('[data-wm-content]')
  if (welcome) fillWelcome(welcome)
  const metrics = mounted.get('metrics')?.querySelector<HTMLElement>('[data-wm-content]')
  if (metrics) fillMetrics(metrics)
  const playground = mounted.get('playground')?.querySelector<HTMLElement>('[data-wm-content]')
  if (playground) fillPlayground(playground)
}

function setLang(next: Lang): void {
  if (next === lang) return
  lang = next
  localStorage.setItem('wmkit-lang', lang)
  applyStaticI18n()
  renderFeatures()
  renderCompare()
  relabelWindows()
  renderDock()
}

for (const button of document.querySelectorAll<HTMLButtonElement>('.lang button')) {
  button.addEventListener('click', () => {
    const next = button.dataset.lang
    if (next === 'ru' || next === 'en') setLang(next)
  })
}

for (const button of document.querySelectorAll<HTMLButtonElement>('.copy')) {
  button.addEventListener('click', async () => {
    const text = button.dataset.copy ?? ''
    try {
      await navigator.clipboard.writeText(text)
      button.dataset.copied = ''
      setTimeout(() => {
        delete button.dataset.copied
      }, 1400)
    } catch {}
  })
}

applyStaticI18n()
renderFeatures()
renderTabs()
renderCompare()
openInitialWindows()

declare global {
  interface Window {
    __wmLanding: typeof wm
  }
}
window.__wmLanding = wm
