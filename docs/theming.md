# Theming

wmkit never styles anything by class name. It writes `data-wm-*` attributes and inline geometry, and a theme is just CSS that reacts to those attributes. Sixteen themes ship with the package; replacing them with your own removes every CSS requirement the library has.

```js
import '@surdeddd/wmkit/themes/glass.css'  // dark translucent, the default look
import '@surdeddd/wmkit/themes/light.css'  // light translucent
```

| File | Look |
| --- | --- |
| `glass.css` | dark translucent, the default |
| `light.css` | light translucent |
| `retro.css` | Win98 bevels, no blur |
| `terminal.css` | monospace, phosphor green, square controls |
| `paper.css` | warm off-white, serif titles, ink offset shadow |
| `neon.css` | deep indigo with a magenta and cyan glow |
| `aqua.css` | glossy pinstriped titlebar, centred title |
| `frost.css` | pale frosted glass, heavy blur, round corners |
| `candy.css` | pastel gradient titlebar, very round, springy |
| `carbon.css` | flat industrial dark, square, blue focus rail |
| `brutalist.css` | 2px black frame, hard offset shadow, caps mono |
| `blueprint.css` | navy drafting grid, dashed snap preview |
| `amber.css` | amber CRT with scanlines and glow |
| `noir.css` | pure black and white hairlines |
| `forest.css` | dark olive with serif titles |
| `synth.css` | sunset gradient titlebar over deep purple |

Every one of them ships the same contract: 24px pointer targets on the window
controls, a `prefers-reduced-motion` block that drops the transitions, and a
`forced-colors` block that swaps the controls for labelled glyphs.

## One window at a time

A theme dresses every window. When one window needs to look different, give it a
variant: the desktop mirrors it to `data-wm-variant` and your CSS overrides the
tokens from there.

```js
wm.open({ id: 'log', meta: { variant: 'ghost' } })
```

```css
[data-wm-window][data-wm-variant="ghost"] {
  --wm-shadow: none;
  opacity: 0.88;
}
```

By default the variant is read from `meta.variant`. Pass `windowVariant` to
`attachDesktop` to derive it from anything else instead:

```js
attachDesktop(wm, root, {
  windowVariant: (win) => (win.layer === 'modal' ? 'sheet' : null),
})
```

## The attribute contract

### Written by you, read by the library

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-wm-drag` | any descendant | drag handle; double click toggles maximize; right click or long press fires `onTitlebarContextMenu` |
| `data-wm-title` | any descendant | title node, linked as `aria-labelledby` |
| `data-wm-content` | any descendant | scrollable content area (styling only) |
| `data-wm-controls` | any descendant | control group (styling only) |
| `data-wm-close` | button | closes when `closable` |
| `data-wm-minimize` | button | minimizes when `minimizable` |
| `data-wm-maximize` | button | toggles maximize when `maximizable` |

Controls work through delegation, so they can be nested anywhere inside the window.

### Written by the library, read by your CSS

| Attribute | On | Values |
| --- | --- | --- |
| `data-wm-desktop` | desktop element | present |
| `data-wm-window` | window element | the window id |
| `data-wm-stage` | window | `normal`, `minimized`, `maximized`, `snapped` |
| `data-wm-layer` | window | `normal`, `floating`, `modal` |
| `data-wm-workspace` | window | workspace index |
| `data-wm-focused` | window | present on the focused window |
| `data-wm-dragging` | window | present during a drag |
| `data-wm-resizing` | window | the direction: `n`, `se`, … |
| `data-wm-pinching` | window | present while two fingers are resizing it |
| `data-wm-variant` | window | the variant name, when the window has one |
| `data-wm-flash` | window | present for one animation after a blocked modal interaction |
| `data-wm-resize` | injected handles | the direction |
| `data-wm-snap-preview` | injected preview | present |
| `data-wm-announcer` | injected live region | present |
| `hidden` | window | minimized, or on another workspace |

Geometry is inline `transform: translate3d()`, `width`, `height` and `z-index`. Never fight it with `left`/`top` in CSS — position through the manager instead.

## CSS variables

`glass.css` and `light.css` expose the same set on `[data-wm-desktop]`:

| Variable | Used for |
| --- | --- |
| `--wm-radius` | window and titlebar corner radius |
| `--wm-bg`, `--wm-bg-focused` | window background |
| `--wm-border`, `--wm-border-focused` | window border |
| `--wm-shadow`, `--wm-shadow-focused` | window shadow |
| `--wm-titlebar-bg` | titlebar fill |
| `--wm-text`, `--wm-text-dim` | content and secondary text |
| `--wm-accent` | focus rings and the snap preview |
| `--wm-blur` | backdrop blur radius |
| `--wm-transition` | move and resize easing |

`retro.css` is a different visual system and exposes `--wm-face`, `--wm-face-light`, `--wm-face-dark`, `--wm-face-darker`, `--wm-title-active-a`, `--wm-title-active-b`, `--wm-title-inactive`, `--wm-title-text`, plus the shared `--wm-text`, `--wm-text-dim` and `--wm-accent`.

Retuning a shipped theme is a scoped override:

```css
[data-wm-desktop] {
  --wm-radius: 3px;
  --wm-accent: #d3ff4e;
  --wm-bg: rgba(12, 15, 19, 0.7);
  --wm-blur: 18px;
}
```

## Switching themes at runtime

Theme files all target `[data-wm-desktop]`, so importing two at once means the last one wins. To switch live, load them as URLs and swap a `<link>`:

```js
import glassUrl from '@surdeddd/wmkit/themes/glass.css?url'
import lightUrl from '@surdeddd/wmkit/themes/light.css?url'
import retroUrl from '@surdeddd/wmkit/themes/retro.css?url'

