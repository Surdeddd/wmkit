import type { CDPSession } from '@playwright/test'
import { expect, type Page, test } from './fixtures'

const SEEDS = Number(process.env.WMKIT_MONKEY) || 2
const STEPS = Number(process.env.WMKIT_MONKEY_STEPS) || 40
const FIRST = Number(process.env.WMKIT_MONKEY_SEED) || 1

type Dress = '' | 'right to left' | 'scaled down' | 'scrolled page'

interface Stage {
  name: string
  url: string
  desktop: string
  manager: 'page' | 'element' | 'dock' | 'demo'
  dock: '' | '__dock' | '__dashboard'
  opener: string
  ready: string
  closing: boolean
  gestures: boolean
  reloads: boolean
  tasks: boolean | 'all'
  dress: Dress
}

const PLAIN = {
  dock: '',
  opener: '',
  ready: '',
  closing: true,
  gestures: false,
  reloads: false,
  tasks: false,
  dress: '',
} as const

const STAGES: Stage[] = [
  {
    ...PLAIN,
    name: 'vanilla',
    url: 'test/vanilla.html',
    desktop: '#desktop',
    manager: 'page',
    opener: '#btn-open, #btn-open-iframe, #btn-open-modal',
    reloads: true,
    tasks: true,
  },
  {
    ...PLAIN,
    name: 'web components',
    url: 'test/elements.html?persist=monkey',
    desktop: 'wm-desktop',
    manager: 'element',
    reloads: true,
    tasks: true,
  },
  {
    ...PLAIN,
    name: 'dock',
    url: 'test/dock.html',
    desktop: '#desktop',
    manager: 'dock',
    dock: '__dock',
    closing: false,
    reloads: true,
  },
  ...['react', 'preact', 'lit', 'vue', 'solid', 'svelte', 'angular'].map(
    (name): Stage => ({
      ...PLAIN,
      name,
      url: `test/${name}.html`,
      desktop: '[data-wm-desktop]',
      manager: 'page',
      opener: '#btn-open',
      tasks: true,
    }),
  ),
  {
    ...PLAIN,
    name: 'dashboard',
    url: 'test/dashboard/',
    desktop: 'wm-desktop',
    manager: 'element',
    dock: '__dashboard',
    opener: '#reset, #float',
    reloads: true,
  },
  {
    ...PLAIN,
    name: 'demo',
    url: '?lang=en',
    desktop: '#desktop',
    manager: 'demo',
    opener: 'button[data-app]',
    ready: '#boot[data-done]',
    gestures: true,
    tasks: 'all',
  },
]

const ROUNDS = ['vanilla', 'web components', 'dock', 'dashboard']

const SIZES = [
  { width: 1280, height: 720 },
  { width: 900, height: 600 },
  { width: 640, height: 480 },
  { width: 1500, height: 900 },
]

const TWISTS = ['escape', 'viewport', 'blur', 'leave', 'other button', 'tab away'] as const

interface Tree {
  windows?: string[]
  children?: Tree[]
}

interface Docked {
  wm: typeof window.__wm
  dock: { layout(): { root: Tree | null } }
}

type Held = Record<string, Docked | undefined>

interface Point {
  x: number
  y: number
}

interface Box extends Point {
  width: number
  height: number
}

interface Scene {
  desktop: Box
  windows: Array<{ id: string; box: Box; handle: Box | null; controls: Box[] }>
  tasks: Box[]
  sashes: Box[]
  openers: Array<Box & { name: string }>
}

function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function look(stage: Stage): Scene {
  const box = (node: Element): Box => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }
  const seen = (node: Element): boolean => (node as HTMLElement).offsetParent !== null
  const inner = (host: HTMLElement, selector: string): Element[] => [
    ...host.querySelectorAll(selector),
    ...(host.shadowRoot?.querySelectorAll(selector) ?? []),
  ]
  const desktop = document.querySelector(stage.desktop) as HTMLElement
  const nodes = [...desktop.querySelectorAll<HTMLElement>('[data-wm-window]')]
  const buttons = stage.closing
    ? '[data-wm-minimize], [data-wm-maximize], [data-wm-close]'
    : '[data-wm-minimize], [data-wm-maximize]'
  const windows = nodes
    .filter((node) => !node.hidden)
    .sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex))
    .map((node) => {
      const handle = inner(node, '[data-wm-drag]')[0]
      return {
        id: node.dataset.wmWindow as string,
        box: box(node),
        handle: handle ? box(handle) : null,
        controls: inner(node, buttons).filter(seen).map(box),
      }
    })
  const openers = stage.opener ? [...document.querySelectorAll<HTMLElement>(stage.opener)] : []
  return {
    desktop: box(desktop),
    windows,
    tasks: [...document.querySelectorAll('[data-task], [data-wm-task]')].filter(seen).map(box),
    sashes: [...desktop.querySelectorAll('[data-wm-sash]')].map(box),
    openers: openers
      .filter(seen)
      .map((node) => ({ ...box(node), name: node.id || node.dataset.app || 'opener' })),
  }
}

