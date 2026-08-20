import { expect, type Page, test } from '@playwright/test'
import { openVanilla } from './utils'

const HOST = '[data-wm-window="shadow"]'

async function openShadowWindow(page: Page): Promise<void> {
  await openVanilla(page)
  await page.click('#btn-open-shadow')
  await expect(page.locator(HOST)).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelector('[data-wm-window="shadow"]')?.shadowRoot !== null),
    )
    .toBe(true)
}

function state(page: Page) {
  return page.evaluate(() => {
    const win = window.__wm.get('shadow')
    return win
      ? { stage: win.stage, x: win.bounds.x, y: win.bounds.y, width: win.bounds.width }
      : null
  })
}

/** centre of a node that lives inside the window's shadow root */
function centreOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const node = document.querySelector('[data-wm-window="shadow"]')?.shadowRoot?.querySelector(sel)
    if (!node) return null
    const box = node.getBoundingClientRect()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }, selector)
}

/** click the node itself: this is about the delegated handler, not hit testing */
function pressInShadow(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const node = document
      .querySelector('[data-wm-window="shadow"]')
      ?.shadowRoot?.querySelector<HTMLElement>(sel)
    if (!node) throw new Error(`missing ${sel} in the shadow root`)
    node.click()
  }, selector)
}

test.describe('a window whose chrome lives in a shadow root', () => {
  test('keeps its chrome out of the page', async ({ page }) => {
    await openShadowWindow(page)
    const host = page.locator(HOST)

    expect(await host.evaluate((node) => node.querySelector('[data-wm-drag]') === null)).toBe(true)
    expect(await host.evaluate((node) => node.querySelector('[data-wm-resize]') === null)).toBe(
      true,
    )
    expect(
      await host.evaluate((node) => node.shadowRoot?.querySelector('[data-wm-drag]') !== null),
    ).toBe(true)
    expect(
      await host.evaluate((node) => node.shadowRoot?.querySelectorAll('[data-wm-resize]').length),
    ).toBe(8)
    // the app's own content stays in the page, projected through the slot
    expect(await host.evaluate((node) => node.textContent?.includes('projected content'))).toBe(
      true,
    )
  })

  test('drags by a titlebar the page cannot see', async ({ page }) => {
    await openShadowWindow(page)
    const before = await state(page)
    const bar = await centreOf(page, '[data-wm-title]')
    expect(bar, 'the titlebar is inside the shadow root').not.toBeNull()

    await page.mouse.move(bar?.x ?? 0, bar?.y ?? 0)
    await page.mouse.down()
    await page.mouse.move((bar?.x ?? 0) + 160, (bar?.y ?? 0) + 120, { steps: 12 })
    await page.mouse.up()

    const after = await state(page)
    // device pixels round, so compare whole pixels
    expect(Math.round(after?.x ?? 0)).toBe(Math.round((before?.x ?? 0) + 160))
    expect(Math.round(after?.y ?? 0)).toBe(Math.round((before?.y ?? 0) + 120))
  })

  test('answers the controls inside it', async ({ page }) => {
    await openShadowWindow(page)

    await pressInShadow(page, '[data-wm-minimize]')
    await expect.poll(async () => (await state(page))?.stage).toBe('minimized')

    await page.evaluate(() => window.__wm.restore('shadow'))
    await pressInShadow(page, '[data-wm-maximize]')
    await expect.poll(async () => (await state(page))?.stage).toBe('maximized')

    await page.evaluate(() => window.__wm.restore('shadow'))
    await pressInShadow(page, '[data-wm-close]')
    await expect.poll(() => page.evaluate(() => window.__wm.get('shadow') === undefined)).toBe(true)
  })

  test('maximizes on a double click of the titlebar', async ({ page }) => {
    await openShadowWindow(page)
    const bar = await centreOf(page, '[data-wm-title]')
    await page.mouse.dblclick(bar?.x ?? 0, bar?.y ?? 0)
    await expect.poll(async () => (await state(page))?.stage).toBe('maximized')
  })

  test('can be grouped into by dropping another titlebar on it', async ({ page }) => {
    await openShadowWindow(page)
    await page.click('#btn-open')
    const moving = await page.evaluate(
      () => window.__wm.getState().order.find((id) => id !== 'shadow') ?? '',
    )
    expect(moving).not.toBe('')

    const target = await centreOf(page, '[data-wm-drag]')
    const from = await page.evaluate((id) => {
      const bar = document.querySelector('[data-wm-window="' + id + '"] [data-wm-drag]')
      if (!bar) return null
      const box = bar.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }, moving)
    expect(from).not.toBeNull()

    await page.mouse.move(from?.x ?? 0, from?.y ?? 0)
    await page.mouse.down()
    await page.mouse.move(target?.x ?? 0, target?.y ?? 0, { steps: 20 })
    await page.mouse.move((target?.x ?? 0) + 2, (target?.y ?? 0) + 1, { steps: 2 })
    // the drop target is only taken after the dwell, with no further motion
    await expect(page.locator('[data-wm-tab-target]')).toHaveAttribute('data-wm-window', 'shadow')
    await page.mouse.up()

    await expect
      .poll(() => page.evaluate((id) => window.__wm.get(id)?.groupId ?? null, moving))
      .not.toBeNull()
  })

  test('resizes from a grip the page cannot reach', async ({ page }) => {
    await openShadowWindow(page)
    // a phone viewport is narrower than the fixture window: bring the grip on screen
    await page.evaluate(() => {
      window.__wm.move('shadow', 10, 10)
      window.__wm.resize('shadow', { width: 240, height: 200 })
    })
    // the move animates; take the grip's position only once the box has landed
    await expect
      .poll(() =>
        page.evaluate(() => {
          const box = document.querySelector('[data-wm-window="shadow"]')?.getBoundingClientRect()
          return box ? Math.round(box.width) : 0
        }),
      )
      .toBe(240)
    const before = await state(page)
    const grip = await centreOf(page, '[data-wm-resize="se"]')
    expect(grip).not.toBeNull()

    await page.mouse.move(grip?.x ?? 0, grip?.y ?? 0)
    await page.mouse.down()
    await page.mouse.move((grip?.x ?? 0) + 60, (grip?.y ?? 0) + 50, { steps: 10 })
    await page.mouse.up()

    await expect
      .poll(async () => Math.round((await state(page))?.width ?? 0))
      .toBe(Math.round((before?.width ?? 0) + 60))
  })
})
