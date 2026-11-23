import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { boxOf, handle, openVanilla, win } from './utils'

interface Opened {
  id: string
  owner?: string
  layer?: 'modal'
  x: number
  y: number
  width: number
  height: number
}

async function open(page: Page, ...windows: Opened[]): Promise<void> {
  await page.evaluate((list) => {
    for (const init of list) window.__spawn({ ...init, title: init.id })
  }, windows)
  for (const { id } of windows) await expect(win(page, id)).toBeAttached()
}

const zOf = (page: Page, id: string) => win(page, id).evaluate((el) => Number(el.style.zIndex))
const focusedId = (page: Page) => page.evaluate(() => window.__wm.getState().focusedId)

const OTHER = { id: 'other', x: 10, y: 10, width: 170, height: 120 }
const DOC = { id: 'doc', x: 10, y: 150, width: 240, height: 170 }
const FIND = { id: 'find', owner: 'doc', x: 130, y: 340, width: 180, height: 120 }
const ASK = {
  id: 'ask',
  owner: 'doc',
  layer: 'modal' as const,
  x: 70,
  y: 200,
  width: 200,
  height: 130,
}

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('a window stays above its owner and the family comes forward together', async ({ page }) => {
  await open(page, OTHER, DOC, FIND)
  await expect(win(page, 'find')).toHaveAttribute('data-wm-owner', 'doc')
  await expect(win(page, 'find')).toHaveAttribute('data-wm-focused', '')

  await win(page, 'other')
    .locator('[data-wm-content]')
    .click({ position: { x: 10, y: 10 } })
  await expect(win(page, 'other')).toHaveAttribute('data-wm-focused', '')
  expect(await zOf(page, 'other')).toBeGreaterThan(await zOf(page, 'find'))

  await handle(page, 'doc').click({ position: { x: 20, y: 8 } })
  await expect(win(page, 'doc')).toHaveAttribute('data-wm-focused', '')
  const [doc, find, other] = [
    await zOf(page, 'doc'),
    await zOf(page, 'find'),
    await zOf(page, 'other'),
  ]
  expect(find).toBeGreaterThan(doc)
  expect(doc).toBeGreaterThan(other)
})

test('a modal with an owner blocks its family and leaves the rest of the desktop alone', async ({
  page,
}) => {
  await open(page, OTHER, DOC, FIND, ASK)
  const other = win(page, 'other')
  const doc = win(page, 'doc')
  const find = win(page, 'find')
  const ask = win(page, 'ask')
  await expect(ask).toHaveAttribute('data-wm-focused', '')
  await expect(ask).not.toHaveAttribute('aria-modal', 'true')
  await expect(doc).toHaveAttribute('data-wm-blocked', '')
  await expect(find).toHaveAttribute('data-wm-blocked', '')
  await expect(other).not.toHaveAttribute('data-wm-blocked', '')
  await expect(ask).not.toHaveAttribute('data-wm-blocked', '')

  await other.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(other).toHaveAttribute('data-wm-focused', '')

  await ask.evaluate((el) => {
    const seen = { flashed: false }
    Object.assign(window, { flashSeen: seen })
    new MutationObserver(() => {
      if (el.hasAttribute('data-wm-flash')) seen.flashed = true
    }).observe(el, { attributes: true, attributeFilter: ['data-wm-flash'] })
  })
  await doc.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(ask).toHaveAttribute('data-wm-focused', '')
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { flashSeen: { flashed: boolean } }).flashSeen.flashed,
      ),
    )
    .toBe(true)
  expect(await zOf(page, 'ask')).toBeGreaterThan(await zOf(page, 'other'))

  const before = await boxOf(doc)
  const grip = await boxOf(handle(page, 'doc'))
  await page.mouse.move(grip.x + 30, grip.y + 8)
  await page.mouse.down()
  await page.mouse.move(grip.x + 90, grip.y + 60, { steps: 6 })
  await page.mouse.up()
  expect(await boxOf(doc)).toEqual(before)

  await doc.locator('input').focus()
  await expect.poll(() => ask.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  expect(await focusedId(page)).toBe('ask')

  await ask.locator('[data-wm-close]').click()
  await expect(ask).toHaveCount(0)
  await expect(doc).not.toHaveAttribute('data-wm-blocked', '')
  await doc.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(doc).toHaveAttribute('data-wm-focused', '')
})

test('a family goes to the taskbar as one button and closes with its owner', async ({ page }) => {
  await open(page, OTHER, DOC, FIND)
  await win(page, 'doc').locator('[data-wm-minimize]').click()
  await expect(win(page, 'doc')).toBeHidden()
  await expect(win(page, 'find')).toBeHidden()
  const tasks = page.locator('#taskbar [data-wm-task]')
  await expect(tasks).toHaveCount(1)
  await expect(tasks).toHaveAttribute('data-wm-task', 'doc')

  await tasks.click()
  await expect(win(page, 'doc')).toBeVisible()
  await expect(win(page, 'find')).toBeVisible()
  await expect(tasks).toHaveCount(0)
  expect(await focusedId(page)).toBe('doc')

  await win(page, 'doc').locator('[data-wm-close]').click()
  await expect(win(page, 'doc')).toHaveCount(0)
  await expect(win(page, 'find')).toHaveCount(0)
  await expect(page.getByTestId('window-count')).toHaveText('1')

  await page.evaluate(() => window.__wm.undo())
  await expect(win(page, 'find')).toHaveAttribute('data-wm-owner', 'doc')
  await expect(page.getByTestId('window-count')).toHaveText('3')
})