async function rest(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    const running = () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState !== 'finished' &&
            animation.playState !== 'idle' &&
            animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
        )
    await frame()
    await frame()
    const deadline = performance.now() + 3000
    for (let live = running(); live.length > 0 && performance.now() < deadline; live = running()) {
      await Promise.race([
        Promise.all(live.map((animation) => animation.finished.catch(() => {}))),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ])
      await frame()
    }
    await frame()
  })
}

function inspect(stage: Stage): string[] {
  const found: string[] = []
  const desktop = document.querySelector(stage.desktop) as HTMLElement
  const held = (window as unknown as Held)[stage.dock]
  const wm =
    stage.manager === 'page'
      ? window.__wm
      : stage.manager === 'dock'
        ? (held as Docked).wm
        : stage.manager === 'demo'
          ? window.__wmDemo.wm
          : (desktop as unknown as { manager: typeof window.__wm }).manager
  const state = wm.getState()
  const base = desktop.getBoundingClientRect()
  const scaleX = desktop.offsetWidth ? base.width / desktop.offsetWidth : 1
  const scaleY = desktop.offsetHeight ? base.height / desktop.offsetHeight : 1
  const nodes = [...desktop.querySelectorAll<HTMLElement>('[data-wm-window]')]
  const byId = new Map<string, HTMLElement>()
  for (const node of nodes) {
    const id = node.dataset.wmWindow as string
    if (byId.has(id)) found.push(`${id} is attached to two elements`)
    byId.set(id, node)
  }
  const ids = Object.keys(state.windows)
  if ([...state.order].sort().join() !== [...ids].sort().join()) {
    found.push('the order lists other windows than the state holds')
  }
  if (state.focusedId !== null && !state.windows[state.focusedId]) {
    found.push(`focus points at ${state.focusedId}, which is gone`)
  }
  const marked = nodes.filter((node) => node.dataset.wmFocused !== undefined)
  if (marked.length > 1) found.push(`${marked.length} windows are marked focused`)
  const shown = state.focusedId !== null && byId.has(state.focusedId) ? state.focusedId : null
  if ((marked[0]?.dataset.wmWindow ?? null) !== shown) {
    found.push(`the page marks ${marked[0]?.dataset.wmWindow} focused, the state ${shown}`)
  }
  let previous = Number.NEGATIVE_INFINITY
  for (const id of state.order) {
    const node = byId.get(id)
    if (!node) continue
    const z = Number(node.style.zIndex)
    if (!(z > previous)) found.push(`${id} breaks the z ladder at ${z}`)
    previous = z
  }
  const docked = new Set<string>()
  if (held) {
    let gaps = 0
    const walk = (node: Tree | null) => {
      for (const id of node?.windows ?? []) docked.add(id)
      const children = node?.children ?? []
      gaps += Math.max(0, children.length - 1)
      for (const child of children) walk(child)
    }
    const layout = state.extensions.dock as { workspace?: number } | undefined
    if (layout?.workspace === state.workspace) walk(held.dock.layout().root)
    const sashes = desktop.querySelectorAll('[data-wm-sash]').length
    if (sashes !== gaps) found.push(`${sashes} separators are drawn, the layout has ${gaps}`)
  }
  for (const id of ids) {
    if (!byId.has(id)) found.push(`${id} is in the state with no element on the page`)
  }
  for (const [id, node] of byId) {
    const win = state.windows[id]
    if (!win) {
      found.push(`${id} is attached but gone from the state`)
      continue
    }
    const { x, y, width, height } = win.bounds
    if (![x, y, width, height].every(Number.isFinite)) found.push(`${id} has broken bounds`)
    for (const mark of ['wmDragging', 'wmResizing', 'wmPinching', 'wmTabTarget', 'wmLive']) {
      if (node.dataset[mark] !== undefined) found.push(`${id} still carries ${mark}`)
    }
    if (held && (node.dataset.wmDocked !== undefined) !== docked.has(id)) {
      found.push(
        `${id} docked mark is ${node.dataset.wmDocked !== undefined}, the layout on screen holds [${[...docked]}]`,
      )
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
    const written = node.style.transform.match(
      /^translate3d\(([-\d.e]+)px, ([-\d.e]+)px, 0(px)?\)$/,
    )
    if (
      !written ||
      Math.abs(Number(written[1]) - x) > 0.01 ||
      Math.abs(Number(written[2]) - y) > 0.01
    ) {
      found.push(`${id} is written at ${node.style.transform}, the state says ${x},${y}`)
    }
    if (hidden) continue
    const rect = node.getBoundingClientRect()
    const drawn = [
      (rect.left - base.left) / scaleX - desktop.clientLeft + desktop.scrollLeft,
      (rect.top - base.top) / scaleY - desktop.clientTop + desktop.scrollTop,
      rect.width / scaleX,
      rect.height / scaleY,
    ]
    if ([x, y, width, height].some((value, index) => Math.abs((drawn[index] ?? 0) - value) > 1.5)) {
      found.push(
        `${id} is drawn at ${drawn.map(Math.round).join(',')}, the state says ${x},${y},${width},${height}`,
      )
    }
  }
  if (stage.manager === 'element') {
    for (const node of desktop.querySelectorAll<HTMLElement>('wm-window')) {
      const id = (node as unknown as { windowId: string | null }).windowId
      if (id !== null && node.hasAttribute('closed') !== !state.windows[id]) {
        found.push(`${id} closed attribute is ${node.hasAttribute('closed')}`)
      }
    }
  }
  const preview = desktop.querySelector<HTMLElement>('[data-wm-snap-preview]')
  if (preview && getComputedStyle(preview).display !== 'none') {
    found.push('the snap preview is still showing')
  }
  if (desktop.querySelector('[data-wm-sash][data-wm-active]')) {
    found.push('a separator is still marked active')
  }
  if (stage.tasks) {
    const tasks = document.querySelectorAll('[data-task], [data-wm-task]').length
    const state = wm.getState()
    const listed = new Set(
      Object.values(state.windows)
        .filter((win) => win.workspace === state.workspace)
        .map((win) => (win.groupId === null ? `w${win.id}` : `g${win.groupId}`)),
    ).size
    const expected = stage.tasks === 'all' ? listed : wm.minimized().length
    if (tasks !== expected) {
      found.push(`${tasks} taskbar buttons where ${expected} are due`)
    }
  }
  const overflow = getComputedStyle(desktop)
  if (
    (overflow.overflowX === 'hidden' && desktop.scrollLeft !== 0) ||
    (overflow.overflowY === 'hidden' && desktop.scrollTop !== 0)
  ) {
    found.push(`the desktop is scrolled to ${desktop.scrollLeft},${desktop.scrollTop}`)
  }
  const dressed =
    stage.dress === 'scaled down'
      ? Math.abs(scaleX - 0.8) < 0.01
      : stage.dress === 'right to left'
        ? getComputedStyle(desktop).direction === 'rtl'
        : stage.dress !== 'scrolled page' || document.body.style.marginTop === '300px'
  if (!dressed) found.push(`the page is no longer ${stage.dress}`)
  const zoom = window.visualViewport?.scale ?? 1
  if (Math.abs(zoom - 1) > 0.01) found.push(`the page is zoomed to ${zoom}`)
  return found
}

const center = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

function lands([selector, id, points]: readonly [string, string | null, Point[]]): boolean {
  const desktop = document.querySelector(selector) as HTMLElement
  const target =
    id === null
      ? desktop
      : [...desktop.querySelectorAll<HTMLElement>('[data-wm-window]')].find(
          (node) => node.dataset.wmWindow === id,
        )
  return (
    target !== undefined &&
    points.every(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      return hit !== null && target.contains(hit)
    })
  )
}

