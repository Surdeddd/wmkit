import { type AnnouncerMessages, defaultMessages } from '@surdeddd/wmkit'

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
  | 'tour'
  | 'notes'
  | 'confirm'

export type TourStep =
  | 'layouts'
  | 'seams'
  | 'overview'
  | 'switcher'
  | 'tabs'
  | 'dock'
  | 'guard'
  | 'grid'
  | 'sync'
  | 'undo'
  | 'themes'

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
  meta: { title: string; description: string; og: string; image: string }
  ui: Record<string, string>
  announce: AnnouncerMessages
  menus: MenuCopy[]
  apps: Record<AppId, { title: string; icon: string }>
  readme: { lead: string; body: string; badges: Array<[string, string]> }
  terminal: {
    hello: string
    help: string
    unknown: string
    gone: string
    input: string
    window: string
    closed: string
    focused: string
    noFocus: string
    arranged: string
    undone: string
    noUndo: string
    redone: string
    noRedo: string
    workspace: string
    noWorkspace: string
    theme: string
    windows: string
  }
  inspector: { events: string; empty: string; workspace: string; windows: string; more: string }
  layouts: {
    zones: string
    arrange: string
    history: string
    saved: string
    save: string
    none: string
    undo: string
    redo: string
    tile: string
    cascade: string
    center: string
  }
  bench: {
    lead: string
    run: string
    opened: string
    frame: string
    windows: string
    note: string
  }
  paint: { lead: string; clear: string; colour: string }
  settings: {
    theme: string
    magnetism: string
    snap: string
    announce: string
    grid: string
    sync: string
    on: string
    off: string
  }
  devtools: { lead: string }
  tour: {
    lead: string
    show: string
    steps: Array<{ id: TourStep; title: string; text: string }>
  }
  notes: { placeholder: string; label: string; save: string; saved: string; unsaved: string }
  confirm: { text: string; discard: string; keep: string }
  skins: {
    lead: string
    theme: string
    variant: string
    none: string
    focus: string
    variants: Array<[string, string]>
    skin: string
    skinLead: string
    layouts: Array<[string, string]>
    template: string
    shadow: string
    shadowNote: string
    apply: string
    reset: string
    copy: string
    copied: string
    broken: string
  }
  builderUi: {
    markup: string
    css: string
    geometry: string
    axes: [string, string, string, string]
    presets: Array<[string, string]>
    shadow: string
    shadowHint: string
    toDesktop: string
    copy: string
    copied: string
    windowTitle: string
    windowBody: string
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
      'Draggable, resizable, snappable windows for any web app. Headless core under 20 kB, adapters for React, Vue, Svelte, Solid, Angular, Preact, Lit and Qwik, web components, docking, workspaces, undo/redo, first-class accessibility, 60fps.',
    og: 'A whole desktop inside the page: windows, dock, workspaces, snapping, undo. This page is the demo — it runs on the library.',
    image:
      'The wmkit landing page: the WINDOWS headline beside a readme window and a terminal window, a dock of apps along the bottom.',
  },
  ui: {
    skip: 'Skip to documentation',
    'hero.eyebrow': 'headless window manager · 0 dependencies',
    'hero.line1': 'WINDOWS',
    'hero.line2': 'in your web app',
    'hero.lede':
      'Drag, resize, snap, minimize, undo — a real desktop inside the page. Every window you see is the library doing its job. Grab one.',
    'hero.launch': 'Open the desktop',
    'hero.build': 'Build a window',
    'hero.docs': 'Read the docs',
    'hero.hint':
      'drag a titlebar to a screen edge to snap · rest on a maximize button for layouts · Alt+` switch · ⌘Z undo · ? help',
    'builder.kicker': '01 — build a window',
    'builder.title': 'Your markup, our engine',
    'builder.sub':
      'A full editor: markup, CSS and placement on the left, a live window on the right. Drag it, restyle it, then copy the code or send it to the desktop above.',
    'features.kicker': '02 — capabilities',
    'features.title': 'Everything a desktop has',
    'features.sub':
      'The core keeps state, the DOM layer moves pixels, your framework renders content. Each piece is replaceable.',
    'fw.kicker': '03 — adapters',
    'fw.title': 'One core, ten ways to hold it',
    'fw.sub':
      'Window content always lives in your own component tree — no innerHTML, no portals into the void. Adapters are thin sugar over the same state machine.',
    'fw.open': 'Open code.ts in the desktop ↗',
    'cmp.kicker': '04 — landscape',
    'cmp.title': 'Honest comparison',
    'cmp.sub': 'The floating-window niche went quiet years ago. That is exactly why wmkit exists.',
    'cmp.note': 'Checked on July 26, 2026: last commits, npm downloads, open feature requests.',
    'outro.title': 'Give your app windows',
    'footer.made': 'This page runs on wmkit itself.',
    'cta.docs': 'Docs',
    'link.docs': 'docs/',
    'footer.back': '↑ Back to the demo',
    'copy.aria': 'Copy install command',
    'aria.menus': 'Application',
    'aria.workspaces': 'Workspaces',
    'aria.demo': 'Live wmkit desktop',
    'aria.launcher': 'Launcher',
    'aria.dock': 'Taskbar',
    'ws.tab': 'workspace',
  },
  announce: defaultMessages,
  menus: [
    {
      id: 'window',
      label: 'Window',
      items: [
        { id: 'new', label: 'New window' },
        { id: 'tile', label: 'Tile' },
        { id: 'cascade', label: 'Cascade' },
        { id: 'overview', label: 'Overview' },
        { id: 'switch', label: 'Switch window', key: 'Alt `' },
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
      id: 'scenes',
      label: 'Scenes',
      items: [
        { id: 'sceneStudio', label: 'Studio — dock and tabs' },
        { id: 'sceneBoard', label: 'Board — tiles and seams' },
        { id: 'sceneRetro', label: 'Retro — 1995' },
        { id: 'sceneClean', label: 'Clean desk' },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'tour', label: 'Take the tour' },
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
    tour: { title: 'tour', icon: '★' },
    notes: { title: 'notes.txt', icon: '¶' },
    confirm: { title: 'close notes.txt?', icon: '!' },
  },
  readme: {
    lead: 'A window manager with no opinion about your UI.',
    body: 'The core is a pure state machine: it knows bounds, stacking, stages and focus, and it never touches the DOM. The DOM layer turns pointer events into state transitions at 60fps. Adapters for React, Vue, Svelte, Solid, Angular, Preact, Lit and Qwik, and the web components, are thin wrappers over the same object.',
    badges: [
      ['0', 'dependencies'],
      ['<20 kB', 'brotli core'],
      ['100%', 'core coverage'],
      ['MIT', 'license'],
    ],
  },
  terminal: {
    hello: 'wmkit shell — type "help" for commands',
    help: 'open [title] · close <id> · focus <id> · snap <zone> · tile · cascade · undo · redo · workspace <n> · theme <name> · state · clear',
    unknown: 'unknown command:',
    gone: 'no such window:',
    input: 'terminal input',
    window: 'window',
    closed: 'closed',
    focused: 'focused',
    noFocus: 'no focused window',
    arranged: 'arranged',
    undone: 'undo',
    noUndo: 'nothing to undo',
    redone: 'redo',
    noRedo: 'nothing to redo',
    workspace: 'workspace',
    noWorkspace: 'no such workspace:',
    theme: 'theme',
    windows: 'windows',
  },
  inspector: {
    events: 'event log',
    empty: 'no events yet — move a window',
    workspace: 'workspace',
    windows: 'windows',
    more: 'more',
  },
  layouts: {
    zones: 'snap the active window',
    arrange: 'arrange',
    history: 'history',
    saved: 'saved layouts',
    save: 'save current',
    none: 'nothing saved yet',
    undo: 'undo',
    redo: 'redo',
    tile: 'tile',
    cascade: 'cascade',
    center: 'center',
  },
  bench: {
    lead: 'Open a burst of windows in one batch and measure the commit.',
    run: 'open 50 windows',
    opened: 'windows opened in',
    frame: 'state commit',
    windows: 'windows',
    note: 'One batch, one re-render, one layout pass. Close them from Window → Close all.',
  },
  paint: {
    lead: 'The canvas keeps its pixels through drag, resize and minimize — content is never re-parented. Aspect ratio is locked to 4:3.',
    clear: 'clear',
    colour: 'colour',
  },
  settings: {
    theme: 'theme',
    magnetism: 'edge magnetism',
    snap: 'snap zones',
    announce: 'screen reader announcements',
    grid: 'grid, 16 px',
    sync: 'sync across tabs',
    on: 'on',
    off: 'off',
  },
  tour: {
    lead: 'Eleven things to try. Each button does it on the desktop around this window.',
    show: 'show',
    steps: [
      {
        id: 'layouts',
        title: 'Snap layouts',
        text: 'Rest the mouse on a maximize button, or press ⌘⌥L, and pick a tile for the window.',
      },
      {
        id: 'seams',
        title: 'Linked resize',
        text: 'Two windows side by side share a separator. Drag it and both resize.',
      },
      {
        id: 'overview',
        title: 'Overview',
        text: 'Every window shrinks into a grid. Pick one with the pointer or the arrows.',
      },
      {
        id: 'switcher',
        title: 'Window switcher',
        text: 'Alt + ` walks the windows from the most recent one, like Alt+Tab.',
      },
      {
        id: 'tabs',
        title: 'Tab groups',
        text: 'Drop a titlebar onto another and the windows share one frame.',
      },
      {
        id: 'dock',
        title: 'Docking',
        text: 'The Studio scene tiles windows into panels with separators. Tear one out and it floats.',
      },
      {
        id: 'guard',
        title: 'Ask before closing',
        text: 'Type in notes.txt and close it. A modal window asks first.',
      },
      {
        id: 'grid',
        title: 'Grid',
        text: 'Windows land on a 16 px step. Hold Alt to drag freely.',
      },
      {
        id: 'sync',
        title: 'Sync across tabs',
        text: 'Open this page in a second tab and both show one desktop.',
      },
      {
        id: 'undo',
        title: 'Undo',
        text: 'Every step above is one entry in history. ⌘Z takes it back.',
      },
      {
        id: 'themes',
        title: 'Themes',
        text: 'Sixteen themes. The next one, please.',
      },
    ],
  },
  notes: {
    placeholder: 'Type something, then try to close this window.',
    label: 'Note text',
    save: 'save',
    saved: 'saved',
    unsaved: 'unsaved changes',
  },
  confirm: {
    text: 'notes.txt has unsaved changes. Close it anyway?',
    discard: 'close without saving',
    keep: 'keep editing',
  },
  devtools: {
    lead: 'The panel below is @surdeddd/wmkit/devtools, the same 2.9 kB entry point you can drop into your own app. It follows the manager, not this page.',
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
    skin: 'skin',
    skinLead:
      'A skin is the window itself. Pick a layout and every window is rebuilt from that template, keeping its position, its focus and whatever it was showing.',
    layouts: [
      ['controls left', 'the buttons lead, the title follows'],
      ['controls right', 'the title leads, the buttons close the bar'],
      ['no controls', 'a titlebar you can only drag'],
    ],
    template: 'template',
    shadow: 'shadow root',
    shadowNote: 'Isolate the chrome so page CSS cannot reach it.',
    apply: 'apply',
    reset: 'reset',
    copy: 'copy as code',
    copied: 'copied',
    broken: 'A template needs exactly one [data-wm-content].',
  },
  builderUi: {
    markup: 'markup',
    css: 'css — style it however you like',
    geometry: 'placement',
    axes: ['x', 'y', 'width', 'height'],
    presets: [
      ['theme', 'site theme'],
      ['mac', 'macOS'],
      ['win95', 'win95'],
      ['terminal', 'terminal'],
      ['card', 'glass card'],
    ],
    shadow: 'shadow root',
    shadowHint: 'Inside a shadow root, write :host instead of [data-wm-window]…',
    toDesktop: 'try on the desktop above',
    copy: 'copy as code',
    copied: 'copied',
    windowTitle: 'my window',
    windowBody:
      'A real window: drag it, resize it, snap it to an edge. Your markup and CSS — the engine does the rest.',
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
    {
      title: 'Docking and tabs',
      text: 'Tile windows into split panels with separators, or drop one titlebar onto another for tabs. The rest keep floating.',
    },
    {
      title: 'Layouts, taskbar, switcher',
      text: 'A snap layout menu on the maximize button, neighbours that resize together, a taskbar and a window switcher with an overview.',
    },
    {
      title: 'Sync and close guards',
      text: 'One desktop in every browser tab over a BroadcastChannel, and a guard that asks before unsaved work is closed.',
    },
    {
      title: 'Every framework',
      text: 'React, Vue, Svelte, Solid, Angular, Preact, Lit, Qwik and web components over the same core, and none of them required.',
    },
  ],
  frameworks: [
    ['vanilla', 'attachDesktop + attachWindow'],
    ['react', 'useWindowManager, useDesktop'],
    ['vue', 'useDesktop with template refs'],
    ['svelte', 'use:desktop actions'],
    ['solid', 'signals and ref callbacks'],
    ['angular', 'signals and DestroyRef'],
    ['preact', 'the same hooks as React'],
    ['lit', 'directives and controllers'],
    ['qwik', 'components and context'],
    ['web components', 'wm-desktop and wm-window'],
  ],
  compareHead: ['', 'wmkit', 'react-rnd', 'dockview', 'winbox.js'],
  compareRows: [
    {
      label: 'Framework agnostic',
      cells: [
        { text: 'yes', tone: 'good' },
        { text: 'react only', tone: 'bad' },
        { text: 'core + React·Vue·Angular', tone: 'good' },
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
        { text: 'none', tone: 'bad' },
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
        { text: 'none', tone: 'bad' },
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
        { text: '~19 kB', tone: 'plain' },
        { text: '~15 kB', tone: 'plain' },
        { text: '~60 kB', tone: 'bad' },
        { text: '~10 kB', tone: 'good' },
      ],
    },
  ],
}

const ZONES_RU: Record<string, string> = {
  left: 'левая половина',
  right: 'правая половина',
  top: 'верхняя половина',
  bottom: 'нижняя половина',
  'top-left': 'левая верхняя четверть',
  'top-right': 'правая верхняя четверть',
  'bottom-left': 'левая нижняя четверть',
  'bottom-right': 'правая нижняя четверть',
  'left-third': 'левая треть',
  'center-third': 'средняя треть',
  'right-third': 'правая треть',
}

const ru: Dict = {
  lang: 'ru',
  meta: {
    title: 'wmkit — headless-оконный менеджер для веба',
    description:
      'Перетаскиваемые, растягиваемые, прилипающие окна для любого веб-приложения. Headless-ядро меньше 20 кБ, адаптеры для React, Vue, Svelte, Solid, Angular, Preact, Lit и Qwik, веб-компоненты, докинг, рабочие столы, undo/redo, доступность и 60fps.',
    og: 'Целый рабочий стол внутри страницы: окна, док, рабочие столы, прилипание, отмена. Эта страница и есть демо — она работает на самой библиотеке.',
    image:
      'Лендинг wmkit: заголовок WINDOWS рядом с окнами readme и терминала, внизу док с приложениями.',
  },
  ui: {
    skip: 'Перейти к документации',
    'hero.eyebrow': 'headless-оконный менеджер · 0 зависимостей',
    'hero.line1': 'ОКНА',
    'hero.line2': 'в вашем веб-приложении',
    'hero.lede':
      'Тащить, растягивать, прилипать, сворачивать, отменять — настоящий рабочий стол внутри страницы. Каждое окно здесь это работа самой библиотеки. Возьмите любое.',
    'hero.launch': 'Открыть рабочий стол',
    'hero.build': 'Собрать окно',
    'hero.docs': 'Документация',
    'hero.hint':
      'тащите заголовок к краю для прилипания · задержитесь на кнопке разворачивания ради раскладок · Alt+` переключение · ⌘Z отмена · ? помощь',
    'builder.kicker': '01 — собери окно',
    'builder.title': 'Ваша разметка, наш движок',
    'builder.sub':
      'Полноценный редактор: слева разметка, CSS и размещение, справа — живое окно. Тяните его, перекрашивайте, копируйте код или отправьте на рабочий стол выше.',
    'features.kicker': '02 — возможности',
    'features.title': 'Всё, что есть у рабочего стола',
    'features.sub':
      'Ядро хранит состояние, DOM-слой двигает пиксели, ваш фреймворк рисует содержимое. Любую часть можно заменить.',
    'fw.kicker': '03 — адаптеры',
    'fw.title': 'Одно ядро, десять способов взять его в руки',
    'fw.sub':
      'Содержимое окна всегда живёт в вашем дереве компонентов — никакого innerHTML и порталов в пустоту. Адаптеры это тонкий сахар над одной и той же машиной состояний.',
    'fw.open': 'Открыть код.ts на рабочем столе ↗',
    'cmp.kicker': '04 — рынок',
    'cmp.title': 'Честное сравнение',
    'cmp.sub': 'Ниша плавающих окон затихла много лет назад. Ровно поэтому wmkit и существует.',
    'cmp.note': 'Проверено 26 июля 2026: последние коммиты, загрузки npm, открытые запросы фич.',
    'outro.title': 'Дайте приложению окна',
    'footer.made': 'Эта страница работает на самом wmkit.',
    'cta.docs': 'Документация',
    'link.docs': 'docs/ru/',
    'footer.back': '↑ Вернуться к демо',
    'copy.aria': 'Скопировать команду установки',
    'aria.menus': 'Меню приложения',
    'aria.workspaces': 'Рабочие столы',
    'aria.demo': 'Живой рабочий стол wmkit',
    'aria.launcher': 'Запуск приложений',
    'aria.dock': 'Панель задач',
    'ws.tab': 'рабочий стол',
  },
  announce: {
    opened: (title) => `Окно «${title}» открыто`,
    closed: (title) => `Окно «${title}» закрыто`,
    minimized: (title) => `Окно «${title}» свёрнуто`,
    restored: (title) => `Окно «${title}» восстановлено`,
    maximized: (title) => `Окно «${title}» развёрнуто`,
    snapped: (title, zone) => `Окно «${title}» прилеплено: ${ZONES_RU[zone] ?? zone}`,
    focused: (title) => `Окно «${title}» в фокусе`,
    workspace: (index) => `Рабочий стол ${index + 1}`,
    openedMany: (count) => `Открыто окон: ${count}`,
    closedMany: (count) => `Закрыто окон: ${count}`,
    minimizedMany: (count) => `Свёрнуто окон: ${count}`,
    restoredMany: (count) => `Восстановлено окон: ${count}`,
  },
  menus: [
    {
      id: 'window',
      label: 'Окно',
      items: [
        { id: 'new', label: 'Новое окно' },
        { id: 'tile', label: 'Плиткой' },
        { id: 'cascade', label: 'Каскадом' },
        { id: 'overview', label: 'Обзор' },
        { id: 'switch', label: 'Переключить окно', key: 'Alt `' },
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
      id: 'scenes',
      label: 'Сцены',
      items: [
        { id: 'sceneStudio', label: 'Студия — док и вкладки' },
        { id: 'sceneBoard', label: 'Плитка — раскладка и швы' },
        { id: 'sceneRetro', label: 'Ретро — 1995' },
        { id: 'sceneClean', label: 'Чистый стол' },
      ],
    },
    {
      id: 'help',
      label: 'Помощь',
      items: [
        { id: 'tour', label: 'Пройти тур' },
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
    tour: { title: 'тур', icon: '★' },
    notes: { title: 'notes.txt', icon: '¶' },
    confirm: { title: 'закрыть notes.txt?', icon: '!' },
  },
  readme: {
    lead: 'Оконный менеджер без единого мнения о вашем интерфейсе.',
    body: 'Ядро это чистая машина состояний: границы, порядок, стадии и фокус — и ни одного обращения к DOM. DOM-слой превращает события указателя в переходы состояний на 60fps, а адаптеры для React, Vue, Svelte, Solid, Angular, Preact, Lit и Qwik и веб-компоненты — тонкие обёртки над тем же объектом.',
    badges: [
      ['0', 'зависимостей'],
      ['<20 кБ', 'ядро в brotli'],
      ['100%', 'покрытие ядра'],
      ['MIT', 'лицензия'],
    ],
  },
  terminal: {
    hello: 'оболочка wmkit — введите "help" для списка команд',
    help: 'open [заголовок] · close <id> · focus <id> · snap <зона> · tile · cascade · undo · redo · workspace <n> · theme <name> · state · clear',
    unknown: 'неизвестная команда:',
    gone: 'нет такого окна:',
    input: 'ввод терминала',
    window: 'окно',
    closed: 'закрыто:',
    focused: 'в фокусе:',
    noFocus: 'нет активного окна',
    arranged: 'расставлено:',
    undone: 'отменено',
    noUndo: 'нечего отменять',
    redone: 'повторено',
    noRedo: 'нечего повторять',
    workspace: 'рабочий стол',
    noWorkspace: 'нет такого рабочего стола:',
    theme: 'тема:',
    windows: 'окон',
  },
  inspector: {
    events: 'журнал событий',
    empty: 'пока пусто — подвигайте окно',
    workspace: 'стол',
    windows: 'окон',
    more: 'ещё',
  },
  layouts: {
    zones: 'прилепить активное окно',
    arrange: 'расставить',
    history: 'история',
    saved: 'сохранённые раскладки',
    save: 'сохранить текущую',
    none: 'пока ничего не сохранено',
    undo: 'отменить',
    redo: 'повторить',
    tile: 'плиткой',
    cascade: 'каскадом',
    center: 'по центру',
  },
  bench: {
    lead: 'Открыть пачку окон одной транзакцией и замерить коммит.',
    run: 'открыть 50 окон',
    opened: 'окон открыто за',
    frame: 'коммит состояния',
    windows: 'окон',
    note: 'Одна транзакция, одна перерисовка, один проход layout. Закрыть — Окно → Закрыть все.',
  },
  paint: {
    lead: 'Холст сохраняет пиксели при перетаскивании, растягивании и сворачивании — содержимое никогда не перевешивается в другой узел. Пропорции зафиксированы 4:3.',
    clear: 'очистить',
    colour: 'цвет',
  },
  settings: {
    theme: 'тема',
    magnetism: 'магнетизм краёв',
    snap: 'зоны прилипания',
    announce: 'объявления для скринридера',
    grid: 'сетка, 16 px',
    sync: 'синхронизация вкладок',
    on: 'вкл',
    off: 'выкл',
  },
  tour: {
    lead: 'Одиннадцать вещей, которые стоит попробовать. Каждая кнопка делает это на рабочем столе вокруг окна.',
    show: 'показать',
    steps: [
      {
        id: 'layouts',
        title: 'Раскладки',
        text: 'Задержите мышь на кнопке разворачивания или нажмите ⌘⌥L и выберите место для окна.',
      },
      {
        id: 'seams',
        title: 'Связанный ресайз',
        text: 'У двух окон бок о бок общий разделитель. Потяните его, и размер поменяют оба.',
      },
      {
        id: 'overview',
        title: 'Обзор',
        text: 'Все окна уменьшаются в сетку. Выберите одно указателем или стрелками.',
      },
      {
        id: 'switcher',
        title: 'Переключатель окон',
        text: 'Alt + ` идёт по окнам от последнего использованного, как Alt+Tab.',
      },
      {
        id: 'tabs',
        title: 'Группы вкладок',
        text: 'Бросьте тайтлбар на другой, и окна разделят одну рамку.',
      },
      {
        id: 'dock',
        title: 'Докинг',
        text: 'Сцена «Студия» раскладывает окна по панелям с разделителями. Оторвите одно, и оно поплывёт.',
      },
      {
        id: 'guard',
        title: 'Вопрос перед закрытием',
        text: 'Наберите что-нибудь в notes.txt и закройте его. Сначала спросит модальное окно.',
      },
      {
        id: 'grid',
        title: 'Сетка',
        text: 'Окна встают на шаг 16 px. С зажатым Alt тащатся свободно.',
      },
      {
        id: 'sync',
        title: 'Синхронизация вкладок',
        text: 'Откройте эту страницу во второй вкладке, и в обеих будет один рабочий стол.',
      },
      {
        id: 'undo',
        title: 'Отмена',
        text: 'Каждый шаг выше — одна запись в истории. ⌘Z возвращает её.',
      },
      {
        id: 'themes',
        title: 'Темы',
        text: 'Шестнадцать тем. Следующую, пожалуйста.',
      },
    ],
  },
  notes: {
    placeholder: 'Наберите что-нибудь и попробуйте закрыть это окно.',
    label: 'Текст заметки',
    save: 'сохранить',
    saved: 'сохранено',
    unsaved: 'есть несохранённые изменения',
  },
  confirm: {
    text: 'В notes.txt есть несохранённые изменения. Всё равно закрыть?',
    discard: 'закрыть без сохранения',
    keep: 'вернуться к правке',
  },
  devtools: {
    lead: 'Панель ниже — это @surdeddd/wmkit/devtools, тот же entry point на 2.9 кБ, который можно подключить у себя. Она следит за менеджером, а не за этой страницей.',
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
    skin: 'скин',
    skinLead:
      'Скин — это само окно. Выберите раскладку, и каждое окно пересоберётся по этому шаблону, сохранив место, фокус и всё, что показывало.',
    layouts: [
      ['кнопки слева', 'сначала кнопки, потом заголовок'],
      ['кнопки справа', 'сначала заголовок, кнопки закрывают строку'],
      ['без кнопок', 'заголовок, за который можно только тянуть'],
    ],
    template: 'шаблон',
    shadow: 'теневой корень',
    shadowNote: 'Изолировать обвязку, чтобы CSS страницы до неё не дотянулся.',
    apply: 'применить',
    reset: 'сбросить',
    copy: 'скопировать код',
    copied: 'скопировано',
    broken: 'В шаблоне должен быть ровно один [data-wm-content].',
  },
  builderUi: {
    markup: 'разметка',
    css: 'css — стилизуйте как угодно',
    geometry: 'размещение',
    axes: ['x', 'y', 'ширина', 'высота'],
    presets: [
      ['theme', 'тема сайта'],
      ['mac', 'macOS'],
      ['win95', 'win95'],
      ['terminal', 'терминал'],
      ['card', 'стеклянная карточка'],
    ],
    shadow: 'теневой корень',
    shadowHint: 'Внутри теневого корня пишите :host вместо [data-wm-window]…',
    toDesktop: 'на рабочий стол выше',
    copy: 'скопировать код',
    copied: 'скопировано',
    windowTitle: 'моё окно',
    windowBody:
      'Настоящее окно: тяните, растягивайте, прилепляйте к краю. Ваша разметка и CSS — остальное делает движок.',
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
    {
      title: 'Докинг и вкладки',
      text: 'Окна раскладываются по панелям с разделителями, а тайтлбар, брошенный на другой, даёт вкладки. Остальные продолжают плавать.',
    },
    {
      title: 'Раскладки, панель задач, переключатель',
      text: 'Меню раскладок на кнопке разворачивания, соседи с общим ресайзом, панель задач и переключатель окон с обзором.',
    },
    {
      title: 'Синхронизация и вопрос перед закрытием',
      text: 'Один рабочий стол во всех вкладках браузера через BroadcastChannel и охранник, который спрашивает, прежде чем закрыть несохранённое.',
    },
    {
      title: 'Любой фреймворк',
      text: 'React, Vue, Svelte, Solid, Angular, Preact, Lit, Qwik и веб-компоненты над одним ядром, и ни один из них не обязателен.',
    },
  ],
  frameworks: [
    ['vanilla', 'attachDesktop + attachWindow'],
    ['react', 'useWindowManager, useDesktop'],
    ['vue', 'useDesktop с template ref'],
    ['svelte', 'экшены use:desktop'],
    ['solid', 'сигналы и ref-колбэки'],
    ['angular', 'сигналы и DestroyRef'],
    ['preact', 'те же хуки, что у React'],
    ['lit', 'директивы и контроллеры'],
    ['qwik', 'компоненты и контекст'],
    ['веб-компоненты', 'wm-desktop и wm-window'],
  ],
  compareHead: ['', 'wmkit', 'react-rnd', 'dockview', 'winbox.js'],
  compareRows: [
    {
      label: 'Не зависит от фреймворка',
      cells: [
        { text: 'да', tone: 'good' },
        { text: 'только react', tone: 'bad' },
        { text: 'ядро + React·Vue·Angular', tone: 'good' },
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
        { text: 'нет', tone: 'bad' },
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
        { text: 'нет', tone: 'bad' },
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
        { text: '~19 кБ', tone: 'plain' },
        { text: '~15 кБ', tone: 'plain' },
        { text: '~60 кБ', tone: 'bad' },
        { text: '~10 кБ', tone: 'good' },
      ],
    },
  ],
}

export const dictionaries: Record<Lang, Dict> = { en, ru }
