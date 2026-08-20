import { expect, type Page, test } from '@playwright/test'

const PREVIEW = '.builder-stage [data-wm-window="preview"]'
const MARKUP = '.builder-editor:not(.builder-css)'
const SCOPE = '[data-wm-desktop] [data-wm-window][data-wm-skin="custom"]'

async function openBuilder(page: Page, lang = 'en'): Promise<void> {
  await page.goto(`?lang=${lang}`)
  await page.locator('#builder').scrollIntoViewIfNeeded()
  await expect(page.locator(PREVIEW)).toBeVisible()
}

function previewBg(page: Page) {
  return page.evaluate(() => {
    const win = document.querySelector('.builder-stage [data-wm-window="preview"]')
    return win ? getComputedStyle(win).backgroundColor : ''
  })
}

test.describe('the window designer', () => {
  test('shows a live window beside the controls, in both languages', async ({ page }) => {
    await openBuilder(page)
    await expect(page.locator(`${PREVIEW} [data-wm-title]`)).toHaveText('my window')
    await expect(page.locator('.builder-chip')).toHaveCount(5)
    await expect(page.locator('.builder-axis input')).toHaveCount(4)

    await openBuilder(page, 'ru')
    await expect(page.locator(`${PREVIEW} [data-wm-title]`)).toHaveText('моё окно')
    await expect(page.locator('#builder h2')).toHaveText('Ваша разметка, наш движок')
  })

  test('a preset restyles the live window', async ({ page }) => {
    await openBuilder(page)
    await page.locator('.builder-chip[data-preset="win95"]').click()
    await expect(page.locator('.builder-chip[data-preset="win95"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.locator(MARKUP)).toHaveValue(/w95/)
    await expect.poll(() => previewBg(page)).toBe('rgb(192, 192, 192)')
  })

  test('css typed into the editor lands on the window', async ({ page }) => {
    await openBuilder(page)
    await page.locator('.builder-css').fill(`${SCOPE} { background: rgb(9, 99, 199) !important; }`)
    await expect.poll(() => previewBg(page), { timeout: 10_000 }).toBe('rgb(9, 99, 199)')
  })

  test('placement runs both ways', async ({ page, isMobile }) => {
    await openBuilder(page)
    const width = page.locator('.builder-axis input').nth(2)
    await width.fill('320')
    await width.blur()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const box = document
            .querySelector('.builder-stage [data-wm-window="preview"]')
            ?.getBoundingClientRect()
          return box ? Math.round(box.width) : 0
        }),
      )
      .toBe(320)

    test.skip(isMobile, 'the drag half needs a mouse; touch drags are covered by drag.spec')
    await page.waitForTimeout(350)
    const xInput = page.locator('.builder-axis input').nth(0)
    const before = Number.parseInt(await xInput.inputValue(), 10)
    const bar = await page.locator(`${PREVIEW} [data-wm-title]`).boundingBox()
    expect(bar).not.toBeNull()
    const barBox = bar as { x: number; y: number; width: number; height: number }
    await page.mouse.move(barBox.x + barBox.width / 2, barBox.y + barBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(barBox.x + barBox.width / 2 + 100, barBox.y + barBox.height / 2 + 30, {
      steps: 10,
    })
    await page.mouse.up()
    await expect
      .poll(async () => Number.parseInt(await xInput.inputValue(), 10), { timeout: 10_000 })
      .not.toBe(before)
  })

  test('a broken template is refused out loud and the window survives', async ({ page }) => {
    await openBuilder(page)
    await page.locator(MARKUP).fill('<section><header data-wm-drag></header></section>')
    await expect(page.locator('.builder-status')).toHaveText(/exactly one/, { timeout: 10_000 })
    await expect(page.locator(PREVIEW)).toBeVisible()
  })

  test('copies a complete runnable snippet', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only here')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openBuilder(page)
    await page.locator('.builder-actions .btn:not(.btn-primary)').click()
    await expect(page.locator('.builder-status')).toHaveText(/copied|скопировано/)

    const code = await page.evaluate(() => navigator.clipboard.readText())
    expect(code).toContain("import { skin } from '@surdeddd/wmkit/chrome'")
    expect(code).toContain('styles: `')
    expect(code).toContain("desktop.mountWindow('app', 'mine')")
  })

  test('sends the skin to the demo desktop above', async ({ page }) => {
    await openBuilder(page)
    await page.locator('.builder-actions .btn-primary').click()

    const win = page.locator('[data-wm-window="skins"]')
    await expect(win).toBeVisible()
    await expect(win).toHaveAttribute('data-wm-skin', 'custom')
    await expect(win).toHaveAttribute('data-wm-focused', '')
  })
})
