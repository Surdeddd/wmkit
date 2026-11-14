import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = join(root, '.cache', 'peer-floors')
const only = process.argv.slice(2)

const dom = `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JSDOM } from 'jsdom'

const page = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})
const view = page.window
for (const name of [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Text',
  'Comment',
  'DocumentFragment',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'customElements',
  'CSSStyleSheet',
  'ShadowRoot',
  'Document',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]) {
  Object.defineProperty(globalThis, name, { value: name === 'window' ? view : view[name], configurable: true, writable: true })
}
view.Element.prototype.setPointerCapture = () => {}
view.Element.prototype.releasePointerCapture = () => {}
view.Element.prototype.hasPointerCapture = () => false

export const tick = () => new Promise((resolve) => setTimeout(resolve, 20))

export function check(condition, message) {
  if (!condition) throw new Error(message)
}

export function shown(id) {
  return document.querySelector('[data-wm-window="' + id + '"]')
}

export function resolved(name, expected) {
  const manifest = join(process.cwd(), 'node_modules', name, 'package.json')
  const found = JSON.parse(readFileSync(manifest, 'utf8')).version
  check(found === expected, name + ' resolved to ' + found + ', not ' + expected)
}
`

const domCommon = `${dom
  .replace(/^import \{ (.+) \} from '(.+)'$/gm, "const { $1 } = require('$2')")
  .replace(/^export /gm, '')}
module.exports = { tick, check, shown, resolved }
`

const walk = `
  const el = shown('a')
  check(el, 'the window element was never attached')
  check(el.style.transform.includes('30px'), 'the window is not drawn at its place: ' + el.style.transform)
  wm.move('a', 90, 60)
  await tick()
  check(shown('a').style.transform.includes('90px'), 'a move did not reach the element')
  check(document.querySelector('[data-wm-desktop]'), 'the desktop element was never bound')
`

