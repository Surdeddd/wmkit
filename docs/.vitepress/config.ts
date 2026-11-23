import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type DefaultTheme, defineConfig, type MarkdownOptions, type SiteConfig } from 'vitepress'
import { llmsText } from '../../scripts/llms.mjs'
import { rawInlineCode } from './markdown'
import { alternates, HOST, LANDING, landingSitemap, pageUrl, robots } from './seo'

const base = process.env.VERCEL ? '/docs/' : '/wmkit/docs/'
const docs = fileURLToPath(new URL('..', import.meta.url))
const src = (path: string) => fileURLToPath(new URL(`../../src/${path}`, import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(docs, '../package.json'), 'utf8')) as {
  version: string
}

const PAGES = {
  en: [
    [
      'Guide',
      [
        ['Overview', '/'],
        ['Recipes', '/recipes'],
        ['Theming', '/theming'],
        ['Browser support', '/browser-support'],
        ['Migrating from WinBox', '/winbox-migration'],
      ],
    ],
    [
      'Reference',
      [
        ['API', '/api'],
        ['Adapters', '/adapters'],
      ],
    ],
    [
      'Walkthroughs',
      [
        ['Draggable, resizable window in React', '/guides/react-draggable-resizable-window'],
        ['Draggable, resizable window in Vue', '/guides/vue-draggable-resizable-window'],
        ['Windows in plain HTML', '/guides/web-components-window-manager'],
        ['Dockable panels like an IDE', '/guides/dockable-panels-ide-layout'],
        ['Taskbar, snap layouts and Alt+Tab', '/guides/taskbar-snap-layouts-window-switcher'],
        ['Windows 95 desktop in React', '/guides/windows-95-desktop-react'],
        ['For AI coding agents', '/guides/ai-coding-agents'],
      ],
    ],
    [
      'Comparisons',
      [
        ['A WinBox alternative', '/compare/winbox-alternative'],
        ['dockview or wmkit', '/compare/dockview-alternative'],
        ['react-rnd or wmkit', '/compare/react-rnd-alternative'],
      ],
    ],
  ],
  ru: [
    [
      'Руководство',
      [
        ['Обзор', '/'],
        ['Рецепты', '/recipes'],
        ['Темы', '/theming'],
        ['Поддержка браузеров', '/browser-support'],
        ['Переезд с WinBox', '/winbox-migration'],
      ],
    ],
    [
      'Справочник',
      [
        ['API', '/api'],
        ['Адаптеры', '/adapters'],
      ],
    ],
    [
      'Пошагово',
      [
        ['Окно с ресайзом на React', '/guides/react-draggable-resizable-window'],
        ['Окно с ресайзом на Vue', '/guides/vue-draggable-resizable-window'],
        ['Окна на чистом HTML', '/guides/web-components-window-manager'],
        ['Закрепляемые панели как в IDE', '/guides/dockable-panels-ide-layout'],
        ['Панель задач, раскладки и Alt+Tab', '/guides/taskbar-snap-layouts-window-switcher'],
        ['Рабочий стол Windows 95 на React', '/guides/windows-95-desktop-react'],
        ['Для ИИ-агентов', '/guides/ai-coding-agents'],
      ],
    ],
    [
      'Сравнения',
      [
        ['Альтернатива WinBox', '/compare/winbox-alternative'],
        ['dockview или wmkit', '/compare/dockview-alternative'],
        ['react-rnd или wmkit', '/compare/react-rnd-alternative'],
      ],
    ],
  ],
} as const

function sidebar(locale: 'en' | 'ru'): DefaultTheme.SidebarItem[] {
  const prefix = locale === 'ru' ? '/ru' : ''
  return PAGES[locale].map(([text, items]) => ({
    text,
    items: items.map(([label, link]) => ({ text: label, link: `${prefix}${link}` })),
  }))
}

