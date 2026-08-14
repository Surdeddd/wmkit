import {
  attachDesktop,
  createWindowManager,
  type DesktopController,
  type DesktopOptions,
  prefersReducedMotion,
  type WindowInit,
  type WindowState,
} from '@surdeddd/wmkit'
import glassUrl from '@surdeddd/wmkit/themes/glass.css?url'
import lightUrl from '@surdeddd/wmkit/themes/light.css?url'
import retroUrl from '@surdeddd/wmkit/themes/retro.css?url'
import type { AppContext, AppInstance, AppSpec, ThemeName } from './apps'
import { apps } from './apps'
import { type AppId, type Dict, dictionaries, type Lang } from './i18n'
import './os.css'
import './apps.css'

const THEME_URLS: Record<ThemeName, string> = {
  glass: glassUrl,
  light: lightUrl,
  retro: retroUrl,
}

const WORKSPACES = 3

const EN_CONTROLS = [
  ['[data-wm-close]', 'Close'],
  ['[data-wm-minimize]', 'Minimize'],
  ['[data-wm-maximize]', 'Maximize'],
] as const

const RU_CONTROLS = [
  ['[data-wm-close]', 'Закрыть'],
  ['[data-wm-minimize]', 'Свернуть'],
  ['[data-wm-maximize]', 'Развернуть'],
] as const

function must<T>(value: T | null, what: string): T {
  if (!value) throw new Error(`wmkit demo: missing ${what}`)
  return value
}

const desktopEl = must(document.querySelector<HTMLElement>('#desktop'), '#desktop')
const dockEl = must(document.querySelector<HTMLElement>('#dock'), '#dock')
const launcherEl = must(document.querySelector<HTMLElement>('#launcher'), '#launcher')
const menusEl = must(document.querySelector<HTMLElement>('#menus'), '#menus')
const workspacesEl = must(document.querySelector<HTMLElement>('#workspaces'), '#workspaces')
const bootEl = must(document.querySelector<HTMLElement>('#boot'), '#boot')
const bootLog = must(document.querySelector<HTMLElement>('#boot-log'), '#boot-log')
const statWin = must(document.querySelector<HTMLElement>('#stat-win'), '#stat-win')
const statFps = must(document.querySelector<HTMLElement>('#stat-fps'), '#stat-fps')

