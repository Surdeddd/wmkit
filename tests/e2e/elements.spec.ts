import type { WindowManager } from '@surdeddd/wmkit'
import { expect, type Page, test } from './fixtures'
import { boxOf, dragBy } from './utils'

const managerOf = (page: Page) =>
  page.evaluate(() => {
    const wm = (document.querySelector('wm-desktop') as HTMLElement & { manager: WindowManager })
      .manager
    return wm.getState()
  })

const element = (page: Page, id: string) => page.locator(`wm-window[window-id="${id}"]`)
const bar = (page: Page, id: string) => element(page, id).locator('[part=titlebar]')
const state = (page: Page, id: string) =>
  page.evaluate((id) => {
    const desktop = document.querySelector('wm-desktop') as HTMLElement & {
      manager: { get(id: string): unknown }
    }
    return desktop.manager.get(id) as
      | { stage: string; bounds: { x: number; y: number } }
      | undefined
  }, id)

test.beforeEach(async ({ page }) => {
  await page.goto('test/elements.html')
  await expect(element(page, 'notes')).toHaveAttribute('data-wm-window', 'notes')
})

test('windows declared in markup open where their attributes say', async ({ page }) => {
  await expect(element(page, 'notes')).toBeVisible()
  await expect(element(page, 'later')).toBeHidden()
  await expect(element(page, 'notes').locator('[part=title]')).toHaveText('Notes')
  await expect(page.locator('#notes-field')).toBeVisible()
  await expect(page.locator('#refresh')).toBeVisible()
})

test('a window drags by its shadow titlebar and resizes by its grips', async ({ page }) => {
  const before = await boxOf(element(page, 'notes'))
  await dragBy(page, bar(page, 'notes').locator('[part=title]'), 80, 50, { steps: 10 })
  const moved = await boxOf(element(page, 'notes'))
  expect(Math.abs(moved.x - before.x - 80)).toBeLessThanOrEqual(14)
  await dragBy(page, element(page, 'notes').locator('[data-wm-resize="se"]'), 40, 30, { steps: 6 })
  const grown = await boxOf(element(page, 'notes'))
  expect(grown.width).toBeGreaterThan(moved.width + 20)
})

test('the shadow buttons minimize, maximize and close, and the stage is reflected', async ({
  page,
}) => {
  await bar(page, 'chart').locator('[part~=maximize]').click()
  await expect(element(page, 'chart')).toHaveAttribute('stage', 'maximized')
  await bar(page, 'chart').locator('[part~=maximize]').click()
  await expect(element(page, 'chart')).toHaveAttribute('stage', 'normal')
  await bar(page, 'chart').locator('[part~=minimize]').click()
  await expect(element(page, 'chart')).toHaveAttribute('stage', 'minimized')
  await expect(element(page, 'chart')).toBeHidden()
  await page.evaluate(() =>
    document.querySelector('[window-id="chart"]')?.setAttribute('stage', 'normal'),
  )
  await expect(element(page, 'chart')).toBeVisible()
  await bar(page, 'chart').locator('[part~=close]').click()
  await expect(element(page, 'chart')).toHaveAttribute('closed', '')
  expect(await state(page, 'chart')).toBeUndefined()
})

test('attributes move a window and a closed window opens when it is unclosed', async ({ page }) => {
  await page.evaluate(() => document.querySelector('[window-id="notes"]')?.setAttribute('x', '150'))
  await expect.poll(async () => (await state(page, 'notes'))?.bounds.x).toBe(150)
  await page.evaluate(() =>
    document.querySelector('[window-id="later"]')?.removeAttribute('closed'),
  )
  await expect(element(page, 'later')).toBeVisible()
  await expect(element(page, 'later').locator('[part=title]')).toHaveText('Later')
})

