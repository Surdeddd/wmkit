import { expect, type Page, test } from './fixtures'
import { openVanilla, settle, spawn, win } from './utils'

interface Probe {
  resized: Array<{ gap: number; live: boolean }>
  painted: number[]
  sampling: boolean
}

function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => (window as unknown as { __probe: Probe }).__probe)
}

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

test('a maximized window follows a browser resize in the frame of the resize', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await window.locator('[data-wm-maximize]').click()
  await expect(window).toHaveAttribute('data-wm-stage', 'maximized')
  await settle(window)

  await page.evaluate(() => {
    const desk = document.querySelector('#desktop') as HTMLElement
    const el = document.querySelector('[data-testid="window-fixed"]') as HTMLElement
    const gap = () =>
      Math.round(desk.getBoundingClientRect().width - el.getBoundingClientRect().width)
    const state: Probe = { resized: [], painted: [], sampling: true }
    ;(window as unknown as { __probe: Probe }).__probe = state
    new ResizeObserver(() => {
      state.resized.push({ gap: gap(), live: el.hasAttribute('data-wm-live') })
    }).observe(desk)
    const channel = new MessageChannel()
    channel.port1.onmessage = () => state.painted.push(gap())
    const tick = () => {
      if (!state.sampling) return
      channel.port2.postMessage(null)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await expect.poll(async () => (await probe(page)).resized.length).toBe(1)

  const size = page.viewportSize() as { width: number; height: number }
  await page.setViewportSize({ width: size.width - 200, height: size.height - 60 })
  await expect.poll(async () => (await probe(page)).resized.length).toBe(2)
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    ;(window as unknown as { __probe: Probe }).__probe.sampling = false
  })

  const { resized, painted } = await probe(page)
  const [rest, during] = resized as [Probe['resized'][number], Probe['resized'][number]]
  expect(during.gap - rest.gap, 'the window lagged behind the desktop').toBe(0)
  const lag = painted.map((gap) => Math.abs(gap - rest.gap))
  expect(Math.max(...lag), `lag per painted frame: ${lag.join(' ')}`).toBeLessThanOrEqual(1)
  expect(rest.live).toBe(false)
  expect(during.live, 'the window was not marked live while the desktop resized').toBe(true)
  await expect(window).not.toHaveAttribute('data-wm-live')
})

test('a window at rest keeps easing its own geometry changes', async ({ page }) => {
  await spawn(page, 'fixed')
  const window = win(page, 'fixed')
  await settle(window)
  await expect(window).not.toHaveAttribute('data-wm-live')
  expect(await window.evaluate((el) => getComputedStyle(el).transitionProperty)).toContain(
    'transform',
  )
})
