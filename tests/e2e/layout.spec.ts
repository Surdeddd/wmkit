import { expect, type Page, test } from '@playwright/test'

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
]

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function overlap(a: Box, b: Box): number {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return x > 0 && y > 0 ? x * y : 0
}

async function boxes(page: Page) {
  return page.evaluate(() => {
    const pick = (el: Element | null) => {
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }
    return {
      wordmark: pick(document.querySelector('.wordmark')),
      lede: pick(document.querySelector('.lede')),
      actions: pick(document.querySelector('.wall-actions')),
      windows: [...document.querySelectorAll('[data-wm-window]:not([hidden])')].map(
        (el) => pick(el) as { x: number; y: number; width: number; height: number },
      ),
    }
  })
}

for (const size of SIZES) {
  test(`the hero stays clear of the demo windows on ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()

    const found = await boxes(page)
    expect(found.windows.length).toBeGreaterThan(0)
    for (const key of ['wordmark', 'lede', 'actions'] as const) {
      const copy = found[key]
      expect(copy, `${key} missing`).not.toBeNull()
      for (const win of found.windows) {
        expect(overlap(copy as Box, win), `${key} covered on ${size.name}`).toBe(0)
      }
    }
  })

  test(`the boot windows do not pile up on ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()

    const { windows } = await boxes(page)
    for (let i = 0; i < windows.length; i += 1) {
      for (let j = i + 1; j < windows.length; j += 1) {
        expect(
          overlap(windows[i] as Box, windows[j] as Box),
          `windows ${i} and ${j} overlap on ${size.name}`,
        ).toBe(0)
      }
    }
  })

  test(`the desktop fills its stage on ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('?lang=en')
    await expect(page.locator('[data-testid="window-readme"]')).toBeVisible()

    const { windows } = await boxes(page)
    const stage = await page.locator('#desktop').boundingBox()
    const bottom = Math.max(...windows.map((win) => win.y + win.height))
    const slack = (stage?.y ?? 0) + (stage?.height ?? 0) - bottom
    expect(slack, `dead space below the windows on ${size.name}`).toBeLessThanOrEqual(56)
    for (const win of windows) {
      expect(win.x).toBeGreaterThanOrEqual((stage?.x ?? 0) - 1)
      expect(win.x + win.width).toBeLessThanOrEqual((stage?.x ?? 0) + (stage?.width ?? 0) + 1)
    }
  })
}