test('a grouped window switches tabs from its strip by click, arrows and Enter', async ({
  page,
}) => {
  const activeTab = async () => {
    const state = await managerOf(page)
    return state.groups[state.windows.notes?.groupId ?? '']?.activeId
  }
  await page.evaluate(() => {
    const wm = (document.querySelector('wm-desktop') as HTMLElement & { manager: WindowManager })
      .manager
    wm.group(['notes', 'chart'])
    wm.activateTab('notes')
  })
  const strip = element(page, 'notes').locator('[part=tabs]')
  await expect(strip).toBeVisible()
  await expect(strip).toHaveAttribute('role', 'tablist')
  await expect(element(page, 'notes').locator('[part=title]')).toBeHidden()
  await expect(strip.locator('[role=tab]')).toHaveText(['Notes', 'Chart'])
  await expect(strip.locator('[role=tab][aria-selected=true]')).toHaveText('Notes')

  await strip.locator('[role=tab][data-window-id=chart]').click()
  await expect.poll(activeTab).toBe('chart')
  await expect(element(page, 'chart')).toBeVisible()
  await expect(element(page, 'notes')).toBeHidden()
  const chartStrip = element(page, 'chart').locator('[part=tabs]')
  await expect(chartStrip.locator('[part~=active]')).toBeFocused()
  await expect(chartStrip.locator('[part~=active]')).toHaveText('Chart')

  await page.keyboard.press('ArrowRight')
  await expect(chartStrip.locator('[data-window-id=notes]')).toBeFocused()
  await expect.poll(activeTab).toBe('chart')
  await page.keyboard.press('ArrowRight')
  await expect(chartStrip.locator('[data-window-id=chart]')).toBeFocused()
  await page.keyboard.press('End')
  await expect(chartStrip.locator('[data-window-id=chart]')).toBeFocused()
  await page.keyboard.press('Home')
  await expect(chartStrip.locator('[data-window-id=notes]')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect.poll(activeTab).toBe('notes')
  await expect(element(page, 'notes')).toBeVisible()
  await expect(element(page, 'notes').locator('[part~=active]')).toBeFocused()

  await page.evaluate(() => {
    const wm = (document.querySelector('wm-desktop') as HTMLElement & { manager: WindowManager })
      .manager
    wm.ungroup('chart')
  })
  await expect(element(page, 'notes').locator('[part=tabs]')).toBeHidden()
  await expect(element(page, 'notes').locator('[part=title]')).toHaveText('Notes')
})

test('the chrome shows only the buttons the window allows', async ({ page }) => {
  const controls = element(page, 'notes').locator('[data-wm-controls] [part~=control]')
  await expect(controls).toHaveCount(3)
  for (const name of ['minimize', 'maximize', 'close']) {
    await expect(element(page, 'notes').locator(`[part~=${name}]`)).toBeVisible()
  }
  await page.evaluate(() => {
    const notes = document.querySelector('[window-id="notes"]') as HTMLElement
    notes.setAttribute('minimizable', 'false')
    notes.setAttribute('closable', 'false')
  })
  await expect(element(page, 'notes').locator('[part~=minimize]')).toBeHidden()
  await expect(element(page, 'notes').locator('[part~=close]')).toBeHidden()
  await expect(element(page, 'notes').locator('[part~=maximize]')).toBeVisible()

  await page.evaluate(() =>
    document.querySelector('[window-id="notes"]')?.setAttribute('minimizable', 'true'),
  )
  await expect(element(page, 'notes').locator('[part~=minimize]')).toBeVisible()
})

test('desktop styles bring a theme titlebar into every window, added later too', async ({
  page,
}) => {
  const titlebar = (id: string) =>
    page.evaluate((target) => {
      const host = document.querySelector(`[window-id="${target}"]`) as HTMLElement
      const bar = host.shadowRoot?.querySelector('[part=titlebar]') as HTMLElement
      return getComputedStyle(bar).backgroundImage
    }, id)
  expect(await titlebar('notes')).toBe('none')

  await page.evaluate(() => {
    const desktop = document.querySelector('wm-desktop') as HTMLElement & { styles: unknown }
    desktop.styles = window.__themes.retroShadowTheme
  })
  expect(await titlebar('notes')).toContain('linear-gradient')
  expect(await titlebar('chart')).toContain('linear-gradient')

  await page.evaluate(() => {
    const late = document.createElement('wm-window')
    late.setAttribute('window-id', 'late')
    late.setAttribute('label', 'Late')
    late.setAttribute('x', '400')
    late.setAttribute('y', '260')
    document.querySelector('wm-desktop')?.append(late)
  })
  await expect(element(page, 'late')).toBeVisible()
  expect(await titlebar('late')).toContain('linear-gradient')

  await page.evaluate(() => {
    const desktop = document.querySelector('wm-desktop') as HTMLElement & { styles: unknown }
    desktop.styles = null
  })
  expect(await titlebar('notes')).toBe('none')
})

test.describe('with persist', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('test/elements.html?persist=wmkit-e2e-elements')
    await page.evaluate(() => localStorage.removeItem('wmkit-e2e-elements'))
    await page.reload()
    await expect(element(page, 'notes')).toHaveAttribute('data-wm-window', 'notes')
  })

  const closedInStorage = (page: Page) =>
    page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('wmkit-e2e-elements') ?? '{}')
      return (saved.state?.extensions?.elements?.closed ?? []) as string[]
    })

  test('a closed panel stays closed after a reload and opens again on request', async ({
    page,
  }) => {
    await bar(page, 'chart').locator('[part~=close]').click()
    await expect(element(page, 'chart')).toHaveAttribute('closed', '')
    await expect.poll(() => closedInStorage(page)).toContain('chart')

    await page.reload()
    await expect(element(page, 'notes')).toBeVisible()
    await expect(element(page, 'chart')).toHaveAttribute('closed', '')
    await expect(element(page, 'chart')).toBeHidden()
    expect(await state(page, 'chart')).toBeUndefined()

    await page.evaluate(() =>
      document.querySelector('[window-id="chart"]')?.removeAttribute('closed'),
    )
    await expect(element(page, 'chart')).toBeVisible()
    await expect.poll(() => closedInStorage(page)).not.toContain('chart')
    expect(await closedInStorage(page)).toContain('later')
  })

  test('undo brings a closed panel back on screen', async ({ page }) => {
    await bar(page, 'chart').locator('[part~=close]').click()
    await expect(element(page, 'chart')).toBeHidden()
    await element(page, 'notes').focus()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(element(page, 'chart')).toBeVisible()
    await expect(element(page, 'chart')).not.toHaveAttribute('closed')
    await expect(element(page, 'chart')).toHaveAttribute('data-wm-window', 'chart')
    expect((await state(page, 'chart'))?.stage).toBe('normal')
    const y = (await state(page, 'chart'))?.bounds.y ?? 0
    await dragBy(page, bar(page, 'chart').locator('[part=title]'), 0, 50, { steps: 6 })
    await expect.poll(async () => (await state(page, 'chart'))?.bounds.y).toBeGreaterThan(y + 30)
  })
})

test('typing in a slotted field stays in the window and keeps it focused', async ({ page }) => {
  await page.locator('#notes-field').click()
  await page.keyboard.type(' world')
  await expect(page.locator('#notes-field')).toHaveValue('hello world')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            document.querySelector('wm-desktop') as HTMLElement & {
              manager: { getState(): { focusedId: string } }
            }
          ).manager.getState().focusedId,
      ),
    )
    .toBe('notes')
})
