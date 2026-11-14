import type { DesktopBinder, WindowState } from '@surdeddd/wmkit'
import {
  useDesktop as bindDesktop,
  useWmWindowEl as bindWindow,
  useWindowManager as createManager,
  useWmState as followState,
} from '@surdeddd/wmkit/vue'
import { createApp, defineComponent, h, type PropType, ref } from 'vue'
import '@surdeddd/wmkit/themes/glass.css'

const Win = defineComponent({
  props: {
    binder: { type: Object as PropType<DesktopBinder>, required: true },
    win: { type: Object as PropType<WindowState>, required: true },
  },
  setup(props) {
    const el = ref<HTMLElement | null>(null)
    bindWindow(props.binder, () => props.win.id, el)
    return () =>
      h('section', { ref: el, 'data-testid': `window-${props.win.id}` }, [
        h('header', { 'data-wm-drag': '' }, [
          h('span', { 'data-wm-title': '' }, props.win.title),
          h('span', { 'data-wm-controls': '' }, [
            h('button', { 'data-wm-minimize': '', 'aria-label': 'Minimize', type: 'button' }),
            h('button', { 'data-wm-maximize': '', 'aria-label': 'Maximize', type: 'button' }),
            h('button', { 'data-wm-close': '', 'aria-label': 'Close', type: 'button' }),
          ]),
        ]),
        h('div', { 'data-wm-content': '' }, [
          h(
            'p',
            { 'data-testid': `pos-${props.win.id}` },
            `${Math.round(props.win.bounds.x)},${Math.round(props.win.bounds.y)}`,
          ),
        ]),
      ])
  },
})

const App = defineComponent({
  setup() {
    const wm = createManager()
    Object.assign(window, { __wm: wm })
    const desktop = ref<HTMLElement | null>(null)
    const binder = bindDesktop(wm, desktop)
    const state = followState(wm)
    let counter = 0
    const open = () => {
      counter += 1
      wm.open({ id: `w${counter}`, title: `Vue ${counter}`, width: 320, height: 220 })
    }
    return () => {
      const windows = Object.values(state.value.windows)
      return h('div', { style: 'display:flex;flex-direction:column;height:100%' }, [
        h('div', { style: 'display:flex;gap:8px;padding:8px' }, [
          h('button', { id: 'btn-open', type: 'button', onClick: open }, 'open'),
          h('span', { 'data-testid': 'window-count' }, String(state.value.order.length)),
        ]),
        h(
          'div',
          { ref: desktop, style: 'flex:1;min-height:0' },
          windows.map((win) => h(Win, { key: win.id, binder, win })),
        ),
        h(
          'div',
          { role: 'toolbar', 'aria-label': 'Taskbar', style: 'display:flex;gap:6px;padding:8px' },
          windows
            .filter((win) => win.stage === 'minimized')
            .map((win) =>
              h(
                'button',
                {
                  key: win.id,
                  type: 'button',
                  'data-task': win.id,
                  onClick: () => wm.focus(win.id),
                },
                win.title,
              ),
            ),
        ),
      ])
    }
  },
})

createApp(App).mount('#root')
