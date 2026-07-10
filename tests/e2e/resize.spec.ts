import { expect, test } from '@playwright/test'
import { boxOf, openVanilla, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

async function freshWindow(page: import('@playwright/test').Page) {
  await page.click('#btn-clear')
  await page.evaluate(() => {
    window.__spawn({ id: 'fixed', title: 'Fixed', x: 40, y: 60, width: 240, height: 160 })
  })
  const target = win(page, 'fixed')
  await expect(target).toBeVisible()
  return target
}

const cases: Array<{
  dir: string
  dx: number
  dy: number
  expectDelta: { x: number; y: number; width: number; height: number }
}> = [
  { dir: 'e', dx: 60, dy: 0, expectDelta: { x: 0, y: 0, width: 60, height: 0 } },
  { dir: 's', dx: 0, dy: 50, expectDelta: { x: 0, y: 0, width: 0, height: 50 } },
  { dir: 'w', dx: -40, dy: 0, expectDelta: { x: -40, y: 0, width: 40, height: 0 } },
  { dir: 'n', dx: 0, dy: -30, expectDelta: { x: 0, y: -30, width: 0, height: 30 } },
  { dir: 'se', dx: 50, dy: 40, expectDelta: { x: 0, y: 0, width: 50, height: 40 } },
  { dir: 'ne', dx: 30, dy: -20, expectDelta: { x: 0, y: -20, width: 30, height: 20 } },
  { dir: 'sw', dx: -30, dy: 20, expectDelta: { x: -30, y: 0, width: 30, height: 20 } },
  { dir: 'nw', dx: -20, dy: -20, expectDelta: { x: -20, y: -20, width: 20, height: 20 } },
]

for (const { dir, dx, dy, expectDelta } of cases) {
  test(`resize handle ${dir} adjusts bounds`, async ({ page }) => {
    const window = await freshWindow(page)
    const before = await boxOf(window)
    const handleEl = window.locator(`[data-wm-resize="${dir}"]`)
    const box = await boxOf(handleEl)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
    await page.mouse.up()
    const after = await boxOf(window)
    expect(Math.abs(after.x - before.x - expectDelta.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(after.y - before.y - expectDelta.y)).toBeLessThanOrEqual(2)
    expect(Math.abs(after.width - before.width - expectDelta.width)).toBeLessThanOrEqual(2)
    expect(Math.abs(after.height - before.height - expectDelta.height)).toBeLessThanOrEqual(2)
  })
}

test('resize respects the minimum size', async ({ page }) => {
  const window = await freshWindow(page)
  const handleEl = window.locator('[data-wm-resize="se"]')
  const box = await boxOf(handleEl)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x - 500, box.y - 500, { steps: 10 })
  await page.mouse.up()
  const after = await boxOf(window)
  expect(Math.round(after.width)).toBeGreaterThanOrEqual(160)
  expect(Math.round(after.height)).toBeGreaterThanOrEqual(100)
})

test('escape cancels an in-flight resize', async ({ page }) => {
  const window = await freshWindow(page)
  const before = await boxOf(window)
  const handleEl = window.locator('[data-wm-resize="se"]')
  const box = await boxOf(handleEl)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 80, { steps: 6 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  const after = await boxOf(window)
  expect(Math.round(after.width)).toBe(Math.round(before.width))
  expect(Math.round(after.height)).toBe(Math.round(before.height))
})

test('maximized windows expose no resize handles', async ({ page }) => {
  const window = await freshWindow(page)
  await window.locator('[data-wm-drag]').dblclick()
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  await expect(window.locator('[data-wm-resize="se"]')).toBeHidden()
})
