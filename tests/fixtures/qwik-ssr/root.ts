import { $, component$, jsx, type QRL, useComputed$, useSignal } from '@builder.io/qwik'
import { useWm, useWmState, WmDesktop, WmWindow } from '@surdeddd/wmkit/qwik'

const Count = component$(() => {
  const state = useWmState()
  const count = useComputed$(() => state.value?.order.length ?? 0)
  return jsx('output', { id: 'count', children: count.value })
})

const button = (id: string, onClick$: QRL<() => unknown>) =>
  jsx('button', { id, type: 'button', onClick$, children: id })

const Manager = component$(() => {
  const store = useWm()
  return jsx('nav', {
    children: [
      button(
        'drag',
        $(() => store.wm?.move('notes', 200, 150)),
      ),
      button(
        'minimize',
        $(() => store.wm?.minimize('notes')),
      ),
      button(
        'restore',
        $(() => store.wm?.restore('notes')),
      ),
      button(
        'reopen',
        $(() => store.wm?.open({ id: 'notes', title: 'Notes', x: 20, y: 60, width: 280 })),
      ),
    ],
  })
})

export const Root = component$(() => {
  const x = useSignal(20)
  const width = useSignal(280)
  const renames = useSignal(0)
  const title = useComputed$(() => (renames.value === 0 ? 'Notes' : `Notes ${renames.value}`))
  const tone = useComputed$(() => (renames.value === 0 ? 'plain' : 'loud'))
  return jsx(WmDesktop, {
    class: 'desktop',
    options: { autoViewport: false, announce: false, viewport: { width: 800, height: 600 } },
    options$: $(() => ({ windowVariant: () => 'resumed' })),
    children: [
      jsx(WmWindow, {
        id: 'notes',
        title: title.value,
        class: tone.value,
        x: x.value,
        y: 60,
        width: width.value,
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
          jsx('p', { id: 'notes-body', children: 'server content' }),
        ],
      }),
      jsx(Count, {}),
      jsx('output', { id: 'width', children: width.value }),
      jsx(Manager, {}),
      button(
        'shift',
        $(() => {
          x.value += 100
        }),
      ),
      button(
        'grow',
        $(() => {
          width.value += 40
        }),
      ),
      button(
        'rename',
        $(() => {
          renames.value += 1
        }),
      ),
    ],
  })
})
