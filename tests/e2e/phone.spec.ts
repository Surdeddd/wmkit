import { expect, type Page, test } from './fixtures'
import { launchApp, settle } from './utils'

const win = (page: Page, id: string) => page.locator(`[data-testid="window-${id}"]`)
const stageOf = (page: Page, id: string) =>
  page.evaluate((id) => window.__wmDemo.wm.get(id)?.stage ?? null, id)

async function boot(page: Page, lang = 'en'): Promise<void> {
  await page.goto(`?lang=${lang}`)
  await expect(win(page, 'readme')).toBeVisible()
  await settle(win(page, 'readme'))
}

async function widths(page: Page) {
  return page.evaluate(() => ({
    screen: window.innerWidth,
    page: document.documentElement.scrollWidth,
    desktop: (document.querySelector('#desktop') as HTMLElement).clientWidth,
    menubar: Math.max(
      ...[...(document.querySelector('.menubar') as HTMLElement).children].map(
        (node) => node.getBoundingClientRect().right,
      ),
    ),
  }))
}

async function pick(page: Page, action: string): Promise<void> {
  await page.locator('#menu-toggle').click()
  await page.locator(`#menus [data-action="${action}"]`).click()
}

test.use({ viewport: { width: 390, height: 664 } })

for (const size of [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 664 },
]) {
  test(`the page stays as wide as a ${size.width} pixel screen with a full taskbar`, async ({
    page,
  }) => {
    await page.setViewportSize(size)
    await boot(page)
    const start = await widths(page)
    expect(start.page).toBe(start.screen)
    expect(start.desktop).toBe(start.screen)
    expect(start.menubar).toBeLessThanOrEqual(start.screen)

    for (const app of ['terminal', 'inspector', 'layouts', 'notes', 'files']) {
      await launchApp(page, app)
      await expect(win(page, app)).toBeVisible()
    }
    const full = await widths(page)
    expect(full.page).toBe(full.screen)
    expect(full.desktop).toBe(full.screen)
  })
}

