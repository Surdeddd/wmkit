---
title: Оконный менеджер на веб-компонентах
description: Перетаскиваемые окна с ресайзом на чистом HTML через элементы wm-desktop и wm-window из wmkit — без фреймворка и без сборки, со снэпом, клавиатурой, темами и сохранённой раскладкой.
---

# Оконный менеджер на чистом HTML

Вся интеграция — два пользовательских элемента: `<wm-desktop>` — область, `<wm-window>` — окно в ней. Они работают на статической странице, в серверном шаблоне, внутри любого фреймворка и в нескольких сразу, потому что контракт — это HTML.

## Вся страница

```html
<script type="module">
  import '@surdeddd/wmkit/elements/define'
  import '@surdeddd/wmkit/themes/glass.css'
</script>

<wm-desktop persist="my-desktop" style="display: block; height: 100vh">
  <wm-window window-id="notes" label="Notes" x="20" y="20" width="320" height="220">
    <textarea>hello</textarea>
  </wm-window>
  <wm-window window-id="chart" label="Chart" x="360" y="40" width="320" height="220">
    <button slot="actions" type="button">↻</button>
    <p>chart</p>
  </wm-window>
  <wm-window window-id="later" label="Later" closed>
    <p>opens when the closed attribute goes away</p>
  </wm-window>
</wm-desktop>
```

Каждое окно перетаскивается за тайтлбар, меняет размер с восьми сторон, прилипает к половинам, четвертям и третям, сворачивается, разворачивается, закрывается и слушается клавиатуры. `persist="my-desktop"` сохраняет раскладку в `localStorage` и восстанавливает её при следующем визите. Дочерние элементы окна остаются в обычном DOM, поэтому ваши стили и скрипты достают до них как всегда.

## Атрибуты и есть API

| У `<wm-window>` | Смысл |
| --- | --- |
| `window-id` | постоянный id; нужен, чтобы раскладка пережила перезагрузку |
| `label` | заголовок |
| `x`, `y`, `width`, `height` | начальная геометрия |
| `stage` | `normal`, `minimized`, `maximized`; следует за окном, и его можно задавать |
| `closed` | окно закрыто, пока атрибут на месте |

Элементы шлют события `wm-open`, `wm-close`, `wm-move`, `wm-resize`, `wm-stage` и `wm-focus`, у каждого в `detail` лежит окно, а `wm-beforeclose` можно отменить, чтобы окно осталось открытым:

```html
<script type="module">
  document.querySelector('wm-desktop').addEventListener('wm-beforeclose', (event) => {
    if (event.detail.window.id === 'notes') event.preventDefault()
  })
</script>
```

## Менеджер никуда не делся

`desktop.manager` — тот же конечный автомат, что и у всех остальных точек входа, так что всё, чего не покрывают атрибуты, — в одном вызове:

```html
<button id="tile" type="button">Side by side</button>

<script type="module">
  const desktop = document.querySelector('wm-desktop')
  document.querySelector('#tile').addEventListener('click', () => {
    desktop.manager.snap('notes', 'left')
    desktop.manager.snap('chart', 'right')
  })
</script>
```

Менеджер существует с момента подключения элемента; для кода, который выполняется раньше, рабочий стол сообщает о нём событием `wm-ready` с `detail.manager`.

## Оформление рамки

Рамка окна живёт в теневом корне и отдаёт наружу части: `titlebar`, `title`, `control`, `content`, `tabs`, `tab`. Стилизуйте их через `::part()` или передайте рабочему столу целую тему:

```html
<script type="module">
  import { retroShadowTheme } from '@surdeddd/wmkit/themes'

  document.querySelector('wm-desktop').styles = retroShadowTheme
</script>
```

## Элемент панели задач

`<wm-taskbar for="desk">` из `@surdeddd/wmkit/taskbar/define` показывает окна рабочего стола с таким id в виде кнопок. Он приносит поведение и доступность, а внешний вид оставляет вашему CSS.

## Дальше

- [Адаптеры](../adapters.ru.md#web-components) — каждый атрибут, свойство, часть и событие
- [Темы](../theming.ru.md) — шестнадцать тем и токены, из которых они собраны
- [wmkit для ИИ-агентов](./ai-coding-agents.ru.md) — короткая версия для модели
