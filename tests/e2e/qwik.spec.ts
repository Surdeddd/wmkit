import { expect, test } from './fixtures'
import { boxOf, dragBy } from './utils'

test.beforeEach(async ({ page }) => {
  await page.goto('test/qwik/')
  await expect(page.locator('section[data-wm-window="notes"]')).toBeVisible()
})

test('a Qwik desktop attaches its declared window on the client', async ({ page }) => {
  await expect(page.locator('[data-wm-desktop]')).toHaveCount(1)
  await expect(page.locator('section[data-wm-window="notes"] [data-wm-title]')).toHaveText('Notes')
  await expect(page.locator('#notes-body')).toHaveText('qwik content')
  await expect(page.locator('#count')).toHaveText('1')
})

test('the window drags, and state hooks follow the manager', async ({ page }) => {
  const window = page.locator('section[data-wm-window="notes"]')
  const before = await boxOf(window)
  await dragBy(page, window.locator('[data-wm-drag]'), 70, 40, { steps: 8 })
  const after = await boxOf(window)
  expect(Math.abs(after.x - before.x - 70)).toBeLessThanOrEqual(14)
  await page.click('#open')
  await expect(page.locator('#count')).toHaveText('2')
})

test('a closed window hides, and comes back attached when it reopens', async ({ page }) => {
  const window = page.locator('section[data-wm-window="notes"]')
  await page.click('#notes-close')
  await expect(window).toBeHidden()
  await expect(page.locator('#count')).toHaveText('0')
  await page.click('#open')
  await expect(window).toBeVisible()
  await expect(page.locator('#count')).toHaveText('1')
  const before = await boxOf(window)
  await dragBy(page, window.locator('[data-wm-drag]'), 60, 30, { steps: 8 })
  const after = await boxOf(window)
  expect(Math.abs(after.x - before.x - 60)).toBeLessThanOrEqual(14)
})
