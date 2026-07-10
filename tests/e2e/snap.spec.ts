import { expect, test } from '@playwright/test'
import { boxOf, desktopBox, dragTo, handle, openVanilla, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
  await spawn(page, 'fixed')
})

test('dragging to the left edge shows a preview and snaps to the half', async ({ page }) => {
  const desktop = await desktopBox(page)
  const window = win(page, 'fixed')

  await dragTo(page, handle(page, 'fixed'), desktop.x + 4, desktop.y + desktop.height / 2, {
    release: false,
  })
  await expect(page.locator('[data-wm-snap-preview]')).toBeVisible()
  await page.mouse.up()

  await expect(window).toHaveAttribute('data-wm-stage', 'snapped')
  const box = await boxOf(window)
  expect(Math.abs(box.x - desktop.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(box.width - desktop.width / 2)).toBeLessThanOrEqual(2)
  expect(Math.abs(box.height - desktop.height)).toBeLessThanOrEqual(2)
  await expect(page.locator('[data-wm-snap-preview]')).toBeHidden()
})

test('dragging to a corner snaps to the quarter', async ({ page }) => {
  const desktop = await desktopBox(page)
  const window = win(page, 'fixed')
  await dragTo(page, handle(page, 'fixed'), desktop.x + desktop.width - 4, desktop.y + 10)
  await expect(window).toHaveAttribute('data-wm-stage', 'snapped')
  const box = await boxOf(window)
  expect(Math.abs(box.x - (desktop.x + desktop.width / 2))).toBeLessThanOrEqual(2)
  expect(Math.abs(box.y - desktop.y)).toBeLessThanOrEqual(2)
  expect(Math.abs(box.width - desktop.width / 2)).toBeLessThanOrEqual(2)
  expect(Math.abs(box.height - desktop.height / 2)).toBeLessThanOrEqual(2)
})

test('dragging to the top edge maximizes', async ({ page }) => {
  const desktop = await desktopBox(page)
  const window = win(page, 'fixed')
  await dragTo(page, handle(page, 'fixed'), desktop.x + desktop.width / 2, desktop.y + 4)
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
})

test('dragging a snapped window off restores its size under the pointer', async ({ page }) => {
  const desktop = await desktopBox(page)
  const window = win(page, 'fixed')
  const original = await boxOf(window)

  await dragTo(page, handle(page, 'fixed'), desktop.x + 4, desktop.y + desktop.height / 2)
  await expect(window).toHaveAttribute('data-wm-stage', 'snapped')

  await dragTo(
    page,
    handle(page, 'fixed'),
    desktop.x + desktop.width / 2,
    desktop.y + desktop.height / 2,
    { steps: 20 },
  )
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
  const after = await boxOf(window)
  expect(Math.abs(after.width - original.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.height - original.height)).toBeLessThanOrEqual(2)
})

test('keyboard arrows never move a snapped window out of stage silently', async ({ page }) => {
  const desktop = await desktopBox(page)
  const window = win(page, 'fixed')
  await dragTo(page, handle(page, 'fixed'), desktop.x + 4, desktop.y + desktop.height / 2)
  await expect(window).toHaveAttribute('data-wm-stage', 'snapped')
  await window.focus()
  await page.keyboard.press('ArrowRight')
  await expect(window).toHaveAttribute('data-wm-stage', 'snapped')
})