function writeLlms(config: SiteConfig): void {
  const served = (page: string) => config.rewrites.map[page] ?? page
  const english = config.pages.filter((page) => !served(page).startsWith('ru/')).sort()
  const full: string[] = []
  for (const page of english) {
    const text = readFileSync(join(config.srcDir, page), 'utf8')
    full.push(`<!-- ${pageUrl(served(page))} -->`, text.replace(/^---[\s\S]*?---\n/, ''), '')
  }
  const root = resolve(config.outDir, '..')
  writeFileSync(join(root, 'llms.txt'), llmsText({ version: pkg.version }))
  writeFileSync(join(root, 'llms-full.txt'), full.join('\n'))
  writeFileSync(join(root, 'robots.txt'), robots())
  writeFileSync(join(root, 'sitemap.xml'), landingSitemap())
}

const REPO = 'https://github.com/Surdeddd/wmkit/blob/main/'

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const twinLinks: NonNullable<MarkdownOptions['config']> = (md) => {
  const original = md.renderer.rules.link_open
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index]
    const href = token?.attrGet('href')
    if (token && href && !/^[a-z]+:|^#|^\//i.test(href)) {
      const [path = '', hash = ''] = href.split('#')
      const suffix = hash ? `#${hash}` : ''
      const target = resolve(dirname(env.path as string), path)
      if (relative(docs, target).startsWith('..')) {
        token.attrSet('href', REPO + relative(resolve(docs, '..'), target) + suffix)
      } else if (path.endsWith('.ru.md')) {
        token.attrSet('href', path.replace(/\.ru\.md$/, '.md') + suffix)
      }
    }
    return original
      ? original(tokens, index, options, env, self)
      : self.renderToken(tokens, index, options)
  }
}

export default defineConfig({
  base,
  srcExclude: ['superpowers/**'],
  outDir: '../site/dist/docs',
  cacheDir: '.vitepress/cache',
  title: 'wmkit',
  description: 'Headless window manager for the web',
  lastUpdated: false,
  rewrites: {
    'README.md': 'index.md',
    'README.ru.md': 'ru/index.md',
    ':name.ru.md': 'ru/:name.md',
    ':dir/:name.ru.md': 'ru/:dir/:name.md',
  },
  sitemap: { hostname: `${HOST}/docs/` },
  transformPageData(pageData, { siteConfig }) {
    const served = new Set(siteConfig.pages.map((page) => siteConfig.rewrites.map[page] ?? page))
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: pageUrl(pageData.relativePath) }],
      ...alternates(pageData.relativePath, served),
    )
  },
  buildEnd: writeLlms,
  markdown: {
    config(md) {
      twinLinks(md)
      rawInlineCode(md as unknown as Parameters<typeof rawInlineCode>[0])
    },
    anchor: { slugify },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Demo', link: LANDING.en },
          { text: `v${pkg.version}`, link: 'https://www.npmjs.com/package/@surdeddd/wmkit' },
        ],
        sidebar: sidebar('en'),
      },
    },
    ru: {
      label: 'Русский',
      lang: 'ru',
      description: 'Headless-оконный менеджер для веба',
      themeConfig: {
        nav: [
          { text: 'Демо', link: LANDING.ru },
          { text: `v${pkg.version}`, link: 'https://www.npmjs.com/package/@surdeddd/wmkit' },
        ],
        sidebar: sidebar('ru'),
        outline: { label: 'На этой странице' },
        docFooter: { prev: 'Назад', next: 'Дальше' },
        darkModeSwitchLabel: 'Тема',
        sidebarMenuLabel: 'Меню',
        returnToTopLabel: 'Наверх',
        langMenuLabel: 'Язык',
      },
    },
  },
  themeConfig: {
    socialLinks: [{ icon: 'github', link: 'https://github.com/Surdeddd/wmkit' }],
    search: { provider: 'local' },
    outline: [2, 3],
  },
  vite: {
    resolve: {
      alias: {
        '@surdeddd/wmkit/react': src('adapters/react.ts'),
        '@surdeddd/wmkit/winbox': src('plugins/winbox/index.ts'),
        '@surdeddd/wmkit/themes': src('themes'),
        '@surdeddd/wmkit': src('index.ts'),
      },
    },
  },
})