function resolveLang(): Lang {
  const fromQuery = new URLSearchParams(location.search).get('lang')
  if (fromQuery === 'ru' || fromQuery === 'en') return fromQuery
  const stored = localStorage.getItem('wmkit-lang')
  if (stored === 'ru' || stored === 'en') return stored
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function resolveTheme(): ThemeName {
  const stored = localStorage.getItem('wmkit-theme')
  return stored === 'light' || stored === 'retro' ? stored : 'glass'
}

let lang: Lang = resolveLang()
let theme: ThemeName = resolveTheme()
const dict = (): Dict => dictionaries[lang]

const options = { magnetism: true, snap: true, announce: true }
const wm = createWindowManager({ historyLimit: 60 })

interface Mounted {
  element: HTMLElement
  instance: AppInstance | null
  spec: AppSpec | null
  detach: (() => void) | null
}

const mounted = new Map<string, Mounted>()
const specById = new Map<AppId, AppSpec>(apps.map((spec) => [spec.id, spec]))

const themeLink = document.createElement('link')
themeLink.rel = 'stylesheet'
document.head.append(themeLink)

function applyTheme(): void {
  themeLink.href = THEME_URLS[theme]
  desktopEl.dataset.theme = theme
  localStorage.setItem('wmkit-theme', theme)
}

function desktopOptions(): DesktopOptions {
  return {
    magnetism: options.magnetism,
    snap: options.snap,
    announce: options.announce,
    minimizeTarget: (win) => dockEl.querySelector(`[data-task="${win.id}"]`) ?? dockEl,
    onTitlebarContextMenu: (win) => {
      wm.sendToBack(win.id)
    },
  }
}

let desktop: DesktopController = attachDesktop(wm, desktopEl, desktopOptions())

const ctx: AppContext = {
  wm,
  dict,
  open: (id) => openApp(id),
  reset: () => resetDesktop(),
  theme: () => theme,
  setTheme(next) {
    theme = next
    applyTheme()
    relabelAll()
  },
  option: (name) => options[name],
  setOption(name, value) {
    if (options[name] === value) return
    options[name] = value
    remountDesktop()
    relabelAll()
  },
  size: () => ({ width: desktopEl.clientWidth, height: desktopEl.clientHeight }),
  safeArea,
}

function safeArea(): { x: number; y: number; width: number; height: number } {
  const width = desktopEl.clientWidth
  const height = desktopEl.clientHeight
  const full = { x: 0, y: 0, width, height }
  const hero = document.querySelector<HTMLElement>('.wallpaper')
  if (!hero || width === 0) return full

  const stage = desktopEl.getBoundingClientRect()
  const box = hero.getBoundingClientRect()
  const area =
    width >= 1100
      ? { x: box.right - stage.left + 24, y: 0, width: 0, height }
      : { x: 0, y: box.bottom - stage.top + 16, width, height: 0 }
  area.width = area.width || width - area.x
  area.height = area.height || height - area.y

  return area.width < 260 || area.height < 200 ? full : area
}

function remountDesktop(): void {
  for (const entry of mounted.values()) entry.detach = null
  desktop.destroy()
  desktop = attachDesktop(wm, desktopEl, desktopOptions())
  for (const [id, entry] of mounted) {
    if (wm.get(id)) entry.detach = desktop.attachWindow(id, entry.element, { removeOnClose: true })
  }
}

function chrome(id: string, title: string): HTMLElement {
  const element = document.createElement('section')
  element.dataset.testid = `window-${id}`
  const header = document.createElement('header')
  header.dataset.wmDrag = ''
  const controls = document.createElement('span')
  controls.dataset.wmControls = ''
  for (const [attribute, label] of [
    ['wmClose', lang === 'ru' ? RU_CONTROLS[0][1] : EN_CONTROLS[0][1]],
    ['wmMinimize', lang === 'ru' ? RU_CONTROLS[1][1] : EN_CONTROLS[1][1]],
    ['wmMaximize', lang === 'ru' ? RU_CONTROLS[2][1] : EN_CONTROLS[2][1]],
  ] as const) {
    const control = document.createElement('button')
    control.type = 'button'
    control.dataset[attribute] = ''
    control.setAttribute('aria-label', `${label} ${title}`)
    controls.append(control)
  }
  const titleEl = document.createElement('span')
  titleEl.dataset.wmTitle = ''
  titleEl.textContent = title
  const tabs = document.createElement('span')
  tabs.className = 'win-tabs'
  tabs.hidden = true
  header.append(controls, titleEl, tabs)
  const content = document.createElement('div')
  content.dataset.wmContent = ''
  element.append(header, content)
  return element
}

function contentOf(element: HTMLElement): HTMLElement {
  return must(element.querySelector<HTMLElement>('[data-wm-content]'), 'window content')
}

function mount(id: string, title: string, spec: AppSpec | null): Mounted {
  const element = chrome(id, title)
  desktopEl.append(element)
  const entry: Mounted = { element, instance: null, spec, detach: null }
  mounted.set(id, entry)
  return entry
}

function activate(id: string, entry: Mounted): void {
  entry.detach = desktop.attachWindow(id, entry.element, { removeOnClose: true })
  if (entry.spec) entry.instance = entry.spec.render(contentOf(entry.element), ctx) ?? null
}

function openApp(id: AppId): void {
  const spec = specById.get(id)
  if (!spec) return
  if (wm.get(id)) {
    wm.focus(id)
    return
  }
  const init = spec.init(ctx)
  const title = dict().apps[id].title
  const entry = mount(id, title, spec)
  wm.open({ ...init, id, title, workspace: wm.workspace() })
  activate(id, entry)
}

function adopt(id: string, title: string): void {
  if (mounted.has(id)) return
  const spec = specById.get(id as AppId) ?? null
  const entry = mount(id, title, spec)
  if (!spec) {
    contentOf(entry.element).append(
      Object.assign(document.createElement('p'), { className: 'app-note', textContent: id }),
    )
  }
  activate(id, entry)
}

function release(id: string): void {
  const entry = mounted.get(id)
  if (!entry) return
  entry.instance?.destroy?.()
  entry.detach?.()
  entry.element.remove()
  mounted.delete(id)
}

wm.on('open', ({ window: win }) => adopt(win.id, win.title))

wm.on('close', ({ window: win }) => {
  const entry = mounted.get(win.id)
  if (!entry) return
  entry.instance?.destroy?.()
  mounted.delete(win.id)
})

function elementOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null
}

