# Справочник API

Всё, что экспортируют `@surdeddd/wmkit` и его подпути. Типы — настоящие, из `src/core/types.ts` и `src/dom/shared.ts`.

- [Основные типы](#основные-типы)
- [createWindowManager](#createwindowmanageroptions)
- [Методы WindowManager](#методы-windowmanager)
- [События](#события)
- [attachDesktop](#attachdesktopwm-element-options)
- [createDesktopBinder](#createdesktopbinderwm-options)
- [Хелперы геометрии](#хелперы-геометрии)
- [Хелперы анимации](#хелперы-анимации)
- [Announcer](#announcer)
- [Emitter](#emitter)
- [persist](#persistwm-options--surdedddwmkitpersist)
- [popout](#popoutwm-id-content-options--surdedddwmkitpopout)
- [devtools](#createdevtoolswm-options--surdedddwmkitdevtools)

## Основные типы

```ts
interface Size {
  width: number
  height: number
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

type WindowStage = 'normal' | 'minimized' | 'maximized' | 'snapped'
type WindowLayer = 'normal' | 'floating' | 'modal'
type ArrangeMode = 'cascade' | 'tile'

type SnapZone =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'left-third' | 'center-third' | 'right-third'

interface WindowFlags {
  draggable: boolean
  resizable: boolean
  closable: boolean
  minimizable: boolean
  maximizable: boolean
  snappable: boolean
}
```

Флаги — рекомендательное состояние: DOM-слой отказывает в соответствующем жесте, а программный API всегда вас слушается. `wm.close(id)` закрывает окно с `closable: false` намеренно — флаг существует, чтобы останавливать пользователя, а не ваш код.

`WindowGroup`, `HistoryEntry`, `SerializedWindowState`, `SerializedMaxSize` и `WindowUpdate` тоже экспортируются как типы.

### WindowState

Каждое поле JSON-безопасно. Объекты заменяются, а не мутируются, поэтому `previous === next` — корректная проверка «ничего не изменилось».

```ts
interface WindowState extends WindowFlags {
  id: string
  title: string
  bounds: Bounds
  restoreBounds: Bounds | null   // geometry to return to from maximized/snapped
  restoreStage: WindowStage | null // stage to return to from minimized
  stage: WindowStage
  snapZone: SnapZone | null
  snapRect: Bounds | null        // snapTo target in viewport fractions; kept while maximized
  layer: WindowLayer
  workspace: number
  groupId: string | null          // the tab group it belongs to
  minSize: Size
  maxSize: Size | null           // Infinity on an axis means unbounded
  aspectRatio: number | null     // width / height
  openedSeq: number              // monotonic; taskbar ordering
  meta: Record<string, unknown>  // yours, merged on update, serialized
}
```

### WindowInit

```ts
interface WindowInit extends Partial<WindowFlags> {
  id?: string          // generated as `${idPrefix}-${n}` when omitted or empty; duplicates throw
  title?: string       // 'Window'
  x?: number           // cascades when x or y is omitted
  y?: number
  width?: number       // defaultSize.width
  height?: number      // defaultSize.height
  minWidth?: number    // 160
  minHeight?: number   // 100
  maxWidth?: number
  maxHeight?: number
  aspectRatio?: number // ignored unless finite and > 0
  stage?: WindowStage  // 'snapped' is downgraded to 'normal' (no zone to snap to yet)
  layer?: WindowLayer
  workspace?: number   // active workspace; non-integers and negatives fall back
  meta?: Record<string, unknown>
}
```

### ManagerState

```ts
interface ManagerState {
  windows: Readonly<Record<string, WindowState>>
  order: readonly string[]   // back to front, sorted by layer
  focusedId: string | null
  viewport: Size
  workspace: number
  groups: Readonly<Record<string, WindowGroup>>   // see Tab groups
  extensions: Readonly<Record<string, unknown>>   // plugin state, see setExtension
}
```

`getState()` возвращает закэшированный объект, который заменяется при каждом изменении, так что проверки `!==` достаточно, чтобы понять, что что-то произошло. id окна может быть любой строкой, включая `constructor` и `__proto__`: у `windows` нулевой прототип, поэтому читайте его через `Object.keys`, `in` или `Object.hasOwn`, а не через `windows.hasOwnProperty`.

### SerializedState

```ts
interface SerializedState {
  version: 1
  windows: SerializedWindowState[]   // WindowState with maxSize as { width: number | null; height: number | null } | null
  order: string[]
  focusedId: string | null
  workspace: number
  activeTabs: Record<string, string>   // group id -> id of its visible member
  extensions?: Record<string, unknown> // always written; optional on read
}
```

`hydrate()` проверяет данные и вместо исключения возвращает `false`: неверная `version`, `windows` не в виде массива, повторяющиеся id, отсутствующий `bounds` или неизвестные `stage`/`layer` отклоняют весь снапшот целиком. Неизвестные поля отдельных окон заменяются значениями по умолчанию, а не отклоняются. Корректный снапшот сохраняет геометрию как есть, `meta` копируется, а участники групп заново синхронизируются со своей активной вкладкой (запись `activeTabs`, которая не называет ни одного участника, откатывается к первому участнику группы). `focusedId: null` оставляет рабочий стол без фокуса; к верхнему окну откатывается только отсутствующий или некорректный id.

## `createWindowManager(options?)`

Чистая машина состояний. Её безопасно создавать во время SSR.

```ts
interface ManagerOptions {
  viewport?: Size                      // { width: 0, height: 0 } — clamping is off until set
  keepInViewport?: boolean             // true
  minVisible?: number                  // 48 — visible strip kept reachable
  defaultSize?: Size                   // { width: 480, height: 320 }
  cascadeOffset?: number               // 32
  cascadeOrigin?: { x: number; y: number } // { x: 32, y: 32 }
  idPrefix?: string                    // 'wm'
  historyLimit?: number                // 50; 0 disables undo/redo
  workspace?: number                   // 0
}
```

Пока `viewport` равен нулевому значению по умолчанию, `clampToViewport` ничего не делает — поэтому менеджер, гидратированный до монтирования, сохраняет записанную геометрию, а первый `setViewport()` (обычно от `ResizeObserver` контроллера) пересчитывает всё. Пока вьюпорт неизвестен, `maximize` и `open({ stage: 'maximized' })` сохраняют собственную рамку окна, и отмена, повтор и гидратация тоже не пересчитывают геометрию. Под jsdom `clientWidth`/`clientHeight` равны 0, поэтому при включённом `autoViewport` вызов `setViewport` при монтировании игнорируется и остаётся вьюпорт из конструктора: в тестах передавайте `viewport` в `createWindowManager`.

## Методы WindowManager

### Жизненный цикл

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `open(init?)` | `WindowState` | бросает исключение при повторяющемся id; выстраивает каскадом, если `x`/`y` не заданы; фокусирует, если окно не свёрнуто и не на другом рабочем пространстве |
| `close(id)` | `boolean` | `false` для неизвестных id; фокус переходит к следующему подходящему окну |
| `closeAll()` | `void` | все рабочие пространства, одна транзакция |
| `destroy()` | `void` | снимает всех слушателей; объект состояния остаётся пригодным к использованию |

### Фокус и порядок

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `focus(id)` | `boolean` | сначала переключается на рабочее пространство окна; восстанавливает окно, если оно свёрнуто; `false`, когда его блокирует модалка (испускает `modalblocked`). Испускает `focus`, только когда меняется `focusedId`; фокус на уже сфокусированном окне только поднимает его |
| `blur()` | `void` | сбрасывает `focusedId`, не трогая порядок |
| `cycleFocus(direction?)` | `string \| null` | `1` (по умолчанию) или `-1`, по кругу, пропускает свёрнутые окна и другие рабочие пространства. `1` поднимает самое нижнее фокусируемое окно; `-1` отправляет окно в фокусе в самый низ его слоя и фокусирует то, что теперь сверху, так что направления отменяют друг друга и оба обходят все окна |
| `sendToBack(id)` | `boolean` | в самый низ полосы собственного слоя окна; передаёт фокус дальше, если окно было в фокусе |

### Стадия

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `minimize(id)` | `boolean` | запоминает стадию, из которой пришло окно |
| `maximize(id)` | `boolean` | заполняет вьюпорт; сохраняет геометрию в `restoreBounds` |
| `toggleMaximize(id)` | `boolean` | разворачивает или восстанавливает, если окно уже развёрнуто |
| `restore(id)` | `boolean` | из свёрнутого возвращает в запомненную стадию (окно, которое возвращается в `normal`, заново прижимается к вьюпорту, когда включён `keepInViewport`); из развёрнутого или прилепленного возвращает к `restoreBounds`, заново ограниченным по min/max и вьюпорту, — кроме развёрнутого окна со `snapRect`: оно возвращается к этому прямоугольнику |
| `restoreTo(id, bounds)` | `boolean` | принудительно ставит `normal` с явной геометрией; используется при отрыве окна из снэпа перетаскиванием |
| `snap(id, zone)` | `boolean` | геометрия зоны, ограниченная собственными min/max окна |
| `snapTo(id, rect)` | `boolean` | прилепляет к любому прямоугольнику, заданному в долях вьюпорта (`{ x: 0.5, y: 0, width: 0.5, height: 1 }` — правая половина); следует за изменениями вьюпорта, как зона, а первый кадр перетаскивания отрывает окно. В отличие от `snap`, не фокусирует и не поднимает окно. На нём построен плагин dock |

`maximize`, `snap`, `restore`, `restoreTo`, `group` и `ungroup` фокусируют окно так же, как `focus()`: сначала переключаются на его рабочее пространство, даже если на текущем открыта модалка. Когда окно блокирует модалка, они молча пропускают фокус и не испускают `modalblocked` — это событие означает заблокированный вызов `focus()`.

### Геометрия

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `move(id, x, y)` | `boolean` | только в стадии `normal`; `true`, когда из-за ограничения перемещение ничего не изменило |
| `moveBy(id, dx, dy)` | `boolean` | относительный `move` |
| `center(id)` | `boolean` | центрирует окно в стадии `normal` во вьюпорте |
| `resize(id, patch)` | `boolean` | `Partial<Bounds>`; отлепляет прилепленное окно; соблюдает `aspectRatio`, ведущей считается ось, которая изменилась сильнее |
| `update(id, patch)` | `boolean` | заголовок, слой, min/max-размер, `aspectRatio`, флаги, `meta` (поверхностное слияние). Патч, который ставит уже имеющиеся у окна значения, ничего не делает: тот же объект, ни событий, ни записи в истории. Примитивы сравниваются по значению; новый объект `meta`, `minSize` или `maxSize` всегда считается изменением. Смена ограничений прилепленного окна пересчитывает его зону |
| `setViewport(size)` | `void` | пересчитывает геометрию развёрнутых и прилепленных окон, остальные прижимает; никогда не пишется в историю; размер с нулевым или отрицательным измерением (скрытый рабочий стол) игнорируется, и остаётся последний известный вьюпорт |

### Рабочие пространства

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `workspace()` | `number` | активный индекс |
| `setWorkspace(n)` | `boolean` | `false`, если ничего не изменилось или значение некорректно; заново фокусирует верхнее окно целевого пространства |
| `moveToWorkspace(id, n)` | `boolean` | `false` для неизвестных id или перемещения, которое ничего не меняет |

Окна вне активного рабочего пространства DOM-слой скрывает, а `focusTargets`, `minimized()`, `arrange()`, `minimizeAll()` и магнетизм при перетаскивании их пропускают.

### Группы вкладок

Несколько окон могут делить одну рамку. Участники сохраняют собственную идентичность, контент и заголовок, но геометрия у них общая; видим всегда ровно один участник, а остальные ведут себя как скрытые окна.

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `group(ids)` | `string \| null` | `null`, если известных окон меньше двух; первый id — хост, чью геометрию и стадию перенимает группа, и он становится активной вкладкой. Окна, которые уже состоят в группе, приводят с собой всю свою группу |
| `ungroup(id)` | `boolean` | отсоединяет одного участника, остальные остаются в `order` подряд (испускает `order`); группа, в которой остался один участник, распадается целиком |
| `activateTab(id)` | `boolean` | делает участника видимой вкладкой; `false`, если он уже активен или не в группе. Фокус следует за вкладкой, но только если скрывающийся участник был окном в фокусе |
| `moveTab(id, index)` | `boolean` | переносит участника на другое место в порядке вкладок; индекс ограничивается, а `false` значит, что ничего не сдвинулось. Активная вкладка, фокус и геометрия остаются на месте |
| `cycleTab(direction?)` | `string \| null` | активирует следующую (`1`) или предыдущую (`-1`) вкладку группы окна в фокусе, по кругу; `null`, если окно в фокусе не в группе |
| `groupMembers(groupId)` | `readonly WindowState[]` | участники в порядке вкладок (сзади наперёд) |

```ts
const groupId = wm.group(['editor', 'preview', 'console'])
wm.activateTab('preview')
wm.groupMembers(groupId).map((win) => win.title)
wm.ungroup('console')
```

Инварианты, которые менеджер поддерживает за вас:

- у всех участников общие `bounds`, `stage`, `snapZone`, `layer` и `workspace` — перемещение, ресайз, снэп, разворот или перенос группы на другое рабочее пространство двигают всю группу за один шаг
- неактивные вкладки пропускаются `focus`, `cycleFocus`, `minimized()`, `arrange()`, `minimizeAll()`, перераскладкой под вьюпорт и магнетизмом при перетаскивании — точно так же, как окна на другом рабочем пространстве; группа считается одной рамкой, которой управляет её видимая вкладка
- развёрнутая группа заполняет вьюпорт точно, без учёта ограничений участников, как одиночное развёрнутое окно
- в остальных случаях размер рамки подбирается так, чтобы удовлетворять `minSize` и `maxSize` каждого участника, а не только хоста, — в том числе при последующих перемещениях, ресайзах и сменах стадии, так что ресайз одной вкладки может увеличить рамку, вместо того чтобы загнать соседа ниже его собственного минимума. События `resize` и `update` несут рамку, которую группа приняла на самом деле, а это не всегда та, которую вы просили
- `focus(id)` на неактивной вкладке сначала активирует её, поэтому DOM-фокус никогда не попадает на скрытый элемент; фокус, в котором отказала модалка, оставляет активную вкладку нетронутой
- участники идут в `order` подряд, поэтому переключение вкладок никогда не меняет место рамки в стопке, а порядок вкладок — ваш: фокус, подъём или отправка рамки назад никогда его не перемешивают, это делает только `moveTab`
- закрытие активной вкладки передаёт активность соседу; закрытие предпоследнего участника распускает группу
- когда изменение скрывает окно в фокусе — сворачивание рамки через скрытого участника, перенос её на другое рабочее пространство, — фокус откатывается к самому верхнему окну, до которого ещё можно добраться

`ManagerState.groups` показывает текущую картину — из неё и рендерится полоска вкладок:

```ts
interface WindowGroup {
  id: string
  activeId: string
  members: readonly string[]
}
```

Событие `group` срабатывает при создании, активации и изменении состава, в том числе когда участник закрывается и когда группа распадается (`members: []`, `activeId: ''`), с данными `{ groupId, members, activeId, previous }`.

### История

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `undo()` / `redo()` | `boolean` | `false`, когда стек пуст |
| `canUndo()` / `canRedo()` | `boolean` | |
| `clearHistory()` | `void` | оба стека. Внутри `batch` история начинается заново с этого вызова, и последующие изменения в том же батче откатываются обратно до него. Во время жеста остаток этого жеста не записывается, а `abortInteraction()` восстанавливает историю такой, какой она была до жеста, и тем самым возвращает очищенное |
| `beginInteraction()` / `endInteraction()` | `void` | схлопывают жест в одну запись; допускают вложенность |
| `abortInteraction()` | `void` | завершает взаимодействие и выбрасывает созданную им запись — для отменённых жестов |

`hydrate()` и `loadLayout()` очищают историю: отменить действия сквозь восстановление нельзя. Отмена или повтор во время взаимодействия делает остаток жеста новым шагом и очищает стек повтора.

### Раскладки и упорядочивание

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `saveLayout(name)` | `SerializedState` | снапшот, сохранённый под `name` и возвращённый |
| `loadLayout(name)` | `boolean` | `false`, если имя неизвестно |
| `getLayout(name)` | `SerializedState \| undefined` | изолированная копия |
| `setLayout(name, data)` | `boolean` | проверяет данные так же, как `hydrate` |
| `deleteLayout(name)` / `layoutNames()` | `boolean` / `string[]` | |
| `arrange(mode)` | `void` | `'cascade'` выстраивает лесенкой от `cascadeOrigin`; `'tile'` заполняет сетку `ceil(sqrt(n))`; оба пропускают свёрнутые окна и другие рабочие пространства |
| `minimizeAll()` / `restoreAll()` | `void` | активное рабочее пространство, одна запись истории |

Раскладки хранятся в памяти. Сохраняйте их сами через `getLayout`/`setLayout` или используйте плагин persist для живого рабочего стола.

### Чтение и подписка

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `get(id)` | `WindowState \| undefined` | |
| `getState()` | `ManagerState` | кэшируется до следующего изменения |
| `minimized()` | `readonly WindowState[]` | активное рабочее пространство, по `openedSeq` — порядок таскбара |
| `serialize()` | `SerializedState` | |
| `hydrate(data)` | `boolean` | испускает `open`/`close` для разницы (и `focus`, когда фокус сдвигается), пересчитывает геометрию под вьюпорт |
| `subscribe(fn)` | `() => void` | один вызов на каждую зафиксированную транзакцию; изменения, сделанные слушателями во время рассылки, могут разделить один вызов. Транзакция, которая только испускает события, например заблокированный `focus`, доставляет их без `change` |
| `on(event, fn)` | `() => void` | гранулярные события, см. ниже |
| `batch(fn)` | `void` | один `change`, одна запись истории, события сбрасываются в конце |
| `setExtension(key, value)` | `void` | хранит состояние плагина в `getState().extensions[key]`; оно сериализуется, восстанавливается `hydrate` и записывается в историю, так что изменение плагина и изменения окон в одном `batch` отменяются вместе. `undefined` удаляет ключ; то же значение ничего не делает |

## События

```ts
interface ManagerEvents {
  open: { window: WindowState }
  close: { window: WindowState }
  focus: { window: WindowState; previous: string | null }
  move: { window: WindowState }
  resize: { window: WindowState }
  stage: { window: WindowState; previous: WindowStage }
  update: { window: WindowState }
  order: { order: readonly string[] }
  workspace: { workspace: number; previous: number }
  group: { groupId: string; members: readonly string[]; activeId: string; previous: string | null }
  modalblocked: { window: WindowState }   // the modal that blocked, not the blocked window
  change: { state: ManagerState }
}
```

Порядок внутри одной транзакции: конкретные события срабатывают в том порядке, в каком всё произошло, а `change` — последним. Объекты в данных событий — это состояние после изменения.

`focus` срабатывает, только когда меняется `focusedId`, поэтому `previous` никогда не равен самому окну; подъём окна в фокусе испускает только `order`. Оно также срабатывает для `undo`, `redo`, `hydrate` и `loadLayout`, когда фокус сдвигается, и когда `open` позади модалки передаёт фокус модалке. `modalblocked` испускается только заблокированным вызовом `focus()`.

Модалка, ставшая верхней через `update(…, { layer })` или `moveToWorkspace` (любая вкладка модальной группы), забирает фокус; понижение модалки в фокусе передаёт фокус следующей видимой модалке.

Вызов изнутри слушателя ставится в очередь за событиями, которые уже доставляются, а его `change` несёт последнее состояние (оно может быть общим с внешним вызовом). Если слушатель бросает исключение, остальные события и `change` всё равно доставляются, а первая ошибка пробрасывается из вызова, который их запустил; ошибка при доставке событий вложенного вызова всплывает на самом внешнем вызове. Слушатели того же события, зарегистрированные после бросившего, пропускаются. Если слушатель продолжает менять состояние 10 000 раундов доставки подряд, вызов бросает `wmkit: listeners keep changing the state`: состояние остаётся зафиксированным, а недоставленные события уходят со следующей транзакцией.

`open` и `close` покрывают все способы появления и исчезновения окна, а не только одноимённые вызовы: `hydrate`, `loadLayout`, `undo` и `redo` сообщают о сделанной ими разнице, поэтому монтирование контента на `open` и освобождение на `close` остаются корректными при любых переходах по истории. Их данные `open` несут итоговую геометрию, а появившееся окно не получает `move` или `resize` до своего `open`. `attachWindow` безопасно вызывать прямо из обработчика `open`.

Контроллер переносит настоящий DOM-фокус в окно, о котором сообщает `focus`, поэтому приложение, которое применяет удалённые снапшоты через `hydrate` или `loadLayout`, пока пользователь печатает, уводит фокус из поля ввода.

## `attachDesktop(wm, element, options?)`

Привязывает менеджер к поддереву DOM и возвращает `DesktopController`. Элемент становится системой координат; он получает `data-wm-desktop`, `tabindex="-1"` и `position: relative`, если был `static`.

```ts
interface DesktopOptions {
  grouping?: boolean | { dwell?: number }   // drop-to-group gesture, 420 ms hover before it arms
  snap?: boolean | {
    threshold?: number      // 12, or 20 on coarse pointers
    cornerSize?: number     // 64, or 96 on coarse pointers
    preview?: boolean       // true
    topEdge?: 'maximize' | 'top' | 'none'  // 'maximize'
  }
  keyboard?: boolean | {
    moveStep?: number         // 16
    cycle?: boolean           // true — F6
    snapShortcuts?: boolean   // true — Ctrl/Cmd+Alt+arrows
    historyShortcuts?: boolean // true — Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
  }
  announce?: boolean | Partial<AnnouncerMessages>
  autoViewport?: boolean      // true — ResizeObserver drives setViewport
  hitAreas?: { edge?: number; corner?: number }  // 8/12, or 16/24 on coarse pointers
  magnetism?: boolean | { threshold?: number }   // 8, or 12 on coarse pointers
  stacking?: {
    base?: number      // 0 — z-index of the desktop floor
    gap?: number       // 32 — room left between neighbours for cheap reordering
    isolate?: boolean  // true — isolation:isolate so window layers stay inside the desktop
  }
  animation?: boolean | {
    duration?: number   // 260
    easing?: string     // cubic-bezier(0.32, 0.72, 0, 1)
  }
  gestures?: readonly DesktopGesture[]  // opt-in, from @surdeddd/wmkit/gestures or your own
  interactiveSelector?: string  // what a drag handle must not start on
  beforeClose?: (window: WindowState) => boolean | void  // return false to keep it open
  minimizeTarget?: (window: WindowState) => Element | null
  onTitlebarContextMenu?: (window: WindowState, event: MouseEvent) => void
  skins?: Readonly<Record<string, WindowSkin>>  // named skins for mountWindow and meta.skin
  windowVariant?: (window: WindowState) => string | null  // defaults to meta.variant
}
```

### Жесты

Своих жестов у рабочего стола нет. Передайте нужные — и только они попадут в ваш бандл.

```js
import { attachDesktop } from '@surdeddd/wmkit'
import { touchGestures } from '@surdeddd/wmkit/gestures'

attachDesktop(wm, root, { gestures: [touchGestures({ swipe: { workspaces: 4 } })] })
```

`@surdeddd/wmkit/gestures` экспортирует три фабрики: `pinch(options?)`, `swipe(options?)` и `touchGestures({ pinch, swipe })` — когда нужны оба жеста от одного слушателя.

| Опция | По умолчанию | Смысл |
| --- | --- | --- |
| `pinch.threshold` | `12` | насколько должны разойтись пальцы, прежде чем начнётся ресайз |
| `pinch.lockTouchAction` | `false` | ставить на рабочий стол `touch-action: none` вместо `pan-x pan-y` (любой двухпальцевый жест ставит `pan-x pan-y`; `pinch()` и `swipe()` вместе при уничтожении возвращают исходное значение) |
| `swipe.threshold` | `72` | какое расстояние должны пройти два пальца вбок |
| `swipe.workspaces` | `0` | без верхней границы; задайте, чтобы останавливаться на последнем рабочем пространстве |

Жест — это функция. Она получает `GestureContext` и возвращает собственную отписку, так что свои жесты можно писать так же, как написаны встроенные:

```ts
type DesktopGesture = (ctx: GestureContext) => () => void

interface GestureContext {
  wm: WindowManager
  doc: Document
  view: Window & typeof globalThis
  desktop: HTMLElement
  toLocal(event: PointerEvent): { x: number; y: number }
  trackRect(): () => void
  windowElement(id: string): HTMLElement | undefined
  busy(): boolean                       // a drag or resize already owns the pointer
  claim(gesture: ActiveGesture): void   // take the pointer, so nothing else acts on it
  release(gesture: ActiveGesture): void
}
```

Именно `claim` не даёт жестам воевать со встроенными перетаскиванием и ресайзом: рабочий стол держит одно взаимодействие за раз, а `busy()` говорит, занято ли оно уже.

```ts
interface DesktopController {
  element: HTMLElement
  wm: WindowManager
  attachWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  mountWindow(id: string, skin: WindowSkin | string, options?: WindowAttachOptions): MountedWindow
  actions(id: string): WindowActions
  destroy(): void
}

interface WindowAttachOptions {
  handle?: HTMLElement | string   // defaults to [data-wm-drag]
  resizeHandles?: boolean         // true
  removeOnClose?: boolean         // false for attachWindow, true for mountWindow
}
```

`attachWindow` бросает исключение для неизвестного id или id, который уже привязан. Он возвращает функцию отвязки; `destroy()` отвязывает всё, отменяет идущий жест и удаляет превью снэпа, а элементы теряют `data-wm-window` и `data-wm-focused` ровно так же, как при отвязке.

Окно, которое закрывает менеджер, — включая то, которое убирает `undo`, — отвязывается за вас: уходят его слушатели и ручки ресайза, а элемент теряет `data-wm-window`, чтобы потом никто не принял его за живое окно. Сам элемент остаётся на странице, если вы не передали `removeOnClose`, а выданную вам функцию отвязки безопасно вызывать снова в любой момент, в том числе после того, как вы привязали тот же элемент к другому окну, или после `desktop.destroy()`.

### `desktop.actions(id)`

Те же десять действий, что даёт менеджер, но уже привязанные к одному окну, так что обработчику кнопки никогда не нужно замыкать id:

```js
const act = desktop.actions('notes')
closeButton.onclick = () => act.close()
```

`focus`, `close`, `minimize`, `maximize`, `toggleMaximize`, `restore`, `center`, `sendToBack`, `snap(zone)` и `moveToWorkspace(n)`. Каждое возвращает тот же boolean, что и менеджер, и каждое после исчезновения окна возвращает `false`, а не бросает исключение.

### `desktop.addDropTarget(hit)`

```ts
type DropTarget = (clientX: number, clientY: number, id: string) => DropHit | null
interface DropHit {
  preview: Bounds   // desktop-local rectangle shown while the pointer is over the target
  commit(): void    // runs when the drag ends there
}
```

Позволяет плагину забрать себе перетаскивание окна. На каждом кадре перетаскивания цели опрашиваются в порядке добавления, раньше группировки во вкладки и снэпа, и побеждает первое попадание: его `preview` рисуется элементом превью снэпа с пометкой `data-wm-drop`, а его `commit` запускается, когда указатель отпускают над ним. Отмена перетаскивания (Escape, потерянный указатель) ничего не фиксирует. Превью сброса показывается даже при `snap: { preview: false }`. Возвращает функцию, которая удаляет цель. На этом построен плагин dock.

### Управление окном из разметки

Любой элемент внутри окна может нести один из этих атрибутов, и контроллер выполнит действие без всякого вашего слушателя:

| атрибут | действие |
| --- | --- |
| `data-wm-close` | закрывает окно |
| `data-wm-minimize` | сворачивает его |
| `data-wm-maximize` | переключает разворот |
| `data-wm-restore` | возвращает его к сохранённой геометрии |
| `data-wm-center` | центрирует его во вьюпорте |
| `data-wm-send-back` | опускает его в самый низ стопки |
| `data-wm-snap="left"` | прилепляет его к этой зоне, если окно поддерживает снэп |
| `data-wm-to-workspace="2"` | переносит его на это рабочее пространство |

Неизвестная зона снэпа игнорируется, а не бросает исключение, так что опечатка в шаблоне никогда не обрушит страницу.

### `desktop.mountWindow(id, skin, options?)`

Собирает элемент окна из скина, вместо того чтобы брать уже готовый.

```ts
type WindowSkin = (context: SkinContext) => SkinMount

interface SkinContext {
  doc: Document
  id: string
  window: WindowState
  actions: WindowActions
}

interface SkinMount {
  element: HTMLElement
  content: HTMLElement
  destroy?(): void
}

interface MountedWindow {
  readonly element: HTMLElement
  readonly content: HTMLElement
  detach(): void
}
```

`skin` — это либо фабрика, либо имя фабрики, зарегистрированной в `attachDesktop(wm, root, { skins })`; незарегистрированное имя бросает исключение. Смена `meta.skin` на незарегистрированное имя или на фабрику, которая бросает исключение, бросает один раз из вызова, который сделал изменение: окно сохраняет текущий скин и остаётся полностью управляемым, а контроллер не пробует снова, пока `meta.skin` не изменится ещё раз. Возвращённые `element` и `content` живые: после пересборки окна они указывают на новые узлы, так что ссылка, взятая при монтировании, никогда не устаревает. Хэндл, чьё окно закрылось, продолжает указывать на последние узлы и никогда не подхватывает более позднее окно с тем же id.

Окно пересобирается, когда `meta.skin` меняется на другое зарегистрированное имя или когда вы снова вызываете `mountWindow` для того же id. В обоих случаях дочерние элементы контента переезжают, id, геометрия, фокус и наложение сохраняются, а `destroy` предыдущего скина запускается после замены. Окна, которые вы привязали сами через `attachWindow`, никогда не пересобираются у вас за спиной. Монтирование под именем, отличным от `meta.skin`, сохраняется; при следующем изменении оно не исправляется.

`destroy` скина запускается ровно один раз: после замены при пересборке, при закрытии, при `detach()` или при `desktop.destroy()` — что наступит раньше.

### Что пишет контроллер

На элементе окна: `data-wm-window`, `data-wm-stage`, `data-wm-layer`, `data-wm-workspace`, `data-wm-focused`, `data-wm-dragging`, `data-wm-resizing`, `data-wm-flash`, `hidden`, `role="dialog"`, `tabindex="-1"`, `aria-label`, `aria-labelledby` (когда `[data-wm-title]` лежит в том же корне, что и окно; заголовок внутри теневого корня вместо этого передаётся через `aria-label`), `aria-modal` на модальных слоях, плюс инлайн `transform`, `width`, `height`, `z-index`. Первая синхронизация ненадолго ставит `transition: none`, а инлайн-`transition`, который поставило ваше приложение, потом восстанавливается.

`data-wm-flash` ставится, когда модалка блокирует взаимодействие, и остаётся до следующего заблокированного взаимодействия или до отвязки окна, поэтому стилизуйте вспышку анимацией, которая проигрывается один раз на каждую установку, а не статичным правилом.

Контроллер переносит фокус клавиатуры в окно, когда менеджер его фокусирует или когда нажимают на его тайтлбар или ручку, и возвращает его тому элементу управления, у которого фокус был в этом окне последним; нажатие в контент остаётся на усмотрение браузера. Когда окно с фокусом закрывается или скрывается, контроллер паркует фокус на рабочем столе. Сгенерированные id заголовков имеют вид `wmkit-title-<id>-<n>` и уникальны в пределах страницы.

Под видимой модалкой DOM-слой отклоняет взаимодействие указателем с нижними окнами: нажатия, перетаскивания, ресайзы, двойные клики, action-атрибуты и меню тайтлбара. Заблокированное нажатие заставляет модалку мигнуть. Клавиатурный ввод в нижние окна не блокируется: Tab, пришедший снаружи рабочего стола, или ввод в элемент управления, у которого фокус уже был. `iframe` в роли первой или последней остановки модалки позволяет Tab уйти изнутри фрейма, потому что события клавиш внутри фрейма не доходят до родительского документа.

Фреймы внутри окон (`iframe`, `object`, `embed`) никогда не отдают странице свои события указателя и клавиш, поэтому контроллер вместо этого следит, куда уходит фокус: пока указатель над фреймом, а также один раз всякий раз, когда страница теряет фокус, фрейм, забравший фокус, поднимает и фокусирует своё окно. Под видимой модалкой фреймы в нижних окнах получают `pointer-events: none`, пока модалка не уйдёт, так что клик не может добраться до их содержимого.

### Тач

Каждый жест управляется событиями указателя, поэтому палец и мышь идут одним путём. Ручка перетаскивания и ручки ресайза получают `touch-action: none` — именно это не даёт браузеру панорамировать страницу из-под перетаскивания, — а на грубых указателях хит-зоны увеличиваются: значения по умолчанию выше показывают обе цифры. Одновременно идёт только один жест: второй палец, опустившийся на другой тайтлбар посреди перетаскивания, полностью игнорируется — он не запускает конкурирующее перетаскивание, не фокусирует и не поднимает то окно. Перетаскивание или ресайз, у которых `setPointerCapture` бросает исключение, не начинаются, а потеря захвата указателя отменяет жест так же, как `pointercancel`. Нажатие на элемент управления внутри веб-компонента в тайтлбаре не запускает перетаскивание (внутренняя цель читается через `composedPath()`), а группировка сбросом целится только в самое верхнее окно под указателем. Долгое нажатие порождает событие `contextmenu`, как и везде, — из него и вызывается `onTitlebarContextMenu`, а собственное меню браузера подавляется за вас.

Сам элемент рабочего стола получает `isolation: isolate`, поэтому значения `z-index`, которые пишет контроллер, остаются внутри него и никогда не воюют с собственными слоями страницы. Выключите это через `stacking: { isolate: false }`, когда рабочий стол должен делить контекст наложения с окружающей страницей.

Подъём окна переписывает ровно один `z-index`: значения разнесены на `gap` друг от друга, и контроллер перенумеровывает только окна, которые действительно поменялись местами, а когда место кончается, откатывается к полной перенумерации. Поэтому `z-index` окна не говорит ничего, кроме его относительного положения.

Ещё он вставляет ручки `[data-wm-resize]`, один `[data-wm-snap-preview]` на рабочий стол и один визуально скрытый live-регион `[data-wm-announcer]`. `<header>`, `<footer>`, `<nav>` или `<aside>`, используемые как ручка перетаскивания, получают `role="presentation"`, чтобы не выпускать landmark за пределы диалога.

### Клавиатура по умолчанию

| Клавиши | Действие |
| --- | --- |
| стрелки | двигают окно в фокусе на `moveStep`; только пока фокус клавиатуры на самом элементе окна или внутри его тайтлбара, поэтому списки, слайдеры и области прокрутки в контенте сохраняют свои стрелки; игнорируются во время перетаскивания или ресайза указателем |
| `Alt` + стрелки | сдвиг на 1 px |
| `Shift` + стрелки | ресайз |
| `Ctrl`/`Cmd` + `Alt` + `←`/`→` | прилепить к половине |
| `Ctrl`/`Cmd` + `Alt` + `↑`/`↓` | развернуть / свернуть или восстановить |
| `Ctrl`/`Cmd` + `Z`, `+ Shift` | отмена, повтор; нелатинские раскладки тоже работают — через клавишу Z раскладки |
| `F6`, `Shift` + `F6` | цикл фокуса |
| `Escape` во время жеста | отменить его и убрать из истории |
| двойной клик по ручке | переключить разворот |

Шорткаты никогда не срабатывают, пока цель события — `button, input, select, textarea, a[href], [contenteditable]`, с одним исключением: `F6` и `Shift+F6` переключают окна откуда угодно, в том числе из поля ввода, потому что именно так пользователи клавиатуры из него выходят.

## `createDesktopBinder(wm, options?)`

Не зависящая от порядка обёртка, которую используют адаптеры: привязывайте окна до или после появления рабочего стола и до или после открытия окна.

```ts
interface DesktopBinder {
  wm: WindowManager
  controller(): DesktopController | null
  bindDesktop(element: HTMLElement): () => void
  bindWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  destroy(): void
}
```

`bindDesktop` бросает исключение, если рабочий стол уже привязан. Отвязка и повторная привязка поддерживаются — биндер переподписывается, и именно это делает двойное монтирование в React StrictMode безвредным.

- Привязанный элемент без родителя (удалённый, например, через `removeOnClose` при закрытии окна) добавляется в элемент рабочего стола, когда его окно привязывается, так что окно, вернувшееся через отмену или повторное открытие, снова видно. Элементы, которые всё ещё лежат в каком-то дереве, остаются на месте, даже если это дерево вне документа. Элемент возвращается прямым потомком рабочего стола, а не внутрь обёртки, в которой жил, поэтому используйте `removeOnClose` только для узлов, которые создали сами, и никогда — для узлов, которые рендерит фреймворк.
- Когда окно открывается, привязывается только первый элемент, связанный с этим id, поэтому `wm.open` никогда не бросает исключение из биндера.
- Вызов `bindWindow`, который бросил исключение (например, «already attached»), не оставляет после себя привязки.

## Хелперы геометрии

Чистые функции без DOM, экспортированные для построения собственной логики раскладки.

```ts
clamp(value, min, max): number
clampSize(size, min, max: Size | null): Size
clampToViewport(bounds, viewport, minVisible): Bounds
boundsEqual(a, b): boolean
zoneBounds(zone, viewport): Bounds
applyAspect(size, ratio, min, max, drive: 'width' | 'height'): Size
detectSnapZone(x, y, viewport, options?: { threshold?: number; cornerSize?: number }): SnapZone | null
magnetize(bounds, targets: readonly Bounds[], threshold): MagnetResult
```

`zoneBounds` разбивает без остатка: половины, четверти и трети складываются обратно во вьюпорт без зазоров и наложений даже на нечётных размерах. `clampToViewport` держит досягаемыми `minVisible` пикселей и никогда не выталкивает окно уже этого значения за оба края. `magnetize` возвращает `{ x, y, snappedX, snappedY }` и выравнивает любую пару краёв в пределах `threshold`.

## Хелперы анимации

```ts
prefersReducedMotion(win: Window): boolean
flipToTarget(source: HTMLElement, target: Element, options?: FlipGhostOptions): void
flipFromTarget(source: HTMLElement, target: Element, options?: FlipGhostOptions): void
interface FlipGhostOptions { duration?: number; easing?: string }
```

Оба FLIP-хелпера рендерят одноразовый элемент-призрак и удаляют его по завершении или отмене. Они ничего не делают при reduced motion, без `Element.animate` или когда у любого из двух прямоугольников нулевая ширина. `attachDesktop` вызывает их за вас, когда задан `minimizeTarget`.

## Announcer

```ts
createAnnouncer(wm, container, messages?: Partial<AnnouncerMessages>): Announcer

interface AnnouncerMessages {
  opened(title: string): string
  closed(title: string): string
  minimized(title: string): string
  restored(title: string): string
  maximized(title: string): string
  snapped(title: string, zone: string): string
  focused(title: string): string
  workspace(index: number): string
}

interface Announcer {
  element: HTMLElement
  announce(message: string): void
  destroy(): void
}
```

`attachDesktop` создаёт его, если не задано `announce: false`; для локализации передайте объект. Сообщение о стадии или рабочем пространстве всегда побеждает сообщение о фокусе из той же транзакции, поэтому регион никогда не зачитывает «в фокусе» поверх «развёрнуто». Два одинаковых анонса подряд всё равно меняют текст live-региона (переключается неразрывный пробел в конце), так что скринридер произносит оба.

## Emitter

```ts
createEmitter<Events>(): Emitter<Events>
interface Emitter<Events> {
  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void
  emit<K extends keyof Events>(event: K, payload: Events[K]): void
  clear(): void
}
```

Перед рассылкой список слушателей копируется, поэтому подписываться и отписываться внутри обработчика безопасно. События самого менеджера добавляют к этому правила повторного входа и обработки ошибок, описанные в разделе [События](#события).

## `skin(spec)` — `@surdeddd/wmkit/chrome`

Превращает строку разметки в `WindowSkin` — фабрику, которую принимают `mountWindow` и реестр `skins`.

```ts
interface SkinSpec {
  template: string      // one [data-wm-content] attribute, one root element, {{placeholders}} escaped and placed
  styles?: string       // one <style data-wm-skin-styles> per skin per document; needs a name to scope it
  shadow?: boolean      // build the chrome inside an open shadow root
  name?: string         // lands on the window as data-wm-skin
}

function skin(spec: SkinSpec): WindowSkin
function compileTemplate(template: string): (values: Record<string, string>) => string
function windowChrome(messages?: ChromeMessages): WindowSkin
const defaultSkin: WindowSkin    // titlebar, title and the three controls
const barebones: WindowSkin      // titlebar and title, nothing else

interface ChromeMessages {
  minimize: string
  maximize: string
  close: string
}
const chromeMessages: ChromeMessages    // English
const chromeMessagesRu: ChromeMessages  // Russian
```

Подстановки: `{{title}}`, `{{id}}`, `{{stage}}`, `{{layer}}`, `{{workspace}}` и `{{variant}}`. Каждая подстановка экранируется как HTML без возможности это отключить (включая `{`), так что заголовок окна никогда не протащит разметку в окружающую его обвязку; неизвестная подстановка раскрывается в пустую строку, а не бросает исключение, потому что шаблон переживает переименования.

Подстановка может стоять только в тексте или в значении *в кавычках* у `aria-*`, `data-*`, `title`, `alt`, `class`, `id`, `role`, `lang`, `dir`, `for`, `value`, `placeholder` или `label`. В любом другом месте `compileTemplate()` и `skin()` бросают ошибку с именем подстановки и разметкой перед ней: значение без кавычек, имя тега или атрибута, любой другой атрибут (URL, `style`, `on*`, `srcdoc` …), комментарий, содержимое `script`, `style`, `textarea`, `title`, `xmp`, `iframe`, `noembed`, `noframes` и `plaintext`, всё после `<noscript>` и всё после `<style>` или `<script>` внутри SVG. Компилятор моделирует только токенизатор HTML, а не выход из foreign content в SVG или MathML, поэтому не ставьте подстановки внутри foreign content, который полагается на теги выхода.

Дальше за состоянием следует только `{{title}}` внутри `[data-wm-title]`. Все остальные подстановки рендерятся при монтировании или пересборке и устаревают, включая `aria-label="Close {{title}}"`.

Шаблон должен содержать ровно один атрибут `[data-wm-content]` (упоминание в тексте, комментарии или значении атрибута не считается) и один корневой элемент, и `skin()` бросает ошибку ещё при его написании, а не молча теряет ваш контент; лишние корни бросают `wmkit: a skin template needs a single root element …` при монтировании. `styles` без `name` тоже бросает ошибку — правилам было бы не к чему привязаться.

Каждый вызов `skin()` владеет своим `<style data-wm-skin-styles="<name>">` на документ, поэтому два скина с одинаковым именем получают по собственному тегу, а стили отредактированного скина действительно применяются. Тег удаляется, когда последнее окно в этом скине отвязывается, пересобирается в другой скин или уничтожается вместе с рабочим столом.

С `shadow: true` обвязка собирается внутри открытого теневого корня; корневой элемент шаблона разворачивается, так что `:host` — это бокс, в котором лежат тайтлбар и контент. Ваш контент — собственный элемент `[data-wm-content]` шаблона (атрибуты и дочерние элементы по умолчанию сохраняются), перенесённый в light DOM и спроецированный через `<slot>`, поставленный на его место, так что теневой CSS достаёт до него как `::slotted([data-wm-content])`. Стили становятся одной constructable stylesheet на скин на документ, а там, где constructable stylesheets нет, запасным вариантом служит элемент `<style>`.

## `themeNames`, `themeStyle(name, options?)` — `@surdeddd/wmkit/themes`

Шестнадцать встроенных таблиц стилей в виде строк — для скинов, до которых не дотягивается таблица стилей в `document.head`.

```ts
const themeNames: readonly ThemeName[]
const themeCss: Record<ThemeName, string>        // byte for byte the .css files
const themeShadowCss: Record<ThemeName, string>  // the same rules re-anchored to :host
function themeStyle(name: ThemeName, options?: { shadow?: boolean }): string
```

Для теневого скина передавайте `{ shadow: true }`. Кастомные свойства наследуются через теневую границу, поэтому обычный текст доставляет токены темы, но ни одного её правила — каждое правило написано от `[data-wm-window]`, а внутри теневого корня этого атрибута нет ни на одном элементе. См. [theming.ru.md](theming.ru.md).

## `persist(wm, options?)` — `@surdeddd/wmkit/persist`

```ts
interface PersistOptions {
  key?: string             // 'wmkit'
  storage?: PersistStorage // localStorage, when reading it does not throw
  debounce?: number        // 150 ms
  autoRestore?: boolean    // true
  version?: number         // 0
  migrate?: (state: unknown, from: number) => SerializedState | null
}

interface PersistStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface PersistController {
  restore(): boolean
  save(): void
  clear(): void
  destroy(): void
}
```

Сохраняется форма `{ version, state }`. Данные с другой `version` передаются в `migrate`; возврат `null` (или отсутствие `migrate`) отбрасывает их, вместо того чтобы восстановить что-то сломанное, а успешная миграция сразу записывается обратно. Данные, записанные до появления этой обёртки, по-прежнему читаются — как версия `0`. Каждый вызов хранилища обёрнут: бросающее исключения или отсутствующее хранилище превращает плагин в пустышку, а не в исключение. Пробной записи нет: заполненное хранилище всё равно читается, а неудачная запись проглатывается. Отложенное сохранение сбрасывается на `pagehide` и при `destroy()`; `clear()` вдобавок отменяет отложенное сохранение.

## `popout(wm, id, content, options?)` — `@surdeddd/wmkit/popout`

```ts
isPopoutSupported(target?: PopoutTarget): boolean     // 'auto' — either target works
listScreens(): Promise<readonly PopoutScreen[] | null> // null: no Window Management API, or permission denied
popout(wm, id, content: HTMLElement, options?: PopoutOptions): Promise<PopoutHandle>

type PopoutTarget = 'auto' | 'pip' | 'window'          // auto: picture-in-picture when available, else a popup

interface PopoutOptions {
  target?: PopoutTarget             // 'auto'
  width?: number                    // the window's current width
  height?: number
  screen?: PopoutScreen | 'current' | 'other'   // popup only: centre it on that screen
  left?: number                     // popup only: explicit position in screen coordinates
  top?: number
  mode?: 'move' | 'container'       // 'move' — carry `content`; 'container' — leave it, render into handle.container
  copyStyles?: boolean              // true — styleSheets and adoptedStyleSheets, with their media; disabled sheets skipped
  minimizeWhilePopped?: boolean     // true, unless the window is already minimized
}

interface PopoutHandle {
  target: 'pip' | 'window'
  window: Window
  pipWindow: Window                 // the same object as window, kept for 0.11 code
  container: HTMLElement            // the element in the popout that holds the content
  closed: Promise<void>             // settles once the content is back and the popout is gone
  close(): void                     // safe to call more than once
}
```

Переносит живой элемент в отдельное окно ОС — тот же JS-контекст, тот же менеджер, без перерендера. Вариантов два. Document Picture-in-Picture (Chrome и Edge 116+, Firefox 151+) всегда поверх, размер ему задаёт браузер; на страницу такое окно одно. Всплывающее окно (`window.open`, любой движок) можно разместить: `screen: 'other'` центрирует его на первом экране, который не текущий, `screen: 'current'` — на текущем, или передайте экран из `listScreens()`. Для размещения нужны Window Management API (Chromium) и разрешение на него; без любого из них всплывающее окно открывается там, где его поставит браузер. Всплывающее окно нужно открывать из жеста пользователя, иначе браузер его заблокирует, и `popout()` отклонится с `wmkit: the popout window was blocked`.

Место контента в исходном дереве держит маркер-комментарий. Когда popout закрывается — через `close()`, пользователем, закрытием окна в менеджере или уходом самой страницы, — контент возвращается к маркеру или в текущий `[data-wm-content]` окна, если пересборка скина уничтожила место маркера. Заголовок popout следует за заголовком окна. Окно, которое свернул popout, восстанавливается, только если оно всё ещё свёрнуто, так что окно, которое пользователь тем временем восстановил и развернул, остаётся как есть.

React (как и любой фреймворк, который делегирует события со своего корня) теряет обработчики на узле, перенесённом в другой документ. Используйте `mode: 'container'` и рендерите в popout через портал — см. рецепт в `recipes.md`.

## `createDock(desktop, options?)` — `@surdeddd/wmkit/dock`

```ts
createDock(desktop: DesktopController, options?: DockOptions): Dock

interface DockOptions {
  area?: (viewport: Size) => Bounds   // the whole desktop
  sash?: number                       // 6 px, 12 on coarse pointers
  edgeDrop?: number                   // 24 px band along the area edges that docks to the root; 0 turns it off
  minSize?: Size                      // floor for every panel; a panel never goes below its windows' own minSize
  keyboard?: boolean                  // true — Ctrl/⌘+Alt+Shift+arrows dock the focused window
  messages?: Partial<DockMessages>    // English; dockMessagesRu for Russian
}

interface Dock {
  dock(id: string, target?: { stackId?: string; side?: DockSide }): boolean
  undock(id: string): boolean
  layout(): DockLayout
  setLayout(layout: DockLayout): boolean
  destroy(): void
}

type DockSide = 'left' | 'right' | 'top' | 'bottom' | 'center'
type DockLayout = { root: DockNode | null }
type DockNode =
  | { kind: 'stack'; id: string; windows: string[]; active: string }
  | { kind: 'split'; id: string; axis: 'row' | 'column'; children: DockNode[]; sizes: number[] }
```

Раскладывает окна по панелям, как в dockview, а остальные окна продолжают плавать поверх. Закреплённое окно — это прилепленное окно со `snapRect`: прямоугольником панели в долях вьюпорта. Пока окно закреплено, оно теряет `resizable`, `minimizable` и `snappable` и получает их обратно при откреплении, а его элемент несёт `data-wm-docked` (прямые углы, без тени). Панель с несколькими окнами — это группа вкладок, так что вкладки берутся из механизма групп. Раскладка живёт в `getState().extensions.dock`, и это даёт три вещи бесплатно. Одна операция закрепления со всеми изменениями окон — один шаг отмены. `persist` сохраняет и восстанавливает раскладку. `hydrate` размещает её на рабочем столе любого размера.

- `dock(id)` без цели добавляет окно вкладкой в первую панель или заполняет им всю область, если ничего не закреплено. `side` делит корень или, если задан `stackId`, панель; `center` добавляет вкладкой. `false`, если ничего не изменилось, окно неизвестно или оно на другом рабочем пространстве, чем раскладка.
- `undock(id)` возвращает окну его плавающую геометрию.
- `setLayout(layout)` закрепляет ровно те окна, которые названы в раскладке, и открепляет остальные. `false` для раскладки, которая нарушает инвариант (пустая панель, разделение с одним потомком, размеры, которые в сумме не дают 1, окно дважды) или называет неизвестное окно. `dockLayout` экспортирует чистые операции (`insert`, `remove`, `resize`, `activate`, `moveInStack`, `stackOf`, `windowsOf`, `rects`, `validate`, `emptyLayout`), чтобы такую раскладку собрать.

При перетаскивании окна над областью показывается превью того, куда оно встанет, и при отпускании окно закрепляется там. У края панели оно делит эту панель, в центре панели добавляется вкладкой, а в краевой полосе области закрепляется к корню. Зажатый Shift во время перетаскивания оставляет окно плавать над раскладкой. Окна на слое `floating` или `modal` никогда не закрепляются перетаскиванием, как и окно, брошенное вне `area`. Первый кадр перетаскивания закреплённого окна отрывает его, и панели смыкаются. Отменённое перетаскивание возвращает его на место.

Разделители между панелями — это `div[data-wm-sash][role=separator]` с `aria-orientation` и `aria-valuenow`/`min`/`max` в процентах. Тащите разделитель указателем (один шаг отмены на перетаскивание) или сфокусируйте его и жмите стрелки (16 px, 1 px с Shift) либо Home/End для крайних положений. Панель никогда не сжимается меньше наибольшего `minSize` своих окон или `options.minSize`, если он больше.

Закреплённое окно, которое закрывается, восстанавливается, отрывается или переезжает на другое рабочее пространство, покидает раскладку без лишнего шага отмены: отмена закрытия возвращает и окно, и его панель. Разворот панели оставляет окно закреплённым, а восстановление возвращает его в панель. Изменение вьюпорта заново раскладывает панели, не трогая историю. Раскладка принадлежит одному рабочему пространству, а на остальных её разделители скрываются.

## `createDevtools(wm, options?)` — `@surdeddd/wmkit/devtools`

```ts
interface DevtoolsOptions {
  container?: HTMLElement           // document.body
  messages?: Partial<DevtoolsMessages>   // devtoolsMessages (English); devtoolsMessagesRu is exported
  logLimit?: number                 // 50
  events?: readonly (keyof ManagerEvents)[]  // open, close, focus, stage, workspace, group, modalblocked
}

interface DevtoolsController {
  element: HTMLElement
  destroy(): void
}
```

Панель с живой таблицей окон, журналом событий и кнопками отмены, повтора и копирования состояния. Она следит за менеджером, а не за DOM. Кнопки в строках — фиксированные глифы; копирование пишет `serialize()` в буфер обмена как JSON, а если буфера обмена нет или он отклоняет запись, показывает сам JSON.
