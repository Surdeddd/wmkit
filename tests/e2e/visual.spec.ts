import { expect, test } from './fixtures'
import { desktopBox, dragTo, handle, openVanilla, settle, spawn, win } from './utils'

test.describe('visual regression', () => {
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

test.describe('every theme, in the page and in a shadow root', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile,
    'chromium desktop only',
  )
  test.use({ viewport: { width: 900, height: 320 } })

  for (const theme of [
    'amber',
    'aqua',
    'blueprint',
    'brutalist',
    'candy',
    'carbon',
    'forest',
    'frost',
    'glass',
    'light',
    'neon',
    'noir',
    'paper',
    'retro',
    'synth',
    'terminal',
  ]) {
    test(`${theme} paints a focused and an unfocused window`, async ({ page }) => {
      await page.goto(`test/themes.html?theme=${theme}`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('#plain [data-wm-window="front"]')).toHaveAttribute(
        'data-wm-focused',
        '',
      )
      await expect(page.locator('wm-window[window-id="front"]')).toHaveAttribute(
        'data-wm-focused',
        '',
      )
      await page.evaluate(() => document.fonts.ready)
      await expect(page).toHaveScreenshot(`theme-${theme}.png`, {
        maxDiffPixels: 150,
        animations: 'disabled',
      })
    })
  }
})
