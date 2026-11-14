import { expect, type Page, test } from './fixtures'

const SEEDS = Number(process.env.WMKIT_MONKEY) || 2
const STEPS = Number(process.env.WMKIT_MONKEY_STEPS) || 40
const FIRST = Number(process.env.WMKIT_MONKEY_SEED) || 1

interface Stage {
  name: string
  url: string
  desktop: string
  manager: 'page' | 'element' | 'dock'
  closing: boolean
}

const STAGES: Stage[] = [
  {
    name: 'vanilla',
    url: 'test/vanilla.html',
    desktop: '#desktop',
    manager: 'page',
    closing: true,
  },
  {
    name: 'web components',
    url: 'test/elements.html',
    desktop: 'wm-desktop',
    manager: 'element',
    closing: true,
  },
  { name: 'dock', url: 'test/dock.html', desktop: '#desktop', manager: 'dock', closing: false },
]

interface Tree {
  windows?: string[]
  children?: Tree[]
}

interface Docked {
  wm: typeof window.__wm
  dock: { layout(): { root: Tree | null } }
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface Scene {
  desktop: Box
  windows: Array<{ id: string; box: Box; handle: Box | null; controls: Box[] }>
  tasks: Box[]
  sashes: Box[]
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
        controls: inner(node, buttons)
          .filter((button) => (button as HTMLElement).offsetParent !== null)
          .map(box),
      }
    })
  return {
    desktop: box(desktop),
    windows,
    tasks: [...document.querySelectorAll('#taskbar [data-task]')].map(box),
    sashes: [...desktop.querySelectorAll('[data-wm-sash]')].map(box),
  }
}

async function rest(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    await frame()
    await frame()
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => {})),
    )
    await frame()
  })
}

function inspect(stage: Stage): string[] {
  const found: string[] = []
  const desktop = document.querySelector(stage.desktop) as HTMLElement
  const held = (window as unknown as { __dock: Docked }).__dock
  const wm =
    stage.manager === 'page'
      ? window.__wm
      : stage.manager === 'dock'
        ? held.wm
        : (desktop as unknown as { manager: typeof window.__wm }).manager
  const state = wm.getState()
  const base = desktop.getBoundingClientRect()
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
  if (stage.manager === 'dock') {
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
    if (stage.manager === 'dock' && (node.dataset.wmDocked !== undefined) !== docked.has(id)) {
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
    const off = [
      rect.left - base.left - x,
      rect.top - base.top - y,
      rect.width - width,
      rect.height - height,
    ]
    if (off.some((delta) => Math.abs(delta) > 1.5)) {
      found.push(
        `${id} is drawn at ${Math.round(rect.left - base.left)},${Math.round(rect.top - base.top)} ` +
          `${Math.round(rect.width)}x${Math.round(rect.height)}, the state says ${x},${y} ${width}x${height}`,
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
  if (stage.manager === 'page') {
    const tasks = document.querySelectorAll('#taskbar [data-task]').length
    if (tasks !== wm.minimized().length) {
      found.push(`${tasks} taskbar buttons for ${wm.minimized().length} minimized windows`)
    }
  }
  return found
}

const center = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

async function open(page: Page, stage: Stage, random: () => number): Promise<string> {
  if (stage.manager === 'page') {
    const buttons = ['#btn-open', '#btn-open', '#btn-open-iframe', '#btn-open-modal']
    const kind = buttons[Math.floor(random() * buttons.length)] as string
    await page.click(kind)
    return `click ${kind}`
  }
  if (stage.manager === 'dock') return 'nothing to open'
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

async function act(page: Page, stage: Stage, random: () => number): Promise<string> {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const scene = await page.evaluate(look, stage)
  const win = scene.windows.length > 0 ? pick(scene.windows) : null
  const inside = () => ({
    x: scene.desktop.x + random() * scene.desktop.width,
    y: scene.desktop.y + random() * scene.desktop.height,
  })
  const roll = Math.floor(random() * 16)

  if (roll === 0 || scene.windows.length === 0 || (roll < 3 && scene.windows.length < 5)) {
    return open(page, stage, random)
  }
  if (!win) return 'nothing to do'
  if (roll < 6 && win.handle) {
    const from = center(win.handle)
    const to = random() < 0.2 ? { x: scene.desktop.x + 2, y: from.y } : inside()
    const cancelled = random() < 0.15
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 2 + Math.floor(random() * 8) })
    if (cancelled) await page.keyboard.press('Escape')
    await page.mouse.up()
    return `drag ${win.id} to ${Math.round(to.x)},${Math.round(to.y)}${cancelled ? ' then escape' : ''}`
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
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 2 + Math.floor(random() * 6) })
    await page.mouse.up()
    return `resize ${win.id} by its ${edge} edge ${dx},${dy}`
  }
  if (roll === 9 && win.controls.length > 0) {
    const at = center(pick(win.controls))
    await page.mouse.click(at.x, at.y)
    return `click a control of ${win.id}`
  }
  if (roll === 10 && win.handle) {
    const at = center(win.handle)
    await page.mouse.dblclick(at.x, at.y)
    return `double click the titlebar of ${win.id}`
  }
  if (roll === 11 && scene.tasks.length > 0) {
    const at = center(pick(scene.tasks))
    await page.mouse.click(at.x, at.y)
    return 'click a taskbar button'
  }
  if (roll === 12) {
    const size = pick([
      { width: 1280, height: 720 },
      { width: 900, height: 600 },
      { width: 640, height: 480 },
      { width: 1500, height: 900 },
    ])
    await page.setViewportSize(size)
    return `viewport ${size.width}x${size.height}`
  }
  if (roll === 13 && scene.sashes.length > 0) {
    const from = center(pick(scene.sashes))
    const dx = Math.round((random() - 0.5) * 300)
    const dy = Math.round((random() - 0.5) * 300)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 3 })
    await page.mouse.up()
    return `drag a separator by ${dx},${dy}`
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
  ])
  await page.keyboard.press(key)
  return `press ${key} on ${win.id}`
}

for (const stage of STAGES) {
  test.describe(`random input on the ${stage.name} page`, () => {
    for (let seed = FIRST; seed < FIRST + SEEDS; seed += 1) {
      test(`keeps the page and the state in step for seed ${seed}`, async ({ page }) => {
        test.setTimeout(60_000 + STEPS * 3_000)
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(`page error: ${error.message}`))
        page.on('console', (message) => {
          if (message.type() !== 'error') return
          const text = message.text()
          if (!text.includes('Failed to load resource')) errors.push(`console error: ${text}`)
        })
        await page.goto(stage.url)
        await expect(page.locator(stage.desktop)).toBeVisible()
        const random = rng(seed * 7919)
        const trail: string[] = []
        for (let step = 0; step < STEPS; step += 1) {
          trail.push(await act(page, stage, random))
          await page.mouse.move(3, 3)
          await rest(page)
          const found = [...(await page.evaluate(inspect, stage)), ...errors]
          expect(found, `seed ${seed}, step ${step}:\n${trail.slice(-8).join('\n')}`).toEqual([])
        }
      })
    }
  })
}
