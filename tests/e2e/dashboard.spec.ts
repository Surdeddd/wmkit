import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { boxOf, settle } from './utils'

const panel = (page: Page, id: string) => page.locator(`wm-window[window-id="${id}"]`)

async function docked(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const { dock } = (
      window as unknown as { __dashboard: { dock: { layout(): { root: unknown } } } }
    ).__dashboard
    const out: string[] = []
    const walk = (node: { kind: string; windows?: string[]; children?: unknown[] } | null) => {
      if (!node) return
      if (node.kind === 'stack') out.push(...(node.windows ?? []))
      else for (const child of node.children ?? []) walk(child as never)
    }
    walk(dock.layout().root as never)
    return out
  })
}

async function dragTitle(page: Page, id: string, x: number, y: number, shift = false) {
  const title = panel(page, id).locator('[part="titlebar"]')
  const box = await boxOf(title)
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2)
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 14 })
  await page.mouse.up()
  if (shift) await page.keyboard.up('Shift')
}

test.beforeEach(async ({ page }) => {
  await page.goto('test/dashboard/')
  await expect(panel(page, 'chart')).toHaveAttribute('data-wm-docked', '')
  for (const id of ['kpis', 'chart', 'orders', 'log']) await settle(panel(page, id))
})

test('renders the four panels docked, with live content', async ({ page }) => {
  await expect.poll(() => docked(page)).toEqual(['kpis', 'chart', 'orders', 'log'])
  await expect(page.locator('.kpi')).toHaveCount(4)
  await expect(page.locator('#chart polyline')).toHaveCount(1)
  await expect(page.locator('#order-rows tr')).toHaveCount(6)
  await expect(page.locator('[data-wm-sash]')).toHaveCount(3)
})

test('a panel floats with Shift and docks back without it, and a reload keeps the layout', async ({
  page,
}) => {
  const desk = await boxOf(page.locator('wm-desktop'))
  await dragTitle(page, 'log', desk.x + desk.width * 0.5, desk.y + desk.height * 0.5, true)
  await expect.poll(() => docked(page)).toEqual(['kpis', 'chart', 'orders'])
  await expect(panel(page, 'log')).not.toHaveAttribute('data-wm-docked', '')

  const chart = await boxOf(panel(page, 'chart'))
  await dragTitle(page, 'log', chart.x + chart.width * 0.5, chart.y + chart.height * 0.92)
  await expect.poll(() => docked(page)).toEqual(['kpis', 'chart', 'log', 'orders'])

  await page.waitForTimeout(250)
  await page.reload()
  await expect(panel(page, 'log')).toHaveAttribute('data-wm-docked', '')
  await expect.poll(() => docked(page)).toEqual(['kpis', 'chart', 'log', 'orders'])

  await page.click('#reset')
  await expect.poll(() => docked(page)).toEqual(['kpis', 'chart', 'orders', 'log'])
})

type Box = { x: number; y: number; width: number; height: number }

const IDS = ['kpis', 'chart', 'orders', 'log'] as const

async function boxes(page: Page): Promise<Record<string, Box>> {
  const out: Record<string, Box> = {}
  for (const id of IDS) out[id] = await boxOf(panel(page, id))
  return out
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 1 && h > 1 ? w * h : 0
}

function manager(page: Page) {
  return page.evaluate(() => {
    const { desktop } = (
      window as unknown as {
        __dashboard: {
          desktop: {
            manager: {
              getState(): {
                windows: Record<string, { groupId: string | null; bounds: Box; stage: string }>
                groups: Record<string, { activeId: string }>
              }
            }
          }
        }
      }
    ).__dashboard
    return desktop.manager.getState()
  })
}

function stacks(page: Page) {
  return page.evaluate(() => {
    const { dock } = (
      window as unknown as { __dashboard: { dock: { layout(): { root: unknown } } } }
    ).__dashboard
    const out: Record<string, string[]> = {}
    const walk = (node: { kind: string; id: string; windows?: string[]; children?: unknown[] }) => {
      if (node.kind === 'stack') out[node.id] = node.windows ?? []
      else for (const child of node.children ?? []) walk(child as never)
    }
    walk(dock.layout().root as never)
    return out
  })
}