function tearOff(id: string, x: number, y: number): void {
  if (!wm.get(id)?.groupId) return
  wm.batch(() => {
    wm.ungroup(id)
    if (wm.get(id)?.stage !== 'normal') wm.restore(id)
    const rect = desktopEl.getBoundingClientRect()
    const box = wm.get(id)?.bounds
    if (!box) return
    wm.restoreTo(id, {
      x: Math.round(x - rect.left - box.width / 2),
      y: Math.round(y - rect.top - 12),
      width: box.width,
      height: box.height,
    })
  })
}

function titlebarWindowAt(clientX: number, clientY: number, selfId: string): string | null {
  const node = document.elementsFromPoint(clientX, clientY)[0]
  if (!node?.closest('[data-wm-drag]')) return null
  const id = node.closest<HTMLElement>('[data-wm-window]')?.dataset.wmWindow
  return id && id !== selfId && wm.get(id) ? id : null
}

function slotAt(strip: HTMLElement, clientX: number, id: string): number | null {
  const tabs = [...strip.querySelectorAll<HTMLElement>('.win-tab')]
  const from = tabs.findIndex((tab) => tab.dataset.tab === id)
  if (from === -1) return null
  let slot = tabs.length - 1
  for (let i = 0; i < tabs.length; i += 1) {
    const rect = (tabs[i] as HTMLElement).getBoundingClientRect()
    if (clientX < rect.left + rect.width / 2) {
      slot = i > from ? i - 1 : i
      break
    }
  }
  return slot === from ? null : slot
}

function startTabDrag(event: PointerEvent, id: string): void {
  if (event.button !== 0) return
  event.stopPropagation()
  const tab = event.currentTarget as HTMLElement
  const strip = tab.parentElement
  const pointerId = event.pointerId
  const origin = { x: event.clientX, y: event.clientY }
  let moved = false

  function clearTargets(): void {
    for (const el of desktopEl.querySelectorAll<HTMLElement>('[data-wm-tab-target]')) {
      delete el.dataset.wmTabTarget
    }
  }

  function stop(): void {
    tab.removeEventListener('pointermove', onMove)
    tab.removeEventListener('pointerup', onUp)
    tab.removeEventListener('pointercancel', onCancel)
    if (tab.hasPointerCapture(pointerId)) tab.releasePointerCapture(pointerId)
    clearTargets()
  }

  function onMove(move: PointerEvent): void {
    if (move.pointerId !== pointerId) return
    if (!moved && Math.abs(move.clientX - origin.x) + Math.abs(move.clientY - origin.y) < 6) return
    moved = true
    clearTargets()
    const target = titlebarWindowAt(move.clientX, move.clientY, id)
    if (target && wm.get(target)?.groupId !== wm.get(id)?.groupId) {
      const host = desktopEl.querySelector<HTMLElement>(`[data-wm-window="${target}"]`)
      if (host) host.dataset.wmTabTarget = ''
    }
  }

  function onCancel(cancel: PointerEvent): void {
    if (cancel.pointerId === pointerId) stop()
  }

  function onUp(up: PointerEvent): void {
    if (up.pointerId !== pointerId) return
    stop()
    if (!moved) return
    const box = strip?.getBoundingClientRect()
    if (
      box &&
      up.clientX >= box.left &&
      up.clientX <= box.right &&
      up.clientY >= box.top &&
      up.clientY <= box.bottom
    ) {
      const slot = slotAt(strip as HTMLElement, up.clientX, id)
      if (slot !== null) wm.moveTab(id, slot)
      return
    }
    const target = titlebarWindowAt(up.clientX, up.clientY, id)
    if (target && wm.get(target)?.groupId !== wm.get(id)?.groupId) {
      wm.batch(() => {
        wm.ungroup(id)
        if (wm.group([target, id])) wm.activateTab(id)
      })
      return
    }
    tearOff(id, up.clientX, up.clientY)
  }

  tab.setPointerCapture(pointerId)
  tab.addEventListener('pointermove', onMove)
  tab.addEventListener('pointerup', onUp)
  tab.addEventListener('pointercancel', onCancel)
}

