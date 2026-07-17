# wmkit

**Headless оконный менеджер для веба.** Перетаскиваемые окна с ресайзом, снэпом, таскбаром, клавиатурной доступностью и персистом состояния — для vanilla JS и всех основных фреймворков.

[English version](./README.md) · [Живое демо](https://wmkit.vercel.app) · [Зеркало (Pages)](https://surdeddd.github.io/wmkit/) · [GitHub](https://github.com/Surdeddd/wmkit)

[![wmkit — живой демо-десктоп](https://raw.githubusercontent.com/Surdeddd/wmkit/main/.github/assets/hero.png)](https://surdeddd.github.io/wmkit/)

<p align="center"><em>Все окна выше настоящие — <a href="https://surdeddd.github.io/wmkit/">откройте демо</a> и потаскайте.</em></p>

- 🪟 **Полный жизненный цикл окна** — открытие, закрытие, фокус, сворачивание, разворачивание, восстановление, drag, ресайз в 8 направлениях
- 🧠 **Headless-ядро** — сериализуемая стейт-машина плюс DOM-контроллер; своя разметка или готовая стеклянная тема
- ⚛️ **Родные адаптеры** — `@surdeddd/wmkit/react`, `@surdeddd/wmkit/vue`, `@surdeddd/wmkit/svelte`, `@surdeddd/wmkit/solid`, тонкий сахар над одним ядром
- ⊞ **Snap-зоны** — половины, четверти и максимизация от верхнего края с живым превью
- ⌨️ **Доступность** — move/resize с клавиатуры, цикл окон по F6, focus-trap в модалках, `aria-live`-анонсы
- ⚡ **Производительность** — позиционирование только через `transform`, rAF-батчинг ввода, structural sharing; 50 окон таскаются на 60fps
- 💾 **Персист** — один вызов сериализует рабочий стол, один — восстанавливает
- 🖼️ **Popout** *(experimental)* — вынос окна в Document Picture-in-Picture
- 📦 **Ноль зависимостей**, строгий TypeScript, ESM + CJS, ~9 kB gzip

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

Примеры для React, Vue, Svelte и Solid — в [английском README](./README.md#react) и на [лендинге](https://surdeddd.github.io/wmkit/) (табы «Фреймворки»). Принцип один: контент окна живёт в дереве вашего фреймворка, никакого innerHTML.

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
```

Слои: `normal` < `floating` (always-on-top) < `modal`. Модалка блокирует фокус нижних окон (попытка — событие `modalblocked` и flash-анимация), Tab заперт внутри.

Клавиатура по умолчанию: стрелки двигают сфокусированное окно (16 px), `Alt` — шаг 1 px, `Shift+стрелки` — ресайз, `F6`/`Shift+F6` — цикл по окнам, `Escape` отменяет активный drag/resize.

### Персист

```js
import { persist } from '@surdeddd/wmkit/persist'
persist(wm, { key: 'my-desktop' })  // авто-восстановление + debounce-сохранение
```

### Popout (experimental)

```js
import { popout, isPopoutSupported } from '@surdeddd/wmkit/popout'
if (isPopoutSupported()) await popout(wm, 'docs', contentElement)
```

Окно уезжает в настоящее always-on-top окно ОС (Document Picture-in-Picture) с тем же JS-контекстом и состоянием.

## Темизация

Подключите `@surdeddd/wmkit/themes/glass.css` и переопределяйте CSS-переменные (`--wm-radius`, `--wm-bg`, `--wm-accent`, …) — или не подключайте ничего и стилизуйте `data-wm-stage`, `data-wm-focused`, `data-wm-dragging`, `[hidden]` сами.

## SSR

Ядро не трогает `window`/`document`: менеджер можно создавать и гидрейтить на сервере, `attachDesktop` вызывается после маунта. `persist` тихо выключается без доступного storage.

## Качество

- 121 юнит-тест, **100%** покрытие стейт-машины и persist по строкам/веткам/функциям
- 160+ Playwright-сценариев на Chromium, WebKit и мобильной эмуляции: drag, ресайз во все стороны, снэп, клавиатура, touch, персист через перезагрузку, стресс на 50 окон, модальные ловушки, axe-аудиты доступности
- `publint` + `@arethetypeswrong/cli` проверяют валидность пакета, `size-limit` следит за бюджетами

## Лицензия

[MIT](./LICENSE) © Максим Кравцов
