# Devtools Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@surdeddd/wmkit/devtools` — an opt-in panel that shows a live window table, an event log and the manager controls, so anyone building on wmkit can see what the state machine is doing.

**Architecture:** A plugin in the shape the repo already uses for `persist` and `popout`: one factory that takes a `WindowManager`, mounts its own DOM, subscribes to the manager, and returns a controller with `destroy()`. It renders with plain DOM calls into a shadow-free container carrying `data-wm-devtools`, injects one scoped `<style>`, and never imports the themes. Messages follow the announcer precedent — an interface plus an English catalog and a Russian catalog the caller picks.

**Tech Stack:** TypeScript strict, vitest + jsdom, Playwright, tsup multi-entry, size-limit, biome.

## Global Constraints

- No explanatory comments in source. Knowledge goes to `MEMORY_BANK/`, not the code.
- Identifiers, commit messages and branch names in English. Conventional commits.
- Commits authored by Максим Кравцов with no AI co-author trailer.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
- Coverage thresholds must stay green: `src/plugins/**` at `statements 100, lines 100, functions 100, branches 97`.
- Bilingual by catalog, never by concatenated `"english / русский"` literals.
- The panel must not import `src/themes/**` and must work against an unstyled host page.
- New size-limit budget: `dist/devtools.js` under 5 kB brotlied.
- The entry must be side-effect free until `createDevtools` is called.

---

## File Structure

- `src/plugins/devtools/messages.ts` (create) — `DevtoolsMessages`, `devtoolsMessages` (en), `devtoolsMessagesRu`.
- `src/plugins/devtools/view.ts` (create) — DOM construction and the per-frame table/log patching. No manager knowledge beyond the state it is handed.
- `src/plugins/devtools/index.ts` (create) — `createDevtools`, subscription, event log ring buffer, action dispatch, `destroy`.
- `tsup.config.ts`, `package.json` (modify) — entry, export map, size budget.
- `vitest.config.ts` (modify) — alias for the new subpath.
- `tests/unit/devtools.test.ts` (create).
- `tests/e2e/devtools.spec.ts` (create).
- `site/src/apps.ts`, `site/src/main.ts`, `site/src/i18n.ts` (modify) — a devtools app in the launcher.
- `docs/api.md`, `docs/recipes.md`, `README.md` (modify).

---

### Task 1: Message catalogs

**Files:**
- Create: `src/plugins/devtools/messages.ts`
- Test: `tests/unit/devtools.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DevtoolsMessages {
    title: string
    windows: string
    events: string
    empty: string
    focus: string
    minimize: string
    maximize: string
    restore: string
    close: string
    undo: string
    redo: string
    copyState: string
    copied: string
    workspace(index: number): string
    stage(stage: WindowStage): string
  }
  export const devtoolsMessages: DevtoolsMessages
  export const devtoolsMessagesRu: DevtoolsMessages
  ```

- [ ] **Step 1: Write the failing test**

```ts
it('ships an english and a russian catalog with the same keys', () => {
  expect(Object.keys(devtoolsMessagesRu).sort()).toEqual(Object.keys(devtoolsMessages).sort())
  expect(devtoolsMessages.stage('maximized')).toBe('maximized')
  expect(devtoolsMessagesRu.stage('maximized')).toBe('развёрнуто')
  expect(devtoolsMessagesRu.workspace(2)).toBe('рабочий стол 3')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run tests/unit/devtools.test.ts --coverage.enabled=false`

- [ ] **Step 3: Write both catalogs**

- [ ] **Step 4: Run it to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add src/plugins/devtools/messages.ts tests/unit/devtools.test.ts
git commit -m "feat(devtools): add the english and russian message catalogs"
```

---

### Task 2: Panel view

**Files:**
- Create: `src/plugins/devtools/view.ts`
- Test: `tests/unit/devtools.test.ts`

**Interfaces:**
- Consumes: `DevtoolsMessages`; `ManagerState`, `WindowState` from `src/core/types.ts`.
- Produces:
  ```ts
  export interface DevtoolsView {
    root: HTMLElement
    onAction: (handler: (action: DevtoolsAction, id: string) => void) => void
    render(state: ManagerState, log: readonly DevtoolsLogEntry[]): void
    destroy(): void
  }
  export type DevtoolsAction = 'focus' | 'minimize' | 'maximize' | 'restore' | 'close'
  export interface DevtoolsLogEntry { seq: number; type: string; detail: string }
  export function createDevtoolsView(doc: Document, messages: DevtoolsMessages): DevtoolsView
  ```

**Behaviour contract**

- `root` carries `data-wm-devtools` and `role="complementary"`, and is labelled by the panel title.
- One `<style data-wm-devtools-style>` is injected into `doc.head` on the first view and reference-counted, so two panels share it and the last `destroy()` removes it.
- `render` rewrites the window rows and the log list; a row shows id, title, stage, layer, workspace, `x,y w×h` and z index.
- Row buttons carry `data-wm-devtools-action` and `data-wm-devtools-id`; a single delegated click listener turns them into `onAction` calls.
- The log renders newest first and shows at most what it is handed.
- `destroy()` removes `root`, drops the listener and releases the stylesheet.

- [ ] **Step 1: Write the failing tests**

```ts
it('renders one row per window with its geometry and stage', () => { /* … */ })
it('reports which button was pressed on which window', () => { /* … */ })
it('shows the empty message when there are no windows', () => { /* … */ })
it('shares one stylesheet between panels and removes it with the last one', () => { /* … */ })
```

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement the view**

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add src/plugins/devtools/view.ts tests/unit/devtools.test.ts
git commit -m "feat(devtools): render the window table and the event log"
```

