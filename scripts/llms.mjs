import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const HOST = 'https://wmkit.vercel.app'
export const PACKAGE = '@surdeddd/wmkit'

export const SUMMARY =
  'Headless window manager for the web: a serializable state machine, a DOM controller for your own markup, ' +
  'adapters for React, Vue, Svelte, Solid, Angular, Preact, Lit and Qwik, web components, and plugins for ' +
  'docking, tab groups, snap layouts, a taskbar, a window switcher, persistence and sync across tabs. ' +
  'Zero dependencies, ESM and CommonJS, TypeScript types included.'

export const ENTRY_NOTES = {
  '.': '`createWindowManager(options?)` is the state machine and needs no DOM: `open`, `close`, `requestClose`, `focus`, `minimize`, `maximize`, `restore`, `snap`, `snapTo`, `move`, `resize`, `update`, `group`, `setWorkspace`, `undo`, `redo`, `serialize`, `hydrate`, `subscribe`, `on`. `attachDesktop(wm, element, options?)` adds pointer, touch and keyboard handling, snapping, magnetism and ARIA to your own markup; `desktop.attachWindow(id, element)` binds one window. Also `createDesktopBinder`, `createAnnouncer`, `setStyleNonce` and the geometry helpers `zoneBounds`, `clampToViewport`, `magnetize`.',
  './react':
    'React 18 and later: `useWindowManager`, `useDesktop`, `useWmState`, `useWmWindow`, `useWmWindowRef`. Window content stays in your component tree.',
  './vue':
    'Vue 3.3 and later: `useWindowManager`, `useDesktop`, `useWmState`, `useWmWindow`, `useWmWindowEl`.',
  './svelte': 'Svelte 4 and 5: `createManager`, `createDesktop`, `wmStore`, `wmWindowStore`.',
  './solid':
    'Solid 1.8 and later: `useWindowManager`, `createDesktop`, `useWmState`, `useWmWindow`.',
  './angular':
    'Angular 16 and later, signals: `useWindowManager`, `createDesktop`, `useWmState`, `useWmWindow`.',
  './preact':
    'Preact 10: `useWindowManager`, `useDesktop`, `useWmState`, `useWmWindow`, `useWmWindowRef`.',
  './lit':
    'Lit 3: the directives `wmDesktop` and `wmWindow`, the controllers `WmStateController` and `WmWindowController`.',
  './qwik': 'Qwik 1.5 and later: `WmDesktop`, `WmWindow`, `WmContext`, `useWm`, `useWmState`.',
  './elements':
    '`defineWmElements()` registers the web components `<wm-desktop>` and `<wm-window>`: windows declared in markup with attributes, shadow DOM chrome, `wm-*` events. Use when there is no framework or several.',
  './elements/define': 'Side-effect import that registers `<wm-desktop>` and `<wm-window>`.',
  './dock':
    '`createDock(desktop, options?)`: tile windows into split panels with tabs and draggable separators next to floating windows, the IDE layout. `dockLayout` holds the pure operations for building a layout.',
  './layouts':
    '`createLayoutPicker(desktop, options?)`: a snap layout menu on the maximize button. `linkSnapped(desktop, options?)`: snapped neighbours resize together by their shared edge. `snapLayouts` holds the built-in layouts.',
  './taskbar':
    '`createTaskbar(wm, element, options?)`: a keyboard accessible taskbar that follows the manager, unstyled. `defineWmTaskbar()` registers `<wm-taskbar>`.',
  './taskbar/define': 'Side-effect import that registers `<wm-taskbar>`.',
  './switcher':
    '`createSwitcher(desktop, options?)`: a window switcher on Alt+backquote and an overview of every window.',
  './persist':
    '`persist(wm, options?)`: save the desktop to `localStorage` or any storage and restore it, with versioned migrations.',
  './persist/idb': '`idbStorage(options?)`: an IndexedDB storage for `persist`.',
  './sync':
    '`sync(wm, options?)`: keep one desktop in step across browser tabs over a `BroadcastChannel`.',
  './popout':
    '`popout(wm, id, contentEl, options?)`: move a window into Picture-in-Picture or a popup on another screen. `isPopoutSupported`, `listScreens`.',
  './gestures':
    '`pinch`, `swipe` and `touchGestures`: pinch a window with two fingers to resize it, swipe two fingers sideways to change workspace.',
  './chrome':
    '`skin(spec)`, `defaultSkin`, `barebones`, `windowChrome`: build the whole window frame from a template string and swap it on a live window.',
  './winbox':
    '`WinBox`: a drop-in for the WinBox.js API on top of the manager. Use to migrate a WinBox app by changing one import.',
  './devtools':
    '`createDevtools(wm, options?)`: a panel with the live window table, an event log and the manager controls.',
  './testing':
    '`stubFrames`, `stubPointerCapture`, `pointer`, `drag`, `resize`, `press`: helpers for testing your own windows in jsdom.',
  './ru': '`announcerMessagesRu`: the Russian catalogue for the screen reader announcer.',
  './themes':
    'Every theme as a string, as `glassTheme` and `glassShadowTheme`, for shadow roots and style injection.',
  './themes/*':
    'Sixteen CSS themes, as `@surdeddd/wmkit/themes/glass.css`: glass, light, retro, terminal, paper, neon, aqua, frost, candy, carbon, brutalist, blueprint, amber, noir, forest, synth.',
}