function focusTab(id: string): void {
  const active = wm.getState().groups[wm.get(id)?.groupId ?? '']?.activeId
  if (!active) return
  const host = mounted.get(active)?.element
  host?.querySelector<HTMLElement>(`.win-tab[data-tab="${id}"]`)?.focus()
}

function onTabKeydown(event: KeyboardEvent, id: string): void {
  const groupId = wm.get(id)?.groupId
  const members = groupId ? (wm.getState().groups[groupId]?.members ?? []) : []
  if (members.length < 2) return
  const index = members.indexOf(id)
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0

  if (step !== 0 && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    event.stopPropagation()
    if (wm.moveTab(id, index + step)) focusTab(id)
    return
  }
  if (step !== 0) {
    event.preventDefault()
    event.stopPropagation()
    const next = members[(index + step + members.length) % members.length] as string
    if (wm.activateTab(next)) focusTab(next)
    return
  }
  if (event.key !== 'Home' && event.key !== 'End') return
  event.preventDefault()
  event.stopPropagation()
  const target = (event.key === 'Home' ? members[0] : members[members.length - 1]) as string
  if (wm.activateTab(target)) focusTab(target)
}

function syncTabs(): void {
  const state = wm.getState()
  for (const [id, entry] of mounted) {
    const strip = entry.element.querySelector<HTMLElement>('.win-tabs')
    const titleEl = entry.element.querySelector<HTMLElement>('[data-wm-title]')
    const win = state.windows[id]
    const group = win?.groupId ? state.groups[win.groupId] : undefined
    if (!strip || !titleEl) continue
    if (!group) {
      strip.hidden = true
      strip.removeAttribute('role')
      titleEl.hidden = false
      if (strip.dataset.signature !== undefined) {
        delete strip.dataset.signature
        strip.replaceChildren()
      }
      continue
    }
    const signature = group.members
      .map((memberId) => `${memberId}:${state.windows[memberId]?.title ?? ''}`)
      .join(',')
    strip.hidden = false
    strip.setAttribute('role', 'tablist')
    titleEl.hidden = true
    if (strip.dataset.signature === signature) {
      for (const tab of strip.querySelectorAll<HTMLButtonElement>('.win-tab')) {
        const selected = tab.dataset.tab === group.activeId
        tab.setAttribute('aria-selected', String(selected))
        tab.tabIndex = selected ? 0 : -1
      }
      continue
    }
    strip.dataset.signature = signature
    strip.replaceChildren(
      ...group.members.map((memberId) => {
        const member = state.windows[memberId]
        const tab = document.createElement('button')
        tab.type = 'button'
        tab.className = 'win-tab'
        tab.dataset.tab = memberId
        tab.textContent = member?.title ?? memberId
        tab.setAttribute('role', 'tab')
        tab.setAttribute('aria-selected', String(group.activeId === memberId))
        tab.tabIndex = group.activeId === memberId ? 0 : -1
        tab.addEventListener('click', (event) => {
          event.stopPropagation()
          wm.activateTab(memberId)
        })
        tab.addEventListener('keydown', (event) => onTabKeydown(event, memberId))
        tab.addEventListener('pointerdown', (event) => startTabDrag(event, memberId))
        return tab
      }),
    )
  }
}

function reconcile(): void {
  const state = wm.getState()
  for (const id of [...mounted.keys()]) {
    if (!state.windows[id]) release(id)
  }
  for (const id of state.order) {
    const win = state.windows[id]
    if (win) adopt(id, win.title)
  }
}

function resetDesktop(): void {
  wm.batch(() => {
    wm.closeAll()
    wm.setWorkspace(0)
  })
  openDefaults()
}

function openDefaults(): void {
  const width = desktopEl.clientWidth
  openApp('readme')
  if (width >= 1440) openApp('inspector')
  if (width >= 720) openApp('terminal')
  wm.focus(width >= 720 ? 'terminal' : 'readme')
}

