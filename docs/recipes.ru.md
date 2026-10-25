# Рецепты

Рабочие паттерны для того, что обычно строят на оконном менеджере. Все сниппеты не зависят от фреймворка, если не сказано обратное.

- [Таскбар](#таскбар)
- [Анимация сворачивания в таскбар](#анимация-сворачивания-в-таскбар)
- [Модальные диалоги](#модальные-диалоги)
- [Персист и миграции](#персист-и-миграции)
- [Рабочие пространства](#рабочие-пространства)
- [Окна с фиксированными пропорциями](#окна-с-фиксированными-пропорциями)
- [Свои раскладки снэпа](#свои-раскладки-снэпа)
- [Жест одним шагом отмены](#жест-одним-шагом-отмены)
- [Контекстное меню в заголовке окна](#контекстное-меню-в-заголовке-окна)
- [Реакция только на одно окно](#реакция-только-на-одно-окно)
- [Серверный рендеринг](#серверный-рендеринг)
- [Тестирование](#тестирование)
- [Производительность](#производительность)

## Таскбар

`minimized()` возвращает свёрнутые окна активного рабочего пространства в порядке открытия — ровно в том порядке, в каком они стоят в таскбаре.

```js
function renderTaskbar() {
  taskbar.replaceChildren(
    ...wm.minimized().map((win) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.task = win.id
      button.textContent = win.title
      button.addEventListener('click', () => wm.focus(win.id))
      return button
    }),
  )
}

wm.subscribe(renderTaskbar)
renderTaskbar()
```

`wm.focus(id)` на свёрнутом окне восстанавливает его в ту стадию, в которой оно было до этого, — развёрнутые окна возвращаются развёрнутыми. А если окно живёт на другом рабочем пространстве, он ещё и переключит пространство, так что глобальный список «все окна» работает без лишнего кода.

## Анимация сворачивания в таскбар

Направьте `minimizeTarget` на элемент, в который окно должно улетать. Верните `null`, чтобы пропустить анимацию для конкретного окна.

```js
attachDesktop(wm, desktopEl, {
  minimizeTarget: (win) => taskbar.querySelector(`[data-task="${win.id}"]`) ?? taskbar,
})
```

Контроллер запускает `flipToTarget` при сворачивании и `flipFromTarget` при восстановлении, используя одноразовый призрак, так что ваш контент никогда не переносится и не перерендеривается. При reduced motion обе функции ничего не делают.

## Модальные диалоги

Открывайте с `layer: 'modal'`. Менеджер блокирует фокус всего, что лежит ниже, и испускает `modalblocked`; DOM-слой отклоняет ввод указателем (перетаскивание, ресайз, клики, action-атрибуты) на нижних окнах, мигает модалкой и запирает Tab внутри неё.

```js
const confirm = wm.open({
  id: 'confirm',
  title: 'Delete file?',
  layer: 'modal',
  width: 360,
  height: 180,
  closable: false,
})

wm.on('modalblocked', ({ window: modal }) => {
  console.log('user tried to reach past', modal.id)
})
```

Заметки:

- `floating` — вариант помягче: всегда поверх, но ничего не блокирует.
- Ловушке нужно что-то фокусируемое внутри окна; дайте диалогу кнопку.
- Программные вызовы никогда не блокируются — `wm.close('confirm')` срабатывает всегда, так диалог и закрывают.
- `maximize`, `snap`, `restore` и остальные вызовы смены стадии, которые фокусируют окно, выводят вперёд его рабочее пространство, но молча пропускают фокус, пока его блокирует модалка; `modalblocked` означает именно заблокированный вызов `focus()`.
- Окно, ставшее верхней модалкой через `update(…, { layer })` или `moveToWorkspace`, забирает фокус; если понизить модалку в фокусе, фокус перейдёт к следующей видимой модалке.

## Персист и миграции

```js
import { persist } from '@surdeddd/wmkit/persist'

const store = persist(wm, {
  key: 'my-app-desktop',
  version: 2,
  autoRestore: false,
  migrate: (state, from) => (from === 1 ? upgradeV1(state) : null),
})
```

По умолчанию плагин сам восстанавливает состояние при создании (`autoRestore: false` выше оставляет это вам — причина ниже), а затем сохраняет с debounce на каждое изменение; отложенное сохранение сбрасывается на `pagehide` и при `destroy()`, а `clear()` вдобавок отменяет отложенное сохранение. Данные заворачиваются в `{ version, state }`; данные другой версии проходят через `migrate`, а возврат `null` их отбрасывает, вместо того чтобы восстановить что-то сломанное. Успешная миграция сразу записывается обратно.

Вторая половина — восстановить то, что вы рендерили: `hydrate` испускает `open` для каждого появившегося окна, так что монтированием можно управлять целиком через события. Регистрируйте слушатель до восстановления: при `autoRestore` по умолчанию `persist` гидратирует при создании, когда вашего слушателя ещё нет, а повторный `restore()` тех же данных ничего не испускает:

```js
wm.on('open', ({ window: win }) => {
  if (!mounted.has(win.id)) mount(win)
})
store.restore()
```

Во время `hydrate` геометрия пересчитывается под текущий вьюпорт, так что рабочий стол, сохранённый на 27-дюймовом мониторе и восстановленный на ноутбуке, возвращается в пределы экрана: развёрнутые окна снова заполняют его, прилепленные заново прилепляются к своим зонам, а обычные прижимаются так, чтобы их тайтлбары оставались досягаемыми.

## Полоска вкладок для сгруппированных окон

Группировка headless: менеджер решает, кто видим, а полоску рендерите вы. Всё нужное лежит в `state.groups`.

```js
function renderTabs(windowEl, id) {
  const state = wm.getState()
  const win = state.windows[id]
  const group = win?.groupId ? state.groups[win.groupId] : undefined
  const strip = windowEl.querySelector('.tabs')
  if (!group) {
    strip.replaceChildren()
    return
  }
  strip.replaceChildren(
    ...group.members.map((memberId) => {
      const tab = document.createElement('button')
      tab.type = 'button'
      tab.textContent = state.windows[memberId]?.title ?? memberId
      tab.setAttribute('aria-selected', String(group.activeId === memberId))
      tab.addEventListener('click', () => wm.activateTab(memberId))
      return tab
    }),
  )
}

wm.subscribe(() => {
  for (const [id, el] of mounted) renderTabs(el, id)
})
```

Не вешайте жест «оторвать эту вкладку» на `dblclick`. Активация вкладки меняет участника, которого показывает DOM-слой, поэтому два клика попадают в два разных элемента, и браузер перенаправляет `dblclick` на общего предка — обычно на тайтлбар, чей собственный обработчик двойного клика вместо этого переключает разворот. Отрывайте вкладку перетаскиванием указателем или явной кнопкой на вкладке.

Порядок в `group.members` — это порядок вкладок, и меняет его только `moveTab`: фокус на участнике, подъём рамки или отправка её назад его не трогают. Поэтому полоску безопасно рендерить прямо из `members` и строить ключи DOM по этому порядку:

```js
tab.addEventListener('keydown', (event) => {
  const members = wm.getState().groups[groupId].members
  const at = members.indexOf(memberId)
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const step = event.key === 'ArrowRight' ? 1 : -1
  if (event.ctrlKey || event.metaKey) wm.moveTab(memberId, at + step)
  else wm.cycleTab(step)
})
```

Дайте полоске `role="tablist"`, каждой кнопке — `role="tab"` и ведите roving `tabindex`: `0` на показанной вкладке, `-1` на остальных, — чтобы вся группа занимала одну остановку в порядке Tab на странице.

DOM-слой сам скрывает неактивных участников и размечает элементы: `data-wm-group` несёт id группы, а `data-wm-tab` равен `active` или `inactive`, так что тема может стилизовать рамку без всякого JavaScript.

Если ненадолго задержать один тайтлбар над другим, два окна сгруппируются. Пауза важна: без неё любое перетаскивание, которое случайно закончилось над тайтлбаром соседа, проглатывало бы окно. Задержка по умолчанию — 420 мс, настраивается через `grouping: { dwell: 250 }`. Пока жест взведён, на цели стоит `data-wm-tab-target`:

```css
[data-wm-tab-target] {
  outline: 2px dashed var(--wm-accent);
  outline-offset: -2px;
}
```

Выключите жест через `attachDesktop(wm, el, { grouping: false })` и вызывайте `group()` и `ungroup()` из своего интерфейса.

## Рабочие пространства

```js
wm.open({ id: 'mail', title: 'Mail' })                 // активное рабочее пространство
wm.open({ id: 'build', title: 'Build log', workspace: 1 })

wm.setWorkspace(1)          // 'mail' теперь скрыто, 'build' в фокусе
wm.moveToWorkspace('mail', 1)
wm.focus('build')           // вернёт на пространство 1, если вы с него ушли
```

Окна вне активного рабочего пространства получают `hidden`, не фокусируются и исключаются из `cycleFocus`, `minimized()`, `arrange()`, `minimizeAll()` и магнетизма при перетаскивании. Всё остальное — геометрия, история, сериализация — обращается с ними как обычно. Рендерите переключатель из `wm.getState().workspace` и помечайте пространства, в которых есть окна:

```js
const populated = new Set(Object.values(wm.getState().windows).map((win) => win.workspace))
```

## Окна с фиксированными пропорциями

```js
wm.open({ id: 'player', title: 'Player', width: 640, aspectRatio: 16 / 9 })
wm.update('player', { aspectRatio: null })   // снять фиксацию
```

Пропорция соблюдается при открытии, при `resize` и при `update`. При ресайзе указателем ведущая ось — тот край, за который вы взялись: северная и южная ручки ведут высоту, все остальные — ширину, так что окно следует за курсором, а не борется с ним. `minSize` и `maxSize` всё равно главнее — если коробка не может соблюсти пропорцию, вы получите ближайший допустимый размер.

## Свои раскладки снэпа

`zoneBounds` и `detectSnapZone` экспортируются, так что выбор раскладки можно собрать, не трогая код перетаскивания.

```js
import { zoneBounds } from '@surdeddd/wmkit'

const ZONES = ['left-third', 'center-third', 'right-third']

ZONES.forEach((zone) => {
  const button = document.createElement('button')
  button.textContent = zone
  button.addEventListener('click', () => {
    const id = wm.getState().focusedId
    if (id) wm.snap(id, zone)
  })
  pad.append(button)
})
```

Чтобы изменить, что происходит при перетаскивании к краю, используйте опции `snap`: `threshold` и `cornerSize` двигают горячие зоны, `topEdge: 'top' | 'none'` меняет поведение при перетаскивании к верхнему краю, `preview: false` убирает призрак, а `snap: false` выключает всё целиком. Для фиксированной сетки выключите снэп и сами вызывайте `restoreTo` из события `move`.

## Жест одним шагом отмены

Перетаскивание и ресайз уже схлопываются в одну запись истории. Сделайте то же для своих жестов:

```js
wm.beginInteraction()
for (const id of selection) wm.moveBy(id, dx, dy)
wm.endInteraction()          // один шаг отмены на всю группу
```

Если пользователь отменяет, `abortInteraction()` завершает взаимодействие *и* выбрасывает созданную им запись, так что Escape не оставляет следа в истории. `clearHistory()` внутри `batch` начинает историю заново с этого вызова, а последующие изменения в том же батче откатываются обратно до него; внутри жеста остаток жеста не записывается, а `abortInteraction()` возвращает то, что было очищено. `batch(fn)` — эквивалент без жеста: одно уведомление `change` и одна запись истории на серию вызовов.

## Контекстное меню в заголовке окна

```js
attachDesktop(wm, desktopEl, {
  onTitlebarContextMenu: (win, event) => {
    showMyMenu(event.clientX, event.clientY, [
      { label: 'Send to back', run: () => wm.sendToBack(win.id) },
      { label: 'Centre', run: () => wm.center(win.id) },
      { label: 'Move to desktop 2', run: () => wm.moveToWorkspace(win.id, 1) },
      { label: 'Close', run: () => wm.close(win.id) },
    ])
  },
})
```

Хук срабатывает на правый клик и на долгое нажатие, а нативное меню подавляется за вас.

## Реакция только на одно окно

`subscribe` срабатывает на каждое изменение рабочего стола. Когда вас интересует только одно окно, сравнивайте по ссылке — у неизменившихся окон остаётся тот же объект:

```js
let last = wm.get(id)
const stop = wm.subscribe(() => {
  const next = wm.get(id)
  if (next === last) return
  last = next
  render(next)
})
```

Именно так устроены `useWmWindow` и `wmWindowStore`, и именно поэтому рабочий стол на пятьдесят окон перерендеривает один компонент, когда двигается одно окно.

## Вынос React-окна на другой монитор

Узел, который отрендерил React, теряет свои обработчики при переносе в другой документ, потому что React слушает события на собственном корне. Оставьте контент на месте и отрендерите его копию в popout через портал:

```tsx
import { createPortal } from 'react-dom'
import { popout, type PopoutHandle } from '@surdeddd/wmkit/popout'

function PopoutButton({ wm, id, children }: { wm: WindowManager; id: string; children: ReactNode }) {
  const [handle, setHandle] = useState<PopoutHandle | null>(null)
  const open = async (event: MouseEvent<HTMLButtonElement>) => {
    const root = event.currentTarget.closest<HTMLElement>('[data-wm-content]') as HTMLElement
    const next = await popout(wm, id, root, { mode: 'container', target: 'window', screen: 'other' })
    setHandle(next)
    void next.closed.then(() => setHandle(null))
  }
  return handle ? createPortal(children, handle.container) : <button onClick={open}>pop out</button>
}
```

`mode: 'container'` оставляет исходный узел на месте и отдаёт пустой `container` в popout; портал рендерит туда, и собственная система событий React остаётся целой. `closed` завершается, когда пользователь закрывает popout или окно закрывается в менеджере.

## Серверный рендеринг

`src/core` никогда не трогает `window` или `document`. Создайте менеджер на сервере, гидратируйте сохранённую раскладку, сериализуйте её в данные страницы и подключайте DOM-слой только после монтирования.

```js
// сервер
const wm = createWindowManager({ viewport: { width: 0, height: 0 } })
wm.hydrate(savedLayout)
const payload = wm.serialize()

// клиент, после монтирования
const wm = createWindowManager()
wm.hydrate(payload)
attachDesktop(wm, desktopEl)   // ResizeObserver выставит настоящий вьюпорт, геометрия пересчитается
```

Вьюпорт `0 × 0` на сервере держит ограничение по вьюпорту выключенным, поэтому ничего не втискивается во вьюпорт, который вам ещё неизвестен. `persist` читает хранилище внутри `try`/`catch` и ничего не делает, когда хранилища нет.

## Тестирование

Ядро — простой объект без DOM, поэтому юнит-тестам не нужно окружение:

```js
import { createWindowManager } from '@surdeddd/wmkit'

const wm = createWindowManager({ viewport: { width: 1000, height: 800 } })
const win = wm.open({ title: 'Test' })
wm.snap(win.id, 'left')
expect(wm.get(win.id).bounds).toEqual({ x: 0, y: 0, width: 500, height: 800 })
```

jsdom сообщает `clientWidth` и `clientHeight` равными 0, поэтому при включённом `autoViewport` вьюпорт, выставленный при монтировании, игнорируется и остаётся тот, что передан в конструктор: в тестах под jsdom передавайте `viewport` в `createWindowManager`.

Для DOM-поведения гоняйте настоящие события указателя — библиотека использует захват указателя, так что синтетические события мыши не подойдут. В Playwright:

```js
const box = await handle.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(target.x, target.y, { steps: 16 })
await page.mouse.up()
```

Дожидайтесь анимаций, прежде чем проверять геометрию, и помните, что магнетизм может сдвинуть конечную позицию на величину вплоть до порога, — проверяйте с допуском или передайте `magnetism: false` в фикстуре.

## Производительность

Значения по умолчанию — уже быстрый путь: позиционирование только через `transform`, ввод указателя батчится в один `requestAnimationFrame`, состояние использует structural sharing, а прямоугольник рабочего стола кэшируется на время жеста.

Что всё ещё зависит от вас:

- **Батчьте массовую работу.** `wm.batch(() => { for (…) wm.open(…) })` превращает пятьдесят открытий в одно уведомление, один перерендер и один проход layout.
- **Подписывайтесь узко.** Подписки на отдельные окна выгоднее перерендера всего списка.
- **Держите контент лёгким во время перетаскивания.** На элементе стоит `[data-wm-dragging]` — используйте его, чтобы ставить на паузу дорогие эффекты.
- **Не анимируйте `transform` в своей теме во время жеста.** Встроенные темы уже выключают переход; своя тема должна делать то же самое.


## Окно с нуля

`@surdeddd/wmkit/chrome` превращает строку разметки в скин. Подстановки: `{{title}}`, `{{id}}`, `{{stage}}`, `{{layer}}`, `{{workspace}}` и `{{variant}}`; каждая подстановка экранируется как HTML, так что заголовок окна никогда не протащит разметку в окружающую его обвязку. Подстановка может стоять только в тексте или в значении в кавычках у `aria-*`, `data-*`, `title`, `alt`, `class`, `id`, `role`, `lang`, `dir`, `for`, `value`, `placeholder` или `label`; в любом другом месте `skin()` бросает ошибку. За дальнейшими изменениями состояния следует только `{{title}}` внутри `[data-wm-title]`, все остальные подстановки рендерятся при монтировании или пересборке, поэтому `aria-label="Close {{title}}"` ниже хранит тот заголовок, который был у окна в момент монтирования.

```js
import { attachDesktop } from '@surdeddd/wmkit'
import { skin } from '@surdeddd/wmkit/chrome'

const brutal = skin({
  name: 'brutal',
  styles: '[data-wm-skin="brutal"] { border: 3px solid #111 }',
  template: `
    <section>
      <header data-wm-drag>
        <span data-wm-title>{{title}}</span>
        <button type="button" data-wm-to-workspace="1" aria-label="Send to workspace 2">→</button>
        <button type="button" data-wm-close aria-label="Close {{title}}">×</button>
      </header>
      <div data-wm-content></div>
    </section>
  `,
})

const desktop = attachDesktop(wm, root, { skins: { brutal } })
wm.open({ id: 'notes', title: 'Notes' })
const notes = desktop.mountWindow('notes', 'brutal')
notes.content.append(myApp)
```

Кнопкам не нужны обработчики: `data-wm-close` и соседние атрибуты читает контроллер. Каждый `skin()` владеет одним `<style data-wm-skin-styles="brutal">` на документ, который удаляется, когда уходит последнее окно в этом скине, — окно несёт `data-wm-skin="brutal"`, так что вашим правилам есть за что зацепиться.

Шаблон должен содержать ровно один атрибут `[data-wm-content]` и один корневой элемент; всё остальное бросает ошибку ещё при написании скина (или при монтировании, если корней несколько), а не молча теряет ваше приложение.

### Изоляция

`shadow: true` собирает обвязку внутри открытого теневого корня. Ваш контент — это собственный элемент `[data-wm-content]` шаблона, перенесённый в light DOM и спроецированный через `<slot>`, поставленный на его место, так что теневой CSS достаёт до него как `::slotted([data-wm-content])`. CSS страницы не проникает внутрь, собственный CSS окна не протекает наружу, а стили становятся одной constructable stylesheet, общей для всех окон этого скина.

```js
import { themeStyle } from '@surdeddd/wmkit/themes'

const sealed = skin({
  name: 'sealed',
  shadow: true,
  styles: themeStyle('carbon', { shadow: true }),
  template: TEMPLATE,
})
```

Передайте `{ shadow: true }`, иначе тема придёт с токенами, но без единого правила, — почему, см. в [docs/theming.ru.md](theming.ru.md). Внутри теневого корня пишите `:host` там, где написали бы селектор окна. Корневой элемент шаблона разворачивается, так что `:host` — это бокс, в котором лежат тайтлбар и контент. Группировка перетаскиванием, модальная ловушка фокуса и ручки ресайза продолжают работать через границу; доступное имя переключается с `aria-labelledby` на `aria-label`, потому что IDREF через неё не проходит.

## Тач-жесты

Жесты подключаются по желанию: в ядре их нет, а `@surdeddd/wmkit/gestures` стоит 1.61 кБ, только если вы его импортируете. Оба жеста реагируют только на `pointerType === 'touch'`, поэтому поведение мыши и пера не меняется, и оба живут за одним слушателем на элементе рабочего стола.

- **Пинч меняет размер окна.** Два пальца на одном окне масштабируют его вокруг точки между ними. Собственные `minSize`, `maxSize` и `aspectRatio` окна по-прежнему главные, а опорная точка выводится из ограниченного размера, так что точка под пальцами остаётся на месте даже на пределе. Весь пинч — один шаг отмены; `Escape` или отменённый указатель возвращают начальную геометрию. Пока он идёт, на элементе стоит `data-wm-pinching`.
- **Свайп двумя пальцами вбок переключает рабочее пространство.** Он работает и над окном, и над пустым рабочим столом — это важно на телефоне, где окна закрывают всё. Жест засчитывается, когда пальцы проходят `threshold` пикселей по горизонтали и этот путь более чем вдвое больше вертикального смещения.

Они никогда не конфликтуют: побеждает тот, кто первым перешагнёт свой порог, и ни один не стартует, пока указателем уже владеет перетаскивание или ресайз.

```js
import { touchGestures } from '@surdeddd/wmkit/gestures'

attachDesktop(wm, root, {
  gestures: [touchGestures({ pinch: { threshold: 16 }, swipe: { workspaces: 4 } })],
})
```

Импортируйте `pinch()` или `swipe()` по отдельности, если нужен только один из них.

Одна оговорка, которую стоит знать. Браузер отдаст вам события указателя от двух пальцев, только если элемент не отдаёт жест странице раньше, поэтому любой двухпальцевый жест (пинч или свайп) ставит на рабочий стол `touch-action: pan-x pan-y`, а при уничтожении возвращается исходное значение, — контент по-прежнему скроллится, но собственный пинч-зум браузера больше не перехватывает жест. Если ваши окна никогда не скроллятся, `lockTouchAction: true` усиливает это до `touch-action: none`.