test('the menu button opens every menu as one sheet', async ({ page }) => {
  await boot(page)
  const toggle = page.locator('#menu-toggle')
  const sheet = page.locator('#menus')
  await expect(toggle).toBeVisible()
  await expect(sheet).toBeHidden()
  await expect(page.locator('.menu-trigger')).toHaveCount(0)

  await toggle.click()
  await expect(sheet).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(sheet.getByRole('group')).toHaveCount(4)
  for (const name of ['Window', 'Edit', 'Scenes', 'Help']) {
    await expect(sheet.getByRole('group', { name, exact: true })).toBeVisible()
  }
  await expect(sheet.locator('[data-action="redo"]')).toBeDisabled()
  const box = await sheet.boundingBox()
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(664)
  expect(await sheet.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0)
  for (const item of await sheet.locator('[data-action]').all()) {
    expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(36)
  }

  await sheet.locator('[data-action="tour"]').click()
  await expect(win(page, 'tour')).toBeVisible()
  await expect(sheet).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

test('the sheet closes on Escape and on a press outside, and hands the focus back', async ({
  page,
}) => {
  await boot(page)
  const toggle = page.locator('#menu-toggle')
  const sheet = page.locator('#menus')
  await toggle.click()
  await sheet.locator('[data-action="tile"]').focus()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(toggle).toBeFocused()

  await page.setViewportSize({ width: 768, height: 1024 })
  await toggle.click()
  await sheet.locator('.menu-title').first().click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(600, 900)
  await expect(sheet).toBeHidden()
})

test('the apps button opens a drawer of labelled apps and closes it after a launch', async ({
  page,
}) => {
  await boot(page)
  const toggle = page.locator('#apps-toggle')
  const drawer = page.locator('#launcher')
  await expect(toggle).toBeVisible()
  await expect(drawer).toBeHidden()

  await toggle.click()
  await expect(drawer).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await settle(drawer)
  const tiles = await drawer.locator('button').all()
  expect(tiles).toHaveLength(15)
  for (const tile of tiles) {
    const box = await tile.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
    expect((await tile.locator('.lbl').boundingBox())?.width ?? 0).toBeGreaterThan(10)
  }

  await drawer.locator('button[data-app="terminal"]').click()
  await expect(win(page, 'terminal')).toBeVisible()
  await expect(drawer).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await toggle.click()
  await expect(drawer).toBeVisible()
  await drawer.locator('button[data-app="terminal"]').focus()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(toggle).toBeFocused()

  await toggle.click()
  await page.locator('#menu-toggle').click()
  await expect(drawer).toBeHidden()
  await expect(page.locator('#menus')).toBeVisible()
})

test('a minimized window goes to a taskbar button that is on the screen', async ({ page }) => {
  await boot(page)
  await win(page, 'readme').locator('[data-wm-minimize]').click()
  await expect(win(page, 'readme')).toBeHidden()
  const task = page.locator('#dock [data-wm-task="readme"]')
  await expect(task).toBeVisible()
  const box = await task.boundingBox()
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
  await task.click()
  await expect(win(page, 'readme')).toBeVisible()
})

test('the main button splits the phone desktop into two linked windows', async ({ page }) => {
  await boot(page)
  await expect(page.locator('.wallpaper')).toBeVisible()
  await page.locator('#wall-launch').click()
  await expect(win(page, 'tour')).toBeVisible()
  expect(await stageOf(page, 'readme')).toBe('snapped')
  expect(await stageOf(page, 'tour')).toBe('snapped')
  await expect(page.locator('.wallpaper')).toBeHidden()
  await settle(win(page, 'tour'))

  const top = await win(page, 'readme').boundingBox()
  const bottom = await win(page, 'tour').boundingBox()
  expect(top?.width).toBe(390)
  expect(bottom?.width).toBe(390)
  expect(top?.y ?? 0).toBeLessThan(bottom?.y ?? 0)
  const seam = page.locator('#desktop [data-wm-seam]')
  await expect(seam).toHaveCount(1)
  await expect(seam).toHaveAttribute('aria-orientation', 'horizontal')

  await page.evaluate(() => window.__wmDemo.wm.closeAll())
  await expect(page.locator('.wallpaper')).toBeVisible()
})

test('the scenes fit a phone: stacked panels, two tiles, a cascade below the headline', async ({
  page,
}) => {
  await boot(page)
  const boxes = (ids: string[]) =>
    Promise.all(
      ids.map(
        async (id) => (await win(page, id).boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 },
      ),
    )

  await pick(page, 'sceneStudio')
  await expect(win(page, 'code')).toBeVisible()
  await expect(win(page, 'terminal')).toBeVisible()
  await expect(win(page, 'code').locator('.win-tab')).toHaveCount(2)
  await settle(win(page, 'terminal'))
  const [code, shell] = await boxes(['code', 'terminal'])
  expect(code?.width).toBe(390)
  expect(shell?.width).toBe(390)
  expect((code?.y ?? 0) + (code?.height ?? 0)).toBeLessThanOrEqual((shell?.y ?? 0) + 1)

  await pick(page, 'sceneBoard')
  await expect(win(page, 'layouts')).toBeVisible()
  await expect(win(page, 'inspector')).toBeVisible()
  await settle(win(page, 'inspector'))
  const [upper, lower] = await boxes(['layouts', 'inspector'])
  expect(upper?.width).toBe(390)
  expect(lower?.width).toBe(390)
  expect(upper?.y ?? 0).toBeLessThan(lower?.y ?? 0)

  await pick(page, 'sceneRetro')
  await expect(win(page, 'paint')).toBeVisible()
  await settle(win(page, 'paint'))
  const actions = await page.locator('.wallpaper .wall-actions').boundingBox()
  for (const box of await boxes(['readme', 'paint', 'terminal'])) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    expect(box.y).toBeGreaterThanOrEqual((actions?.y ?? 0) + (actions?.height ?? 0))
  }

  await pick(page, 'sceneClean')
  await expect(win(page, 'paint')).toHaveCount(0)
  await expect(win(page, 'readme')).toBeVisible()
})

test('the headline fills the width of the phone and its buttons stay on one line', async ({
  page,
}) => {
  await boot(page)
  const word = await page.locator('.wordmark span').evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    const box = range.getBoundingClientRect()
    return { left: box.left, right: box.right }
  })
  expect(word.left).toBeGreaterThanOrEqual(0)
  expect(word.right).toBeLessThanOrEqual(390)
  await expect(page.locator('#wall-skins')).toBeHidden()
  await expect(page.locator('.lede-more')).toBeHidden()
  const [launch, docs] = await Promise.all(
    ['#wall-launch', '.wallpaper .wall-actions a'].map((selector) =>
      page.locator(selector).boundingBox(),
    ),
  )
  expect(launch?.y).toBe(docs?.y)
  expect(launch?.height ?? 0).toBeGreaterThanOrEqual(44)
  expect((docs?.x ?? 0) + (docs?.width ?? 0)).toBeLessThanOrEqual(390)
})

