import '@surdeddd/wmkit/themes/glass.css'
import { component$, jsx, render, useComputed$ } from '@builder.io/qwik'
import loader from '@builder.io/qwik/qwikloader.js?raw'
import { useWm, useWmState, WmDesktop, WmWindow } from '@surdeddd/wmkit/qwik'

const Count = component$(() => {
  const state = useWmState()
  const count = useComputed$(() => state.value?.order.length ?? 0)
  return jsx('output', { id: 'count', children: count.value })
})

const Opener = component$(() => {
  const store = useWm()
  return jsx('button', {
    id: 'open',
    type: 'button',
    onClick$: () => {
      const wm = store.wm
      if (!wm) return
      if (wm.get('notes'))
        wm.open({ id: 'extra', title: 'Extra', x: 340, y: 40, width: 240, height: 160 })
      else wm.open({ id: 'notes', title: 'Notes', x: 20, y: 60, width: 280, height: 180 })
    },
    children: 'open',
  })
})

const App = component$(() =>
  jsx(WmDesktop, {
    class: 'desktop',
    children: [
      jsx(WmWindow, {
        id: 'notes',
        title: 'Notes',
        x: 20,
        y: 60,
        width: 280,
        height: 180,
        children: [
          jsx('button', {
            'q:slot': 'controls',
            id: 'notes-close',
            type: 'button',
            'data-wm-close': '',
            'aria-label': 'Close',
            children: '×',
          }),
          jsx('p', { id: 'notes-body', children: 'qwik content' }),
        ],
      }),
      jsx(Count, {}),
      jsx(Opener, {}),
    ],
  }),
)

render(document.getElementById('app') as HTMLElement, jsx(App, {})).then(() => {
  const script = document.createElement('script')
  script.textContent = loader
  document.head.append(script)
})
