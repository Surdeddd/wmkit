import { expect, type Page, test } from './fixtures'
import { closeAllBut, dragBy, settle } from './utils'

const win = (page: Page, id: string) => page.locator(`[data-testid="window-${id}"]`)
const task = (page: Page, id: string) => page.locator(`#dock [data-wm-task="${id}"]`)
const order = (page: Page) => page.evaluate(() => window.__wmDemo.wm.getState().order)
const stageOf = (page: Page, id: string) =>
  page.evaluate((id) => window.__wmDemo.wm.get(id)?.stage ?? null, id)

async function show(page: Page, step: string): Promise<void> {
  await page.evaluate(() => window.__wmDemo.open('tour'))
  await page.locator(`[data-tour="${step}"]`).click()
}

async function pick(page: Page, action: string): Promise<void> {
  const item = page.locator(`#menus [data-action="${action}"]`)
  await item.locator('xpath=ancestor::div[@class="menu"]/button[@class="menu-trigger"]').click()
  await item.click()
}

test.use({ viewport: { width: 1600, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.goto('?lang=en')
  await expect(win(page, 'readme')).toBeVisible()
  await settle(win(page, 'readme'))
})

test('the taskbar lists every window, marks the one in focus and minimizes or restores by a click', async ({
  page,
}) => {
  await expect(page.locator('#dock [data-wm-task]')).toHaveCount((await order(page)).length)
  await page.evaluate(() => window.__wmDemo.wm.focus('readme'))
  await expect(task(page, 'readme')).toHaveAttribute('data-wm-focused', '')
  await expect(task(page, 'readme')).toHaveAttribute('aria-pressed', 'true')
  await expect(task(page, 'terminal')).toHaveAttribute('aria-pressed', 'false')

  await task(page, 'readme').click()
  await expect(task(page, 'readme')).toHaveAttribute('data-wm-stage', 'minimized')
  await expect(win(page, 'readme')).toBeHidden()
  await task(page, 'readme').click()
  await expect(win(page, 'readme')).toBeVisible()
  expect(await stageOf(page, 'readme')).toBe('normal')
  await expect(page.locator('#dock')).toHaveAttribute('role', 'toolbar')
})

test('the tour opens the overview and the layout menu on the live desktop', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'the tour buttons need room beside the windows')
  await show(page, 'overview')
  await expect(page.locator('[data-wm-switcher="overview"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-wm-switcher]')).toBeHidden()

  await show(page, 'switcher')
  await expect(page.locator('[data-wm-switcher="list"]')).toBeVisible()
  await page.keyboard.press('Escape')

  await show(page, 'layouts')
  await expect(page.locator('[data-wm-layouts]')).toBeVisible()
  await page.locator('[data-wm-layout-cell]').first().click()
  await expect(page.locator('[data-wm-layouts]')).toBeHidden()
  expect((await order(page)).length).toBeGreaterThan(1)
})

test('the tour links two snapped windows, groups them into tabs and takes a step back', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'the tour buttons need room beside the windows')
  await show(page, 'seams')
  await expect(page.locator('[data-wm-seam]')).toHaveCount(1)
  expect([await stageOf(page, 'readme'), await stageOf(page, 'terminal')]).toEqual([
    'snapped',
    'snapped',
  ])
  await expect(page.locator('#desktop')).toHaveAttribute('data-covered', '')
  await expect(page.locator('.wallpaper')).toBeHidden()
  const width = () => page.evaluate(() => window.__wmDemo.wm.get('readme')?.bounds.width ?? 0)
  const before = await width()
  await dragBy(page, page.locator('[data-wm-seam]'), 64, 0)
  expect(Math.abs((await width()) - before - 64)).toBeLessThanOrEqual(2)

  await show(page, 'tabs')
  const grouped = await page.evaluate(() => {
    const { wm } = window.__wmDemo
    return [wm.get('readme')?.groupId, wm.get('terminal')?.groupId]
  })
  expect(grouped[0]).toBeTruthy()
  expect(grouped[0]).toBe(grouped[1])

  await show(page, 'undo')
  expect(await page.evaluate(() => window.__wmDemo.wm.get('readme')?.groupId ?? null)).toBeNull()
})

test('a note with unsaved text asks in a modal window before it closes', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'the tour buttons need room beside the windows')
  await show(page, 'guard')
  const dialog = win(page, 'confirm')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('data-wm-layer', 'modal')
  await expect(dialog.locator('[data-answer="keep"]')).toBeFocused()
  await dialog.locator('[data-answer="keep"]').click()
  await expect(dialog).toBeHidden()
  await expect(win(page, 'notes')).toBeVisible()

  await win(page, 'notes').locator('[data-wm-close]').click()
  await expect(dialog).toBeVisible()
  await dialog.locator('[data-wm-close]').click()
  await expect(dialog).toBeHidden()
  await expect(win(page, 'notes')).toBeVisible()

  await win(page, 'notes').locator('[data-wm-close]').click()
  await dialog.locator('[data-answer="discard"]').click()
  await expect(win(page, 'notes')).toBeHidden()
  expect(await order(page)).not.toContain('confirm')

  await page.evaluate(() => window.__wmDemo.open('notes'))
  await win(page, 'notes').locator('textarea').fill('kept')
  await win(page, 'notes').locator('[data-notes="save"]').click()
  await win(page, 'notes').locator('[data-wm-close]').click()
  await expect(win(page, 'notes')).toBeHidden()
  await expect(dialog).toBeHidden()
})

