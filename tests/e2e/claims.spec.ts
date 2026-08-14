import { expect, test } from '@playwright/test'

const readme = '[data-testid="window-readme"]'

test.describe('the landing tells the truth', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough to read facts')

  test('the desktop really narrates itself to a screen reader', async ({ page }) => {
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()
    const region = page.locator('[data-wm-announcer]')
    await expect(region).toHaveAttribute('aria-live', 'polite')

    await page.click('#launcher button[data-app="layouts"]')
    await expect(page.locator('[data-testid="window-layouts"]')).toBeVisible()
    await expect(region).not.toBeEmpty()
  })

  test('a modal really traps the keyboard', async ({ page }) => {
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()
    await page.evaluate(() => {
      const wm = window.__wmDemo.wm
      wm.open({ id: 'gate', title: 'gate', layer: 'modal', width: 320, height: 200 })
    })
    const gate = page.locator('[data-wm-window="gate"]')
    await expect(gate).toBeVisible()
    await expect(gate).toHaveAttribute('aria-modal', 'true')

    const blocked = await page.evaluate(() => window.__wmDemo.wm.focus('readme'))
    expect(blocked, 'a modal must refuse focus to the windows behind it').toBe(false)
  })

  test('a drag really collapses into one undo', async ({ page }) => {
    await page.goto('?lang=en')
    const window_ = page.locator(readme)
    await expect(window_).toBeVisible()

    const box = await window_.locator('[data-wm-drag]').boundingBox()
    const start = { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + 10 }
    await page.evaluate(() => window.__wmDemo.wm.focus('readme'))
    await page.evaluate(() => window.__wmDemo.wm.clearHistory())
    const before = await page.evaluate(() => window.__wmDemo.wm.get('readme')?.bounds.x)

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    for (let step = 1; step <= 8; step += 1) {
      await page.mouse.move(start.x - step * 6, start.y + step * 6)
    }
    await page.mouse.up()

    const moved = await page.evaluate(() => window.__wmDemo.wm.get('readme')?.bounds.x)
    expect(moved, 'the drag never moved the window').not.toBe(before)

    expect(await page.evaluate(() => window.__wmDemo.wm.undo())).toBe(true)
    expect(await page.evaluate(() => window.__wmDemo.wm.get('readme')?.bounds.x)).toBe(before)
    expect(await page.evaluate(() => window.__wmDemo.wm.canUndo())).toBe(false)
  })

  test('every theme it offers actually loads', async ({ page }) => {
    for (const theme of [
      'glass',
      'light',
      'retro',
      'terminal',
      'paper',
      'neon',
      'aqua',
      'frost',
      'candy',
      'carbon',
      'brutalist',
      'blueprint',
      'amber',
      'noir',
      'forest',
      'synth',
    ] as const) {
      await page.addInitScript((name) => localStorage.setItem('wmkit-theme', name), theme)
      await page.goto('?lang=en')
      await expect(page.locator(readme)).toBeVisible()
      await expect(page.locator('[data-wm-desktop]')).toHaveAttribute('data-theme', theme)
      const loaded = await page.evaluate(
        (name) => [...document.styleSheets].some((sheet) => sheet.href?.includes(name)),
        theme,
      )
      expect(loaded, `${theme} stylesheet never loaded`).toBe(true)
    }
  })
})
