import { expect, type Page, test } from '@playwright/test'
import { boxOf, dragBy } from './utils'

const readme = '[data-testid="window-readme"]'

test.beforeEach(async ({ page }) => {
  await page.goto('?lang=en')
  await expect(page.locator(readme)).toBeVisible()
})

async function launch(page: Page, app: string) {
  await page.click(`#launcher button[data-app="${app}"]`)
  const window = page.locator(`[data-testid="window-${app}"]`)
  await expect(window).toBeVisible()
  return window
}

test('the desktop boots with a live launcher', async ({ page }) => {
  await expect(page.locator('#launcher button')).toHaveCount(9)
  await expect(page.locator(`${readme} [data-wm-title]`)).toHaveText('readme.md')
  await expect(page.locator('#stat-win')).not.toHaveText('0')
})

test('a hero window is draggable', async ({ page }) => {
  const window = page.locator(readme)
  const before = await boxOf(window)
  await dragBy(page, window.locator('[data-wm-drag]'), 40, 60)
  const after = await boxOf(window)
  expect(Math.abs(after.x - before.x - 40)).toBeLessThanOrEqual(14)
  expect(Math.abs(after.y - before.y - 60)).toBeLessThanOrEqual(14)
})

test('language toggle switches chrome, windows and documentation', async ({ page }) => {
  await expect(page.locator('h1')).toContainText('WINDOWS')
  await page.click('#lang button[data-lang="ru"]')
  await expect(page.locator('h1')).toContainText('ОКНА')
  await expect(page.locator(`${readme} [data-wm-title]`)).toHaveText('читай.md')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.locator('#features h2')).toContainText('рабочего стола')
  await page.click('#lang button[data-lang="en"]')
  await expect(page.locator('h1')).toContainText('WINDOWS')
})

test('minimize parks a window in the dock and restores it', async ({ page }) => {
  const window = page.locator(readme)
  await window.locator('[data-wm-minimize]').click()
  await expect(window).toBeHidden()
  const task = page.locator('#dock [data-task="readme"]')
  await expect(task).toBeVisible()
  await task.click()
  await expect(window).toBeVisible()
})

test('the launcher opens an app and marks it as running', async ({ page }) => {
  await launch(page, 'layouts')
  await expect(page.locator('#launcher button[data-app="layouts"]')).toHaveAttribute(
    'data-running',
    '',
  )
})

test('the layouts pad snaps the active window into a zone', async ({ page }) => {
  const layouts = await launch(page, 'layouts')
  await layouts.locator('.zone-pad button').first().click()
  await expect(layouts).toHaveAttribute('data-wm-stage', 'snapped')
})

test('the terminal runs commands against the manager', async ({ page }) => {
  const terminal = await launch(page, 'terminal')
  const input = terminal.locator('.term-form input')
  await input.fill('open probe')
  await input.press('Enter')
  await expect(terminal.locator('.term-log')).toContainText('probe')
  await input.fill('state')
  await input.press('Enter')
  await expect(terminal.locator('.term-log')).toContainText('windows')
})

test('workspaces hide and restore their windows', async ({ page }) => {
  const window = page.locator(readme)
  await page.click('#workspaces button[data-workspace="1"]')
  await expect(window).toBeHidden()
  await expect(page.locator('#workspaces button[data-workspace="1"]')).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.click('#workspaces button[data-workspace="0"]')
  await expect(window).toBeVisible()
})

test('the window menu tiles the desktop and edit undoes it', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'the menubar collapses on narrow viewports')
  const window = page.locator(readme)
  const before = await boxOf(window)
  await page.locator('.menu-trigger').nth(0).click()
  await page.click('.menu-pop button[data-action="tile"]')
  const tiled = await boxOf(window)
  expect(tiled.width).not.toBe(before.width)
  await page.locator('.menu-trigger').nth(1).click()
  await page.click('.menu-pop button[data-action="undo"]')
  const restored = await boxOf(window)
  expect(Math.abs(restored.width - before.width)).toBeLessThanOrEqual(2)
})

test('documentation sections render below the desktop', async ({ page }) => {
  await expect(page.locator('.feature')).toHaveCount(8)
  await expect(page.locator('#fw-row > div')).toHaveCount(6)
  const table = page.locator('#compare-table table')
  await expect(table.locator('thead .col-wmkit')).toHaveText('wmkit')
  await expect(table.locator('tbody tr')).toHaveCount(10)
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
