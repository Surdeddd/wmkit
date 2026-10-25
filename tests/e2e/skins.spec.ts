import { expect, type Page, test } from './fixtures'

const CUSTOM =
  '<section data-testid="window-{{id}}">' +
  '<header data-wm-drag data-side="custom"><span data-wm-title>{{title}}</span>' +
  '<span class="win-tabs" hidden></span></header>' +
  '<div data-wm-content></div></section>'

function sideOf(page: Page, id: string) {
  return page.locator(`[data-testid="window-${id}"] [data-wm-drag]`)
}

async function applyShadow(page: Page): Promise<void> {
  const win = page.locator('[data-testid="window-skins"]')
  await win.locator('.skin-toggle input').check()
  await win.locator('.skin-action', { hasText: 'apply' }).click()
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('[data-wm-window="skins"]')?.shadowRoot !== null),
    )
    .toBe(true)
}

function dressOf(page: Page, id: string) {
  return page.evaluate((target) => {
    const host = document.querySelector(`[data-wm-window="${target}"]`)
    const root = host?.shadowRoot
    return {
      skin: host?.getAttribute('data-wm-skin') ?? null,
      sheets: root ? root.adoptedStyleSheets.length + root.querySelectorAll('style').length : -1,
    }
  }, id)
}

function shadowRules(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-wm-window="skins"]')?.shadowRoot
    if (!root) return ''
    const adopted = root.adoptedStyleSheets.flatMap((sheet) =>
      [...sheet.cssRules].map((rule) => rule.cssText),
    )
    const inline = [...root.querySelectorAll('style')].map((tag) => tag.textContent ?? '')
    return [...adopted, ...inline].join('\n')
  })
}

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

test('a layout or reset takes every window off a custom template', async ({ page }) => {
  const win = page.locator('[data-testid="window-skins"]')
  await win.locator('.skin-template').fill(CUSTOM)
  await win.locator('.skin-action', { hasText: 'apply' }).click()
  await expect(sideOf(page, 'readme')).toHaveAttribute('data-side', 'custom')

  await win.locator('.skin-template').fill(`${CUSTOM}\n`)
  await win.locator('.skin-action', { hasText: 'reset' }).click()
  for (const id of ['skins', 'readme']) {
    await expect(sideOf(page, id)).toHaveAttribute('data-side', 'left')
  }

  await win.locator('.skin-template').fill(CUSTOM)
  await win.locator('.skin-action', { hasText: 'apply' }).click()
  await expect(sideOf(page, 'readme')).toHaveAttribute('data-side', 'custom')
  await win.locator('.skin-layout-button[data-layout="right"]').click()
  for (const id of ['skins', 'readme']) {
    await expect(sideOf(page, id)).toHaveAttribute('data-side', 'right')
  }
  await expect(win.locator('.skin-layout-button[data-layout="right"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('a window opened after a shadow skin is dressed like the others', async ({ page }) => {
  await applyShadow(page)
  await page.click('#launcher button[data-app="paint"]')
  await expect(page.locator('[data-wm-window="paint"]')).toBeVisible()

  const skins = await dressOf(page, 'skins')
  expect(skins.sheets).toBeGreaterThan(0)
  expect(await dressOf(page, 'paint')).toEqual(skins)
})

test('a grouped shadow window still shows its tabs', async ({ page }) => {
  await page.click('#launcher button[data-app="paint"]')
  await expect(page.locator('[data-testid="window-paint"]')).toBeVisible()
  await applyShadow(page)
  await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'paint']))

  const strip = () =>
    page.evaluate(() => {
      const wm = window.__wmDemo.wm
      const active = wm.getState().groups[wm.get('readme')?.groupId ?? '']?.activeId ?? ''
      const root = document.querySelector(`[data-wm-window="${active}"]`)?.shadowRoot
      return {
        active,
        tabs: root?.querySelectorAll('.win-tab').length ?? 0,
        titleHidden: root?.querySelector<HTMLElement>('[data-wm-title]')?.hidden ?? false,
      }
    })
  await expect.poll(async () => (await strip()).tabs).toBe(2)
  const before = await strip()
  expect(before.titleHidden).toBe(true)

  const other = before.active === 'readme' ? 'paint' : 'readme'
  await page.evaluate(
    ({ active, other }) => {
      document
        .querySelector(`[data-wm-window="${active}"]`)
        ?.shadowRoot?.querySelector<HTMLElement>(`.win-tab[data-tab="${other}"]`)
        ?.click()
    },
    { active: before.active, other },
  )
  await expect.poll(async () => (await strip()).active).toBe(other)
})

test('a theme switch re-dresses a shadow skin', async ({ page }) => {
  await applyShadow(page)
  const glass = await shadowRules(page)

  const win = page.locator('[data-wm-window="skins"]')
  await win.locator('.skin-swatch.skin-carbon').click()
  await expect(page.locator('#desktop')).toHaveAttribute('data-theme', 'carbon')
  const switched = await shadowRules(page)

  await win.locator('.skin-action', { hasText: 'apply' }).click()
  const fresh = await shadowRules(page)
  expect(fresh).not.toBe(glass)
  expect(switched).toBe(fresh)
})
