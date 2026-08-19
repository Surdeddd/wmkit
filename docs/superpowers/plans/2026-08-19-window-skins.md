# Window Skins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a developer build a window from scratch — own markup, own buttons, own styles, optionally isolated in a shadow root — and wire the manager's actions onto any element they like.

**Architecture:** The core learns one protocol and nothing else: a skin is a function that returns a mounted element plus the node the app's content goes into. Templates, escaping and shadow roots live in a new opt-in entry, `@surdeddd/wmkit/chrome`, exactly the way gestures live in `@surdeddd/wmkit/gestures`. Actions become a small typed object in the core so any element — inside the window, in a page toolbar, or bound to a hotkey — can drive a window.

**Tech Stack:** TypeScript strict, vitest + jsdom, Playwright, tsup multi-entry, biome, size-limit.

## Global Constraints

- No explanatory comments in source. Knowledge goes to `MEMORY_BANK/`, not the code.
- Identifiers, commit messages and branch names in English. Conventional commits.
- Commits authored by Максим Кравцов with no AI co-author trailer.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
- Coverage thresholds stay green: `src/core/**` 100/100/100/100, `src/dom/**` 100 statements/lines/functions and 90 branches, `src/plugins/**` 100/100/100/97, `src/adapters/**` 100/100/100/98.
- `dist/index.js` stays under the 14 kB size-limit budget. New entry `dist/chrome.js` budget: 3 kB.
- Every behavioural claim gets a mutation check: revert the line, confirm a named test dies.
- **Branch headroom is the binding constraint of Task 6.** `src/dom/**` sits at 552/607 = 90.94% against a floor of 90, so roughly six uncovered branches exist for the whole shadow fix. Measure after each fix, not at the end. jsdom leaves `shadowRoot.elementFromPoint` undefined but **assignable**, so a shadow hit test is coverable by stubbing it exactly the way `tests/unit/dom.test.ts` already stubs `document.elementsFromPoint`.
- Additive only. `attachWindow(id, element, options?)` keeps working untouched.
- Verify by exit code, never by eyeballing a tail of the output.

---

## File Structure

- `src/dom/actions.ts` (create) — builds the typed action object for one window id. Core, no DOM.
- `src/dom/shared.ts` (modify) — `WindowActions`, `WindowSkin`, `SkinContext`, `SkinMount`, `MountedWindow`; `DesktopOptions.skins`; `DesktopController.actions` and `.mountWindow`.
- `src/dom/controller.ts` (modify) — action delegation for the new attributes, title text ownership, skin mounting and remounting, the three shadow fixes.
- `src/plugins/chrome/template.ts` (create) — compiles a `{{placeholder}}` template string into a DOM tree, escaping every substitution.
- `src/plugins/chrome/index.ts` (create) — `skin()` factory, `defaultSkin`, `barebones`; light and shadow mounting; shared `CSSStyleSheet` cache.
- `scripts/themes.mjs` (create) — the theme generator, emitting `src/themes/<name>.css` and `src/themes/<name>.ts`.
- `src/themes/index.ts` (create) — name → CSS text map, published as `@surdeddd/wmkit/themes`.
- `tests/unit/actions.test.ts`, `tests/unit/chrome.test.ts` (create).
- `tests/e2e/skins.spec.ts` (create).
- `site/src/apps.ts` (modify) — the `skins` app grows a skin constructor.
- `docs/api.md`, `docs/theming.md`, `docs/recipes.md`, `README.md`, `README.ru.md` (modify).

---

### Task 1: Window actions

**Files:**
- Create: `src/dom/actions.ts`
- Modify: `src/dom/shared.ts`, `src/dom/controller.ts`
- Test: `tests/unit/actions.test.ts`

**Interfaces:**
- Consumes: `WindowManager`, `SnapZone` from `src/core/types.ts`.
- Produces:
  ```ts
  export interface WindowActions {
    focus(): boolean
    close(): boolean
    minimize(): boolean
    maximize(): boolean
    toggleMaximize(): boolean
    restore(): boolean
    center(): boolean
    sendToBack(): boolean
    snap(zone: SnapZone): boolean
    moveToWorkspace(workspace: number): boolean
  }
  export function createActions(wm: WindowManager, id: string): WindowActions
  ```
  `DesktopController` gains `actions(id: string): WindowActions`.

**Behaviour contract**

- Every method forwards to the manager method of the same name and returns its boolean.
- An id with no window returns `false` from every method and never throws — a button can outlive its window by a frame.
- The object is built per call; it holds no state.

- [x] **Step 1: Write the failing test**

```ts
it('drives the manager and never throws on a window that is gone', () => {
  const wm = createWindowManager({ viewport: { width: 800, height: 600 } })
  wm.open({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
  const act = createActions(wm, 'a')

  expect(act.minimize()).toBe(true)
  expect(wm.get('a')?.stage).toBe('minimized')
  expect(act.restore()).toBe(true)
  expect(act.snap('left')).toBe(true)
  expect(wm.get('a')?.snapZone).toBe('left')
  expect(act.moveToWorkspace(2)).toBe(true)
  expect(act.close()).toBe(true)

  const gone = createActions(wm, 'a')
  expect([
    gone.focus(),
    gone.close(),
    gone.minimize(),
    gone.maximize(),
    gone.toggleMaximize(),
    gone.restore(),
    gone.center(),
    gone.sendToBack(),
    gone.snap('left'),
    gone.moveToWorkspace(1),
  ]).toEqual(Array.from({ length: 10 }, () => false))
})
```

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run tests/unit/actions.test.ts --coverage.enabled=false`
Expected: FAIL — `createActions` is not exported.

- [x] **Step 3: Implement `src/dom/actions.ts`**

```ts
import type { SnapZone, WindowManager } from '../core/types'

