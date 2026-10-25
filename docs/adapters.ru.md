# Адаптеры

Каждый адаптер — тонкая обёртка над тем же менеджером и тем же DOM-контроллером. Они нужны, чтобы подключиться и отключиться в нужный момент жизненного цикла компонента, и только. Всё, что можно сделать в одном, можно сделать во всех, и всегда можно спуститься до vanilla API.

Общий контракт:

- **один менеджер на рабочий стол**: создаётся один раз и уничтожается вместе с компонентом-владельцем
- **ваша разметка** несёт `data-wm-drag`, `data-wm-title`, `data-wm-content` и кнопки управления
- **привязка не зависит от порядка**: привязывайте элемент окна до или после появления рабочего стола, до или после `wm.open()`
- **рендерите окна из `state.windows`**, а не из `state.order`: `order` — это порядок наложения, он меняется при каждом фокусе, поэтому список с ключами по нему двигает DOM-узлы — клик, который следует за нажатием, теряется, а iframe перезагружаются. Ключи `state.windows` хранят порядок открытия, а наложение задаётся через `z-index`, поэтому порядок в DOM никогда не важен

## Vanilla

```js
import { createWindowManager, attachDesktop } from '@surdeddd/wmkit'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const desktop = attachDesktop(wm, document.querySelector('#desktop'))

function spawn(init, render) {
  const win = wm.open(init)
  const el = document.createElement('section')
  el.innerHTML = `
    <header data-wm-drag>
      <span data-wm-title>${win.title}</span>
      <span data-wm-controls>
        <button data-wm-minimize aria-label="Minimize"></button>
        <button data-wm-maximize aria-label="Maximize"></button>
        <button data-wm-close aria-label="Close"></button>
      </span>
    </header>
    <div data-wm-content></div>
  `
  render(el.querySelector('[data-wm-content]'))
  document.querySelector('#desktop').append(el)
  desktop.attachWindow(win.id, el, { removeOnClose: true })
  return win
}

spawn({ title: 'Notes', width: 420, height: 280 }, (body) => {
  body.textContent = 'Anything you want.'
})
```

`removeOnClose` отвязывает контроллер и удаляет элемент при закрытии окна, так что узлы никогда не утекают. Через биндер (его и используют адаптеры) у вернувшегося окна — после отмены, повторного открытия, закрытия и открытия в одном батче — элемент перед привязкой снова добавляется в элемент рабочего стола. Вызовите `desktop.destroy()`, когда уходит весь рабочий стол.

## React

`@surdeddd/wmkit/react`

```tsx
import {
  useWindowManager, useDesktop, useWmState, useWmWindow, useWmWindowRef,
} from '@surdeddd/wmkit/react'
import '@surdeddd/wmkit/themes/glass.css'

export function Desktop() {
  const wm = useWindowManager({ historyLimit: 100 })
  const { ref, binder } = useDesktop(wm, { magnetism: { threshold: 12 } })
  const state = useWmState(wm)

  return (
    <div ref={ref} style={{ position: 'relative', height: '100vh' }}>
      <button type="button" onClick={() => wm.open({ title: 'New window' })}>
        open
      </button>

      {Object.keys(state.windows).map((id) => (
        <Win key={id} binder={binder} id={id} />
      ))}

      <Taskbar wm={wm} />
    </div>
  )
}

function Win({ binder, id }) {
  const win = useWmWindow(binder.wm, id)
  const ref = useWmWindowRef(binder, id)
  if (!win) return null

  return (
    <section ref={ref}>
      <header data-wm-drag>
        <span data-wm-title>{win.title}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Minimize" />
          <button data-wm-maximize aria-label="Maximize" />
          <button data-wm-close aria-label="Close" />
        </span>
      </header>
      <div data-wm-content>Your React tree lives here — no portals, no innerHTML.</div>
    </section>
  )
}

function Taskbar({ wm }) {
  const state = useWmState(wm)
  const minimized = Object.values(state.windows).filter((win) => win.stage === 'minimized')

  return (
    <div role="toolbar" aria-label="Taskbar">
      {minimized.map((win) => (
        <button key={win.id} type="button" onClick={() => wm.focus(win.id)}>
          {win.title}
        </button>
      ))}
    </div>
  )
}
```

