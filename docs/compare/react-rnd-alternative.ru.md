---
title: react-rnd или wmkit
description: Ищете альтернативу react-rnd? Когда хватает одного перетаскиваемого блока с ресайзом, react-rnd легче, а когда экран делят несколько окон, wmkit добавляет порядок наложения, фокус, снэп, клавиатуру и сохранение.
---

# react-rnd или wmkit

react-rnd — компонент React, который делает один элемент перетаскиваемым и изменяемым в размере, и именно это он делает хорошо. wmkit — оконный менеджер. Если на экране один подвижный блок, дальше можно не читать: react-rnd меньше и проще. Как только появляется второй блок, вопросы меняются — какой из них сверху, куда уходит фокус, что происходит у края экрана, — и на эти вопросы отвечает оконный менеджер.

Сведения о react-rnd на этой странице сверены с его репозиторием в ноябре 2026 года.

## Бок о бок

| | react-rnd | wmkit |
| --- | --- | --- |
| Что это | один перетаскиваемый компонент с ресайзом | оконный менеджер с точкой входа для React |
| Перетаскивание и ресайз, минимальный и максимальный размер, пропорции | да | да |
| Границы | родитель, окно браузера, селектор | рабочий стол, с полоской, до которой всегда можно дотянуться |
| Какое окно сверху | ваш `zIndex` в `style` | управляется: нажатие поднимает, есть слои normal, floating и modal |
| Фокус, модальные диалоги | пишете сами | фокус идёт за окном, модальное окно удерживает его |
| Свернуть, развернуть, восстановить | пишете сами | встроено |
| Снэп | к сетке | к сетке, к половинам, четвертям и третям с предпросмотром, к соседям |
| Клавиатура | — | перемещение, ресайз, снэп, обход окон |
| Скринридеры | — | одна live-область, которая говорит, что произошло |
| Undo, сохранение | пишете сами | `wm.undo()`, `persist()` |
| Кроме React | — | Vue, Svelte, Solid, Angular, Preact, Lit, Qwik, веб-компоненты, без фреймворка |

## Берите react-rnd, когда

- блок один или их несколько, но они не перекрываются и им не нужны правила фокуса: боковая панель с ресайзом, рамка кадрирования, объекты на холсте;
- положение и размер живут в вашем состоянии React, и от библиотеки больше ничего не нужно.

## Берите wmkit, когда

- окна перекрываются и пользователь переходит между ними;
- им нужны тайтлбары с закрытием, сворачиванием и разворачиванием, панель задач, снэп бок о бок;
- раскладка должна пережить перезагрузку, а перетаскивание — быть одним шагом отмены;
- с клавиатуры и со скринридером должно получаться всё то же, что и мышью.

## То же окно на wmkit

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
        <button data-wm-close aria-label="Close" />
      </header>
      <div data-wm-content>Your content.</div>
    </section>
  )
}

export function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button onClick={() => wm.open({ title: 'Notes', width: 360, height: 240 })}>New window</button>
      {Object.values(state.windows).map((win) => (
        <Window key={win.id} binder={binder} win={win} />
      ))}
    </div>
  )
}
```

Разметка ваша, как и с react-rnd. Разница в том, чего вы больше не пишете: порядок наложения, фокус, снэп, клавиатуру и историю.

## Дальше

- [Перетаскиваемое окно с ресайзом в React](../guides/react-draggable-resizable-window.ru.md) — полное руководство
- [Панель задач, раскладки и Alt+Tab](../guides/taskbar-snap-layouts-window-switcher.ru.md)
- [Адаптеры](../adapters.ru.md#react) — каждый хук и его контракт
