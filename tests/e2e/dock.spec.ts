import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { boxOf, dragTo } from './utils'

type Box = { x: number; y: number; width: number; height: number }

const panel = (page: Page, id: string) => page.locator(`[data-testid="window-${id}"]`)
const header = (page: Page, id: string) => panel(page, id).locator('[data-wm-drag]')

async function docked(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const { dock } = (window as unknown as { __dock: { dock: { layout(): { root: unknown } } } })
      .__dock
    const out: string[] = []
    const walk = (node: { kind: string; windows?: string[]; children?: unknown[] } | null) => {
      if (!node) return
      if (node.kind === 'stack') out.push(...(node.windows ?? []))
      else for (const child of node.children ?? []) walk(child as never)
    }
    walk(dock.layout().root as never)
    return out
  })
}

async function groupOf(page: Page, id: string): Promise<string | null> {
  return page.evaluate(
    (windowId) =>
      (
        window as unknown as {
          __dock: { wm: { get(id: string): { groupId: string | null } | undefined } }
        }
      ).__dock.wm.get(windowId)?.groupId ?? null,
    id,
  )
}

async function dropOn(page: Page, id: string, target: Box, fx: number, fy: number) {
  await dragTo(page, header(page, id), target.x + target.width * fx, target.y + target.height * fy)
}

test.beforeEach(async ({ page }) => {
  await page.goto('test/dock.html')
  await expect(panel(page, 'editor')).toHaveAttribute('data-wm-docked', '')
  await expect(page.locator('[data-wm-sash]')).toHaveCount(1)
})

test('a floating window splits a panel near its edge and tabs in at its centre', async ({
  page,
}) => {
  const editor = await boxOf(panel(page, 'editor'))
  await dropOn(page, 'preview', editor, 0.5, 0.92)
  await expect.poll(() => docked(page)).toEqual(['files', 'editor', 'preview'])
  const below = await boxOf(panel(page, 'preview'))
  const above = await boxOf(panel(page, 'editor'))
  expect(Math.abs(below.x - above.x)).toBeLessThanOrEqual(1)
  expect(below.y).toBeGreaterThan(above.y + above.height - 1)
  await expect(page.locator('[data-wm-sash]')).toHaveCount(2)

  const files = await boxOf(panel(page, 'files'))
  await dropOn(page, 'terminal', files, 0.5, 0.5)
  await expect.poll(() => docked(page)).toEqual(['files', 'terminal', 'editor', 'preview'])
  const group = await groupOf(page, 'terminal')
  expect(group).not.toBeNull()
  expect(await groupOf(page, 'files')).toBe(group)
  await expect(panel(page, 'terminal')).toBeVisible()
  await expect(panel(page, 'files')).toBeHidden()
})

test('a panel dragged out floats and the layout closes the gap', async ({ page }) => {
  const desk = await boxOf(page.locator('#desktop'))
  const outside =
    desk.width >= 700
      ? { x: desk.x + desk.width * 0.85, y: desk.y + desk.height * 0.5 }
      : { x: desk.x + desk.width * 0.5, y: desk.y + desk.height * 0.85 }
  await dragTo(page, header(page, 'files'), outside.x, outside.y)
  await expect.poll(() => docked(page)).toEqual(['editor'])
  await expect(panel(page, 'files')).not.toHaveAttribute('data-wm-docked', '')
  await expect(page.locator('[data-wm-sash]')).toHaveCount(0)
  const editor = await boxOf(panel(page, 'editor'))
  expect(editor.x).toBeLessThanOrEqual(desk.x + 1)
  const files = await boxOf(panel(page, 'files'))
  if (desk.width >= 700) expect(files.x + files.width / 2).toBeGreaterThan(editor.x + editor.width)
  else expect(files.y + files.height / 2).toBeGreaterThan(editor.y + editor.height)
})

test('a separator drags across the iframe panel, and one undo puts it back', async ({ page }) => {
  const sash = page.locator('[data-wm-sash]')
  const before = await boxOf(panel(page, 'files'))
  const box = await boxOf(sash)
  const vertical = (await sash.getAttribute('aria-orientation')) === 'vertical'
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(vertical ? cx + 60 : cx, vertical ? cy : cy + 60, { steps: 10 })
  await page.mouse.up()
  const after = await boxOf(panel(page, 'files'))
  if (vertical) expect(after.width - before.width).toBeGreaterThan(40)
  else expect(after.height - before.height).toBeGreaterThan(40)
  await page.keyboard.press('Control+z')
  await expect
    .poll(async () => (await boxOf(panel(page, 'files'))).width)
    .toBeCloseTo(before.width, 0)
})

test('the keyboard docks the focused window and moves a separator', async ({ page }) => {
  await panel(page, 'preview')
    .locator('[data-wm-content]')
    .click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('Control+Alt+Shift+ArrowDown')
  await expect.poll(() => docked(page)).toEqual(['files', 'editor', 'preview'])
  const sash = page.locator('[data-wm-sash]').first()
  const before = await boxOf(panel(page, 'files'))
  await sash.focus()
  await page.keyboard.press(
    (await sash.getAttribute('aria-orientation')) === 'vertical' ? 'ArrowRight' : 'ArrowDown',
  )
  const after = await boxOf(panel(page, 'files'))
  expect(after.width + after.height - before.width - before.height).toBeCloseTo(16, 0)
  await expect(sash).toHaveAttribute('role', 'separator')
})

test('axe finds no serious violations in the docked layout', async ({ page }) => {
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(serious).toEqual([])
})

test('a reload restores the layout through persist', async ({ page }) => {
  const editor = await boxOf(panel(page, 'editor'))
  await dropOn(page, 'preview', editor, 0.92, 0.5)
  await expect.poll(() => docked(page)).toEqual(['files', 'editor', 'preview'])
  await page.waitForTimeout(100)
  await page.reload()
  await expect(panel(page, 'preview')).toHaveAttribute('data-wm-docked', '')
  await expect.poll(() => docked(page)).toEqual(['files', 'editor', 'preview'])
  await expect(page.locator('[data-wm-sash]')).toHaveCount(2)
})
