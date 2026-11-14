import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = join(root, '.cache', 'consumer-builds')
const require = createRequire(join(root, 'package.json'))

const entry = `import { createWindowManager } from '@surdeddd/wmkit'

const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
wm.open({ id: 'notes', title: 'Notes' })
wm.maximize('notes')
globalThis.__wmkit = wm.get('notes').stage + ':' + wm.getState().order.length
`

const FOREIGN = {
  dock: 'data-wm-sash',
  'web components': 'customElements.define',
  winbox: 'wb-header',
  devtools: 'data-wm-devtools',
  popout: 'documentPictureInPicture',
  gestures: 'wmPinching',
  dom: 'data-wm-desktop',
}

const types = `import {
  attachDesktop,
  type CloseGuard,
  createDesktopBinder,
  createWindowManager,
  type DesktopOptions,
  type ManagerOptions,
  type WindowInit,
  type WindowUpdate,
} from '@surdeddd/wmkit'
import { useWmState as angularState } from '@surdeddd/wmkit/angular'
import { skin, windowChrome } from '@surdeddd/wmkit/chrome'
import { createDevtools } from '@surdeddd/wmkit/devtools'
import { createDock, type DockOptions } from '@surdeddd/wmkit/dock'
import { defineWmElements, type WmDesktopElement } from '@surdeddd/wmkit/elements'
import '@surdeddd/wmkit/elements/define'
import { touchGestures } from '@surdeddd/wmkit/gestures'
import { createLayoutPicker, type SnapLayout, snapLayouts } from '@surdeddd/wmkit/layouts'
import { WmStateController, wmDesktop, wmWindow } from '@surdeddd/wmkit/lit'
import { type PersistOptions, persist } from '@surdeddd/wmkit/persist'
import { idbStorage } from '@surdeddd/wmkit/persist/idb'
import { isPopoutSupported, type PopoutOptions, popout } from '@surdeddd/wmkit/popout'
import { useWmState as preactState } from '@surdeddd/wmkit/preact'
import { WmDesktop, WmWindow } from '@surdeddd/wmkit/qwik'
import { useWmState as reactState } from '@surdeddd/wmkit/react'
import { announcerMessagesRu } from '@surdeddd/wmkit/ru'
import { useWmState as solidState } from '@surdeddd/wmkit/solid'
import { wmStore } from '@surdeddd/wmkit/svelte'
import { createSwitcher, type SwitcherOptions } from '@surdeddd/wmkit/switcher'
import { type SyncOptions, sync } from '@surdeddd/wmkit/sync'
import { createTaskbar, type TaskbarOptions } from '@surdeddd/wmkit/taskbar'
import '@surdeddd/wmkit/taskbar/define'
import { type ThemeName, themeStyle } from '@surdeddd/wmkit/themes'
import { useWmState as vueState } from '@surdeddd/wmkit/vue'
import WinBox, { type WinBoxOptions } from '@surdeddd/wmkit/winbox'

const manager: ManagerOptions = { historyLimit: 20 }
const init: WindowInit = { title: 'Notes', minWidth: 120 }
const patch: WindowUpdate = { title: 'Renamed' }
const desk: DesktopOptions = {
  snap: { threshold: 10 },
  keyboard: { moveStep: 8 },
  magnetism: false,
  grid: { x: 24 },
  announce: announcerMessagesRu,
}
const docking: DockOptions = { sash: 8 }
const tasks: TaskbarOptions = { show: 'minimized', workspace: 'all' }
const linking: SyncOptions = { channel: 'app', wait: 100 }
const switching: SwitcherOptions = { shortcut: { code: 'KeyK', modifier: 'ctrl' }, animation: false }
const columns: SnapLayout = [snapLayouts.halves[0], { x: 0.5, y: 0, width: 0.5, height: 1 }]
const saving: PersistOptions = { key: 'app', storage: idbStorage({ database: 'app' }) }
const out: PopoutOptions = { width: 400 }
const box: WinBoxOptions = { title: 'Box' }
const theme: ThemeName = 'glass'

export function run(element: HTMLElement): unknown[] {
  const wm = createWindowManager(manager)
  const win = wm.open(init)
  wm.update(win.id, patch)
  const guard: CloseGuard = async (asked) => asked.id !== win.id
  wm.onBeforeClose(guard)
  void wm.requestClose(win.id)
  const desktop = attachDesktop(wm, element, desk)
  const binder = createDesktopBinder(wm, desk)
  const dock = createDock(desktop, docking)
  const store = persist(wm, saving)
  defineWmElements({ prefix: 'app' })
  const host = document.createElement('app-desktop') as WmDesktopElement
  return [
    binder.controller(),
    dock.layout(),
    store.restore(),
    store.ready,
    host.manager,
    popout(wm, win.id, element, out),
    isPopoutSupported(),
    createDevtools(wm),
    createTaskbar(wm, element, tasks).targetOf(win),
    sync(wm, linking).ready,
    createSwitcher(desktop, switching).overview(),
    createLayoutPicker(desktop, { layouts: [columns], hover: false }).open(win.id),
    touchGestures({ pinch: { threshold: 12 } }),
    skin({ template: '<section><div data-wm-content></div></section>' }),
    windowChrome(),
    themeStyle(theme, { shadow: true }),
    new WinBox(box),
    angularState,
    preactState,
    reactState,
    solidState,
    vueState,
    wmStore(wm),
    WmStateController,
    wmDesktop,
    wmWindow,
    WmDesktop,
    WmWindow,
  ]
}
`

