import { expect, test } from '@playwright/test'

const panel = '[data-wm-devtools]'
const rows = `${panel} [data-wm-devtools-row]`

test.beforeEach(async ({ page }) => {
  await page.goto('?lang=en')
  await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
  await page.click('#launcher button[data-app="devtools"]')
  await expect(page.locator(panel)).toBeVisible()
})

test('the panel lists the desktop and follows it', async ({ page }) => {
  const before = await page.locator(rows).count()
  expect(before).toBeGreaterThan(0)

  await page.click('#launcher button[data-app="layouts"]')
  await expect(page.locator(rows)).toHaveCount(before + 1)

  await page.click(
    `${rows}[data-wm-devtools-row="layouts"] button[data-wm-devtools-action="close"]`,
  )
  await expect(page.locator(rows)).toHaveCount(before)
  expect(await page.evaluate(() => window.__wmDemo.wm.get('layouts'))).toBeFalsy()
})

test('the panel drives the manager and logs what happens', async ({ page }) => {
  await page.click(
    `${rows}[data-wm-devtools-row="readme"] button[data-wm-devtools-action="minimize"]`,
  )
  await expect(page.locator('[data-testid="window-readme"]')).toBeHidden()
  await expect(page.locator(`${panel} .wm-dt-log li`).first()).toContainText('readme')
})

test('the panel is reachable and labelled for assistive tech', async ({ page }) => {
  const region = page.locator(panel)
  await expect(region).toHaveAttribute('role', 'complementary')

  const label = await region.getAttribute('aria-labelledby')
  expect(label).toBeTruthy()
  await expect(page.locator(`#${label}`)).toHaveText('wmkit devtools')

  const close = page
    .locator(`${rows}[data-wm-devtools-row="readme"] button[data-wm-devtools-action="close"]`)
    .first()
  await expect(close).toHaveAttribute('aria-label', 'close readme')
})

test('the panel speaks russian with the site', async ({ page }) => {
  await page.click('#lang button[data-lang="ru"]')
  await expect(page.locator(panel)).toContainText('окна')
})
