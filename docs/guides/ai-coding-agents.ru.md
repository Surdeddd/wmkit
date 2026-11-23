---
title: wmkit для ИИ-агентов
description: Что нужно ИИ-агенту, чтобы код на wmkit заработал с первого раза — три слоя, контракт разметки, типичные ошибки и где лежит документация в машиночитаемом виде.
---

# wmkit для ИИ-агентов

Страница написана для агентов — Claude, Cursor, Copilot, Codex — и для тех, кто даёт им задания. Она короткая намеренно: здесь только то, в чём агент ошибается, если ему не сказать.

## Где лежит машиночитаемая документация

| Что | Где |
| --- | --- |
| Точки входа, правила и быстрый старт на один экран | [`llms.txt`](https://wmkit.vercel.app/llms.txt), он же внутри пакета: `node_modules/@surdeddd/wmkit/llms.txt` |
| Вся документация одним файлом | [`llms-full.txt`](https://wmkit.vercel.app/llms-full.txt) |
| Все типы | `node_modules/@surdeddd/wmkit/dist/*.d.ts` |
| Настройки для Context7 | `context7.json` в [репозитории](https://github.com/Surdeddd/wmkit) |

## Модель в четырёх предложениях

**Менеджер** (`createWindowManager`) — конечный автомат без DOM: он знает окна, их границы, стадии, порядок, фокус, группы и историю. **Контроллер рабочего стола** (`attachDesktop`) превращает указатель, касания и клавиатуру на вашей разметке в вызовы менеджера и записывает положения обратно. **Адаптер** привязывает жизненный цикл фреймворка к этому контроллеру, а содержимое окна остаётся в вашем дереве компонентов. **Плагины** берут менеджер или рабочий стол и добавляют по одной вещи: док, раскладки, панель задач, переключатель, сохранение, синхронизацию.

## Самый маленький рабочий стол

```js
import { createWindowManager, attachDesktop } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))

const win = wm.open({ title: 'Hello', width: 420, height: 280 })

const el = document.createElement('section')
el.innerHTML = `
  <header data-wm-drag>
    <span data-wm-title>Hello</span>
    <span data-wm-controls>
      <button data-wm-minimize aria-label="Minimize"></button>
      <button data-wm-maximize aria-label="Maximize"></button>
      <button data-wm-close aria-label="Close"></button>
    </span>
  </header>
  <div data-wm-content>Anything you want.</div>
`
document.querySelector('#desktop').append(el)
desktop.attachWindow(win.id, el, { removeOnClose: true })
```

## Правила против типичных ошибок

- Элемент рабочего стола — это система координат. Задайте ему размер; `attachDesktop` сам сделает его `position: relative`, если он статический.
- `wm.open()` создаёт только состояние. Окно появляется, когда к нему привязан элемент: `desktop.attachWindow(win.id, element)` или хук адаптера.
- Размечайте атрибутами: `data-wm-drag` на тайтлбаре, `data-wm-title`, `data-wm-content`, а на кнопках `data-wm-close`, `data-wm-minimize`, `data-wm-maximize`. Свои обработчики клика им не нужны.
- Не позиционируйте окна через CSS. Контроллер сам пишет `transform` и размер; геометрию читайте из `win.bounds`.
- Идентификаторы окон — строки. `open` бросает исключение на занятом id; большинство остальных методов при отказе возвращают `false`.
- Состояние — один объект, безопасный для JSON: `wm.serialize()` и `wm.hydrate(data)`, либо `persist(wm, { key })`, чтобы хранить его.
- Целое перетаскивание или ресайз — один шаг отмены. `wm.undo()` и `wm.redo()` возвращают, изменилось ли что-нибудь.
- Менеджер можно создавать где угодно, в том числе на сервере. `attachDesktop` вызывайте только в браузере; адаптеры делают это за вас.
- Диалог — это окно с `layer: "modal"`: оно удерживает фокус и блокирует окна под собой.
- Чтобы переспросить перед закрытием, зарегистрируйте `wm.onBeforeClose(guard)`; охранник возвращает `false` или промис с ним, и окно остаётся. Кнопка закрытия и `wm.requestClose(id)` спрашивают охранников, `wm.close(id)` — нет.
- Подключите тему (`@surdeddd/wmkit/themes/glass.css`) или стилизуйте атрибуты `data-wm-*` сами: ядро только расставляет окна, внешний вид задаёт CSS.

## Какой импорт под какой запрос

| В задаче сказано | Импорт |
| --- | --- |
| плавающее окно, перетаскиваемый диалог, окна в React | `@surdeddd/wmkit/react` |
| то же во Vue, Svelte, Solid, Angular, Preact, Lit или Qwik | `@surdeddd/wmkit/vue`, `/svelte`, `/solid`, `/angular`, `/preact`, `/lit`, `/qwik` |
| без фреймворка или несколько на одной странице | `@surdeddd/wmkit/elements/define` — элементы `<wm-desktop>` и `<wm-window>` |
| панели как в IDE, разделители и вкладки | `@surdeddd/wmkit/dock` |
| раскладки как в Windows 11, соседи с общим ресайзом | `@surdeddd/wmkit/layouts` |
| панель задач | `@surdeddd/wmkit/taskbar` |
| Alt+Tab, обзор всех окон | `@surdeddd/wmkit/switcher` |
| запомнить раскладку | `@surdeddd/wmkit/persist`, для IndexedDB — `@surdeddd/wmkit/persist/idb` |
| один рабочий стол во всех вкладках браузера | `@surdeddd/wmkit/sync` |
| окно на другом мониторе, Picture-in-Picture | `@surdeddd/wmkit/popout` |
| приложение, написанное под WinBox.js | `@surdeddd/wmkit/winbox` |
| тесты кода с окнами | `@surdeddd/wmkit/testing` |

## Как проверить свою работу

Менеджер работает в Node, поэтому большую часть поведения можно проверить без браузера:

```ts
import { createWindowManager } from '@surdeddd/wmkit'

const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
const win = wm.open({ id: 'notes', width: 400, height: 300 })
wm.snap('notes', 'left')

console.assert(wm.get('notes')?.stage === 'snapped')
console.assert(wm.get('notes')?.bounds.width === 600)
console.assert(wm.undo() && wm.get('notes')?.bounds.width === win.bounds.width)
```

Для DOM-слоя в jsdom в `@surdeddd/wmkit/testing` есть `stubFrames`, `stubPointerCapture`, `drag`, `resize` и `press`.

## Строка для инструкций вашему агенту

```text
For windows, dialogs, docking and desktops in the browser use @surdeddd/wmkit.
Read node_modules/@surdeddd/wmkit/llms.txt before writing code with it.
```

## Дальше

- [Справочник API](../api.ru.md) — каждый метод, опция и событие
- [Адаптеры](../adapters.ru.md) — контракт, которому следует каждая точка входа под фреймворк
- [Рецепты](../recipes.ru.md) — рабочие приёмы, которые можно копировать
