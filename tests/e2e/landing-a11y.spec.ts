import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from './fixtures'
import { launchApp } from './utils'

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
    await launchApp(page, 'layouts')
    await launchApp(page, 'settings')
    await expect(page.locator('[data-testid="window-settings"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('axe finds no violations with a tab group on the desktop', async ({ page }) => {
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
    await launchApp(page, 'layouts')
    await expect(page.locator('[data-testid="window-layouts"]')).toBeVisible()
    await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'layouts']))
    await expect(page.locator('[data-testid="window-readme"] .win-tab')).toHaveCount(2)
    expect(await scan(page)).toEqual([])
  })

  test('axe finds no violations with a file list, its windows and the activity window open', async ({
    page,
  }) => {
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
    await page.evaluate(() => {
      window.__wmDemo.open('monitor')
      window.__wmDemo.open('files')
    })
    const files = page.locator('[data-testid="window-files"]')
    await files.locator('[data-file="README.md"]').dispatchEvent('dblclick')
    await expect(page.locator('[data-testid="window-file:README.md"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
    await files.locator('[data-file="LICENSE"]').dispatchEvent('click')
    await files.locator('[data-files="info"]').dispatchEvent('click')
    await expect(page.locator('[data-testid="window-file-info"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('axe finds no violations on a phone, with the menu sheet and the app drawer open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 664 })
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
    await page.locator('#menu-toggle').click()
    await expect(page.locator('#menus')).toBeVisible()
    expect(await scan(page)).toEqual([])
    await page.locator('#menu-toggle').click()
    await page.locator('#apps-toggle').click()
    await expect(page.locator('#launcher')).toBeVisible()
    expect(await scan(page)).toEqual([])
    await page.locator('#apps-toggle').click()
    await page.locator('#wall-launch').click()
    await expect(page.locator('[data-testid="window-tour"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('axe finds no violations in russian', async ({ page }) => {
    await page.goto('?lang=ru')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()
    expect(await scan(page)).toEqual([])
  })
})
