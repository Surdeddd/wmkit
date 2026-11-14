import { expect, test } from './fixtures'
import { boxOf, dragBy } from './utils'

for (const name of ['preact', 'lit', 'vue', 'solid', 'svelte', 'angular']) {
  test.describe(`${name} adapter`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`test/${name}.html`)
      await expect(page.locator('#btn-open')).toBeVisible()
    })

    test('renders windows from the state and moves focus between them', async ({ page }) => {
      await page.click('#btn-open')
      await page.click('#btn-open')
      await expect(page.getByTestId('window-count')).toHaveText('2')
      const first = page.getByTestId('window-w1')
      const second = page.getByTestId('window-w2')
      await expect(second).toHaveAttribute('data-wm-focused', '')
      await first.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
      await expect(first).toHaveAttribute('data-wm-focused', '')
    })

    test('drags a window and reflects the position through the state', async ({ page }) => {
      await page.click('#btn-open')
      const window = page.getByTestId('window-w1')
      const pos = page.getByTestId('pos-w1')
      const read = async () => (await pos.textContent())?.split(',').map(Number) ?? []
      const [x0 = 0, y0 = 0] = await read()
      const before = await boxOf(window)
      await dragBy(page, window.locator('[data-wm-drag]'), 90, 70)
      const after = await boxOf(window)
      expect(Math.abs(after.x - before.x - 90)).toBeLessThanOrEqual(2)
      expect(Math.abs(after.y - before.y - 70)).toBeLessThanOrEqual(2)
      await expect
        .poll(async () => {
          const [x = 0, y = 0] = await read()
          return Math.max(Math.abs(x - x0 - 90), Math.abs(y - y0 - 70))
        })
        .toBeLessThanOrEqual(2)
    })

    test('minimizes into the taskbar, restores and closes cleanly', async ({ page }) => {
      await page.click('#btn-open')
      await page.click('#btn-open')
      const window = page.getByTestId('window-w1')
      await window.locator('[data-wm-minimize]').click()
      await expect(window).toBeHidden()
      await page.locator('[data-task="w1"]').click()
      await expect(window).toBeVisible()
      await window.locator('[data-wm-close]').click()
      await expect(window).toHaveCount(0)
      await expect(page.getByTestId('window-count')).toHaveText('1')
      const survivor = page.getByTestId('window-w2')
      await expect(survivor).toHaveAttribute('data-wm-window', 'w2')
      const before = await boxOf(survivor)
      await dragBy(page, survivor.locator('[data-wm-drag]'), -30, 40)
      const after = await boxOf(survivor)
      expect(Math.abs(after.x - before.x + 30)).toBeLessThanOrEqual(2)
    })
  })
}

test.describe('svelte adapter with an outro on its windows', () => {
  for (const pause of [0, 60]) {
    test(`shows a window once when it comes back ${pause} ms into its fade`, async ({ page }) => {
      await page.goto('test/svelte.html')
      await page.click('#btn-open')
      const shown = page.locator('[data-wm-window="w1"]')
      await expect(shown).toHaveCount(1)
      await page.evaluate(() => window.__wm.move('w1', 140, 90))

      await page.evaluate(async (wait) => {
        window.__wm.close('w1')
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
        window.__wm.undo()
      }, pause)

      await expect(shown).toHaveCount(1)
      await expect(shown).toBeVisible()
      await expect.poll(() => page.getByTestId('window-w1').count()).toBe(1)
      await expect.poll(() => shown.evaluate((node) => getComputedStyle(node).opacity)).toBe('1')
      const desktop = await boxOf(page.locator('[data-wm-desktop]'))
      const box = await boxOf(shown)
      expect(Math.abs(box.x - desktop.x - 140)).toBeLessThanOrEqual(1)
      expect(Math.abs(box.y - desktop.y - 90)).toBeLessThanOrEqual(1)

      const before = await boxOf(shown)
      await dragBy(page, shown.locator('[data-wm-drag]'), 60, 40)
      const after = await boxOf(shown)
      expect(Math.abs(after.x - before.x - 60)).toBeLessThanOrEqual(2)
    })
  }
})
