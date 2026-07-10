import { expect, test } from '@playwright/test'
import { boxOf, dragBy, openVanilla, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('spawns 50 windows and keeps dragging responsive', async ({ page, isMobile }) => {
  test.skip(isMobile, 'drag precision under 50 windows is a desktop scenario')
  await page.click('#btn-stress')
  await expect(page.getByTestId('window-count')).toHaveText('50')
  await expect(page.locator('[data-wm-window]')).toHaveCount(50)

  const topId = await page.evaluate(() => {
    const state = window.__wm.getState()
    return state.order[state.order.length - 1]
  })
  const topWindow = win(page, topId as string)
  const before = await boxOf(topWindow)
  await dragBy(page, topWindow.locator('[data-wm-drag]'), 100, 60, { steps: 25 })
  const after = await boxOf(topWindow)
  expect(Math.abs(after.x - before.x - 100)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.y - before.y - 60)).toBeLessThanOrEqual(2)
})

test('z-order stays consistent through rapid focus switching', async ({ page, isMobile }) => {
  test.skip(isMobile, 'stacked strips are too narrow to click reliably on a phone viewport')
  await page.click('#btn-stress')
  const ids = (await page.evaluate(() => window.__wm.getState().order.slice(0, 5))) as string[]
  for (const id of ids.reverse()) {
    await win(page, id)
      .locator('[data-wm-drag]')
      .click({ position: { x: 20, y: 12 } })
    await expect(win(page, id)).toHaveAttribute('data-wm-focused', '')
  }
  const zOrder = await page.evaluate(() => {
    const state = window.__wm.getState()
    return state.order.map((id) => {
      const el = document.querySelector(`[data-testid="window-${id}"]`) as HTMLElement
      return Number(el.style.zIndex)
    })
  })
  const sorted = [...(zOrder as number[])].sort((a, b) => a - b)
  expect(zOrder).toEqual(sorted)
})

test('closeAll clears 50 windows in one pass', async ({ page }) => {
  await page.click('#btn-stress')
  await page.click('#btn-clear')
  await expect(page.locator('[data-wm-window]')).toHaveCount(0)
  await expect(page.getByTestId('window-count')).toHaveText('0')
})