function renderDock(): void {
  const minimized = wm.minimized()
  dockEl.replaceChildren(
    ...minimized.map((win) => {
      const node = document.createElement('button')
      node.type = 'button'
      node.dataset.task = win.id
      const spec = specById.get(win.id as AppId)
      if (spec) {
        const icon = document.createElement('span')
        icon.className = 'ico'
        icon.textContent = dict().apps[win.id as AppId].icon
        node.append(icon)
      }
      node.append(document.createTextNode(win.title))
      node.addEventListener('click', () => wm.focus(win.id))
      return node
    }),
  )
  statWin.textContent = String(wm.getState().order.length)
}

function renderLauncher(): void {
  launcherEl.replaceChildren(
    ...apps.map((spec) => {
      const copy = dict().apps[spec.id]
      const node = document.createElement('button')
      node.type = 'button'
      node.dataset.app = spec.id
      const icon = document.createElement('span')
      icon.className = 'ico'
      icon.textContent = copy.icon
      node.append(icon, document.createTextNode(copy.title))
      node.addEventListener('click', () => openApp(spec.id))
      launcherEl.append(node)
      return node
    }),
  )
  syncLauncher()
}

function syncLauncher(): void {
  for (const node of launcherEl.querySelectorAll<HTMLButtonElement>('button[data-app]')) {
    const id = node.dataset.app as AppId
    if (wm.get(id)) node.dataset.running = ''
    else delete node.dataset.running
  }
}

function renderWorkspaces(): void {
  workspacesEl.replaceChildren(
    ...Array.from({ length: WORKSPACES }, (_, index) => {
      const node = document.createElement('button')
      node.type = 'button'
      node.role = 'tab'
      node.dataset.workspace = String(index)
      node.textContent = String(index + 1)
      node.setAttribute('aria-label', `workspace ${index + 1}`)
      node.addEventListener('click', () => wm.setWorkspace(index))
      return node
    }),
  )
  syncWorkspaces()
}

function syncWorkspaces(): void {
  const state = wm.getState()
  const populated = new Set(Object.values(state.windows).map((win) => win.workspace))
  for (const node of workspacesEl.querySelectorAll<HTMLButtonElement>('button')) {
    const index = Number(node.dataset.workspace)
    node.setAttribute('aria-selected', String(index === state.workspace))
    if (populated.has(index)) node.dataset.populated = ''
    else delete node.dataset.populated
  }
}

const menuActions: Record<string, () => void> = {
  new: () => {
    wm.open({ title: lang === 'ru' ? 'окно' : 'window', width: 300, height: 200 })
  },
  tile: () => wm.arrange('tile'),
  cascade: () => wm.arrange('cascade'),
  center: () => {
    const id = wm.getState().focusedId
    if (id) wm.center(id)
  },
  back: () => {
    const id = wm.getState().focusedId
    if (id) wm.sendToBack(id)
  },
  minimizeAll: () => wm.minimizeAll(),
  restoreAll: () => wm.restoreAll(),
  closeAll: () => wm.closeAll(),
  undo: () => {
    wm.undo()
  },
  redo: () => {
    wm.redo()
  },
  saveLayout: () => {
    wm.saveLayout(`layout ${wm.layoutNames().length + 1}`)
    openApp('layouts')
    mounted.get('layouts')?.instance?.relabel?.()
  },
  reset: () => resetDesktop(),
  shortcuts: () => openApp('shortcuts'),
  readme: () => openApp('readme'),
  github: () => window.open('https://github.com/Surdeddd/wmkit', '_blank', 'noreferrer'),
  npm: () => window.open('https://www.npmjs.com/package/@surdeddd/wmkit', '_blank', 'noreferrer'),
}

function closeMenus(): void {
  for (const pop of menusEl.querySelectorAll<HTMLElement>('.menu-pop')) delete pop.dataset.open
  for (const trigger of menusEl.querySelectorAll<HTMLButtonElement>('.menu-trigger')) {
    trigger.setAttribute('aria-expanded', 'false')
  }
}

