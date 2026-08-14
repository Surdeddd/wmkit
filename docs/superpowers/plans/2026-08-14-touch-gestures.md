# Touch Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give wmkit two touch gestures — pinch a window to resize it, and swipe the desktop background to change workspace.

**Architecture:** Both gestures live in the DOM layer beside the existing drag and resize sessions and reuse the same `SessionContext` plumbing (`claimDrag`/`releaseDrag`, `toLocal`, `trackRect`), so a pinch can never run concurrently with a drag or resize. Both respond only to `pointerType === 'touch'`, so mouse and pen behaviour is unchanged. The core state machine is untouched — gestures only call the existing `wm.resize` and `wm.setWorkspace`.

**Tech Stack:** TypeScript strict, vitest + jsdom for unit tests, Playwright with CDP `Input.dispatchTouchEvent` for genuine touch e2e, biome, tsup, size-limit.

## Global Constraints

- No explanatory comments in source. Knowledge goes to `MEMORY_BANK/`, not the code.
- Identifiers, commit messages and branch names in English. Conventional commits.
- Commits authored by Максим Кравцов with no AI co-author trailer.
- TypeScript strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
- Coverage thresholds must stay green: `src/dom/**` at `statements 100, lines 100, functions 100, branches 90`.
- `dist/index.js` must stay under the 14 kB size-limit budget.
- Every behavioural claim gets a mutation check: revert the line, confirm a named test dies.
- Gestures act only on `event.pointerType === 'touch'`.

---

## File Structure

- `src/dom/pinch.ts` (create) — pinch session factory. Owns two-pointer tracking, the scale math and the anchor.
- `src/dom/swipe.ts` (create) — background swipe watcher. Owns single-pointer travel tracking and the workspace step.
- `src/dom/shared.ts` (modify) — `PinchOptions`, `SwipeOptions`, two new `DesktopOptions` fields.
- `src/dom/controller.ts` (modify) — construct both, wire the pinch listener per window, wire the swipe listener on the desktop, register cleanup.
- `src/index.ts` (modify) — export the two new option types.
- `tests/unit/gestures.test.ts` (create) — unit coverage for both gestures.
- `tests/e2e/touch.spec.ts` (modify) — real two-finger pinch and a background swipe.
- `docs/api.md`, `docs/recipes.md`, `README.md` (modify) — options table, caveats, examples.
- `site/src/main.ts` (modify) — surface the gesture hint on touch devices.

---

### Task 1: Pinch session

**Files:**
- Create: `src/dom/pinch.ts`
- Test: `tests/unit/gestures.test.ts`

**Interfaces:**
- Consumes: `SessionContext` from `src/dom/shared.ts`; `clampSize`, `applyAspect` from `src/core/geometry.ts`.
- Produces:
  ```ts
  export function createPinchStarter(
    ctx: SessionContext,
    options: Required<PinchOptions>,
  ): (id: string, element: HTMLElement, event: PointerEvent) => void
  ```

**Behaviour contract**

- A pointerdown is remembered only when `event.pointerType === 'touch'`.
- The session arms on the second touch pointer for the same window, and only when `ctx.currentDrag()` is `null`, the window is `resizable` and its stage is `'normal'`.
- The session starts moving the window only once `Math.abs(distance - startDistance) > options.threshold`.
- The point under the initial midpoint stays under the midpoint: with `sx = size.width / start.width`, `x = midX - (midX - start.x) * sx` (and the same for `y`).
- Size is clamped locally through the window's own `minSize`, `maxSize` and `aspectRatio` before the anchor is derived, so clamping never drifts the anchor.
- `Escape`, `pointercancel` and desktop destroy cancel and restore the start bounds.
- The whole pinch is one undo step (`wm.beginInteraction()` … `wm.endInteraction()`).
- While active the element carries `data-wm-pinching`.

- [ ] **Step 1: Write the failing tests**