| Хук | Возвращает |
| --- | --- |
| `useWindowManager(options?)` | менеджер, созданный один раз и уничтожаемый на следующей макрозадаче после настоящего размонтирования; имитация размонтирования в StrictMode и Fast Refresh его не уничтожают, поэтому слушатели, добавленные во время рендера или в инициализаторах, в dev выживают |
| `useWmState(wm)` | весь `ManagerState` через `useSyncExternalStore` |
| `useWmWindow(wm, id)` | один `WindowState \| undefined`, перерендер только при изменении этого окна |
| `useDesktop(wm, options?)` | `{ ref, binder, controller() }` — повесьте `ref` на элемент рабочего стола |
| `useWmWindowRef(binder, id, options?)` | ref-колбэк для элемента окна; `options` — это `Omit<WindowAttachOptions, 'removeOnClose'>` |

Заметки:

- `useWmWindow` — подписка, дружащая с memo: неизменившиеся окна сохраняют ссылочную идентичность, поэтому в списке окон перерендеривается только то, которое сдвинулось.
- `options` у `useDesktop` и `useWmWindowRef` захватываются на первом рендере (они настраивают уже существующий контроллер). Меняйте поведение через менеджер, а не подменой опций.
- Узлом окна владеет React, поэтому адаптер никогда не даёт контроллеру его удалить: рендерите окно по условию (`if (!win) return null`, как выше), и React удалит его сам. `removeOnClose` не входит в опции `useWmWindowRef`.
- Двойное монтирование в StrictMode безопасно: адаптер ничего не разрушает в эффекте. Вызов ref рабочего стола с `null` отвязывает, биндер переподписывается, когда ref привязывается снова, а уничтожение менеджера откладывается и отменяется повторным монтированием. Работает на React 18 и 19.

## Vue

`@surdeddd/wmkit/vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  useWindowManager, useDesktop, useWmState, useWmWindow, useWmWindowEl,
} from '@surdeddd/wmkit/vue'
import '@surdeddd/wmkit/themes/glass.css'

const host = ref<HTMLElement>()
const wm = useWindowManager()
const binder = useDesktop(wm, host)
const state = useWmState(wm)

const notes = ref<HTMLElement>()
useWmWindowEl(binder, 'notes', notes, { removeOnClose: true })
const note = useWmWindow(wm, 'notes')

wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
</script>

<template>
  <div ref="host" style="position: relative; height: 100vh">
    <section ref="notes">
      <header data-wm-drag>
        <span data-wm-title>{{ note?.title }}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Свернуть" />
          <button data-wm-maximize aria-label="Развернуть" />
          <button data-wm-close aria-label="Закрыть" />
        </span>
      </header>
      <div data-wm-content>{{ state.order.length }} windows open</div>
    </section>
  </div>
</template>
```

| Композабл | Возвращает |
| --- | --- |
| `useWindowManager(options?)` | менеджер, уничтожается вместе с effect scope |
| `useWmState(wm)` | `ComputedRef<ManagerState>`, только для чтения (запись отклоняется) |
| `useWmWindow(wm, id)` | `ComputedRef<WindowState \| undefined>`; `id` может быть ref или геттером |
| `useDesktop(wm, targetRef, options?)` | `DesktopBinder`, привязывается с `flush: 'post'` |
| `useWmWindowEl(binder, id, targetRef, options?)` | привязывает элемент окна и перепривязывает его при смене id |

Всё цепляется к текущему effect scope, так что размонтированный компонент убирает за собой. Вне scope (например, у менеджера на уровне модуля) ничего не освобождается автоматически — вызывайте `wm.destroy()` и `binder.destroy()` сами. Во время серверного рендеринга `useWmState` и `useWmWindow` вообще не подписываются и возвращают живые ref-геттеры, поэтому менеджер на уровне модуля, общий для SSR-запросов, не копит слушателей.

