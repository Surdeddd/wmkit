import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import type { Switcher } from '@surdeddd/wmkit/switcher'
import { expect, test } from './fixtures'
import { boxOf, openVanilla, spawn, win } from './utils'

const panel = (page: Page) => page.locator('[data-wm-switcher]')
const choices = (page: Page) => panel(page).locator('[role=option]')
const focused = (page: Page) => page.evaluate(() => window.__wm.getState().focusedId)
const grave = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .include('[data-wm-switcher]')
    .disableRules(['color-contrast'])
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => violation.id)
}

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
  await spawn(page)
  await spawn(page)
  await spawn(page)
  await page.evaluate(() => {
    const switcher = window.__wmkit.createSwitcher(window.__desktop, { animation: false })
    Object.assign(window, { __switcher: switcher })
  })
})

const overview = (page: Page) =>
  page.evaluate(() => (window as unknown as { __switcher: Switcher }).__switcher.overview())

test('holding Alt and pressing the backquote walks the windows, letting go switches', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'a phone has no keyboard')
  await win(page, 't3')
    .locator('[data-wm-drag]')
    .click({ position: { x: 30, y: 8 } })
  await page.keyboard.down('Alt')
  await page.keyboard.press('Backquote')
  await expect(panel(page)).toBeVisible()
  await expect(choices(page)).toHaveText(['Test 3', 'Test 2', 'Test 1'])
  await expect(choices(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  expect(await grave(page)).toEqual([])
  await page.keyboard.press('Backquote')
  await expect(choices(page).nth(2)).toHaveAttribute('aria-selected', 'true')
  expect(await focused(page)).toBe('t3')
  await page.keyboard.up('Alt')
  await expect(panel(page)).toBeHidden()
  expect(await focused(page)).toBe('t1')
  await expect(win(page, 't1')).toBeFocused()
})

test('Escape leaves the window that had the focus where it was', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'a phone has no keyboard')
  await win(page, 't3')
    .locator('[data-wm-drag]')
    .click({ position: { x: 30, y: 8 } })
  await page.keyboard.down('Alt')
  await page.keyboard.press('Backquote')
  await page.keyboard.press('Escape')
  await page.keyboard.up('Alt')
  await expect(panel(page)).toBeHidden()
  expect(await focused(page)).toBe('t3')
})

test('the overview shows every window apart from the others and a click goes to one', async ({
  page,
}) => {
  const ids = ['t1', 't2', 't3']
  const before = await Promise.all(ids.map((id) => boxOf(win(page, id))))
  const state = await page.evaluate(() => JSON.stringify(window.__wm.serialize()))
  expect(await overview(page)).toBe(true)
  await expect(choices(page)).toHaveCount(3)
  expect(await grave(page)).toEqual([])
  expect(await page.evaluate(() => JSON.stringify(window.__wm.serialize()))).toBe(state)

  const during = await Promise.all(ids.map((id) => win(page, id).boundingBox()))
  for (const [index, box] of during.entries()) {
    for (const other of during.slice(index + 1)) {
      const apart =
        !box ||
        !other ||
        box.x + box.width <= other.x + 1 ||
        other.x + other.width <= box.x + 1 ||
        box.y + box.height <= other.y + 1 ||
        other.y + other.height <= box.y + 1
      expect(apart, 'two windows of the overview overlap').toBe(true)
    }
  }
  const second = during[1] as { x: number; y: number; width: number; height: number }
  const cell = await choices(page).nth(1).boundingBox()
  expect(Math.abs((cell?.x ?? 0) - second.x)).toBeLessThanOrEqual(1)
  expect(Math.abs((cell?.width ?? 0) - second.width)).toBeLessThanOrEqual(1)

  await choices(page).nth(1).click()
  await expect(panel(page)).toBeHidden()
  expect(await focused(page)).toBe('t2')
  const after = await Promise.all(ids.map((id) => boxOf(win(page, id))))
  expect(after).toEqual(before)
  expect(await page.evaluate(() => JSON.stringify(window.__wm.serialize()))).not.toBe(state)
})

test('the overview is walked with the arrows and left with Escape', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'a phone has no keyboard')
  await overview(page)
  await expect(choices(page).nth(2)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowUp')
  await expect(choices(page).nth(0)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(panel(page)).toBeHidden()
  expect(await focused(page)).toBe('t2')

  await overview(page)
  await page.keyboard.press('Escape')
  await expect(panel(page)).toBeHidden()
  expect(await focused(page)).toBe('t2')
  expect(await win(page, 't1').evaluate((el) => (el as HTMLElement).style.scale)).toBe('')
})