export const RULES = [
  'The desktop element is the coordinate space. Give it a size; `attachDesktop` makes it `position: relative` when it is static.',
  '`wm.open()` only creates state. A window shows once an element is bound: `desktop.attachWindow(win.id, element)`, or the hook of an adapter.',
  'Mark your markup with attributes: `data-wm-drag` on the titlebar, `data-wm-title`, `data-wm-content`, and `data-wm-close`, `data-wm-minimize`, `data-wm-maximize` on buttons. Do not add your own click handlers for them.',
  'Do not position windows with CSS. The controller writes `transform` and size; read geometry from `win.bounds`.',
  'Window ids are strings. `open` throws on an id that is taken; most other methods return `false` when refused.',
  'State is one JSON-safe object: `wm.serialize()` and `wm.hydrate(data)`, or `persist(wm, { key })` to store it.',
  'A whole drag or resize is one undo step. `wm.undo()` and `wm.redo()` return whether anything changed.',
  'Create the manager anywhere, also on a server. Call `attachDesktop` only in the browser; the adapters do that for you.',
  'A dialog is a window with `layer: "modal"`: it traps focus and blocks the windows below. Open it with `owner: id` and it belongs to that window: it stays above it, closes with it and blocks only that window and what else it owns.',
  'To confirm a close, register `wm.onBeforeClose(guard)`; the guard returns `false` or a promise of it to keep the window. The close button and `wm.requestClose(id)` ask the guards, `wm.close(id)` does not.',
  'Import a theme (`@surdeddd/wmkit/themes/glass.css`) or style the `data-wm-*` attributes yourself: the core positions windows and leaves their look to CSS.',
]

function frontMatter(text) {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? ''
  const field = (name) => new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(block)?.[1]?.trim()
  return {
    title: field('title') ?? /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? 'wmkit',
    description: field('description') ?? '',
  }
}

function pages(directory, found = []) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name)
    if (name.startsWith('.') || name === 'node_modules' || name === 'superpowers') continue
    if (statSync(path).isDirectory()) pages(path, found)
    else if (name.endsWith('.md') && !name.endsWith('.ru.md')) found.push(path)
  }
  return found
}

export function docsIndex(docs = join(root, 'docs')) {
  return pages(docs)
    .map((path) => {
      const served = relative(docs, path)
        .replace(/\\/g, '/')
        .replace(/^README\.md$/, 'index.md')
      const url = `${HOST}/docs/${served.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')}`
      return { served, url, ...frontMatter(readFileSync(path, 'utf8')) }
    })
    .sort((left, right) => left.served.localeCompare(right.served))
}

