import type { DesktopBinder, WindowManager, WindowState } from '@surdeddd/wmkit'
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/preact'
import { h, render } from 'preact'
import { useState } from 'preact/hooks'
import '@surdeddd/wmkit/themes/glass.css'

function Win({ binder, win }: { binder: DesktopBinder; win: WindowState }) {
  const ref = useWmWindowRef(binder, win.id)
  return h(
    'section',
    { ref, 'data-testid': `window-${win.id}` },
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
      { 'data-wm-content': '' },
      h(
        'p',
        { 'data-testid': `pos-${win.id}` },
        `${Math.round(win.bounds.x)},${Math.round(win.bounds.y)}`,
      ),
    ),
  )
}

function Taskbar({ wm }: { wm: WindowManager }) {
  const state = useWmState(wm)
  return h(
    'div',
    { role: 'toolbar', 'aria-label': 'Taskbar', style: { display: 'flex', gap: 6, padding: 8 } },
    Object.values(state.windows)
      .filter((win) => win.stage === 'minimized')
      .map((win) =>
        h(
          'button',
          { key: win.id, type: 'button', 'data-task': win.id, onClick: () => wm.focus(win.id) },
          win.title,
        ),
      ),
  )
}

function App() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  const [counter, setCounter] = useState(0)
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    h(
      'div',
      { style: { display: 'flex', gap: 8, padding: 8 } },
      h(
        'button',
        {
          id: 'btn-open',
          type: 'button',
          onClick: () => {
            const next = counter + 1
            setCounter(next)
            wm.open({ id: `w${next}`, title: `Preact ${next}`, width: 320, height: 220 })
          },
        },
        'open',
      ),
      h('span', { 'data-testid': 'window-count' }, String(state.order.length)),
    ),
    h(
      'div',
      { ref, style: { flex: 1, minHeight: 0 } },
      Object.values(state.windows).map((win) => h(Win, { key: win.id, binder, win })),
    ),
    h(Taskbar, { wm }),
  )
}

render(h(App, null), document.querySelector('#root') as HTMLElement)
