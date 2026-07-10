import { expect, type Page, test } from '@playwright/test'
import { boxOf, dragBy, handle, openVanilla, spawn, win } from './utils'

async function waitPersisted(page: Page): Promise<void> {
  await page.waitForFunction(
    () => localStorage.getItem('wmkit-e2e') === JSON.stringify(window.__wm.serialize()),
  )
}

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('window layout survives a page reload', async ({ page }) => {
  await spawn(page, 'fixed')
  await dragBy(page, handle(page, 'fixed'), 140, 90)
  const moved = await boxOf(win(page, 'fixed'))

  await waitPersisted(page)
  await page.reload()
  const window = win(page, 'fixed')
  await expect(window).toBeVisible()
  const restored = await boxOf(window)
  expect(Math.abs(restored.x - moved.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(restored.y - moved.y)).toBeLessThanOrEqual(2)
})

test('minimized stage survives a reload', async ({ page }) => {
  await spawn(page, 'fixed')
  await win(page, 'fixed').locator('[data-wm-minimize]').click()
  await waitPersisted(page)
  await page.reload()
  await expect(win(page, 'fixed')).toBeHidden()
  await expect(page.locator('#taskbar [data-task="fixed"]')).toBeVisible()
})

test('clear wipes the stored layout', async ({ page }) => {
  await spawn(page, 'fixed')
  await page.click('#btn-clear')
  await page.reload()
  await expect(win(page, 'fixed')).toHaveCount(0)
  await expect(page.getByTestId('window-count')).toHaveText('0')
})