export interface WindowActions {
  focus(): boolean
  close(): boolean
  minimize(): boolean
  maximize(): boolean
  toggleMaximize(): boolean
  restore(): boolean
  center(): boolean
  sendToBack(): boolean
  snap(zone: SnapZone): boolean
  moveToWorkspace(workspace: number): boolean
}

export function createActions(wm: WindowManager, id: string): WindowActions {
  return {
    focus: () => wm.focus(id),
    close: () => wm.close(id),
    minimize: () => wm.minimize(id),
    maximize: () => wm.maximize(id),
    toggleMaximize: () => wm.toggleMaximize(id),
    restore: () => wm.restore(id),
    center: () => wm.center(id),
    sendToBack: () => wm.sendToBack(id),
    snap: (zone) => wm.snap(id, zone),
    moveToWorkspace: (workspace) => wm.moveToWorkspace(id, workspace),
  }
}
```

Expose it on the controller: add `actions: (id: string) => createActions(wm, id)` to the returned object in `attachDesktop`, and `actions(id: string): WindowActions` to `DesktopController` in `src/dom/shared.ts`.

- [x] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run tests/unit/actions.test.ts --coverage.enabled=false`
Expected: PASS.

- [x] **Step 5: Add the controller test**

```ts
it('hands out actions for a window from the desktop', () => {
  const harness = makeHarness()
  harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })

  harness.desktop.actions('a').minimize()
  expect(harness.wm.get('a')?.stage).toBe('minimized')
  expect(harness.desktop.actions('nope').focus()).toBe(false)
})
```

Add it to `tests/unit/dom.test.ts`, then run `pnpm exec vitest run tests/unit/dom.test.ts --coverage.enabled=false`.

- [x] **Step 6: Mutation-check**

Point `snap` at `wm.focus` instead; confirm the actions test fails. Restore.

- [x] **Step 7: Commit**

```bash
git add src/dom/actions.ts src/dom/shared.ts src/dom/controller.ts tests/unit
git commit -m "feat(dom): expose the window actions as a typed object"
```

---

### Task 2: Action attributes for arbitrary buttons

**Files:**
- Modify: `src/dom/controller.ts`
- Test: `tests/unit/dom.test.ts`

**Interfaces:**
- Consumes: `createActions` from Task 1.
- Produces: click delegation for `data-wm-snap="<zone>"`, `data-wm-restore`, `data-wm-send-back`, `data-wm-center`, `data-wm-workspace="<n>"`, alongside the existing `data-wm-close`, `data-wm-minimize`, `data-wm-maximize`.

**Behaviour contract**

- The existing three keep their flag guards (`closable`, `minimizable`, `maximizable`), including `beforeClose`.
- `data-wm-snap` obeys `snappable`; an unknown zone string is ignored.
- `data-wm-workspace` with a non-integer value is ignored.
- The attribute may sit on any element inside the window, at any depth — the handler already delegates from the window root.
- `INTERACTIVE_SELECTOR` grows the new attributes so a control never starts a drag.

- [x] **Step 1: Write the failing tests**

```ts
it('drives snap, restore, centre, back and workspace from window attributes', () => {
  const harness = makeHarness()
  const { root } = harness.add({ id: 'a', x: 10, y: 10, width: 200, height: 150 })
  const bar = document.createElement('div')
  bar.innerHTML =
    '<button data-wm-snap="left"></button><button data-wm-restore></button>' +
    '<button data-wm-center></button><button data-wm-send-back></button>' +
    '<button data-wm-workspace="2"></button>'
  root.append(bar)
  const [snap, restore, centre, back, workspace] = [
    ...bar.querySelectorAll('button'),
  ] as HTMLButtonElement[]

  snap.click()
  expect(harness.wm.get('a')?.snapZone).toBe('left')
  restore.click()
  expect(harness.wm.get('a')?.stage).toBe('normal')
  centre.click()
  expect(harness.wm.get('a')?.bounds.x).toBe(300)
  harness.add({ id: 'b', width: 100, height: 100 })
  back.click()
  expect(harness.wm.getState().order[0]).toBe('a')
  workspace.click()
  expect(harness.wm.get('a')?.workspace).toBe(2)
})

it('ignores an unknown zone, a bad workspace and a locked window', () => {
  const harness = makeHarness()
  const { root } = harness.add({ id: 'a', width: 200, height: 150, snappable: false })
  root.innerHTML +=
    '<button data-wm-snap="sideways"></button><button data-wm-workspace="x"></button>' +
    '<button data-wm-snap="left"></button>'
  for (const node of root.querySelectorAll('button')) (node as HTMLButtonElement).click()

  expect(harness.wm.get('a')?.snapZone).toBeNull()
  expect(harness.wm.get('a')?.workspace).toBe(0)
})
```

