import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { boxOf } from './utils'

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

test('switches to Russian and back', async ({ page }) => {
  await page.click('#lang')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.locator('#reset')).toHaveText('Сбросить раскладку')
  await expect(panel(page, 'log')).toHaveAttribute('label', 'Журнал')
  await page.click('#lang')
  await expect(page.locator('#reset')).toHaveText('Reset layout')
})
