import { attachDesktop, createWindowManager, type WindowInit, type WindowState } from 'wmkit'
import { persist } from 'wmkit/persist'
import 'wmkit/themes/glass.css'

function must<T>(value: T | null): T {
  if (!value) throw new Error('test page markup missing')
  return value
}

const desktopEl = must(document.querySelector<HTMLElement>('#desktop'))
const taskbarEl = must(document.querySelector<HTMLElement>('#taskbar'))
const countEl = must(document.querySelector<HTMLElement>('#window-count'))

const wm = createWindowManager()
const desktop = attachDesktop(wm, desktopEl, {
  minimizeTarget: (win) => taskbarEl.querySelector(`[data-task="${win.id}"]`),
})
const store = persist(wm, { key: 'wmkit-e2e' })

const detachers = new Map<string, () => void>()

function buildWindowElement(win: WindowState, content: (body: HTMLElement) => void): HTMLElement {
  const el = document.createElement('section')
  el.dataset.testid = `window-${win.id}`
  el.innerHTML = `
    <header data-wm-drag>
      <span data-wm-title>${win.title}</span>
      <span data-wm-controls>
        <button data-wm-minimize aria-label="Minimize" type="button"></button>
        <button data-wm-maximize aria-label="Maximize" type="button"></button>
        <button data-wm-close aria-label="Close" type="button"></button>
      </span>
    </header>
    <div data-wm-content></div>
  `
  const body = el.querySelector<HTMLElement>('[data-wm-content]')
  if (body) content(body)
  return el
}

function mountWindow(win: WindowState, content: (body: HTMLElement) => void): void {
  const el = buildWindowElement(win, content)
  desktopEl.append(el)
  detachers.set(win.id, desktop.attachWindow(win.id, el))
}

function spawn(init: WindowInit, content?: (body: HTMLElement) => void): WindowState {
  const win = wm.open(init)
  mountWindow(
    win,
    content ??
      ((body) => {
        const text = document.createElement('p')
        text.textContent = `Content of ${win.title}`
        const input = document.createElement('input')
        input.type = 'text'
        input.placeholder = 'type here'
        body.append(text, input)
      }),
  )
  return win
}

wm.on('close', ({ window: win }) => {
  detachers.get(win.id)?.()
  detachers.delete(win.id)
  desktopEl.querySelector(`[data-testid="window-${win.id}"]`)?.remove()
})

function renderTaskbar(): void {
  taskbarEl.replaceChildren(
    ...wm.minimized().map((win) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.task = win.id
      button.textContent = win.title
      button.addEventListener('click', () => wm.focus(win.id))
      return button
    }),
  )
}

wm.subscribe((state) => {
  renderTaskbar()
  countEl.textContent = String(state.order.length)
})
renderTaskbar()
countEl.textContent = String(wm.getState().order.length)

let counter = 0

document.querySelector('#btn-open')?.addEventListener('click', () => {
  counter += 1
  spawn({ id: `t${counter}`, title: `Test ${counter}`, width: 320, height: 220 })
})

document.querySelector('#btn-open-modal')?.addEventListener('click', () => {
  counter += 1
  spawn({
    id: `modal${counter}`,
    title: `Modal ${counter}`,
    layer: 'modal',
    width: 300,
    height: 180,
    x: 200,
    y: 120,
  })
})

document.querySelector('#btn-open-iframe')?.addEventListener('click', () => {
  counter += 1
  spawn(
    { id: `frame${counter}`, title: `Frame ${counter}`, width: 400, height: 300, x: 60, y: 60 },
    (body) => {
      body.style.padding = '0'
      const frame = document.createElement('iframe')
      frame.srcdoc = '<body style="margin:0"><h1>iframe content</h1></body>'
      frame.title = 'embedded frame'
      body.append(frame)
    },
  )
})

document.querySelector('#btn-open-fixed')?.addEventListener('click', () => {
  spawn({ id: 'fixed', title: 'Fixed', x: 100, y: 100, width: 320, height: 220 })
})

document.querySelector('#btn-stress')?.addEventListener('click', () => {
  wm.batch(() => {
    for (let i = 0; i < 50; i += 1) {
      counter += 1
      spawn({
        id: `s${counter}`,
        title: `Stress ${counter}`,
        width: 240,
        height: 160,
        x: (i % 10) * 90 + 10,
        y: Math.floor(i / 10) * 90 + 10,
      })
    }
  })
})

document.querySelector('#btn-clear')?.addEventListener('click', () => {
  wm.closeAll()
  store.clear()
  counter = 0
})

const saved = wm.getState()
for (const id of saved.order) {
  const win = saved.windows[id]
  if (win)
    mountWindow(win, (body) => {
      const text = document.createElement('p')
      text.textContent = `Content of ${win.title}`
      body.append(text)
    })
}

declare global {
  interface Window {
    __wm: typeof wm
    __spawn: typeof spawn
  }
}
window.__wm = wm
window.__spawn = spawn
