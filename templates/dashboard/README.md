# wmkit dashboard template

[Русская версия](./README.ru.md)

An operations dashboard built on [wmkit](https://github.com/Surdeddd/wmkit): four panels — key figures, a live revenue chart, an orders table and an event log — tiled with the dock plugin. Drag a panel by its title to dock it somewhere else, hold Shift while dragging to let it float, and drag the separators to resize. The layout is saved in `localStorage` and comes back on reload.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/Surdeddd/wmkit/tree/main/templates/dashboard)

## Start

```bash
npx degit Surdeddd/wmkit/templates/dashboard my-dashboard
cd my-dashboard
npm install
npm run dev
```

## What it shows

- `<wm-desktop>` and `<wm-window>` from `@surdeddd/wmkit/elements`: the panels are plain HTML, there is no framework.
- `createDock()` from `@surdeddd/wmkit/dock`: a default layout, tear-out, re-docking, separators with keyboard support, and "Reset layout".
- `persist="wmkit-dashboard"` on the desktop: windows and the dock layout survive a reload.
- Theme switching through `themeStyle()` from `@surdeddd/wmkit/themes`.
- An English and a Russian interface, picked from `navigator.language`, with a toggle.
- A line chart in plain SVG, without a chart library.

## Where to change things

| File | What lives there |
| --- | --- |
| `index.html` | the four panels and the toolbar |
| `src/main.ts` | the default layout, theme switch, language toggle, the update loop |
| `src/panels.ts` | rendering of the tiles, chart, table and log |
| `src/i18n.ts` | every string, in English and Russian |
| `src/style.css` | the page and panel styles |
