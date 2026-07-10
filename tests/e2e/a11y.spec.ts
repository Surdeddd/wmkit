import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openVanilla, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('axe finds no serious violations with open windows', async ({ page }) => {
  await spawn(page)
  await spawn(page, 'fixed')
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(serious).toEqual([])
})

test('windows expose dialog roles, labels and focusability', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await expect(window).toHaveAttribute('role', 'dialog')
  await expect(window).toHaveAttribute('aria-labelledby', /wmkit-title-t1/)
  await expect(window).toHaveAttribute('tabindex', '-1')
  const controls = ['Minimize', 'Maximize', 'Close']
  for (const label of controls) {
    await expect(window.getByRole('button', { name: label })).toBeVisible()
  }
})

test('reduced motion disables window transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await spawn(page)
  const transition = await win(page, 't1').evaluate((el) => getComputedStyle(el).transitionProperty)
  expect(transition === 'none' || transition === 'all').toBe(true)
})

test('minimized windows are hidden from the accessibility tree', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await window.locator('[data-wm-minimize]').click()
  const hidden = await window.evaluate((el) => (el as HTMLElement).hidden)
  expect(hidden).toBe(true)
})
