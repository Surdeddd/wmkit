export type Lang = 'en' | 'ru'

export type AppId =
  | 'readme'
  | 'terminal'
  | 'inspector'
  | 'layouts'
  | 'code'
  | 'bench'
  | 'paint'
  | 'settings'
  | 'skins'
  | 'devtools'
  | 'shortcuts'

export interface CompareCell {
  text: string
  tone: 'good' | 'bad' | 'plain'
}

export interface MenuCopy {
  id: string
  label: string
  items: Array<{ id: string; label: string; key?: string }>
}

export interface Dict {
  lang: Lang
  meta: { title: string; description: string }
  ui: Record<string, string>
  menus: MenuCopy[]
  apps: Record<AppId, { title: string; icon: string }>
  readme: { lead: string; body: string; badges: Array<[string, string]> }
  terminal: { hello: string; help: string; unknown: string; gone: string }
  inspector: { events: string; empty: string }
  layouts: {
    zones: string
    arrange: string
    history: string
    saved: string
    save: string
    none: string
  }
  bench: { lead: string; run: string; opened: string; frame: string; note: string }
  paint: { lead: string; clear: string }
  settings: {
    theme: string
    magnetism: string
    snap: string
    announce: string
    on: string
    off: string
  }
  devtools: { lead: string }
  skins: {
    lead: string
    theme: string
    variant: string
    none: string
    focus: string
    variants: Array<[string, string]>
  }
  shortcuts: Array<[string, string]>
  features: Array<{ title: string; text: string }>
  frameworks: Array<[string, string]>
  compareHead: string[]
  compareRows: Array<{ label: string; cells: CompareCell[] }>
}