- [x] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run tests/unit/dom.test.ts -t attributes --coverage.enabled=false`
Expected: FAIL — nothing happens on click.

- [x] **Step 3: Extend the delegation**

In `attachWindow`'s `onClick`, after the existing three branches:

```ts
const act = createActions(wm, id)
const snapTarget = target.closest<HTMLElement>('[data-wm-snap]')
if (snapTarget) {
  const zone = snapTarget.dataset.wmSnap as SnapZone
  if (current.snappable && SNAP_ZONES.has(zone)) act.snap(zone)
  return
}
if (target.closest('[data-wm-restore]')) {
  act.restore()
  return
}
if (target.closest('[data-wm-center]')) {
  act.center()
  return
}
if (target.closest('[data-wm-send-back]')) {
  act.sendToBack()
  return
}
const workspaceTarget = target.closest<HTMLElement>('[data-wm-workspace]')
if (workspaceTarget) {
  const index = Number.parseInt(workspaceTarget.dataset.wmWorkspace ?? '', 10)
  if (Number.isInteger(index)) act.moveToWorkspace(index)
}
```

Add the module constant beside `SNAP_SHORTCUTS`:

```ts
const SNAP_ZONES = new Set<string>([
  'left', 'right', 'top', 'bottom',
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
  'left-third', 'center-third', 'right-third',
])
```

Extend `INTERACTIVE_SELECTOR` in `src/dom/shared.ts` with `[data-wm-snap], [data-wm-restore], [data-wm-center], [data-wm-send-back], [data-wm-workspace]`.

- [x] **Step 4: Run them to verify they pass**

Run: `pnpm exec vitest run tests/unit/dom.test.ts --coverage.enabled=false`

- [x] **Step 5: Mutation-check**

Drop the `SNAP_ZONES.has(zone)` guard; confirm the unknown-zone test fails. Drop `Number.isInteger`; confirm the bad-workspace test fails. Restore both.

- [x] **Step 6: Commit**

```bash
git add src/dom/controller.ts src/dom/shared.ts tests/unit/dom.test.ts
git commit -m "feat(dom): drive snap, restore, centre, back and workspace from window attributes"
```

---

### Task 3: The library owns the title text

**Files:**
- Modify: `src/dom/controller.ts`
- Test: `tests/unit/dom.test.ts`

**Interfaces:**
- Produces: `[data-wm-title]` inside an attached window has its text content kept in step with `WindowState.title`.

**Behaviour contract**

- On attach and on every title change, the node's `textContent` is set to the window title.
- Only the text is written; the node's own attributes and classes are left alone.
- A window without `[data-wm-title]` is unaffected.
- The write is skipped when the text already matches, so a title node holding focus or a selection is not disturbed.

Rationale: a skin's markup comes from a template string, so nothing outside the library can keep the title current. Today the demo does it by hand.

- [x] **Step 1: Write the failing test**

```ts
it('keeps the title node in step with the window title', () => {
  const harness = makeHarness()
  const { root } = harness.add({ id: 'a', title: 'First', width: 200, height: 150 })
  const title = root.querySelector('[data-wm-title]') as HTMLElement
  expect(title.textContent).toBe('First')

  harness.wm.update('a', { title: 'Second' })
  expect(title.textContent).toBe('Second')
  expect(root.getAttribute('aria-label')).toBe('Second')
})
```

The harness builds `<header data-wm-drag><span data-wm-title>t</span></header>`, so the first assertion fails today: the text stays `t`.

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run tests/unit/dom.test.ts -t "title node" --coverage.enabled=false`
Expected: FAIL — received `t`.

- [x] **Step 3: Implement**

Store the node on the registry entry: add `title: HTMLElement | null` to `AttachedWindow`, set it where `titleEl` is already looked up, and in `syncWindow`, inside the block that already writes `aria-label`:

```ts
if (attached.title && attached.title.textContent !== win.title) {
  attached.title.textContent = win.title
}
```

- [x] **Step 4: Run it to verify it passes**

- [x] **Step 5: Mutation-check**

Remove the `!==` guard so it writes unconditionally; confirm no test fails, then add one that does: focus a `contenteditable` title, fire an unrelated state change, and assert the selection survived. Keep whichever version the test justifies.

- [x] **Step 6: Commit**

```bash
git add src/dom/controller.ts tests/unit/dom.test.ts
git commit -m "feat(dom): keep the title node in step with the window title"
```

---

### Task 4: The skin protocol in the core

**Files:**
- Modify: `src/dom/shared.ts`, `src/dom/controller.ts`, `src/index.ts`
- Test: `tests/unit/dom.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SkinContext {
    doc: Document
    id: string
    window: WindowState
    actions: WindowActions
  }
  export interface SkinMount {
    element: HTMLElement
    content: HTMLElement
    destroy?(): void
  }
  export type WindowSkin = (ctx: SkinContext) => SkinMount
  export interface MountedWindow {
    element: HTMLElement
    content: HTMLElement
    detach(): void
  }
  ```
  `DesktopOptions` gains `skins?: Readonly<Record<string, WindowSkin>>`.
  `DesktopController` gains `mountWindow(id: string, skin: WindowSkin | string, options?: WindowAttachOptions): MountedWindow`.

**Behaviour contract**

- `mountWindow` calls the skin, appends `mount.element` to the desktop, attaches it exactly as `attachWindow` does, and hands back `content` for the caller to fill.
- A string names a skin in `options.skins`; an unknown name throws `wmkit: unknown skin "<name>"` — a typo must not silently produce a blank window.
- When a mounted window's `meta.skin` changes to another registered name, the desktop rebuilds it: new mount, every child of the old content node moved across with `append` (so a canvas, a video or a focused field survives), old mount destroyed.
- Remounting preserves attachment: the window keeps its id, geometry and focus.
- Windows created through `attachWindow` have no skin and never remount.

- [x] **Step 1: Write the failing tests**

