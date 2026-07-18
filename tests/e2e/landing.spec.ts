import { expect, test } from '@playwright/test'
import { boxOf, dragBy } from './utils'

test.beforeEach(async ({ page }) => {
  await page.goto('?lang=en')
  await expect(page.locator('[data-testid="window-welcome"]')).toBeVisible()
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('.desktop-wrap, .hero-copy')]
        .flatMap((el) => el.getAnimations())
        .map((animation) => animation.finished.catch(() => {})),
    ),
  )
})

test('hero desktop window is draggable', async ({ page }) => {
  const welcome = page.locator('[data-testid="window-welcome"]')
  const before = await boxOf(welcome)
  await dragBy(page, welcome.locator('[data-wm-drag]'), 60, 40)
  const after = await boxOf(welcome)
  expect(Math.abs(after.x - before.x - 60)).toBeLessThanOrEqual(10)
  expect(Math.abs(after.y - before.y - 40)).toBeLessThanOrEqual(10)
})

test('language toggle switches the whole page', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('Windows.')
  await page.click('.lang button[data-lang="ru"]')
  await expect(page.locator('h1')).toContainText('Окна.')
  await expect(page.locator('[data-testid="window-welcome"] [data-wm-title]')).toHaveText(
    'привет.app',
  )
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await page.click('.lang button[data-lang="en"]')
  await expect(page.locator('h1')).toContainText('Windows.')
})

test('minimize sends the window into the dock and back', async ({ page }) => {
  const welcome = page.locator('[data-testid="window-welcome"]')
  await welcome.locator('[data-wm-minimize]').click()
  await expect(welcome).toBeHidden()
  const task = page.locator('#dock [data-task="welcome"]')
  await expect(task).toBeVisible()
  await task.click()
  await expect(welcome).toBeVisible()
})

test('dock plus opens the playground and its actions work', async ({ page }) => {
  await page.click('#dock-plus')
  const playground = page.locator('[data-testid="window-playground"]')
  await expect(playground).toBeVisible()
  await playground.locator('.win-actions button').nth(3).click()
  await expect(playground).toHaveAttribute('data-wm-stage', 'snapped')
  await playground.locator('.win-actions button').first().click()
  await expect(page.locator('[data-testid="window-play-1"]')).toBeVisible()
})

test('framework tabs swap the highlighted snippet', async ({ page }) => {
  await expect(page.locator('#fw-code')).toContainText('createWindowManager')
  await page.click('#fw-tabs button[data-tab="react"]')
  await expect(page.locator('#fw-code')).toContainText('useWindowManager')
  await page.click('#fw-tabs button[data-tab="svelte"]')
  await expect(page.locator('#fw-code')).toContainText('use:dk.desktop')
})

test('comparison table renders with the wmkit column highlighted', async ({ page }) => {
  const table = page.locator('#compare-table table')
  await expect(table).toBeVisible()
  await expect(table.locator('thead .col-wmkit')).toHaveText('wmkit')
  await expect(table.locator('tbody tr')).toHaveCount(9)
})

test('capture landing screenshots', async ({ page }, testInfo) => {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  await page.screenshot({
    path: testInfo.outputPath('landing-hero.png'),
    clip: { x: 0, y: 0, width: page.viewportSize()?.width ?? 1280, height: 720 },
  })
  await page.screenshot({ path: testInfo.outputPath('landing-full.png'), fullPage: true })
})