function renderMenus(): void {
  menusEl.replaceChildren(
    ...dict().menus.map((menu) => {
      const wrap = document.createElement('div')
      wrap.className = 'menu'
      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.className = 'menu-trigger'
      trigger.textContent = menu.label
      trigger.setAttribute('aria-expanded', 'false')
      trigger.setAttribute('aria-haspopup', 'true')
      const pop = document.createElement('div')
      pop.className = 'menu-pop'
      for (const item of menu.items) {
        const node = document.createElement('button')
        node.type = 'button'
        node.dataset.action = item.id
        node.append(document.createTextNode(item.label))
        if (item.key) {
          const key = document.createElement('kbd')
          key.textContent = item.key
          node.append(key)
        }
        node.addEventListener('click', () => {
          closeMenus()
          menuActions[item.id]?.()
        })
        pop.append(node)
      }
      trigger.addEventListener('click', (event) => {
        event.stopPropagation()
        const open = pop.dataset.open !== undefined
        closeMenus()
        if (!open) {
          pop.dataset.open = ''
          trigger.setAttribute('aria-expanded', 'true')
          syncMenus()
        }
      })
      wrap.append(trigger, pop)
      return wrap
    }),
  )
}

function syncMenus(): void {
  for (const node of menusEl.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
    if (node.dataset.action === 'undo') node.disabled = !wm.canUndo()
    if (node.dataset.action === 'redo') node.disabled = !wm.canRedo()
  }
}

function renderFeatures(): void {
  const grid = must(document.querySelector<HTMLElement>('#feature-grid'), '#feature-grid')
  grid.replaceChildren(
    ...dict().features.map((feature, index) => {
      const card = document.createElement('article')
      card.className = 'feature'
      const num = document.createElement('p')
      num.className = 'num'
      num.textContent = String(index + 1).padStart(2, '0')
      const title = document.createElement('h3')
      title.textContent = feature.title
      const text = document.createElement('p')
      text.textContent = feature.text
      card.append(num, title, text)
      return card
    }),
  )
}

function renderFrameworks(): void {
  const row = must(document.querySelector<HTMLElement>('#fw-row'), '#fw-row')
  row.replaceChildren(
    ...dict().frameworks.map(([name, note]) => {
      const cell = document.createElement('div')
      const label = document.createElement('b')
      label.textContent = name
      const text = document.createElement('span')
      text.textContent = note
      cell.append(label, text)
      return cell
    }),
  )
}

function renderCompare(): void {
  const wrap = must(document.querySelector<HTMLElement>('#compare-table'), '#compare-table')
  const data = dict()
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  data.compareHead.forEach((label, index) => {
    const th = document.createElement('th')
    th.textContent = label || (data.ui['cmp.title'] ?? 'wmkit')
    th.scope = 'col'
    if (!label) th.className = 'sr-only-text'
    if (index === 1) th.classList.add('col-wmkit')
    headRow.append(th)
  })
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const row of data.compareRows) {
    const tr = document.createElement('tr')
    const head = document.createElement('th')
    head.scope = 'row'
    head.textContent = row.label
    tr.append(head)
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
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset.i18n
    if (key && data.ui[key]) node.textContent = data.ui[key]
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    const key = node.dataset.i18nAria
    if (key && data.ui[key]) node.setAttribute('aria-label', data.ui[key])
  }
  for (const node of document.querySelectorAll<HTMLButtonElement>('#lang button')) {
    node.setAttribute('aria-pressed', String(node.dataset.lang === lang))
  }
}

function relabelAll(): void {
  for (const [id, entry] of mounted) {
    const spec = entry.spec
    if (!spec) continue
    const title = dict().apps[spec.id].title
    if (wm.get(id)?.title !== title) wm.update(id, { title })
    const titleEl = entry.element.querySelector('[data-wm-title]')
    if (titleEl) titleEl.textContent = title
    const aria = lang === 'ru' ? RU_CONTROLS : EN_CONTROLS
    for (const [selector, label] of aria) {
      entry.element.querySelector(selector)?.setAttribute('aria-label', `${label} ${title}`)
    }
    if (entry.instance?.relabel) {
      entry.instance.relabel()
    } else {
      entry.instance?.destroy?.()
      entry.instance = spec.render(contentOf(entry.element), ctx) ?? null
    }
  }
}

