import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

const join = (page: Page, defaults: string[]) =>
  page.evaluate(async (defaults) => {
    const { createWindowManager, sync } = window.__wmkit
    const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
    const link = sync(wm, { channel: 'wmkit-e2e-sync', wait: 400 })
    for (const id of defaults) wm.open({ id, title: id, x: 20, y: 20, width: 300, height: 200 })
    Object.assign(window, { __shared: wm })
    return link.ready
  }, defaults)

const picture = (page: Page) =>
  page.evaluate(() => {
    const wm = (window as unknown as { __shared: typeof window.__wm }).__shared
    return JSON.stringify(wm.serialize())
  })
const act = (page: Page, run: 'move' | 'open' | 'close') =>
  page.evaluate((run) => {
    const wm = (window as unknown as { __shared: typeof window.__wm }).__shared
    if (run === 'move') wm.move('first', 240, 160)
    if (run === 'open')
      wm.open({ id: 'second', title: 'second', x: 60, y: 80, width: 320, height: 220 })
    if (run === 'close') wm.close('first')
  }, run)

test('two tabs share one desktop: the second joins the first, and each follows the other', async ({
  page,
  context,
}) => {
  await page.goto('test/vanilla.html')
  expect(await join(page, ['first'])).toBe(false)

  const other = await context.newPage()
  await other.goto('test/vanilla.html')
  expect(await join(other, ['default-a', 'default-b'])).toBe(true)
  expect(await picture(other)).toBe(await picture(page))
  expect(JSON.parse(await picture(page)).windows.map((win: { id: string }) => win.id)).toEqual([
    'first',
  ])

  await act(other, 'move')
  await expect.poll(() => picture(page)).toBe(await picture(other))
  expect(JSON.parse(await picture(page)).windows[0].bounds).toMatchObject({ x: 240, y: 160 })

  await act(page, 'open')
  await expect.poll(() => picture(other)).toBe(await picture(page))
  await act(other, 'close')
  await expect.poll(() => picture(page)).toBe(await picture(other))
  expect(JSON.parse(await picture(page)).windows.map((win: { id: string }) => win.id)).toEqual([
    'second',
  ])
  await other.close()
})
