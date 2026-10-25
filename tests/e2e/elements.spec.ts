import { expect, type Page, test } from './fixtures'
import { boxOf, dragBy } from './utils'

const element = (page: Page, id: string) => page.locator(`wm-window[window-id="${id}"]`)
const bar = (page: Page, id: string) => element(page, id).locator('[part=titlebar]')
const state = (page: Page, id: string) =>
  page.evaluate((id) => {
    const desktop = document.querySelector('wm-desktop') as HTMLElement & {
      manager: { get(id: string): unknown }
    }
    return desktop.manager.get(id) as { stage: string; bounds: { x: number } } | undefined
  }, id)

test.beforeEach(async ({ page }) => {
  await page.goto('test/elements.html')
  await expect(element(page, 'notes')).toHaveAttribute('data-wm-window', 'notes')
})

test('windows declared in markup open where their attributes say', async ({ page }) => {
  await expect(element(page, 'notes')).toBeVisible()
  await expect(element(page, 'later')).toBeHidden()
  await expect(element(page, 'notes').locator('[part=title]')).toHaveText('Notes')
  await expect(page.locator('#notes-field')).toBeVisible()
  await expect(page.locator('#refresh')).toBeVisible()
})

test('a window drags by its shadow titlebar and resizes by its grips', async ({ page }) => {
  const before = await boxOf(element(page, 'notes'))
  await dragBy(page, bar(page, 'notes').locator('[part=title]'), 80, 50, { steps: 10 })
  const moved = await boxOf(element(page, 'notes'))
  expect(Math.abs(moved.x - before.x - 80)).toBeLessThanOrEqual(14)
  await dragBy(page, element(page, 'notes').locator('[data-wm-resize="se"]'), 40, 30, { steps: 6 })
  const grown = await boxOf(element(page, 'notes'))
  expect(grown.width).toBeGreaterThan(moved.width + 20)
})

test('the shadow buttons minimize, maximize and close, and the stage is reflected', async ({
  page,
}) => {
  await bar(page, 'chart').locator('[part~=maximize]').click()
  await expect(element(page, 'chart')).toHaveAttribute('stage', 'maximized')
  await bar(page, 'chart').locator('[part~=maximize]').click()
  await expect(element(page, 'chart')).toHaveAttribute('stage', 'normal')
  await bar(page, 'chart').locator('[part~=minimize]').click()
  await expect(element(page, 'chart')).toHaveAttribute('stage', 'minimized')
  await expect(element(page, 'chart')).toBeHidden()
  await page.evaluate(() =>
    document.querySelector('[window-id="chart"]')?.setAttribute('stage', 'normal'),
  )
  await expect(element(page, 'chart')).toBeVisible()
  await bar(page, 'chart').locator('[part~=close]').click()
  await expect(element(page, 'chart')).toHaveAttribute('closed', '')
  expect(await state(page, 'chart')).toBeUndefined()
})

test('attributes move a window and a closed window opens when it is unclosed', async ({ page }) => {
  await page.evaluate(() => document.querySelector('[window-id="notes"]')?.setAttribute('x', '150'))
  await expect.poll(async () => (await state(page, 'notes'))?.bounds.x).toBe(150)
  await page.evaluate(() =>
    document.querySelector('[window-id="later"]')?.removeAttribute('closed'),
  )
  await expect(element(page, 'later')).toBeVisible()
  await expect(element(page, 'later').locator('[part=title]')).toHaveText('Later')
})

test('typing in a slotted field stays in the window and keeps it focused', async ({ page }) => {
  await page.locator('#notes-field').click()
  await page.keyboard.type(' world')
  await expect(page.locator('#notes-field')).toHaveValue('hello world')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            document.querySelector('wm-desktop') as HTMLElement & {
              manager: { getState(): { focusedId: string } }
            }
          ).manager.getState().focusedId,
      ),
    )
    .toBe('notes')
})