test('the scenes build a docked studio and a tiled board, and the clean desk comes back', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'a scene needs a desktop wide enough for its panels')
  await page.evaluate(() => window.__wmDemo.open('tour'))
  await pick(page, 'sceneStudio')
  await expect(page.locator('[data-wm-docked]')).toHaveCount(3)
  await expect(page.locator('[data-wm-sash]')).toHaveCount(2)
  await expect(win(page, 'tour')).toBeVisible()
  const share = await page.evaluate(() => {
    const { wm } = window.__wmDemo
    const code = wm.get('code')?.bounds.width ?? 0
    return code / wm.getState().viewport.width
  })
  expect(share).toBeGreaterThan(0.6)
  const height = () => page.evaluate(() => window.__wmDemo.wm.get('terminal')?.bounds.height ?? 0)
  await settle(win(page, 'terminal'))
  const tall = await height()
  await dragBy(page, page.locator('[data-wm-sash][aria-orientation="horizontal"]'), 0, -48)
  expect((await height()) - tall).toBeGreaterThan(30)

  await pick(page, 'sceneBoard')
  await expect(page.locator('[data-wm-docked]')).toHaveCount(0)
  await expect(page.locator('[data-wm-seam]')).toHaveCount(4)
  expect(await order(page)).toEqual(
    expect.arrayContaining(['inspector', 'layouts', 'terminal', 'bench', 'tour']),
  )

  await pick(page, 'sceneClean')
  await expect(page.locator('[data-wm-seam]')).toHaveCount(0)
  await expect(win(page, 'readme')).toBeVisible()
  await expect(page.locator('#desktop')).not.toHaveAttribute('data-covered')
  await expect(page.locator('.wallpaper')).toBeVisible()
})

test('the grid setting lands a dragged window on a sixteen pixel step', async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, 'the drag is done with a mouse')
  await page.evaluate(() => window.__wmDemo.open('settings'))
  const row = win(page, 'settings').locator('[data-option="grid"]')
  await row.locator('button').first().dispatchEvent('click')
  await expect(row.locator('button').first()).toHaveAttribute('aria-pressed', 'true')
  await closeAllBut(page, 'readme')
  await settle(win(page, 'readme'))

  await dragBy(page, win(page, 'readme').locator('[data-wm-drag]'), 53, 47)
  const at = await page.evaluate(() => window.__wmDemo.wm.get('readme')?.bounds)
  expect([(at?.x ?? 1) % 16, (at?.y ?? 1) % 16]).toEqual([0, 0])
})

test('with sync on, a second tab joins the same desktop and follows it', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!!isMobile, 'one engine and one size are enough for the channel')
  await page.evaluate(() => window.__wmDemo.open('settings'))
  await win(page, 'settings').locator('[data-option="sync"] button').first().click()
  await page.evaluate(() => {
    const { wm } = window.__wmDemo
    wm.close('settings')
    wm.open({ id: 'shared', title: 'shared' })
  })

  const second = await context.newPage()
  await second.goto('?lang=en')
  await expect(second.locator('[data-testid="window-shared"]')).toBeVisible()
  await second.evaluate(() => window.__wmDemo.wm.close('shared'))
  await expect(win(page, 'shared')).toBeHidden()
  expect(await order(page)).not.toContain('shared')
  await second.close()
})

test('the theme button in the menubar steps through the themes and names the current one', async ({
  page,
}) => {
  const chip = page.locator('#theme-chip')
  await expect(chip).toHaveText('glass')
  await expect(chip).toHaveAttribute('aria-label', 'Next theme')
  await chip.click()
  await expect(chip).toHaveText('light')
  await expect(page.locator('#desktop')).toHaveAttribute('data-theme', 'light')
  await chip.click({ modifiers: ['Shift'] })
  await expect(chip).toHaveText('glass')
  await expect(page.locator('#desktop')).toHaveAttribute('data-theme', 'glass')
})

test('the taskbar and the menus speak Russian on the Russian page', async ({ page }) => {
  await page.goto('?lang=ru')
  await expect(win(page, 'readme')).toBeVisible()
  await expect(task(page, 'readme')).toContainText('читай.md')
  await expect(page.locator('#menus .menu-trigger')).toContainText([
    'Окно',
    'Правка',
    'Сцены',
    'Помощь',
  ])
  await page.evaluate(() => window.__wmDemo.open('tour'))
  await expect(win(page, 'tour').locator('[data-tour="overview"]')).toHaveAttribute(
    'aria-label',
    'показать: Обзор',
  )
})