const CONFIGS = {
  bundler: { module: 'esnext', moduleResolution: 'bundler' },
  node16: { module: 'node16', moduleResolution: 'node16' },
}

const failures = []

function fail(message) {
  console.error(`consumer-builds: ${message}`)
  console.error(`consumer-builds: the work directory is kept at ${work}`)
  process.exit(1)
}

function install() {
  if (!existsSync(join(root, 'dist', 'index.js'))) fail('dist/ is missing, run `pnpm build` first')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  execFileSync('npm', ['pack', '--pack-destination', work], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const [tarball] = readdirSync(work).filter((name) => name.endsWith('.tgz'))
  if (!tarball) fail('npm pack wrote no tarball')
  writeFileSync(
    join(work, 'package.json'),
    `${JSON.stringify({ name: 'wmkit-consumer-builds', private: true, type: 'module' }, null, 2)}\n`,
  )
  execFileSync(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '--ignore-scripts',
      'webpack@5',
      'esbuild',
      'rollup',
      'webpack-cli@5',
    ],
    { cwd: work, stdio: ['ignore', 'ignore', 'pipe'] },
  )
  const target = join(work, 'node_modules', '@surdeddd', 'wmkit')
  mkdirSync(target, { recursive: true })
  execFileSync('tar', ['-xzf', join(work, tarball), '-C', target, '--strip-components=1'])
  writeFileSync(join(work, 'core.mjs'), entry)
  writeFileSync(join(work, 'tsconfig.json'), '{ "compilerOptions": {} }\n')
}

function judge(name, file) {
  const code = readFileSync(file, 'utf8')
  const pulled = Object.entries(FOREIGN)
    .filter(([, marker]) => code.includes(marker))
    .map(([part]) => part)
  if (pulled.length > 0) {
    failures.push(`${name}: importing the manager alone also bundled ${pulled.join(', ')}`)
    return
  }
  const probe = `await import(${JSON.stringify(pathToFileURL(file).href)})\nconsole.log(globalThis.__wmkit)\n`
  writeFileSync(join(work, 'probe.mjs'), probe)
  const printed = execFileSync(process.execPath, ['probe.mjs'], { cwd: work, encoding: 'utf8' })
  if (printed.trim() !== 'maximized:1') {
    failures.push(`${name}: the bundle printed ${JSON.stringify(printed.trim())}`)
    return
  }
  console.log(`ok   ${name}: ${(code.length / 1024).toFixed(1)} kB before minifying, manager only`)
}

