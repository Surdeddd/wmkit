<script>
import { createDesktop, createManager, wmStore } from '@surdeddd/wmkit/svelte'
import { fade } from 'svelte/transition'

const wm = createManager()
Object.assign(window, { __wm: wm })
const dk = createDesktop(wm)
const desk = wmStore(wm)
let counter = 0

function open() {
  counter += 1
  wm.open({ id: `w${counter}`, title: `Svelte ${counter}`, width: 320, height: 220 })
}
</script>

<div style="display:flex;flex-direction:column;height:100%">
  <div style="display:flex;gap:8px;padding:8px">
    <button id="btn-open" type="button" onclick={open}>open</button>
    <span data-testid="window-count">{$desk.order.length}</span>
  </div>
  <div use:dk.desktop style="flex:1;min-height:0">
    {#each Object.values($desk.windows) as win (win.id)}
      <section
        use:dk.window={{ id: win.id }}
        data-testid={`window-${win.id}`}
        out:fade={{ duration: 150 }}
      >
        <header data-wm-drag>
          <span data-wm-title>{win.title}</span>
          <span data-wm-controls>
            <button data-wm-minimize aria-label="Minimize" type="button"></button>
            <button data-wm-maximize aria-label="Maximize" type="button"></button>
            <button data-wm-close aria-label="Close" type="button"></button>
          </span>
        </header>
        <div data-wm-content>
          <p data-testid={`pos-${win.id}`}>{Math.round(win.bounds.x)},{Math.round(win.bounds.y)}</p>
        </div>
      </section>
    {/each}
  </div>
  <div role="toolbar" aria-label="Taskbar" style="display:flex;gap:6px;padding:8px">
    {#each Object.values($desk.windows).filter((win) => win.stage === 'minimized') as win (win.id)}
      <button type="button" data-task={win.id} onclick={() => wm.focus(win.id)}>{win.title}</button>
    {/each}
  </div>
</div>
