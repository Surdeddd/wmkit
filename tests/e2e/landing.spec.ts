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
  await expect(table.locator('tbody tr')).toHaveCount(11)
})

test('dropping a titlebar on another window groups them into tabs', async ({ page }) => {
  const moving = await launch(page, 'layouts')
  const host = page.locator(readme)
  const movingHandle = moving.locator('[data-wm-drag]')
  const hostHandle = host.locator('[data-wm-drag]')

  const from = await boxOf(movingHandle)
  const to = await boxOf(hostHandle)
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height / 2)
  await expect(page.locator('[data-wm-tab-target]')).toBeVisible()
  await page.mouse.up()

  await expect(moving).toHaveAttribute('data-wm-tab', 'active')
  await expect(host).toHaveAttribute('data-wm-tab', 'inactive')
  await expect(host).toBeHidden()

  const tabs = moving.locator('.win-tab')
  await expect(tabs).toHaveCount(2)
  await tabs.filter({ hasText: 'readme' }).click()
  await expect(host).toBeVisible()
  await expect(moving).toBeHidden()
})

test('a tab can be dragged out of its group', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'the group needs two roomy windows side by side')
  const moving = await launch(page, 'layouts')
  const host = page.locator(readme)

  await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'layouts']))
  await expect(host).toBeVisible()
  await expect(host.locator('.win-tab')).toHaveCount(2)

  const tab = host.locator('.win-tab[data-tab="layouts"]')
  const box = await boxOf(tab)
  const dropX = box.x + 220
  const dropY = box.y + 320
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 80, box.y + 60, { steps: 6 })
  await page.mouse.move(dropX, dropY, { steps: 10 })
  await page.mouse.up()

  await expect(moving).toHaveJSProperty('dataset.wmGroup', undefined)
  await expect(host).toBeVisible()
  await expect(moving).toBeVisible()

  const after = await boxOf(moving)
  expect(Math.abs(after.x + after.width / 2 - dropX)).toBeLessThanOrEqual(14)
  expect(Math.abs(after.y + 12 - dropY)).toBeLessThanOrEqual(14)

  await page.evaluate(() => window.__wmDemo.wm.undo())
  expect(await page.evaluate(() => window.__wmDemo.wm.get('layouts')?.groupId)).toBeTruthy()
})

test('a torn off tab keeps its own size instead of the maximized frame', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'the group needs two roomy windows side by side')
  const moving = await launch(page, 'layouts')
  const host = page.locator(readme)

  await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'layouts']))
  const framed = await boxOf(host)

  await page.evaluate(() => window.__wmDemo.wm.maximize('readme'))
  await expect(host).toHaveAttribute('data-wm-stage', 'maximized')
  const maximized = await boxOf(host)
  expect(maximized.width).toBeGreaterThan(framed.width + 50)

  const box = await boxOf(host.locator('.win-tab[data-tab="layouts"]'))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + 120, { steps: 6 })
  await page.mouse.move(box.x + 260, box.y + 360, { steps: 10 })
  await page.mouse.up()

  await expect(moving).toHaveAttribute('data-wm-stage', 'normal')
  const after = await boxOf(moving)
  expect(Math.abs(after.width - framed.width)).toBeLessThanOrEqual(2)
})

test('the tab strip takes no room until the window is grouped', async ({ page }) => {
  const strip = page.locator(`${readme} .win-tabs`)
  const widthOf = () => strip.evaluate((el) => el.getBoundingClientRect().width)
  expect(await widthOf()).toBe(0)

  await launch(page, 'layouts')
  await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'layouts']))
  await expect(strip).toBeVisible()
  expect(await widthOf()).toBeGreaterThan(0)
})

test('a tab nudged inside its own strip stays in the group', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'the group needs two roomy windows side by side')
  await launch(page, 'layouts')
  await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'layouts']))

  const host = page.locator(readme)
  const from = await boxOf(host.locator('.win-tab[data-tab="layouts"]'))
  const to = await boxOf(host.locator('.win-tab[data-tab="readme"]'))
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await page.mouse.up()

  expect(await page.evaluate(() => window.__wmDemo.wm.get('layouts')?.groupId)).toBeTruthy()
  await expect(host.locator('.win-tab')).toHaveCount(2)
})

test('a tab dropped on a covered titlebar does not join the window underneath', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'the group needs three roomy windows')
  const moving = await launch(page, 'layouts')
  await launch(page, 'terminal')

  await page.evaluate(() => {
    const wm = window.__wmDemo.wm
    wm.group(['readme', 'layouts'])
    wm.restoreTo('terminal', { x: 40, y: 40, width: 420, height: 320 })
    wm.restoreTo('readme', { x: 60, y: 60, width: 420, height: 320 })
    wm.focus('readme')
  })

  const host = page.locator(readme)
  const covered = await boxOf(page.locator('[data-testid="window-terminal"] [data-wm-drag]'))
  const box = await boxOf(host.locator('.win-tab[data-tab="layouts"]'))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 30, box.y + 40, { steps: 6 })
  await page.mouse.move(covered.x + covered.width / 2, covered.y + covered.height / 2, {
    steps: 10,
  })
  await page.mouse.up()

  const groups = await page.evaluate(() => {
    const wm = window.__wmDemo.wm
    return { layouts: wm.get('layouts')?.groupId, terminal: wm.get('terminal')?.groupId }
  })
  expect(groups.terminal).toBeNull()
  expect(groups.layouts).toBeNull()
  await expect(moving).toBeVisible()
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
