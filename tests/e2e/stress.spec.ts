import { expect, test } from './fixtures'
import { boxOf, dragBy, openVanilla, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('spawns 50 windows and keeps dragging responsive', async ({ page, isMobile }) => {
  test.skip(isMobile, 'drag precision under 50 windows is a desktop scenario')
  await page.click('#btn-stress')
  await expect(page.getByTestId('window-count')).toHaveText('50')
  await expect(page.locator('[data-wm-window]')).toHaveCount(50)

  const topId = await page.evaluate(() => {
    const state = window.__wm.getState()
    return state.order[state.order.length - 1]
  })
  const topWindow = win(page, topId as string)
  const before = await boxOf(topWindow)
  await dragBy(page, topWindow.locator('[data-wm-drag]'), 100, 60, { steps: 25 })
  const after = await boxOf(topWindow)
  expect(Math.abs(after.x - before.x - 100)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.y - before.y - 60)).toBeLessThanOrEqual(2)
})

test('z-order stays consistent through rapid focus switching', async ({ page, isMobile }) => {
  test.skip(isMobile, 'stacked strips are too narrow to click reliably on a phone viewport')
  await page.click('#btn-stress')
  const ids = (await page.evaluate(() => window.__wm.getState().order.slice(0, 5))) as string[]
  for (const id of ids.reverse()) {
    await win(page, id)
      .locator('[data-wm-drag]')
      .click({ position: { x: 20, y: 12 } })
    await expect(win(page, id)).toHaveAttribute('data-wm-focused', '')
  }
  const zOrder = await page.evaluate(() => {
    const state = window.__wm.getState()
    return state.order.map((id) => {
      const el = document.querySelector(`[data-testid="window-${id}"]`) as HTMLElement
      return Number(el.style.zIndex)
    })
  })
  const sorted = [...(zOrder as number[])].sort((a, b) => a - b)
  expect(zOrder).toEqual(sorted)
})

test('windows deep in the stack drop the blur of the glass theme', async ({ page }) => {
  await page.click('#btn-stress')
  await expect(page.locator('[data-wm-window]')).toHaveCount(50)

  const look = () =>
    page.evaluate(() => {
      const fromTop = [...window.__wm.getState().order].reverse()
      return fromTop.map((id) => {
        const el = document.querySelector(`[data-testid="window-${id}"]`) as HTMLElement
        const style = getComputedStyle(el)
        const blur = style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter')
        const alpha = style.backgroundColor.match(/[\d.]+(?=\)$)/)
        return {
          id,
          deep: el.hasAttribute('data-wm-deep'),
          hidden: el.hidden,
          blur,
          opaque: style.backgroundColor.startsWith('rgb(') || Number(alpha?.[0] ?? 1) === 1,
        }
      })
    })

  const stack = await look()
  expect(stack.slice(0, 13).map((entry) => entry.deep)).toEqual(Array(13).fill(false))
  expect(stack[13]?.deep, 'the fourteenth window from the top keeps its blur').toBe(true)
  expect(stack.filter((entry) => entry.deep)).toHaveLength(37)
  expect(stack[0]?.blur).toContain('blur')
  expect(stack[12]?.blur).toContain('blur')
  expect(stack[13]?.blur).toBe('none')
  expect(stack[13]?.opaque, 'a deep window kept a see-through background').toBe(true)

  await page.evaluate((id) => window.__wm.minimize(id), stack[0]?.id as string)
  const after = await look()
  const minimized = after.find((entry) => entry.id === stack[0]?.id)
  expect(minimized?.hidden).toBe(true)
  expect(minimized?.deep, 'a hidden window carries the deep mark').toBe(false)
  const visible = after.filter((entry) => !entry.hidden)
  expect(visible[12]?.id).toBe(stack[13]?.id)
  expect(visible[12]?.deep, 'the window that moved up to thirteenth stayed deep').toBe(false)
  expect(visible[12]?.blur).toContain('blur')
  expect(visible[13]?.deep).toBe(true)
})

test('closeAll clears 50 windows in one pass', async ({ page }) => {
  await page.click('#btn-stress')
  await page.click('#btn-clear')
  await expect(page.locator('[data-wm-window]')).toHaveCount(0)
  await expect(page.getByTestId('window-count')).toHaveText('0')
})
