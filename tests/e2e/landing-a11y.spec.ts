import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

async function scan(page: Page): Promise<string[]> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  )
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id} @ ${node.target.join(' ')}`),
  )
}

test.describe('landing accessibility', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile,
    'one engine is enough for a static rule scan',
  )

  test('axe finds no violations with the desktop populated', async ({ page }) => {
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
    await page.click('#launcher button[data-app="layouts"]')
    await page.click('#launcher button[data-app="settings"]')
    await expect(page.locator('[data-testid="window-settings"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('axe finds no violations with a tab group on the desktop', async ({ page }) => {
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
    await page.click('#launcher button[data-app="layouts"]')
    await expect(page.locator('[data-testid="window-layouts"]')).toBeVisible()
    await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'layouts']))
    await expect(page.locator('[data-testid="window-readme"] .win-tab')).toHaveCount(2)
    expect(await scan(page)).toEqual([])
  })

  test('axe finds no violations in russian', async ({ page }) => {
    await page.goto('?lang=ru')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
  })
})