## Svelte

`@surdeddd/wmkit/svelte`

```svelte
<script lang="ts">
  import { createManager, createDesktop, wmStore, wmWindowStore } from '@surdeddd/wmkit/svelte'
  import '@surdeddd/wmkit/themes/glass.css'

  const wm = createManager()
  const dk = createDesktop(wm)
  const state = wmStore(wm)

  wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
  const notes = wmWindowStore(wm, 'notes')
</script>

<div use:dk.desktop style="position: relative; height: 100vh">
  <section use:dk.window={{ id: 'notes', removeOnClose: true }}>
    <header data-wm-drag>
      <span data-wm-title>{$notes?.title}</span>
      <span data-wm-controls>
        <button data-wm-minimize aria-label="Minimize"></button>
        <button data-wm-maximize aria-label="Maximize"></button>
        <button data-wm-close aria-label="Close"></button>
      </span>
    </header>
    <div data-wm-content>{$state.order.length} windows open</div>
  </section>
</div>
```

| Экспорт | Возвращает |
| --- | --- |
| `createManager(options?)` | обычный менеджер — уничтожайте его сами, если им владеет компонент |
| `wmStore(wm)` | readable-стор с `ManagerState` |
| `wmWindowStore(wm, id)` | readable-стор одного окна, который испускает значение, только когда это окно меняется |
| `createDesktop(wm, options?)` | экшены `{ binder, desktop, window }` |

Экшен `window` перепривязывается, только когда `params.id` действительно меняется, поэтому перерендер во время перетаскивания его не прерывает. Экшен `desktop` уничтожает биндер, когда элемент исчезает.

## Solid

`@surdeddd/wmkit/solid`

```tsx
import { For } from 'solid-js'
import { useWindowManager, createDesktop, useWmState, useWmWindow } from '@surdeddd/wmkit/solid'
import '@surdeddd/wmkit/themes/glass.css'

export function Desktop() {
  const wm = useWindowManager()
  const dk = createDesktop(wm)
  const state = useWmState(wm)

  wm.open({ title: 'Notes', width: 420, height: 280 })

  return (
    <div ref={dk.desktop} style={{ position: 'relative', height: '100vh' }}>
      <For each={Object.keys(state().windows)}>
        {(id) => {
          const win = useWmWindow(wm, id)
          return (
            <section ref={dk.window(id, { removeOnClose: true })}>
              <header data-wm-drag>
                <span data-wm-title>{win()?.title}</span>
                <span data-wm-controls>
                  <button data-wm-minimize aria-label="Minimize" />
                  <button data-wm-maximize aria-label="Maximize" />
                  <button data-wm-close aria-label="Close" />
                </span>
              </header>
              <div data-wm-content>fine-grained, obviously</div>
            </section>
          )
        }}
      </For>
    </div>
  )
}
```

`useWmWindow` принимает строку или аксессор. Всё регистрирует `onCleanup`, когда есть owner, поэтому компоненты освобождают себя сами; при вызове вне owner ничего не освобождается автоматически.

Внутри owner `dk.desktop` и `dk.window` привязываются при монтировании, после того как Solid вставит элемент, поэтому только что открытое окно получает фокус и применяется поправка `position: relative`; вне owner они привязываются сразу. Внутри owner `useWmWindow` — это memo, который уведомляет, только когда меняется его окно, а id-аксессор должен быть реактивным (сигнал или проп), чтобы за ним следили; вне owner это обычный живой аксессор, и на сервере он читает текущее значение.

## Angular

`@surdeddd/wmkit/angular`

