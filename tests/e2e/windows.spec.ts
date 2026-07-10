import { expect, test } from '@playwright/test'
import { boxOf, openVanilla, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('opens a window with dialog semantics and focus', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await expect(window).toBeVisible()
  await expect(window).toHaveAttribute('role', 'dialog')
  await expect(window).toHaveAttribute('data-wm-focused', '')
  await expect(window).toHaveAttribute('aria-label', 'Test 1')
  await expect(window.locator('[data-wm-title]')).toHaveText('Test 1')
  await expect(page.getByTestId('window-count')).toHaveText('1')
})

test('clicking a background window raises and focuses it', async ({ page }) => {
  await spawn(page)
  await spawn(page)
  const first = win(page, 't1')
  const second = win(page, 't2')
  await expect(second).toHaveAttribute('data-wm-focused', '')

  await first.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(first).toHaveAttribute('data-wm-focused', '')
  await expect(second).not.toHaveAttribute('data-wm-focused', '')

  const firstZ = Number(await first.evaluate((el) => el.style.zIndex))
  const secondZ = Number(await second.evaluate((el) => el.style.zIndex))
  expect(firstZ).toBeGreaterThan(secondZ)
})

test('close button removes the window and hands focus back', async ({ page }) => {
  await spawn(page)
  await spawn(page)
  await win(page, 't2').locator('[data-wm-close]').click()
  await expect(win(page, 't2')).toHaveCount(0)
  await expect(win(page, 't1')).toHaveAttribute('data-wm-focused', '')
  await expect(page.getByTestId('window-count')).toHaveText('1')
})

test('minimize hides the window into the taskbar and restores from it', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await window.locator('[data-wm-minimize]').click()
  await expect(window).toBeHidden()
  const task = page.locator('#taskbar [data-task="t1"]')
  await expect(task).toHaveText('Test 1')
  await task.click()
  await expect(window).toBeVisible()
  await expect(window).toHaveAttribute('data-wm-focused', '')
  await expect(page.locator('#taskbar [data-task]')).toHaveCount(0)
})

test('maximize fills the desktop and restore returns the old bounds', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const before = await boxOf(window)
  await window.locator('[data-wm-maximize]').click()
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  const desktop = await boxOf(page.locator('#desktop'))
  const maxed = await boxOf(window)
  expect(Math.abs(maxed.width - desktop.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(maxed.height - desktop.height)).toBeLessThanOrEqual(2)
  await window.locator('[data-wm-maximize]').click()
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
  const restored = await boxOf(window)
  expect(Math.round(restored.x)).toBe(Math.round(before.x))
  expect(Math.round(restored.width)).toBe(Math.round(before.width))
})

test('double click on the titlebar toggles maximize', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await window.locator('[data-wm-drag]').dblclick()
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  await window.locator('[data-wm-drag]').dblclick()
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
})

test('modal blocks focus on background windows and flashes', async ({ page }) => {
  await spawn(page)
  await spawn(page, 'modal')
  const doc = win(page, 't1')
  const modal = win(page, 'modal2')
  await expect(modal).toHaveAttribute('aria-modal', 'true')

  await doc.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(modal).toHaveAttribute('data-wm-focused', '')
  await expect(doc).not.toHaveAttribute('data-wm-focused', '')
  await expect(modal).toHaveAttribute('data-wm-flash', '')

  await modal.locator('[data-wm-close]').click()
  await doc.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(doc).toHaveAttribute('data-wm-focused', '')
})

test('screen reader announcements follow window lifecycle', async ({ page }) => {
  await spawn(page)
  const announcer = page.locator('[data-wm-announcer]')
  await expect(announcer).toHaveText(/Test 1 window opened/)
  await win(page, 't1').locator('[data-wm-minimize]').click()
  await expect(announcer).toHaveText(/Test 1 minimized/)
  await page.locator('#taskbar [data-task="t1"]').click()
  await expect(announcer).toHaveText(/Test 1 restored/)
})
