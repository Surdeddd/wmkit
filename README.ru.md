# wmkit

**Headless оконный менеджер для веба.** Перетаскиваемые окна с ресайзом, снэпом, таскбаром, клавиатурной доступностью и персистом состояния — для vanilla JS и всех основных фреймворков.

[English version](./README.md) · [Живое демо](https://wmkit.vercel.app) · [Зеркало (Pages)](https://surdeddd.github.io/wmkit/) · [Документация](./docs/README.md) · [GitHub](https://github.com/Surdeddd/wmkit)

[![wmkit — живой демо-десктоп](https://raw.githubusercontent.com/Surdeddd/wmkit/main/.github/assets/hero.png)](https://surdeddd.github.io/wmkit/)

<p align="center"><em>Все окна выше настоящие — <a href="https://surdeddd.github.io/wmkit/">откройте демо</a> и потаскайте.</em></p>

- 🪟 **Полный жизненный цикл окна** — открытие, закрытие, фокус, сворачивание, разворачивание, восстановление, drag, ресайз в 8 направлениях
- 🧠 **Headless-ядро** — сериализуемая стейт-машина плюс DOM-контроллер; своя разметка или готовая стеклянная тема
- ⚛️ **Родные адаптеры** — `@surdeddd/wmkit/react`, `/vue`, `/svelte`, `/solid`, `/angular`, тонкий сахар над одним ядром
- 🗃️ **Вкладочные группы** — бросьте заголовок на заголовок, и окна начнут делить одну рамку; порядок вкладок можно менять
- ⊞ **Snap-зоны** — половины, четверти, трети и максимизация от верхнего края с живым превью
- 🧲 **Магнетизм** — края окна прилипают к соседям и вьюпорту при перетаскивании
- ↩️ **Undo/redo** — каждая мутация = один шаг; целый drag схлопывается в одну запись истории
- 🗂️ **Рабочие столы и layout'ы** — виртуальные столы, снапшоты, `cascade`/`tile` одним вызовом
- 🔒 **Фиксация пропорций** — окно с `aspectRatio` держит 16:9 или 4:3 при любом ресайзе
- ⌨️ **Доступность** — move/resize/snap с клавиатуры, цикл окон по F6, focus-trap в модалках, `aria-live`-анонсы
- ⚡ **Производительность** — позиционирование только через `transform`, rAF-батчинг ввода, structural sharing; 50 окон таскаются на 60fps
- 💾 **Персист** — один вызов сериализует рабочий стол, один — восстанавливает, с версионированием и миграциями
- 🎨 **Три темы** — тёмное стекло, светлое стекло и Win98-ретро, либо полностью свой CSS
- 🖼️ **Popout** *(experimental)* — вынос окна в Document Picture-in-Picture
- 📦 **Ноль зависимостей**, строгий TypeScript, ESM + CJS, ~10.7 kB brotli

## Установка

```bash
npm install @surdeddd/wmkit
# или
pnpm add @surdeddd/wmkit
```

## Быстрый старт (vanilla)

```js
import { createWindowManager, attachDesktop } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))

const win = wm.open({ title: 'Привет', width: 420, height: 280 })

const el = document.createElement('section')
el.innerHTML = `
  <header data-wm-drag>
    <span data-wm-title>Привет</span>
    <span data-wm-controls>
      <button data-wm-minimize aria-label="Свернуть"></button>
      <button data-wm-maximize aria-label="Развернуть"></button>
      <button data-wm-close aria-label="Закрыть"></button>
    </span>
  </header>
  <div data-wm-content>Что угодно.</div>
`
document.querySelector('#desktop').append(el)
desktop.attachWindow(win.id, el, { removeOnClose: true })
```

Элемент рабочего стола становится системой координат. Разметка остаётся вашей — wmkit вешает поведение на `data-wm-*` атрибуты:

| Атрибут | Смысл |
| --- | --- |
| `data-wm-drag` | ручка перетаскивания (обычно тайтлбар); двойной клик — toggle maximize |
| `data-wm-title` | узел заголовка, связывается через `aria-labelledby` |
| `data-wm-close` / `data-wm-minimize` / `data-wm-maximize` | кнопки управления, работают через делегирование |
| `data-wm-content` | скроллируемая область контента |

`removeOnClose` сам отвязывает контроллер и удаляет элемент при закрытии окна. На тач-устройствах хит-зоны ресайза и порог снэпа автоматически крупнее (`pointer: coarse`); настраиваются через `attachDesktop(wm, el, { hitAreas: { edge, corner } })`.

Контроллер добавляет ресайз-хендлы (`[data-wm-resize]`), превью снэпа (`[data-wm-snap-preview]`) и скрытый live-регион для скринридеров.

## Адаптеры

Каждый адаптер — тонкая обёртка над тем же ядром и тем же DOM-контроллером, около 60 строк. Они нужны только чтобы привязаться и отвязаться в нужный момент жизненного цикла компонента. Контент окна всегда живёт в дереве вашего фреймворка: никакого innerHTML, порталов и переноса узлов.

### React

```tsx
import { useWindowManager, useDesktop, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'

function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)

  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button type="button" onClick={() => wm.open({ title: 'Окно' })}>открыть</button>
      {state.order.map((id) => (
        <Win key={id} binder={binder} win={state.windows[id]} />
      ))}
    </div>
  )
}

function Win({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id, { removeOnClose: true })
  return (
    <section ref={ref}>
      <header data-wm-drag><span data-wm-title>{win.title}</span></header>
      <div data-wm-content>ваше дерево компонентов</div>
    </section>
  )
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useWindowManager, useDesktop, useWmWindowEl } from '@surdeddd/wmkit/vue'

const host = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const wm = useWindowManager()
const binder = useDesktop(wm, host)
useWmWindowEl(binder, 'notes', panel)
wm.open({ id: 'notes', title: 'Заметки' })
</script>

<template>
  <div ref="host" style="position: relative; height: 100vh">
    <section ref="panel">
      <header data-wm-drag><span data-wm-title>Заметки</span></header>
      <div data-wm-content>композаблы</div>
    </section>
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
  import { createManager, createDesktop, wmWindowStore } from '@surdeddd/wmkit/svelte'

  const wm = createManager()
  const dk = createDesktop(wm)
  wm.open({ id: 'notes', title: 'Заметки' })
  const notes = wmWindowStore(wm, 'notes')
</script>

<div use:dk.desktop style="position: relative; height: 100vh">
  <section use:dk.window={{ id: 'notes' }}>
    <header data-wm-drag><span data-wm-title>{$notes?.title}</span></header>
    <div data-wm-content>сторы и экшены</div>
  </section>
</div>
```

### Solid

```tsx
import { useWindowManager, createDesktop, useWmState } from '@surdeddd/wmkit/solid'

function Desktop() {
  const wm = useWindowManager()
  const dk = createDesktop(wm)
  const state = useWmState(wm)
  wm.open({ id: 'notes', title: 'Заметки' })

  return (
    <div ref={dk.desktop} style={{ position: 'relative', height: '100vh' }}>
      <section ref={dk.window('notes')}>
        <header data-wm-drag><span data-wm-title>Заметки</span></header>
        <div data-wm-content>{state().order.length} окон</div>
      </section>
    </div>
  )
}
```

### Angular

```ts
import { Component, ElementRef, afterNextRender, viewChild } from '@angular/core'
import { useWindowManager, createDesktop, useWmState } from '@surdeddd/wmkit/angular'

@Component({
  selector: 'app-desktop',
  template: `
    <div #host style="position: relative; height: 100vh">
      <section #panel>
        <header data-wm-drag><span data-wm-title>Заметки</span></header>
        <div data-wm-content>{{ state().order.length }} окон</div>
      </section>
    </div>`,
})
export class DesktopComponent {
  private host = viewChild.required<ElementRef>('host')
  private panel = viewChild.required<ElementRef>('panel')
  wm = useWindowManager()
  state = useWmState(this.wm)

  constructor() {
    const dk = createDesktop(this.wm)
    afterNextRender(() => {
      dk.desktop(this.host().nativeElement)
      this.wm.open({ id: 'notes', title: 'Заметки' })
      dk.window('notes')(this.panel().nativeElement)
    })
  }
}
```

Полные примеры с таскбаром, модалками и сигнатурами всех хуков — в [docs/adapters.md](./docs/adapters.md).

## API ядра — кратко

```ts
const wm = createWindowManager({ keepInViewport: true, defaultSize: { width: 480, height: 320 } })

wm.open({ id: 'docs', title: 'Документы', layer: 'floating' })
wm.snap('docs', 'left')          // 'right' | 'top-left' | 'bottom-right' | …
wm.minimize('docs')              // restore вернёт предыдущий stage, включая maximized/snapped
wm.update('docs', { title: 'Новый заголовок', meta: { pinned: true } })

const json = wm.serialize()      // JSON-безопасный снапшот
wm.hydrate(json)

wm.on('stage', ({ window, previous }) => console.log(previous, '→', window.stage))
wm.batch(() => { /* много операций — одно уведомление */ })

wm.undo(); wm.redo()             // история изменений, drag = одна запись (historyLimit, default 50)
wm.saveLayout('работа'); wm.loadLayout('работа')   // именованные снапшоты рабочего стола
wm.arrange('tile')               // или 'cascade'; плюс minimizeAll() / restoreAll()

wm.setWorkspace(1)               // виртуальные столы: окна других столов скрыты и не фокусируются
wm.moveToWorkspace('docs', 1)    // focus('docs') сам переключит стол обратно
wm.open({ id: 'video', aspectRatio: 16 / 9 })      // ресайз держит пропорцию
wm.center('video'); wm.sendToBack('docs')
```

Слои: `normal` < `floating` (always-on-top) < `modal`. Модалка блокирует фокус нижних окон (попытка — событие `modalblocked` и flash-анимация), Tab заперт внутри.

Клавиатура по умолчанию: стрелки двигают сфокусированное окно (16 px), `Alt` — шаг 1 px, `Shift+стрелки` — ресайз, `Ctrl/⌘+Alt+←/→` — прилипание к половине, `Ctrl/⌘+Alt+↑/↓` — развернуть/свернуть, `Ctrl/⌘+Z` и `Ctrl/⌘+Shift+Z` — отмена и повтор, `F6`/`Shift+F6` — цикл по окнам, `Escape` отменяет активный drag/resize (и убирает его из истории).

Магнетизм включён из коробки (порог 8 px, на тач-устройствах 12 px): `attachDesktop(wm, el, { magnetism: { threshold: 16 } })` или `magnetism: false`. Свой контекст-меню тайтлбара — через `onTitlebarContextMenu(win, event)` (правый клик и long-press на таче).

### Персист

```js
import { persist } from '@surdeddd/wmkit/persist'
persist(wm, { key: 'my-desktop' })  // авто-восстановление + debounce-сохранение

persist(wm, {                       // версия контракта + миграция старых данных
  version: 2,
  migrate: (state, from) => (from === 1 ? upgrade(state) : null),
})
```

### Popout (experimental)

```js
import { popout, isPopoutSupported } from '@surdeddd/wmkit/popout'
if (isPopoutSupported()) await popout(wm, 'docs', contentElement)
```

Окно уезжает в настоящее always-on-top окно ОС (Document Picture-in-Picture) с тем же JS-контекстом и состоянием.

## Темизация

Подключите `@surdeddd/wmkit/themes/glass.css` и переопределяйте CSS-переменные (`--wm-radius`, `--wm-bg`, `--wm-accent`, …) — или не подключайте ничего и стилизуйте `data-wm-stage`, `data-wm-focused`, `data-wm-dragging`, `[hidden]` сами.

Ещё две готовые темы: `themes/light.css` (светлое стекло) и `themes/retro.css` (Win98-ностальгия). Все три стилизуют одни и те же `data-wm-*` атрибуты — переключение = замена одного импорта.

## SSR

Ядро не трогает `window`/`document`: менеджер можно создавать и гидрейтить на сервере, `attachDesktop` вызывается после маунта. `persist` тихо выключается без доступного storage.

## Качество

- 250 юнит-тестов: **100%** покрытие стейт-машины и persist по строкам/веткам/функциям, плюс обязательные пороги на DOM-слой и адаптеры
- 190+ Playwright-сценариев на Chromium, WebKit и мобильной эмуляции: drag, ресайз во все стороны, снэп, магнетизм, рабочие столы, undo после drag, клавиатура, touch, персист через перезагрузку, стресс на 50 окон, модальные ловушки, axe-аудиты доступности, визуальная регрессия по скриншотам
- перф-бенчмарки в CI на каждый push (`vitest bench`): 1 000 окон открываются за ~150 мс, move среди 50 окон ~1.2 мкс, полный undo/redo-проход на 100 шагов ~52 мкс
- `publint` + `@arethetypeswrong/cli` проверяют валидность пакета, `size-limit` следит за бюджетами

## Лицензия

[MIT](./LICENSE) © Максим Кравцов