const CASES = [
  {
    name: 'react 18.2',
    install: ['react@18.2.0', 'react-dom@18.2.0'],
    test: `import { check, resolved, shown, tick } from './dom.mjs'
import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'

resolved('react', '18.2.0')
const h = React.createElement
let wm
function Win({ binder, win }) {
  return h('section', { ref: useWmWindowRef(binder, win.id) }, h('header', { 'data-wm-drag': '' }, win.title))
}
function App() {
  wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  return h('div', { ref }, Object.values(state.windows).map((win) => h(Win, { key: win.id, binder, win })))
}
const root = createRoot(document.getElementById('root'))
flushSync(() => root.render(h(App)))
await tick()
flushSync(() => wm.open({ id: 'a', x: 30, y: 40, width: 200, height: 150 }))
await tick()
${walk}
flushSync(() => root.unmount())
await tick()
check(!document.querySelector('[data-wm-window]'), 'an unmounted window is still attached')
`,
  },
  {
    name: 'preact 10.0 through CommonJS',
    install: ['preact@10.0.0'],
    format: 'cjs',
    test: `const { check, resolved, shown, tick } = require('./dom.cjs')
const { h, render } = require('preact')
const { useDesktop, useWindowManager, useWmState, useWmWindowRef } = require('@surdeddd/wmkit/preact')

async function main() {
  resolved('preact', '10.0.0')
  let wm
  function Win({ binder, win }) {
    return h('section', { ref: useWmWindowRef(binder, win.id) }, h('header', { 'data-wm-drag': '' }, win.title))
  }
  function App() {
    wm = useWindowManager()
    const { ref, binder } = useDesktop(wm)
    const state = useWmState(wm)
    return h('div', { ref }, Object.values(state.windows).map((win) => h(Win, { key: win.id, binder, win })))
  }
  const host = document.getElementById('root')
  render(h(App, null), host)
  await tick()
  wm.open({ id: 'a', x: 30, y: 40, width: 200, height: 150 })
  await tick()
${walk}
  render(null, host)
  await tick()
  check(!document.querySelector('[data-wm-window]'), 'an unmounted window is still attached')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
`,
  },
  {
    name: 'preact 10.5 as ES modules',
    install: ['preact@10.5.0'],
    test: `import { check, resolved, shown, tick } from './dom.mjs'
import { h, render } from 'preact'
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/preact'

resolved('preact', '10.5.0')
let wm
function Win({ binder, win }) {
  return h('section', { ref: useWmWindowRef(binder, win.id) }, h('header', { 'data-wm-drag': '' }, win.title))
}
function App() {
  wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  return h('div', { ref }, Object.values(state.windows).map((win) => h(Win, { key: win.id, binder, win })))
}
const host = document.getElementById('root')
render(h(App, null), host)
await tick()
wm.open({ id: 'a', x: 30, y: 40, width: 200, height: 150 })
await tick()
${walk}
render(null, host)
await tick()
check(!document.querySelector('[data-wm-window]'), 'an unmounted window is still attached')
`,
  },
  {
    name: 'vue 3.3',
    install: ['vue@3.3.0'],
    test: `import { check, resolved, shown, tick } from './dom.mjs'
import { createApp, defineComponent, h, ref } from 'vue'
import { useDesktop, useWindowManager, useWmState, useWmWindowEl } from '@surdeddd/wmkit/vue'

resolved('vue', '3.3.0')
let wm
const Win = defineComponent({
  props: { binder: Object, win: Object },
  setup(props) {
    const el = ref(null)
    useWmWindowEl(props.binder, () => props.win.id, el)
    return () => h('section', { ref: el }, [h('header', { 'data-wm-drag': '' }, props.win.title)])
  },
})
const app = createApp({
  setup() {
    wm = useWindowManager()
    const desktop = ref(null)
    const binder = useDesktop(wm, desktop)
    const state = useWmState(wm)
    return () =>
      h('div', { ref: desktop }, Object.values(state.value.windows).map((win) => h(Win, { key: win.id, binder, win })))
  },
})
app.mount('#root')
await tick()
wm.open({ id: 'a', x: 30, y: 40, width: 200, height: 150 })
await tick()
${walk}
app.unmount()
await tick()
check(!document.querySelector('[data-wm-window]'), 'an unmounted window is still attached')
`,
  },
  {
    name: 'solid 1.8',
    install: ['solid-js@1.8.0'],
    conditions: ['browser'],
    test: `import { check, resolved, shown, tick } from './dom.mjs'
import { createRoot } from 'solid-js'
import { createDesktop, useWindowManager, useWmState, useWmWindow } from '@surdeddd/wmkit/solid'

resolved('solid-js', '1.8.0')
const host = document.getElementById('root')
const section = document.createElement('section')
section.innerHTML = '<header data-wm-drag>t</header>'
host.append(section)
let wm
let title
const dispose = createRoot((stop) => {
  wm = useWindowManager()
  const dk = createDesktop(wm)
  const state = useWmState(wm)
  wm.open({ id: 'a', title: 'First', x: 30, y: 40, width: 200, height: 150 })
  dk.desktop(host)
  dk.window('a')(section)
  title = useWmWindow(wm, 'a')
  check(state().order.length === 1, 'the state accessor did not follow the manager')
  return stop
})
await tick()
${walk}
wm.update('a', { title: 'Second' })
check(title().title === 'Second', 'the window accessor did not follow an update')
dispose()
await tick()
check(!document.querySelector('[data-wm-window]'), 'a disposed window is still attached')
`,
  },
  {
    name: 'svelte 4.0',
    install: ['svelte@4.0.0'],
    conditions: ['browser'],
    test: `import { check, resolved, shown, tick } from './dom.mjs'
import { writeFileSync } from 'node:fs'
import { compile } from 'svelte/compiler'

resolved('svelte', '4.0.0')
const source = \`<script>
  import { createDesktop, createManager, wmStore } from '@surdeddd/wmkit/svelte'
  export const wm = createManager()
  const dk = createDesktop(wm)
  const desk = wmStore(wm)
</script>
<div use:dk.desktop>
  {#each Object.values($desk.windows) as win (win.id)}
    <section use:dk.window={{ id: win.id }}><header data-wm-drag>{win.title}</header></section>
  {/each}
</div>\`
const { js } = compile(source, { generate: 'dom', format: 'esm' })
writeFileSync(new URL('./App.mjs', import.meta.url), js.code)
const { default: App } = await import('./App.mjs')
const app = new App({ target: document.getElementById('root') })
const wm = app.wm
await tick()
wm.open({ id: 'a', x: 30, y: 40, width: 200, height: 150 })
await tick()
${walk}
app.$destroy()
await tick()
check(!document.querySelector('[data-wm-window]'), 'a destroyed window is still attached')
`,
  },
  {
    name: 'angular 16.0',
    install: ['@angular/core@16.0.0', 'rxjs@7.8.0', 'zone.js@0.13.0'],
    test: `import { check, resolved, shown, tick } from './dom.mjs'
import { createEnvironmentInjector, DestroyRef, Injector, runInInjectionContext } from '@angular/core'
import { createDesktop, useWindowManager, useWmState, useWmWindow } from '@surdeddd/wmkit/angular'

resolved('@angular/core', '16.0.0')
const host = document.getElementById('root')
const section = document.createElement('section')
section.innerHTML = '<header data-wm-drag>t</header>'
host.append(section)
const scope = createEnvironmentInjector([], Injector.create({ providers: [] }))
const { wm, state, title } = runInInjectionContext(scope, () => {
  const wm = useWindowManager()
  const dk = createDesktop(wm)
  wm.open({ id: 'a', title: 'First', x: 30, y: 40, width: 200, height: 150 })
  dk.desktop(host)
  dk.window('a')(section)
  return { wm, state: useWmState(wm), title: useWmWindow(wm, 'a') }
})
await tick()
${walk}
wm.update('a', { title: 'Second' })
check(state().order.length === 1, 'the state signal did not follow the manager')
check(title().title === 'Second', 'the window signal did not follow an update')
scope.get(DestroyRef)
scope.destroy()
await tick()
check(!document.querySelector('[data-wm-window]'), 'a destroyed window is still attached')
`,
  },
  {
    name: 'lit 3.0',
    install: ['lit@3.0.0'],
    conditions: ['browser'],
    test: `import { check, resolved, shown, tick } from './dom.mjs'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { createDesktopBinder, createWindowManager } from '@surdeddd/wmkit'
import { WmStateController, wmDesktop, wmWindow } from '@surdeddd/wmkit/lit'

resolved('lit', '3.0.0')
const wm = createWindowManager()
const binder = createDesktopBinder(wm)
class Desk extends LitElement {
  view = new WmStateController(this, wm)
  createRenderRoot() {
    return this
  }
  render() {
    return html\`<div \${wmDesktop(binder)}>
      \${repeat(
        Object.values(this.view.state.windows),
        (win) => win.id,
        (win) => html\`<section \${wmWindow(binder, win.id)}><header data-wm-drag>\${win.title}</header></section>\`,
      )}
    </div>\`
  }
}
customElements.define('floor-desk', Desk)
const desk = document.createElement('floor-desk')
document.getElementById('root').append(desk)
await desk.updateComplete
wm.open({ id: 'a', x: 30, y: 40, width: 200, height: 150 })
await desk.updateComplete
await tick()
${walk}
desk.remove()
await tick()
check(!document.querySelector('[data-wm-window]'), 'a removed window is still attached')
`,
  },
  {
    name: 'qwik 1.5',
    install: ['@builder.io/qwik@1.5.0'],
    test: `import { check, resolved } from './dom.mjs'

resolved('@builder.io/qwik', '1.5.0')
const qwik = await import('@surdeddd/wmkit/qwik')
for (const name of ['WmDesktop', 'WmWindow']) {
  check(typeof qwik[name] === 'function', name + ' is not a component under this version')
}
`,
  },
]

