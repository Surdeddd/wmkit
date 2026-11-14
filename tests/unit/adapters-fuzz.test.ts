// @vitest-environment jsdom
import fc from 'fast-check'
import { html, render as litRender, nothing } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { h as ph, render as preactRender } from 'preact'
import { act as preactAct } from 'preact/test-utils'
import { createElement, act as reactAct, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick, shallowRef, h as vh, ref as vref } from 'vue'
import { wmDesktop, wmWindow } from '../../src/adapters/lit'
import * as preactAdapter from '../../src/adapters/preact'
import * as reactAdapter from '../../src/adapters/react'
import * as vueAdapter from '../../src/adapters/vue'
import { createWindowManager } from '../../src/core/manager'
import type { ManagerState, WindowManager } from '../../src/core/types'
import { createDesktopBinder, type DesktopBinder } from '../../src/dom/binder'
import { domDrift, stateDrift } from './support/dom-state'
import { stubFrames } from './support/frames'
import { breathe, fuzz, patience } from './support/fuzz'
import { trackResources } from './support/resources'

const { useWmState: vueState, useDesktop: vueDesktop, useWmWindowEl: vueWindow } = vueAdapter
const IDS = ['a', 'b', 'c', 'd'] as const
type Id = (typeof IDS)[number]
const OPTIONS = { autoViewport: false, announce: false } as const

interface Knobs {
  desktop: boolean
  hidden: ReadonlySet<string>
  variant: number
  flip: boolean
  strict: boolean
}

interface App {
  update(knobs: Knobs): Promise<void>
  settle(run?: () => void): Promise<void>
  unmount(): Promise<void>
}

type Driver = (wm: WindowManager, host: HTMLElement, knobs: Knobs) => Promise<App>

type Action =
  | { do: 'open' | 'close' | 'minimize' | 'maximize' | 'restore' | 'focus'; id: Id }
  | { do: 'move'; id: Id; x: number; y: number }
  | { do: 'group'; id: Id; other: Id }
  | { do: 'ungroup'; id: Id }
  | { do: 'undo' }
  | { do: 'redo' }
  | { do: 'hide' | 'show'; id: Id }
  | { do: 'desktop' }
  | { do: 'variant' }
  | { do: 'flip' }
  | { do: 'strict' }
  | { do: 'remount' }

function shownIds(state: ManagerState, knobs: Knobs): string[] {
  return Object.keys(state.windows).filter((id) => !knobs.hidden.has(id))
}

const react: Driver = async (wm, host, first) => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  function Win(props: { binder: DesktopBinder; id: string; title: string }) {
    const bind = reactAdapter.useWmWindowRef(props.binder, props.id)
    return createElement(
      'section',
      { ref: bind, 'data-testid': props.id },
      createElement(
        'header',
        { 'data-wm-drag': '' },
        createElement('span', { 'data-wm-title': '' }, props.title),
      ),
    )
  }
  function Root(props: { knobs: Knobs }) {
    const state = reactAdapter.useWmState(wm)
    const desk = reactAdapter.useDesktop(wm, OPTIONS)
    const { knobs } = props
    if (!knobs.desktop) return createElement('p', { className: 'off' })
    return createElement(
      knobs.flip ? 'main' : 'div',
      { ref: desk.ref, className: 'desktop', key: knobs.flip ? 'main' : 'div' },
      shownIds(state, knobs).map((id) =>
        createElement(Win, {
          key: `${id}:${knobs.variant}`,
          binder: desk.binder,
          id,
          title: state.windows[id]?.title ?? '',
        }),
      ),
    )
  }
  const root = createRoot(host)
  const draw = (knobs: Knobs) => {
    const tree = createElement(Root, { knobs })
    root.render(knobs.strict ? createElement(StrictMode, null, tree) : tree)
  }
  await reactAct(async () => draw(first))
  return {
    update: (knobs) => reactAct(async () => draw(knobs)),
    settle: (run) => reactAct(async () => run?.()),
    unmount: () => reactAct(async () => root.unmount()),
  }
}

