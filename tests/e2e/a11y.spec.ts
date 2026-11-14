import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './fixtures'
import { openVanilla, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('axe finds no serious violations with open windows', async ({ page }) => {
  await spawn(page)
  await spawn(page, 'fixed')
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(serious).toEqual([])
})

test('windows expose dialog roles, labels and focusability', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await expect(window).toHaveAttribute('role', 'dialog')
  await expect(window).toHaveAttribute('aria-labelledby', /wmkit-title-t1/)
  await expect(window).toHaveAttribute('tabindex', '-1')
  const controls = ['Minimize', 'Maximize', 'Close']
  for (const label of controls) {
    await expect(window.getByRole('button', { name: label })).toBeVisible()
  }
})

test('reduced motion disables window transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await spawn(page)
  const transition = await win(page, 't1').evaluate((el) => getComputedStyle(el).transitionProperty)
  expect(transition === 'none' || transition === 'all').toBe(true)
})

test('minimized windows are hidden from the accessibility tree', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await window.locator('[data-wm-minimize]').click()
  const hidden = await window.evaluate((el) => (el as HTMLElement).hidden)
  expect(hidden).toBe(true)
})

async function grave(page: import('@playwright/test').Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
    )
}

test.describe('axe through the states of a window', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for the rules')

  test('on the vanilla page', async ({ page }) => {
    await spawn(page)
    await spawn(page)
    await spawn(page, 'fixed')
    expect(await grave(page), 'three normal windows').toEqual([])

    await page.evaluate(() => window.__wm.maximize('fixed'))
    expect(await grave(page), 'one maximized').toEqual([])

    await page.evaluate(() => {
      window.__wm.restore('fixed')
      window.__wm.minimize('fixed')
    })
    await expect(page.locator('[data-wm-task="fixed"]')).toBeVisible()
    expect(await grave(page), 'one minimized into the taskbar').toEqual([])

    await page.evaluate(() => window.__wm.group(['t1', 't2']))
    expect(await grave(page), 'two windows in a tab group').toEqual([])

    await spawn(page, 'modal')
    expect(await grave(page), 'a modal over the rest').toEqual([])

    await page.evaluate(() => window.__wm.snap('t1', 'left'))
    expect(await grave(page), 'a snapped tab group under the modal').toEqual([])
  })

  test('on the web components page', async ({ page }) => {
    await page.goto('test/elements.html')
    await expect(page.locator('wm-window[window-id="notes"]')).toBeVisible()
    expect(await grave(page), 'two windows and a closed one').toEqual([])

    await page.evaluate(() => {
      const desktop = document.querySelector('wm-desktop') as HTMLElement & {
        manager: typeof window.__wm
      }
      desktop.manager.group(['notes', 'chart'])
    })
    await expect(page.locator('wm-window[window-id="notes"]')).toHaveAttribute('data-wm-group')
    expect(await grave(page), 'a tab strip in the titlebar').toEqual([])

    await page.evaluate(() => {
      const desktop = document.querySelector('wm-desktop') as HTMLElement & {
        manager: typeof window.__wm
      }
      desktop.manager.maximize('chart')
      document.querySelector('wm-window[window-id="later"]')?.removeAttribute('closed')
      desktop.manager.update('later', { layer: 'modal' })
    })
    expect(await grave(page), 'maximized tabs under a modal').toEqual([])
  })

  test('on the dock page', async ({ page }) => {
    await page.goto('test/dock.html')
    await expect(page.locator('[data-wm-sash]').first()).toBeVisible()
    expect(await grave(page), 'two panels, a separator and two floating windows').toEqual([])

    await page.evaluate(() => {
      const held = (
        window as unknown as { __dock: { dock: { dock(id: string, to: object): void } } }
      ).__dock
      const stack = document.querySelector('[data-wm-docked]') as HTMLElement
      held.dock.dock('preview', { side: 'bottom' })
      held.dock.dock('terminal', { side: 'center', stackId: stack.dataset.wmWindow })
    })
    expect(await grave(page), 'three panels, one of them tabbed').toEqual([])
  })

  test('on the dashboard', async ({ page }) => {
    await page.goto('test/dashboard/')
    await expect(page.locator('wm-window[window-id="chart"]')).toBeVisible()
    expect(await grave(page), 'the default layout').toEqual([])
    await page.locator('#float').click()
    await page.evaluate(() => {
      const held = (window as unknown as { __dashboard: { dock: { undock(id: string): void } } })
        .__dashboard
      held.dock.undock('log')
    })
    expect(await grave(page), 'one panel floating').toEqual([])
  })

  for (const name of ['react', 'preact', 'lit', 'vue', 'solid', 'svelte', 'angular']) {
    test(`on the ${name} page`, async ({ page }) => {
      await page.goto(`test/${name}.html`)
      await page.click('#btn-open')
      await page.click('#btn-open')
      await expect(page.getByTestId('window-count')).toHaveText('2')
      expect(await grave(page), 'two windows').toEqual([])
      await page.locator('[data-wm-window] [data-wm-minimize]').last().click()
      await expect(page.locator('[data-task]')).toHaveCount(1)
      await page.locator('[data-wm-window]:not([hidden]) [data-wm-maximize]').click()
      expect(await grave(page), 'one minimized, one maximized').toEqual([])
    })
  }
})