```ts
import { Component, ElementRef, afterNextRender, viewChild } from '@angular/core'
import { useWindowManager, createDesktop, useWmState, useWmWindow } from '@surdeddd/wmkit/angular'

@Component({
  selector: 'app-desktop',
  template: `
    <div class="desktop" #host style="position: relative; height: 100vh">
      <section #panel>
        <header data-wm-drag>
          <span data-wm-title>{{ note()?.title }}</span>
          <span data-wm-controls>
            <button data-wm-minimize aria-label="Minimize"></button>
            <button data-wm-maximize aria-label="Maximize"></button>
            <button data-wm-close aria-label="Close"></button>
          </span>
        </header>
        <div data-wm-content>{{ state().order.length }} windows open</div>
      </section>
    </div>
  `,
})
export class DesktopComponent {
  private host = viewChild.required<ElementRef<HTMLElement>>('host')
  private panel = viewChild.required<ElementRef<HTMLElement>>('panel')

  wm = useWindowManager()
  state = useWmState(this.wm)
  note = useWmWindow(this.wm, 'notes')

  constructor() {
    const dk = createDesktop(this.wm)
    afterNextRender(() => {
      dk.desktop(this.host().nativeElement)
      this.wm.open({ id: 'notes', title: 'Notes', width: 420, height: 280 })
      dk.window('notes', { removeOnClose: true })(this.panel().nativeElement)
    })
  }
}
```

`useWmState` и `useWmWindow` возвращают настоящие сигналы, поэтому работают в шаблонах и в `computed()`. Адаптер пишет свой сигнал через `untracked`, поэтому изменение менеджера внутри `effect()` или `computed()` не бросает NG0600 (Angular 16–18) и не оставляет сигнал устаревшим. Очистка идёт через `DestroyRef`, когда вы внутри injection context; вне его адаптер молча её пропускает, и освобождать ресурсы приходится вручную. Привязывайте элементы в `afterNextRender` — до этого view children не существуют.

## Preact

`@surdeddd/wmkit/preact`

```ts
import { h } from 'preact'
import {
  useWindowManager, useDesktop, useWmState, useWmWindowRef,
} from '@surdeddd/wmkit/preact'
import '@surdeddd/wmkit/themes/glass.css'

function Win({ binder, win }) {
  const ref = useWmWindowRef(binder, win.id)
  return h('section', { ref },
    h('header', { 'data-wm-drag': '' },
      h('span', { 'data-wm-title': '' }, win.title),
      h('span', { 'data-wm-controls': '' },
        h('button', { 'data-wm-minimize': '', 'aria-label': 'Minimize' }),
        h('button', { 'data-wm-maximize': '', 'aria-label': 'Maximize' }),
        h('button', { 'data-wm-close': '', 'aria-label': 'Close' }),
      ),
    ),
    h('div', { 'data-wm-content': '' }, 'Preact content'),
  )
}

export function Desktop() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  return h('div', { ref, style: { position: 'relative', height: '100vh' } },
    h('button', { type: 'button', onClick: () => wm.open({ title: 'New window' }) }, 'open'),
    Object.values(state.windows).map((win) => h(Win, { key: win.id, binder, win })),
  )
}
```

Те же пять хуков с теми же контрактами, что и в React-адаптере, построенные на `preact/hooks` (Preact 10 и новее, JSX работает так же). В Preact нет `useSyncExternalStore`, поэтому хуки подписываются в layout-эффекте и перечитывают снапшот сразу после подписки: изменение между рендером и подпиской не теряется.

## Lit

`@surdeddd/wmkit/lit`

```ts
import { createWindowManager, createDesktopBinder } from '@surdeddd/wmkit'
import { WmStateController, wmDesktop, wmWindow } from '@surdeddd/wmkit/lit'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const binder = createDesktopBinder(wm)

class AppDesktop extends LitElement {
  private view = new WmStateController(this, wm)

  createRenderRoot() {
    return this
  }

  render() {
    const windows = Object.values(this.view.state.windows)
    return html`<div ${wmDesktop(binder)} style="position: relative; height: 100vh">
      ${repeat(windows, (win) => win.id, (win) => html`
        <section ${wmWindow(binder, win.id)}>
          <header data-wm-drag>
            <span data-wm-title>${win.title}</span>
            <span data-wm-controls>
              <button data-wm-minimize aria-label="Minimize"></button>
              <button data-wm-maximize aria-label="Maximize"></button>
              <button data-wm-close aria-label="Close"></button>
            </span>
          </header>
          <div data-wm-content>Lit content</div>
        </section>`)}
    </div>`
  }
}

customElements.define('app-desktop', AppDesktop)
```