function ownGround({ x, y }: Point): boolean {
  const hit = document.elementFromPoint(x, y)
  return hit !== null && !hit.matches('iframe, object, embed')
}

const fingers = (cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd', at: Point[]) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: at.map((point, index) => ({
      x: Math.round(point.x),
      y: Math.round(point.y),
      id: index + 1,
    })),
  })

interface Hand {
  cdp: CDPSession | null
  taps: boolean
  wheel: boolean
}

async function stroke(
  page: Page,
  hand: Hand,
  random: () => number,
  from: Point,
  to: Point,
): Promise<string> {
  const touch = hand.cdp
  const finger = touch !== null && random() < 0.5
  const steps = 2 + Math.floor(random() * 8)
  const twist = random() < 0.3 ? TWISTS[Math.floor(random() * TWISTS.length)] : null
  const half = Math.ceil(steps / 2)
  const at = (step: number): Point => ({
    x: from.x + ((to.x - from.x) * step) / steps,
    y: from.y + ((to.y - from.y) * step) / steps,
  })
  const travel = async (first: number, last: number) => {
    for (let step = first; step <= last; step += 1) {
      if (finger) await fingers(touch, 'touchMove', [at(step)])
      else await page.mouse.move(at(step).x, at(step).y)
    }
  }
  if (finger) {
    await fingers(touch, 'touchStart', [from])
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
  }
  await travel(1, half)
  if (twist === 'escape') await page.keyboard.press('Escape')
  if (twist === 'tab away') await page.keyboard.press('Tab')
  if (twist === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  if (twist === 'viewport') {
    await page.setViewportSize(SIZES[Math.floor(random() * SIZES.length)] as (typeof SIZES)[0])
  }
  if (twist === 'leave' && !finger) await page.mouse.move(-20, at(half).y)
  if (twist === 'other button' && !finger && (await page.evaluate(ownGround, at(half)))) {
    await page.mouse.down({ button: 'right' })
    await page.mouse.up({ button: 'right' })
  }
  await travel(half + 1, steps)
  if (finger) await fingers(touch, 'touchEnd', [])
  else await page.mouse.up()
  return `${finger ? 'a finger' : 'the mouse'}${twist ? `, ${twist} midway` : ''}`
}

async function poke(
  page: Page,
  hand: Hand,
  random: () => number,
  at: Point,
  twice = false,
): Promise<string> {
  if (hand.taps && random() < 0.5) {
    await page.touchscreen.tap(at.x, at.y)
    if (twice) await page.touchscreen.tap(at.x, at.y)
    return 'a finger'
  }
  if (twice) await page.mouse.dblclick(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
  return 'the mouse'
}

async function arrive(page: Page, stage: Stage): Promise<void> {
  await expect(page.locator(stage.desktop)).toBeVisible()
  if (stage.ready) await page.locator(stage.ready).waitFor({ state: 'attached' })
  if (stage.manager === 'element' && !stage.opener) {
    await page.evaluate((selector) => {
      const desktop = document.querySelector(selector) as HTMLElement & {
        manager: typeof window.__wm
      }
      for (const id of Object.keys(desktop.manager.getState().windows)) {
        if (desktop.querySelector(`wm-window[window-id="${id}"]`)) continue
        const node = document.createElement('wm-window')
        node.setAttribute('window-id', id)
        node.setAttribute('label', id)
        desktop.append(node)
      }
    }, stage.desktop)
  }
  await page.evaluate(
    ([selector, dress]) => {
      const desktop = document.querySelector(selector as string) as HTMLElement
      if (dress === 'right to left') document.documentElement.dir = 'rtl'
      if (dress === 'scaled down') {
        desktop.style.transformOrigin = '0 0'
        desktop.style.transform = 'scale(0.8)'
      }
      if (dress === 'scrolled page') {
        document.body.style.marginTop = '300px'
        window.scrollTo(0, 180)
      }
    },
    [stage.desktop, stage.dress] as const,
  )
  await rest(page)
}

async function open(
  page: Page,
  stage: Stage,
  scene: Scene,
  hand: Hand,
  random: () => number,
): Promise<string> {
  if (stage.manager === 'element' && !stage.opener) {
    const made = Math.floor(random() * 1_000_000)
    return page.evaluate(
      ([desktop, id, x, y]) => {
        const closed = document.querySelector(`${desktop} wm-window[closed]`)
        if (closed) {
          closed.removeAttribute('closed')
          return `reopen ${closed.getAttribute('window-id')}`
        }
        const node = document.createElement('wm-window')
        node.setAttribute('window-id', `m${id}`)
        node.setAttribute('label', `M ${id}`)
        node.setAttribute('x', String(x))
        node.setAttribute('y', String(y))
        node.setAttribute('width', '240')
        node.setAttribute('height', '170')
        document.querySelector(desktop as string)?.append(node)
        return `add wm-window m${id}`
      },
      [
        stage.desktop,
        made,
        20 + Math.floor(random() * 300),
        20 + Math.floor(random() * 200),
      ] as const,
    )
  }
  if (scene.openers.length === 0) return 'nothing to open'
  const opener = scene.openers[Math.floor(random() * scene.openers.length)] as Scene['openers'][0]
  return `open ${opener.name} with ${await poke(page, hand, random, center(opener))}`
}

async function act(page: Page, stage: Stage, hand: Hand, random: () => number): Promise<string> {
  const touch = hand.cdp
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const scene = await page.evaluate(look, stage)
  const win = scene.windows.length > 0 ? pick(scene.windows) : null
  const inside = (): Point => ({
    x: scene.desktop.x + random() * scene.desktop.width,
    y: scene.desktop.y + random() * scene.desktop.height,
  })
  const roll = Math.floor(random() * 19)

  if (roll === 0 || scene.windows.length === 0 || (roll < 3 && scene.windows.length < 5)) {
    return open(page, stage, scene, hand, random)
  }
  if (!win) return 'nothing to do'
  if (roll < 6 && win.handle) {
    const from = center(win.handle)
    const to = random() < 0.2 ? { x: scene.desktop.x + 2, y: from.y } : inside()
    const how = await stroke(page, hand, random, from, to)
    return `drag ${win.id} to ${Math.round(to.x)},${Math.round(to.y)} with ${how}`
  }
  if (roll < 9) {
    const edge = pick(['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'])
    const from = {
      x: edge.includes('w')
        ? win.box.x + 1
        : edge.includes('e')
          ? win.box.x + win.box.width - 1
          : win.box.x + win.box.width / 2,
      y: edge.includes('n')
        ? win.box.y + 1
        : edge.includes('s')
          ? win.box.y + win.box.height - 1
          : win.box.y + win.box.height / 2,
    }
    const dx = Math.round((random() - 0.5) * 400)
    const dy = Math.round((random() - 0.5) * 300)
    const how = await stroke(page, hand, random, from, { x: from.x + dx, y: from.y + dy })
    return `resize ${win.id} by its ${edge} edge ${dx},${dy} with ${how}`
  }
  if (roll === 9 && win.controls.length > 0) {
    return `press a control of ${win.id} with ${await poke(page, hand, random, center(pick(win.controls)))}`
  }
  if (roll === 10 && win.handle) {
    return `double press the titlebar of ${win.id} with ${await poke(page, hand, random, center(win.handle), true)}`
  }
  if (roll === 11 && scene.tasks.length > 0) {
    return `press a taskbar button with ${await poke(page, hand, random, center(pick(scene.tasks)))}`
  }
  if (roll === 12) {
    const size = pick(SIZES)
    await page.setViewportSize(size)
    return `viewport ${size.width}x${size.height}`
  }
  if (roll === 13 && scene.sashes.length > 0) {
    const from = center(pick(scene.sashes))
    const dx = Math.round((random() - 0.5) * 300)
    const dy = Math.round((random() - 0.5) * 300)
    const how = await stroke(page, hand, random, from, { x: from.x + dx, y: from.y + dy })
    return `drag a separator by ${dx},${dy} with ${how}`
  }
  if (roll === 14 && touch !== null && stage.gestures) {
    const middle = center(win.box)
    const [start, end] = random() < 0.5 ? [30, 110] : [110, 30]
    const pair = (spread: number): Point[] => [
      { x: middle.x - spread, y: middle.y },
      { x: middle.x + spread, y: middle.y },
    ]
    if (!(await page.evaluate(lands, [stage.desktop, win.id, pair(start)] as const))) {
      return `no room to pinch ${win.id}`
    }
    await fingers(touch, 'touchStart', pair(start))
    for (let step = 1; step <= 5; step += 1) {
      await fingers(touch, 'touchMove', pair(start + ((end - start) * step) / 5))
    }
    await fingers(touch, 'touchEnd', [])
    return `pinch ${win.id} from ${start} to ${end}`
  }
  if (roll === 15 && touch !== null && stage.gestures) {
    const middle = center(scene.desktop)
    const reach = random() < 0.5 ? 220 : -220
    const pair = (shift: number): Point[] => [
      { x: middle.x + shift, y: middle.y - 25 },
      { x: middle.x + shift, y: middle.y + 25 },
    ]
    if (!(await page.evaluate(lands, [stage.desktop, null, pair(0)] as const))) {
      return 'no room to swipe'
    }
    await fingers(touch, 'touchStart', pair(0))
    for (let step = 1; step <= 5; step += 1) {
      await fingers(touch, 'touchMove', pair((reach * step) / 5))
    }
    await fingers(touch, 'touchEnd', [])
    return `swipe two fingers by ${reach}`
  }
  if (roll === 17 && stage.reloads) {
    await page.reload()
    await arrive(page, stage)
    return 'reload the page'
  }
  if (roll === 16 && hand.wheel) {
    const at = center(win.box)
    const dy = pick([-300, 120, 300])
    await page.mouse.move(at.x, at.y)
    await page.mouse.wheel(0, dy)
    return `wheel ${dy} over ${win.id}`
  }
  if (win.handle) {
    const at = center(win.handle)
    await page.mouse.click(at.x, at.y)
  }
  const key = pick([
    'Alt+ArrowRight',
    'Alt+ArrowLeft',
    'Alt+ArrowDown',
    'Alt+ArrowUp',
    'Shift+Alt+ArrowRight',
    'Shift+Alt+ArrowDown',
    'Control+Alt+ArrowLeft',
    'Control+Alt+ArrowRight',
    'Control+Alt+ArrowUp',
    'Control+Alt+ArrowDown',
    'F6',
    'Escape',
    'Control+z',
    'Control+Shift+z',
    'Tab',
    'Shift+Tab',
    'Enter',
    'Space',
  ])
  await page.keyboard.press(key)
  return `press ${key} on ${win.id}`
}

interface Setting {
  name: string
  dress: Dress
  media?: { reducedMotion?: 'reduce'; forcedColors?: 'active'; colorScheme?: 'light' }
  ratio?: number
}

const SETTINGS: Setting[] = [
  { name: 'right to left', dress: 'right to left' },
  { name: 'scaled down', dress: 'scaled down' },
  { name: 'scrolled page', dress: 'scrolled page' },
  { name: 'reduced motion', dress: '', media: { reducedMotion: 'reduce' } },
  { name: 'forced colors', dress: '', media: { forcedColors: 'active' } },
  { name: 'light scheme', dress: '', media: { colorScheme: 'light' } },
  { name: 'pixel ratio 1.5', dress: '', ratio: 1.5 },
  { name: 'pixel ratio 3', dress: '', ratio: 3 },
]

function run(stage: Stage, seed: number, setting: Setting | null): void {
  const title = setting
    ? `keeps the page and the state in step for seed ${seed}, ${setting.name}`
    : `keeps the page and the state in step for seed ${seed}`
  test(title, async ({ page, context, isMobile, hasTouch, browserName }) => {
    test.skip(
      setting?.media?.forcedColors !== undefined && browserName === 'webkit',
      'WebKit cannot emulate forced colors',
    )
    test.setTimeout(60_000 + STEPS * 4_000)
    const hand: Hand = {
      cdp: isMobile && browserName === 'chromium' ? await context.newCDPSession(page) : null,
      taps: hasTouch === true,
      wheel: !(isMobile && browserName === 'webkit'),
    }
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(`page error: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (!text.includes('Failed to load resource')) errors.push(`console error: ${text}`)
    })
    if (setting?.media) await page.emulateMedia(setting.media)
    await page.goto(stage.url)
    await arrive(page, stage)
    const random = rng(seed * 7919)
    const trail: string[] = []
    for (let step = 0; step < STEPS; step += 1) {
      trail.push(await act(page, stage, hand, random))
      await page.mouse.move(3, 3)
      await rest(page)
      const found = [...(await page.evaluate(inspect, stage)), ...errors]
      expect(
        found,
        `seed ${seed}, step ${step} (replay: WMKIT_MONKEY_SEED=${seed} WMKIT_MONKEY=1 WMKIT_MONKEY_STEPS=${STEPS}):\n${trail.slice(-8).join('\n')}`,
      ).toEqual([])
    }
  })
}

for (const stage of STAGES) {
  test.describe(`random input on the ${stage.name} page`, () => {
    for (let seed = FIRST; seed < FIRST + SEEDS; seed += 1) run(stage, seed, null)
  })
}

for (const setting of SETTINGS) {
  test.describe(`random input, ${setting.name}`, () => {
    if (setting.ratio) test.use({ deviceScaleFactor: setting.ratio })
    for (const stage of STAGES.filter(({ name }) => ROUNDS.includes(name))) {
      test.describe(`on the ${stage.name} page`, () => {
        run({ ...stage, dress: setting.dress }, FIRST, setting)
      })
    }
  })
}