async function bundle() {
  const local = createRequire(join(work, 'package.json'))
  const esbuild = await import(pathToFileURL(local.resolve('esbuild')).href)
  await esbuild.build({
    entryPoints: [join(work, 'core.mjs')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: join(work, 'out', 'esbuild.mjs'),
    logLevel: 'silent',
  })
  judge('esbuild', join(work, 'out', 'esbuild.mjs'))

  const { rollup } = await import(pathToFileURL(local.resolve('rollup')).href)
  const built = await rollup({
    input: join(work, 'core.mjs'),
    onwarn: () => {},
    plugins: [
      {
        name: 'packed',
        resolveId(source, importer) {
          if (!source.startsWith('@surdeddd/wmkit')) return null
          const from = pathToFileURL(importer ?? join(work, 'core.mjs')).href
          return fileURLToPath(import.meta.resolve(source, from))
        },
      },
    ],
  })
  await built.write({ file: join(work, 'out', 'rollup.mjs'), format: 'esm' })
  await built.close()
  judge('rollup', join(work, 'out', 'rollup.mjs'))

  const vite = await import(pathToFileURL(require.resolve('vite')).href)
  await vite.build({
    root: work,
    logLevel: 'silent',
    configFile: false,
    build: {
      outDir: join(work, 'out', 'vite'),
      minify: false,
      lib: { entry: join(work, 'core.mjs'), formats: ['es'], fileName: 'vite' },
    },
  })
  judge('vite', join(work, 'out', 'vite', 'vite.js'))

  writeFileSync(
    join(work, 'webpack.config.cjs'),
    `module.exports = {
  mode: 'production',
  entry: './core.mjs',
  experiments: { outputModule: true },
  optimization: { minimize: false },
  output: { path: ${JSON.stringify(join(work, 'out', 'webpack'))}, filename: 'webpack.mjs', library: { type: 'module' } },
}
`,
  )
  try {
    execFileSync(process.execPath, [join(work, 'node_modules', 'webpack-cli', 'bin', 'cli.js')], {
      cwd: work,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    failures.push(`webpack 5 did not build:\n${error.stdout}`)
    return
  }
  judge('webpack 5', join(work, 'out', 'webpack', 'webpack.mjs'))
}

function typecheck() {
  const tsc = require.resolve('typescript/bin/tsc')
  for (const [name, resolution] of Object.entries(CONFIGS)) {
    const dir = join(work, `types-${name}`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, name === 'node16' ? 'all.mts' : 'all.ts'), types)
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          ...resolution,
          target: 'es2022',
          lib: ['es2022', 'dom', 'dom.iterable'],
          strict: true,
          exactOptionalPropertyTypes: true,
          noUncheckedIndexedAccess: true,
          noImplicitOverride: true,
          verbatimModuleSyntax: true,
          skipLibCheck: true,
          noEmit: true,
          types: [],
        },
        include: ['all.*'],
      }),
    )
    try {
      execFileSync(process.execPath, [tsc, '-p', dir], { cwd: dir, encoding: 'utf8' })
      console.log(`ok   types of every entry under a strict consumer config, ${name} resolution`)
    } catch (error) {
      failures.push(`types under ${name} resolution:\n${error.stdout}`)
    }
  }
  const dir = join(work, 'types-own')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'own.ts'),
    "import { createWindowManager } from '@surdeddd/wmkit'\nimport { persist } from '@surdeddd/wmkit/persist'\nimport { createDock } from '@surdeddd/wmkit/dock'\nimport { themeStyle } from '@surdeddd/wmkit/themes'\n\nexport const used = [createWindowManager, persist, createDock, themeStyle]\n",
  )
  writeFileSync(
    join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2022',
        lib: ['es2022', 'dom', 'dom.iterable'],
        strict: true,
        exactOptionalPropertyTypes: true,
        skipLibCheck: false,
        noEmit: true,
        types: [],
      },
      include: ['own.ts'],
    }),
  )
  try {
    execFileSync(process.execPath, [tsc, '-p', dir], { cwd: dir, encoding: 'utf8' })
    console.log(
      'ok   the declaration files of the framework-free entries check without skipLibCheck',
    )
  } catch (error) {
    failures.push(`declaration files without skipLibCheck:\n${error.stdout}`)
  }
}

install()
await bundle()
typecheck()

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  fail(`${failures.length} check(s) failed`)
}
rmSync(work, { recursive: true, force: true })
console.log('consumer-builds: all checks passed')
