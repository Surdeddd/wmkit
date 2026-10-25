---
title: Рабочий стол Windows 95 на React
description: Рабочий стол в духе Windows 95 на React с wmkit — перекрывающиеся окна, таскбар со свёрнутыми программами, меню «Пуск» и тема retro, всё доступно с клавиатуры.
---

# Рабочий стол Windows 95 на React

Ретро-рабочий стол — классика портфолио и пет-проектов. Нужны окна, которые перекрываются, поднимаются по клику, сворачиваются в таскбар и разворачиваются двойным кликом, и меню «Пуск», которое открывает программы. Поведение окон даёт wmkit, серые фаски — тема `retro`, а содержимое остаётся за React.

<ClientOnly>
  <RetroDesktopDemo />
</ClientOnly>

## Из чего состоит

```text
<Desktop>             область, где живут окна — useDesktop
  <Window> × n        по одному на открытую программу — useWmWindowRef
  <Taskbar>           кнопка «Пуск» и кнопка на каждое окно — useWmState
</Desktop>
```

## Окна из списка программ

```tsx
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import '@surdeddd/wmkit/themes/retro.css'

const programs = {
  notepad: { title: 'Блокнот', width: 360, height: 260, body: () => <textarea /> },
  paint: { title: 'Paint', width: 420, height: 320, body: () => <canvas width={400} height={260} /> },
  about: { title: 'О системе', width: 300, height: 180, body: () => <p>Сделано на wmkit.</p> },
}

function Window({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id)
  const program = programs[win.meta.program]
  return (
    <section ref={ref}>
      <header data-wm-drag>
        <span data-wm-title>{win.title}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Свернуть" />
          <button data-wm-maximize aria-label="Развернуть" />
          <button data-wm-close aria-label="Закрыть" />
        </span>
      </header>
      <div data-wm-content>{program.body()}</div>
    </section>
  )
}
```

`meta` принадлежит вам: оно хранится вместе с окном, переживает отмену и `persist`, а здесь запоминает, какую программу окно запускает.

## Таскбар

```tsx
function Taskbar({ wm, onStart }) {
  const state = useWmState(wm)
  const windows = Object.values(state.windows).sort((a, b) => a.openedSeq - b.openedSeq)
  return (
    <nav className="taskbar" aria-label="Панель задач">
      <button className="start" onClick={onStart}>Пуск</button>
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

`openedSeq` держит кнопки в порядке запуска, как бы ни лежали окна в стопке. Клик по программе в фокусе сворачивает её, клик по любой другой возвращает — как в оригинальном таскбаре. `focus()` сам разворачивает свёрнутое окно.

## Рабочий стол и меню «Пуск»

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

`minimizeTarget` направляет анимацию сворачивания в кнопку окна на таскбаре: окно сжимается в свою кнопку и вырастает из неё обратно.

## Детали, от которых всё ощущается правильно

- Двойной клик по заголовку разворачивает и возвращает окно, стрелки двигают окно в фокусе.
- `wm.arrange('cascade')` и `wm.arrange('tile')` работают как старые пункты «Каскадом» и «Рядом».
- Рабочие пространства (`wm.setWorkspace(1)`) дают виртуальные рабочие столы, когда одного экрана окон мало.
- `persist(wm, { key: 'win95' })` возвращает после перезагрузки каждое окно туда, где его оставили.

## Дальше

- [Перетаскиваемое окно с ресайзом на React](./react-draggable-resizable-window.ru.md) — основы на одном окне
- [Рецепты](../recipes.ru.md) — таскбары, модальные окна, рабочие пространства и тесты
- [Темы](../theming.ru.md) — шестнадцать тем, `retro` среди них
