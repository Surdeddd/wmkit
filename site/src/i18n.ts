export type Lang = 'en' | 'ru'

export interface FeatureCopy {
  icon: string
  title: string
  text: string
}

export interface CompareRow {
  label: string
  cells: Array<{ text: string; tone: 'yes' | 'no' | 'warn' | 'plain' }>
}

export interface Dict {
  meta: { title: string; description: string }
  ui: Record<string, string>
  features: FeatureCopy[]
  compareHead: string[]
  compareRows: CompareRow[]
  windows: {
    welcomeTitle: string
    welcomeHtml: string
    terminalTitle: string
    metricsTitle: string
    metrics: Array<[string, string]>
    playgroundTitle: string
    playgroundHint: string
    actions: { open: string; modal: string; stress: string; snap: string }
    spawnedTitle: string
    spawnedBody: string
    modalTitle: string
    modalBody: string
  }
}

export const dictionaries: Record<Lang, Dict> = {
  en: {
    meta: {
      title: 'wmkit — headless window manager for the web',
      description:
        'Draggable, resizable, snappable windows for any web app. Headless core, adapters for React, Vue, Svelte and Solid, first-class accessibility, 60fps.',
    },
    ui: {
      'nav.features': 'Features',
      'nav.frameworks': 'Frameworks',
      'nav.compare': 'Compare',
      'hero.eyebrow': 'headless window manager',
      'hero.title1': 'Windows.',
      'hero.title2': 'In your web app.',
      'hero.title3': 'Any framework.',
      'hero.sub':
        'Drag, resize, snap, minimize — a full desktop experience inside the page. Headless core, zero dependencies, adapters for React, Vue, Svelte and Solid. Every window on this page is real. Grab one.',
      'hero.copy': 'Copy install command',
      'hero.cta1': 'Get started',
      'hero.badge1': 'dependencies',
      'hero.badge2': 'gzip core',
      'hero.badge3': 'test coverage',
      'hero.badge4': 'license',
      'dock.plus': 'Open a new window',
      'features.title': 'Everything a desktop has',
      'features.sub':
        'The core keeps state, the DOM layer moves pixels, your framework renders the content.',
      'fw.title': 'One core, five ways to hold it',
      'fw.sub':
        "Window content always lives in your framework's own tree — no innerHTML, no portals into the void. Adapters are thin sugar over the same state machine.",
      'cmp.title': 'Honest comparison',
      'cmp.sub': "The floating-window niche went quiet years ago. That's exactly why wmkit exists.",
      'cmp.note':
        'Data checked on July 10, 2026: last commits, npm downloads, open feature requests.',
      'outro.title': 'Give your app windows',
      'outro.star': 'Star on GitHub',
      'footer.made': 'This page runs on wmkit itself — drag the windows above.',
    },
    features: [
      {
        icon: '◲',
        title: 'Headless by design',
        text: 'A serializable state machine plus a DOM controller. Bring your own markup and styles — or take the glass theme.',
      },
      {
        icon: '⌘',
        title: 'First-class adapters',
        text: 'React, Vue, Svelte, Solid and vanilla share one core. Window content stays in your framework tree.',
      },
      {
        icon: '⌨',
        title: 'Accessible for real',
        text: 'Move and resize from the keyboard, cycle with F6, focus trapping in modals, live announcements for screen readers.',
      },
      {
        icon: '⊞',
        title: 'Snap zones',
        text: 'Halves, quarters and drag-to-top maximize with a live preview — the FancyZones feel, in the browser.',
      },
      {
        icon: '⚡',
        title: '60fps under load',
        text: 'transform-only positioning, rAF-batched pointer input, structural sharing. Fifty windows keep dragging smoothly.',
      },
      {
        icon: '⟳',
        title: 'Persistence built in',
        text: 'One call serializes the whole desktop; one call restores it after reload. Storage is pluggable.',
      },
      {
        icon: '⇱',
        title: 'Pop out to real windows',
        text: 'Send a window into Document Picture-in-Picture — an always-on-top OS window sharing the same state.',
      },
      {
        icon: 'TS',
        title: 'Strict TypeScript',
        text: '100% typed public API, noUncheckedIndexedAccess, zero any. Validated by publint and attw.',
      },
    ],
    compareHead: ['', 'wmkit', 'WinBox', 'jsPanel4', 'Dockview', 'Zag panel'],
    compareRows: [
      {
        label: 'Maintained',
        cells: [
          { text: '✓ 2026', tone: 'yes' },
          { text: '✗ since 2023', tone: 'no' },
          { text: '✗ since 2022', tone: 'no' },
          { text: '✓', tone: 'yes' },
          { text: '✓', tone: 'yes' },
        ],
      },
      {
        label: 'Headless core',
        cells: [
          { text: '✓', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: '~ own UI', tone: 'warn' },
          { text: '✓', tone: 'yes' },
        ],
      },
      {
        label: 'Official adapters',
        cells: [
          { text: 'React·Vue·Svelte·Solid', tone: 'yes' },
          { text: 'community only', tone: 'warn' },
          { text: '✗', tone: 'no' },
          { text: 'React·Vue·Angular', tone: 'yes' },
          { text: 'via Ark UI', tone: 'warn' },
        ],
      },
      {
        label: 'Multi-window: z-order, taskbar, modals',
        cells: [
          { text: '✓', tone: 'yes' },
          { text: 'partial', tone: 'warn' },
          { text: 'partial', tone: 'warn' },
          { text: 'dock groups', tone: 'warn' },
          { text: '✗ single panel', tone: 'no' },
        ],
      },
      {
        label: 'Snap zones',
        cells: [
          { text: '✓ + preview', tone: 'yes' },
          { text: '✗ (open request)', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: '—', tone: 'plain' },
          { text: '✗', tone: 'no' },
        ],
      },
      {
        label: 'Keyboard + screen reader',
        cells: [
          { text: '✓', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: 'partial', tone: 'warn' },
          { text: 'partial', tone: 'warn' },
        ],
      },
      {
        label: 'State persistence',
        cells: [
          { text: '✓ built in', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: '✓', tone: 'yes' },
          { text: '✗', tone: 'no' },
        ],
      },
      {
        label: 'Pop out (Document PiP)',
        cells: [
          { text: '✓ experimental', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: 'window.open', tone: 'warn' },
          { text: '✗', tone: 'no' },
        ],
      },
      {
        label: 'TypeScript',
        cells: [
          { text: 'strict', tone: 'yes' },
          { text: '@types only', tone: 'warn' },
          { text: '✗', tone: 'no' },
          { text: '✓', tone: 'yes' },
          { text: '✓', tone: 'yes' },
        ],
      },
    ],
    windows: {
      welcomeTitle: 'welcome.app',
      welcomeHtml:
        '<p class="win-body"><strong>This window is real.</strong> Drag it by the titlebar, resize from any edge, throw it against the screen edge to snap, or press the yellow dot to minimize into the dock.</p><p class="win-body" style="margin-top:10px">Keyboard works too: focus me and use arrow keys, Shift+arrows to resize, F6 to cycle windows.</p>',
      terminalTitle: 'terminal — zsh',
      metricsTitle: 'metrics',
      metrics: [
        ['<10 kB', 'core, gzip'],
        ['0', 'dependencies'],
        ['100%', 'unit coverage'],
        ['164', 'e2e scenarios'],
      ],
      playgroundTitle: 'playground',
      playgroundHint: 'Poke the manager from here:',
      actions: { open: '+ window', modal: 'modal', stress: 'stress ×15', snap: 'snap left' },
      spawnedTitle: 'window',
      spawnedBody: 'A fresh window. Drag me around.',
      modalTitle: 'modal window',
      modalBody: 'Focus is trapped here until you close me. Try clicking the windows behind.',
    },
  },
  ru: {
    meta: {
      title: 'wmkit — headless оконный менеджер для веба',
      description:
        'Перетаскиваемые окна с ресайзом, снэпом и таскбаром для любого веб-приложения. Headless-ядро, адаптеры для React, Vue, Svelte и Solid, полноценная доступность, 60fps.',
    },
    ui: {
      'nav.features': 'Возможности',
      'nav.frameworks': 'Фреймворки',
      'nav.compare': 'Сравнение',
      'hero.eyebrow': 'headless оконный менеджер',
      'hero.title1': 'Окна.',
      'hero.title2': 'В вашем приложении.',
      'hero.title3': 'На любом фреймворке.',
      'hero.sub':
        'Перетаскивание, ресайз, снэп, сворачивание — полноценный рабочий стол внутри страницы. Headless-ядро без зависимостей, адаптеры для React, Vue, Svelte и Solid. Все окна на этой странице настоящие — хватайте любое.',
      'hero.copy': 'Скопировать команду установки',
      'hero.cta1': 'Начать',
      'hero.badge1': 'зависимостей',
      'hero.badge2': 'ядро, gzip',
      'hero.badge3': 'покрытие тестами',
      'hero.badge4': 'лицензия',
      'dock.plus': 'Открыть новое окно',
      'features.title': 'Всё, что умеет рабочий стол',
      'features.sub':
        'Ядро хранит состояние, DOM-слой двигает пиксели, ваш фреймворк рендерит содержимое.',
      'fw.title': 'Одно ядро — пять способов держать его в руках',
      'fw.sub':
        'Содержимое окна всегда живёт в дереве вашего фреймворка — никакого innerHTML и порталов в пустоту. Адаптеры — тонкий сахар над одной стейт-машиной.',
      'cmp.title': 'Честное сравнение',
      'cmp.sub': 'Ниша плавающих окон затихла годы назад. Именно поэтому wmkit существует.',
      'cmp.note':
        'Данные проверены 10 июля 2026: последние коммиты, скачивания npm, открытые запросы фич.',
      'outro.title': 'Дайте вашему приложению окна',
      'outro.star': 'Звезда на GitHub',
      'footer.made': 'Эта страница работает на самом wmkit — потаскайте окна выше.',
    },
    features: [
      {
        icon: '◲',
        title: 'Headless по замыслу',
        text: 'Сериализуемая стейт-машина плюс DOM-контроллер. Своя разметка и стили — или готовая стеклянная тема.',
      },
      {
        icon: '⌘',
        title: 'Родные адаптеры',
        text: 'React, Vue, Svelte, Solid и vanilla делят одно ядро. Контент окна остаётся в дереве вашего фреймворка.',
      },
      {
        icon: '⌨',
        title: 'Доступность по-настоящему',
        text: 'Перемещение и ресайз с клавиатуры, цикл по F6, focus-trap в модалках, живые анонсы для скринридеров.',
      },
      {
        icon: '⊞',
        title: 'Snap-зоны',
        text: 'Половины, четверти и максимизация от верхнего края с живым превью — ощущение FancyZones в браузере.',
      },
      {
        icon: '⚡',
        title: '60fps под нагрузкой',
        text: 'Позиционирование только через transform, rAF-батчинг ввода, structural sharing. Пятьдесят окон таскаются гладко.',
      },
      {
        icon: '⟳',
        title: 'Встроенный персист',
        text: 'Один вызов сериализует весь рабочий стол, один — восстанавливает после перезагрузки. Хранилище подключаемое.',
      },
      {
        icon: '⇱',
        title: 'Вынос в настоящие окна',
        text: 'Отправьте окно в Document Picture-in-Picture — always-on-top окно ОС с тем же состоянием.',
      },
      {
        icon: 'TS',
        title: 'Строгий TypeScript',
        text: '100% типизированный публичный API, noUncheckedIndexedAccess, ноль any. Проверено publint и attw.',
      },
    ],
    compareHead: ['', 'wmkit', 'WinBox', 'jsPanel4', 'Dockview', 'Zag panel'],
    compareRows: [
      {
        label: 'Поддерживается',
        cells: [
          { text: '✓ 2026', tone: 'yes' },
          { text: '✗ с 2023', tone: 'no' },
          { text: '✗ с 2022', tone: 'no' },
          { text: '✓', tone: 'yes' },
          { text: '✓', tone: 'yes' },
        ],
      },
      {
        label: 'Headless-ядро',
        cells: [
          { text: '✓', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: '~ свой UI', tone: 'warn' },
          { text: '✓', tone: 'yes' },
        ],
      },
      {
        label: 'Официальные адаптеры',
        cells: [
          { text: 'React·Vue·Svelte·Solid', tone: 'yes' },
          { text: 'только сторонние', tone: 'warn' },
          { text: '✗', tone: 'no' },
          { text: 'React·Vue·Angular', tone: 'yes' },
          { text: 'через Ark UI', tone: 'warn' },
        ],
      },
      {
        label: 'Мультиокна: z-order, таскбар, модалки',
        cells: [
          { text: '✓', tone: 'yes' },
          { text: 'частично', tone: 'warn' },
          { text: 'частично', tone: 'warn' },
          { text: 'док-группы', tone: 'warn' },
          { text: '✗ одна панель', tone: 'no' },
        ],
      },
      {
        label: 'Snap-зоны',
        cells: [
          { text: '✓ с превью', tone: 'yes' },
          { text: '✗ (открытый запрос)', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: '—', tone: 'plain' },
          { text: '✗', tone: 'no' },
        ],
      },
      {
        label: 'Клавиатура + скринридер',
        cells: [
          { text: '✓', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: 'частично', tone: 'warn' },
          { text: 'частично', tone: 'warn' },
        ],
      },
      {
        label: 'Персист состояния',
        cells: [
          { text: '✓ из коробки', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: '✓', tone: 'yes' },
          { text: '✗', tone: 'no' },
        ],
      },
      {
        label: 'Вынос окна (Document PiP)',
        cells: [
          { text: '✓ experimental', tone: 'yes' },
          { text: '✗', tone: 'no' },
          { text: '✗', tone: 'no' },
          { text: 'window.open', tone: 'warn' },
          { text: '✗', tone: 'no' },
        ],
      },
      {
        label: 'TypeScript',
        cells: [
          { text: 'strict', tone: 'yes' },
          { text: 'только @types', tone: 'warn' },
          { text: '✗', tone: 'no' },
          { text: '✓', tone: 'yes' },
          { text: '✓', tone: 'yes' },
        ],
      },
    ],
    windows: {
      welcomeTitle: 'привет.app',
      welcomeHtml:
        '<p class="win-body"><strong>Это окно настоящее.</strong> Тащите за заголовок, ресайзьте за любую грань, бросьте к краю экрана — оно приснэпится, а жёлтая точка свернёт его в док.</p><p class="win-body" style="margin-top:10px">Клавиатура тоже работает: сфокусируйте меня и двигайте стрелками, Shift+стрелки — ресайз, F6 — цикл по окнам.</p>',
      terminalTitle: 'терминал — zsh',
      metricsTitle: 'метрики',
      metrics: [
        ['<10 кБ', 'ядро, gzip'],
        ['0', 'зависимостей'],
        ['100%', 'покрытие юнитами'],
        ['164', 'e2e-сценария'],
      ],
      playgroundTitle: 'песочница',
      playgroundHint: 'Потыкайте менеджер отсюда:',
      actions: { open: '+ окно', modal: 'модалка', stress: 'стресс ×15', snap: 'снэп влево' },
      spawnedTitle: 'окно',
      spawnedBody: 'Свежее окно. Потаскайте меня.',
      modalTitle: 'модальное окно',
      modalBody: 'Фокус заперт здесь, пока не закроете. Попробуйте кликнуть окна позади.',
    },
  },
}
