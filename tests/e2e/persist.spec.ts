import { expect, type Page, test } from './fixtures'
import { boxOf, dragBy, handle, openVanilla, spawn, win } from './utils'

async function waitPersisted(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('wmkit-e2e')
    if (!raw) return false
    const stored = JSON.parse(raw) as { state?: unknown }
    return JSON.stringify(stored.state) === JSON.stringify(window.__wm.serialize())
  })
}

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('window layout survives a page reload', async ({ page }) => {
  await spawn(page, 'fixed')
  await dragBy(page, handle(page, 'fixed'), 140, 90)
  const moved = await boxOf(win(page, 'fixed'))

  await waitPersisted(page)
  await page.reload()
  const window = win(page, 'fixed')
  await expect(window).toBeVisible()
  const restored = await boxOf(window)
  expect(Math.abs(restored.x - moved.x)).toBeLessThanOrEqual(2)
  expect(Math.abs(restored.y - moved.y)).toBeLessThanOrEqual(2)
})

test('minimized stage survives a reload', async ({ page }) => {
  await spawn(page, 'fixed')
  await win(page, 'fixed').locator('[data-wm-minimize]').click()
  await waitPersisted(page)
  await page.reload()
  await expect(win(page, 'fixed')).toBeHidden()
  await expect(page.locator('#taskbar [data-wm-task="fixed"]')).toBeVisible()
})

test('clear wipes the stored layout', async ({ page }) => {
  await spawn(page, 'fixed')
  await page.click('#btn-clear')
  await page.reload()
  await expect(win(page, 'fixed')).toHaveCount(0)
  await expect(page.getByTestId('window-count')).toHaveText('0')
})

test('a desktop kept in IndexedDB comes back after a reload and stays away once it is cleared', async ({
  page,
}) => {
  const visit = (act: 'open' | 'clear' | 'look') =>
    page.evaluate(async (act) => {
      const { createWindowManager, persist, idbStorage } = window.__wmkit
      const storage = idbStorage({ database: 'wmkit-e2e' })
      const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
      const errors: string[] = []
      const store = persist(wm, {
        key: 'idb-e2e',
        storage,
        onError: (error, phase) => errors.push(`${phase}: ${String(error)}`),
      })
      const restored = await store.ready
      const before = wm.get('kept')?.title ?? null
      if (act === 'open') {
        wm.open({ id: 'kept', title: 'Kept in IndexedDB', x: 40, y: 50, width: 300, height: 200 })
        store.save()
      }
      if (act === 'clear') store.clear()
      const wanted = act === 'open'
      for (let tries = 0; tries < 100; tries += 1) {
        if (((await storage.getItem('idb-e2e')) !== null) === wanted) break
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      store.destroy()
      return { restored, before, errors }
    }, act)

  expect(await visit('open')).toEqual({ restored: false, before: null, errors: [] })
  await page.reload()
  expect(await visit('look')).toEqual({ restored: true, before: 'Kept in IndexedDB', errors: [] })
  expect(await visit('clear')).toEqual({ restored: true, before: 'Kept in IndexedDB', errors: [] })
  await page.reload()
  expect(await visit('look')).toEqual({ restored: false, before: null, errors: [] })
})
