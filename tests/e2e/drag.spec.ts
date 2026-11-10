import { expect, test } from './fixtures'
import { boxOf, desktopBox, dragBy, dragTo, handle, openVanilla, settle, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('dragging the titlebar moves the window', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const before = await boxOf(window)
  await dragBy(page, handle(page, 'fixed'), 120, 80)
  const after = await boxOf(window)
  expect(Math.abs(after.x - before.x - 120)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.y - before.y - 80)).toBeLessThanOrEqual(2)
})

test('drag is clamped so the titlebar stays reachable', async ({ page }) => {
  await spawn(page, 'fixed')
  const desktop = await boxOf(page.locator('#desktop'))
  await dragTo(page, handle(page, 'fixed'), desktop.x + desktop.width / 2, desktop.y - 300, {
    steps: 8,
  })
  const after = await boxOf(win(page, 'fixed'))
  expect(after.y).toBeGreaterThanOrEqual(desktop.y - 2)
})

test('escape cancels an in-flight drag', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const before = await boxOf(window)
  await dragBy(page, handle(page, 'fixed'), 150, 100, { release: false })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  const after = await boxOf(window)
  expect(Math.round(after.x)).toBe(Math.round(before.x))
  expect(Math.round(after.y)).toBe(Math.round(before.y))
})

test('escape during drag restores a maximized window', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const original = await boxOf(window)
  await window.locator('[data-wm-maximize]').click()
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  const maxed = await boxOf(window)

  await dragBy(page, handle(page, 'fixed'), 180, 140, { release: false })
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
  await page.keyboard.press('Escape')
  await page.mouse.up()

  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  const after = await boxOf(window)
  expect(Math.abs(after.width - maxed.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.height - maxed.height)).toBeLessThanOrEqual(2)

  await window.locator('[data-wm-maximize]').click()
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
  const restored = await boxOf(window)
  expect(Math.round(restored.x)).toBe(Math.round(original.x))
  expect(Math.round(restored.width)).toBe(Math.round(original.width))
})

test('escape during drag re-snaps a snapped window', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const desktop = await boxOf(page.locator('#desktop'))
  await dragTo(page, handle(page, 'fixed'), desktop.x + 4, desktop.y + desktop.height / 2)
  await expect(window).toHaveAttribute('data-wm-stage', 'snapped')
  const snapped = await boxOf(window)

  await dragBy(page, handle(page, 'fixed'), 200, 120, { release: false })
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
  await page.keyboard.press('Escape')
  await page.mouse.up()

  await expect(window).toHaveAttribute('data-wm-stage', 'snapped')
  const after = await boxOf(window)
  expect(Math.abs(after.x - snapped.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.width - snapped.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(after.height - snapped.height)).toBeLessThanOrEqual(2)
})

test('drag keeps tracking across an iframe', async ({ page }) => {
  await spawn(page, 'iframe')
  await spawn(page, 'fixed')
  const frameWindow = win(page, 'frame1')
  const desktop = await boxOf(page.locator('#desktop'))
  await dragTo(
    page,
    handle(page, 'frame1'),
    Math.min(400, desktop.x + desktop.width - 80),
    Math.min(400, desktop.y + desktop.height - 80),
    { steps: 4 },
  )
  await expect(frameWindow).toBeVisible()

  const window = win(page, 'fixed')
  const before = await boxOf(window)
  const bar = await boxOf(handle(page, 'fixed'))
  const startX = bar.x + bar.width / 2
  const startY = bar.y + bar.height / 2
  const dx = Math.min(260, desktop.x + desktop.width - 52 - startX)
  const dy = Math.min(220, desktop.y + desktop.height - 52 - startY)
  await dragBy(page, handle(page, 'fixed'), dx, dy, { steps: 30 })
  const after = await boxOf(window)
  expect(Math.abs(after.x - before.x - dx)).toBeLessThanOrEqual(14)
  expect(Math.abs(after.y - before.y - dy)).toBeLessThanOrEqual(14)
})

test('buttons inside the titlebar do not start a drag', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const before = await boxOf(window)
  const minimize = window.locator('[data-wm-minimize]')
  const box = await boxOf(minimize)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 5 })
  await page.mouse.up()
  const after = await boxOf(window)
  expect(Math.round(after.x)).toBe(Math.round(before.x))
})

test('touch pointer drags the window', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || !isMobile, 'CDP touch emulation is chromium-only')
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const before = await boxOf(window)
  const bar = await boxOf(handle(page, 'fixed'))
  const cdp = await page.context().newCDPSession(page)
  const startX = bar.x + bar.width / 2
  const startY = bar.y + bar.height / 2
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  })
  for (let i = 1; i <= 8; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX + i * 10, y: startY + i * 8 }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const after = await boxOf(window)
  expect(after.x - before.x).toBeGreaterThan(80 - 4)
  expect(after.y - before.y).toBeGreaterThan(64 - 4)
})

