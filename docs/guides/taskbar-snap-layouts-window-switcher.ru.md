---
title: Панель задач, раскладки и Alt+Tab для веб-десктопа
description: Как превратить плавающие окна в рабочий стол на wmkit — панель задач, меню раскладок как в Windows 11, соседи с общим ресайзом, переключатель окон с обзором, вопрос перед закрытием и один рабочий стол во всех вкладках.
---

# Панель задач, раскладки и Alt+Tab

Окна, которые таскаются и меняют размер, — это первая десятая часть рабочего стола. Остальное — то, к чему тянутся не думая: панель задач, чтобы найти окно, меню, которое ставит его на треть экрана, Alt+Tab, вопрос перед тем, как пропадёт несохранённая работа. Каждая из этих вещей — небольшой плагин над одним менеджером, и каждую можно взять отдельно.

## Всё сразу

```js
import { attachDesktop, createWindowManager } from '@surdeddd/wmkit'
import { createLayoutPicker, linkSnapped } from '@surdeddd/wmkit/layouts'
import { createSwitcher } from '@surdeddd/wmkit/switcher'
import { sync } from '@surdeddd/wmkit/sync'
import { createTaskbar } from '@surdeddd/wmkit/taskbar'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const taskbar = createTaskbar(wm, document.querySelector('#taskbar'))
const desktop = attachDesktop(wm, document.querySelector('#desktop'), {
  minimizeTarget: (win) => taskbar.targetOf(win),
  grid: 16,
})

createLayoutPicker(desktop)
linkSnapped(desktop)
const switcher = createSwitcher(desktop)
sync(wm, { channel: 'my-desktop' })

document.querySelector('#overview').addEventListener('click', () => switcher.overview())
```

## Панель задач

`createTaskbar` заполняет ваш элемент кнопками: по одной на окно в порядке открытия и по одной на группу вкладок. Клик фокусирует окно, восстанавливает свёрнутое и сворачивает то, что уже в фокусе; клик средней кнопкой просит окно закрыться. Панель — одна остановка Tab, по кнопкам ходят стрелки. `minimizeTarget` заставляет сворачиваемое окно улетать в свою кнопку.

Плагин приносит поведение и доступность, а внешнего вида не приносит. Для вашего CSS у кнопок есть атрибуты:

```css
#taskbar { display: flex; gap: 6px; }
#taskbar [data-wm-task] { padding: 6px 12px; border-radius: 8px; }
#taskbar [data-wm-task][data-wm-focused] { background: rgb(255 255 255 / 0.16); }
#taskbar [data-wm-task][data-wm-stage='minimized'] { opacity: 0.6; }
```

## Раскладки

`createLayoutPicker` открывает меню раскладок, когда мышь задерживается на кнопке разворачивания, из контекстного меню этой кнопки, по долгому нажатию и по `Ctrl/⌘ + Alt + L`. Выберите область — и окно встанет в неё: половины, широкая колонка с узкой, трети, четверти или ваши собственные раскладки.

`linkSnapped` ставит разделитель на границу, которую делят прилипшие соседи. Тащите его или сфокусируйте и нажимайте стрелки — окна по обе стороны меняют размер вместе, одним шагом отмены. `grid: 16` в опциях рабочего стола ставит свободные окна на шаг 16 px; с зажатым Alt сетка при перетаскивании отключается.

## Alt+Tab и обзор

Зажмите Alt и нажимайте обратный апостроф, чтобы идти по окнам от последнего использованного; отпустите — и окно переключится. `switcher.overview()` уменьшает все окна в сетку, чтобы выбрать одно указателем или стрелками. Обзор двигает элементы, а не состояние: менеджер и его история остаются как были.

## Вопрос перед закрытием окна

```js
import { createWindowManager } from '@surdeddd/wmkit'

const wm = createWindowManager()
wm.onBeforeClose((win) => (win.meta.unsaved ? window.confirm(`Discard changes in ${win.title}?`) : true))
```

Кнопка закрытия, панель задач и `wm.requestClose(id)` спрашивают охранников по очереди; первый, кто ответит `false`, оставляет окно открытым. Охранник может вернуть промис, так что вопросом может быть ваш собственный диалог.

## Один рабочий стол во всех вкладках

`sync(wm, { channel })` отправляет каждое изменение через `BroadcastChannel`. Вкладка, открытая позже, присоединяется к уже существующему рабочему столу, и везде побеждает более позднее изменение.

## Дальше

- [Справочник API](../api.ru.md) — опции каждого плагина с этой страницы
- [Закрепляемые панели как в IDE](./dockable-panels-ide-layout.ru.md) — панели с разделителями и вкладками рядом с плавающими окнами
- [Рецепты](../recipes.ru.md) — сохранение с миграциями, модальные диалоги