const preact: Driver = async (wm, host, first) => {
  function Win(props: { binder: DesktopBinder; id: string; title: string }) {
    const bind = preactAdapter.useWmWindowRef(props.binder, props.id)
    return ph(
      'section',
      { ref: bind, 'data-testid': props.id },
      ph('header', { 'data-wm-drag': '' }, ph('span', { 'data-wm-title': '' }, props.title)),
    )
  }
  function Root(props: { knobs: Knobs }) {
    const state = preactAdapter.useWmState(wm)
    const desk = preactAdapter.useDesktop(wm, OPTIONS)
    const { knobs } = props
    if (!knobs.desktop) return ph('p', { class: 'off' })
    return ph(
      knobs.flip ? 'main' : 'div',
      { ref: desk.ref, class: 'desktop', key: knobs.flip ? 'main' : 'div' },
      shownIds(state, knobs).map((id) =>
        ph(Win, {
          key: `${id}:${knobs.variant}`,
          binder: desk.binder,
          id,
          title: state.windows[id]?.title ?? '',
        }),
      ),
    )
  }
  const draw = (knobs: Knobs) => preactRender(ph(Root, { knobs }), host)
  await preactAct(() => draw(first))
  return {
    async update(knobs) {
      await preactAct(() => draw(knobs))
    },
    async settle(run) {
      await preactAct(() => run?.())
    },
    async unmount() {
      await preactAct(() => preactRender(null, host))
    },
  }
}

const lit: Driver = async (wm, host, first) => {
  const binder = createDesktopBinder(wm, OPTIONS)
  let knobs = first
  const draw = () => {
    const state = wm.getState()
    const windows = repeat(
      shownIds(state, knobs),
      (id) => `${id}:${knobs.variant}`,
      (id) =>
        html`<section data-testid=${id} ${wmWindow(binder, id)}><header data-wm-drag><span data-wm-title>${state.windows[id]?.title}</span></header></section>`,
    )
    const page = !knobs.desktop
      ? html`<p class="off"></p>`
      : knobs.flip
        ? html`<main class="desktop" ${wmDesktop(binder)}>${windows}</main>`
        : html`<div class="desktop" ${wmDesktop(binder)}>${windows}</div>`
    litRender(page, host)
  }
  draw()
  const stop = wm.subscribe(draw)
  return {
    async update(next) {
      knobs = next
      draw()
    },
    async settle(run) {
      run?.()
    },
    async unmount() {
      stop()
      litRender(nothing, host)
      binder.destroy()
    },
  }
}

const vue: Driver = async (wm, host, first) => {
  const knobs = shallowRef(first)
  const Win = defineComponent({
    props: {
      binder: { type: Object, required: true },
      id: { type: String, required: true },
      title: String,
    },
    setup(props) {
      const element = vref<HTMLElement | null>(null)
      vueWindow(props.binder as DesktopBinder, () => props.id, element)
      return () =>
        vh('section', { ref: element, 'data-testid': props.id }, [
          vh('header', { 'data-wm-drag': '' }, [vh('span', { 'data-wm-title': '' }, props.title)]),
        ])
    },
  })
  const Root = defineComponent({
    setup() {
      const element = vref<HTMLElement | null>(null)
      const state = vueState(wm)
      const binder = vueDesktop(wm, element, OPTIONS)
      return () => {
        const now = knobs.value
        if (!now.desktop) return vh('p', { class: 'off' })
        return vh(
          now.flip ? 'main' : 'div',
          { ref: element, class: 'desktop', key: now.flip ? 'main' : 'div' },
          shownIds(state.value, now).map((id) =>
            vh(Win, {
              key: `${id}:${now.variant}`,
              binder,
              id,
              title: state.value.windows[id]?.title ?? '',
            }),
          ),
        )
      }
    },
  })
  const app = createApp(Root)
  app.mount(host)
  await nextTick()
  return {
    async update(next) {
      knobs.value = next
      await nextTick()
    },
    async settle(run) {
      run?.()
      await nextTick()
    },
    async unmount() {
      app.unmount()
      await nextTick()
    },
  }
}

const DRIVERS: Record<string, Driver> = { react, preact, lit, vue }