test('a very short phone drops the lede and still shows a window under the headline', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 460 })
  await boot(page)
  await expect(page.locator('#desktop')).toHaveAttribute('data-fit', 'tight')
  await expect(page.locator('.lede')).toBeHidden()
  const actions = await page.locator('.wallpaper .wall-actions').boundingBox()
  const box = await win(page, 'readme').boundingBox()
  expect(box?.y ?? 0).toBeGreaterThanOrEqual((actions?.y ?? 0) + (actions?.height ?? 0))
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(120)
})

test('a touch screen reads the touch hint and a mouse does not', async ({ page, hasTouch }) => {
  await page.setViewportSize({ width: 412, height: 839 })
  await boot(page)
  await expect(page.locator('#desktop')).toHaveAttribute('data-fit', 'roomy')
  const hint = page.locator('.hint-touch')
  if (hasTouch) await expect(hint).toBeVisible()
  else await expect(hint).toBeHidden()
  await expect(page.locator('.hint:not(.hint-touch)')).toBeHidden()
})

test('a phone on its side puts the headline beside the window', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 })
  await boot(page)
  const hero = await page.locator('.wallpaper .wall-actions').boundingBox()
  const box = await win(page, 'readme').boundingBox()
  expect(box?.x ?? 0).toBeGreaterThanOrEqual((hero?.x ?? 0) + (hero?.width ?? 0))
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(740)
  await expect(win(page, 'terminal')).toHaveCount(0)
})

test('the sheet and the drawer give way to the menubar and the launcher on a wide screen', async ({
  page,
}) => {
  await boot(page)
  await page.locator('#menu-toggle').click()
  await expect(page.locator('#menus')).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.locator('#menu-toggle')).toBeHidden()
  await expect(page.locator('#apps-toggle')).toBeHidden()
  await expect(page.locator('.menu-trigger')).toHaveCount(4)
  await expect(page.locator('.menu-pop').first()).toBeHidden()
  await expect(page.locator('#launcher button[data-app="terminal"]')).toBeVisible()

  await page.setViewportSize({ width: 390, height: 664 })
  await expect(page.locator('.menu-trigger')).toHaveCount(0)
  await expect(page.locator('#menus')).toBeHidden()
  await expect(page.locator('#launcher')).toBeHidden()
})

test('the phone controls speak Russian on the Russian page', async ({ page }) => {
  await boot(page, 'ru')
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-label', 'Меню')
  await expect(page.locator('#apps-toggle')).toHaveText('приложения')
  await page.locator('#menu-toggle').click()
  await expect(page.locator('#menus').getByRole('group', { name: 'Сцены' })).toBeVisible()
  await expect(page.locator('#menus [data-action="theme"]')).toHaveText('Следующая тема')
})

test('the tour speaks of taps on a touch screen and of the mouse elsewhere', async ({
  page,
  hasTouch,
}) => {
  await boot(page)
  await pick(page, 'tour')
  const steps = win(page, 'tour').locator('.tour li')
  await expect(steps).toHaveCount(12)
  if (hasTouch) {
    await expect(steps.first()).toContainText('Press show')
    await expect(win(page, 'tour')).not.toContainText('mouse')
    await expect(win(page, 'tour')).not.toContainText('Alt')
  } else {
    await expect(steps.first()).toContainText('Rest the mouse')
  }
})

test('an untouched desktop follows a phone that is turned on its side, and an arranged one stays', async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, 'the desktop follows a turn only where the pointer is a finger')
  await boot(page)
  await page.setViewportSize({ width: 664, height: 390 })
  await expect(page.locator('#desktop')).toHaveAttribute('data-fit', 'tight')
  await expect(win(page, 'readme')).toBeVisible()
  await settle(win(page, 'readme'))
  const hero = await page.locator('.wallpaper .wall-actions').boundingBox()
  const beside = await win(page, 'readme').boundingBox()
  expect(beside?.x ?? 0).toBeGreaterThanOrEqual((hero?.x ?? 0) + (hero?.width ?? 0))
  expect((beside?.x ?? 0) + (beside?.width ?? 0)).toBeLessThanOrEqual(664)

  const before = await page.evaluate(() => {
    const { wm } = window.__wmDemo
    wm.resize('readme', { x: 330, y: 40, width: 300, height: 180 })
    return wm.get('readme')?.bounds
  })
  await page.setViewportSize({ width: 390, height: 664 })
  await expect(page.locator('#desktop')).toHaveAttribute('data-fit', 'snug')
  const after = await page.evaluate(() => {
    const state = window.__wmDemo.wm.getState()
    return { count: state.order.length, bounds: state.windows.readme?.bounds }
  })
  expect(after.count).toBe(1)
  expect(after.bounds?.width).toBe(before?.width)
  expect(after.bounds?.height).toBe(before?.height)
})
