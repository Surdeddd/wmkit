---
title: Закрепляемые панели как в IDE
description: Раскладка как в IDE прямо в браузере на wmkit — окна закрепляются в панелях с вкладками и перетаскиваемыми разделителями, открепляются и возвращаются, раскладка сохраняется в JSON и управляется с клавиатуры.
---

# Закрепляемые панели, раскладка как в IDE

Редактор в центре, файлы слева, терминал снизу, и любую панель можно оторвать, оставить плавать поверх остальных и бросить в другое место. Так устроены VS Code, торговый терминал, админка. В wmkit это один плагин поверх обычных окон: окно либо закреплено, либо плавает, и в обоих случаях это одно и то же окно.

## Закрепляем три окна

```js
import { attachDesktop, createWindowManager } from '@surdeddd/wmkit'
import { createDock } from '@surdeddd/wmkit/dock'
import '@surdeddd/wmkit/themes/carbon.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))
const dock = createDock(desktop)

for (const [id, title] of [['editor', 'main.ts'], ['files', 'Files'], ['terminal', 'Terminal']]) {
  wm.open({ id, title })
  const el = document.createElement('section')
  el.innerHTML = `<header data-wm-drag><span data-wm-title></span></header><div data-wm-content></div>`
  document.querySelector('#desktop').append(el)
  desktop.attachWindow(id, el)
}

dock.dock('editor')
dock.dock('files', { side: 'left' })
dock.dock('terminal', { side: 'bottom' })
```

`dock(id)` без цели заполняет область или добавляет вкладку в первую панель. `side` делит корень; вместе со `stackId` — делит эту панель, а `side: 'center'` добавляет в неё вкладку.

## Что может пользователь

- **Тащить тайтлбар** над панелью: у края панель делится, в центре окно становится вкладкой, вдоль края области оно закрепляется рядом со всем остальным. Предпросмотр показывает, куда оно встанет.
- **Оторвать панель** за тайтлбар — и она снова плавает, с тем размером, какой был до закрепления.
- **Тащить разделитель** либо сфокусировать его и нажимать стрелки; Home и End уводят к пределам. Одно перетаскивание — один шаг отмены.
- **Держать Shift** при перетаскивании, чтобы окно осталось плавать над панелями.
- **С клавиатуры**: `Ctrl/⌘ + Alt + Shift + стрелки` закрепляют окно в фокусе у стороны, `Ctrl/⌘ + Alt + Shift + Backspace` открепляет его.

Всё отменяется через `wm.undo()`, а скринридеры слышат, что произошло.

## Сохранение и восстановление раскладки

Раскладка — обычные данные: стопки окон и разделения с размерами.

```js
import { createDock } from '@surdeddd/wmkit/dock'
import { persist } from '@surdeddd/wmkit/persist'

export function workspace(wm, desktop) {
  const dock = createDock(desktop)
  persist(wm, { key: 'ide-layout' })
  return {
    save: () => JSON.stringify(dock.layout()),
    load: (text) => dock.setLayout(JSON.parse(text)),
  }
}
```

`persist` хранит весь рабочий стол вместе с доком между перезагрузками. `layout()` и `setLayout()` нужны для собственных пресетов: раскладка «отладка», раскладка «ревью», кнопка сброса. `setLayout` возвращает `false` для раскладки, которая называет неизвестное окно или нарушает инвариант, и ничего не меняет.

## Плавающие и закреплённые вместе

Доку принадлежит область, по умолчанию весь рабочий стол. Незакреплённые окна плавают над ней, а окна на слоях `floating` и `modal` перетаскиванием не закрепляются, так что палитра или диалог остаются окнами. Дайте доку область поменьше, чтобы оставить место тулбару или панели задач:

```js
import { createDock } from '@surdeddd/wmkit/dock'

export const dockBelowToolbar = (desktop) =>
  createDock(desktop, {
    area: ({ width, height }) => ({ x: 0, y: 40, width, height: height - 40 }),
  })
```

## Дальше

- [Справочник API](../api.ru.md) — `createDock`, типы раскладки и чистые операции над ней в `dockLayout`
- [Ищете альтернативу dockview?](../compare/dockview-alternative.ru.md) — когда подходит каждая из библиотек
- [Рецепты](../recipes.ru.md) — сохранение с миграциями, модальные диалоги, панель задач