export function quickStart(readme = readFileSync(join(root, 'README.md'), 'utf8')) {
  const block = /## Quick start \(vanilla\)\n\n```js\n([\s\S]*?)```/.exec(readme)?.[1]
  if (!block) throw new Error('wmkit: the README has no vanilla quick start to quote')
  return block.trimEnd()
}

export function entryLines(exported) {
  return exported.map((entry) => {
    const note = ENTRY_NOTES[entry]
    if (!note) throw new Error(`wmkit: llms.txt has no note for the entry ${entry}`)
    const name = entry === '.' ? PACKAGE : `${PACKAGE}/${entry.slice(2)}`
    return `- \`${name}\`: ${note}`
  })
}

export function exportedEntries(
  manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')),
) {
  return Object.keys(manifest.exports).filter((entry) => entry !== './package.json')
}

export function llmsText({ version, docs = docsIndex(), exported = exportedEntries() } = {}) {
  return [
    '# wmkit',
    '',
    `> ${version ? SUMMARY.replace('web:', `web, version ${version}:`) : SUMMARY}`,
    '',
    `Package: \`${PACKAGE}\`. Docs: ${HOST}/docs/ . The whole documentation as one file: ${HOST}/llms-full.txt . Live demo: ${HOST}/ . Source: https://github.com/Surdeddd/wmkit`,
    '',
    '## Quick start',
    '',
    '```js',
    quickStart(),
    '```',
    '',
    '## Rules that prevent the usual mistakes',
    '',
    ...RULES.map((rule) => `- ${rule}`),
    '',
    '## Entry points',
    '',
    ...entryLines(exported),
    '',
    '## Docs',
    '',
    ...docs.map(
      ({ title, url, description }) =>
        `- [${title}](${url})${description ? `: ${description}` : ''}`,
    ),
    '',
    '## Optional',
    '',
    '- [Source on GitHub](https://github.com/Surdeddd/wmkit)',
    `- [Changelog](https://github.com/Surdeddd/wmkit/blob/main/CHANGELOG.md)`,
    '',
  ].join('\n')
}

function russianPages(directory, found = []) {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name)
    if (name.startsWith('.') || name === 'node_modules' || name === 'superpowers') continue
    if (statSync(path).isDirectory()) russianPages(path, found)
    else if (name.endsWith('.ru.md')) found.push(name)
  }
  return found
}

export function context7Json() {
  const skipped = [
    ...new Set(['CHANGELOG.md', 'README.ru.md', ...russianPages(join(root, 'docs'))]),
  ]
  const config = {
    $schema: 'https://context7.com/schema/context7.json',
    projectTitle: 'wmkit',
    description: SUMMARY,
    folders: ['docs'],
    excludeFolders: ['docs/.vitepress', 'docs/superpowers'],
    excludeFiles: skipped.sort(),
    rules: RULES,
  }
  const keys = Object.keys(config)
  const lines = keys.flatMap((key, index) => {
    const value = config[key]
    const tail = index === keys.length - 1 ? '' : ','
    const name = `  ${JSON.stringify(key)}: `
    if (!Array.isArray(value)) return [`${name}${JSON.stringify(value)}${tail}`]
    const flat = `${name}[${value.map((item) => JSON.stringify(item)).join(', ')}]${tail}`
    if (flat.length <= 100) return [flat]
    const items = value.map(
      (item, at) => `    ${JSON.stringify(item)}${at === value.length - 1 ? '' : ','}`,
    )
    return [`${name}[`, ...items, `  ]${tail}`]
  })
  return `{\n${lines.join('\n')}\n}\n`
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flag = process.argv.indexOf('--out')
  const out = flag === -1 ? root : process.argv[flag + 1]
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'llms.txt'), llmsText())
  writeFileSync(join(out, 'context7.json'), context7Json())
}
