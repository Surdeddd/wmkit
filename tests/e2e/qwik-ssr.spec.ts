import { expect, test } from './fixtures'
import { boxOf, dragBy } from './utils'

const notes = 'section:has(#notes-body)'

test.beforeEach(async ({ page }) => {
  await page.goto('test/qwik-ssr/')
})

test.describe('before any script runs', () => {
  test.use({ javaScriptEnabled: false })

  test('the server markup already is the window', async ({ page }) => {
    const section = page.locator(notes)
    await expect(section).toBeVisible()
    await expect(section).not.toHaveAttribute('data-wm-window')
    await expect(section.locator('[data-wm-title]')).toHaveText('Notes')
    await expect(page.locator('#notes-body')).toHaveText('server content')
    await expect(page.locator('#count')).toHaveText('0')
  })
})

test('the client resumes the server-rendered desktop without rendering it again', async ({
  page,
}) => {
  const section = page.locator(notes)
  await expect(section).toHaveAttribute('data-wm-window', 'notes')
  await expect(page.locator('.desktop')).toHaveAttribute('data-wm-desktop', '')
  await expect(section).toHaveAttribute('data-wm-variant', 'resumed')
  await expect(page.locator('#count')).toHaveText('1')
  await expect(page.locator('#notes-body')).toHaveText('server content')
  expect(await section.evaluate((el) => el.style.transform)).toBe('translate3d(20px, 60px, 0px)')
})

test('the resumed window drags and follows its geometry props', async ({ page }) => {
  const section = page.locator(notes)
  await expect(section).toHaveAttribute('data-wm-window', 'notes')
  const before = await boxOf(section)
  await dragBy(page, section.locator('[data-wm-drag]'), 60, 40, { steps: 8 })
  const after = await boxOf(section)
  expect(Math.abs(after.x - before.x - 60)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.y - before.y - 40)).toBeLessThanOrEqual(2)

  await page.click('#drag')
  await expect
    .poll(() => section.evaluate((el) => el.style.transform))
    .toBe('translate3d(200px, 150px, 0px)')
  await page.click('#shift')
  await expect
    .poll(() => section.evaluate((el) => el.style.transform))
    .toBe('translate3d(120px, 150px, 0px)')
  await page.click('#grow')
  await expect.poll(() => section.evaluate((el) => el.style.width)).toBe('320px')
  await page.click('#rename')
  await expect(section.locator('[data-wm-title]')).toHaveText('Notes 1')
  expect(await section.evaluate((el) => el.style.transform)).toBe('translate3d(120px, 150px, 0px)')
})

test('a resumed window closes and binds again when its id reopens', async ({ page }) => {
  const section = page.locator(notes)
  await expect(section).toHaveAttribute('data-wm-window', 'notes')
  await page.click('#notes-close')
  await expect(section).toBeHidden()
  await expect(page.locator('#count')).toHaveText('0')
  await page.click('#reopen')
  await expect(section).toHaveAttribute('data-wm-window', 'notes')
  await expect(section).toBeVisible()
  await expect(page.locator('#count')).toHaveText('1')
})
