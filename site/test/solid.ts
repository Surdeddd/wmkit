import {
  createDesktop,
  useWindowManager as createManager,
  useWmState as followState,
  useWmWindow as followWindow,
} from '@surdeddd/wmkit/solid'
import { For } from 'solid-js'
import h from 'solid-js/h'
import { render } from 'solid-js/web'
import '@surdeddd/wmkit/themes/glass.css'

const built = (...parts: unknown[]): Node => (h(...parts) as unknown as () => Node)()

function App() {
  const wm = createManager()
  Object.assign(window, { __wm: wm })
  const dk = createDesktop(wm)
  const state = followState(wm)
  let counter = 0
  const open = (_event: Event) => {
    counter += 1
    wm.open({ id: `w${counter}`, title: `Solid ${counter}`, width: 320, height: 220 })
  }

  const Win = (props: { id: string }) => {
    const win = followWindow(wm, props.id)
    return built(
      'section',
      { ref: dk.window(props.id), 'data-testid': `window-${props.id}` },
      h(
        'header',
        { 'data-wm-drag': '' },
        h('span', { 'data-wm-title': '' }, () => win()?.title),
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
          { 'data-testid': `pos-${props.id}` },
          () => `${Math.round(win()?.bounds.x ?? 0)},${Math.round(win()?.bounds.y ?? 0)}`,
        ),
      ),
    )
  }

  return h(
    'div',
    { style: 'display:flex;flex-direction:column;height:100%' },
    h(
      'div',
      { style: 'display:flex;gap:8px;padding:8px' },
      h('button', { id: 'btn-open', type: 'button', onClick: open }, 'open'),
      h('span', { 'data-testid': 'window-count' }, () => String(state().order.length)),
    ),
    h(
      'div',
      { ref: dk.desktop, style: 'flex:1;min-height:0' },
      h(For, { each: () => Object.keys(state().windows) }, (id: string) => Win({ id })),
    ),
    h(
      'div',
      { role: 'toolbar', 'aria-label': 'Taskbar', style: 'display:flex;gap:6px;padding:8px' },
      h(
        For,
        {
          each: () =>
            Object.values(state().windows)
              .filter((win) => win.stage === 'minimized')
              .map((win) => win.id),
        },
        (id: string) =>
          built(
            'button',
            { type: 'button', 'data-task': id, onClick: (_event: Event) => wm.focus(id) },
            () => state().windows[id]?.title,
          ),
      ),
    ),
  )
}

render(h(App) as unknown as () => Node, document.querySelector('#root') as HTMLElement)