async function expectDefaultLayout(page: Page) {
  await expect
    .poll(() => stacks(page))
    .toEqual({ top: ['kpis'], graph: ['chart'], table: ['orders'], events: ['log'] })
  const state = await manager(page)
  for (const id of IDS) expect(state.windows[id]?.groupId, id).toBeNull()
  const desk = await boxOf(page.locator('wm-desktop'))
  const all = await boxes(page)
  for (const id of IDS) {
    const box = all[id] as Box
    expect(box.x, id).toBeGreaterThanOrEqual(desk.x - 1)
    expect(box.y, id).toBeGreaterThanOrEqual(desk.y - 1)
    expect(box.x + box.width, id).toBeLessThanOrEqual(desk.x + desk.width + 1)
    expect(box.y + box.height, id).toBeLessThanOrEqual(desk.y + desk.height + 1)
    for (const other of IDS) {
      if (other !== id) expect(overlap(box, all[other] as Box), `${id} over ${other}`).toBe(0)
    }
  }
  const covered = IDS.reduce((sum, id) => sum + (all[id] as Box).width * (all[id] as Box).height, 0)
  expect(covered / (desk.width * desk.height)).toBeGreaterThan(0.95)
  const { orders, log } = all as Record<'orders' | 'log', Box>
  expect(Math.abs(log.x - orders.x)).toBeLessThanOrEqual(1)
  expect(log.y).toBeGreaterThanOrEqual(orders.y + orders.height - 1)
  return all
}

async function dropOnCentre(page: Page, id: string, target: string) {
  const box = await boxOf(panel(page, target))
  await dragTitle(page, id, box.x + box.width / 2, box.y + box.height / 2)
}

test('the default layout gives every panel its own place', async ({ page }) => {
  await expectDefaultLayout(page)
})

test('a panel dropped on another becomes a tab, and Reset layout splits them back', async ({
  page,
}) => {
  const start = await boxes(page)
  await dropOnCentre(page, 'log', 'chart')
  await expect.poll(async () => (await stacks(page)).graph).toEqual(['chart', 'log'])
  const state = await manager(page)
  const group = state.windows.log?.groupId
  expect(group).not.toBeNull()
  expect(state.windows.chart?.groupId).toBe(group)
  expect(state.windows.log?.bounds).toEqual(state.windows.chart?.bounds)
  await expect(panel(page, 'log')).toBeVisible()
  await expect(panel(page, 'chart')).toBeHidden()
  const tab = await boxOf(panel(page, 'log'))
  expect(Math.abs(tab.x - (start.chart as Box).x)).toBeLessThanOrEqual(1)
  expect(Math.abs(tab.width - (start.chart as Box).width)).toBeLessThanOrEqual(1)

  const strip = panel(page, 'log').locator('[part=tabs][role=tablist]')
  await expect(strip.locator('button[role=tab]')).toHaveCount(2)
  await strip.locator('button[role=tab][data-window-id=chart]').click()
  await expect(panel(page, 'chart')).toBeVisible()
  await expect(panel(page, 'log')).toBeHidden()

  const sash = page.locator('[data-wm-sash][aria-orientation="vertical"]').first()
  const bar = await boxOf(sash)
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2)
  await page.mouse.down()
  await page.mouse.move(bar.x + bar.width / 2 - 60, bar.y + bar.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(panel(page, 'chart')).toBeVisible()
  await expect(panel(page, 'log')).toBeHidden()
  expect((await manager(page)).groups[group as string]?.activeId).toBe('chart')

  await page.click('#reset')
  await expectDefaultLayout(page)
  await expect(panel(page, 'log')).toBeVisible()
  await expect(panel(page, 'chart')).toBeVisible()
})

test('a closed panel comes back in its place with Reset layout, and one undo closes it again', async ({
  page,
}) => {
  const start = await boxes(page)
  await panel(page, 'orders').locator('[data-wm-close]').click()
  await expect(panel(page, 'orders')).toHaveAttribute('closed', '')
  await expect.poll(async () => (await stacks(page)).table).toBeUndefined()

  await page.click('#reset')
  const back = await expectDefaultLayout(page)
  for (const id of IDS) {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(
        Math.abs((back[id] as Box)[key] - (start[id] as Box)[key]),
        `${id}.${key}`,
      ).toBeLessThanOrEqual(1)
    }
  }

  await panel(page, 'kpis').focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(panel(page, 'orders')).toHaveAttribute('closed', '')
  await expect(panel(page, 'orders')).toBeHidden()
})

