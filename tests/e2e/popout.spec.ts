import { expect, type Page, test } from './fixtures'
import { openVanilla, spawn, win } from './utils'

async function armPopout(page: Page, target: 'window' | 'pip'): Promise<void> {
  await page.evaluate((target) => {
    const content = document.querySelector<HTMLElement>(
      '[data-testid="window-fixed"] [data-wm-content]',
    ) as HTMLElement
    const counter = document.createElement('button')
    counter.id = 'counter'
    counter.type = 'button'
    counter.textContent = '0'
    counter.addEventListener('click', () => {
      counter.textContent = String(Number(counter.textContent) + 1)
    })
    content.append(counter)
    const trigger = document.createElement('button')
    trigger.id = 'pop'
    trigger.type = 'button'
    trigger.textContent = 'pop out'
    trigger.addEventListener('click', () => {
      void window.__popout(window.__wm, 'fixed', content, { target })
    })
    document.body.append(trigger)
  }, target)
}

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
  await spawn(page, 'fixed')
})

test('a window pops out into its own browser window and comes back', async ({ page }) => {
  await armPopout(page, 'window')
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#pop')])
  const counter = popup.locator('#counter')
  await expect(counter).toBeVisible()
  await counter.click()
  await expect(counter).toHaveText('1')
  await expect.poll(() => popup.title()).toBe('Fixed')
  await expect(win(page, 'fixed')).toBeHidden()

  await page.evaluate(() => window.__wm.update('fixed', { title: 'Renamed' }))
  await expect.poll(() => popup.title()).toBe('Renamed')

  await popup.close()
  await expect(win(page, 'fixed')).toBeVisible()
  await expect(win(page, 'fixed').locator('#counter')).toHaveText('1')
})

test('closing the window in the manager closes its popout', async ({ page }) => {
  await armPopout(page, 'window')
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#pop')])
  await expect(popup.locator('#counter')).toBeVisible()
  await Promise.all([popup.waitForEvent('close'), page.evaluate(() => window.__wm.close('fixed'))])
  expect(popup.isClosed()).toBe(true)
})

test('picture-in-picture where the engine has it', async ({ page }) => {
  const has = await page.evaluate(() => 'documentPictureInPicture' in window)
  test.skip(!has, 'this engine has no Document Picture-in-Picture')
  await armPopout(page, 'pip')
  await page.click('#pop')
  await expect
    .poll(() => page.evaluate(() => window.documentPictureInPicture?.window !== null))
    .toBe(true)
  await expect(win(page, 'fixed')).toBeHidden()
  await page.evaluate(() => window.documentPictureInPicture?.window?.close())
  await expect
    .poll(() => page.evaluate(() => window.documentPictureInPicture?.window ?? null))
    .toBeNull()
  await expect(win(page, 'fixed')).toBeVisible()
})
