import { expect, test } from './fixtures'

test('the layout is in place when the page styles arrive late', async ({ page, context }) => {
  await context.route(/\.css$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600))
    await route.continue()
  })
  await page.goto('test/dashboard/')
  await expect
    .poll(() => page.evaluate(() => document.querySelector('wm-desktop')?.clientHeight ?? 0))
    .toBeGreaterThan(0)
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const { desktop, dock } = (
            window as unknown as {
              __dashboard: {
                desktop: { manager: { getState(): { windows: Record<string, { stage: string }> } } }
                dock: { layout(): { root: unknown } }
              }
            }
          ).__dashboard
          const stages = Object.values(desktop.manager.getState().windows).map((w) => w.stage)
          const boxes = [...document.querySelectorAll('wm-window')].map((el) =>
            el.getBoundingClientRect(),
          )
          let overlaps = 0
          for (const [i, a] of boxes.entries()) {
            for (const b of boxes.slice(i + 1)) {
              const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
              const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
              if (w > 1 && h > 1) overlaps += 1
            }
          }
          return {
            layout: dock.layout().root !== null,
            docked: document.querySelectorAll('wm-window[data-wm-docked]').length,
            snapped: stages.filter((stage) => stage === 'snapped').length,
            overlaps,
          }
        }),
      { timeout: 4000 },
    )
    .toEqual({ layout: true, docked: 4, snapped: 4, overlaps: 0 })
})