```ts
const stripe: WindowSkin = ({ doc, actions }) => {
  const element = doc.createElement('section')
  element.innerHTML = '<header data-wm-drag><b data-wm-title></b></header><div></div>'
  const close = doc.createElement('button')
  close.className = 'x'
  close.addEventListener('click', () => actions.close())
  element.querySelector('header')?.append(close)
  return { element, content: element.querySelector('div') as HTMLElement }
}

it('mounts a window from a skin and hands back the content node', () => {
  const harness = makeHarness({ skins: { stripe } })
  harness.wm.open({ id: 'a', title: 'Hello', width: 200, height: 150 })
  const mounted = harness.desktop.mountWindow('a', 'stripe')

  expect(mounted.element.dataset.wmWindow).toBe('a')
  expect(mounted.element.querySelector('[data-wm-title]')?.textContent).toBe('Hello')
  mounted.content.append(document.createTextNode('body'))

  mounted.element.querySelector<HTMLButtonElement>('.x')?.click()
  expect(harness.wm.get('a')).toBeUndefined()
})

it('refuses a skin name it does not know', () => {
  const harness = makeHarness({ skins: { stripe } })
  harness.wm.open({ id: 'a' })
  expect(() => harness.desktop.mountWindow('a', 'nope')).toThrow(/unknown skin/)
})

it('rebuilds the window when the skin changes and carries the content over', () => {
  const plain: WindowSkin = ({ doc }) => {
    const element = doc.createElement('section')
    element.innerHTML = '<header data-wm-drag><b data-wm-title></b></header><div></div>'
    element.dataset.look = 'plain'
    return { element, content: element.querySelector('div') as HTMLElement }
  }
  const harness = makeHarness({ skins: { stripe, plain } })
  harness.wm.open({ id: 'a', title: 'Hello', meta: { skin: 'stripe' } })
  const mounted = harness.desktop.mountWindow('a', 'stripe')
  const live = document.createElement('canvas')
  mounted.content.append(live)

  harness.wm.update('a', { meta: { skin: 'plain' } })

  const now = harness.element.querySelector<HTMLElement>('[data-wm-window="a"]')
  expect(now?.dataset.look).toBe('plain')
  expect(now?.contains(live)).toBe(true)
  expect(harness.wm.get('a')?.title).toBe('Hello')
})
```

- [x] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run tests/unit/dom.test.ts -t skin --coverage.enabled=false`
Expected: FAIL — `mountWindow` is not a function.

- [x] **Step 3: Implement**

Add to the registry entry: `skinName: string | null`, `skinMount: SkinMount | null`, `content: HTMLElement | null`.

```ts
function resolveSkin(skin: WindowSkin | string): WindowSkin {
  if (typeof skin !== 'string') return skin
  const found = options.skins?.[skin]
  if (!found) throw new Error(`wmkit: unknown skin "${skin}"`)
  return found
}

function mountWindow(
  id: string,
  skin: WindowSkin | string,
  windowOptions: WindowAttachOptions = {},
): MountedWindow {
  const win = wm.get(id)
  if (!win) throw new Error(`wmkit: cannot mount unknown window "${id}"`)
  const mount = resolveSkin(skin)({ doc, id, window: win, actions: createActions(wm, id) })
  element.append(mount.element)
  const detach = attachWindow(id, mount.element, windowOptions)
  const attached = registry.get(id) as AttachedWindow
  attached.skinName = typeof skin === 'string' ? skin : null
  attached.skinMount = mount
  attached.content = mount.content
  return {
    element: mount.element,
    content: mount.content,
    detach() {
      detach()
      mount.destroy?.()
      mount.element.remove()
    },
  }
}
```

In `syncWindow`, before the geometry block:

```ts
const wanted = typeof win.meta.skin === 'string' ? win.meta.skin : null
if (attached.skinName !== null && wanted !== null && wanted !== attached.skinName) {
  remount(attached, win, wanted)
  return
}
```

```ts
function remount(attached: AttachedWindow, win: WindowState, name: string): void {
  const next = resolveSkin(name)({
    doc,
    id: win.id,
    window: win,
    actions: createActions(wm, win.id),
  })
  const previous = attached.element
  const carried = attached.content
  if (carried) next.content.append(...carried.childNodes)
  previous.replaceWith(next.element)
  const options = attached.options
  detachWindow(win.id)
  attached.skinMount?.destroy?.()
  const fresh = mountExisting(win.id, next, name, options)
  void fresh
}
```

Keep `remount` honest and small: it detaches the old attachment, then runs the same path `mountWindow` uses on the already-built `next` mount. Extract that shared tail into `mountExisting(id, mount, name, options)` so both call it.

Export the new types from `src/index.ts`.

- [x] **Step 4: Run them to verify they pass**

- [x] **Step 5: Run the whole unit suite with coverage**

Run: `pnpm exec vitest run --coverage`
Expected: exit 0, thresholds green.

- [x] **Step 6: Mutation-check**

Replace `next.content.append(...carried.childNodes)` with nothing; confirm the carry-over test fails. Replace the unknown-skin throw with a silent return; confirm the throw test fails. Restore both.

- [x] **Step 7: Commit**

```bash
git add src/dom src/index.ts tests/unit/dom.test.ts
git commit -m "feat(dom): mount a window from a skin and rebuild it when the skin changes"
```

---

### Task 5: The chrome entry — templates in the light DOM

**Files:**
- Create: `src/plugins/chrome/template.ts`, `src/plugins/chrome/index.ts`
- Modify: `tsup.config.ts`, `package.json`, `vitest.config.ts`, `tsconfig.json`, `site/vite.config.ts`
- Test: `tests/unit/chrome.test.ts`

**Interfaces:**
- Consumes: `WindowSkin`, `SkinContext`, `SkinMount` from `src/dom/shared.ts`.
- Produces:
  ```ts
  export interface SkinSpec {
    template: string
    styles?: string
    shadow?: boolean
    name?: string
  }
  export function skin(spec: SkinSpec): WindowSkin
  export const defaultSkin: WindowSkin
  export const barebones: WindowSkin
  export function compileTemplate(template: string): (values: Record<string, string>) => string
  ```

**Behaviour contract**

- `{{name}}` is replaced by the value; every substitution is HTML-escaped (`&`, `<`, `>`, `"`, `'`), with no opt-out.
- Available values: `title`, `id`, `stage`, `layer`, `workspace`, `variant`.
- An unknown placeholder expands to an empty string rather than throwing — a template outlives a rename.
- The template must contain exactly one `[data-wm-content]`; anything else throws `wmkit: a skin template needs exactly one [data-wm-content]`.
- `styles` without `shadow` is injected once per skin into `doc.head` verbatim, and the window carries `data-wm-skin="<name>"` so the author can scope their own rules. The library never rewrites the CSS.
- `defaultSkin` renders a titlebar with a title and close/minimize/maximize buttons wired by attribute; `barebones` renders a titlebar with the title only and no controls.