| Экспорт | Что делает |
| --- | --- |
| `WmStateController(host, wm)` | реактивный контроллер; `.state` — это `ManagerState`, хост перерендеривается на каждое изменение, пока подключён |
| `WmWindowController(host, wm, id)` | `.window` — один `WindowState \| undefined`; хост перерендеривается, только когда меняется это окно |
| `wmDesktop(binder)` | директива элемента, которая привязывает элемент рабочего стола |
| `wmWindow(binder, id, options?)` | директива элемента, которая привязывает элемент окна |

Директивы привязываются, когда рендерится part, отпускают элемент при отключении и привязываются снова при переподключении, поэтому перемещать хост по странице безопасно. Контроллеры перечитывают состояние при переподключении, так что хост, отключённый, пока менялся менеджер, рендерит свежие данные. Задавайте ключи списку окон через `repeat`, чтобы экземпляр шаблона оставался со своим окном. Рендерите в light DOM (`createRenderRoot() { return this }`), чтобы таблица стилей темы на странице доставала до окон. Внутри собственного теневого корня элемента вместо этого добавьте тему в его стили: `static styles = unsafeCSS(themeStyle('glass'))`, где `themeStyle` берётся из `@surdeddd/wmkit/themes` ([Темизация](./theming.ru.md)).

## Qwik

`@surdeddd/wmkit/qwik`

```tsx
import { component$ } from '@builder.io/qwik'
import { WmDesktop, WmWindow, useWm, useWmState } from '@surdeddd/wmkit/qwik'
import '@surdeddd/wmkit/themes/glass.css'

export const Count = component$(() => {
  const state = useWmState()
  return <output>{state.value?.order.length ?? 0} windows</output>
})

export const Opener = component$(() => {
  const store = useWm()
  return <button onClick$={() => store.wm?.open({ title: 'New window' })}>open</button>
})

export default component$(() => (
  <WmDesktop class="desktop">
    <WmWindow id="notes" title="Notes" x={20} y={60} width={320} height={220}>
      <button q:slot="controls" data-wm-close aria-label="Close">×</button>
      <p>Server-rendered content, resumable.</p>
    </WmWindow>
    <Count />
    <Opener />
  </WmDesktop>
))
```

| Экспорт | Что делает |
| --- | --- |
| `WmDesktop` | рендерит элемент рабочего стола; менеджер создаётся на клиенте в `useVisibleTask$` и передаётся через `WmContext`. Пропсы: `options` (опции рабочего стола и менеджера), `class` |
| `WmWindow` | рендерит секцию окна: тайтлбар с `data-wm-title`, слот `controls` и слот для контента. Пропсы: `id` плюс любое поле `WindowInit`, `class` |
| `useWm()` | стор рабочего стола: `wm` и `binder` (оба `undefined`, пока рабочий стол не стал видимым на клиенте) и `version`, который увеличивается при каждом изменении |
| `useWmState()` | вычисляемый сигнал с `ManagerState`, на сервере — `undefined` |

`WmWindow` рендерит начальную геометрию инлайн, поэтому серверная разметка стоит там, куда её поставит клиент, и при возобновлении вёрстка не сдвигается. Окно открывается и привязывается, как только рабочий стол появляется на клиенте. Узлом владеет Qwik: окно, закрытое через менеджер, скрывается и возвращается привязанным, когда его id открывают снова. Размонтирование `WmWindow` закрывает его окно.

Точка входа поставляется как `qwik.qwik.mjs`, поэтому оптимизатор Qwik обрабатывает её как ваши собственные компоненты. Диапазон peer-зависимости: `@builder.io/qwik` от 1.5 и ниже 2. Qwik City и другие сетапы с серверным рендерингом загружают Qwik loader за вас. С чисто клиентским `render()` загружать его придётся самим, иначе ни один обработчик `onClick$` не сработает:

