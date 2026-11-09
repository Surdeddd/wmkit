import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type Alias, type Plugin, runnerImport } from 'vite'
import { themeShadowCss } from '../src/themes/index'
import { renderLanding } from './landing'
import type { Dict, Lang } from './src/i18n'

export const RUSSIAN_PAGE = fileURLToPath(new URL('./ru/index.html', import.meta.url))

const TEMPLATE = fileURLToPath(new URL('./index.html', import.meta.url))
const CATALOGUE = fileURLToPath(new URL('./src/i18n.ts', import.meta.url))
const SHADOW_THEMES = 'virtual:wmkit-shadow-themes'

function shadowThemeModule(id: string): string | null {
  if (id === `\0${SHADOW_THEMES}`) {
    const loaders = Object.keys(themeShadowCss).map(
      (name) => `  ${name}: () => import('${SHADOW_THEMES}/${name}').then((m) => m.default),`,
    )
    return `export default {\n${loaders.join('\n')}\n}\n`
  }
  if (!id.startsWith(`\0${SHADOW_THEMES}/`)) return null
  const css = (themeShadowCss as Record<string, string>)[id.slice(SHADOW_THEMES.length + 2)]
  if (css === undefined) throw new Error(`wmkit landing: no theme behind ${id.slice(1)}`)
  return `export default ${JSON.stringify(css)}\n`
}

interface Sources {
  dictionaries: Record<Lang, Dict>
}

function pageLang(path: string): Lang | null {
  if (path === '/index.html') return 'en'
  return path === '/ru/index.html' ? 'ru' : null
}

export function landingPages(): Plugin {
  let base = '/'
  let alias: Alias[] = []
  let sources: Promise<Sources> | null = null

  const load = (): Promise<Sources> => {
    sources ??= (async () => {
      const inline = { configFile: false as const, logLevel: 'error' as const, resolve: { alias } }
      const catalogue = await runnerImport<Sources>(CATALOGUE, inline)
      return { dictionaries: catalogue.module.dictionaries }
    })()
    return sources
  }

  return {
    name: 'wmkit-landing',
    enforce: 'pre',
    configResolved(config) {
      base = config.base
      alias = config.resolve.alias
    },
    resolveId(id) {
      if (id === RUSSIAN_PAGE) return RUSSIAN_PAGE
      return id === SHADOW_THEMES || id.startsWith(`${SHADOW_THEMES}/`) ? `\0${id}` : null
    },
    load(id) {
      return id === RUSSIAN_PAGE ? readFileSync(TEMPLATE, 'utf8') : shadowThemeModule(id)
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html, context) {
        const lang = pageLang(context.path)
        if (lang === null) return html
        return renderLanding(html, (await load()).dictionaries[lang], { lang, base })
      },
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = (request.url ?? '').split('?')[0] ?? ''
        const local = path.startsWith(base) ? `/${path.slice(base.length)}` : path
        if (local !== '/ru/' && local !== '/ru/index.html') {
          next()
          return
        }
        try {
          const template = readFileSync(TEMPLATE, 'utf8')
          const html = await server.transformIndexHtml('/ru/index.html', template, request.url)
          response.setHeader('Content-Type', 'text/html')
          response.end(html)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}
