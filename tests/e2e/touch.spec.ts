import type { CDPSession, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const readme = '[data-testid="window-readme"]'

interface Finger {
  x: number
  y: number
}

type TouchPhase = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel'

async function touch(cdp: CDPSession, type: TouchPhase, points: Finger[]): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((point, index) => ({ x: point.x, y: point.y, id: index + 1 })),
  })
}

async function boundsOf(page: Page, id: string) {
  return page.evaluate((target) => window.__wmDemo.wm.get(target)?.bounds, id)
}

async function settle(page: Page): Promise<void> {
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
}

test.describe('touch input', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || !isMobile,
    'real touch needs a touch-enabled chromium context',
  )

  test('a finger on the titlebar drags the window', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page)
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()

    const before = await boundsOf(page, 'readme')
    const box = await page.locator(`${readme} [data-wm-drag]`).boundingBox()
    const start = { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + 12 }

    await touch(cdp, 'touchStart', [start])
    for (let step = 1; step <= 6; step += 1) {
      await touch(cdp, 'touchMove', [{ x: start.x - step * 8, y: start.y + step * 8 }])
    }
    await touch(cdp, 'touchEnd', [])

    const after = await boundsOf(page, 'readme')
    expect(after?.y, 'the window never followed the finger').toBeGreaterThan(before?.y ?? 0)
    await expect(page.locator(readme)).not.toHaveAttribute('data-wm-dragging', '')
  })

  test('a second finger does not hijack a drag in flight', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page)
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()
    await page.click('#launcher button[data-app="layouts"]')
    const other = page.locator('[data-testid="window-layouts"]')
    await expect(other).toBeVisible()

    await page.evaluate(() => {
      const wm = window.__wmDemo.wm
      wm.restoreTo('readme', { x: 8, y: 8, width: 260, height: 130 })
      wm.restoreTo('layouts', { x: 8, y: 220, width: 260, height: 130 })
    })
    await settle(page)

    const readmeBox = await page.locator(`${readme} [data-wm-drag]`).boundingBox()
    const otherBox = await other.locator('[data-wm-drag]').boundingBox()
    const first = {
      x: (readmeBox?.x ?? 0) + (readmeBox?.width ?? 0) / 2,
      y: (readmeBox?.y ?? 0) + 12,
    }
    const second = {
      x: (otherBox?.x ?? 0) + (otherBox?.width ?? 0) / 2,
      y: (otherBox?.y ?? 0) + 12,
    }
    const otherBefore = await boundsOf(page, 'layouts')

    await touch(cdp, 'touchStart', [first])
    await touch(cdp, 'touchMove', [{ x: first.x, y: first.y + 20 }])
    await touch(cdp, 'touchStart', [{ x: first.x, y: first.y + 20 }, second])
    await touch(cdp, 'touchMove', [
      { x: first.x, y: first.y + 40 },
      { x: second.x + 60, y: second.y + 60 },
    ])
    await touch(cdp, 'touchEnd', [])

    const otherAfter = await boundsOf(page, 'layouts')
    expect(otherAfter, 'the second finger moved a window it never grabbed').toEqual(otherBefore)
  })

  test('a tap on a control still works as a tap', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page)
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()

    const box = await page.locator(`${readme} [data-wm-minimize]`).boundingBox()
    const point = {
      x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
      y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
    }

    await touch(cdp, 'touchStart', [point])
    await touch(cdp, 'touchEnd', [])

    await expect(page.locator(readme)).toBeHidden()
  })

  test('the context menu a long press raises reaches the titlebar hook', async ({ page }) => {
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()
    await page.click('#launcher button[data-app="layouts"]')
    await expect(page.locator('[data-testid="window-layouts"]')).toBeVisible()
    await settle(page)

    expect(await page.evaluate(() => window.__wmDemo.wm.getState().order.at(-1))).toBe('layouts')

    const defaultPrevented = await page.evaluate(() => {
      const handle = document.querySelector(
        '[data-testid="window-layouts"] [data-wm-drag]',
      ) as HTMLElement
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      handle.dispatchEvent(event)
      return event.defaultPrevented
    })

    expect(defaultPrevented, 'the browser menu should be suppressed').toBe(true)
    expect(
      await page.evaluate(() => window.__wmDemo.wm.getState().order.at(-1)),
      'the hook never ran',
    ).not.toBe('layouts')
  })

  test('a finger on the edge resizes instead of scrolling the page', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page)
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()

    const before = await boundsOf(page, 'readme')
    const grip = await page.locator(`${readme} [data-wm-resize="se"]`).boundingBox()
    const start = {
      x: (grip?.x ?? 0) + (grip?.width ?? 0) / 2,
      y: (grip?.y ?? 0) + (grip?.height ?? 0) / 2,
    }

    await touch(cdp, 'touchStart', [start])
    for (let step = 1; step <= 4; step += 1) {
      await touch(cdp, 'touchMove', [{ x: start.x + step * 10, y: start.y + step * 10 }])
    }
    await touch(cdp, 'touchEnd', [])

    const after = await boundsOf(page, 'readme')
    expect(after?.width, 'the edge never resized under a finger').toBeGreaterThan(
      before?.width ?? 0,
    )
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})
