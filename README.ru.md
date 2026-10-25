# wmkit

**Headless оконный менеджер для веба.** Перетаскиваемые окна с ресайзом, снэпом, таскбаром, клавиатурной доступностью и персистом состояния — для vanilla JS и всех основных фреймворков.

[English version](./README.md) · [Живое демо](https://wmkit.vercel.app) · [Зеркало (Pages)](https://surdeddd.github.io/wmkit/) · [Документация](https://wmkit.vercel.app/docs/ru/) · [GitHub](https://github.com/Surdeddd/wmkit)

[![wmkit — живой демо-десктоп](https://raw.githubusercontent.com/Surdeddd/wmkit/main/.github/assets/hero.png)](https://surdeddd.github.io/wmkit/)

<p align="center"><em>Все окна выше настоящие — <a href="https://surdeddd.github.io/wmkit/">откройте демо</a> и потаскайте.</em></p>

- 🪟 **Полный жизненный цикл окна** — открытие, закрытие, фокус, сворачивание, разворачивание, восстановление, drag, ресайз в 8 направлениях
- 🧠 **Headless-ядро** — сериализуемая стейт-машина плюс DOM-контроллер; своя разметка или готовая стеклянная тема
- 🧱 **Своё окно, своя разметка** — соберите весь корпус из строки-шаблона, повесьте кнопки атрибутами и меняйте скин на живом окне, не теряя того, что оно показывало
- ⚛️ **Родные адаптеры** — `@surdeddd/wmkit/react`, `/vue`, `/svelte`, `/solid`, `/angular`, `/preact`, `/lit`, `/qwik`, тонкий сахар над одним ядром, а для всего остального — веб-компоненты `<wm-desktop>` и `<wm-window>`
- 🗃️ **Вкладочные группы** — бросьте заголовок на заголовок, и окна начнут делить одну рамку; порядок вкладок можно менять
- ⊞ **Snap-зоны** — половины, четверти, трети и максимизация от верхнего края с живым превью
- 🧲 **Магнетизм** — края окна прилипают к соседям и вьюпорту при перетаскивании
- ↩️ **Undo/redo** — каждая мутация = один шаг; целый drag схлопывается в одну запись истории
- 🗂️ **Рабочие столы и layout'ы** — виртуальные столы, снапшоты, `cascade`/`tile` одним вызовом
- 🔒 **Фиксация пропорций** — окно с `aspectRatio` держит 16:9 или 4:3 при любом ресайзе
- ⌨️ **Доступность** — move/resize/snap с клавиатуры, цикл окон по F6, focus-trap в модалках, `aria-live`-анонсы
- ⚡ **Производительность** — позиционирование только через `transform`, rAF-батчинг ввода, structural sharing; 50 окон таскаются на 60fps
- 💾 **Персист** — один вызов сериализует рабочий стол, один — восстанавливает, с версионированием и миграциями
- 🎨 **Шестнадцать тем** — glass, light, retro, terminal, paper, neon, aqua, frost, candy, carbon, brutalist, blueprint, amber, noir, forest, synth — либо полностью свой CSS
- 🖼️ **Popout** — вынос окна в Picture-in-Picture или во всплывающее окно на другом мониторе
- 🧩 **Докинг** — окна раскладываются по панелям со вкладками и перетаскиваемыми разделителями, как в dockview, а остальные продолжают плавать; отменяется и сохраняется
- 📦 **Совместим с WinBox** — `@surdeddd/wmkit/winbox` говорит на API WinBox.js; [переезд одним импортом](docs/winbox-migration.ru.md)
- 📦 **Ноль зависимостей**, строгий TypeScript, ESM + CJS, ядро меньше 16 кБ в brotli

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
| `data-wm-title` | узел заголовка: его текст следует за состоянием, а связь через `aria-labelledby` ставится, когда узел лежит в том же корне, что и окно |
| `data-wm-close` / `data-wm-minimize` / `data-wm-maximize` | кнопки управления, работают через делегирование |
| `data-wm-content` | скроллируемая область контента |

`removeOnClose` сам отвязывает контроллер и удаляет элемент при закрытии окна; через биндер (адаптеры) вернувшееся окно снова добавляется в рабочий стол. На тач-устройствах хит-зоны ресайза и порог снэпа автоматически крупнее (`pointer: coarse`); настраиваются через `attachDesktop(wm, el, { hitAreas: { edge, corner } })`.

Контроллер добавляет ресайз-хендлы (`[data-wm-resize]`), превью снэпа (`[data-wm-snap-preview]`) и скрытый live-регион для скринридеров.

## Адаптеры

Каждый адаптер — тонкая обёртка над тем же ядром и тем же DOM-контроллером. Они нужны только чтобы привязаться и отвязаться в нужный момент жизненного цикла компонента. Контент окна всегда живёт в дереве вашего фреймворка: никакого innerHTML, порталов и переноса узлов.

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
      {Object.values(state.windows).map((win) => (
        <Win key={win.id} binder={binder} win={win} />
      ))}
    </div>
  )
}

function Win({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id)
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

Полные примеры с таскбаром, модалками и сигнатурами всех хуков — в [docs/adapters.ru.md](./docs/adapters.ru.md).

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

Слои: `normal` < `floating` (always-on-top) < `modal`. Модалка блокирует фокус нижних окон и любое указательное взаимодействие с ними: drag, ресайз, двойной клик, action-атрибуты, меню тайтлбара и нажатия, которые сдвинули бы фокус. Заблокированный `focus()` — это событие `modalblocked`, заблокированное нажатие — flash-анимация модалки, Tab заперт внутри.

Клавиатура по умолчанию: стрелки двигают сфокусированное окно (16 px), пока фокус клавиатуры на самом окне или в его тайтлбаре (виджеты в контенте сохраняют свои стрелки), `Alt` — шаг 1 px, `Shift+стрелки` — ресайз, `Ctrl/⌘+Alt+←/→` — прилипание к половине, `Ctrl/⌘+Alt+↑/↓` — развернуть/свернуть, `Ctrl/⌘+Z` и `Ctrl/⌘+Shift+Z` — отмена и повтор (в том числе на нелатинской раскладке), `F6`/`Shift+F6` — цикл по окнам, и из поля ввода тоже, `Escape` отменяет активный drag/resize (и убирает его из истории).

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

### Popout

```js
import { popout } from '@surdeddd/wmkit/popout'
button.onclick = () => popout(wm, 'docs', contentElement, { target: 'window', screen: 'other' })
```

Окно уезжает в отдельное окно ОС с тем же JS-контекстом и состоянием: в always-on-top Document Picture-in-Picture, где браузер его умеет (Chrome, Edge, Firefox), и во всплывающее окно везде остальном. `screen: 'other'` ставит всплывающее окно на второй монитор через Window Management API. Вызывать из обработчика жеста пользователя.

### `createDock(desktop, options?)` — `@surdeddd/wmkit/dock`

```js
import { createDock } from '@surdeddd/wmkit/dock'
const dock = createDock(desktop)
dock.dock('editor')
dock.dock('files', { side: 'left' })
```

Раскладывает окна по панелям. Бросьте окно к краю панели — она разделится, в центр — окно станет вкладкой, к краю рабочего стола — встанет рядом со всеми. Разделители двигаются мышью и стрелками. Закреплённое окно, оторванное за заголовок, снова плавает. Каждая операция — один шаг отмены, а `persist` сохраняет раскладку между перезагрузками.

### `pinch(options?)`, `swipe(options?)`, `touchGestures(options?)` — `@surdeddd/wmkit/gestures`

Жесты двумя пальцами, подключаются по желанию — ядро за них не платит: пинч растягивает окно вокруг точки между пальцами, свайп двумя пальцами вбок переключает рабочий стол. 1.61 кБ в brotli.

```js
import { attachDesktop } from '@surdeddd/wmkit'
import { touchGestures } from '@surdeddd/wmkit/gestures'

attachDesktop(wm, root, { gestures: [touchGestures({ swipe: { workspaces: 4 } })] })
```

Жест — это просто функция: принимает `GestureContext`, возвращает свою отписку. Свои жесты уживаются со встроенными драгом и ресайзом через ту же пару `claim`/`busy` — подробности в [docs/api.ru.md](docs/api.ru.md).

### `skin(spec)`, `defaultSkin`, `barebones` — `@surdeddd/wmkit/chrome`

Собирает само окно из строки разметки: можно принести свою обвязку и свои кнопки, не написав ни одного обработчика. 1.9 кБ в brotli.

```js
import { attachDesktop } from '@surdeddd/wmkit'
import { skin } from '@surdeddd/wmkit/chrome'

const mine = skin({
  name: 'mine',
  template:
    '<section><header data-wm-drag><span data-wm-title>{{title}}</span>' +
    '<button data-wm-close aria-label="Закрыть"></button></header>' +
    '<div data-wm-content></div></section>',
})

const desktop = attachDesktop(wm, root, { skins: { mine } })
desktop.mountWindow('notes', 'mine').content.append(myApp)
```

`data-wm-close`, `data-wm-minimize`, `data-wm-maximize`, `data-wm-restore`, `data-wm-center`, `data-wm-send-back`, `data-wm-snap="left"` и `data-wm-to-workspace="2"` читаются прямо из вашей разметки. Каждая подстановка `{{...}}` экранируется и может стоять только в тексте или в атрибуте `aria-*`, `data-*`, `title`, `alt`, `class`, `id`, `role`, `lang`, `dir`, `for`, `value`, `placeholder` или `label` в кавычках; в любом другом месте `skin()` бросает ошибку. За дальнейшими изменениями следует только `{{title}}` внутри `[data-wm-title]`. `shadow: true` запечатывает обвязку в открытом теневом корне, не теряя ни группировку, ни ловушку фокуса, ни доступное имя — подробности в [docs/recipes.ru.md](docs/recipes.ru.md).

### `createDevtools(wm, options?)` — `@surdeddd/wmkit/devtools`

Панель, которую подключают по желанию: живая таблица окон, журнал событий и управление менеджером — чтобы видеть, что делает машина состояний, без отладчика. Она следит за менеджером, а не за DOM, поэтому работает с любым адаптером и без него.

```js
import { createDevtools, devtoolsMessagesRu } from '@surdeddd/wmkit/devtools'

const panel = createDevtools(wm, { messages: devtoolsMessagesRu })
panel.destroy()
```

| Опция | По умолчанию | Значение |
| --- | --- | --- |
| `container` | `document.body` | куда монтируется панель |
| `messages` | английский каталог | `devtoolsMessagesRu` для русского или свои строки |
| `logLimit` | `50` | размер кольцевого буфера журнала |
| `events` | open, close, focus, stage, workspace, group, modalblocked | какие события менеджера писать |

Строки обновляются точечно, а не перерисовываются целиком, поэтому фокус клавиатуры внутри панели переживает перемещение окон. Панель добавляет один изолированный стиль — общий для всех панелей и удаляемый вместе с последней.

## Темизация

Подключите `@surdeddd/wmkit/themes/glass.css` и переопределяйте CSS-переменные (`--wm-radius`, `--wm-bg`, `--wm-accent`, …) — или не подключайте ничего и стилизуйте `data-wm-stage`, `data-wm-focused`, `data-wm-dragging`, `[hidden]` сами.

Ещё пятнадцать готовых тем: `light`, `retro`, `terminal`, `paper`, `neon`, `aqua`, `frost`, `candy`, `carbon`, `brutalist`, `blueprint`, `amber`, `noir`, `forest`, `synth`. Все стилизуют одни и те же `data-wm-*` атрибуты — переключение = замена одного импорта, и у каждой есть 24px тач-цели плюс блоки `prefers-reduced-motion` и `forced-colors`.

Каждая тема к тому же держит контраст WCAG AA: браузерный тест меряет отрендеренные пиксели демо под всеми шестнадцатью и падает ниже 4.5:1.

Три слоя, от самого широкого к самому узкому:

| слой | достаёт до | меняет |
| --- | --- | --- |
| тема | всех окон | токены |
| вариант | одного окна | токены, через `data-wm-variant` |
| скин | одного окна | саму разметку |

Тема и вариант перекрашивают то, что есть; скин это заменяет. Для первых двух — `meta.variant`, для третьего — `meta.skin`, подробности в [docs/theming.ru.md](docs/theming.ru.md).

## SSR

Ядро не трогает `window`/`document`: менеджер можно создавать и гидрейтить на сервере, `attachDesktop` вызывается после маунта. `persist` тихо выключается без доступного storage.

## Документация

Справочник лежит в [`docs/`](./docs/README.ru.md) и опубликован сайтом с поиском на русском и английском: [wmkit.vercel.app/docs/ru](https://wmkit.vercel.app/docs/ru/). Там же — [API](./docs/api.ru.md), [адаптеры](./docs/adapters.ru.md), [темы](./docs/theming.ru.md), [рецепты](./docs/recipes.ru.md), [поддержка браузеров](./docs/browser-support.ru.md) и [переезд с WinBox](./docs/winbox-migration.ru.md).

## Шаблоны

[`templates/dashboard`](./templates/dashboard/README.ru.md) — операционный дашборд на `<wm-desktop>` и плагине докинга: плитки с цифрами, живой график на SVG, таблица и журнал, разложенные по панелям, которые можно переставлять, отпускать плавать и сбрасывать; раскладка переживает перезагрузку, интерфейс на русском и английском.

```bash
npx degit Surdeddd/wmkit/templates/dashboard my-dashboard
```

[![Открыть в StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/Surdeddd/wmkit/tree/main/templates/dashboard)

## Сравнение

| | wmkit | WinBox | jsPanel4 | Dockview | Zag floating-panel |
| --- | --- | --- | --- | --- | --- |
| Поддерживается | ✓ 2026 | ✗ с 2023 | ✗ с 2022 | ✓ | ✓ |
| Headless-ядро | ✓ | ✗ | ✗ | ~ свой UI | ✓ |
| Родные адаптеры | React·Vue·Svelte·Solid·Angular·Preact·Lit·Qwik + веб-компоненты | от сообщества | ✗ | React·Vue·Angular | через Ark UI |
| Много окон (z-порядок, таскбар, модалки) | ✓ | частично | частично | группы дока | ✗ одна панель |
| Зоны снэпа с превью | ✓ | ✗ | ✗ | — | ✗ |
| Докинг (панели, вкладки) | ✓ | ✗ | ✗ | ✓ | ✗ |
| Клавиатура и скринридер | ✓ | ✗ | ✗ | частично | частично |
| Сохранение из коробки | ✓ | ✗ | ✗ | ✓ | ✗ |
| Вынос окна (PiP, popup, другой монитор) | ✓ | ✗ | ✗ | window.open | ✗ |
| TypeScript | строгий | @types | ✗ | ✓ | ✓ |

*(проверено в июле 2026: история коммитов, загрузки npm, открытые запросы фич)*

## Качество

- 867 юнит-тестов: **100%** покрытие стейт-машины, persist и модели раскладки дока по строкам/веткам/функциям, фаззеры менеджера, DOM-слоя и раскладки дока, плюс обязательные пороги на DOM-слой, плагины и адаптеры
- 750+ Playwright-сценариев на Chromium, Firefox, WebKit и мобильной эмуляции: drag, ресайз во все стороны, снэп, магнетизм, докинг, рабочие столы, undo после drag, клавиатура, touch, iframe, popout, персист через перезагрузку, стресс на 50 окон, модальные ловушки, все адаптеры, сайт документации и шаблон, axe-аудиты доступности, визуальная регрессия по скриншотам
- перф-бенчмарки в CI на каждый push (`vitest bench`): 1 000 окон открываются за ~57 мс, move среди 50 окон без DOM ~3 мкс, кадр перетаскивания среди 800 привязанных окон ~0.09 мс, полный undo/redo-проход на 100 шагов ~80 мкс
- `publint` + `@arethetypeswrong/cli` проверяют валидность пакета, `size-limit` следит за бюджетами

## Лицензия

[MIT](./LICENSE) © Максим Кравцов