```ts
it('resizes a window around the midpoint of two fingers', () => {
  const harness = makeHarness()
  const { root } = harness.add({ id: 'a', x: 100, y: 100, width: 200, height: 200 })

  touchDown(root, 1, 100, 100)
  touchDown(root, 2, 300, 300)
  touchMove(root, 1, 50, 50)
  touchMove(root, 2, 350, 350)
  harness.flushFrames()

  expect(root.dataset.wmPinching).toBe('')
  expect(harness.wm.get('a')?.bounds).toMatchObject({ x: 50, y: 50, width: 300, height: 300 })
})

it('leaves the window alone until the fingers travel past the threshold', () => { /* … */ })
it('refuses to pinch while a drag is in flight', () => { /* … */ })
it('refuses to pinch a window that cannot resize or is not normal', () => { /* … */ })
it('honours the min size and aspect ratio while pinching', () => { /* … */ })
it('escape and pointercancel put the start bounds back', () => { /* … */ })
it('collapses a whole pinch into a single undo step', () => { /* … */ })
it('ignores mouse and pen pointers', () => { /* … */ })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/gestures.test.ts --coverage.enabled=false`
Expected: FAIL — `createPinchStarter` is not exported.

- [ ] **Step 3: Implement `src/dom/pinch.ts`**

Core math, verbatim:

```ts
const raw = { width: start.width * ratio, height: start.height * ratio }
const size =
  win.aspectRatio === null
    ? clampSize(raw, win.minSize, win.maxSize)
    : applyAspect(raw, win.aspectRatio, win.minSize, win.maxSize, 'width')
const sx = size.width / start.width
const sy = size.height / start.height
wm.resize(id, {
  x: midX - (midX - start.x) * sx,
  y: midY - (midY - start.y) * sy,
  ...size,
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/gestures.test.ts --coverage.enabled=false`
Expected: PASS.

- [ ] **Step 5: Mutation-check the anchor and the threshold**

Break `midX - (midX - start.x) * sx` into `start.x`; confirm the midpoint test fails. Break `> options.threshold` into `>= 0`; confirm the threshold test fails. Restore both.

- [ ] **Step 6: Commit**

```bash
git add src/dom/pinch.ts tests/unit/gestures.test.ts
git commit -m "feat(dom): resize a window by pinching it"
```

---

### Task 2: Background swipe

**Files:**
- Create: `src/dom/swipe.ts`
- Test: `tests/unit/gestures.test.ts`

**Interfaces:**
- Consumes: `SessionContext`.
- Produces:
  ```ts
  export function createSwipeWatcher(
    ctx: SessionContext,
    element: HTMLElement,
    options: Required<SwipeOptions>,
  ): () => void
  ```
  The return value detaches every listener it added.

**Behaviour contract**

- Only `pointerType === 'touch'` and only when the pointerdown target is not inside `[data-wm-window]`.
- A gesture commits on pointerup when `Math.abs(dx) >= options.threshold` and `Math.abs(dx) > 2 * Math.abs(dy)`.
- Swipe left (`dx < 0`) advances to the next workspace, swipe right steps back.
- The result is clamped to `0` at the bottom and to `options.workspaces - 1` when `workspaces` is a positive number; `workspaces: 0` means no upper bound.
- A second pointer abandons the gesture, so a pinch never doubles as a swipe.
- `pointercancel` abandons the gesture.

- [ ] **Step 1: Write the failing tests**

```ts
it('swipes the desktop background to the next and previous workspace', () => {
  const harness = makeHarness({ swipe: { threshold: 60, workspaces: 3 } })
  swipe(harness.element, [400, 300], [300, 310])
  expect(harness.wm.workspace()).toBe(1)
  swipe(harness.element, [300, 300], [420, 306])
  expect(harness.wm.workspace()).toBe(0)
})

it('stops at the first and last workspace', () => { /* … */ })
it('ignores a mostly vertical drag and a short one', () => { /* … */ })
it('ignores a swipe that starts on a window', () => { /* … */ })
it('abandons the gesture when a second finger lands', () => { /* … */ })
it('detaches every listener when the watcher is stopped', () => { /* … */ })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/gestures.test.ts -t swipe --coverage.enabled=false`
Expected: FAIL — `createSwipeWatcher` is not exported.

- [ ] **Step 3: Implement `src/dom/swipe.ts`**

- [ ] **Step 4: Run the tests to verify they pass**

- [ ] **Step 5: Mutation-check the direction and the axis guard**

Flip `dx < 0 ? 1 : -1`; confirm the direction test fails. Drop `Math.abs(dx) > 2 * Math.abs(dy)`; confirm the vertical-drag test fails. Restore both.

- [ ] **Step 6: Commit**

