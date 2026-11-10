import { expect, test } from './fixtures'
import { boxOf, openVanilla, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('arrow keys move the focused window', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await window.focus()
  const before = await boxOf(window)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  const after = await boxOf(window)
  expect(Math.round(after.x - before.x)).toBe(16)
  expect(Math.round(after.y - before.y)).toBe(16)
})

test('alt slows keyboard movement down to a single pixel', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await window.focus()
  const before = await boxOf(window)
  await page.keyboard.press('Alt+ArrowRight')
  const after = await boxOf(window)
  expect(Math.round(after.x - before.x)).toBe(1)
})

test('shift plus arrows resizes the focused window', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await window.focus()
  const before = await boxOf(window)
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  const after = await boxOf(window)
  expect(Math.round(after.width - before.width)).toBe(16)
  expect(Math.round(after.height - before.height)).toBe(16)
})

test('typing inside window content does not move the window', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  const before = await boxOf(window)
  const input = window.locator('input')
  await input.click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowLeft')
  const after = await boxOf(window)
  expect(Math.round(after.x)).toBe(Math.round(before.x))
})

test('F6 cycles focus across windows', async ({ page }) => {
  await spawn(page)
  await spawn(page)
  await spawn(page)
  const third = win(page, 't3')
  await expect(third).toHaveAttribute('data-wm-focused', '')
  await third.focus()
  await page.keyboard.press('F6')
  await expect(win(page, 't1')).toHaveAttribute('data-wm-focused', '')
  await page.keyboard.press('Shift+F6')
  await expect(win(page, 't3')).toHaveAttribute('data-wm-focused', '')
})

test('ctrl or cmd with alt and page down or up switches tabs of the focused group', async ({
  page,
}) => {
  await spawn(page)
  await spawn(page)
  await spawn(page)
  const active = () =>
    page.evaluate(() => {
      const state = window.__wm.getState()
      const groupId = state.windows.t1?.groupId ?? ''
      return state.groups[groupId]?.activeId
    })
  await page.evaluate(() => {
    window.__wm.group(['t1', 't2', 't3'])
    window.__wm.activateTab('t1')
  })
  await expect(win(page, 't1')).toBeVisible()
  await win(page, 't1').focus()

  await page.keyboard.press('Control+Alt+PageDown')
  await expect.poll(active).toBe('t2')
  await expect(win(page, 't2')).toBeVisible()
  await expect(win(page, 't1')).toBeHidden()

  await win(page, 't2').focus()
  await page.keyboard.press('Meta+Alt+PageDown')
  await expect.poll(active).toBe('t3')

  await win(page, 't3').focus()
  await page.keyboard.press('Control+Alt+PageUp')
  await expect.poll(active).toBe('t2')
  await expect(win(page, 't2')).toBeVisible()
})

test('holding an arrow key moves the window in one undo step', async ({ page }) => {
  await spawn(page, 'fixed')
  await win(page, 'fixed').focus()
  const x = () => page.evaluate(() => window.__wm.get('fixed')?.bounds.x)
  await page.evaluate(() => window.__wm.clearHistory())
  const before = await x()

  for (let i = 0; i < 8; i += 1) await page.keyboard.down('ArrowRight')
  await page.keyboard.up('ArrowRight')
  expect(await x()).toBe((before as number) + 8 * 16)

  await page.keyboard.down('Shift')
  for (let i = 0; i < 5; i += 1) await page.keyboard.down('ArrowDown')
  await page.keyboard.up('ArrowDown')
  await page.keyboard.up('Shift')

  expect(await page.evaluate(() => window.__wm.undo())).toBe(true)
  expect(await page.evaluate(() => window.__wm.get('fixed')?.bounds.height)).toBe(220)
  expect(await x()).toBe((before as number) + 8 * 16)
  expect(await page.evaluate(() => window.__wm.undo())).toBe(true)
  expect(await x()).toBe(before)
  expect(await page.evaluate(() => window.__wm.canUndo())).toBe(false)
})

test('undo typed into a field inside a window stays with the field', async ({ page }) => {
  await spawn(page)
  const target = win(page, 't1')
  await page.evaluate(() => window.__wm.move('t1', 140, 90))
  const input = target.locator('input')
  await input.click()
  await input.pressSequentially('abc')

  await page.keyboard.press('Control+z')
  await page.keyboard.press('Meta+z')
  expect(await page.evaluate(() => window.__wm.get('t1')?.bounds)).toMatchObject({ x: 140, y: 90 })
  expect(await page.evaluate(() => window.__wm.canUndo())).toBe(true)

  await target.focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(() => page.evaluate(() => window.__wm.get('t1')?.bounds.x)).not.toBe(140)
})

test('tab is trapped inside a modal window', async ({ page }) => {
  await spawn(page)
  await spawn(page, 'modal')
  const modal = win(page, 'modal2')
  await modal.locator('input').click()
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab')
    const inside = await modal.evaluate((el) => el.contains(el.ownerDocument.activeElement))
    expect(inside).toBe(true)
  }
})