function drift(wm: WindowManager, host: HTMLElement, knobs: Knobs): string[] {
  const found = [...stateDrift(wm), ...domDrift(wm, host)]
  const state = wm.getState()
  const desks = host.querySelectorAll('[data-wm-desktop]').length
  if (desks !== (knobs.desktop ? 1 : 0)) found.push(`${desks} desktops are bound`)
  for (const id of IDS) {
    const nodes = [...host.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
    const drawn = knobs.desktop && state.windows[id] !== undefined && !knobs.hidden.has(id)
    if (nodes.length !== (drawn ? 1 : 0)) {
      found.push(`${id}: ${nodes.length} elements rendered, expected ${drawn ? 1 : 0}`)
      continue
    }
    if (drawn && nodes[0]?.dataset.wmWindow !== id) found.push(`${id}: rendered but not attached`)
  }
  const attached = host.querySelectorAll('[data-wm-window]').length
  const expected = knobs.desktop
    ? Object.keys(state.windows).filter((id) => !knobs.hidden.has(id)).length
    : 0
  if (attached !== expected) found.push(`${attached} windows attached, expected ${expected}`)
  return found
}

async function run(name: string, actions: Action[]): Promise<void> {
  const frames = stubFrames()
  const resources = trackResources()
  const host = document.createElement('div')
  document.body.append(host)
  const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  const driver = DRIVERS[name] as Driver
  let knobs: Knobs = { desktop: true, hidden: new Set(), variant: 0, flip: false, strict: false }
  let app = await driver(wm, host, knobs)
  const verify = (after: string) => {
    frames.flush(2)
    const found = drift(wm, host, knobs)
    if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${after}`)
  }
  try {
    verify('the first render')
    for (const action of actions) {
      const next = { ...knobs }
      let touch: (() => void) | null = null
      switch (action.do) {
        case 'open':
          touch = () => {
            if (!wm.get(action.id)) wm.open({ id: action.id, title: action.id.toUpperCase() })
          }
          break
        case 'close':
        case 'minimize':
        case 'maximize':
        case 'restore':
        case 'focus':
          touch = () => void wm[action.do](action.id)
          break
        case 'move':
          touch = () => void wm.move(action.id, action.x, action.y)
          break
        case 'group':
          touch = () => void wm.group([action.id, action.other])
          break
        case 'ungroup':
          touch = () => void wm.ungroup(action.id)
          break
        case 'undo':
        case 'redo':
          touch = () => void wm[action.do]()
          break
        case 'hide':
          next.hidden = new Set([...knobs.hidden, action.id])
          break
        case 'show':
          next.hidden = new Set([...knobs.hidden].filter((id) => id !== action.id))
          break
        case 'desktop':
          next.desktop = !knobs.desktop
          break
        case 'variant':
          next.variant = knobs.variant + 1
          break
        case 'flip':
          next.flip = !knobs.flip
          break
        case 'strict':
          next.strict = !knobs.strict
          break
        case 'remount':
          await app.unmount()
          app = await driver(wm, host, knobs)
          break
      }
      if (touch) await app.settle(touch)
      else if (action.do !== 'remount') {
        knobs = next
        await app.update(knobs)
      }
      verify(JSON.stringify(action))
    }
    await app.unmount()
    frames.flush(2)
    const left = resources.leaks()
    if (host.querySelector('[data-wm-window], [data-wm-desktop]')) left.push('bound elements')
    if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
  } finally {
    try {
      await app.unmount()
    } catch {}
    wm.destroy()
    resources.restore()
    vi.unstubAllGlobals()
    host.remove()
    await breathe()
  }
}

const id = fc.constantFrom(...IDS)
const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 10,
    arbitrary: fc.record({
      do: fc.constantFrom(
        'open' as const,
        'open' as const,
        'close' as const,
        'minimize' as const,
        'maximize' as const,
        'restore' as const,
        'focus' as const,
      ),
      id,
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      do: fc.constant('move' as const),
      id,
      x: fc.integer({ min: -100, max: 1000 }),
      y: fc.integer({ min: -100, max: 700 }),
    }),
  },
  { weight: 2, arbitrary: fc.record({ do: fc.constant('group' as const), id, other: id }) },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('ungroup' as const), id }) },
  { weight: 2, arbitrary: fc.record({ do: fc.constantFrom('undo' as const, 'redo' as const) }) },
  {
    weight: 3,
    arbitrary: fc.record({ do: fc.constantFrom('hide' as const, 'show' as const), id }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      do: fc.constantFrom(
        'desktop' as const,
        'variant' as const,
        'variant' as const,
        'flip' as const,
        'strict' as const,
        'remount' as const,
      ),
    }),
  },
) as fc.Arbitrary<Action>

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('an app that renders, hides, rebuilds and remounts its windows at random', () => {
  for (const name of Object.keys(DRIVERS)) {
    it(
      `keeps every rendered window attached and in step under ${name}`,
      async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(action, { minLength: 1, maxLength: 50, size: 'max' }),
            (actions) => run(name, actions),
          ),
          fuzz(60),
        )
      },
      patience(120_000),
    )
  }
})
