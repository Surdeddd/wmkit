# wmkit dashboard template

[Русская версия](./README.ru.md)

An operations dashboard built on [wmkit](https://github.com/Surdeddd/wmkit): four panels — key figures, a live revenue chart, an orders table and an event log — tiled with the dock plugin. Drag a panel by its title to dock it somewhere else, or drop it in the middle of another panel to stack the two as tabs. Hold Shift while dragging, or turn on **Float** in the toolbar (the way to do it on a touch screen), to leave the panel floating. Drag the separators to resize. **Reset layout** reopens closed panels and puts every panel back in its place as one undo step. The layout is saved in `localStorage` and comes back on reload.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/Surdeddd/wmkit/tree/main/templates/dashboard)

## Start

```bash
npx degit Surdeddd/wmkit/templates/dashboard my-dashboard
cd my-dashboard
npm install
npm run dev
```

The template needs `@surdeddd/wmkit` 0.13 or later.

## What it shows

- `<wm-desktop>` and `<wm-window>` from `@surdeddd/wmkit/elements`: the panels are plain HTML, there is no framework. Panels stacked as tabs get a tab strip; Ctrl/⌘ + Alt + PageUp/PageDown switch tabs from the keyboard. A closed panel stays closed after a reload until "Reset layout" brings it back.
- `createDock()` from `@surdeddd/wmkit/dock`: a default layout, tear-out, re-docking, tabs, separators with keyboard support, and the `float` option wired to the Float toggle.
- `persist="wmkit-dashboard"` on the desktop: windows and the dock layout survive a reload, and the panels are in place from the first frame even when the window size changed.
- Four themes imported one by one from `@surdeddd/wmkit/themes`: `glassTheme` styles the page and `glassShadowTheme`, given to `desktop.styles`, styles the title bar and content inside each panel's shadow root (so retro gets its blue title bar and sunken content). Only these four end up in the bundle.
- An English and a Russian interface, picked from `navigator.language`, with a toggle.
- A line chart in plain SVG, without a chart library.

## Where to change things

| File | What lives there |
| --- | --- |
| `index.html` | the four panels and the toolbar |
| `src/main.ts` | the default layout, theme switch, Float toggle, language toggle, the update loop |
| `src/panels.ts` | rendering of the tiles, chart, table and log |
| `src/i18n.ts` | every string, in English and Russian |
| `src/style.css` | the page and panel styles; the theme already pads the panel content |
