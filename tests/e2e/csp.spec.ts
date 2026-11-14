import { expect, test } from './fixtures'

test.describe('a page with a strict content security policy', () => {
  test('runs the desktop and every plugin without a single violation', async ({
    page,
    browserName,
  }) => {
    const complaints: string[] = []
    page.on('console', (message) => {
      const text = message.text()
      if (/content security policy|trustedhtml|trusted type/i.test(text)) complaints.push(text)
    })
    page.on('pageerror', (error) => complaints.push(String(error)))
    await page.goto('test/csp.html')
    await expect(page.locator('html')).toHaveAttribute('data-ready', '')
    await expect(page.locator('[data-wm-window="one"]')).toBeVisible()
    await expect(page.locator('#boxed')).toHaveText('written as html')
    await expect(page.locator('wm-window[window-id="sealed-one"]')).toBeVisible()

    const header = page.locator('[data-wm-window="one"] [data-wm-drag]')
    const grab = await header.boundingBox()
    if (!grab) throw new Error('the titlebar has no box')
    await page.mouse.move(grab.x + 30, grab.y + 8)
    await page.mouse.down()
    await page.mouse.move(grab.x + 90, grab.y + 60, { steps: 5 })
    await page.mouse.up()

    await page.evaluate(async () => {
      const { wm, picker, switcher, dock } = window.__csp
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      picker.open('one')
      await frame()
      picker.close()
      switcher.overview()
      await frame()
      switcher.close()
      switcher.open()
      switcher.close()
      wm.snap('one', 'left')
      wm.snap('two', 'right')
      await frame()
      if (document.querySelectorAll('[data-wm-seam]').length !== 1) {
        throw new Error('the separator between two snapped windows is missing')
      }
      wm.minimize('two')
      await new Promise((resolve) => setTimeout(resolve, 400))
      wm.restore('two')
      await new Promise((resolve) => setTimeout(resolve, 400))
      dock.dock('three')
      await frame()
      dock.undock('three')
      wm.maximize('one')
      wm.restore('one')
      await frame()
    })
    await expect(page.locator('[data-wm-devtools]')).toBeVisible()

    expect(await page.evaluate(() => window.__csp.violations)).toEqual([])
    expect(complaints).toEqual([])

    const control = await page.evaluate(async () => {
      const style = document.createElement('style')
      style.textContent = 'body { outline: 0; }'
      document.head.append(style)
      await new Promise((resolve) => setTimeout(resolve, 100))
      const styles = window.__csp.violations.length
      let html = 'no trusted types here'
      if ('trustedTypes' in window) {
        try {
          document.createElement('div').innerHTML = '<b>plain string</b>'
          html = 'a plain string was accepted'
        } catch {
          html = 'a plain string was refused'
        }
      }
      return { styles, html }
    })
    expect(control.styles, 'a style without the nonce is refused').toBeGreaterThan(0)
    if (browserName === 'chromium') expect(control.html).toBe('a plain string was refused')
  })
})
