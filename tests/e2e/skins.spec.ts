import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('?lang=en')
  await page.click('#launcher button[data-app="skins"]')
  await expect(page.locator('[data-testid="window-skins"]')).toBeVisible()
})

test('a layout rebuilds every window and keeps what it was showing', async ({ page }) => {
  const win = page.locator('[data-testid="window-skins"]')
  await expect(win.locator('[data-wm-drag]')).toHaveAttribute('data-side', 'left')

  await win.locator('.skin-layout-button[data-layout="right"]').click()

  await expect(win.locator('[data-wm-drag]')).toHaveAttribute('data-side', 'right')
  await expect(win.locator('[data-wm-title]')).toHaveText('skins')
  await expect(win.locator('.skin-layout-button[data-layout="right"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(win.locator('[data-wm-close]')).toBeVisible()

  await win.locator('.skin-layout-button[data-layout="bare"]').click()
  await expect(win.locator('[data-wm-close]')).toHaveCount(0)
  await expect(win.locator('[data-wm-drag]')).toBeVisible()
})

test('a rebuilt window still answers its own controls', async ({ page }) => {
  const win = page.locator('[data-testid="window-skins"]')
  await win.locator('.skin-layout-button[data-layout="right"]').click()
  await win.locator('[data-wm-close]').click()
  await expect(page.locator('[data-testid="window-skins"]')).toHaveCount(0)
})

test('a custom template is applied to the live window', async ({ page }) => {
  const win = page.locator('[data-testid="window-skins"]')
  await win
    .locator('.skin-template')
    .fill(
      '<section data-testid="window-{{id}}" data-mine="yes">' +
        '<header data-wm-drag><b data-wm-title>{{title}}</b>' +
        '<button data-wm-close aria-label="Close"></button></header>' +
        '<div data-wm-content></div></section>',
    )
  await win.locator('.skin-action', { hasText: 'apply' }).click()

  const rebuilt = page.locator('[data-testid="window-skins"]')
  await expect(rebuilt).toHaveAttribute('data-mine', 'yes')
  await expect(rebuilt.locator('b[data-wm-title]')).toHaveText('skins')
  await expect(rebuilt.locator('.skin-template')).toBeVisible()
})

test('a template without a content slot is refused out loud', async ({ page }) => {
  const win = page.locator('[data-testid="window-skins"]')
  await win.locator('.skin-template').fill('<section><header data-wm-drag></header></section>')
  await win.locator('.skin-action', { hasText: 'apply' }).click()

  await expect(win.locator('.skin-status')).toHaveText(/exactly one/)
  await expect(win.locator('[data-wm-drag]')).toHaveAttribute('data-side', 'left')
})

test('the constructor hands the skin over as code', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only here')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  const win = page.locator('[data-testid="window-skins"]')
  await win.locator('.skin-action-copy').click()
  await expect(win.locator('.skin-status')).toHaveText('copied')

  const code = await page.evaluate(() => navigator.clipboard.readText())
  expect(code).toContain('skin({')
  expect(code).toContain('data-wm-content')
  expect(code).toContain('shadow: false')
})

test('a shadow skin hides its chrome from the page', async ({ page }) => {
  const win = page.locator('[data-testid="window-skins"]')
  await win.locator('.skin-toggle input').check()
  await win.locator('.skin-action', { hasText: 'apply' }).click()

  const host = page.locator('[data-wm-window="skins"]')
  await expect(host).toHaveCount(1)
  expect(await host.evaluate((node) => node.shadowRoot !== null)).toBe(true)
  expect(await host.evaluate((node) => node.querySelector('[data-wm-drag]') === null)).toBe(true)
  expect(
    await host.evaluate((node) => node.shadowRoot?.querySelector('[data-wm-drag]') !== null),
  ).toBe(true)
})
