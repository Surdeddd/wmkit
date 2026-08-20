import { expect, test } from '@playwright/test'

test.describe('the page-level window builder', () => {
  test('is a visible section of the landing, in both languages', async ({ page }) => {
    await page.goto('?lang=en')
    const band = page.locator('#builder')
    await expect(band).toBeVisible()
    await expect(band.locator('h2')).toHaveText('Your markup, our engine')
    await expect(band.locator('.builder-chip')).toHaveCount(3)
    await expect(band.locator('.builder-editor')).toBeVisible()

    await page.goto('?lang=ru')
    await expect(page.locator('#builder h2')).toHaveText('Ваша разметка, наш движок')
  })

  test('applies an edited template to the live window on the desktop', async ({ page }) => {
    await page.goto('?lang=en')
    await page.locator('#builder').scrollIntoViewIfNeeded()
    await page
      .locator('.builder-editor')
      .fill(
        '<section data-testid="window-{{id}}" data-built="page">' +
          '<header data-wm-drag><b data-wm-title>{{title}}</b>' +
          '<button data-wm-close aria-label="Close"></button></header>' +
          '<div data-wm-content></div></section>',
      )
    await page.locator('.builder-actions .btn-primary').click()

    const win = page.locator('[data-wm-window="skins"]')
    await expect(win).toBeVisible()
    await expect(win).toHaveAttribute('data-built', 'page')
    await expect(win).toHaveAttribute('data-wm-focused', '')
  })

  test('says out loud when a template has no content slot', async ({ page }) => {
    await page.goto('?lang=en')
    await page.locator('#builder').scrollIntoViewIfNeeded()
    await page.locator('.builder-editor').fill('<section><header data-wm-drag></header></section>')
    await page.locator('.builder-actions .btn-primary').click()

    await expect(page.locator('.builder-status')).toHaveText(/exactly one/)
  })

  test('a layout chip rewrites the editor and marks itself pressed', async ({ page }) => {
    await page.goto('?lang=en')
    const chips = page.locator('.builder-chip')
    await chips.nth(1).click()
    await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator('.builder-editor')).toHaveValue(/data-side="right"/)
  })
})
