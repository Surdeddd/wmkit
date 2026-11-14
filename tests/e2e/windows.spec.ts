import { expect, test } from './fixtures'
import { boxOf, desktopBox, openVanilla, reach, spawn, win } from './utils'

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('opens a window with dialog semantics and focus', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await expect(window).toBeVisible()
  await expect(window).toHaveAttribute('role', 'dialog')
  await expect(window).toHaveAttribute('data-wm-focused', '')
  await expect(window).toHaveAttribute('aria-label', 'Test 1')
  await expect(window.locator('[data-wm-title]')).toHaveText('Test 1')
  await expect(page.getByTestId('window-count')).toHaveText('1')
})

test('clicking a background window raises and focuses it', async ({ page }) => {
  await spawn(page)
  await spawn(page)
  const first = win(page, 't1')
  const second = win(page, 't2')
  await expect(second).toHaveAttribute('data-wm-focused', '')

  await first.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(first).toHaveAttribute('data-wm-focused', '')
  await expect(second).not.toHaveAttribute('data-wm-focused', '')

  const firstZ = Number(await first.evaluate((el) => el.style.zIndex))
  const secondZ = Number(await second.evaluate((el) => el.style.zIndex))
  expect(firstZ).toBeGreaterThan(secondZ)
})

test('close button removes the window and hands focus back', async ({ page }) => {
  await spawn(page)
  await spawn(page)
  await win(page, 't2').locator('[data-wm-close]').click()
  await expect(win(page, 't2')).toHaveCount(0)
  await expect(win(page, 't1')).toHaveAttribute('data-wm-focused', '')
  await expect(page.getByTestId('window-count')).toHaveText('1')
})

test('a window that is asked first waits for the answer, stays on a no and closes on a yes', async ({
  page,
}) => {
  await spawn(page)
  const asked = win(page, 't1')
  await expect(asked).toBeVisible()
  await page.evaluate(() => {
    const answers: Array<(value: boolean) => void> = []
    Object.assign(window, { __answers: answers })
    window.__wm.onBeforeClose(() => new Promise<boolean>((resolve) => answers.push(resolve)))
  })
  const answer = (value: boolean) =>
    page.evaluate((given) => {
      const { __answers } = window as unknown as { __answers: Array<(value: boolean) => void> }
      __answers.shift()?.(given)
    }, value)

  await asked.locator('[data-wm-close]').click()
  await expect(asked).toHaveAttribute('data-wm-closing', '')
  await expect(asked).toBeVisible()
  await answer(false)
  await expect(asked).not.toHaveAttribute('data-wm-closing')
  await expect(asked).toBeVisible()

  await asked.locator('[data-wm-close]').click()
  await expect(asked).toHaveAttribute('data-wm-closing', '')
  await answer(true)
  await expect(asked).toHaveCount(0)
  expect(await page.evaluate(() => window.__wm.get('t1'))).toBeUndefined()
})

test('minimize hides the window into the taskbar and restores from it', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await window.locator('[data-wm-minimize]').click()
  await expect(window).toBeHidden()
  const task = page.locator('#taskbar [data-task="t1"]')
  await expect(task).toHaveText('Test 1')
  await task.click()
  await expect(window).toBeVisible()
  await expect(window).toHaveAttribute('data-wm-focused', '')
  await expect(page.locator('#taskbar [data-task]')).toHaveCount(0)
})

test('maximize fills the desktop and restore returns the old bounds', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  const before = await boxOf(window)
  await window.locator('[data-wm-maximize]').click()
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  const desktop = await boxOf(page.locator('#desktop'))
  const maxed = await boxOf(window)
  expect(Math.abs(maxed.width - desktop.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(maxed.height - desktop.height)).toBeLessThanOrEqual(2)
  await window.locator('[data-wm-maximize]').click()
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
  const restored = await boxOf(window)
  expect(Math.round(restored.x)).toBe(Math.round(before.x))
  expect(Math.round(restored.width)).toBe(Math.round(before.width))
})

test('double click on the titlebar toggles maximize', async ({ page }) => {
  await spawn(page)
  const window = win(page, 't1')
  await window.locator('[data-wm-drag]').dblclick()
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  await window.locator('[data-wm-drag]').dblclick()
  await expect(window).toHaveAttribute('data-wm-stage', 'normal')
})

test('modal blocks focus on background windows and flashes', async ({ page }) => {
  await spawn(page)
  await spawn(page, 'modal')
  const doc = win(page, 't1')
  const modal = win(page, 'modal2')
  await expect(modal).toHaveAttribute('aria-modal', 'true')
  await modal.evaluate((el) => {
    const seen = { flashed: false }
    Object.assign(window, { flashSeen: seen })
    new MutationObserver(() => {
      if (el.hasAttribute('data-wm-flash')) seen.flashed = true
    }).observe(el, { attributes: true, attributeFilter: ['data-wm-flash'] })
  })

  await doc.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(modal).toHaveAttribute('data-wm-focused', '')
  await expect(doc).not.toHaveAttribute('data-wm-focused', '')
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { flashSeen: { flashed: boolean } }).flashSeen.flashed,
      ),
    )
    .toBe(true)

  await reach(modal)
  await modal.locator('[data-wm-close]').click()
  await doc.locator('[data-wm-content]').click({ position: { x: 10, y: 10 } })
  await expect(doc).toHaveAttribute('data-wm-focused', '')
})

test('screen reader announcements follow window lifecycle', async ({ page }) => {
  await spawn(page)
  const announcer = page.locator('[data-wm-announcer]')
  await expect(announcer).toHaveText(/Test 1 window opened/)
  await win(page, 't1').locator('[data-wm-minimize]').click()
  await expect(announcer).toHaveText(/Test 1 minimized/)
  await page.locator('#taskbar [data-task="t1"]').click()
  await expect(announcer).toHaveText(/Test 1 restored/)
})

test('focus on a control that sticks out of the desktop does not leave the desktop scrolled', async ({
  page,
}) => {
  await spawn(page, 'fixed')
  const target = win(page, 'fixed')
  const desk = await desktopBox(page)
  await page.evaluate((height) => window.__wm.move('fixed', 100, height - 60), desk.height)
  const before = await boxOf(target)
  const scrolled: number[] = []
  await page.exposeFunction('__scrolled', (top: number) => scrolled.push(top))
  await page.evaluate(() => {
    const desktop = document.querySelector('#desktop') as HTMLElement
    desktop.addEventListener(
      'scroll',
      () =>
        (globalThis as unknown as { __scrolled(top: number): void }).__scrolled(desktop.scrollTop),
      true,
    )
  })

  await target.locator('input').evaluate((input: HTMLInputElement) => input.focus())
  await expect
    .poll(() => scrolled.length, 'the browser never tried to scroll the desktop')
    .toBeGreaterThan(0)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const desktop = document.querySelector('#desktop') as HTMLElement
        return [desktop.scrollLeft, desktop.scrollTop]
      }),
    )
    .toEqual([0, 0])
  const after = await boxOf(target)
  expect(
    Math.abs(after.y - before.y),
    'the window is drawn away from its place',
  ).toBeLessThanOrEqual(1)
})