- [x] **Step 1: Write the failing tests**

```ts
it('expands placeholders and escapes every substitution', () => {
  const render = compileTemplate('<b>{{title}}</b><i>{{stage}}</i><u>{{nope}}</u>')
  expect(render({ title: '<img src=x onerror=alert(1)>', stage: 'normal' })).toBe(
    '<b>&lt;img src=x onerror=alert(1)&gt;</b><i>normal</i><u></u>',
  )
})

it('builds a window from a template and wires its buttons', () => {
  const harness = makeHarness()
  const mac = skin({
    name: 'mac',
    template:
      '<section><header data-wm-drag>' +
      '<button class="c" data-wm-close></button><span data-wm-title>{{title}}</span>' +
      '</header><div data-wm-content></div></section>',
  })
  harness.wm.open({ id: 'a', title: 'Notes', width: 200, height: 150 })
  const mounted = harness.desktop.mountWindow('a', mac)

  expect(mounted.element.dataset.wmSkin).toBe('mac')
  expect(mounted.element.querySelector('[data-wm-title]')?.textContent).toBe('Notes')
  mounted.element.querySelector<HTMLButtonElement>('.c')?.click()
  expect(harness.wm.get('a')).toBeUndefined()
})

it('refuses a template without exactly one content slot', () => {
  expect(() => skin({ template: '<div></div>' })).toThrow(/exactly one/)
  expect(() =>
    skin({ template: '<div data-wm-content></div><div data-wm-content></div>' }),
  ).toThrow(/exactly one/)
})

it('injects the styles of a light skin once and tags the window', () => {
  const harness = makeHarness()
  const tinted = skin({
    name: 'tinted',
    styles: '[data-wm-skin="tinted"] { --wm-bg: red; }',
    template: '<section><header data-wm-drag></header><div data-wm-content></div></section>',
  })
  harness.wm.open({ id: 'a' })
  harness.wm.open({ id: 'b' })
  harness.desktop.mountWindow('a', tinted)
  harness.desktop.mountWindow('b', tinted)

  expect(document.head.querySelectorAll('style[data-wm-skin-styles="tinted"]')).toHaveLength(1)
})

it('ships a default skin with working controls and a bare one without', () => {
  const harness = makeHarness()
  harness.wm.open({ id: 'a', title: 'Notes' })
  const full = harness.desktop.mountWindow('a', defaultSkin)
  expect(full.element.querySelector('[data-wm-close]')).not.toBeNull()

  harness.wm.open({ id: 'b', title: 'Bare' })
  const bare = harness.desktop.mountWindow('b', barebones)
  expect(bare.element.querySelector('[data-wm-close]')).toBeNull()
  expect(bare.element.querySelector('[data-wm-drag]')).not.toBeNull()
})
```

- [x] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run tests/unit/chrome.test.ts --coverage.enabled=false`

- [x] **Step 3: Implement the compiler**

```ts
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] as string)
}