```ts
import { render } from '@builder.io/qwik'
import loader from '@builder.io/qwik/qwikloader.js?raw'

render(document.getElementById('app')!, <App />).then(() => {
  const script = document.createElement('script')
  script.textContent = loader
  document.head.append(script)
})
```

## Веб-компоненты

`@surdeddd/wmkit/elements`

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

`@surdeddd/wmkit/elements/define` регистрирует `<wm-desktop>` и `<wm-window>`, а на сервере ничего не делает. Для другого префикса вызовите `defineWmElements({ prefix: 'acme' })` из `@surdeddd/wmkit/elements` — получите `<acme-desktop>` и `<acme-window>`. Элементы работают в любом фреймворке, который рендерит HTML: React 19, Vue, Angular, Svelte, Solid или чистый HTML.

`<wm-desktop>`

| Атрибут или свойство | Смысл |
| --- | --- |
| `snap`, `keyboard`, `grouping`, `magnetism`, `announce` | включены по умолчанию; `="false"` выключает любой из них |
| `persist="key"` | сохраняет раскладку в `localStorage` под этим ключом и восстанавливает её |
| `lang` | `ru…` выбирает русские подписи кнопок; учитывается ближайший `lang` на странице |
| `.options` | любая опция рабочего стола или менеджера; задайте её до подключения элемента |
| `.messages` | свои подписи кнопок (`{ minimize, maximize, close }`); главнее `lang` |
| `.manager`, `.controller` | менеджер и контроллер, после подключения |

`<wm-window>`

| Атрибут | Смысл |
| --- | --- |
| `window-id` | id окна; генерируется, если не задан |
| `label` | заголовок |
| `x`, `y`, `width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`, `aspect-ratio`, `workspace` | геометрия и ограничения |
| `stage` | `normal`, `minimized` или `maximized`; отражает текущую стадию обратно |
| `layer` | `normal`, `floating` или `modal` |
| `closable`, `minimizable`, `maximizable`, `resizable`, `draggable`, `snappable` | включены по умолчанию; `="false"` выключает любой из них |
| `closed` | окно закрыто и скрыто; снятие атрибута открывает его снова |
| `chrome="none"` | скрывает встроенный тайтлбар — для своей разметки с `data-wm-drag` |

Изменение атрибута управляет менеджером, а менеджер отражает `stage` и `closed` обратно. Библиотека никогда не удаляет элемент, так что фреймворк, который его отрендерил, остаётся владельцем. Удаление элемента со страницы закрывает его окно; перемещение — нет.

Обвязка живёт в теневом корне с частями (parts) `titlebar`, `title`, `control` (плюс `minimize`, `maximize`, `close`) и `content`. Дочерние элементы остаются в light DOM, в слоте по умолчанию, а слот `actions` добавляет кнопки в тайтлбар. Стилизуйте части через `::part()` и токены темы, которые проходят через теневую границу.

События всплывают и проходят через теневые корни. Каждый `detail` несёт `window`:

| Событие | Когда |
| --- | --- |
| `wm-ready` (на рабочем столе) | менеджер создан; `detail.manager` |
| `wm-open`, `wm-close` | окно открылось или закрылось |
| `wm-beforeclose` | запрошено закрытие; `preventDefault()` оставляет окно открытым |
| `wm-move`, `wm-resize`, `wm-stage`, `wm-focus` | изменились геометрия, стадия или фокус |

## Какую точку входа выбрать

| Вам нужно | Используйте |
| --- | --- |
| полный контроль, без фреймворка | `attachDesktop` напрямую |
| чтобы связкой управлял жизненный цикл фреймворка | соответствующий адаптер |
| несколько рабочих столов на одной странице | по менеджеру и биндеру на каждый рабочий стол |
| рабочий стол рендерит один фреймворк, а окна — другой | общий для них `createDesktopBinder` |
| вообще без DOM (тесты, SSR, нативный рендерер) | только `createWindowManager` |
