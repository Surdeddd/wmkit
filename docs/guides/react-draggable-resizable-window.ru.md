---
title: Перетаскиваемое окно с ресайзом на React
description: Перетаскиваемое окно с изменением размера на React с wmkit — снэп к краям, управление с клавиатуры, фокус и z-порядок, минимальные размеры и сохранение раскладки, около тридцати строк своей разметки.
---

# Перетаскиваемое окно с ресайзом на React

Окно, которое тащится за заголовок и растягивается за любой край, выглядит как вечер с обработчиками `mousemove`. Вечер превращается в неделю, как только всплывают детали. Окно должно подниматься наверх по клику, упираться в минимальный размер, не уезжать за экран и переживать касания. Потом оно должно прилипать к половине экрана, слушаться клавиатуры и помнить, где стояло. wmkit берёт всё это на себя, а разметку оставляет вам.

<ClientOnly>
  <ReactWindowDemo />
</ClientOnly>

Тащите за заголовок, тяните за любой край или угол, бросьте окно к левому или правому краю области — оно прилипнет к половине. Двойной клик по заголовку разворачивает окно. Стрелки двигают окно в фокусе.

## Установка

```bash
npm i @surdeddd/wmkit
```

Поддерживаются React 18 и 19. У адаптера нет собственных зависимостей.

## Компонент целиком

```tsx
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import type { DesktopBinder, WindowState } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

function Window({ binder, win }: { binder: DesktopBinder; win: WindowState }) {
  const ref = useWmWindowRef(binder, win.id)
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
      <div data-wm-content>Здесь всё, что рисует React.</div>
    </section>
  )
}

export function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)

  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button onClick={() => wm.open({ title: 'Заметки', width: 360, height: 240, minWidth: 220 })}>
        Новое окно
      </button>
      {Object.values(state.windows).map((win) => (
        <Window key={win.id} binder={binder} win={win} />
      ))}
    </div>
  )
}
```

`data-wm-drag` отмечает ручку перетаскивания, в `data-wm-title` попадает заголовок, три кнопки работают по одному атрибуту. Ручки ресайза со всех восьми сторон добавляются сами. Перебирайте `state.windows`, а не `state.order`: `order` — это порядок стопки, он меняется на каждый клик, а перестановка DOM-узлов посреди клика клик теряет.

## Что достаётся без единой строки

- **Перетаскивание и ресайз** с захватом указателя и одной записью стилей на кадр, так что указатель не теряется ни над iframe, ни за пределами окна.
- **Ограничения**: `minWidth`, `minHeight`, `maxWidth`, `maxHeight` и `aspectRatio` соблюдаются при любом движении, включая ресайз с клавиатуры и снэп.
- **Фокус и стопка**: нажатие поднимает окно, фокус переходит в него, `Tab` не выходит из модального окна, `F6` перебирает окна.
- **Снэп** к половинам, четвертям и третям с живым превью; если потянуть прилипшее окно, оно отрывается прямо под курсором.
- **Клавиатура**: стрелки двигают, Shift+стрелки меняют размер, Ctrl/⌘+Alt+стрелки прилепляют к краю, Ctrl/⌘+Z отменяет последнее действие.
- **Скринридеры** слышат, что произошло («Notes maximized», «Notes snapped to left»), через одну live-область, и все фразы можно заменить своими.
- **Отмена и повтор**: всё перетаскивание — один шаг истории.

## Читать и менять положение

Состояние окна — обычные данные. Читайте его хуком, меняйте через менеджер:

```tsx
import { useWmWindow } from '@surdeddd/wmkit/react'

function Position({ wm }) {
  const notes = useWmWindow(wm, 'notes')
  if (!notes) return null
  return (
    <p>
      {Math.round(notes.bounds.x)}, {Math.round(notes.bounds.y)}
      <button onClick={() => wm.move('notes', 0, 0)}>в левый верхний угол</button>
      <button onClick={() => wm.snap('notes', 'right')}>правая половина</button>
    </p>
  )
}
```

`useWmWindow` перерисовывает компонент, только когда меняется именно это окно, поэтому панель с координатами не тянет за собой перерисовку всей страницы во время перетаскивания.

## Запомнить раскладку

```ts
import { persist } from '@surdeddd/wmkit/persist'

persist(wm, { key: 'my-app-windows' })
```

Положение, размеры, состояния и порядок стопки сохраняются в `localStorage` и возвращаются при следующем визите.

## Next.js и серверный рендер

Менеджер — это данные, он работает и на сервере. DOM-часть подключается в эффекте, поэтому в App Router компонент с рабочим столом помечается `'use client'`. Больше ничего менять не нужно.

## Чем это отличается от react-rnd и react-draggable

`react-draggable` двигает элемент, `react-rnd` добавляет ему ручки ресайза, и обе делают ровно это и делают хорошо. Стопка, фокус, снэп, сворачивание и разворачивание, доступ с клавиатуры и сохранение остаются на вас, а когда окон на экране несколько, основная работа как раз в этом. wmkit — оконный менеджер, и движение в нём — самая маленькая часть. Если нужна одна коробка, которая двигается, react-draggable легче. Если вы делаете окна, начинайте отсюда.

## Дальше

- [Адаптеры](../adapters.ru.md) — все хуки React и их контракты
- [Темы](../theming.ru.md) — шестнадцать тем или собственные стили по атрибутам `data-wm-*`
- [Рабочий стол Windows 95 на React](./windows-95-desktop-react.ru.md) — таскбар, кнопка «Пуск» и тема retro
