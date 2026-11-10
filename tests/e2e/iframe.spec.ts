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

test('a frame in a window opened under a modal is shielded and given back as it was', async ({
  page,
}) => {
  await spawn(page, 'modal')
  const modal = await page.evaluate(() => window.__wm.getState().focusedId as string)
  await page.evaluate(() => {
    window.__spawn({ id: 'late', title: 'late', x: 4, y: 60, width: 190, height: 260 }, (body) => {
      const frame = document.createElement('iframe')
      frame.id = 'frame-late'
      frame.srcdoc = '<body style="margin:0;height:100vh"><input id="field"></body>'
      frame.style.cssText = 'display:block;width:100%;height:100%;border:0;pointer-events:auto'
      body.append(frame)
    })
  })
  const pointerEvents = () =>
    page.evaluate(() => (document.querySelector('#frame-late') as HTMLElement).style.pointerEvents)
  expect(await pointerEvents()).toBe('none')
  expect(await focused(page)).toBe(modal)

  await page.evaluate((id) => window.__wm.close(id), modal)
  await expect.poll(pointerEvents).toBe('auto')
  await clickInFrame(page, 'late')
  await expect.poll(() => focused(page)).toBe('late')
})

test('a desktop inside a same-origin frame answers its buttons and keys', async ({ page }) => {
  await page.evaluate(() => {
    const frame = document.createElement('iframe')
    frame.id = 'inner'
    frame.style.cssText =
      'position:fixed;left:0;top:0;width:360px;height:300px;border:0;z-index:99999;background:#fff'
    document.body.append(frame)
    const doc = frame.contentDocument as Document
    doc.body.style.margin = '0'
    doc.body.innerHTML =
      '<div id="desk" style="position:relative;width:360px;height:300px;overflow:hidden"></div>'
    const desk = doc.querySelector('#desk') as HTMLElement
    const { attachDesktop, createWindowManager } = window.__wmkit
    const wm = createWindowManager()
    const desktop = attachDesktop(wm, desk, { animation: false })
    wm.open({ id: 'inside', title: 'inside', x: 20, y: 20, width: 220, height: 160 })
    const el = doc.createElement('section')
    el.style.cssText = 'background:#eee;border:1px solid #888'
    el.innerHTML =
      '<header data-wm-drag style="display:flex;height:28px"><span data-wm-title>inside</span>' +
      '<button type="button" data-wm-maximize aria-label="Maximize">M</button>' +
      '<button type="button" data-wm-close aria-label="Close">X</button></header>' +
      '<div data-wm-content><input id="field"></div>'
    desk.append(el)
    desktop.attachWindow('inside', el)
    ;(window as unknown as { __inner: typeof wm }).__inner = wm
  })
  const inner = page.frameLocator('#inner')
  const bounds = () =>
    page.evaluate(
      () => (window as unknown as { __inner: typeof window.__wm }).__inner.get('inside') ?? null,
    )

  await inner.getByRole('button', { name: 'Maximize' }).click()
  await expect.poll(async () => (await bounds())?.stage).toBe('maximized')
  await inner.getByRole('button', { name: 'Maximize' }).click()
  await expect.poll(async () => (await bounds())?.stage).toBe('normal')

  await inner.locator('section[data-wm-window]').focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await bounds())?.bounds.x).toBe(36)

  await inner.locator('#field').click()
  await inner.locator('#field').pressSequentially('ab')
  await page.keyboard.press('ControlOrMeta+z')
  expect((await bounds())?.bounds.x, 'undo typed into a field undid the window').toBe(36)

  await inner.locator('section[data-wm-window]').focus()
  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await bounds())?.bounds.x).toBe(20)

  await inner.getByRole('button', { name: 'Close' }).click()
  await expect.poll(bounds).toBeNull()
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
