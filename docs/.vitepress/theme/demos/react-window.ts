import type { DesktopBinder, WindowState } from '@surdeddd/wmkit'
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import glass from '@surdeddd/wmkit/themes/glass.css?inline'
import { createElement as h, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { FRAME, injectCss } from './style'

function Window({ binder, win }: { binder: DesktopBinder; win: WindowState }) {
  const ref = useWmWindowRef(binder, win.id)
  return h(
    'section',
    { ref },
    h(
      'header',
      { 'data-wm-drag': '' },
      h('span', { 'data-wm-title': '' }, win.title),
      h(
        'span',
        { 'data-wm-controls': '' },
        h('button', { 'data-wm-minimize': '', 'aria-label': 'Minimize', type: 'button' }),
        h('button', { 'data-wm-maximize': '', 'aria-label': 'Maximize', type: 'button' }),
        h('button', { 'data-wm-close': '', 'aria-label': 'Close', type: 'button' }),
      ),
    ),
    h(
      'div',
      { 'data-wm-content': '', style: { padding: 12, font: '14px system-ui' } },
      `x ${Math.round(win.bounds.x)}, y ${Math.round(win.bounds.y)}, ${Math.round(win.bounds.width)} × ${Math.round(win.bounds.height)}`,
    ),
  )
}

function App() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  useEffect(() => {
    if (wm.getState().order.length > 0) return
    wm.open({ id: 'notes', title: 'Notes', x: 24, y: 24, width: 300, height: 190, minWidth: 220 })
    wm.open({ id: 'tasks', title: 'Tasks', x: 200, y: 120, width: 280, height: 180 })
  }, [wm])
  return h(
    'div',
    { ref, style: { background: 'linear-gradient(135deg, #1b2240, #301b3c)' } },
    Object.values(state.windows).map((win) => h(Window, { key: win.id, binder, win })),
    h(
      'button',
      {
        type: 'button',
        style: { position: 'absolute', right: 12, bottom: 12, zIndex: 1 },
        onClick: () => wm.open({ title: 'Window', width: 260, height: 170 }),
      },
      'New window',
    ),
  )
}

export function mount(element: HTMLElement): () => void {
  const drop = injectCss(FRAME + glass)
  const root = createRoot(element)
  root.render(h(App))
  return () => {
    root.unmount()
    drop()
  }
}
