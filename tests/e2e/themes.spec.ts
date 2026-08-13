import { expect, type Page, test } from '@playwright/test'

const readme = '[data-testid="window-readme"]'
const CONTROLS = ['[data-wm-close]', '[data-wm-minimize]', '[data-wm-maximize]'] as const

async function targets(page: Page) {
  return page.evaluate((selectors) => {
    const host = document.querySelector('[data-testid="window-readme"]') as HTMLElement
    return selectors.map((selector) => {
      const button = host.querySelector(selector) as HTMLElement
      const boxes = [button.getBoundingClientRect()]
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(button, pseudo)
        if (style.content === 'none' || style.position !== 'absolute') continue
        const insetBlock = Number.parseFloat(style.top)
        const insetInline = Number.parseFloat(style.left)
        const rect = button.getBoundingClientRect()
        boxes.push(
          new DOMRect(
            rect.x + insetInline,
            rect.y + insetBlock,
            rect.width - 2 * insetInline,
            rect.height - 2 * insetBlock,
          ),
        )
      }
      const widest = boxes.reduce((best, box) =>
        box.width * box.height > best.width * best.height ? box : best,
      )
      return { selector, x: widest.x, y: widest.y, width: widest.width, height: widest.height }
    })
  }, CONTROLS)
}

test.describe('theme pointer targets', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for css rules')

  for (const theme of ['glass', 'light', 'retro'] as const) {
    test(`${theme} gives window controls a reachable pointer target`, async ({ page }) => {
      await page.addInitScript((name) => {
        localStorage.setItem('wmkit-theme', name)
      }, theme)
      await page.goto('?lang=en')
      await expect(page.locator(readme)).toBeVisible()
      await expect(page.locator('[data-wm-desktop]')).toHaveAttribute('data-theme', theme)
      await page.waitForFunction(() => document.styleSheets.length > 0)
      await page.waitForTimeout(200)

      const boxes = await targets(page)
      for (const box of boxes) {
        expect(Math.round(box.width), `${theme} ${box.selector} width`).toBeGreaterThanOrEqual(24)
        expect(Math.round(box.height), `${theme} ${box.selector} height`).toBeGreaterThanOrEqual(24)
      }

      const ordered = [...boxes].sort((a, b) => a.x - b.x)
      for (let i = 1; i < ordered.length; i += 1) {
        const previous = ordered[i - 1] as (typeof ordered)[number]
        const current = ordered[i] as (typeof ordered)[number]
        const gap = current.x - (previous.x + previous.width)
        expect(gap, `${theme} targets overlap`).toBeGreaterThanOrEqual(-0.5)
      }
    })
  }
})

test.describe('forced colors', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for css rules')

  test('window controls stay distinguishable in high contrast', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)

    const controls = await page.evaluate((selectors) => {
      const host = document.querySelector('[data-testid="window-readme"]') as HTMLElement
      return selectors.map((selector) => {
        const button = host.querySelector(selector) as HTMLElement
        const rect = button.getBoundingClientRect()
        return {
          glyph: getComputedStyle(button, '::before').content,
          width: rect.width,
          height: rect.height,
        }
      })
    }, CONTROLS)

    expect(new Set(controls.map((control) => control.glyph)).size).toBe(3)
    for (const control of controls) {
      expect(control.glyph).toMatch(/^"\S+"$/)
      expect(control.width).toBeGreaterThanOrEqual(16)
      expect(control.height).toBeGreaterThanOrEqual(14)
    }
  })
})
