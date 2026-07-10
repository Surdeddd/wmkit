import { expect, test } from '@playwright/test'
import { boxOf, openVanilla, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('arrow keys move the focused window', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await window.focus()
  const before = await boxOf(window)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  const after = await boxOf(window)
  expect(Math.round(after.x - before.x)).toBe(16)
  expect(Math.round(after.y - before.y)).toBe(16)
})

test('alt slows keyboard movement down to a single pixel', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await window.focus()
  const before = await boxOf(window)
  await page.keyboard.press('Alt+ArrowRight')
  const after = await boxOf(window)
  expect(Math.round(after.x - before.x)).toBe(1)
})

test('shift plus arrows resizes the focused window', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await window.focus()
  const before = await boxOf(window)
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  const after = await boxOf(window)
  expect(Math.round(after.width - before.width)).toBe(16)
  expect(Math.round(after.height - before.height)).toBe(16)
})

test('typing inside window content does not move the window', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  const before = await boxOf(window)
  const input = window.locator('input')
  await input.click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  const after = await boxOf(window)
  expect(Math.round(after.x)).toBe(Math.round(before.x))
})

test('F6 cycles focus across windows', async ({ page }) => {
  await spawn(page)
  await spawn(page)
  await spawn(page)
  const third = win(page, 't3')
  await expect(third).toHaveAttribute('data-wm-focused', '')
  await third.focus()
  await page.keyboard.press('F6')
  await expect(win(page, 't1')).toHaveAttribute('data-wm-focused', '')
  await page.keyboard.press('Shift+F6')
  await expect(win(page, 't3')).toHaveAttribute('data-wm-focused', '')
})

test('tab is trapped inside a modal window', async ({ page }) => {
  await spawn(page)
  await spawn(page, 'modal')
  const modal = win(page, 'modal2')
  await modal.locator('input').click()
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab')
    const inside = await modal.evaluate((el) => el.contains(el.ownerDocument.activeElement))
    expect(inside).toBe(true)
  }
})
