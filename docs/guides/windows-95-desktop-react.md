---
title: Windows 95 desktop in React
description: Recreate a Windows 95 desktop in React with wmkit — overlapping windows, a taskbar with minimized programs, a start menu and the retro theme, all keyboard accessible.
---

# A Windows 95 desktop in React

A retro desktop is a classic portfolio and side project. It needs windows that overlap, come to the front on click, minimize into a taskbar and maximize on a double click, and a start menu that opens programs. wmkit provides the window behaviour, the `retro` theme provides the grey bevels, and React keeps the content.

<ClientOnly>
  <RetroDesktopDemo />
</ClientOnly>

## The pieces

```text
<Desktop>             the area windows live in — useDesktop
  <Window> × n        one per open program — useWmWindowRef
  <Taskbar>           start button + a button per window — useWmState
</Desktop>
```

## Windows from a list of programs

```tsx
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import '@surdeddd/wmkit/themes/retro.css'

const programs = {
  notepad: { title: 'Notepad', width: 360, height: 260, body: () => <textarea /> },
  paint: { title: 'Paint', width: 420, height: 320, body: () => <canvas width={400} height={260} /> },
  about: { title: 'About', width: 300, height: 180, body: () => <p>Built with wmkit.</p> },
}

function Window({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id)
  const program = programs[win.meta.program]
  return (
    <section ref={ref}>
      <header data-wm-drag>
        <span data-wm-title>{win.title}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Minimize" />
          <button data-wm-maximize aria-label="Maximize" />
          <button data-wm-close aria-label="Close" />
        </span>
      </header>
      <div data-wm-content>{program.body()}</div>
    </section>
  )
}
```

`meta` is yours: it is stored with the window, survives undo and `persist`, and here it remembers which program a window runs.

## A taskbar

```tsx
function Taskbar({ wm, onStart }) {
  const state = useWmState(wm)
  const windows = Object.values(state.windows).sort((a, b) => a.openedSeq - b.openedSeq)
  return (
    <nav className="taskbar" aria-label="Taskbar">
      <button className="start" onClick={onStart}>Start</button>
      {windows.map((win) => (
        <button
          key={win.id}
          data-task={win.id}
          aria-pressed={state.focusedId === win.id}
          onClick={() =>
            state.focusedId === win.id && win.stage !== 'minimized'
              ? wm.minimize(win.id)
              : wm.focus(win.id)
          }
        >
          {win.title}
        </button>
      ))}
    </nav>
  )
}
```

`openedSeq` keeps the taskbar in launch order however the windows are stacked. Clicking the focused program minimizes it and clicking any other one brings it back, the way the original taskbar behaved. `focus()` restores a minimized window on its own.

## The desktop and a start menu

```tsx
import { useState } from 'react'

export function Win95() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm, {
    minimizeTarget: (win) => document.querySelector(`[data-task="${win.id}"]`),
  })
  const state = useWmState(wm)
  const [menu, setMenu] = useState(false)

  const launch = (program) => {
    const { body, ...init } = programs[program]
    wm.open({ ...init, meta: { program } })
    setMenu(false)
  }

  return (
    <div className="screen">
      <div ref={ref} className="desktop">
        {Object.values(state.windows).map((win) => (
          <Window key={win.id} binder={binder} win={win} />
        ))}
      </div>
      {menu && (
        <ul className="start-menu" role="menu">
          {Object.keys(programs).map((program) => (
            <li key={program}>
              <button role="menuitem" onClick={() => launch(program)}>
                {programs[program].title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Taskbar wm={wm} onStart={() => setMenu(!menu)} />
    </div>
  )
}
```

`minimizeTarget` points the minimize animation at the window's taskbar button, so a window shrinks into its button and grows back out of it.

## Details that make it feel right

- Double-clicking a titlebar toggles maximize, and the arrow keys move the focused window.
- `wm.arrange('cascade')` and `wm.arrange('tile')` behave like the old "Cascade windows" and "Tile windows" menu items.
- Workspaces (`wm.setWorkspace(1)`) give you virtual desktops when one screen of windows is not enough.
- `persist(wm, { key: 'win95' })` brings every window back after a reload, where it was left.

## Next

- [A draggable, resizable window in React](./react-draggable-resizable-window.md) — the basics on one window
- [Recipes](../recipes.md) — taskbars, modals, workspaces and testing
- [Theming](../theming.md) — the sixteen themes, `retro` among them