const link = document.createElement('link')
link.rel = 'stylesheet'
document.head.append(link)

export function setTheme(name) {
  link.href = { glass: glassUrl, light: lightUrl, retro: retroUrl }[name]
  desktopEl.dataset.theme = name
}
```

The `data-theme` attribute lets you scope your own overrides to one theme without leaking into the others — that is exactly how the demo does it.

## Writing a theme from scratch

A minimal but complete theme is about thirty lines. The only structural requirements are that the window is a block box with an explicit height, and that a minimized window stops taking space.

```css
[data-wm-desktop] {
  position: relative;
  overflow: hidden;
}

[data-wm-window] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #14161c;
  color: #e7eaf0;
  border: 1px solid #2a2f3a;
  transition:
    transform 240ms cubic-bezier(0.32, 0.72, 0, 1),
    width 240ms cubic-bezier(0.32, 0.72, 0, 1),
    height 240ms cubic-bezier(0.32, 0.72, 0, 1);
}

[data-wm-window][hidden] {
  display: none;                 /* [hidden] loses to display:flex — restate it */
}

[data-wm-window][data-wm-focused] {
  border-color: #5b6472;
}

[data-wm-window][data-wm-dragging],
[data-wm-window][data-wm-resizing] {
  transition: none;              /* never animate against the pointer */
  user-select: none;
}

[data-wm-window] [data-wm-drag] {
  flex-shrink: 0;
  cursor: default;
  user-select: none;
}

[data-wm-window] [data-wm-content] {
  flex: 1;
  overflow: auto;
}

[data-wm-snap-preview] {
  background: rgba(211, 255, 78, 0.18);
  border: 1.5px solid rgba(211, 255, 78, 0.55);
}

@media (prefers-reduced-motion: reduce) {
  [data-wm-window],
  [data-wm-snap-preview] {
    transition: none;
    animation: none;
  }
}
```

Four rules are easy to get wrong:

1. **`[hidden]` needs `display: none` restated.** `display: flex` beats the UA `[hidden]` rule, so a minimized window would stay visible.
2. **Kill transitions while dragging.** A transition on `transform` during a drag makes the window lag behind the cursor.
3. **Do not put `overflow: hidden` on the window itself** unless you also want to clip the resize handles, which sit slightly outside the border box.
4. **Never write a bare `section { }` rule** in the surrounding page. If your windows are `<section>` elements it will hit them; this exact bug shipped once already.

## Resize handles

`createResizeHandles` injects eight absolutely positioned divs with `data-wm-resize`. They are transparent, sized by `hitAreas`, and carry the correct `cursor`. Style them only if you want visible grips:

```css
[data-wm-resize] { background: transparent; }
[data-wm-window][data-wm-focused] [data-wm-resize='se'] {
  background: linear-gradient(135deg, transparent 50%, #5b6472 50%);
}
```

They are hidden automatically when the window is not resizable, and when its stage is neither `normal` nor `snapped`.

## Motion and accessibility

Every shipped theme drops its animations under `prefers-reduced-motion: reduce`, and `flipToTarget`/`flipFromTarget` opt out at the JS level as well. The whole minimize animation can also be turned off or retimed from the controller with `animation: false` or `animation: { duration, easing }`. Keep focus visible — the library gives the window `tabindex="-1"` and focuses it, so a `:focus-visible` outline on `[data-wm-window]` is worth having. Check contrast for `--wm-text-dim` if you retune it: it is used for the inactive titlebar text, which still has to be readable.

### Pointer targets

The window controls are small on purpose, so every theme grows their hit area with a transparent pseudo-element instead of growing the dot itself. Each control ends up at least 24×24 CSS pixels and neighbouring targets never overlap, which is what WCAG 2.5.8 asks for. If you restyle the controls, keep both halves of that deal: shrink the dot as much as you like, but re-check the pseudo-element inset and the `gap` on `[data-wm-controls]` so the targets stay 24px apart.

### Windows high contrast

Under `forced-colors: active` the platform throws away your colours, which would otherwise leave the three traffic lights as three identical circles. Every shipped theme redraws them in that mode as bordered buttons carrying `✕`, `–` and `□`, repaints the frame with `Canvas`/`CanvasText`, marks the focused window with `Highlight`, and turns the snap preview into a solid `Highlight` outline. A custom theme should do the same — colour alone is never enough to tell the controls apart.
