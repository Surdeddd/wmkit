import type { CDPSession, Page } from '@playwright/test'
import { expect, test } from './fixtures'

interface Footprint {
  nodes: number
  listeners: number
  heap: number
}

async function footprint(cdp: CDPSession): Promise<Footprint> {
  for (let pass = 0; pass < 3; pass += 1) await cdp.send('HeapProfiler.collectGarbage')
  const { metrics } = await cdp.send('Performance.getMetrics')
  const read = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? 0
  return { nodes: read('Nodes'), listeners: read('JSEventListeners'), heap: read('JSHeapUsedSize') }
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
    await frame()
    const ending = document
      .getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
    await Promise.all(ending.map((animation) => animation.finished.catch(() => undefined)))
    await frame()
    await frame()
  })
}

function grown(before: Footprint, after: Footprint): Record<keyof Footprint, number> {
  return {
    nodes: after.nodes - before.nodes,
    listeners: after.listeners - before.listeners,
    heap: Math.round((after.heap - before.heap) / 1024),
  }
}

test.describe('nothing is left behind', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile,
    'the footprint is read through the Chromium debugging protocol',
  )

  test('by five thousand windows opened, attached and closed', async ({ page, context }) => {
    test.setTimeout(180_000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.goto('test/vanilla.html')
    await expect(page.locator('#desktop')).toBeVisible()
    const cycle = (count: number) =>
      page.evaluate((rounds) => {
        const desktop = document.querySelector('#desktop') as HTMLElement
        for (let round = 0; round < rounds; round += 1) {
          const id = `leak-${round % 7}`
          window.__wm.open({ id, title: id, x: 20 + (round % 50), y: 20, width: 260, height: 180 })
          const el = document.createElement('section')
          el.innerHTML =
            '<header data-wm-drag><span data-wm-title></span><button data-wm-close type="button"></button></header><div data-wm-content><p>text</p></div>'
          desktop.append(el)
          window.__desktop.attachWindow(id, el, { removeOnClose: true })
          if (round % 3 === 0) window.__wm.maximize(id)
          if (round % 5 === 0) window.__wm.minimize(id)
          window.__wm.close(id)
        }
        window.__wm.clearHistory()
      }, count)

    await cycle(300)
    await settle(page)
    const before = await footprint(cdp)
    await cycle(5000)
    await settle(page)
    const after = await footprint(cdp)
    const growth = grown(before, after)
    expect(growth.nodes, 'DOM nodes stayed alive').toBeLessThanOrEqual(20)
    expect(growth.listeners, 'event listeners stayed registered').toBeLessThanOrEqual(5)
    expect(growth.heap, 'the heap grew, in kB').toBeLessThanOrEqual(3072)
  })

  test('by a thousand web component windows added and removed', async ({ page, context }) => {
    test.setTimeout(180_000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.goto('test/elements.html')
    await expect(page.locator('wm-window[window-id="notes"]')).toBeVisible()
    const cycle = (count: number) =>
      page.evaluate(async (rounds) => {
        const desktop = document.querySelector('wm-desktop') as HTMLElement & {
          manager: typeof window.__wm
        }
        let opened = 0
        const stop = desktop.manager.on('open', () => {
          opened += 1
        })
        for (let round = 0; round < rounds; round += 1) {
          const node = document.createElement('wm-window')
          node.setAttribute('window-id', `leak-${round % 5}`)
          node.setAttribute('label', 'Leak')
          node.innerHTML = '<p>text</p>'
          desktop.append(node)
          await Promise.resolve()
          if (round % 2 === 0) node.setAttribute('stage', 'maximized')
          await Promise.resolve()
          node.remove()
          await Promise.resolve()
          if (round % 100 === 99) await new Promise((resolve) => setTimeout(resolve, 0))
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
        stop()
        desktop.manager.clearHistory()
        return opened
      }, count)

    await cycle(100)
    await settle(page)
    const before = await footprint(cdp)
    expect(await cycle(1000), 'the windows never opened, so nothing was tested').toBe(1000)
    await settle(page)
    const growth = grown(before, await footprint(cdp))
    expect(growth.nodes, 'DOM nodes stayed alive').toBeLessThanOrEqual(20)
    expect(growth.listeners, 'event listeners stayed registered').toBeLessThanOrEqual(5)
    expect(growth.heap, 'the heap grew, in kB').toBeLessThanOrEqual(3072)
  })

  test('by five hundred drags, resizes and cancelled gestures', async ({ page, context }) => {
    test.setTimeout(180_000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.goto('test/vanilla.html')
    await page.click('#btn-open-fixed')
    await expect(page.locator('[data-testid="window-fixed"]')).toBeVisible()
    const cycle = (count: number) =>
      page.evaluate(async (rounds) => {
        const root = document.querySelector('[data-testid="window-fixed"]') as HTMLElement
        const handle = root.querySelector('[data-wm-drag]') as HTMLElement
        const grip = root.querySelector('[data-wm-resize="se"]') as HTMLElement
        const fire = (target: Element, type: string, x: number, y: number, buttons: number) =>
          target.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              pointerId: 1,
              pointerType: 'mouse',
              button: 0,
              buttons,
              clientX: x,
              clientY: y,
            }),
          )
        const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
        for (let round = 0; round < rounds; round += 1) {
          const target = round % 2 === 0 ? handle : grip
          const box = target.getBoundingClientRect()
          const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
          fire(target, 'pointerdown', x, y, 1)
          fire(target, 'pointermove', x + 30, y + 20, 1)
          await frame()
          if (round % 3 === 0) {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
          } else if (round % 3 === 1) {
            fire(target, 'pointercancel', x + 30, y + 20, 0)
          } else {
            fire(target, 'pointerup', x + 30, y + 20, 0)
            window.__wm.restoreTo('fixed', { x: 100, y: 100, width: 320, height: 220 })
          }
        }
        await frame()
        window.__wm.clearHistory()
      }, count)

    await cycle(40)
    const before = await footprint(cdp)
    await cycle(500)
    await settle(page)
    const growth = grown(before, await footprint(cdp))
    expect(growth.nodes, 'DOM nodes stayed alive').toBeLessThanOrEqual(10)
    expect(growth.listeners, 'event listeners stayed registered').toBeLessThanOrEqual(2)
    expect(growth.heap, 'the heap grew, in kB').toBeLessThanOrEqual(2048)
  })

  test('by three hundred rounds of docking and undocking', async ({ page, context }) => {
    test.setTimeout(180_000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    await page.goto('test/dock.html')
    await expect(page.locator('[data-wm-sash]').first()).toBeVisible()
    const cycle = (count: number) =>
      page.evaluate((rounds) => {
        const held = (
          window as unknown as {
            __dock: {
              wm: typeof window.__wm
              dock: { dock(id: string, to: object): boolean; undock(id: string): boolean }
            }
          }
        ).__dock
        const sides = ['left', 'right', 'top', 'bottom']
        for (let round = 0; round < rounds; round += 1) {
          held.dock.dock('preview', { side: sides[round % 4] })
          held.dock.dock('terminal', { side: sides[(round + 1) % 4] })
          held.dock.undock('preview')
          held.dock.undock('terminal')
        }
        held.wm.clearHistory()
      }, count)

    await cycle(30)
    await settle(page)
    const before = await footprint(cdp)
    await cycle(300)
    await settle(page)
    const growth = grown(before, await footprint(cdp))
    expect(growth.nodes, 'DOM nodes stayed alive').toBeLessThanOrEqual(10)
    expect(growth.listeners, 'event listeners stayed registered').toBeLessThanOrEqual(2)
    expect(growth.heap, 'the heap grew, in kB').toBeLessThanOrEqual(2048)
  })
})
