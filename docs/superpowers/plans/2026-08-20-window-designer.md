# Window Designer Implementation Plan

**Goal:** the `#builder` band becomes a full window designer: a live preview desktop beside the controls, with markup, CSS, placement and presets all editable, bilingual, tested.

**Spec (10 lines):**
- Two columns: controls left (presets, markup textarea, CSS textarea, shadow toggle, x/y/w/h inputs, copy, to-desktop), live preview stage right; stacked below 1000px.
- The preview stage is a second real `attachDesktop` with one window mounted from the edited skin; drag/resize/snap work inside it.
- Edits apply live (400ms debounce); a broken template shows the engine's message and keeps the last good skin.
- Five presets: site theme, macOS, win95, terminal, glass card — each a template + scoped CSS (`[data-wm-window][data-wm-skin="custom"]`), default macOS.
- Geometry inputs are bidirectional: typing moves the window, dragging updates the inputs.
- The preview follows the site theme; shadow mode shows a `:host` hint.
- Copy produces a complete runnable snippet (imports, skin, mountWindow); "to the desktop" applies the skin to the main demo desktop.
- Every string in both catalogues; `tests/e2e/builder.spec.ts` rewritten to cover preview, CSS restyle, presets, geometry both ways, error path, copy.
- Failure mode: a preset or CSS must never break the band — errors land in the status line only.

**Files:** create `site/src/builder.ts`; modify `site/src/main.ts`, `site/src/i18n.ts`, `site/src/os.css`, `site/index.html`, `site/src/apps.ts` (applySkin signature), `tests/e2e/builder.spec.ts`.
