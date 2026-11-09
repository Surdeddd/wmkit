---
description: Переезд приложения с WinBox.js на wmkit заменой одного импорта — что чему соответствует, что ведёт себя иначе и что добавляет менеджер wmkit.
---

# Переезд с WinBox

`@surdeddd/wmkit/winbox` говорит на API WinBox.js 0.2, поэтому приложение переезжает заменой одного импорта. Внутри работает менеджер wmkit, а с ним приходят прилипание к краям, управление с клавиатуры, анонсы для скринридеров, отмена действий и сохранение раскладки.

## Три шага

1. Установить: `npm i @surdeddd/wmkit`.
2. Заменить импорт:
   ```js
   // было
   import WinBox from 'winbox/src/js/winbox.js'
   import 'winbox/dist/css/winbox.min.css'
   // стало
   import WinBox from '@surdeddd/wmkit/winbox'
   ```
3. Удалить импорт стилей WinBox. Похожий на WinBox вид подключается сам один раз (`<style data-wmkit-winbox>`); чтобы принести свои стили, вызовите `WinBox.configure({ styles: false })` до первого окна.

Все способы открыть окно работают как раньше: `new WinBox(title, options)`, `new WinBox(options)`, `WinBox.new(...)` и `WinBox(...)` без `new`.

В CommonJS `require('@surdeddd/wmkit/winbox')` возвращает сам конструктор, как и собственная сборка WinBox; `.default`, `.WinBox`, `.winboxMessages` и `.winboxMessagesRu` висят на нём. Типы для CommonJS используют `export =`, поэтому в TypeScript проходит проверку `import WinBox = require('@surdeddd/wmkit/winbox')`.

## Что чему соответствует

| WinBox | wmkit |
| --- | --- |
| `id`, `title`, `width`, `height`, `x`, `y` (`px`, `%`, `"center"`, `"right"`, `"bottom"`) | то же, считается внутри области окон |
| `minwidth`, `minheight`, `maxwidth`, `maxheight` | `minSize` / `maxSize` окна |
| `modal` | `layer: 'modal'` и затемнение; нижние окна не принимают ввод |
| `max`, `min`, `hidden` | окно сразу развёрнуто, свёрнуто или скрыто |
| `mount`, `html`, `url` | узел переносится внутрь (и обратно при закрытии), `innerHTML`, `iframe` |
| `top`, `right`, `bottom`, `left` | область, в которой живут окна; прилипание и разворот её учитывают |
| `overflow` | окнам можно выходить за область |
| `background`, `border`, `icon`, `class` | то же; классы управления `no-min`, `no-max`, `no-full`, `no-close`, `no-resize`, `no-move`, `no-header`, `no-shadow`, `no-animation` |
| `autosize` | размер по содержимому, когда оно уже внутри |
| `oncreate`, `onclose(force)` (истинный результат отменяет закрытие), `onfocus`, `onblur`, `onmove(x, y)`, `onresize(w, h)`, `onminimize`, `onmaximize`, `onrestore`, `onfullscreen`, `onhide`, `onshow` | то же, `this` — экземпляр окна |
| `mount`, `unmount`, `setUrl`, `setTitle`, `setIcon`, `setBackground`, `move`, `resize`, `close(force)`, `focus`, `blur`, `hide`, `show`, `minimize`, `maximize`, `fullscreen`, `restore`, `addClass`, `removeClass`, `hasClass`, `toggleClass`, `addControl`, `removeControl` | то же, вызовы можно выстраивать цепочкой |
| `x`, `y`, `width`, `height`, `minwidth` … (на запись), `min`, `max`, `full`, `hidden`, `focused` | то же |
| `WinBox.stack()` | открытые окна в порядке фокуса, текущее последним |

Разметка сохраняет имена классов WinBox — `.winbox` с классами состояния `focus`, `min`, `max`, `full`, `hide` и `modal`, `.wb-header`, `.wb-control` (`.wb-min`, `.wb-max`, `.wb-full`, `.wb-close`), `.wb-drag`, `.wb-icon`, `.wb-title`, `.wb-body`, — поэтому CSS, написанный под WinBox, продолжает работать.

Классы состояния и колбэки следуют за менеджером, а не за вызовом, который вызвал изменение, поэтому остаются верными после отмены, повтора, восстановления раскладки и изменения вьюпорта. `onresize` и `onmove` срабатывают и тогда, когда геометрию меняет разворот, восстановление или прилипание, в том же порядке, что и в WinBox: сначала размер, потом положение, потом колбэк стадии.

## Чем отличается

- **Прилипание и клавиатура включены.** Окно, доведённое до края, прилипает к нему; стрелки двигают окно в фокусе. Выключается через `WinBox.configure({ snap: false, keyboard: false })`. Группировка окон во вкладки по умолчанию выключена и включается `grouping: true`.
- **Кнопки управления работают с клавиатуры.** Они получают фокус и откликаются на Enter и Space, в том числе добавленные через `addControl`. Скрытое окно выпадает из обхода фокуса, и F6 его пропускает.
- **Закрытие окончательно.** Закрытое окно не возвращается ни отменой, ни повтором, ни восстановлением раскладки; откройте вместо него новое.
- **Последнее окно забирает с собой рабочий стол.** Когда закрывается последнее окно рабочего стола, удаляются сам стол, его контроллер и их слушатели на странице, а следующий `new WinBox()` создаёт новый. Рабочий стол, чей менеджер вы взяли через `WinBox.manager()`, остаётся, поэтому `persist(WinBox.manager(), …)` продолжает работать.
- **Свёрнутые окна** ждут в полоске кнопок с заголовками у нижнего края; клик возвращает окно.
- **`top`/`right`/`bottom`/`left` принадлежат рабочему столу, а не окну.** Окна с одинаковым набором отступов живут на одном столе, другой набор получает свой. Координаты отсчитываются внутри этой области.
- **`index`** не используется: порядком наложения управляет менеджер.
- **`html`** пишет `innerHTML`, как и в WinBox. На страницах с Trusted Types или строгим CSP передавайте `mount`.
- **Размер.** Совместимый модуль весит около 19 кБ в brotli вместе с менеджером; `winbox.bundle.min.js` 0.2.82 — 5.4 кБ. Разница платит за прилипание, undo, сохранение, клавиатуру, управление фокусом и слой для скринридеров; если ничего из этого не нужно, WinBox остаётся более лёгким вариантом.

## Дальше

`WinBox.manager(root?)` отдаёт сам `WindowManager`, так что остальной wmkit — в одном вызове:

```js
import WinBox from '@surdeddd/wmkit/winbox'
import { persist } from '@surdeddd/wmkit/persist'

persist(WinBox.manager(), { key: 'my-desktop' })
new WinBox('Заметки', { width: 400, height: 300 })
```