test('dragging near a neighbour edge magnetizes the window', async ({ page }) => {
  await spawn(page, 'fixed')
  await page.evaluate(() => {
    window.__spawn({ id: 'anchor', title: 'Anchor', x: 500, y: 100, width: 200, height: 160 })
  })
  const moving = win(page, 'fixed')
  const before = await boxOf(moving)
  const anchor = await boxOf(win(page, 'anchor'))
  const targetX = anchor.x - before.width - 5 + before.width / 2
  await dragTo(page, handle(page, 'fixed'), targetX, before.y + 20, { steps: 15 })
  const after = await boxOf(moving)
  expect(Math.round(after.x + after.width)).toBe(Math.round(anchor.x))
})

test('undo restores the position after a drag', async ({ page }) => {
  await spawn(page, 'fixed')
  const boundsOf = () =>
    page.evaluate(() => {
      const serialized = window.__wm.serialize()
      const first = serialized.windows[0]
      if (!first) throw new Error('no window serialized')
      return first.bounds
    })
  const before = await boundsOf()
  await dragBy(page, handle(page, 'fixed'), 150, 120)
  const moved = await boundsOf()
  expect(moved.x === before.x && moved.y === before.y).toBe(false)
  await page.evaluate(() => {
    window.__wm.undo()
  })
  const after = await boundsOf()
  expect(after).toEqual(before)
})

for (const start of ['snapped to a rectangle', 'maximized over a snapped rectangle']) {
  test(`escape puts a window ${start} back exactly as it was`, async ({ page }) => {
    await spawn(page, 'fixed')
    await page.evaluate((maximize) => {
      window.__wm.snapTo('fixed', { x: 0.5, y: 0, width: 0.5, height: 1 })
      if (maximize) window.__wm.maximize('fixed')
      const counter = { escapes: 0 }
      ;(window as unknown as { __keys: typeof counter }).__keys = counter
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') counter.escapes += 1
      })
    }, start.startsWith('maximized'))
    await settle(win(page, 'fixed'))
    const before = await page.evaluate(() => window.__wm.get('fixed'))

    await dragBy(page, handle(page, 'fixed'), -120, 90, { release: false })
    await expect(win(page, 'fixed')).toHaveAttribute('data-wm-stage', 'normal')
    await page.keyboard.press('Escape')
    await page.mouse.up()

    expect(await page.evaluate(() => window.__wm.get('fixed'))).toEqual(before)
    const keys = await page.evaluate(
      () => (window as unknown as { __keys: { escapes: number } }).__keys.escapes,
    )
    expect(keys, 'the Escape that cancelled the drag reached the page').toBe(0)
  })
}

test('a window closed by a drop target comes back with one undo', async ({ page }) => {
  await spawn(page, 'fixed')
  await page.evaluate(() => {
    const probe = { commits: 0 }
    ;(window as unknown as { __drop: typeof probe }).__drop = probe
    window.__desktop.addDropTarget((_x, _y, id, local) =>
      local.x < 80
        ? {
            preview: { x: 0, y: 0, width: 80, height: 80 },
            commit() {
              probe.commits += 1
              window.__wm.close(id)
            },
          }
        : null,
    )
    window.__wm.clearHistory()
  })
  const before = await page.evaluate(() => window.__wm.get('fixed'))
  const desk = await desktopBox(page)

  await dragTo(page, handle(page, 'fixed'), desk.x + 40, desk.y + desk.height / 2)
  await expect(win(page, 'fixed')).toHaveCount(0)
  expect(await page.evaluate(() => window.__wm.get('fixed'))).toBeUndefined()
  const commits = await page.evaluate(
    () => (window as unknown as { __drop: { commits: number } }).__drop.commits,
  )
  expect(commits, 'the drop target committed more than once').toBe(1)

  expect(await page.evaluate(() => window.__wm.undo())).toBe(true)
  expect(await page.evaluate(() => window.__wm.get('fixed'))).toEqual(before)
  expect(await page.evaluate(() => window.__wm.canUndo())).toBe(false)
})

test('a window closed in the middle of its drag comes back where the drag began', async ({
  page,
}) => {
  await spawn(page, 'fixed')
  await page.evaluate(() => window.__wm.clearHistory())
  const before = await page.evaluate(() => window.__wm.get('fixed'))

  await dragBy(page, handle(page, 'fixed'), 120, 80, { release: false })
  await page.evaluate(() => window.__wm.close('fixed'))
  await page.mouse.up()
  expect(await page.evaluate(() => window.__wm.get('fixed'))).toBeUndefined()

  expect(await page.evaluate(() => window.__wm.undo())).toBe(true)
  expect(await page.evaluate(() => window.__wm.get('fixed'))).toEqual(before)
})