function fail(message) {
  console.error(`peer-floors: ${message}`)
  console.error(`peer-floors: the work directory is kept at ${work}`)
  process.exit(1)
}

function pack() {
  if (!existsSync(join(root, 'dist', 'index.js'))) fail('dist/ is missing, run `pnpm build` first')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  execFileSync('npm', ['pack', '--pack-destination', work], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const [tarball] = readdirSync(work).filter((name) => name.endsWith('.tgz'))
  if (!tarball) fail('npm pack wrote no tarball')
  return join(work, tarball)
}

const tarball = pack()
const failures = []
for (const entry of CASES) {
  if (only.length > 0 && !only.some((word) => entry.name.includes(word))) continue
  const dir = join(work, entry.name.replace(/[^\w.]+/g, '-'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: 'wmkit-peer-floor', private: true }, null, 2)}\n`,
  )
  try {
    execFileSync(
      'npm',
      [
        'install',
        '--no-audit',
        '--no-fund',
        '--no-package-lock',
        '--ignore-scripts',
        '--legacy-peer-deps',
        ...entry.install,
      ],
      { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' },
    )
    const target = join(dir, 'node_modules', '@surdeddd', 'wmkit')
    mkdirSync(target, { recursive: true })
    execFileSync('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'])
    const format = entry.format ?? 'mjs'
    writeFileSync(join(dir, `dom.${format}`), format === 'cjs' ? domCommon : dom)
    writeFileSync(join(dir, `floor.${format}`), entry.test)
    const flags = (entry.conditions ?? []).map((name) => `--conditions=${name}`)
    execFileSync(process.execPath, [...flags, `floor.${format}`], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 120_000,
    })
    console.log(`ok   ${entry.name}`)
  } catch (error) {
    const text = String(error.stderr || error.stdout || error.message)
    const line = text.split('\n').find((part) => /Error/.test(part)) ?? text.split('\n')[0]
    failures.push(`${entry.name}: ${line.trim()}`)
    console.log(`FAIL ${entry.name}`)
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  fail(`${failures.length} of the lowest supported versions failed`)
}
rmSync(work, { recursive: true, force: true })
console.log('peer-floors: every lowest supported version works with the packed package')
