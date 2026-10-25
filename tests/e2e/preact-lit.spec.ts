import { expect, test } from './fixtures'
import { boxOf, dragBy } from './utils'

for (const name of ['preact', 'lit']) {
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
