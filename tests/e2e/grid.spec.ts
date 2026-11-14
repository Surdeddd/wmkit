import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { boxOf, handle, win } from './utils'

const START = { x: 53, y: 67, width: 200, height: 150 }

const bounds = (page: Page) => page.evaluate(() => window.__wm.get('fixed')?.bounds)

test.beforeEach(async ({ page }) => {
  await page.goto('test/vanilla.html?grid=40')
  await expect(page.locator('#desktop')).toBeVisible()
  await page.click('#btn-clear')
  await page.evaluate((start) => {
    window.__spawn({ id: 'fixed', title: 'Fixed', ...start })
  }, START)
  await expect(win(page, 'fixed')).toBeVisible()
})

test('a dragged window lands on the grid, goes free while Alt is held and comes back', async ({
  page,
}) => {
  const grab = await boxOf(handle(page, 'fixed'))
  const [x, y] = [grab.x + 40, grab.y + grab.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 31, y + 9, { steps: 6 })
  await expect.poll(() => bounds(page)).toMatchObject({ x: 80, y: 80 })

  await page.keyboard.down('Alt')
  await page.mouse.move(x + 33, y + 11)
  await expect
    .poll(async () => {
      const now = await bounds(page)
      return now && Math.abs(now.x - 86) <= 1 && Math.abs(now.y - 78) <= 1
    })
    .toBe(true)

  await page.keyboard.up('Alt')
  await page.mouse.move(x + 34, y + 12)
  await page.mouse.up()
  await expect.poll(() => bounds(page)).toMatchObject({ x: 80, y: 80, width: 200, height: 150 })
})

test('a pulled corner lands both of its edges on the grid and leaves the other two', async ({
  page,
}) => {
  const grip = await boxOf(win(page, 'fixed').locator('[data-wm-resize="se"]'))
  const [x, y] = [grip.x + grip.width / 2, grip.y + grip.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 33, y + 27, { steps: 6 })
  await page.mouse.up()
  await expect.poll(() => bounds(page)).toEqual({ x: 53, y: 67, width: 227, height: 173 })
})

test('escape puts the window back where it stood, off the grid', async ({ page }) => {
  const grab = await boxOf(handle(page, 'fixed'))
  const [x, y] = [grab.x + 40, grab.y + grab.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 90, y + 50, { steps: 6 })
  await expect.poll(() => bounds(page)).toMatchObject({ x: 160, y: 120 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect.poll(() => bounds(page)).toEqual(START)
})
