export const snippets: Array<{ id: string; label: string; code: string }> = [
  {
    id: 'vanilla',
    label: 'Vanilla',
    code: `import { createWindowManager, attachDesktop } from 'wmkit'
import 'wmkit/themes/glass.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))

const win = wm.open({ title: 'Hello', width: 420, height: 280 })
desktop.attachWindow(win.id, myWindowElement)

wm.on('stage', ({ window }) => console.log(window.title, window.stage))
wm.snap(win.id, 'left')`,
  },
  {
    id: 'react',
    label: 'React',
    code: `import { useWindowManager, useDesktop, useWmState, useWmWindowRef } from 'wmkit/react'

function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)

  return (
    <div ref={ref} className="desktop">
      {state.order.map((id) => (
        <Win key={id} binder={binder} win={state.windows[id]} />
      ))}
    </div>
  )
}

function Win({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id)
  return (
    <section ref={ref}>
      <header data-wm-drag>
        <span data-wm-title>{win.title}</span>
        <button data-wm-close aria-label="Close" />
      </header>
      <div data-wm-content>anything you render stays yours</div>
    </section>
  )
}`,
  },
  {
    id: 'vue',
    label: 'Vue',
    code: `<script setup>
import { ref } from 'vue'
import { useWindowManager, useDesktop, useWmWindowEl, useWmState } from 'wmkit/vue'

const wm = useWindowManager()
const desktopEl = ref(null)
const binder = useDesktop(wm, desktopEl)
const state = useWmState(wm)

const noteEl = ref(null)
useWmWindowEl(binder, 'note', noteEl)
wm.open({ id: 'note', title: 'Заметка' })
</script>

<template>
  <div ref="desktopEl" class="desktop">
    <section ref="noteEl">
      <header data-wm-drag><span data-wm-title>{{ state.windows.note?.title }}</span></header>
      <div data-wm-content>composables all the way down</div>
    </section>
  </div>
</template>`,
  },
  {
    id: 'svelte',
    label: 'Svelte',
    code: `<script>
  import { createManager, createDesktop, wmWindowStore } from 'wmkit/svelte'

  const wm = createManager()
  const dk = createDesktop(wm)
  wm.open({ id: 'main', title: 'Hello' })
  const main = wmWindowStore(wm, 'main')
</script>

<div use:dk.desktop class="desktop">
  <section use:dk.window={{ id: 'main' }}>
    <header data-wm-drag><span data-wm-title>{$main?.title}</span></header>
    <div data-wm-content>stores and actions, no wrappers</div>
  </section>
</div>`,
  },
  {
    id: 'solid',
    label: 'Solid',
    code: `import { For } from 'solid-js'
import { useWindowManager, createDesktop, useWmState } from 'wmkit/solid'

function Desktop() {
  const wm = useWindowManager()
  const dk = createDesktop(wm)
  const state = useWmState(wm)
  wm.open({ title: 'Hello' })

  return (
    <div ref={dk.desktop} class="desktop">
      <For each={state().order}>
        {(id) => (
          <section ref={dk.window(id)}>
            <header data-wm-drag>
              <span data-wm-title>{state().windows[id]?.title}</span>
            </header>
            <div data-wm-content>fine-grained, obviously</div>
          </section>
        )}
      </For>
    </div>
  )
}`,
  },
]

const escapeHtml = (raw: string) =>
  raw.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const TOKEN =
  /(\/\/[^\n]*)|('[^'\n]*'|`[^`]*`|"[^"\n]*")|\b(import|from|export|const|let|function|return|new|await|async|setup|use|each)\b|\b(\d+)\b/g

export function highlight(code: string): string {
  return escapeHtml(code).replace(TOKEN, (match, cm, str, kw) => {
    const cls = cm ? 'cm' : str ? 'str' : kw ? 'kw' : 'num'
    return `<span class="tok-${cls}">${match}</span>`
  })
}
