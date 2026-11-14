import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { openVanilla, spawn, win } from './utils'

const tasks = (page: Page) => page.locator('#all [data-wm-task]')
const names = (page: Page) =>
  tasks(page).evaluateAll((buttons) => buttons.map((button) => button.textContent))
const focused = (page: Page) => page.evaluate(() => window.__wm.getState().focusedId)

async function everyWindow(page: Page): Promise<void> {
  await openVanilla(page)
  await spawn(page)
  await spawn(page)
  await spawn(page)
  await page.evaluate(() => {
    const bar = document.createElement('div')
    bar.id = 'all'
    bar.style.cssText = 'display:flex;gap:6px;padding:8px'
    document.querySelector('#taskbar')?.before(bar)
    window.__wmkit.createTaskbar(window.__wm, bar)
  })
  await expect(tasks(page)).toHaveCount(3)
}

test.describe('a taskbar of every window', () => {
  test.beforeEach(async ({ page }) => {
    await everyWindow(page)
  })

  test('keeps the order of opening and presses the button of the window in focus', async ({
    page,
  }) => {
    expect(await names(page)).toEqual(['Test 1', 'Test 2', 'Test 3'])
    await expect(tasks(page).nth(2)).toHaveAttribute('aria-pressed', 'true')
    await win(page, 't1')
      .locator('[data-wm-drag]')
      .click({ position: { x: 30, y: 8 } })
    expect(await names(page)).toEqual(['Test 1', 'Test 2', 'Test 3'])
    await expect(tasks(page).nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(tasks(page).nth(2)).toHaveAttribute('aria-pressed', 'false')
  })

  test('a click focuses a window in the back, minimizes the one in front and brings it back', async ({
    page,
  }) => {
    await tasks(page).nth(0).click()
    expect(await focused(page)).toBe('t1')
    await tasks(page).nth(0).click()
    await expect(win(page, 't1')).toBeHidden()
    await expect(tasks(page).nth(0)).toHaveAttribute('data-wm-stage', 'minimized')
    await expect(page.locator('#taskbar [data-wm-task="t1"]')).toBeVisible()
    await tasks(page).nth(0).click()
    await expect(win(page, 't1')).toBeVisible()
    expect(await focused(page)).toBe('t1')
    await expect(page.locator('#taskbar [data-wm-task]')).toHaveCount(0)
  })

  test('is one tab stop that the arrows walk and Enter acts on', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'a phone has no Tab key')
    await expect(page.locator('#all [tabindex="0"]')).toHaveCount(1)
    await expect(tasks(page).nth(2)).toHaveAttribute('tabindex', '0')
    await tasks(page).nth(2).focus()
    await page.keyboard.press('ArrowLeft')
    await expect(tasks(page).nth(1)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(tasks(page).nth(0)).toBeFocused()
    expect(await focused(page)).toBe('t3')
    await page.keyboard.press('Enter')
    expect(await focused(page)).toBe('t1')
    await page.keyboard.press('End')
    await page.keyboard.press('Tab')
    await expect(tasks(page).nth(2)).not.toBeFocused()
    expect(
      await page.evaluate(() => document.querySelector('#all')?.contains(document.activeElement)),
    ).toBe(false)
  })

  test('a middle click asks the window to close and a guard may keep it', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'a phone has no middle button')
    await page.evaluate(() => {
      window.__wm.onBeforeClose((asked) => asked.id !== 't2')
    })
    await tasks(page).nth(1).click({ button: 'middle' })
    await tasks(page).nth(0).click({ button: 'middle' })
    await expect(tasks(page)).toHaveCount(2)
    expect(await names(page)).toEqual(['Test 2', 'Test 3'])
    await expect(win(page, 't1')).toHaveCount(0)
  })

  test('shows a tab group as one button with the number of its tabs', async ({ page }) => {
    await page.evaluate(() => {
      window.__wm.group(['t1', 't3'])
      window.__wm.activateTab('t3')
    })
    await expect(tasks(page)).toHaveCount(2)
    await expect(tasks(page).nth(0)).toHaveAttribute('aria-label', 'Test 3, 2 tabs')
    await expect(tasks(page).nth(0).locator('[data-wm-task-count]')).toHaveText('2')
  })

  test('gives axe nothing serious to report', async ({ page }) => {
    await page.evaluate(() => {
      window.__wm.minimize('t2')
      window.__wm.group(['t1', 't3'])
    })
    const results = await new AxeBuilder({ page })
      .include('#all')
      .include('#taskbar')
      .disableRules(['color-contrast'])
      .analyze()
    expect(
      results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => violation.id),
    ).toEqual([])
  })
})

test.describe('<wm-taskbar>', () => {
  test('finds the desktop it was written before, shows what is minimized and brings it back', async ({
    page,
  }) => {
    await page.goto('test/elements.html')
    const bar = page.locator('wm-taskbar')
    await expect(bar).toHaveAttribute('role', 'toolbar')
    await expect(bar.locator('[data-wm-task]')).toHaveCount(0)
    await page.locator('wm-window[window-id="chart"]').locator('[part~=minimize]').click()
    const task = bar.locator('[data-wm-task="chart"]')
    await expect(task).toHaveText('Chart')
    await expect(page.locator('wm-window[window-id="chart"]')).toBeHidden()
    await task.click()
    await expect(page.locator('wm-window[window-id="chart"]')).toBeVisible()
    await expect(bar.locator('[data-wm-task]')).toHaveCount(0)
  })
})
