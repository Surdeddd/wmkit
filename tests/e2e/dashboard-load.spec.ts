import { expect, test } from './fixtures'

test('the layout is in place when the page styles arrive late', async ({
  page,
  context,
  browserName,
}) => {
  test.fail(
    browserName === 'webkit',
    'WebKit runs the module before the stylesheet, and the dock drops a layout set while the desktop has no size',
  )
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
          return {
            layout: dock.layout().root !== null,
            docked: document.querySelectorAll('wm-window[data-wm-docked]').length,
            snapped: stages.filter((stage) => stage === 'snapped').length,
          }
        }),
      { timeout: 4000 },
    )
    .toEqual({ layout: true, docked: 4, snapped: 4 })
})
