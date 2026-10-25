import { expect, type Page, test } from './fixtures'
import { boxOf, dragBy } from './utils'

async function open(page: Page, example: string): Promise<string> {
  return page.evaluate((name) => window.examples[name]?.().id as string, example)
}

const winbox = (page: Page, id: string) => page.locator(`.winbox[id="${id}"]`)

test.beforeEach(async ({ page }) => {
  await page.goto('test/winbox.html')
  await page.waitForFunction(() => typeof window.examples === 'object')
})

test('every README way of opening a window works', async ({ page }) => {
  for (const name of ['basic', 'new', 'options', 'call', 'color', 'html', 'sized']) {
    const id = await open(page, name)
    await expect(winbox(page, id)).toBeVisible()
  }
  const titles = await page.locator('.winbox .wb-title').allTextContents()
  expect(titles.slice(0, 4)).toEqual([
    'Window Title',
    'Window Title',
    'Window Title',
    'Window Title',
  ])
  await expect(page.locator('.winbox .wb-body h1')).toHaveText('Lorem Ipsum')
})

test('a window drags by its header, resizes, maximizes and closes', async ({ page }) => {
  const id = await open(page, 'basic')
  const frame = winbox(page, id)
  const before = await boxOf(frame)
  await dragBy(page, frame.locator('.wb-title'), 60, 40, { steps: 10 })
  const moved = await boxOf(frame)
  expect(Math.abs(moved.x - before.x - 60)).toBeLessThanOrEqual(14)

  await dragBy(page, frame.locator('[data-wm-resize="se"]'), 50, 30, { steps: 8 })
  const grown = await boxOf(frame)
  expect(grown.width).toBeGreaterThan(moved.width + 30)

  await frame.locator('.wb-title').dblclick()
  await expect(frame).toHaveClass(/\bmax\b/)
  await frame.locator('.wb-max').click()
  await expect(frame).not.toHaveClass(/\bmax\b/)

  await frame.locator('.wb-close').click()
  await expect(frame).toHaveCount(0)
})

test('a minimized window waits in the strip and comes back from it', async ({ page }) => {
  const id = await open(page, 'basic')
  await winbox(page, id).locator('.wb-min').click()
  await expect(winbox(page, id)).toBeHidden()
  const restore = page.locator('.wb-strip button', { hasText: 'Window Title' })
  await restore.click()
  await expect(winbox(page, id)).toBeVisible()
  await expect(page.locator('.wb-strip button')).toHaveCount(0)
})

test('a modal dims the page and blocks the windows below', async ({ page }) => {
  const below = await open(page, 'sized')
  await open(page, 'modal')
  await expect(page.locator('.wb-backdrop')).toBeVisible()
  const before = await boxOf(winbox(page, below))
  await page.mouse.move(before.x + 10, before.y + before.height - 10)
  await page.mouse.down()
  await page.mouse.move(before.x + 120, before.y + before.height + 60, { steps: 6 })
  await page.mouse.up()
  const after = await boxOf(winbox(page, below))
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
})

test('a mounted node moves in and goes home when the window closes', async ({ page }) => {
  const id = await open(page, 'mount')
  await expect(winbox(page, id).locator('#content')).toBeVisible()
  await winbox(page, id).locator('.wb-close').click()
  await expect(page.locator('#store > #content')).toHaveCount(1)
})

test('a url window raises itself when you click into its frame', async ({ page }) => {
  const id = await open(page, 'url')
  const other = await open(page, 'basic')
  await page.evaluate((id) => {
    const box = window.WinBox.stack().find((made: { id: string }) => made.id === id)
    box?.move(0, 0).resize(240, 180)
  }, id)
  await page.evaluate((id) => {
    const box = window.WinBox.stack().find((made: { id: string }) => made.id === id)
    box?.move('right', 'bottom').resize(240, 180)
  }, other)
  const frame = await boxOf(winbox(page, id).locator('iframe'))
  await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height / 2)
  await expect.poll(() => page.evaluate(() => window.WinBox.stack().at(-1)?.id)).toBe(id)
})

test('control classes hide the buttons and lock moving and resizing', async ({ page }) => {
  const id = await open(page, 'classes')
  const frame = winbox(page, id)
  for (const control of ['.wb-min', '.wb-max', '.wb-full']) {
    await expect(frame.locator(control)).toBeHidden()
  }
  await expect(frame.locator('.wb-close')).toBeVisible()
  const before = await boxOf(frame)
  await dragBy(page, frame.locator('.wb-title'), 80, 60, { steps: 8 })
  const after = await boxOf(frame)
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
  await expect(frame.locator('[data-wm-resize="se"]')).toBeHidden()
})

test('top, right, bottom and left keep a window inside the area they leave', async ({ page }) => {
  const id = await open(page, 'viewport')
  const frame = winbox(page, id)
  const start = await boxOf(frame)
  await dragBy(page, frame.locator('.wb-title'), -2000, -2000, { steps: 12 })
  const pushed = await boxOf(frame)
  expect(pushed.y).toBeGreaterThanOrEqual(50 - 1)
  expect(pushed.x).toBeLessThan(start.x)
})
