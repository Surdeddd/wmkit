import { expect, type Page, test } from '@playwright/test'
import { boxOf } from './utils'

const readme = '[data-testid="window-readme"]'

async function grouped(page: Page) {
  await page.goto('?lang=en')
  await expect(page.locator(readme)).toBeVisible()
  await page.click('#launcher button[data-app="layouts"]')
  await expect(page.locator('[data-testid="window-layouts"]')).toBeVisible()
  await page.click('#launcher button[data-app="terminal"]')
  await expect(page.locator('[data-testid="window-terminal"]')).toBeVisible()

  await page.evaluate(() => window.__wmDemo.wm.group(['readme', 'layouts', 'terminal']))
  await expect(page.locator(`${readme} .win-tab`)).toHaveCount(3)
}

const order = () =>
  [...document.querySelectorAll('[data-wm-window]:not([hidden]) .win-tab')].map(
    (tab) => (tab as HTMLElement).dataset.tab ?? '',
  )

test.describe('tab strip', () => {
  test.skip(({ isMobile }) => !!isMobile, 'the strip needs a roomy titlebar')

  test('keeps its order when tabs are activated and windows are raised', async ({ page }) => {
    await grouped(page)
    const before = await page.evaluate(order)
    expect(before).toEqual(['readme', 'layouts', 'terminal'])

    await page.evaluate(() => window.__wmDemo.wm.activateTab('terminal'))
    await page.evaluate(() => window.__wmDemo.wm.focus('terminal'))
    expect(await page.evaluate(order)).toEqual(before)
  })

  test('arrow keys walk the strip and move the window with it', async ({ page }) => {
    await grouped(page)
    const active = () => page.evaluate(() => window.__wmDemo.wm.getState().focusedId)

    await page.locator(`${readme} .win-tab[data-tab="readme"]`).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('[data-testid="window-layouts"]')).toBeVisible()
    expect(await active()).toBe('layouts')

    await page.keyboard.press('End')
    await expect(page.locator('[data-testid="window-terminal"]')).toBeVisible()
    expect(await active()).toBe('terminal')

    await page.keyboard.press('Home')
    await expect(page.locator(readme)).toBeVisible()
    expect(await active()).toBe('readme')
  })

  test('ctrl with an arrow key reorders the strip', async ({ page }) => {
    await grouped(page)
    await page.locator(`${readme} .win-tab[data-tab="readme"]`).focus()

    await page.keyboard.press('Control+ArrowRight')
    expect(await page.evaluate(order)).toEqual(['layouts', 'readme', 'terminal'])

    await page.keyboard.press('Control+ArrowLeft')
    expect(await page.evaluate(order)).toEqual(['readme', 'layouts', 'terminal'])
  })

  test('a tab dropped further along the strip changes places', async ({ page }) => {
    await grouped(page)
    const from = await boxOf(page.locator(`${readme} .win-tab[data-tab="readme"]`))
    const to = await boxOf(page.locator(`${readme} .win-tab[data-tab="terminal"]`))

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 })
    await page.mouse.move(to.x + to.width - 4, to.y + to.height / 2, { steps: 8 })
    await page.mouse.up()

    expect(await page.evaluate(order)).toEqual(['layouts', 'terminal', 'readme'])
    await expect(page.locator(readme)).toBeVisible()
  })

  test('a tab dropped part way along the strip lands in that slot', async ({ page }) => {
    await grouped(page)
    const from = await boxOf(page.locator(`${readme} .win-tab[data-tab="readme"]`))
    const to = await boxOf(page.locator(`${readme} .win-tab[data-tab="terminal"]`))

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 })
    await page.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 8 })
    await page.mouse.up()

    expect(await page.evaluate(order)).toEqual(['layouts', 'readme', 'terminal'])
  })

  test('only the shown tab is reachable with the tab key', async ({ page }) => {
    await grouped(page)
    const roving = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-wm-window]:not([hidden]) .win-tab')].map((tab) => ({
          id: (tab as HTMLElement).dataset.tab,
          tabIndex: (tab as HTMLElement).tabIndex,
        })),
      )

    const first = await roving()
    expect(first.filter((entry) => entry.tabIndex === 0)).toHaveLength(1)
    expect(first.find((entry) => entry.tabIndex === 0)?.id).toBe('readme')

    await page.evaluate(() => window.__wmDemo.wm.activateTab('layouts'))
    await expect(page.locator('[data-testid="window-layouts"]')).toBeVisible()
    const second = await roving()
    expect(second.filter((entry) => entry.tabIndex === 0)).toHaveLength(1)
    expect(second.find((entry) => entry.tabIndex === 0)?.id).toBe('layouts')
  })
})