test('the retro theme gives the focused panel its navy title bar', async ({ page }) => {
  await page.selectOption('#theme', 'retro')
  await panel(page, 'chart').locator('#chart').click()
  await expect(panel(page, 'chart')).toHaveAttribute('data-wm-focused', '')
  const image = await panel(page, 'chart')
    .locator('[part=titlebar]')
    .evaluate((bar) => getComputedStyle(bar).backgroundImage)
  expect(image).toContain('rgb(0, 0, 128)')
  expect(image).toContain('rgb(15, 111, 176)')
})

test('with Float pressed a dragged panel shows no drop preview and stays floating', async ({
  page,
}) => {
  const target = await boxOf(panel(page, 'orders'))
  const preview = page.locator('[data-wm-drop]')
  const grab = async () => {
    await settle(panel(page, 'chart'))
    const title = await boxOf(panel(page, 'chart').locator('[part="titlebar"]'))
    await page.mouse.move(title.x + title.width / 3, title.y + title.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 14 })
  }

  await grab()
  await expect(preview).toBeVisible()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(panel(page, 'chart')).toHaveAttribute('data-wm-docked', '')

  await page.click('#float')
  await expect(page.locator('#float')).toHaveAttribute('aria-pressed', 'true')
  await grab()
  await expect(panel(page, 'chart')).toHaveAttribute('data-wm-dragging', '')
  await expect(preview).toBeHidden()
  await page.mouse.up()
  await expect(panel(page, 'chart')).toHaveAttribute('data-wm-stage', 'normal')
  await expect(panel(page, 'chart')).not.toHaveAttribute('data-wm-docked', '')
  await expect.poll(async () => (await stacks(page)).graph).toBeUndefined()
})

test('panels follow a dragged separator without lagging behind it', async ({ page }) => {
  const sash = page.locator('[data-wm-sash][aria-orientation="vertical"]').first()
  const bar = await boxOf(sash)
  const x = bar.x + bar.width / 2
  const y = bar.y + bar.height / 2
  const gap = () =>
    page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const sash = document.querySelector('[data-wm-sash][aria-orientation="vertical"]')
      const chart = document.querySelector('wm-window[window-id="chart"]')
      return Math.round(
        (sash?.getBoundingClientRect().left ?? 0) - (chart?.getBoundingClientRect().right ?? 0),
      )
    })
  const live = () =>
    page.evaluate(() => {
      const docked = [...document.querySelectorAll('[data-wm-docked]')]
      return docked.length > 0 && docked.every((el) => el.hasAttribute('data-wm-live'))
    })

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 4, y)
  const rest = await gap()
  const during = await live()
  const lags: number[] = []
  for (const dx of [-120, 80, -200, 40, -60]) {
    await page.mouse.move(x + dx, y)
    lags.push(Math.abs((await gap()) - rest))
  }
  await page.mouse.up()
  expect(
    Math.max(...lags),
    `panel edge behind the separator: ${lags.join(' ')} px`,
  ).toBeLessThanOrEqual(1)
  expect(during, 'docked panels were not marked live during the drag').toBe(true)
  expect(await live()).toBe(false)
})

test.describe('on a touch screen', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || !isMobile,
    'real touch needs a touch-enabled chromium context',
  )

  test('a panel dragged with Float on stays floating', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page)
    await page.click('#float')
    const title = await boxOf(panel(page, 'chart').locator('[part="titlebar"]'))
    const desk = await boxOf(page.locator('wm-desktop'))
    const start = { x: title.x + title.width / 3, y: title.y + title.height / 2 }
    const end = { x: desk.x + desk.width / 2, y: desk.y + desk.height * 0.3 }
    const touch = (type: string, point?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', {
        type: type as 'touchStart',
        touchPoints: point ? [{ ...point, id: 1 }] : [],
      })
    await touch('touchStart', start)
    for (let step = 1; step <= 10; step += 1) {
      await touch('touchMove', {
        x: start.x + ((end.x - start.x) * step) / 10,
        y: start.y + ((end.y - start.y) * step) / 10,
      })
    }
    await touch('touchEnd')
    await expect(panel(page, 'chart')).toHaveAttribute('data-wm-stage', 'normal')
    await expect(panel(page, 'chart')).not.toHaveAttribute('data-wm-docked', '')
    await expect.poll(async () => (await stacks(page)).graph).toBeUndefined()
  })
})

test('switches to Russian and back', async ({ page }) => {
  await page.click('#lang')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.locator('#reset')).toHaveText('Сбросить раскладку')
  await expect(panel(page, 'log')).toHaveAttribute('label', 'Журнал')
  await page.click('#lang')
  await expect(page.locator('#reset')).toHaveText('Reset layout')
})
