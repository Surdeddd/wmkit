import { attachDesktop, createWindowManager, type WindowInit } from '@surdeddd/wmkit'
import { createDock } from '@surdeddd/wmkit/dock'
import { persist } from '@surdeddd/wmkit/persist'
import '@surdeddd/wmkit/themes/glass.css'

const element = document.querySelector('#desktop') as HTMLElement
const wm = createWindowManager()
const desktop = attachDesktop(wm, element)
const dock = createDock(desktop, {
  area: (viewport) =>
    viewport.width >= 700
      ? { x: 0, y: 0, width: Math.round(viewport.width * 0.7), height: viewport.height }
      : { x: 0, y: 0, width: viewport.width, height: Math.round(viewport.height * 0.65) },
  minSize: { width: 120, height: 80 },
})
const store = persist(wm, { key: 'wmkit-dock-e2e', debounce: 0 })

const wide = window.innerWidth >= 700
const free = (offset: number) =>
  wide
    ? { x: Math.round(window.innerWidth * 0.72), y: 20 + offset }
    : { x: 10 + offset, y: Math.round(window.innerHeight * 0.68) }
const defaults: WindowInit[] = [
  { id: 'files', title: 'Files', width: 260, height: 220 },
  { id: 'editor', title: 'Editor', width: 360, height: 260 },
  { id: 'preview', title: 'Preview', ...free(0), width: 200, height: 160 },
  { id: 'terminal', title: 'Terminal', ...free(wide ? 200 : 180), width: 200, height: 160 },
]

function mount(id: string): void {
  const win = wm.get(id)
  if (!win) return
  const el = document.createElement('section')
  el.dataset.testid = `window-${id}`
  el.innerHTML = `
    <header data-wm-drag>
      <span data-wm-title></span>
      <span data-wm-controls>
        <button data-wm-maximize aria-label="Maximize" type="button"></button>
        <button data-wm-close aria-label="Close" type="button"></button>
      </span>
    </header>
    <div data-wm-content></div>
  `
  const body = el.querySelector('[data-wm-content]') as HTMLElement
  if (id === 'editor') {
    const frame = document.createElement('iframe')
    frame.title = 'Editor surface'
    frame.srcdoc = '<p style="font:14px system-ui;padding:8px">editor</p>'
    body.append(frame)
  } else {
    body.textContent = `${win.title} panel`
  }
  element.append(el)
  desktop.attachWindow(id, el, { removeOnClose: true })
}

if (wm.getState().order.length === 0) {
  for (const init of defaults) wm.open(init)
  dock.setLayout({
    root: {
      kind: 'split',
      id: 'main',
      axis: 'row',
      children: [
        { kind: 'stack', id: 'left', windows: ['files'], active: 'files' },
        { kind: 'stack', id: 'centre', windows: ['editor'], active: 'editor' },
      ],
      sizes: [0.35, 0.65],
    },
  })
  wm.clearHistory()
}
for (const id of wm.getState().order) mount(id)

Object.assign(window, { __dock: { wm, dock, store } })
