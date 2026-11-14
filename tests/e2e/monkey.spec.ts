import { expect, type Page, test } from './fixtures'

const SEEDS = Number(process.env.WMKIT_MONKEY) || 2
const STEPS = Number(process.env.WMKIT_MONKEY_STEPS) || 40
const FIRST = Number(process.env.WMKIT_MONKEY_SEED) || 1

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
}

function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function look(): Scene {
  const box = (node: Element): Box => {
    const rect = node.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  }
  const inner = (host: HTMLElement, selector: string): Element[] => [
    ...host.querySelectorAll(selector),
    ...(host.shadowRoot?.querySelectorAll(selector) ?? []),
  ]
  const desktop = document.querySelector('#desktop') as HTMLElement
  const order = window.__wm.getState().order
  const windows = [...desktop.querySelectorAll<HTMLElement>('[data-wm-window]')]
    .filter((node) => !node.hidden)
    .sort(
      (a, b) =>
        order.indexOf(a.dataset.wmWindow as string) - order.indexOf(b.dataset.wmWindow as string),
    )
    .map((node) => {
      const handle = inner(node, '[data-wm-drag]')[0]
      return {
        id: node.dataset.wmWindow as string,
        box: box(node),
        handle: handle ? box(handle) : null,
        controls: inner(node, '[data-wm-minimize], [data-wm-maximize], [data-wm-close]').map(box),
      }
    })
  return {
    desktop: box(desktop),
    windows,
    tasks: [...document.querySelectorAll('#taskbar [data-task]')].map(box),
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

function inspect(): string[] {
  const found: string[] = []
  const wm = window.__wm
  const state = wm.getState()
  const desktop = document.querySelector('#desktop') as HTMLElement
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
  for (const [id, node] of byId) {
    const win = state.windows[id]
    if (!win) {
      found.push(`${id} is attached but gone from the state`)
      continue
    }
    const { x, y, width, height } = win.bounds
    if (![x, y, width, height].every(Number.isFinite)) found.push(`${id} has broken bounds`)
    for (const mark of ['wmDragging', 'wmResizing', 'wmPinching', 'wmTabTarget']) {
      if (node.dataset[mark] !== undefined) found.push(`${id} still carries ${mark}`)
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
  const preview = desktop.querySelector<HTMLElement>('[data-wm-snap-preview]')
  if (preview && getComputedStyle(preview).display !== 'none') {
    found.push('the snap preview is still showing')
  }
  const tasks = document.querySelectorAll('#taskbar [data-task]').length
  if (tasks !== wm.minimized().length) {
    found.push(`${tasks} taskbar buttons for ${wm.minimized().length} minimized windows`)
  }
  return found
}

const center = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })

async function act(page: Page, random: () => number, opened: { count: number }): Promise<string> {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T
  const scene = await page.evaluate(look)
  const win = scene.windows.length > 0 ? pick(scene.windows) : null
  const inside = () => ({
    x: scene.desktop.x + random() * scene.desktop.width,
    y: scene.desktop.y + random() * scene.desktop.height,
  })
  const roll = Math.floor(random() * 15)

  if (roll === 0 || scene.windows.length === 0 || (roll < 3 && scene.windows.length < 5)) {
    opened.count += 1
    const kind = pick(['#btn-open', '#btn-open', '#btn-open-iframe', '#btn-open-modal'])
    await page.click(kind)
    return `click ${kind}`
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
    return `drag ${win.id} to ${Math.round(to.x)},${Math.round(to.y)}${cancelled ? ' then cancelled' : ''}`
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

test.describe('random input in a real browser', () => {
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
      await page.goto('test/vanilla.html')
      await expect(page.locator('#desktop')).toBeVisible()
      const random = rng(seed * 7919)
      const opened = { count: 0 }
      const trail: string[] = []
      for (let step = 0; step < STEPS; step += 1) {
        trail.push(await act(page, random, opened))
        await page.mouse.move(3, 3)
        await rest(page)
        const found = [...(await page.evaluate(inspect)), ...errors]
        expect(found, `seed ${seed}, step ${step}:\n${trail.slice(-8).join('\n')}`).toEqual([])
      }
    })
  }
})
