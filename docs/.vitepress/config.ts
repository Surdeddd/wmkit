import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type DefaultTheme, defineConfig, type MarkdownOptions, type SiteConfig } from 'vitepress'

const HOST = 'https://wmkit.vercel.app'
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
        ['Windows 95 desktop in React', '/guides/windows-95-desktop-react'],
        ['A WinBox alternative', '/compare/winbox-alternative'],
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
        ['Рабочий стол Windows 95 на React', '/guides/windows-95-desktop-react'],
        ['Альтернатива WinBox', '/compare/winbox-alternative'],
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

function pageUrl(relativePath: string): string {
  const path = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')
  return `${HOST}/docs/${path}`
}

function writeLlms(config: SiteConfig): void {
  const served = (page: string) => config.rewrites.map[page] ?? page
  const english = config.pages.filter((page) => !served(page).startsWith('ru/')).sort()
  const read = (page: string) => readFileSync(join(config.srcDir, page), 'utf8')
  const meta = (text: string) => {
    const title = /^title:\s*(.+)$/m.exec(text)?.[1] ?? /^#\s+(.+)$/m.exec(text)?.[1] ?? 'wmkit'
    const description = /^description:\s*(.+)$/m.exec(text)?.[1] ?? ''
    return { title: title.trim(), description: description.trim() }
  }
  const lines = [
    '# wmkit',
    '',
    `> Headless window manager for the web, version ${pkg.version}: a serializable state machine, a DOM controller and adapters for React, Vue, Svelte, Solid, Angular, Preact, Lit, Qwik and web components. Drag, resize, snap, tabs, docking, workspaces, undo, persistence, keyboard and screen-reader support.`,
    '',
    '## Docs',
    '',
  ]
  const full: string[] = []
  for (const page of english) {
    const text = read(page)
    const { title, description } = meta(text)
    const url = pageUrl(served(page))
    lines.push(`- [${title}](${url})${description ? `: ${description}` : ''}`)
    full.push(`<!-- ${url} -->`, text.replace(/^---[\s\S]*?---\n/, ''), '')
  }
  lines.push('', '## Optional', '', `- [Source on GitHub](https://github.com/Surdeddd/wmkit)`, '')
  const root = resolve(config.outDir, '..')
  writeFileSync(join(root, 'llms.txt'), lines.join('\n'))
  writeFileSync(join(root, 'llms-full.txt'), full.join('\n'))
  writeFileSync(
    join(root, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${HOST}/docs/sitemap.xml\n`,
  )
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
  transformPageData(pageData) {
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push([
      'link',
      { rel: 'canonical', href: pageUrl(pageData.relativePath) },
    ])
  },
  buildEnd: writeLlms,
  markdown: { config: twinLinks, anchor: { slugify } },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Demo', link: `${HOST}/` },
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
          { text: 'Демо', link: `${HOST}/` },
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