const en: Dict = {
  lang: 'en',
  meta: {
    title: 'wmkit — headless window manager for the web',
    description:
      'Draggable, resizable, snappable windows for any web app. Headless core under 15 kB, adapters for React, Vue, Svelte, Solid and Angular, workspaces, undo/redo, first-class accessibility, 60fps.',
  },
  ui: {
    skip: 'Skip to documentation',
    'hero.eyebrow': 'headless window manager · 0 dependencies',
    'hero.line1': 'WINDOWS',
    'hero.line2': 'in your web app',
    'hero.lede':
      'Drag, resize, snap, minimize, undo — a real desktop inside the page. Every window you see is the library doing its job. Grab one.',
    'hero.launch': 'Open the desktop',
    'hero.docs': 'Read the docs',
    'hero.hint':
      'drag a titlebar to a screen edge to snap · ⌘⌥← / → snap · ⌘Z undo · F6 cycle · ? help',
    'features.kicker': '01 — capabilities',
    'features.title': 'Everything a desktop has',
    'features.sub':
      'The core keeps state, the DOM layer moves pixels, your framework renders content. Each piece is replaceable.',
    'fw.kicker': '02 — adapters',
    'fw.title': 'One core, six ways to hold it',
    'fw.sub':
      'Window content always lives in your own component tree — no innerHTML, no portals into the void. Adapters are thin sugar over the same state machine.',
    'fw.open': 'Open code.ts in the desktop ↗',
    'cmp.kicker': '03 — landscape',
    'cmp.title': 'Honest comparison',
    'cmp.sub': 'The floating-window niche went quiet years ago. That is exactly why wmkit exists.',
    'cmp.note': 'Checked on July 26, 2026: last commits, npm downloads, open feature requests.',
    'outro.title': 'Give your app windows',
    'footer.made': 'This page runs on wmkit itself.',
    'footer.back': '↑ Back to the demo',
    'copy.aria': 'Copy install command',
  },
  menus: [
    {
      id: 'window',
      label: 'Window',
      items: [
        { id: 'new', label: 'New window' },
        { id: 'tile', label: 'Tile' },
        { id: 'cascade', label: 'Cascade' },
        { id: 'center', label: 'Center active' },
        { id: 'back', label: 'Send to back' },
        { id: 'minimizeAll', label: 'Minimize all' },
        { id: 'restoreAll', label: 'Restore all' },
        { id: 'closeAll', label: 'Close all' },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', key: '⌘Z' },
        { id: 'redo', label: 'Redo', key: '⌘⇧Z' },
        { id: 'saveLayout', label: 'Save layout' },
        { id: 'reset', label: 'Reset desktop' },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'shortcuts', label: 'Keyboard shortcuts', key: '?' },
        { id: 'readme', label: 'About wmkit' },
        { id: 'github', label: 'GitHub ↗' },
        { id: 'npm', label: 'npm ↗' },
      ],
    },
  ],
  apps: {
    readme: { title: 'readme.md', icon: '◆' },
    terminal: { title: 'terminal', icon: '›_' },
    inspector: { title: 'inspector', icon: '◈' },
    layouts: { title: 'layouts', icon: '▤' },
    code: { title: 'code.ts', icon: '{}' },
    bench: { title: 'bench', icon: '▲' },
    paint: { title: 'paint', icon: '✎' },
    settings: { title: 'settings', icon: '⚙' },
    skins: { title: 'skins', icon: '◈' },
    devtools: { title: 'devtools', icon: '⌥' },
    shortcuts: { title: 'shortcuts', icon: '⌘' },
  },
  readme: {
    lead: 'A window manager with no opinion about your UI.',
    body: 'The core is a pure state machine: it knows bounds, stacking, stages and focus, and it never touches the DOM. The DOM layer turns pointer events into state transitions at 60fps. Adapters for React, Vue, Svelte, Solid and Angular are thin wrappers over the same object — around 60 lines each.',
    badges: [
      ['0', 'dependencies'],
      ['<15 kB', 'brotli core'],
      ['100%', 'core coverage'],
      ['MIT', 'license'],
    ],
  },
  terminal: {
    hello: 'wmkit shell — type "help" for commands',
    help: 'open [title] · close <id> · focus <id> · snap <zone> · tile · cascade · undo · redo · workspace <n> · theme <name> · state · clear',
    unknown: 'unknown command:',
    gone: 'no such window:',
  },
  inspector: { events: 'event log', empty: 'no events yet — move a window' },
  layouts: {
    zones: 'snap the active window',
    arrange: 'arrange',
    history: 'history',
    saved: 'saved layouts',
    save: 'save current',
    none: 'nothing saved yet',
  },
  bench: {
    lead: 'Open a burst of windows in one batch and measure the commit.',
    run: 'open 50 windows',
    opened: 'windows opened in',
    frame: 'state commit',
    note: 'One batch, one re-render, one layout pass. Close them from Window → Close all.',
  },
  paint: {
    lead: 'The canvas keeps its pixels through drag, resize and minimize — content is never re-parented. Aspect ratio is locked to 4:3.',
    clear: 'clear',
  },
  settings: {
    theme: 'theme',
    magnetism: 'edge magnetism',
    snap: 'snap zones',
    announce: 'screen reader announcements',
    on: 'on',
    off: 'off',
  },
  devtools: {
    lead: 'The panel below is @surdeddd/wmkit/devtools, the same 2.6 kB entry point you can drop into your own app. It follows the manager, not this page.',
  },
  skins: {
    lead: 'Sixteen shipped themes dress every window. A variant dresses one: the desktop mirrors it to data-wm-variant and your CSS overrides the tokens from there.',
    theme: 'theme',
    variant: 'variant of the focused window',
    none: 'plain',
    focus: 'Focus a window to give it a variant.',
    variants: [
      ['accent', 'tinted titlebar and an accent border'],
      ['ghost', 'no shadow, slightly translucent'],
      ['sharp', 'square corners'],
    ],
  },
  shortcuts: [
    ['drag titlebar', 'move the window'],
    ['drag to edge', 'snap to half or quarter'],
    ['drag to top', 'maximize'],
    ['double click titlebar', 'toggle maximize'],
    ['arrows', 'move by 16px'],
    ['alt + arrows', 'move by 1px'],
    ['shift + arrows', 'resize'],
    ['⌘ / ctrl + alt + ← →', 'snap to half'],
    ['⌘ / ctrl + alt + ↑ ↓', 'maximize / minimize'],
    ['⌘ / ctrl + Z', 'undo'],
    ['⌘ / ctrl + shift + Z', 'redo'],
    ['F6 / shift + F6', 'cycle focus'],
    ['← → on a tab', 'walk the tab strip'],
    ['⌘ / ctrl + ← → on a tab', 'reorder the tab strip'],
    ['drag a tab', 'reorder, regroup or tear out'],
    ['escape while dragging', 'cancel the drag'],
    ['?', 'this window'],
  ],
  features: [
    {
      title: 'Headless core',
      text: 'A pure state machine with events. Render it with anything — or nothing, and test it in Node.',
    },
    {
      title: 'Snap and magnetism',
      text: 'Halves, quarters, thirds and maximize on edge drop, plus 8px edge magnetism against neighbours.',
    },
    {
      title: 'Undo and redo',
      text: 'Every interaction is one history entry. A drag is a single undo, not sixty move events.',
    },
    {
      title: 'Workspaces',
      text: 'Park windows on virtual desktops. Focus follows the window across workspaces.',
    },
    {
      title: 'Persistence',
      text: 'Serialize to JSON, hydrate back, or drop in the persist plugin with versioned migrations.',
    },
    {
      title: 'Accessibility',
      text: 'Roles, labels, a focus trap for modals, keyboard control and a live region that narrates the desktop.',
    },
    {
      title: 'Touch ready',
      text: 'Pointer events throughout, adaptive hit areas on coarse pointers, long-press context menu.',
    },
    {
      title: 'Themeable',
      text: 'Sixteen CSS themes ship with it — every value is a custom property, and a per-window variant overrides them for one window.',
    },
  ],
  frameworks: [
    ['vanilla', 'attachDesktop + attachWindow'],
    ['react', 'useWindowManager, useDesktop'],
    ['vue', 'useDesktop with template refs'],
    ['svelte', 'use:desktop actions'],
    ['solid', 'signals and ref callbacks'],
    ['angular', 'signals and DestroyRef'],
  ],
  compareHead: ['', 'wmkit', 'react-rnd', 'dockview', 'winbox.js'],
  compareRows: [
    {
      label: 'Framework agnostic',
      cells: [
        { text: 'yes', tone: 'good' },
        { text: 'react only', tone: 'bad' },
        { text: 'react only', tone: 'bad' },
        { text: 'yes', tone: 'good' },
      ],
    },
    {
      label: 'Headless core',
      cells: [
        { text: 'yes', tone: 'good' },
        { text: 'no', tone: 'bad' },
        { text: 'no', tone: 'bad' },
        { text: 'no', tone: 'bad' },
      ],
    },
    {
      label: 'Snap zones',
      cells: [
        { text: 'halves, quarters, thirds', tone: 'good' },
        { text: 'none', tone: 'bad' },
        { text: 'dock grid', tone: 'plain' },
        { text: 'halves', tone: 'plain' },
      ],
    },
    {
      label: 'Undo / redo',
      cells: [
        { text: 'built in', tone: 'good' },
        { text: 'none', tone: 'bad' },
        { text: 'none', tone: 'bad' },
        { text: 'none', tone: 'bad' },
      ],
    },
    {
      label: 'Workspaces',
      cells: [
        { text: 'built in', tone: 'good' },
        { text: 'none', tone: 'bad' },
        { text: 'none', tone: 'bad' },
        { text: 'none', tone: 'bad' },
      ],
    },
    {
      label: 'Tab groups',
      cells: [
        { text: 'drag to group', tone: 'good' },
        { text: 'none', tone: 'bad' },
        { text: 'core feature', tone: 'good' },
        { text: 'none', tone: 'bad' },
      ],
    },
    {
      label: 'Serialize / restore',
      cells: [
        { text: 'core + plugin', tone: 'good' },
        { text: 'roll your own', tone: 'bad' },
        { text: 'yes', tone: 'good' },
        { text: 'partial', tone: 'plain' },
      ],
    },
    {
      label: 'Keyboard control',
      cells: [
        { text: 'move, resize, snap, cycle', tone: 'good' },
        { text: 'none', tone: 'bad' },
        { text: 'partial', tone: 'plain' },
        { text: 'none', tone: 'bad' },
      ],
    },
    {
      label: 'Live region for AT',
      cells: [
        { text: 'yes', tone: 'good' },
        { text: 'no', tone: 'bad' },
        { text: 'no', tone: 'bad' },
        { text: 'no', tone: 'bad' },
      ],
    },
    {
      label: 'Content ownership',
      cells: [
        { text: 'your tree', tone: 'good' },
        { text: 'your tree', tone: 'good' },
        { text: 'your tree', tone: 'good' },
        { text: 'innerHTML', tone: 'bad' },
      ],
    },
    {
      label: 'Bundle (brotli)',
      cells: [
        { text: '~14 kB', tone: 'plain' },
        { text: '~14 kB', tone: 'plain' },
        { text: '~60 kB', tone: 'bad' },
        { text: '~10 kB', tone: 'good' },
      ],
    },
  ],
}