function setLang(next: Lang): void {
  if (next === lang) return
  lang = next
  localStorage.setItem('wmkit-lang', lang)
  applyStaticI18n()
  renderMenus()
  renderLauncher()
  renderFeatures()
  renderFrameworks()
  renderCompare()
  relabelAll()
  renderDock()
}

wm.subscribe(() => {
  reconcile()
  syncTabs()
  renderDock()
  syncLauncher()
  syncWorkspaces()
  syncMenus()
})

document.addEventListener('click', closeMenus)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenus()
  const target = elementOf(event.target)
  if (target?.closest('input, textarea, [contenteditable]')) return
  if (event.key === '?') {
    event.preventDefault()
    openApp('shortcuts')
  }
})

for (const node of document.querySelectorAll<HTMLButtonElement>('#lang button')) {
  node.addEventListener('click', () => {
    const next = node.dataset.lang
    if (next === 'ru' || next === 'en') setLang(next)
  })
}

for (const node of document.querySelectorAll<HTMLButtonElement>('.copy')) {
  node.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(node.dataset.copy ?? '')
      node.dataset.copied = ''
      setTimeout(() => {
        delete node.dataset.copied
      }, 1400)
    } catch {}
  })
}

document.querySelector('#wall-launch')?.addEventListener('click', () => {
  const state = wm.getState()
  const visible = state.order.filter((id) => {
    const win = state.windows[id]
    return win && win.workspace === state.workspace && win.stage !== 'minimized'
  })
  if (visible.length === 0) openDefaults()
  else wm.arrange('tile')
})

document.querySelector('#open-code')?.addEventListener('click', () => {
  openApp('code')
  window.scrollTo({ top: 0, behavior: prefersReducedMotion(window) ? 'auto' : 'smooth' })
})

document.addEventListener('pointermove', (event) => {
  const card = elementOf(event.target)?.closest<HTMLElement>('.feature')
  if (!card) return
  const rect = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  card.style.setProperty('--my', `${event.clientY - rect.top}px`)
})

function startFpsMeter(): void {
  let frames = 0
  let mark = performance.now()
  const tick = (now: number) => {
    frames += 1
    if (now - mark >= 1000) {
      statFps.textContent = String(Math.min(120, Math.round((frames * 1000) / (now - mark))))
      frames = 0
      mark = now
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const BOOT_LINES = [
  `wmkit ${__WMKIT_VERSION__} · headless window manager`,
  'core .............. state machine ok',
  'dom ............... pointer + rAF ok',
  'a11y .............. live region ok',
  'themes ............ glass light retro',
  'ready.',
]

function boot(): void {
  if (prefersReducedMotion(window)) {
    bootEl.dataset.done = ''
    start()
    return
  }
  let index = 0
  const step = () => {
    bootLog.textContent = BOOT_LINES.slice(0, index + 1).join('\n')
    index += 1
    if (index < BOOT_LINES.length) {
      setTimeout(step, 90)
      return
    }
    setTimeout(() => {
      bootEl.dataset.done = ''
      start()
    }, 260)
  }
  step()
}

function whenSized(run: () => void): void {
  const ready = () => desktopEl.clientWidth >= 320 && desktopEl.clientHeight >= 260
  if (ready()) {
    run()
    return
  }
  let done = false
  const finish = () => {
    if (done) return
    done = true
    observer.disconnect()
    clearTimeout(timer)
    run()
  }
  const observer = new ResizeObserver(() => {
    if (ready()) finish()
  })
  observer.observe(desktopEl)
  const timer = setTimeout(finish, 1000)
}

function start(): void {
  whenSized(openDefaults)
  startFpsMeter()
}

must(document.querySelector<HTMLElement>('#brand-ver'), '#brand-ver').textContent =
  `v${__WMKIT_VERSION__}`

applyTheme()
applyStaticI18n()
renderMenus()
renderLauncher()
renderWorkspaces()
renderFeatures()
renderFrameworks()
renderCompare()
renderDock()
boot()

declare global {
  interface Window {
    __wmDemo: { wm: typeof wm; open: (id: AppId) => void }
  }
}

window.__wmDemo = { wm, open: openApp }

export type { WindowInit, WindowState }