---

### Task 3: Devtools controller

**Files:**
- Create: `src/plugins/devtools/index.ts`
- Test: `tests/unit/devtools.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DevtoolsOptions {
    container?: HTMLElement
    messages?: Partial<DevtoolsMessages>
    logLimit?: number
    events?: readonly (keyof ManagerEvents)[]
  }
  export interface DevtoolsController {
    element: HTMLElement
    destroy(): void
  }
  export function createDevtools(wm: WindowManager, options?: DevtoolsOptions): DevtoolsController
  ```
  Defaults: `container` is `document.body`, `logLimit` is 50, `events` is
  `['open', 'close', 'focus', 'stage', 'workspace', 'group', 'modalblocked']`.

**Behaviour contract**

- Subscribing happens once; every manager event in `events` appends an entry and re-renders.
- The log is a ring buffer capped at `logLimit` — entry `seq` keeps counting past the cap.
- Row actions call `wm.focus`, `wm.minimize`, `wm.toggleMaximize`, `wm.restore`, `wm.close`.
- Undo and redo buttons reflect `canUndo()` / `canRedo()` through the `disabled` attribute.
- Copy writes `JSON.stringify(wm.serialize())` through `navigator.clipboard.writeText` when it exists, and falls back to leaving the JSON in a selectable field when it does not.
- `destroy()` unsubscribes every listener, destroys the view and leaves the document as it found it.

- [ ] **Step 1: Write the failing tests**

```ts
it('lists the windows that are open and follows the manager', () => { /* … */ })
it('logs the events it was asked for and caps the buffer', () => { /* … */ })
it('drives the manager from the row buttons', () => { /* … */ })
it('mirrors the undo and redo availability', () => { /* … */ })
it('copies the serialized state, with and without a clipboard', () => { /* … */ })
it('renders in russian when handed the russian catalog', () => { /* … */ })
it('leaves nothing behind on destroy', () => { /* … */ })
```

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement the controller**

- [ ] **Step 4: Run the plugin suite with coverage**

Run: `pnpm exec vitest run --coverage`
Expected: `src/plugins/**` at 100% statements, lines and functions and at least 97% branches.

- [ ] **Step 5: Mutation-check the cap and the dispatch**

Raise the ring buffer cap by one; confirm the cap test fails. Point the minimize action at `focus`; confirm the dispatch test fails. Restore both.

- [ ] **Step 6: Commit**

```bash
git add src/plugins/devtools/index.ts tests/unit/devtools.test.ts
git commit -m "feat(devtools): drive the panel from the manager"
```

---

### Task 4: Ship the entry point

**Files:**
- Modify: `tsup.config.ts`, `package.json`, `vitest.config.ts`

- [ ] **Step 1: Add the build entry**

`tsup.config.ts` gains `devtools: 'src/plugins/devtools/index.ts'`.

- [ ] **Step 2: Add the export map entry**

`package.json` `exports` gains `./devtools` with the same import/require shape as `./popout`.

- [ ] **Step 3: Add the size budget**

`package.json` `size-limit` gains `{ "name": "devtools plugin", "path": "dist/devtools.js", "limit": "5 kB" }`.

- [ ] **Step 4: Add the test alias**

`vitest.config.ts` `resolve.alias` gains `'@surdeddd/wmkit/devtools'`.

- [ ] **Step 5: Verify the package surface**

Run: `pnpm build && pnpm size && pnpm publint && pnpm attw`
Expected: all green, `dist/devtools.js` under 5 kB.

- [ ] **Step 6: Commit**

```bash
git add tsup.config.ts package.json vitest.config.ts
git commit -m "build: publish the devtools panel as its own entry point"
```

---

### Task 5: Demo, e2e and docs

**Files:**
- Create: `tests/e2e/devtools.spec.ts`
- Modify: `site/src/apps.ts`, `site/src/main.ts`, `site/src/i18n.ts`, `docs/api.md`, `docs/recipes.md`, `README.md`

- [ ] **Step 1: Put the panel in the demo**

Add a `devtools` launcher app that mounts the panel inside its window body and passes the Russian catalog when the site language is `ru`, proving the bilingual path in the shipped demo.

- [ ] **Step 2: Write the e2e**

```ts
test('the devtools panel tracks the desktop', async ({ page }) => {
  await page.goto('?lang=en')
  await page.click('#launcher button[data-app="devtools"]')
  const panel = page.locator('[data-wm-devtools]')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-wm-devtools-row]')).toHaveCount(2)
  await page.click('#launcher button[data-app="layouts"]')
  await expect(panel.locator('[data-wm-devtools-row]')).toHaveCount(3)
})

test('the devtools panel is announced and reachable by keyboard', async ({ page }) => { /* … */ })
```

- [ ] **Step 3: Run chromium and the a11y sweep**

Run: `CI=1 pnpm exec playwright test --project=chromium --workers=1 tests/e2e/devtools.spec.ts tests/e2e/landing-a11y.spec.ts`
Expected: PASS, no new axe violations.

- [ ] **Step 4: Document it**

`README.md` gains the entry beside `persist` and `popout`. `docs/api.md` gains the `createDevtools` reference. `docs/recipes.md` gains a "See what the manager is doing" recipe including the Russian catalog.

- [ ] **Step 5: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm size && pnpm publint && pnpm attw`
then each Playwright project in turn with `--workers=1`.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/devtools.spec.ts site docs README.md
git commit -m "docs: show the devtools panel in the demo"
```
