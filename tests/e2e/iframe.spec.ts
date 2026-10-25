import { expect, type Page, test } from './fixtures'
import { boxOf, dragBy, openVanilla, spawn, win } from './utils'

type FrameKind = 'srcdoc' | 'data' | 'sandbox'

async function openFrameWindow(
  page: Page,
  id: string,
  x: number,
  kind: FrameKind = 'srcdoc',
): Promise<void> {
  await page.evaluate(
    ({ id, x, kind }) => {
      window.__spawn({ id, title: id, x, y: 60, width: 190, height: 260 }, (body) => {
        body.style.padding = '0'
        const frame = document.createElement('iframe')
        frame.id = `frame-${id}`
        frame.title = id
        const html = '<body style="margin:0;height:100vh"><input id="field"><h1>frame</h1></body>'
        if (kind === 'data') frame.src = `data:text/html,${encodeURIComponent(html)}`
        else frame.srcdoc = html
        if (kind === 'sandbox') frame.setAttribute('sandbox', '')
        frame.style.cssText = 'display:block;width:100%;height:100%;border:0'
        body.append(frame)
      })
    },
    { id, x, kind },
  )
}

async function clickInFrame(page: Page, id: string): Promise<void> {
  const box = await boxOf(page.locator(`#frame-${id}`))
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 40)
}

const focused = (page: Page) => page.evaluate(() => window.__wm.getState().focusedId)
const topmost = (page: Page) => page.evaluate(() => window.__wm.getState().order.at(-1))

test.beforeEach(async ({ page }) => {
  await openVanilla(page)
})

for (const kind of ['srcdoc', 'data', 'sandbox'] as const) {
  test(`a click inside a ${kind} frame raises and focuses its window`, async ({ page }) => {
    await openFrameWindow(page, 'a', 4, kind)
    await openFrameWindow(page, 'b', 204, kind)
    await spawn(page, 'fixed')
    await page.evaluate(() =>
      window.__wm.restoreTo('fixed', { x: 40, y: 340, width: 240, height: 160 }),
    )
    expect(await focused(page)).toBe('fixed')

    await clickInFrame(page, 'a')
    await expect.poll(() => focused(page)).toBe('a')
    expect(await topmost(page)).toBe('a')
  })
}

test('moving from one frame straight into another follows the click', async ({ page }) => {
  await openFrameWindow(page, 'a', 4)
  await openFrameWindow(page, 'b', 204)
  await clickInFrame(page, 'a')
  await expect.poll(() => focused(page)).toBe('a')

  await clickInFrame(page, 'b')
  await expect.poll(() => focused(page)).toBe('b')
  await clickInFrame(page, 'a')
  await expect.poll(() => focused(page)).toBe('a')
})

test('a frame in a window below a modal takes no clicks', async ({ page }) => {
  await openFrameWindow(page, 'a', 4)
  await spawn(page, 'modal')
  const modal = await page.evaluate(() => window.__wm.getState().focusedId)
  const typed = page.frameLocator('#frame-a').locator('#field')

  const field = await typed.boundingBox()
  if (!field) throw new Error('the frame field has no box')
  await page.mouse.click(field.x + field.width / 2, field.y + field.height / 2)
  await page.keyboard.type('x')
  await expect(typed).toHaveValue('')
  expect(await focused(page)).toBe(modal)

  await page.evaluate((id) => window.__wm.close(id as string), modal)
  await clickInFrame(page, 'a')
  await expect.poll(() => focused(page)).toBe('a')
})

test('a resize across a frame keeps tracking the pointer', async ({ page }) => {
  await openFrameWindow(page, 'a', 4)
  await spawn(page, 'fixed')
  await page.evaluate(() =>
    window.__wm.restoreTo('fixed', { x: 4, y: 360, width: 300, height: 160 }),
  )
  const grip = win(page, 'fixed').locator('[data-wm-resize="n"]')
  const before = await boxOf(win(page, 'fixed'))

  await dragBy(page, grip, 0, -200, { steps: 25 })
  const after = await boxOf(win(page, 'fixed'))
  expect(Math.abs(after.height - before.height - 200)).toBeLessThanOrEqual(14)
})

test('a skin rebuild keeps a frame running where the browser can move it', async ({ page }) => {
  const canMove = await page.evaluate(() => 'moveBefore' in Element.prototype)
  test.skip(!canMove, 'Element.prototype.moveBefore is not available in this engine')
  await page.evaluate(() => {
    const plain = (title: string) => (ctx: { doc: Document }) => {
      const element = ctx.doc.createElement('section')
      element.dataset.testid = 'window-k'
      const header = ctx.doc.createElement('header')
      header.dataset.wmDrag = ''
      header.textContent = title
      const content = ctx.doc.createElement('div')
      content.dataset.wmContent = ''
      element.append(header, content)
      return { element, content }
    }
    window.__wm.open({ id: 'k', title: 'k', x: 60, y: 60, width: 380, height: 280 })
    const mounted = window.__desktop.mountWindow('k', plain('one'))
    const frame = document.createElement('iframe')
    frame.id = 'frame-k'
    frame.srcdoc = '<body><input id="field"></body>'
    mounted.content.append(frame)
    ;(window as unknown as { __remount: () => void }).__remount = () =>
      window.__desktop.mountWindow('k', plain('two'))
  })
  const field = page.frameLocator('#frame-k').locator('#field')
  await field.fill('kept')
  await page.evaluate(() => (window as unknown as { __remount: () => void }).__remount())
  await expect(win(page, 'k').locator('header')).toHaveText('two')
  await expect(field).toHaveValue('kept')
})