export function compileTemplate(template: string): (values: Record<string, string>) => string {
  const parts = template.split(/\{\{\s*([a-z]+)\s*\}\}/i)
  return (values) =>
    parts
      .map((part, index) => (index % 2 === 0 ? part : escape(values[part] ?? '')))
      .join('')
}
```

- [x] **Step 4: Implement `skin()`**

Build the element with a `<template>` element so the markup is parsed inert, read `[data-wm-content]`, count it, set `data-wm-skin` when `spec.name` is given, and inject `spec.styles` once per name into `doc.head` as `<style data-wm-skin-styles="<name>">`.

- [x] **Step 5: Wire the entry**

`tsup.config.ts` gains `chrome: 'src/plugins/chrome/index.ts'`; `package.json` gains the `./chrome` export block, the `typesVersions` entry `"chrome": ["./dist/chrome.d.ts"]` and a size-limit entry `{ "name": "chrome plugin", "path": "dist/chrome.js", "limit": "3 kB" }`; `vitest.config.ts`, `tsconfig.json` and `site/vite.config.ts` gain the `@surdeddd/wmkit/chrome` alias.

The `typesVersions` entry is not optional: without it `attw` reports a failed node10 resolution and the release job stops, exactly as it did for `gestures` and `devtools`.

- [x] **Step 6: Run the tests and the package checks**

```bash
pnpm exec vitest run tests/unit/chrome.test.ts --coverage.enabled=false
pnpm build && pnpm size; echo "size exit=$?"
pnpm publint; echo "publint exit=$?"
pnpm attw; echo "attw exit=$?"
```
Expected: every exit code 0.

- [x] **Step 7: Mutation-check**

Remove the `escape` call; confirm the escaping test fails. Change the content-slot count check to `>= 1`; confirm the refusal test fails. Restore both.

- [x] **Step 8: Commit**

```bash
git add src/plugins/chrome tsup.config.ts package.json vitest.config.ts tsconfig.json site/vite.config.ts tests/unit/chrome.test.ts
git commit -m "feat(chrome): build a window from a template string"
```

---

### Task 6: Shadow skins, and the three core fixes they need

**Files:**
- Modify: `src/plugins/chrome/index.ts`, `src/dom/controller.ts`, `src/dom/drag.ts`
- Test: `tests/unit/chrome.test.ts`, `tests/unit/dom.test.ts`

**Interfaces:**
- Produces: `skin({ shadow: true })` mounts the chrome inside an open shadow root, projects the app content through a `<slot>`, and adopts one shared `CSSStyleSheet` per skin.

**Behaviour contract**

- The host element is the window; `mount.element` is the host, `mount.content` is a light-DOM `<div>` appended to the host and projected by the `<slot>` the library substitutes for `[data-wm-content]`.
- `spec.styles` becomes one `CSSStyleSheet`, constructed once per skin and adopted into every window built from it. Parsing cost stays O(1) in the number of windows.
- Resize handles go inside the shadow root, so page CSS cannot reach them.
- Grouping by drag keeps working: the drag session resolves the drop target from `event.composedPath()` rather than `document.elementsFromPoint`, so a titlebar inside a shadow root is still found.
- The modal focus trap keeps working: the focusable walk descends into the window's shadow root.
- The accessible name keeps working: when the title node lives in a shadow root the library sets `aria-label` and does not set `aria-labelledby`, because an IDREF cannot cross the boundary.

- [x] **Step 1: Write the failing tests**

```ts
it('mounts the chrome in a shadow root and projects the content', () => {
  const harness = makeHarness()
  const isolated = skin({
    name: 'iso',
    shadow: true,
    styles: ':host { display: block }',
    template:
      '<section><header data-wm-drag><span data-wm-title>{{title}}</span></header>' +
      '<div data-wm-content></div></section>',
  })
  harness.wm.open({ id: 'a', title: 'Notes' })
  const mounted = harness.desktop.mountWindow('a', isolated)

  expect(mounted.element.shadowRoot).not.toBeNull()
  expect(mounted.element.shadowRoot?.querySelector('[data-wm-title]')?.textContent).toBe('Notes')
  expect(mounted.content.getRootNode()).toBe(document)
  expect(mounted.element.querySelector('[data-wm-drag]')).toBeNull()
})

it('shares one stylesheet between every window of a shadow skin', () => {
  const harness = makeHarness()
  const isolated = skin({ name: 'iso', shadow: true, styles: ':host{}', template: TEMPLATE })
  harness.wm.open({ id: 'a' })
  harness.wm.open({ id: 'b' })
  const first = harness.desktop.mountWindow('a', isolated)
  const second = harness.desktop.mountWindow('b', isolated)

  expect(first.element.shadowRoot?.adoptedStyleSheets[0]).toBe(
    second.element.shadowRoot?.adoptedStyleSheets[0],
  )
})

it('labels a shadow window by string, not by reference', () => {
  const harness = makeHarness()
  const isolated = skin({ name: 'iso', shadow: true, template: TEMPLATE })
  harness.wm.open({ id: 'a', title: 'Notes' })
  const mounted = harness.desktop.mountWindow('a', isolated)

  expect(mounted.element.getAttribute('aria-label')).toBe('Notes')
  expect(mounted.element.hasAttribute('aria-labelledby')).toBe(false)
})

it('traps the tab key inside a shadow modal', () => {
  // buttons live in the shadow root; assert the trap wraps between them
})

it('finds a drop target whose titlebar is inside a shadow root', () => {
  // drag a light window onto a shadow window and assert data-wm-tab-target lands on it
})
```

- [x] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run tests/unit/chrome.test.ts --coverage.enabled=false`

- [x] **Step 3: Implement shadow mounting in `chrome`**

```ts
const sheets = new WeakMap<Document, Map<string, CSSStyleSheet>>()

function sheetFor(doc: Document, name: string, css: string): CSSStyleSheet {
  const perDoc = sheets.get(doc) ?? new Map<string, CSSStyleSheet>()
  sheets.set(doc, perDoc)
  const cached = perDoc.get(name)
  if (cached) return cached
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  perDoc.set(name, sheet)
  return sheet
}
```

The host gets `attachShadow({ mode: 'open' })`; the compiled tree goes inside; the `[data-wm-content]` node is replaced by `<slot></slot>`; a light `<div data-wm-content>` is appended to the host and returned as `mount.content`.

- [x] **Step 4: Fix the drop target in `src/dom/controller.ts`, not with `composedPath`**

The original plan said `composedPath()`. That is wrong, for two reasons that hold structurally in this code:

1. `src/dom/drag.ts` calls `handle.setPointerCapture(event.pointerId)` on the **dragged** window's own titlebar, so every later `pointermove` is dispatched at that handle. `composedPath()` then describes the moving window, never the window under the cursor.
2. `groupTarget` is called from `flush()`, which runs inside `requestAnimationFrame`. By then dispatch is over and `composedPath()` returns an empty array by spec.