const ru: Dict = {
  lang: 'ru',
  meta: {
    title: 'wmkit — headless-оконный менеджер для веба',
    description:
      'Перетаскиваемые, растягиваемые, прилипающие окна для любого веб-приложения. Headless-ядро меньше 15 кБ, адаптеры для React, Vue, Svelte, Solid и Angular, рабочие столы, undo/redo, доступность и 60fps.',
  },
  ui: {
    skip: 'Перейти к документации',
    'hero.eyebrow': 'headless-оконный менеджер · 0 зависимостей',
    'hero.line1': 'ОКНА',
    'hero.line2': 'в вашем веб-приложении',
    'hero.lede':
      'Тащить, растягивать, прилипать, сворачивать, отменять — настоящий рабочий стол внутри страницы. Каждое окно здесь это работа самой библиотеки. Возьмите любое.',
    'hero.launch': 'Открыть рабочий стол',
    'hero.docs': 'Документация',
    'hero.hint':
      'тащите заголовок к краю для прилипания · ⌘⌥← / → прилипание · ⌘Z отмена · F6 обход · ? помощь',
    'features.kicker': '01 — возможности',
    'features.title': 'Всё, что есть у рабочего стола',
    'features.sub':
      'Ядро хранит состояние, DOM-слой двигает пиксели, ваш фреймворк рисует содержимое. Любую часть можно заменить.',
    'fw.kicker': '02 — адаптеры',
    'fw.title': 'Одно ядро, шесть способов взять его в руки',
    'fw.sub':
      'Содержимое окна всегда живёт в вашем дереве компонентов — никакого innerHTML и порталов в пустоту. Адаптеры это тонкий сахар над одной и той же машиной состояний.',
    'fw.open': 'Открыть код.ts на рабочем столе ↗',
    'cmp.kicker': '03 — рынок',
    'cmp.title': 'Честное сравнение',
    'cmp.sub': 'Ниша плавающих окон затихла много лет назад. Ровно поэтому wmkit и существует.',
    'cmp.note': 'Проверено 26 июля 2026: последние коммиты, загрузки npm, открытые запросы фич.',
    'outro.title': 'Дайте приложению окна',
    'footer.made': 'Эта страница работает на самом wmkit.',
    'footer.back': '↑ Вернуться к демо',
    'copy.aria': 'Скопировать команду установки',
  },
  menus: [
    {
      id: 'window',
      label: 'Окно',
      items: [
        { id: 'new', label: 'Новое окно' },
        { id: 'tile', label: 'Плиткой' },
        { id: 'cascade', label: 'Каскадом' },
        { id: 'center', label: 'По центру' },
        { id: 'back', label: 'На задний план' },
        { id: 'minimizeAll', label: 'Свернуть все' },
        { id: 'restoreAll', label: 'Развернуть все' },
        { id: 'closeAll', label: 'Закрыть все' },
      ],
    },
    {
      id: 'edit',
      label: 'Правка',
      items: [
        { id: 'undo', label: 'Отменить', key: '⌘Z' },
        { id: 'redo', label: 'Повторить', key: '⌘⇧Z' },
        { id: 'saveLayout', label: 'Сохранить раскладку' },
        { id: 'reset', label: 'Сбросить стол' },
      ],
    },
    {
      id: 'help',
      label: 'Помощь',
      items: [
        { id: 'shortcuts', label: 'Горячие клавиши', key: '?' },
        { id: 'readme', label: 'О wmkit' },
        { id: 'github', label: 'GitHub ↗' },
        { id: 'npm', label: 'npm ↗' },
      ],
    },
  ],
  apps: {
    readme: { title: 'читай.md', icon: '◆' },
    terminal: { title: 'терминал', icon: '›_' },
    inspector: { title: 'инспектор', icon: '◈' },
    layouts: { title: 'раскладки', icon: '▤' },
    code: { title: 'код.ts', icon: '{}' },
    bench: { title: 'бенчмарк', icon: '▲' },
    paint: { title: 'рисовалка', icon: '✎' },
    settings: { title: 'настройки', icon: '⚙' },
    skins: { title: 'оформление', icon: '◈' },
    devtools: { title: 'девтулы', icon: '⌥' },
    shortcuts: { title: 'клавиши', icon: '⌘' },
  },
  readme: {
    lead: 'Оконный менеджер без единого мнения о вашем интерфейсе.',
    body: 'Ядро это чистая машина состояний: границы, порядок, стадии и фокус — и ни одного обращения к DOM. DOM-слой превращает события указателя в переходы состояний на 60fps, а адаптеры для React, Vue, Svelte, Solid и Angular — тонкие обёртки над тем же объектом.',
    badges: [
      ['0', 'зависимостей'],
      ['<15 кБ', 'ядро в brotli'],
      ['100%', 'покрытие ядра'],
      ['MIT', 'лицензия'],
    ],
  },
  terminal: {
    hello: 'оболочка wmkit — введите "help" для списка команд',
    help: 'open [заголовок] · close <id> · focus <id> · snap <зона> · tile · cascade · undo · redo · workspace <n> · theme <name> · state · clear',
    unknown: 'неизвестная команда:',
    gone: 'нет такого окна:',
  },
  inspector: { events: 'журнал событий', empty: 'пока пусто — подвигайте окно' },
  layouts: {
    zones: 'прилепить активное окно',
    arrange: 'расставить',
    history: 'история',
    saved: 'сохранённые раскладки',
    save: 'сохранить текущую',
    none: 'пока ничего не сохранено',
  },
  bench: {
    lead: 'Открыть пачку окон одной транзакцией и замерить коммит.',
    run: 'открыть 50 окон',
    opened: 'окон открыто за',
    frame: 'коммит состояния',
    note: 'Одна транзакция, одна перерисовка, один проход layout. Закрыть — Окно → Закрыть все.',
  },
  paint: {
    lead: 'Холст сохраняет пиксели при перетаскивании, растягивании и сворачивании — содержимое никогда не перевешивается в другой узел. Пропорции зафиксированы 4:3.',
    clear: 'очистить',
  },
  settings: {
    theme: 'тема',
    magnetism: 'магнетизм краёв',
    snap: 'зоны прилипания',
    announce: 'объявления для скринридера',
    on: 'вкл',
    off: 'выкл',
  },
  devtools: {
    lead: 'Панель ниже — это @surdeddd/wmkit/devtools, тот же entry point на 2.6 кБ, который можно подключить у себя. Она следит за менеджером, а не за этой страницей.',
  },
  skins: {
    lead: 'Шестнадцать готовых тем одевают все окна сразу. Вариант одевает одно: десктоп зеркалит его в data-wm-variant, а дальше ваш CSS переопределяет токены.',
    theme: 'тема',
    variant: 'вариант активного окна',
    none: 'обычное',
    focus: 'Сделайте окно активным, чтобы задать вариант.',
    variants: [
      ['accent', 'подкрашенный заголовок и акцентная рамка'],
      ['ghost', 'без тени, чуть прозрачное'],
      ['sharp', 'прямые углы'],
    ],
  },
  shortcuts: [
    ['тащить заголовок', 'двигать окно'],
    ['тащить к краю', 'прилипание к половине или четверти'],
    ['тащить вверх', 'развернуть'],
    ['двойной клик по заголовку', 'развернуть или восстановить'],
    ['стрелки', 'двигать на 16px'],
    ['alt + стрелки', 'двигать на 1px'],
    ['shift + стрелки', 'менять размер'],
    ['⌘ / ctrl + alt + ← →', 'прилипание к половине'],
    ['⌘ / ctrl + alt + ↑ ↓', 'развернуть или свернуть'],
    ['⌘ / ctrl + Z', 'отменить'],
    ['⌘ / ctrl + shift + Z', 'повторить'],
    ['F6 / shift + F6', 'обход фокуса'],
    ['← → на вкладке', 'ходить по вкладкам'],
    ['⌘ / ctrl + ← → на вкладке', 'менять порядок вкладок'],
    ['тащить вкладку', 'переставить, перенести или отделить'],
    ['escape при перетаскивании', 'отменить перетаскивание'],
    ['?', 'это окно'],
  ],
  features: [
    {
      title: 'Headless-ядро',
      text: 'Чистая машина состояний с событиями. Рисуйте чем угодно — или ничем, и тестируйте в Node.',
    },
    {
      title: 'Прилипание и магнетизм',
      text: 'Половины, четверти, трети и разворот при броске к краю, плюс магнетизм 8px к соседям.',
    },
    {
      title: 'Отмена и повтор',
      text: 'Каждое взаимодействие это одна запись истории. Перетаскивание — одна отмена, а не шестьдесят.',
    },
    {
      title: 'Рабочие столы',
      text: 'Раскладывайте окна по виртуальным столам. Фокус переносит вас на нужный стол.',
    },
    {
      title: 'Сохранение',
      text: 'Сериализация в JSON, восстановление обратно или плагин persist с версионированными миграциями.',
    },
    {
      title: 'Доступность',
      text: 'Роли, метки, ловушка фокуса для модалок, управление с клавиатуры и live-регион, который озвучивает стол.',
    },
    {
      title: 'Готово к тачу',
      text: 'Pointer events везде, увеличенные зоны захвата на грубом указателе, контекстное меню по долгому нажатию.',
    },
    {
      title: 'Темы',
      text: 'В комплекте шестнадцать CSS-тем — каждое значение это custom property, а вариант окна переопределяет их для одного окна.',
    },
  ],
  frameworks: [
    ['vanilla', 'attachDesktop + attachWindow'],
    ['react', 'useWindowManager, useDesktop'],
    ['vue', 'useDesktop с template ref'],
    ['svelte', 'экшены use:desktop'],
    ['solid', 'сигналы и ref-колбэки'],
    ['angular', 'сигналы и DestroyRef'],
  ],
  compareHead: ['', 'wmkit', 'react-rnd', 'dockview', 'winbox.js'],
  compareRows: [
    {
      label: 'Не зависит от фреймворка',
      cells: [
        { text: 'да', tone: 'good' },
        { text: 'только react', tone: 'bad' },
        { text: 'только react', tone: 'bad' },
        { text: 'да', tone: 'good' },
      ],
    },
    {
      label: 'Headless-ядро',
      cells: [
        { text: 'да', tone: 'good' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
      ],
    },
    {
      label: 'Зоны прилипания',
      cells: [
        { text: 'половины, четверти, трети', tone: 'good' },
        { text: 'нет', tone: 'bad' },
        { text: 'док-сетка', tone: 'plain' },
        { text: 'половины', tone: 'plain' },
      ],
    },
    {
      label: 'Отмена и повтор',
      cells: [
        { text: 'встроено', tone: 'good' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
      ],
    },
    {
      label: 'Рабочие столы',
      cells: [
        { text: 'встроено', tone: 'good' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
      ],
    },
    {
      label: 'Вкладочные группы',
      cells: [
        { text: 'бросок для группировки', tone: 'good' },
        { text: 'нет', tone: 'bad' },
        { text: 'ключевая фича', tone: 'good' },
        { text: 'нет', tone: 'bad' },
      ],
    },
    {
      label: 'Сериализация и восстановление',
      cells: [
        { text: 'ядро + плагин', tone: 'good' },
        { text: 'своими руками', tone: 'bad' },
        { text: 'да', tone: 'good' },
        { text: 'частично', tone: 'plain' },
      ],
    },
    {
      label: 'Управление с клавиатуры',
      cells: [
        { text: 'движение, размер, прилипание, обход', tone: 'good' },
        { text: 'нет', tone: 'bad' },
        { text: 'частично', tone: 'plain' },
        { text: 'нет', tone: 'bad' },
      ],
    },
    {
      label: 'Live-регион для скринридера',
      cells: [
        { text: 'да', tone: 'good' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
        { text: 'нет', tone: 'bad' },
      ],
    },
    {
      label: 'Кто владеет содержимым',
      cells: [
        { text: 'ваше дерево', tone: 'good' },
        { text: 'ваше дерево', tone: 'good' },
        { text: 'ваше дерево', tone: 'good' },
        { text: 'innerHTML', tone: 'bad' },
      ],
    },
    {
      label: 'Размер (brotli)',
      cells: [
        { text: '~14 кБ', tone: 'plain' },
        { text: '~14 кБ', tone: 'plain' },
        { text: '~60 кБ', tone: 'bad' },
        { text: '~10 кБ', tone: 'good' },
      ],
    },
  ],
}

export const dictionaries: Record<Lang, Dict> = { en, ru }
