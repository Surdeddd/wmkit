import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { boxOf, desktopBox, openVanilla, spawn, win } from './utils'

const menu = (page: Page) => page.locator('[data-wm-layouts]')
const areas = (page: Page) => menu(page).locator('[data-wm-layout-cell]')
const bounds = (page: Page, id: string) => page.evaluate((id) => window.__wm.get(id)?.bounds, id)

async function withLayouts(page: Page): Promise<void> {
  await openVanilla(page)
  await spawn(page, 'fixed')
  await page.evaluate(() => {
    window.__wmkit.createLayoutPicker(window.__desktop, { hover: 150 })
    window.__wmkit.linkSnapped(window.__desktop)
  })
  await expect(menu(page)).toBeHidden()
}

test.describe('a layout picker', () => {
  test.beforeEach(async ({ page }) => {
    await withLayouts(page)
  })

  test('opens under the maximize button a mouse rests on, and an area snaps the window', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'a phone has no pointer that rests')
    const button = win(page, 'fixed').locator('[data-wm-maximize]')
    const anchor = await boxOf(button)
    await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2)
    await expect(menu(page)).toBeVisible()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    const panel = await boxOf(menu(page))
    const desk = await desktopBox(page)
    expect(panel.y).toBeGreaterThanOrEqual(anchor.y + anchor.height)
    expect(panel.x).toBeGreaterThanOrEqual(desk.x - 1)
    expect(panel.x + panel.width).toBeLessThanOrEqual(desk.x + desk.width + 1)

    await areas(page).nth(1).click()
    await expect(menu(page)).toBeHidden()
    const viewport = await page.evaluate(() => window.__wm.getState().viewport)
    expect(await bounds(page, 'fixed')).toEqual({
      x: Math.round(viewport.width / 2),
      y: 0,
      width: viewport.width - Math.round(viewport.width / 2),
      height: viewport.height,
    })
    await expect(win(page, 'fixed')).toHaveAttribute('data-wm-stage', 'snapped')
  })

  test('goes away when the mouse leaves the button and the menu', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'a phone has no pointer that rests')
    const anchor = await boxOf(win(page, 'fixed').locator('[data-wm-maximize]'))
    await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2)
    await expect(menu(page)).toBeVisible()
    const desk = await desktopBox(page)
    await page.mouse.move(desk.x + desk.width - 20, desk.y + desk.height - 20, { steps: 4 })
    await expect(menu(page)).toBeHidden()
  })

  test('opens from the keyboard, walks with the arrows, chooses with Enter and closes with Escape', async ({
    page,
    isMobile,
  }) => {
    test.skip(!!isMobile, 'a phone has no keyboard')
    await win(page, 'fixed')
      .locator('[data-wm-drag]')
      .click({ position: { x: 30, y: 8 } })
    await page.keyboard.press('Control+Alt+KeyL')
    await expect(areas(page).nth(0)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu(page)).toBeHidden()
    await expect(win(page, 'fixed')).toBeFocused()

    await page.keyboard.press('Control+Alt+KeyL')
    await page.keyboard.press('ArrowRight')
    await expect(areas(page).nth(1)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(menu(page)).toBeHidden()
    await expect(win(page, 'fixed')).toHaveAttribute('data-wm-stage', 'snapped')
    await expect(win(page, 'fixed')).toBeFocused()
    const viewport = await page.evaluate(() => window.__wm.getState().viewport)
    expect((await bounds(page, 'fixed'))?.x).toBe(Math.round(viewport.width / 2))
  })

  test('opens from the context menu of the maximize button', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'a phone has no right button')
    await win(page, 'fixed').locator('[data-wm-maximize]').click({ button: 'right' })
    await expect(menu(page)).toBeVisible()
    await expect(areas(page).nth(0)).toBeFocused()
  })

  test('gives axe nothing serious to report while it is open', async ({ page }) => {
    expect(await page.evaluate(() => window.__wm.getState().focusedId)).toBe('fixed')
    await page.evaluate(() => {
      const picker = document.querySelector('[data-wm-layouts]') as HTMLElement
      picker.hidden = false
    })
    const results = await new AxeBuilder({ page })
      .include('[data-wm-layouts]')
      .disableRules(['color-contrast'])
      .analyze()
    expect(
      results.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map((violation) => violation.id),
    ).toEqual([])
  })
})

test.describe('snapped neighbours', () => {
  test.beforeEach(async ({ page }) => {
    await withLayouts(page)
    await spawn(page)
    await page.evaluate(() => {
      window.__wm.snap('fixed', 'left')
      window.__wm.snap('t1', 'right')
    })
    await expect(page.locator('[data-wm-seam]')).toHaveCount(1)
  })

  test('resize together when the separator between them is dragged, and one undo takes it back', async ({
    page,
  }) => {
    const before = [await bounds(page, 'fixed'), await bounds(page, 't1')]
    const by = (page.viewportSize()?.width ?? 0) < 500 ? 30 : 60
    const seam = await boxOf(page.locator('[data-wm-seam]'))
    const [x, y] = [seam.x + seam.width / 2, seam.y + seam.height / 2]
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + by, y + 10, { steps: 6 })
    await page.mouse.up()
    await expect
      .poll(async () => (await bounds(page, 'fixed'))?.width)
      .toBe((before[0]?.width ?? 0) + by)
    const after = await bounds(page, 't1')
    expect(after?.x).toBe((before[1]?.x ?? 0) + by)
    expect(after?.width).toBe((before[1]?.width ?? 0) - by)
    await expect(page.locator('[data-wm-seam]')).not.toHaveAttribute('data-wm-active', '')

    await page.evaluate(() => window.__wm.undo())
    expect([await bounds(page, 'fixed'), await bounds(page, 't1')]).toEqual(before)
  })

  test('resize together from the keyboard', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'a phone has no keyboard')
    const before = await bounds(page, 'fixed')
    await page.locator('[data-wm-seam]').focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    expect((await bounds(page, 'fixed'))?.width).toBe((before?.width ?? 0) - 32)
    await expect(page.locator('[data-wm-seam]')).toBeFocused()
    await expect(page.locator('[data-wm-seam]')).toHaveAttribute('role', 'separator')
  })
})