Applied there it would be permanently dead code that reads like a fix. Pierce the shadow root inside `groupTarget` instead; `drag.ts` and the `SessionContext` signature stay untouched.

```ts
function handleAtPoint(node: Element, clientX: number, clientY: number): Element | null {
  let current: Element | null = node
  while (current !== null) {
    const found = current.closest?.('[data-wm-drag]')
    if (found) return found
    const root: ShadowRoot | null = current.shadowRoot
    if (!root || typeof root.elementFromPoint !== 'function') return null
    const inner: Element | null = root.elementFromPoint(clientX, clientY)
    current = inner === current ? null : inner
  }
  return null
}

function windowElementOf(node: Element): HTMLElement | null {
  let current: Element | null = node
  while (current !== null) {
    const found = current.closest<HTMLElement>('[data-wm-window]')
    if (found) return found
    current = (current.getRootNode() as ShadowRoot).host ?? null
  }
  return null
}
```

The light path returns on the first `closest`, so every existing window keeps the old behaviour and the hot path is unchanged. `windowElementOf` exists because `closest` stops at the shadow boundary and the climb has to go through `getRootNode().host`. Both `: ShadowRoot | null` and `: Element | null` annotations are required — without them TypeScript reports TS7022 on the circular inference through the loop.

No depth cap: the `inner === current` identity check already prevents the only realistic cycle, and a cap costs a branch out of a budget of six.

`composedPath()` is still the right tool at dispatch time — the keyboard and click handlers — and must not be confused with this. Say so in the commit message or it will be reintroduced.

- [x] **Step 5: Fix the focus trap and the label in `src/dom/controller.ts`**

This is the highest-risk fix in the plan: it replaces a native `querySelectorAll` on a path three green tests already exercise, and its failure mode is silent — focus escapes, nothing throws. Do it last, and measure branches immediately after.

Two facts drive the shape. `document.activeElement` retargets to the host when focus is inside a shadow root, so the existing `node === doc.activeElement` comparison can never match a shadow node; the real node is `shadowRoot.activeElement`. And naive `[...light, ...shadow]` concatenation gives the wrong order whenever content is projected through a `<slot>`, because the flattened order interleaves.

Keep the change as small as the budget allows: resolve the active element by descending `shadowRoot.activeElement`, and collect focusables across the flattened tree. Do not add a `containsDeep` helper for nested hosts — that case does not exist yet and costs branches there is no room for.

For the label, look the title node up in the shadow root as well, and only set `aria-labelledby` when the node shares a root with the window element. Four places document that linkage unconditionally and have to change with it: `docs/api.md`, `docs/theming.md`, `README.md`, `README.ru.md`.

- [x] **Step 6: Run the whole unit suite with coverage**

Run: `pnpm exec vitest run --coverage`; expected exit 0.

- [x] **Step 7: Mutation-check each of the three fixes**

Revert the `composedPath` resolution; confirm the drop-target test fails. Revert the shadow root walk; confirm the trap test fails. Set `aria-labelledby` unconditionally; confirm the label test fails. Restore all three.

- [x] **Step 8: Commit**

```bash
git add src/plugins/chrome src/dom tests/unit
git commit -m "feat(chrome): isolate a skin in a shadow root without losing grouping, focus trapping or the accessible name"
```

---

### Task 7: A committed theme generator and the themes as text

