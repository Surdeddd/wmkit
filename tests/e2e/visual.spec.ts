import { expect, test } from '@playwright/test'
import { desktopBox, dragTo, handle, openVanilla, settle, spawn, win } from './utils'

test.describe('visual regression', () => {
  test.skip(!!process.env.CI, 'linux baselines are not generated yet')
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile,
    'chromium desktop only',
  )

  test('glass window at rest and focused', async ({ page }) => {
    await openVanilla(page)
    await spawn(page, 'fixed')
    const window = win(page, 'fixed')
    await settle(window)
    await expect(window).toHaveScreenshot('window-glass.png', { maxDiffPixelRatio: 0.03 })
  })

  test('snapped half layout with preview gone', async ({ page }) => {
    await openVanilla(page)
    await spawn(page, 'fixed')
    const desktop = await desktopBox(page)
    await dragTo(page, handle(page, 'fixed'), desktop.x + 4, desktop.y + desktop.height / 2)
    await expect(win(page, 'fixed')).toHaveAttribute('data-wm-stage', 'snapped')
    await settle(win(page, 'fixed'))
    await expect(page.locator('#desktop')).toHaveScreenshot('desktop-snapped.png', {
      maxDiffPixelRatio: 0.03,
    })
  })
})
