import { expect, test } from '@playwright/test'
import { boxOf, dragBy } from './utils'

test.beforeEach(async ({ page }) => {
  await page.goto('test/react.html')
  await expect(page.locator('#btn-open')).toBeVisible()
})

test('react adapter renders windows driven by manager state', async ({ page }) => {
  await page.click('#btn-open')
  await page.click('#btn-open')
  await expect(page.getByTestId('window-count')).toHaveText('2')
  const first = page.getByTestId('window-r1')
  const second = page.getByTestId('window-r2')
  await expect(second).toHaveAttribute('data-wm-focused', '')
  await first.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(first).toHaveAttribute('data-wm-focused', '')
})

test('react windows drag and reflect position through state', async ({ page }) => {
  await page.click('#btn-open')
  const window = page.getByTestId('window-r1')
  const before = await boxOf(window)
  await dragBy(page, window.locator('[data-wm-drag]'), 90, 70)
  const after = await boxOf(window)
  expect(Math.abs(after.x - before.x - 90)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.y - before.y - 70)).toBeLessThanOrEqual(2)
  await expect(page.getByTestId('pos-r1')).not.toHaveText('32,32')
})

test('react windows minimize into the taskbar and close cleanly', async ({ page }) => {
  await page.click('#btn-open')
  const window = page.getByTestId('window-r1')
  await window.locator('[data-wm-minimize]').click()
  await expect(window).toBeHidden()
  await page.locator('[data-task="r1"]').click()
  await expect(window).toBeVisible()
  await window.locator('[data-wm-close]').click()
  await expect(window).toHaveCount(0)
  await expect(page.getByTestId('window-count')).toHaveText('0')
})
