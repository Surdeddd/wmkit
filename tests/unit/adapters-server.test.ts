import { createEnvironmentInjector, Injector, runInInjectionContext } from '@angular/core'
import { createElement, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { compile } from 'svelte/compiler'
import { describe, expect, it } from 'vitest'
import {
  createDesktop as angularDesktop,
  useWmState as angularState,
  useWindowManager as createAngularManager,
} from '../../src/adapters/angular'
import {
  useDesktop as reactDesktop,
  useWmState as reactState,
  useWmWindow as reactWindow,
  useWmWindowRef as reactWindowRef,
} from '../../src/adapters/react'
import { createManager, wmStore, wmWindowStore } from '../../src/adapters/svelte'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager, WindowState } from '../../src/core/types'

describe('the adapters on a server', () => {
  it('have no document or window to lean on', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  it('react renders every window into the markup and leaves no subscription behind', () => {
    const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
    wm.open({ id: 'notes', title: 'Notes', x: 20, y: 30, width: 300, height: 200 })
    wm.open({ id: 'chart', title: 'Chart', x: 80, y: 90, width: 300, height: 200 })
    let live = 0
    const subscribe = wm.subscribe
    wm.subscribe = (listener) => {
      live += 1
      const stop = subscribe(listener)
      return () => {
        live -= 1
        stop()
      }
    }

    function Win({ id, manager }: { id: string; manager: WindowManager }): ReactElement | null {
      const win = reactWindow(manager, id)
      const { binder } = reactDesktop(manager)
      const ref = reactWindowRef(binder, id)
      return win ? createElement('section', { ref, 'data-id': win.id }, win.title) : null
    }
    function App(): ReactElement {
      const state = reactState(wm)
      const { ref } = reactDesktop(wm)
      return createElement(
        'div',
        { ref },
        state.order.map((id) => createElement(Win, { key: id, id, manager: wm })),
      )
    }

    const html = renderToString(createElement(App))
    expect(html).toContain('<section data-id="notes">Notes</section>')
    expect(html).toContain('<section data-id="chart">Chart</section>')
    expect(html).not.toContain('data-wm-window')
    expect(live, 'a server render kept listening to the manager').toBe(0)
  })

  it('svelte renders from its stores, and the actions wait for a browser', async () => {
    const source = `<script>
      import { createDesktop, wmStore } from '../../src/adapters/svelte'
      let { wm } = $props()
      const dk = createDesktop(wm)
      const desk = wmStore(wm)
    </script>
    <div use:dk.desktop>
      {#each Object.values($desk.windows) as win (win.id)}
        <section use:dk.window={{ id: win.id }} data-id={win.id}>{win.title}</section>
      {/each}
    </div>`
    const { js } = compile(source, { generate: 'server', filename: 'Desk.svelte' })
    const adapter = await import('../../src/adapters/svelte')
    const server = await import('svelte/internal/server' as string)
    const store = await import('svelte/store')
    const run = new Function(
      'adapter',
      'server',
      'store',
      js.code
        .replace(/import \* as \$ from 'svelte\/internal\/server';?/, 'const $ = server;')
        .replace(
          /import \{ createDesktop, wmStore \} from '[^']+';?/,
          'const { createDesktop, wmStore } = adapter;',
        )
        .replace(/import ['"]svelte\/internal\/[^'"]+['"];?/g, '')
        .replace(/export default function (\w+)/, 'return function $1'),
    ) as (...modules: unknown[]) => unknown
    const Desk = run(adapter, server, store)
    const wm = createManager({ viewport: { width: 1200, height: 800 } })
    wm.open({ id: 'notes', title: 'Notes' })
    const { render } = await import('svelte/server')
    const { body } = render(Desk as never, { props: { wm } } as never)
    expect(body).toContain('data-id="notes"')
    expect(body).toContain('Notes')
    expect(body).not.toContain('data-wm-window')

    let seen: WindowState | undefined
    const stop = wmWindowStore(wm, 'notes').subscribe((win) => {
      seen = win
    })
    wm.update('notes', { title: 'Renamed' })
    expect(seen?.title).toBe('Renamed')
    stop()
    let order: readonly string[] = []
    wmStore(wm).subscribe((state) => {
      order = state.order
    })()
    expect(order).toEqual(['notes'])
  })

  it('lit controllers read the state without a DOM, and the directives import', async () => {
    const lit = await import('../../src/adapters/lit')
    const wm = createWindowManager()
    wm.open({ id: 'notes', title: 'Notes' })
    let updates = 0
    const controllers: Array<{ hostConnected?(): void; hostDisconnected?(): void }> = []
    const host = {
      addController: (controller: (typeof controllers)[number]) => controllers.push(controller),
      removeController: () => {},
      requestUpdate: () => {
        updates += 1
      },
      updateComplete: Promise.resolve(true),
    }
    const view = new lit.WmStateController(host as never, wm)
    expect(view.state.order).toEqual(['notes'])
    for (const controller of controllers) controller.hostConnected?.()
    wm.open({ id: 'chart' })
    expect(view.state.order).toEqual(['notes', 'chart'])
    expect(updates).toBeGreaterThan(0)
    for (const controller of controllers) controller.hostDisconnected?.()
    expect(typeof lit.wmDesktop).toBe('function')
    expect(typeof lit.wmWindow).toBe('function')
  })

  it('angular signals follow the manager inside an injector with no platform', () => {
    const scope = createEnvironmentInjector([], Injector.create({ providers: [] }) as never)
    const { wm, state, desk } = runInInjectionContext(scope, () => {
      const made = createAngularManager({ viewport: { width: 1200, height: 800 } })
      return { wm: made, state: angularState(made), desk: angularDesktop(made) }
    })
    wm.open({ id: 'notes', title: 'Notes' })
    expect(state().order).toEqual(['notes'])
    expect(desk.binder.controller()).toBeNull()
    scope.destroy()
    expect(() => wm.getState()).not.toThrow()
  })
})