**Files:**
- Create: `scripts/themes.mjs`, `src/themes/index.ts`
- Modify: `src/themes/*.css` (regenerated), `package.json`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`
- Test: `tests/unit/themes.test.ts`

**Interfaces:**
- Produces: `pnpm themes` regenerates every theme; `@surdeddd/wmkit/themes` exports `themeNames` and `themeCss: Record<ThemeName, string>`.

**Behaviour contract**

- The generator is the single source of the sixteen theme files. Running it twice leaves the tree unchanged.
- It emits `src/themes/<name>.css` and, next to it, the same text as a TypeScript module so a shadow skin can adopt it.
- `src/themes/index.ts` maps every name to its CSS text.
- A test regenerates into a temporary directory and asserts the committed files match, so a hand-edit that bypasses the generator fails CI.

Rationale: the thirteen themes added on 2026-08-14 were produced by a script that was never committed, so today they cannot be reproduced or safely changed in bulk. The duplicate-`color` defect that broke the release came from exactly that gap.

- [x] **Step 1: Move the generator into the repo**

Port the generator to `scripts/themes.mjs`, keeping the control presets (`dots`, `squares`, `outline`, `glossy`) and the per-theme token tables. Add `"themes": "node scripts/themes.mjs"` to `package.json` scripts.

- [x] **Step 2: Write the failing test**

```ts
it('every shipped theme comes out of the generator unchanged', async () => {
  const out = await mkdtemp(join(tmpdir(), 'wm-themes-'))
  execFileSync('node', ['scripts/themes.mjs', '--out', out])
  for (const name of themeNames) {
    expect(readFileSync(`${out}/${name}.css`, 'utf8'), name).toBe(
      readFileSync(`src/themes/${name}.css`, 'utf8'),
    )
  }
})
```

- [x] **Step 3: Run it to verify it fails**

Expected: FAIL — the script does not exist yet, or the committed files differ.

- [x] **Step 4: Regenerate and reconcile**

Run `pnpm themes`, review the diff, and commit the regenerated files. `glass`, `light` and `retro` predate the generator: either bring them under it or list them as hand-written and exclude them from the test — do not pretend they are generated.

- [x] **Step 5: Add the themes entry**

`src/themes/index.ts` exports `themeNames` and `themeCss`. Add the tsup entry, the `./themes` export block, the `typesVersions` entry and a size-limit budget of `20 kB` (it is sixteen stylesheets as strings; the number is large on purpose and only paid by whoever imports it).

- [x] **Step 6: Verify**

```bash
pnpm exec vitest run tests/unit/themes.test.ts --coverage.enabled=false
pnpm exec biome check .; echo "lint exit=$?"
pnpm build && pnpm size; echo "size exit=$?"
```

- [x] **Step 7: Commit**

```bash
git add scripts src/themes package.json tsup.config.ts tsconfig.json vitest.config.ts tests/unit/themes.test.ts
git commit -m "build(themes): commit the generator and publish the themes as text"
```

---

### Task 8: The skin constructor in the demo, e2e and docs

**Files:**
- Modify: `site/src/apps.ts`, `site/src/apps.css`, `site/src/i18n.ts`, `docs/api.md`, `docs/theming.md`, `docs/recipes.md`, `README.md`, `README.ru.md`
- Create: `tests/e2e/skins.spec.ts`

**Behaviour contract**

- The existing `skins` app grows a third section: the skin. It offers a few ready layouts (controls left, controls right, no titlebar), a textarea holding the template, a checkbox for shadow, and a copy button that puts the `{ template, styles }` object on the clipboard as code.
- Changing the layout applies it to the focused window immediately, through `wm.update(id, { meta: { skin } })` — the same path a consumer uses.
- Copy uses `navigator.clipboard` when present and falls back to showing the code in a selectable field.
- Copy is the only export: nothing is persisted.
- Every new string is in both catalogs, English and Russian.

- [x] **Step 1: Extend the demo app**

Register the layouts as skins on the demo's `attachDesktop` call, and drive them from `meta.skin`.

- [x] **Step 2: Write the e2e**

```ts
test('the constructor restyles a live window', async ({ page }) => {
  await page.goto('?lang=en')
  await page.click('#launcher button[data-app="skins"]')
  const win = page.locator('[data-testid="window-skins"]')
  await expect(win).toBeVisible()

  await win.locator('.skin-layout button').nth(1).click()
  await expect(win.locator('[data-wm-drag] [data-wm-controls]')).toHaveAttribute(
    'data-side',
    'right',
  )
  await expect(win.locator('[data-wm-title]')).toHaveText('skins')
})

test('the constructor copies the skin as code', async ({ page }) => { /* clipboard read */ })
```

- [x] **Step 3: Run the demo suites**

```bash
CI=1 pnpm exec playwright test --project=chromium --workers=1 \
  tests/e2e/skins.spec.ts tests/e2e/landing.spec.ts tests/e2e/landing-a11y.spec.ts
```
Expected: exit 0, no new axe violations. The launcher count assertion in `landing.spec.ts` stays at 11 — the constructor extends an existing app rather than adding one.

- [x] **Step 4: Document**

`docs/api.md`: `actions()`, `mountWindow()`, the skin protocol types, the new attributes. `docs/theming.md`: skins beside themes and variants — theme dresses every window, variant retunes one, skin rebuilds one. `docs/recipes.md`: "Build a window from scratch", showing a template, its buttons and the shadow flag. Both READMEs: the `@surdeddd/wmkit/chrome` entry beside `gestures` and `devtools`.

- [x] **Step 5: Full gate, by exit code**

```bash
pnpm exec biome check .; echo "lint=$?"
pnpm exec tsc --noEmit; echo "tsc=$?"
pnpm exec vitest run --coverage; echo "cov=$?"
pnpm build; echo "build=$?"
pnpm size; echo "size=$?"
pnpm publint; echo "publint=$?"
pnpm attw; echo "attw=$?"
for p in chromium firefox webkit mobile; do
  CI=1 pnpm exec playwright test --project=$p --workers=1 --reporter=line
  echo "$p=$?"
done
```
Every number must be 0. Run one Playwright project at a time: this machine runs out of memory with several engines at once, and the failures look like product defects.

- [x] **Step 6: Commit**

```bash
git add site docs README.md README.ru.md tests/e2e/skins.spec.ts
git commit -m "feat(site): build a window skin in the demo"
```

---

## Self-review

**Spec coverage.** Own markup — Task 5. Own buttons with handlers — Tasks 1, 2, 5. Skin as a switchable unit — Task 4. Shadow isolation — Task 6. Themes as text for shadow — Task 7. Constructor in the demo — Task 8. Friendlier API — Tasks 1 and 4. Nothing in the brief is unclaimed.

**Risks worth naming before starting.**

1. **Task 6 is the whole risk of this plan**, and a four-agent recon run before implementation already overturned its first draft: `composedPath` cannot work in `groupTarget` because of pointer capture and the rAF hop. Order the three fixes by risk — accessible name first (smallest, mutation-checkable), then the drop target, then the focus trap last. The gate that will actually fail is the branch threshold, not a red assertion.
2. **`adoptedStyleSheets` and `CSSStyleSheet` are not in jsdom.** The shadow tests need a small stub, and the real assertion for sharing has to be repeated in a browser e2e; a jsdom-only claim about stylesheet sharing would be theatre.
3. **Task 7 may reveal that `glass`, `light` and `retro` do not round-trip** through the generator. Say so and exclude them explicitly rather than bending the generator to reproduce hand-written files byte for byte.
