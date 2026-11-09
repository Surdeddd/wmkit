---
description: Все экспорты @surdeddd/wmkit и его подпутей — менеджер окон с методами, событиями и типами, DOM-контроллер, хелперы геометрии и анимации, persist, popout и devtools.
---

# Справочник API

Всё, что экспортируют `@surdeddd/wmkit` и его подпути. Типы — настоящие, из `src/core/types.ts` и `src/dom/shared.ts`. Адаптеры для фреймворков и веб-компоненты `<wm-desktop>` (`./elements`) описаны в разделе [Адаптеры](adapters.ru.md), точка входа WinBox (`./winbox`) — в разделе [Переезд с WinBox](winbox-migration.ru.md).

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
- [chrome](#skinspec--surdedddwmkitchrome)
- [themes](#themenames-themestylename-options--surdedddwmkitthemes)
- [persist](#persistwm-options--surdedddwmkitpersist)
- [popout](#popoutwm-id-content-options--surdedddwmkitpopout)
- [dock](#createdockdesktop-options--surdedddwmkitdock)
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

Флаги — это пожелания, а не запреты: DOM-слой не даёт пользователю выполнить соответствующий жест, а программный API всегда делает то, что вы просите. `wm.close(id)` закроет окно с `closable: false`, и это сделано намеренно: флаг останавливает пользователя, а не ваш код.

`WindowGroup`, `HistoryEntry`, `SerializedWindowState`, `SerializedMaxSize` и `WindowUpdate` тоже экспортируются как типы.

### WindowState

Объекты заменяются, а не мутируются, поэтому `previous === next` — надёжная проверка «ничего не изменилось».

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

Все числа в окне конечны, за одним исключением: неограниченная ось `maxSize` равна `Infinity`. `JSON.stringify` записывает `Infinity` как `null`, поэтому сохраняйте рабочий стол через `serialize()`, а не сериализуйте состояние сами: `serialize()` намеренно пишет такую ось как `null`, а `hydrate()` читает `null` обратно как «без ограничения». В `meta` лежит то, что положили вы, и в JSON оно переживёт ровно то, что переживут ваши значения.

### WindowInit

```ts
interface WindowInit extends Partial<WindowFlags> {
  id?: string          // generated as `${idPrefix}-${n}` when omitted or empty; duplicates throw
  title?: string       // 'Window'
  x?: number           // cascades when x or y is omitted or not finite
  y?: number
  width?: number       // defaultSize.width when omitted, not finite or not above 0
  height?: number      // defaultSize.height, same rule
  minWidth?: number    // 160 when omitted, negative or not finite
  minHeight?: number   // 100, same rule
  maxWidth?: number    // unbounded when omitted or not above 0
  maxHeight?: number
  aspectRatio?: number // ignored unless finite and > 0
  stage?: WindowStage  // 'snapped' is downgraded to 'normal' (no zone to snap to yet)
  layer?: WindowLayer  // 'normal' when omitted or unknown
  workspace?: number   // active workspace; non-integers and negatives fall back
  meta?: Record<string, unknown>
}
```

`open()` бросает исключение только при повторяющемся id. Поле, которое нельзя использовать, получает то же значение, что и при его отсутствии (см. комментарии выше), поэтому плохое число в состояние не попадает.

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

`getState()` возвращает закэшированный объект, который заменяется при каждом изменении, поэтому проверки `!==` достаточно, чтобы понять, что что-то произошло. id окна может быть любой строкой, включая `constructor` и `__proto__`: у `windows` нет прототипа, поэтому читайте его через `Object.keys`, `in` или `Object.hasOwn`, а не через `windows.hasOwnProperty`.

Ключи `windows` идут в порядке открытия окон, в том числе после `hydrate` и `loadLayout`, с одним исключением, которое диктует сам JavaScript: ключи, похожие на целые числа (`'42'`), всегда идут первыми и по возрастанию. Если рендерите список из `windows`, давайте окнам id, которые не являются просто числами, или сортируйте по `openedSeq`.

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

`hydrate()` не бросает исключений, а возвращает `false`. Снапшот целиком отклоняется только при неверной структуре: значение не объект, `version` не равна `1`, `windows` не массив, элемент массива не объект, id не непустая строка, `bounds` не объект, неизвестные `stage` или `layer`, повторяющийся id. Всё остальное чинится в каждом окне отдельно, так что одно повреждённое окно не стоит всей раскладки:

- нечисловая или бесконечная позиция заменяется каскадной; ширина или высота, которые не конечны или не больше 0, берутся из `defaultSize`
- размер приводится к собственным ограничениям окна; некорректная ось минимума получает значение по умолчанию (160 или 100), некорректная ось максимума становится неограниченной
- `restoreBounds`, который не является корректным прямоугольником, становится `null`; `snapRect` обрезается до единичного квадрата, а если внутри от него ничего не остаётся, отбрасывается
- `stage: 'snapped'` без известной `snapZone` и без `snapRect` становится `'normal'`
- окно с бесконечным или нечисловым `openedSeq` получает новый номер, а любое другое неизвестное поле окна — значение по умолчанию

`meta` копируется, участники групп заново синхронизируются со своей активной вкладкой (если запись `activeTabs` не называет ни одного участника, активной становится первая вкладка группы), а рамка группы соблюдает ограничения всех участников, как описано ниже. `focusedId: null` оставляет рабочий стол без фокуса; к верхнему окну фокус переходит, только если id отсутствует или некорректен.

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
  historyLimit?: number                // 50; 0 disables undo/redo, Infinity keeps every step
  workspace?: number                   // 0
}
```

Числовая опция, которую нельзя использовать, заменяется значением по умолчанию и не ломает менеджер: `viewport` или `defaultSize` с осью, которая не конечна или не больше 0, нечисловые или бесконечные `cascadeOffset` и `cascadeOrigin`, отрицательный или бесконечный `minVisible`, отрицательный или `NaN` в `historyLimit`. Отклонённый `viewport` оставляет вьюпорт неизвестным.

Пока `viewport` равен нулевому значению по умолчанию, `clampToViewport` ничего не делает. Поэтому менеджер, восстановленный через `hydrate` до монтирования, сохраняет записанную геометрию, а первый `setViewport()` (обычно его вызывает `ResizeObserver` контроллера) пересчитывает всё. Пока вьюпорт неизвестен, `maximize` и `open({ stage: 'maximized' })` оставляют окну его собственную рамку, `center()` возвращает `false`, `arrange('tile')` ничего не делает, а отмена, повтор и `hydrate` тоже не пересчитывают геометрию. В jsdom `clientWidth`/`clientHeight` равны 0, поэтому при включённом `autoViewport` вызов `setViewport` при монтировании игнорируется и остаётся вьюпорт из конструктора: в тестах передавайте `viewport` в `createWindowManager`.

## Методы WindowManager

Вызов, который ничего не меняет, ничего и не делает: объект состояния остаётся прежним, события не срабатывают, запись в историю не появляется. Это касается, среди прочего, `resize(id, {})`, `focus` на окне, которое уже в фокусе и наверху, повторного `arrange`, а также `snap`, `snapTo` или `restoreTo` туда, где окно уже находится, если фокусу некуда переходить (эти три возвращают `true`).

### Жизненный цикл

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `open(init?)` | `WindowState` | бросает исключение при повторяющемся id; ставит окно каскадом, если `x`/`y` не заданы; фокусирует, если окно не свёрнуто и не на другом рабочем столе |
| `close(id)` | `boolean` | `false` для неизвестного id; фокус переходит к следующему подходящему окну |
| `closeAll()` | `void` | все рабочие столы, одна транзакция. Испускает `close` для каждого окна в порядке открытия, один `order`, затем `group` для каждой распавшейся группы, и ни одного `focus` |
| `destroy()` | `void` | снимает всех слушателей; объектом состояния можно пользоваться и дальше |

### Фокус и порядок

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `focus(id)` | `boolean` | сначала переключает на рабочий стол окна; восстанавливает окно, если оно свёрнуто; `false`, если окно блокирует модалка (испускается `modalblocked`). `focus` испускается, только когда меняется `focusedId`; фокус на окне, которое уже в фокусе, только поднимает его |
| `blur()` | `void` | сбрасывает `focusedId`, не трогая порядок |
| `cycleFocus(direction?)` | `string \| null` | `1` (по умолчанию) или `-1`, по кругу, пропускает свёрнутые окна и другие рабочие столы. `1` поднимает самое нижнее окно, которое может получить фокус; `-1` отправляет окно в фокусе в самый низ его слоя и фокусирует окно, оказавшееся наверху. Направления взаимно обратны, и каждое обходит все окна |
| `sendToBack(id)` | `boolean` | опускает окно в самый низ его слоя; если окно было в фокусе, фокус переходит дальше |

### Стадия

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `minimize(id)` | `boolean` | запоминает стадию, из которой окно свернули |
| `maximize(id)` | `boolean` | заполняет вьюпорт; прежнюю геометрию сохраняет в `restoreBounds` |
| `toggleMaximize(id)` | `boolean` | разворачивает, а развёрнутое окно восстанавливает |
| `restore(id)` | `boolean` | свёрнутое окно возвращает в запомненную стадию (окно, вернувшееся в `normal`, снова прижимается к вьюпорту, если включён `keepInViewport`); развёрнутое или прилепленное — к `restoreBounds`, заново ограниченным по min/max и вьюпорту. Исключение — развёрнутое окно со `snapRect`: оно возвращается к этому прямоугольнику |
| `restoreTo(id, bounds)` | `boolean` | принудительно ставит `normal` с заданной геометрией; так окно отрывается от зоны снэпа при перетаскивании. `false`, если какое-то значение не конечно |
| `snap(id, zone)` | `boolean` | геометрия зоны, ограниченная собственными min/max окна; `false` для неизвестной зоны |
| `snapTo(id, rect)` | `boolean` | прилепляет к любому прямоугольнику в долях вьюпорта (`{ x: 0.5, y: 0, width: 0.5, height: 1 }` — правая половина); как и зона, прямоугольник следует за изменениями вьюпорта, а первый кадр перетаскивания отрывает окно. В отличие от `snap`, не фокусирует и не поднимает окно. На нём построен плагин dock |

`snapTo` обрезает прямоугольник до единичного квадрата: `{ x: -1, y: 0.5, width: 3, height: 3 }` сохраняется как `{ x: 0, y: 0.5, width: 1, height: 0.5 }`. Метод возвращает `false`, если какое-то значение не конечно или внутри квадрата от прямоугольника ничего не остаётся.

`maximize`, `snap`, `restore`, `restoreTo`, `group` и `ungroup` фокусируют окно так же, как `focus()`: сначала переключают на его рабочий стол, даже если на текущем открыта модалка. Если окно блокирует модалка, фокус молча пропускается, а `modalblocked` не испускается: это событие означает только заблокированный вызов `focus()`.

### Геометрия

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `move(id, x, y)` | `boolean` | только в стадии `normal`; `true`, даже если из-за ограничения окно не сдвинулось |
| `moveBy(id, dx, dy)` | `boolean` | `move` на смещение |
| `center(id)` | `boolean` | ставит окно в стадии `normal` в центр вьюпорта; `false`, пока вьюпорт неизвестен |
| `resize(id, patch)` | `boolean` | `Partial<Bounds>`; `false`, пока окно развёрнуто или свёрнуто. Отлепляет прилепленное окно, если его геометрия действительно меняется; соблюдает `aspectRatio`, ведущей считается ось, которая изменилась сильнее |
| `update(id, patch)` | `boolean` | заголовок, слой, min/max-размер, `aspectRatio`, флаги, `meta` (поверхностное слияние). Смена ограничений прилепленного окна пересчитывает его зону. Что метод отклоняет и что считается изменением — ниже |
| `setViewport(size)` | `void` | пересчитывает геометрию развёрнутых и прилепленных окон, остальные прижимает; в историю не пишется никогда; размер с осью, которая не конечна или не больше 0 (например, у скрытого рабочего стола), игнорируется, и остаётся последний известный вьюпорт |

Бесконечное или нечисловое значение в состояние не попадает: `move`, `moveBy`, `resize`, `restoreTo` и `snapTo` с `NaN` или `Infinity` ничего не меняют и возвращают `false`. Частичный патч оставляет то, что в нём не названо: `wm.resize(id, { width: 400, height: undefined })` сохраняет высоту, как и `height: null`. Размеры никогда не становятся меньше 1 px, что бы ни говорил минимум.

`update(id, patch)` возвращает `false` и ничего не меняет при невозможном ограничении — ось `minSize` отрицательная, не конечная или отсутствует, ось `maxSize` не больше 0 или отсутствует (`Infinity` допустима) — и при неизвестном слое. `minSize` и `maxSize` сохраняются копиями, так что последующие изменения переданного объекта ни на что не влияют. Патч, после которого окно равно прежнему, ничего не делает: тот же объект, ни событий, ни записи в истории. Сравниваются значения, а не объекты: `update(id, { meta: { n: 1 } })` для окна, у которого `meta` уже равна `{ n: 1 }`, ничего не меняет, но значения, вложенные в `meta`, сравниваются по ссылке.

### Рабочие столы

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `workspace()` | `number` | индекс активного рабочего стола |
| `setWorkspace(n)` | `boolean` | `false`, если индекс не изменился или некорректен; фокусирует верхнее окно нового стола |
| `moveToWorkspace(id, n)` | `boolean` | `false` для неизвестного id или переноса на тот же стол |

Окна вне активного рабочего стола DOM-слой скрывает, а `focusTargets`, `minimized()`, `arrange()`, `minimizeAll()` и магнетизм при перетаскивании их пропускают.

### Вкладочные группы

Несколько окон могут делить одну рамку. Каждый участник сохраняет свой id, контент и заголовок,
но геометрия у них общая: видим всегда ровно один участник, а остальные ведут себя как скрытые окна.

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `group(ids)` | `string \| null` | `null`, если известных окон меньше двух; первый id — хост: группа перенимает его геометрию и стадию, а он становится активной вкладкой. Окно, которое уже состоит в группе, приводит с собой всю свою группу; если id уже составляют одну группу, возвращается её id, а активной вкладкой становится первый id |
| `ungroup(id)` | `boolean` | отделяет одного участника, остальные остаются в `order` подряд (испускается `order`); если в группе остаётся один участник, она распадается |
| `activateTab(id)` | `boolean` | делает участника видимой вкладкой; `false`, если он уже активен или не состоит в группе. Фокус переходит на вкладку, только если скрывающийся участник был в фокусе |
| `moveTab(id, index)` | `boolean` | переносит участника на другое место в порядке вкладок; индекс приводится к допустимому, `false` значит, что ничего не сдвинулось. Активная вкладка, фокус и геометрия не меняются |
| `cycleTab(direction?)` | `string \| null` | активирует следующую (`1`) или предыдущую (`-1`) вкладку группы окна в фокусе, по кругу; `null`, если окно в фокусе не в группе |
| `groupMembers(groupId)` | `readonly WindowState[]` | участники в порядке вкладок (снизу вверх по стопке) |

```ts
const groupId = wm.group(['editor', 'preview', 'console'])
wm.activateTab('preview')
wm.groupMembers(groupId).map((win) => win.title)
wm.ungroup('console')
```

Инварианты, которые менеджер поддерживает за вас:

- у всех участников общие `bounds`, `stage`, `snapZone`, `layer` и `workspace`: перемещение, ресайз,
  снэп, разворот или перенос на другой рабочий стол двигают всю группу за один шаг
- неактивные вкладки пропускают `focus`, `cycleFocus`, `minimized()`, `arrange()`, `minimizeAll()`,
  перерасчёт под вьюпорт и магнетизм при перетаскивании — так же, как окна другого рабочего стола;
  группа считается одной рамкой, которой управляет её видимая вкладка
- развёрнутая группа заполняет вьюпорт целиком, без учёта ограничений участников, как одиночное развёрнутое окно
- в остальных случаях рамка соблюдает ограничения каждого участника, а не только хоста: наибольший
  `minSize`, наименьший `maxSize` и наименьший `aspectRatio`; если минимум больше максимума, побеждает
  максимум. Это верно и для последующих перемещений, ресайзов и смен стадии: ресайз одной вкладки
  может увеличить рамку, но не загонит соседа ниже его минимума, а после отмены, после
  `hydrate(serialize())` и после смены вьюпорта рамка получается той же. События `resize` и `update`
  несут рамку, которую группа приняла на самом деле, а она не всегда совпадает с запрошенной
- окно, которое покидает группу или чья группа распалась, снова подгоняется под собственные ограничения
- `focus(id)` на неактивной вкладке сначала активирует её, поэтому DOM-фокус никогда не попадает на
  скрытый элемент; если фокус запретила модалка, активная вкладка не меняется
- участники идут в `order` подряд, поэтому переключение вкладок не меняет место рамки в стопке, а
  порядок вкладок задаёте вы: фокус, подъём или отправка рамки вниз его не перемешивают, это делает
  только `moveTab`
- закрытие активной вкладки передаёт активность соседней; закрытие предпоследнего участника
  распускает группу
- когда изменение скрывает окно в фокусе — рамку свернули через скрытого участника или перенесли на
  другой рабочий стол, — фокус переходит к самому верхнему окну, до которого ещё можно добраться

`ManagerState.groups` показывает текущую картину — из неё рендерится полоса вкладок:

```ts
interface WindowGroup {
  id: string
  activeId: string
  members: readonly string[]
}
```

Событие `group` срабатывает при создании группы, смене активной вкладки и изменении состава, в том числе когда участник закрывается и когда группа распадается (`members: []`, `activeId: ''`). Данные события —
`{ groupId, members, activeId, previous }`.

### История

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `undo()` / `redo()` | `boolean` | `false`, если стек пуст |
| `canUndo()` / `canRedo()` | `boolean` | |
| `clearHistory()` | `void` | очищает оба стека. Внутри `batch` история начинается заново с этого вызова, и отмена последующих изменений того же `batch` возвращает к нему. Во время жеста остаток жеста не записывается, а `abortInteraction()` восстанавливает историю, какой она была до жеста, и тем самым возвращает очищенное |
| `beginInteraction()` / `endInteraction()` | `void` | собирают жест в одну запись; допускают вложенность. Взаимодействие, после которого состояние равно исходному, записи не оставляет, и стек повтора сохраняется |
| `abortInteraction()` | `void` | на внешнем уровне завершает взаимодействие и выбрасывает его запись — для отменённых жестов. Изменения, сделанные внутри, остаются в состоянии и не становятся отдельным шагом, поэтому откатите их сами до вызова (контроллер так и делает по Escape). Во вложенном взаимодействии только выходит из внутреннего уровня, а внешнее сохраняет свою единственную запись |

Шаги, которые меняют только фокус и порядок наложения, идущие подряд, сливаются: три клика по другим окнам после перемещения оставляют два шага отмены — перемещение и один шаг фокуса.

`hydrate()` и `loadLayout()` очищают историю: отменить что-то сквозь восстановление нельзя. `undo()` и `redo()` внутри `batch` или взаимодействия работают так, будто `batch` или взаимодействие закончилось прямо перед вызовом и началось заново сразу после него, поэтому остаток жеста становится новым шагом.

### Раскладки и расстановка

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `saveLayout(name)` | `SerializedState` | сохраняет снапшот под именем `name` и возвращает его |
| `loadLayout(name)` | `boolean` | `false`, если имя неизвестно |
| `getLayout(name)` | `SerializedState \| undefined` | независимая копия |
| `setLayout(name, data)` | `boolean` | проверяет данные так же, как `hydrate` |
| `deleteLayout(name)` / `layoutNames()` | `boolean` / `string[]` | |
| `arrange(mode)` | `void` | `'cascade'` ставит окна лесенкой от `cascadeOrigin`; `'tile'` раскладывает по сетке `ceil(sqrt(n))`. Оба пропускают свёрнутые окна, другие рабочие столы и окна, прилепленные к заданному прямоугольнику (`snapTo`, панели дока); подробнее ниже |
| `minimizeAll()` / `restoreAll()` | `void` | активный рабочий стол, одна запись истории. `minimizeAll` пропускает окна с `minimizable: false`; `restoreAll` испускает не больше одного `order` |

`arrange` испускает `move` и `resize` для каждого окна, которое ставит, один раз поднимает расставленные окна и фокусирует последнее из них, а если открыта модалка — её; повторный вызов без изменений ничего не делает. `arrange`, `minimizeAll`, `restoreAll` и `closeAll` работают за линейное от числа окон время, если вкладочных групп нет.

Раскладки хранятся в памяти. Сохраняйте их сами через `getLayout`/`setLayout` или используйте плагин persist для живого рабочего стола. Раскладки копируются через `structuredClone`, поэтому циклические значения, `Date` и `Infinity` в `meta` или в расширении сохраняются. Если значение клонировать нельзя (например, функцию), копия делается через JSON: функции пропадают, `Date` превращаются в строки, а `Infinity` — в `null`.

### Чтение и подписка

| Метод | Возвращает | Заметки |
| --- | --- | --- |
| `get(id)` | `WindowState \| undefined` | |
| `getState()` | `ManagerState` | кэшируется до следующего изменения |
| `minimized()` | `readonly WindowState[]` | активный рабочий стол, по `openedSeq` — порядок таскбара |
| `serialize()` | `SerializedState` | |
| `hydrate(data)` | `boolean` | чинит или отклоняет данные, как описано в разделе [SerializedState](#serializedstate), пересчитывает геометрию под вьюпорт и сообщает о разнице событиями (см. [События](#события)) |
| `subscribe(fn)` | `() => void` | один вызов на каждую зафиксированную транзакцию; изменения, которые слушатели вносят во время рассылки, могут прийти одним вызовом. Транзакция, которая только испускает события (например, заблокированный `focus`), доставляет их без `change` |
| `on(event, fn)` | `() => void` | гранулярные события, см. ниже. Если подписать одну и ту же функцию дважды, получатся две подписки, и каждая возвращённая функция снимает только свою |
| `batch(fn)` | `void` | один `change`, одна запись истории, события рассылаются в конце |
| `setExtension(key, value)` | `void` | хранит состояние плагина в `getState().extensions[key]`; оно сериализуется, восстанавливается `hydrate` и пишется в историю, поэтому изменение плагина и изменения окон в одном `batch` отменяются вместе. `undefined` удаляет ключ; то же значение ничего не меняет |

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

Порядок внутри одной транзакции: конкретные события срабатывают в том порядке, в каком всё происходило, а `change` — последним. В данных событий лежит состояние после изменения.

`focus` срабатывает, только когда меняется `focusedId`, поэтому `previous` никогда не равен самому окну; подъём окна, которое уже в фокусе, испускает только `order`. Событие срабатывает и для `undo`, `redo`, `hydrate` и `loadLayout`, если фокус переходит, и когда `open` позади модалки передаёт фокус модалке. `modalblocked` испускает только заблокированный вызов `focus()`.

Модалка, которая становится верхней через `update(…, { layer })` или `moveToWorkspace` (любая вкладка модальной группы), забирает фокус; если модалку в фокусе понизить до обычного слоя, фокус переходит к следующей видимой модалке.

Вызов из слушателя встаёт в очередь за событиями, которые уже доставляются, а его `change` несёт последнее состояние (и может совпасть с `change` внешнего вызова). Если слушатель бросает исключение, остальные события и `change` всё равно доставляются, а первая ошибка пробрасывается из вызова, который их запустил; ошибка при доставке событий вложенного вызова всплывает в самом внешнем вызове. Слушатели того же события, подписанные после бросившего, пропускаются. Если слушатели меняют состояние 10 000 раундов доставки подряд, вызов бросает `wmkit: listeners keep changing the state`: состояние остаётся зафиксированным, а недоставленные события уходят со следующей транзакцией.

`open` и `close` сообщают о любом появлении и исчезновении окна, а не только о вызовах с теми же именами: `hydrate`, `loadLayout`, `undo` и `redo` тоже сообщают, что изменили. Поэтому если монтировать контент на `open` и освобождать на `close`, это остаётся верным при любых переходах по истории. В данных их `open` уже лежит итоговая геометрия, и появившееся окно не получает `move` или `resize` раньше своего `open`. `attachWindow` можно вызывать прямо из обработчика `open`.

Эти четыре вызова сохраняют объект каждого окна, которое не изменили (так что `previous === next` между ними выполняется), а об изменённых окнах сообщают гранулярными событиями: для каждого окна `close` либо `stage` (с той стадией, которая действительно была до этого), `move`, `resize` и `update`; затем `open` для появившихся окон, один `order`, если поменялся порядок наложения, `group` для каждой изменившейся группы и `focus`. `restoreTo` испускает `stage`, только когда стадия меняется, а `move` и `resize` — для той геометрии, которая изменилась.

Контроллер переносит настоящий DOM-фокус в окно, о котором сообщает `focus`. Поэтому если приложение применяет снапшоты с сервера через `hydrate` или `loadLayout`, пока пользователь печатает, фокус уйдёт из поля ввода.

## `attachDesktop(wm, element, options?)`

Привязывает менеджер к поддереву DOM и возвращает `DesktopController`. Элемент становится системой координат; он получает `data-wm-desktop`, `tabindex="-1"` и `position: relative`, если был `static`. Координаты указателя учитывают рамку элемента, его прокрутку и масштабирование через `transform`.

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
    tabShortcuts?: boolean    // true — Ctrl/Cmd+Alt+PageDown/PageUp
  }
  announce?: boolean | Partial<AnnouncerMessages>
  autoViewport?: boolean      // true — ResizeObserver drives setViewport
  hitAreas?: { edge?: number; corner?: number }  // 8/12, or 16/24 on coarse pointers
  magnetism?: boolean | { threshold?: number }   // 8, or 12 on coarse pointers
  stacking?: {
    base?: number      // 0 — z-index of the desktop floor
    gap?: number       // 32 — room left between neighbours for cheap reordering
    isolate?: boolean  // true — isolation:isolate so window layers stay inside the desktop
    deep?: number | false  // 12 — windows further below the top carry data-wm-deep; false turns it off
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

Вложенные объекты опций экспортируются как типы: `GroupingOptions`, `DesktopSnapOptions`, `DesktopKeyboardOptions`, `HitAreaOptions`, `MagnetismOptions`, `StackingOptions` и `AnimationOptions`.

`beforeClose` спрашивают каждый раз, когда окно закрывает пользователь: кнопкой `data-wm-close`, через `desktop.actions(id).close()` и через действие закрытия, которое получает скин. Прямой вызов `wm.close(id)` его не спрашивает. Если `ResizeObserver` нет, `autoViewport` измеряет элемент один раз при привязке и дальше за ним не следит.

### Жесты

Своих жестов у рабочего стола нет. Передайте нужные — и только они попадут
в ваш бандл.

```js
import { attachDesktop } from '@surdeddd/wmkit'
import { touchGestures } from '@surdeddd/wmkit/gestures'

attachDesktop(wm, root, { gestures: [touchGestures({ swipe: { workspaces: 4 } })] })
```

`@surdeddd/wmkit/gestures` экспортирует три фабрики: `pinch(options?)`,
`swipe(options?)` и `touchGestures({ pinch, swipe })` — если нужны оба жеста от
одного слушателя. Их опции описаны типами `PinchOptions` и `SwipeOptions`.

| Опция | По умолчанию | Смысл |
| --- | --- | --- |
| `pinch.threshold` | `12` | насколько должны разойтись пальцы, прежде чем начнётся ресайз |
| `pinch.lockTouchAction` | `false` | ставить на рабочий стол `touch-action: none` вместо `pan-x pan-y` (любой жест двумя пальцами ставит `pan-x pan-y`; `pinch()` и `swipe()` вместе возвращают исходное значение при уничтожении) |
| `swipe.threshold` | `72` | какое расстояние два пальца должны пройти вбок |
| `swipe.workspaces` | `0` | без верхней границы; задайте, чтобы жест останавливался на последнем рабочем столе |

Поднятый палец слушается на `window` страницы в фазе перехвата, поэтому контент, который вызывает `stopPropagation()` на `pointerup`, не оставит жест с пальцем, которого уже нет, а новое первое касание сбрасывает пальцы, оставшиеся от прошлого раза.

Жест — это функция. Она получает `GestureContext` и возвращает функцию,
которая его снимает, поэтому свои жесты пишутся так же, как встроенные:

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

Именно `claim` не даёт жестам спорить со встроенными перетаскиванием и ресайзом:
рабочий стол ведёт одно взаимодействие за раз, а `busy()` говорит, занято ли оно.
`claim` во время перетаскивания или ресайза отменяет их. `toLocal` возвращает координаты рабочего стола — те же, в которых задана геометрия окон.

```ts
interface DesktopController {
  element: HTMLElement
  wm: WindowManager
  attachWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  mountWindow(id: string, skin: WindowSkin | string, options?: WindowAttachOptions): MountedWindow
  actions(id: string): WindowActions
  addDropTarget(target: DropTarget): () => void
  destroy(): void
}

interface WindowAttachOptions {
  handle?: HTMLElement | string   // defaults to [data-wm-drag]
  resizeHandles?: boolean         // true
  removeOnClose?: boolean         // false for attachWindow, true for mountWindow
}
```

`attachWindow` бросает исключение для неизвестного id, для id, который уже привязан, для элемента, который уже управляет другим окном (`wmkit: window "<id>" is already attached`), и после `destroy()` (`wmkit: the desktop is destroyed`). Метод возвращает функцию отвязки. `destroy()` отвязывает всё, отменяет идущий жест и удаляет превью снэпа, а элементы теряют `data-wm-window` и `data-wm-focused` точно так же, как при отвязке. Если окно ещё существует, отвязка заодно снимает `hidden` с его элемента.

Окно, которое закрыл менеджер, — в том числе убранное через `undo`, — отвязывается за вас: уходят его слушатели и ручки ресайза, а элемент теряет `data-wm-window`, чтобы его никто не принял за живое окно. Сам элемент остаётся на странице, если вы не передали `removeOnClose`, а выданную вам функцию отвязки можно безопасно вызвать снова когда угодно — даже после того, как вы привязали тот же элемент к другому окну, или после `desktop.destroy()`. Передавайте `removeOnClose` только для элементов, которые создали сами; почему — см. [createDesktopBinder](#createdesktopbinderwm-options).

### `desktop.actions(id)`

Те же десять действий, что у менеджера, но уже привязанные к одному окну, поэтому обработчику кнопки не нужно помнить id:

```js
const act = desktop.actions('notes')
closeButton.onclick = () => act.close()
```

`focus`, `close`, `minimize`, `maximize`, `toggleMaximize`, `restore`, `center`, `sendToBack`, `snap(zone)` и `moveToWorkspace(n)`. Каждое возвращает тот же boolean, что и менеджер, а после исчезновения окна возвращает `false`, а не бросает исключение. `close()` сначала спрашивает `beforeClose` и возвращает `false`, если тот отказал.

### `desktop.addDropTarget(hit)`

```ts
type DropTarget = (clientX: number, clientY: number, id: string, local: { x: number; y: number }) => DropHit | null
interface DropHit {
  preview: Bounds   // desktop-local rectangle shown while the pointer is over the target
  commit(): void    // runs when the drag ends there
}
```

Позволяет плагину перехватить перетаскивание окна. На каждом кадре перетаскивания цели опрашиваются в порядке добавления, раньше группировки во вкладки и снэпа, и побеждает первое попадание: его `preview` рисуется элементом превью снэпа с пометкой `data-wm-drop`, а его `commit` выполняется ровно один раз, когда указатель отпускают над целью. `local` — положение указателя в координатах рабочего стола, тех же, в которых задана геометрия окон; цель, написанная с тремя параметрами, тоже работает. Отменённое перетаскивание (Escape, потерянный указатель) ничего не применяет. Превью цели показывается даже при `snap: { preview: false }`. Метод возвращает функцию, которая удаляет цель. На нём построен плагин dock.

### Управление окном из разметки

Любой элемент внутри окна может нести один из этих атрибутов, и контроллер выполнит действие без вашего слушателя:

| атрибут | действие |
| --- | --- |
| `data-wm-close` | закрывает окно, предварительно спросив `beforeClose` |
| `data-wm-minimize` | сворачивает его |
| `data-wm-maximize` | разворачивает или восстанавливает |
| `data-wm-restore` | возвращает к сохранённой геометрии |
| `data-wm-center` | ставит в центр вьюпорта |
| `data-wm-send-back` | опускает в самый низ стопки |
| `data-wm-snap="left"` | прилепляет к этой зоне, если окно это допускает |
| `data-wm-to-workspace="2"` | переносит на этот рабочий стол |

Атрибут действует только на окно, в котором находится, даже если один рабочий стол вложен в окно другого. Неизвестная зона снэпа игнорируется, а не бросает исключение, так что опечатка в шаблоне не обрушит страницу. Кнопки и клавиатура работают так же и для рабочего стола из другого документа — например, из iframe того же источника или из всплывающего окна, в которое приложение рендерит через портал.

### `desktop.mountWindow(id, skin, options?)`

Собирает элемент окна из скина, вместо того чтобы брать готовый.

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

`skin` — это либо фабрика, либо имя фабрики, зарегистрированной в `attachDesktop(wm, root, { skins })`; незарегистрированное имя бросает исключение. Если `meta.skin` меняется на незарегистрированное имя или на фабрику, которая бросает исключение, ошибка вылетает один раз — из вызова, который внёс изменение: окно сохраняет текущий скин и полностью управляется дальше, а контроллер не пробует снова, пока `meta.skin` не изменится ещё раз. Если в одной транзакции скин меняют несколько окон и одно из них падает, остальные всё равно пересобираются, а порядок наложения и фокус этого прохода применяются; первая ошибка бросается, когда проход закончен. Возвращённые `element` и `content` живые: после пересборки окна они указывают на новые узлы, так что ссылка, взятая при монтировании, не устаревает. Хэндл закрытого окна продолжает указывать на последние узлы и никогда не подхватывает новое окно с тем же id.

Окно пересобирается, когда `meta.skin` меняется на другое зарегистрированное имя или когда вы снова вызываете `mountWindow` для того же id. В обоих случаях дочерние элементы контента переезжают, id, геометрия, фокус и порядок наложения сохраняются, а `destroy` предыдущего скина вызывается после замены. Окна, которые вы привязали сами через `attachWindow`, никогда не пересобираются без вашего ведома. Если смонтировать окно под именем, отличным от `meta.skin`, так и останется: при следующем изменении это не исправляется.

`destroy` скина вызывается ровно один раз: после замены при пересборке, при закрытии, при `detach()` или при `desktop.destroy()` — смотря что наступит раньше.

### Что пишет контроллер

На элементе окна: `data-wm-window`, `data-wm-stage`, `data-wm-layer`, `data-wm-workspace`, `data-wm-focused`, `data-wm-dragging`, `data-wm-resizing`, `data-wm-flash`, `data-wm-variant` (если `windowVariant` вернул имя), `data-wm-group` и `data-wm-tab` (у окон в группе), `data-wm-tab-target` (у окна, с которым перетаскивание объединит перетаскиваемое), `data-wm-live`, `data-wm-deep`, `hidden`, `role="dialog"`, `tabindex="-1"`, `aria-label`, `aria-labelledby` (если `[data-wm-title]` лежит в том же корне, что и окно; заголовок внутри теневого корня передаётся через `aria-label`), `aria-modal` на модальном слое, а также инлайн-стили `transform`, `width`, `height`, `z-index`. Первая синхронизация ненадолго ставит `transition: none`, а инлайн-`transition`, заданный вашим приложением, потом восстанавливается. Значения атрибутов перечислены в разделе [Темизация](theming.ru.md#контракт-атрибутов); плагины добавляют свои (`data-wm-pinching`, `data-wm-docked`, `data-wm-skin`).

<span v-pre>В `[data-wm-title]` контроллер заменяет только текст заголовка, поэтому иконка или постоянный текст рядом с ним остаются на месте: `<span data-wm-title><i class="icon"></i> {{title}}</span>`. Старый заголовок ищется по тексту, так что если постоянный текст перед заголовком содержит ту же строку, заменится он.</span>

`data-wm-flash` ставится, когда модалка блокирует взаимодействие, и остаётся до следующего заблокированного взаимодействия или до отвязки окна. Поэтому оформляйте вспышку анимацией, которая проигрывается один раз на каждую установку атрибута, а не статичным правилом.

`data-wm-live` стоит на всех привязанных окнах, пока у элемента рабочего стола меняется размер (путь `autoViewport`): атрибут ставится до того, как менеджер узнаёт новый вьюпорт, и снимается через кадр после кадра, отрисовавшего последнее изменение, а каждое новое изменение продлевает его. Пока он стоит, темы отключают переход геометрии, и окна поспевают за изменением размера, а не догоняют его с опозданием. Контроллер никогда не снимает `data-wm-live`, который поставил не он, так что плагин или приложение могут держать его во время своих живых правок.

`data-wm-deep` отмечает видимые окна текущего рабочего стола, которые лежат в стопке больше чем на `stacking.deep` мест ниже верхнего: при значении по умолчанию `12` у 13 верхних видимых окон его не бывает. На скрытых окнах его нет никогда, а при отвязке он снимается. Темы с `backdrop-filter` убирают у таких окон размытие, см. [Темизация](theming.ru.md#большие-рабочие-столы-и-изменение-размера).

Контроллер переносит фокус клавиатуры в окно, когда менеджер фокусирует его или когда нажимают на его тайтлбар или ручку, и возвращает фокус тому элементу управления окна, у которого он был последним; нажатие в контент остаётся на усмотрение браузера. Когда окно закрывается или скрывается, контроллер переносит фокус на рабочий стол. Сгенерированные id заголовков выглядят как `wmkit-title-<id>-<n>` и уникальны на странице.

Под видимой модалкой DOM-слой отклоняет действия указателем в нижних окнах: нажатия, перетаскивание, ресайз, двойные клики и клики средней кнопкой, action-атрибуты и меню тайтлбара. В ответ на заблокированное нажатие модалка мигает. Клавиатурный ввод в нижние окна не блокируется: Tab, пришедший снаружи рабочего стола, или ввод в элемент управления, у которого уже был фокус. Tab внутри модалки ходит по её элементам управления, включая элементы с `position: fixed`. Если первая или последняя остановка модалки — `iframe`, Tab может уйти изнутри фрейма, потому что события клавиш внутри фрейма не доходят до родительского документа.

Фреймы внутри окон (`iframe`, `object`, `embed`) не отдают странице свои события указателя и клавиатуры, поэтому контроллер следит, куда уходит фокус: пока указатель над фреймом, а также один раз всякий раз, когда страница теряет фокус, фрейм, который только что получил фокус, поднимает и фокусирует своё окно. Слежение прекращается, когда указатель покидает фрейм, а фрейм, у которого фокус уже был, не забирает его обратно после `wm.blur()` или при открытии другого окна. Под видимой модалкой фреймы в нижних окнах получают `pointer-events: none`, пока модалка не уйдёт, так что клик не доберётся до их содержимого. Это касается и окон, привязанных при открытой модалке; фрейм, добавленный в нижнее окно, закрывается со следующего изменения состояния этого окна, а значение `pointer-events`, которое задало приложение, потом возвращается.

### Тач

Любой жест работает на событиях указателя, поэтому палец и мышь идут одним путём. Ручка перетаскивания и ручки ресайза получают `touch-action: none` — именно это не даёт браузеру прокручивать страницу из-под перетаскивания, — а на грубых указателях хит-зоны увеличиваются: выше у значений по умолчанию указаны оба числа. Одновременно идёт только один жест: второй палец, опустившийся на другой тайтлбар посреди перетаскивания, полностью игнорируется — он не начинает второе перетаскивание, не фокусирует и не поднимает то окно. Перетаскивание или ресайз, у которых `setPointerCapture` бросает исключение, не начинаются, а потеря захвата указателя отменяет жест так же, как `pointercancel`. Нажатие на элемент управления внутри веб-компонента в тайтлбаре не начинает перетаскивание (настоящая цель читается через `composedPath()`). Долгое нажатие порождает событие `contextmenu`, как и везде, — из него и вызывается `onTitlebarContextMenu`, а собственное меню браузера подавляется за вас.

Группировка перетаскиванием ищет цель по геометрии окон, а не через hit-test страницы: это самое верхнее видимое окно этого рабочего стола под указателем, и только пока указатель над его ручкой перетаскивания. Элементы страницы, лежащие поверх тайтлбара, ей не мешают, а модальное окно не группируется никогда — ни как перетаскиваемое, ни как цель.

Конец перетаскивания или ресайза (`pointerup`, `pointercancel`, `lostpointercapture`) слушается на документе в фазе перехвата, поэтому жест корректно завершается, даже если его ручку убрали со страницы посреди движения. Escape возвращает ровно то состояние, с которого жест начался, — стадию, геометрию, `restoreBounds`, зону снэпа и `snapRect`, в том числе для окна, развёрнутого поверх `snapRect`, — и клавиша не доходит до обработчиков страницы. Если окно закрывается посреди собственного перетаскивания или ресайза или из `commit` цели сброса, жест считается применённым: один шаг отмены возвращает окно туда, где оно было до жеста.

Сам элемент рабочего стола получает `isolation: isolate`, поэтому значения `z-index`, которые пишет контроллер, остаются внутри него и не спорят со слоями страницы. Отключите это через `stacking: { isolate: false }`, если рабочий стол должен делить контекст наложения с окружающей страницей.

Подъём окна переписывает ровно один `z-index`: значения разнесены на `gap` друг от друга, и контроллер перенумеровывает только окна, которые действительно поменялись местами, а когда места не хватает, перенумеровывает все. Поэтому по `z-index` окна можно судить только о его относительном положении.

Кроме того, контроллер вставляет ручки `[data-wm-resize]`, один `[data-wm-snap-preview]` на рабочий стол и один визуально скрытый live-регион `[data-wm-announcer]`. `<header>`, `<footer>`, `<nav>` или `<aside>` в роли ручки перетаскивания получают `role="presentation"`, чтобы ориентир не выходил за пределы диалога.

### Клавиатура по умолчанию

| Клавиши | Действие |
| --- | --- |
| стрелки | двигают окно в фокусе на `moveStep`; только пока фокус клавиатуры на самом элементе окна или внутри его тайтлбара, поэтому списки, слайдеры и прокручиваемые области в контенте сохраняют свои стрелки; во время перетаскивания или ресайза указателем не работают |
| `Alt` + стрелки | сдвиг на 1 px |
| `Shift` + стрелки | ресайз |
| `Ctrl`/`Cmd` + `Alt` + `←`/`→` | прилепить к половине |
| `Ctrl`/`Cmd` + `Alt` + `↑`/`↓` | развернуть / свернуть или восстановить |
| `Ctrl`/`Cmd` + `Alt` + `PageDown`/`PageUp` | следующая / предыдущая вкладка группы окна в фокусе |
| `Ctrl`/`Cmd` + `Z`, `+ Shift` | отмена, повтор; работает и на нелатинских раскладках — через клавишу, на которой в латинице Z |
| `F6`, `Shift` + `F6` | обход окон; не во время перетаскивания |
| `Escape` во время жеста | отменить жест и убрать его из истории |
| двойной клик по ручке | развернуть или восстановить |

Удержание стрелки — один шаг отмены: шаг заканчивается на `keyup`, на любой другой клавише, когда фокус переходит в другое место и когда окно браузера теряет фокус.

Сочетания клавиш — отмена и повтор, снэп, вкладки — никогда не срабатывают в полях редактирования (`input`, `textarea`, `select`, `[contenteditable]`), что бы ни говорил `interactiveSelector`, и пропускают событие, у которого уже вызван `preventDefault()`. Если приложение само обрабатывает `Ctrl+Z`, например на холсте, оно вызывает `preventDefault()` в слушателе, который срабатывает раньше слушателя рабочего стола: на самом холсте или в фазе перехвата. На кнопке внутри окна `Ctrl+Z` выполняет отмену. Стрелки, кроме того, не работают на всём, что подходит под `interactiveSelector`. `F6` и `Shift+F6` переключают окна откуда угодно, в том числе из поля ввода, потому что именно так пользователи клавиатуры из него выходят.

## `createDesktopBinder(wm, options?)`

Обёртка, которой не важен порядок вызовов; её используют адаптеры. Привязывайте окна до или после появления рабочего стола и до или после открытия окна.

```ts
interface DesktopBinder {
  wm: WindowManager
  controller(): DesktopController | null
  bindDesktop(element: HTMLElement): () => void
  bindWindow(id: string, element: HTMLElement, options?: WindowAttachOptions): () => void
  destroy(): void
}
```

`bindDesktop` бросает исключение, если рабочий стол уже привязан. Рабочий стол можно отвязать и привязать снова — биндер переподписывается, и поэтому двойное монтирование в React StrictMode ничего не ломает. Отвязка рабочего стола сохраняет привязки окон, и они подключаются к следующему элементу рабочего стола.

- Привязанный элемент без родителя (например, удалённый через `removeOnClose` при закрытии окна) добавляется в элемент рабочего стола, когда его окно подключается, поэтому окно, вернувшееся через отмену или повторное открытие, снова видно. Элементы, которые ещё лежат в каком-то дереве, остаются на месте, даже если это дерево вне документа. Элемент возвращается прямым потомком рабочего стола, а не в обёртку, в которой жил, поэтому используйте `removeOnClose` только для узлов, которые создали сами, и никогда — для узлов, которые рендерит фреймворк. Фреймворк удаляет свои узлы сам: рендерите окно, только пока оно существует, как во всех примерах раздела [Адаптеры](adapters.ru.md).
- Когда окно открывается, подключается только первый элемент, привязанный к этому id, поэтому `wm.open` никогда не бросает исключение из-за биндера. Когда подключённый элемент отвязывается, его место занимает следующий элемент, привязанный к тому же id.
- Вызов `bindWindow`, который бросил исключение (например, «already attached»), не оставляет привязки.

## Хелперы геометрии

Чистые функции без DOM — для собственной логики раскладки.

```ts
clamp(value, min, max): number
clampSize(size, min, max: Size | null): Size
clampToViewport(bounds, viewport, minVisible): Bounds
boundsEqual(a, b): boolean
zoneBounds(zone, viewport): Bounds
applyAspect(size, ratio, min, max, drive: 'width' | 'height'): Size
detectSnapZone(x, y, viewport, options?: SnapDetectOptions): SnapZone | null
magnetize(bounds, targets: readonly Bounds[], threshold): MagnetResult
interface SnapDetectOptions { threshold?: number; cornerSize?: number }
```

`zoneBounds` делит без остатка: половины, четверти и трети в сумме дают вьюпорт без зазоров и наложений даже при нечётных размерах. `clampToViewport` оставляет досягаемыми `minVisible` пикселей и никогда не выталкивает окно уже этого значения за оба края. `magnetize` возвращает `{ x, y, snappedX, snappedY }` и выравнивает любую пару краёв в пределах `threshold`.

## Хелперы анимации

```ts
prefersReducedMotion(win: Window): boolean
flipToTarget(source: HTMLElement, target: Element, options?: FlipGhostOptions): void
flipFromTarget(source: HTMLElement, target: Element, options?: FlipGhostOptions): void
interface FlipGhostOptions { duration?: number; easing?: string }
```

Обе функции рисуют одноразовый элемент-призрак и удаляют его по завершении или отмене анимации. Они ничего не делают при reduced motion, без `Element.animate` или если у одного из двух прямоугольников нулевая ширина. `attachDesktop` вызывает их за вас, когда задан `minimizeTarget`.

## Announcer

```ts
createAnnouncer(wm, container, messages?: Partial<AnnouncerMessages>): Announcer
const defaultMessages: AnnouncerMessages   // the English catalogue

interface AnnouncerMessages {
  opened(title: string): string
  closed(title: string): string
  minimized(title: string): string
  restored(title: string): string
  maximized(title: string): string
  snapped(title: string, zone: string): string
  focused(title: string): string
  workspace(index: number): string
  openedMany?(count: number): string     // '5 windows opened'
  closedMany?(count: number): string
  minimizedMany?(count: number): string
  restoredMany?(count: number): string
}

interface Announcer {
  element: HTMLElement
  announce(message: string): void
  destroy(): void
}
```

`attachDesktop` создаёт его, если не задано `announce: false`; для локализации передайте объект. Сообщение со значением `undefined` (`announce: { opened: undefined }`) выключает анонс этого события. Сообщение о стадии или рабочем столе всегда побеждает сообщение о фокусе из той же транзакции, поэтому регион никогда не зачитывает «в фокусе» поверх «развёрнуто». Два одинаковых анонса подряд всё равно меняют текст live-региона (в конце переключается неразрывный пробел), так что скринридер произносит оба.

Когда в одной транзакции открывается, закрывается, сворачивается или восстанавливается несколько окон, регион зачитывает одну сводку, а не сообщение последнего окна. Английские сводки используются, только пока соответствующее одиночное сообщение — стандартное: если вы заменили `opened`, стандартный `openedMany` отключается, и регион зачитывает сообщение последнего окна. Поэтому в переведённый каталог стоит положить и свои сводки.

## Emitter

```ts
createEmitter<Events>(): Emitter<Events>
interface Emitter<Events> {
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void
  emit<K extends keyof Events>(event: K, payload: Events[K]): void
  clear(): void
}
type Listener<T> = (payload: T) => void
```

Перед рассылкой список слушателей копируется, поэтому подписываться и отписываться внутри обработчика безопасно. Если подписать одну и ту же функцию дважды, получатся две подписки, и каждая возвращённая функция снимает только свою. Для событий самого менеджера к этому добавляются правила повторного входа и обработки ошибок из раздела [События](#события).

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

<span v-pre>Подстановки: `{{title}}`, `{{id}}`, `{{stage}}`, `{{layer}}`, `{{workspace}}` и `{{variant}}`. Каждая подстановка экранируется как HTML, и отключить это нельзя (`{` тоже экранируется), так что заголовок окна никогда не протащит разметку в обвязку вокруг себя. Неизвестная подстановка превращается в пустую строку, а не бросает исключение, потому что шаблон переживает переименования.</span>

Подстановка может стоять только в тексте или в значении *в кавычках* у `aria-*`, `data-*`, `title`, `alt`, `class`, `id`, `role`, `lang`, `dir`, `for`, `value`, `placeholder` или `label`. В любом другом месте `compileTemplate()` и `skin()` бросают ошибку с именем подстановки и разметкой перед ней: значение без кавычек, имя тега или атрибута, любой другой атрибут (URL, `style`, `on*`, `srcdoc` …), комментарий, содержимое `script`, `style`, `textarea`, `title`, `xmp`, `iframe`, `noembed`, `noframes` и `plaintext`, всё после `<noscript>`.

<span v-pre>Внутри SVG и MathML компилятор следует правилам HTML-парсера для foreign content и отказывается от шаблона везде, где браузер может построить не то дерево, которого ждёт компилятор. Ошибку вызывает подстановка после элемента с сырым текстом (`textarea`, `style`, `script`, `xmp`, `iframe`, `noembed`, `noframes`, `plaintext`) внутри SVG. А если в разметке встретились `<math>`, `<select>`, HTML-тег прямо внутри `<svg>`, закрывающий тег без пары или `<a>` внутри `foreignObject`, `desc` или `title`, ошибку вызывает и подстановка после любого дальнейшего элемента с сырым текстом, секции CDATA или `<title>` с разметкой внутри. `<svg><title>{{title}}</title></svg>`, обычные встроенные иконки и HTML внутри `foreignObject` работают.</span>

Внутри тега его части можно разделять только пятью символами, которые HTML считает пробельными: табуляцией, переводом строки, переводом страницы, возвратом каретки и пробелом. Любой другой, например случайно набранный неразрывный пробел, вызывает ошибку `wmkit: a tag may only be spaced with tab, line feed, form feed, carriage return or space (U+00A0 after '<div title=')`.

<span v-pre>Дальше за состоянием следует только `{{title}}` внутри `[data-wm-title]`. Все остальные подстановки вычисляются при монтировании или пересборке и потом устаревают, включая `aria-label="Close {{title}}"`.</span>

Шаблон должен содержать ровно один атрибут `[data-wm-content]` (упоминание в тексте, комментарии или значении атрибута не считается) и один корневой элемент. Иначе `skin()` бросает ошибку ещё при написании шаблона, а не теряет ваш контент молча; лишние корни бросают `wmkit: a skin template needs a single root element …` при монтировании. `styles` без `name` тоже вызывает ошибку: правилам было бы не к чему привязаться.

Каждый вызов `skin()` владеет своим `<style data-wm-skin-styles="<name>">` в каждом документе, поэтому два скина с одинаковым именем получают по собственному тегу, а стили изменённого скина действительно применяются. Тег удаляется, когда последнее окно в этом скине отвязывается, пересобирается в другой скин или уничтожается вместе с рабочим столом.

С `shadow: true` обвязка собирается внутри открытого теневого корня. Корневой элемент шаблона разворачивается, так что `:host` — это бокс, в котором лежат тайтлбар и контент. Ваш контент — собственный элемент `[data-wm-content]` шаблона (с его атрибутами и дочерними элементами по умолчанию): он переносится в light DOM и проецируется через `<slot>`, поставленный на его место, так что теневой CSS достаёт до него как `::slotted([data-wm-content])`. Стили становятся одной constructable stylesheet на скин в каждом документе, а там, где constructable stylesheets нет, вместо неё используется элемент `<style>`.

## `themeNames`, `themeStyle(name, options?)` — `@surdeddd/wmkit/themes`

Шестнадцать встроенных таблиц стилей в виде строк — для скинов, до которых не дотягивается таблица стилей в `document.head`.

```ts
const glassTheme: string                         // one export per theme: amberTheme … terminalTheme
const glassShadowTheme: string                   // and per shadow flavour: amberShadowTheme … terminalShadowTheme
const themeNames: readonly ThemeName[]
const themeCss: Record<ThemeName, string>        // byte for byte the .css files
const themeShadowCss: Record<ThemeName, string>  // the same rules re-anchored to :host
function themeStyle(name: ThemeName, options?: ThemeStyleOptions): string
interface ThemeStyleOptions { shadow?: boolean }
```

Каждая тема — отдельный экспорт в обоих вариантах, `<name>Theme` и `<name>ShadowTheme`, поэтому бандлер оставит только те темы, которые вы импортировали: `import { retroShadowTheme } from '@surdeddd/wmkit/themes'`. `themeStyle`, `themeCss` и `themeShadowCss` находят тему по имени, поэтому любой из них приносит в бандл все тридцать две строки.

Для теневого скина передайте `{ shadow: true }` или возьмите экспорт `ShadowTheme`. Кастомные свойства наследуются через теневую границу, поэтому обычный текст доставляет токены темы, но ни одного её правила: каждое правило написано от `[data-wm-window]`, а внутри теневого корня этого атрибута нет ни у одного элемента. См. [Темизация](theming.ru.md).

## `persist(wm, options?)` — `@surdeddd/wmkit/persist`

```ts
interface PersistOptions {
  key?: string             // 'wmkit'
  storage?: PersistStorage // localStorage, when reading it does not throw
  debounce?: number        // 150 ms
  maxWait?: number         // 2000 ms; Infinity removes the bound
  autoRestore?: boolean    // true
  version?: number         // 0
  migrate?: (state: unknown, from: number) => SerializedState | null
  onError?: (error: unknown, phase: 'load' | 'migrate' | 'save') => void  // globalThis.reportError
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

В хранилище лежит объект `{ version, state }`. Данные с другой `version` передаются в `migrate`; если он возвращает `null` (или `migrate` не задан), данные отбрасываются, а не восстанавливаются сломанными, а успешная миграция сразу записывается обратно. Данные, записанные до появления этой обёртки, по-прежнему читаются — как версия `0`.

Изменение сохраняется через `debounce` мс после последнего; при непрерывном потоке изменений сохранение всё равно происходит не реже чем раз в `maxWait` мс. Отложенное сохранение выполняется на `pagehide` и при `destroy()`; `clear()` ещё и отменяет отложенное сохранение.

Плагин никогда не бросает исключений. Если хранилища нет, плагин ничего не делает, а любой сбой уходит в `onError` вместе с фазой, в которой он случился:

| Фаза | Когда |
| --- | --- |
| `'load'` | `getItem` бросил исключение или данные не являются JSON |
| `'migrate'` | `migrate` бросил исключение; `restore()` возвращает `false`, а `persist()` всё равно возвращает контроллер |
| `'save'` | состояние нельзя сериализовать (циклическое значение, `BigInt`) или хранилище бросило исключение, в том числе в `clear()` |

Без `onError` ошибка уходит в `globalThis.reportError`, если он есть: тот сообщает о ней так же, как о неперехваченной ошибке, ничего при этом не прерывая. Пустое хранилище, данные неправильной формы, `null` из `migrate` и отказ `hydrate` ошибками не считаются и не сообщаются. Пробной записи нет: заполненное хранилище всё равно читается.

## `popout(wm, id, content, options?)` — `@surdeddd/wmkit/popout`

```ts
isPopoutSupported(target?: PopoutTarget): boolean     // 'auto' — either target works
listScreens(): Promise<readonly PopoutScreen[] | null> // null: no Window Management API, or permission denied
popout(wm, id, content: HTMLElement, options?: PopoutOptions): Promise<PopoutHandle>

type PopoutTarget = 'auto' | 'pip' | 'window'          // auto: picture-in-picture when available, else a popup

interface PopoutScreen {
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  isPrimary?: boolean
  label?: string
}

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

Переносит живой элемент в отдельное окно ОС — тот же JS-контекст, тот же менеджер, без перерендера. Вариантов два. Document Picture-in-Picture (Chrome и Edge 116+, Firefox 151+) всегда поверх остальных окон, размер ему задаёт браузер, и на странице такое окно может быть только одно. Всплывающее окно (`window.open`, любой движок) можно разместить: `screen: 'other'` ставит его в центр первого экрана, который не текущий, `screen: 'current'` — в центр текущего, или передайте экран из `listScreens()`. Для размещения нужны Window Management API (Chromium) и разрешение на него; без любого из них всплывающее окно открывается там, где его поставит браузер. Всплывающее окно нужно открывать из жеста пользователя, иначе браузер его заблокирует, и `popout()` отклонится с ошибкой `wmkit: the popout window was blocked`. С `screen: 'current'` или `'other'` всплывающее окно открывается сразу, внутри жеста, и переезжает на свой экран, когда приходят сведения об экранах; объект `PopoutScreen` размещает его сразу.

У одного окна бывает не больше одного popout. Повторный `popout(wm, id, …)`, пока окно вынесено или его popout ещё открывается, возвращает тот же хэндл и фокусирует popout; новые контент и опции игнорируются. Когда хэндл закрылся или первый вызов отклонился, следующий вызов открывает новый popout.

Место контента в исходном дереве держит маркер-комментарий. Когда popout закрывается — через `close()`, пользователем, закрытием окна в менеджере или уходом с самой страницы, — контент возвращается к маркеру или в текущий `[data-wm-content]` окна, если пересборка скина уничтожила место маркера. Заголовок popout следует за заголовком окна. Окно, которое свернул popout, восстанавливается, только если оно всё ещё свёрнуто, так что окно, которое пользователь тем временем восстановил и развернул, остаётся как есть.

React (как и любой фреймворк, который делегирует события со своего корня) теряет обработчики на узле, перенесённом в другой документ. Используйте `mode: 'container'` и рендерите в popout через портал — см. рецепт в разделе [Рецепты](recipes.ru.md#вынос-react-окна-на-другой-монитор).

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

Раскладывает окна по панелям, как dockview, а остальные окна продолжают плавать поверх. Закреплённое окно — это прилепленное окно со `snapRect`: прямоугольником панели в долях вьюпорта. Пока окно закреплено, оно теряет `resizable`, `minimizable` и `snappable` и получает их обратно при откреплении, а его элемент несёт `data-wm-docked` (прямые углы, без тени). Панель с несколькими окнами — это вкладочная группа, так что вкладки берутся из механизма групп. Раскладка живёт в `getState().extensions.dock`, и это даёт три вещи бесплатно. Одна операция докинга со всеми изменениями окон — один шаг отмены. `persist` сохраняет и восстанавливает раскладку. `hydrate` размещает её на рабочем столе любого размера.

- `dock(id)` без цели добавляет окно вкладкой в первую панель или заполняет им всю область, если закреплённых окон нет. `side` делит корень, а если задан `stackId` — эту панель; `center` добавляет окно вкладкой. `false`, если ничего не изменилось, окно неизвестно или оно на другом рабочем столе, чем раскладка.
- `undock(id)` возвращает окну его плавающую геометрию.
- `setLayout(layout)` закрепляет ровно те окна, которые названы в раскладке, и открепляет остальные. `false` для раскладки, которая нарушает инвариант (пустая панель, разделение с одним потомком, размеры, которые в сумме не дают 1, одно окно дважды), или называет неизвестное окно. `dockLayout` экспортирует чистые операции (`insert`, `remove`, `resize`, `activate`, `moveInStack`, `stackOf`, `windowsOf`, `rects`, `validate`, `emptyLayout`), из которых такую раскладку можно собрать.

Когда окно тащат над областью, превью показывает, куда оно встанет, а при отпускании окно закрепляется там. У края панели оно делит эту панель, в центре панели становится вкладкой, а в краевой полосе области закрепляется у корня. Если держать Shift во время перетаскивания, окно останется плавать над раскладкой. Окна на слое `floating` или `modal` перетаскиванием не закрепляются, как и окно, брошенное вне `area`. Первый кадр перетаскивания закреплённого окна отрывает его, и панели смыкаются. Отменённое перетаскивание возвращает окно на место.

Разделители между панелями — это `div[data-wm-sash][role=separator]` с `aria-orientation` и `aria-valuenow`/`min`/`max` в процентах. Тащите разделитель указателем (одно перетаскивание — один шаг отмены) или сфокусируйте его и нажимайте стрелки (16 px, с Shift — 1 px) либо Home/End для крайних положений. Панель никогда не становится меньше наибольшего `minSize` своих окон или `options.minSize`, если он больше.

Закреплённое окно, которое закрывается, восстанавливается, отрывается или переезжает на другой рабочий стол, покидает раскладку без лишнего шага отмены: отмена закрытия возвращает и окно, и его панель. Разворот панели оставляет окно закреплённым, а восстановление возвращает его в панель. Изменение вьюпорта заново раскладывает панели, не трогая историю. Раскладка принадлежит одному рабочему столу, а на остальных её разделители скрываются.

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

Панель с живой таблицей окон, журналом событий и кнопками отмены, повтора и копирования состояния. Она следит за менеджером, а не за DOM. После первой отрисовки она перерисовывается не чаще раза за кадр анимации, сколько бы событий ни пришло, и дописывает в журнал новые строки, а не строит его заново. Кнопки в строках — фиксированные глифы; копирование кладёт `serialize()` в буфер обмена как JSON, а если буфера обмена нет или он отказывает в записи, показывает сам JSON. Кроме того, точка входа экспортирует типы `DevtoolsMessages`, `DevtoolsEvent`, `DevtoolsAction` и `DevtoolsLogEntry`.
