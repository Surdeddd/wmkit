import { expect, type Locator, type Page } from '@playwright/test'

export async function openVanilla(page: Page): Promise<void> {
  await page.goto('test/vanilla.html')
  await expect(page.locator('#desktop')).toBeVisible()
}

export function win(page: Page, id: string): Locator {
  return page.locator(`[data-testid="window-${id}"]`)
}

export function handle(page: Page, id: string): Locator {
  return win(page, id).locator('[data-wm-drag]')
}

export async function spawn(page: Page, kind: 'open' | 'modal' | 'iframe' | 'fixed' = 'open') {
  const button = {
    open: '#btn-open',
    modal: '#btn-open-modal',
    iframe: '#btn-open-iframe',
    fixed: '#btn-open-fixed',
  }[kind]
  await page.click(button)
}

export async function settle(locator: Locator): Promise<void> {
  await locator.evaluate(async (el) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const root = (el.closest('[data-wm-window]') ?? el) as HTMLElement
    await Promise.all(root.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})))
  })
}

export async function boxOf(locator: Locator) {
  await settle(locator)
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box as { x: number; y: number; width: number; height: number }
}

export async function dragBy(
  page: Page,
  source: Locator,
  dx: number,
  dy: number,
  options: { steps?: number; release?: boolean } = {},
): Promise<void> {
  const box = await boxOf(source)
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: options.steps ?? 12 })
  if (options.release !== false) await page.mouse.up()
}

export async function dragTo(
  page: Page,
  source: Locator,
  targetX: number,
  targetY: number,
  options: { steps?: number; release?: boolean } = {},
): Promise<void> {
  const box = await boxOf(source)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetX, targetY, { steps: options.steps ?? 16 })
  if (options.release !== false) await page.mouse.up()
}

export async function desktopBox(page: Page) {
  return boxOf(page.locator('#desktop'))
}
