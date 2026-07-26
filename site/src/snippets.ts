export const snippets: Array<{ id: string; label: string; code: string }> = [
  {
    id: 'vanilla',
    label: 'vanilla',
    code: `import { createWindowManager, attachDesktop } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))

const win = wm.open({ title: 'Hello', width: 420, height: 280 })
desktop.attachWindow(win.id, myWindowElement)

wm.on('stage', ({ window }) => console.log(window.title, window.stage))
wm.snap(win.id, 'left-third')
wm.undo()`,
  },
  {
    id: 'react',
    label: 'react',
    code: `import {
  useWindowManager, useDesktop, useWmState, useWmWindowRef,
} from '@surdeddd/wmkit/react'

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
        <button data-wm-close />
      </header>
      <div data-wm-content>{win.meta.body}</div>
    </section>
  )
}`,
  },
  {
    id: 'vue',
    label: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue'
import { useWindowManager, useDesktop, useWmState, useWmWindowEl } from '@surdeddd/wmkit/vue'

const host = ref<HTMLElement>()
const wm = useWindowManager()
const binder = useDesktop(wm, host)
const state = useWmState(wm)

const panel = ref<HTMLElement>()
useWmWindowEl(binder, 'notes', panel)
wm.open({ id: 'notes', title: 'Notes' })
</script>

<template>
  <div ref="host" class="desktop">
    <section ref="panel">
      <header data-wm-drag><span data-wm-title>Notes</span></header>
      <div data-wm-content>{{ state.order.length }} windows</div>
    </section>
  </div>
</template>`,
  },
  {
    id: 'svelte',
    label: 'svelte',
    code: `<script lang="ts">
  import { createManager, createDesktop, wmStore } from '@surdeddd/wmkit/svelte'

  const wm = createManager()
  const dk = createDesktop(wm)
  const state = wmStore(wm)

  wm.open({ id: 'notes', title: 'Notes' })
</script>

<div class="desktop" use:dk.desktop>
  <section use:dk.window={{ id: 'notes' }}>
    <header data-wm-drag><span data-wm-title>Notes</span></header>
    <div data-wm-content>{$state.order.length} windows</div>
  </section>
</div>`,
  },
  {
    id: 'solid',
    label: 'solid',
    code: `import { useWindowManager, createDesktop, useWmState } from '@surdeddd/wmkit/solid'

function Desktop() {
  const wm = useWindowManager()
  const dk = createDesktop(wm)
  const state = useWmState(wm)

  wm.open({ id: 'notes', title: 'Notes' })

  return (
    <div class="desktop" ref={dk.desktop}>
      <section ref={dk.window('notes')}>
        <header data-wm-drag><span data-wm-title>Notes</span></header>
        <div data-wm-content>{state().order.length} windows</div>
      </section>
    </div>
  )
}`,
  },
  {
    id: 'angular',
    label: 'angular',
    code: `import { Component, ElementRef, viewChild, afterNextRender } from '@angular/core'
import { useWindowManager, createDesktop, useWmState } from '@surdeddd/wmkit/angular'

@Component({
  selector: 'app-desktop',
  template: \`
    <div class="desktop" #host>
      <section #panel>
        <header data-wm-drag><span data-wm-title>Notes</span></header>
        <div data-wm-content>{{ state().order.length }} windows</div>
      </section>
    </div>\`,
})
export class DesktopComponent {
  private host = viewChild.required<ElementRef>('host')
  private panel = viewChild.required<ElementRef>('panel')
  wm = useWindowManager()
  state = useWmState(this.wm)

  constructor() {
    const dk = createDesktop(this.wm)
    afterNextRender(() => {
      dk.desktop(this.host().nativeElement)
      this.wm.open({ id: 'notes', title: 'Notes' })
      dk.window('notes')(this.panel().nativeElement)
    })
  }
}`,
  },
]

const KEYWORDS =
  /\b(import|from|const|let|function|return|export|class|new|await|async|type|interface|private|constructor)\b/g

export function highlight(code: string): string {
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped
    .replace(/(\/\/[^\n]*)/g, '<span class="com">$1</span>')
    .replace(/('[^'\n]*'|`[^`]*`)/g, '<span class="str">$1</span>')
    .replace(KEYWORDS, '<span class="kw">$1</span>')
    .replace(/\b([a-zA-Z_$][\w$]*)\(/g, '<span class="fn">$1</span>(')
}