```bash
git add src/dom/swipe.ts tests/unit/gestures.test.ts
git commit -m "feat(dom): change workspace with a background swipe"
```

---

### Task 3: Options and controller wiring

**Files:**
- Modify: `src/dom/shared.ts`, `src/dom/controller.ts`, `src/index.ts`
- Test: `tests/unit/gestures.test.ts`, `tests/unit/dom.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PinchOptions {
    threshold?: number
    lockTouchAction?: boolean
  }
  export interface SwipeOptions {
    threshold?: number
    workspaces?: number
  }
  export interface DesktopOptions {
    pinch?: boolean | PinchOptions
    swipe?: boolean | SwipeOptions
  }
  ```
  Defaults: `pinch` enabled with `threshold: 12`, `lockTouchAction: false`; `swipe` enabled with `threshold: 72`, `workspaces: 0`.

- [ ] **Step 1: Write the failing tests**

```ts
it('switches both gestures off on request', () => {
  const harness = makeHarness({ pinch: false, swipe: false })
  /* pinch does nothing, swipe does nothing */
})
it('locks touch-action on the window when asked to', () => { /* … */ })
it('stops both gestures when the desktop is destroyed', () => { /* … */ })
```

- [ ] **Step 2: Run the tests to verify they fail**

- [ ] **Step 3: Wire the gestures**

In `attachWindow`, after the focus listener:

```ts
if (pinchEnabled) {
  const onPinchDown = (event: PointerEvent) => startPinch(id, windowElement, event)
  windowElement.addEventListener('pointerdown', onPinchDown)
  attached.cleanup.push(() => windowElement.removeEventListener('pointerdown', onPinchDown))
  if (pinchOptions.lockTouchAction) windowElement.style.touchAction = 'none'
}
```

In the desktop body, beside the keyboard wiring:

```ts
if (swipeEnabled) cleanup.push(createSwipeWatcher(ctx, element, swipeOptions))
```

- [ ] **Step 4: Run the whole unit suite with coverage**

Run: `pnpm exec vitest run --coverage`
Expected: PASS with `src/dom/**` still at 100% statements, lines and functions.

- [ ] **Step 5: Commit**

```bash
git add src/dom/shared.ts src/dom/controller.ts src/index.ts tests/unit
git commit -m "feat(dom): expose the pinch and swipe gestures as desktop options"
```

---

### Task 4: Real touch coverage and docs

**Files:**
- Modify: `tests/e2e/touch.spec.ts`, `docs/api.md`, `docs/recipes.md`, `README.md`, `site/src/main.ts`

- [ ] **Step 1: Add the e2e gestures**

```ts
test('two fingers pinch the window larger', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page)
  await page.goto('?lang=en')
  const before = await boundsOf(page, 'readme')
  const box = await page.locator(readme).boundingBox()
  const a = { x: (box?.x ?? 0) + 40, y: (box?.y ?? 0) + 60 }
  const b = { x: (box?.x ?? 0) + 160, y: (box?.y ?? 0) + 140 }
  await touch(cdp, 'touchStart', [a, b])
  for (let step = 1; step <= 5; step += 1) {
    await touch(cdp, 'touchMove', [
      { x: a.x - step * 8, y: a.y - step * 6 },
      { x: b.x + step * 8, y: b.y + step * 6 },
    ])
  }
  await touch(cdp, 'touchEnd', [])
  const after = await boundsOf(page, 'readme')
  expect(after?.width, 'the window never grew under the pinch').toBeGreaterThan(before?.width ?? 0)
})

test('a swipe across the background changes workspace', async ({ page, context }) => { /* … */ })
```

- [ ] **Step 2: Run the mobile project**

Run: `CI=1 pnpm exec playwright test --project=mobile --workers=1 tests/e2e/touch.spec.ts`
Expected: PASS.

- [ ] **Step 3: Document both gestures**

`docs/api.md` gains `pinch` and `swipe` rows. `docs/recipes.md` gains a "Touch gestures" section that states plainly: pinch needs the window content not to claim the gesture, and `lockTouchAction: true` is the escape hatch for apps that never scroll inside a window.

- [ ] **Step 4: Run the full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm size`
Expected: all green, `dist/index.js` under 14 kB.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/touch.spec.ts docs README.md site/src/main.ts
git commit -m "docs: describe the pinch and swipe gestures"
```
