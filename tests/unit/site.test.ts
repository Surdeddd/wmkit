// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { HOST, LANDING_PATHS, renderLanding } from '../../site/landing'
import { shadowCss } from '../../site/src/builder'
import { dictionaries, type Lang } from '../../site/src/i18n'

const root = `${resolve(dirname(fileURLToPath(import.meta.url)), '../..')}/`
const template = readFileSync(`${root}site/index.html`, 'utf8')
const page = new DOMParser().parseFromString(template, 'text/html')
const squash = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim()
const LANGS = ['en', 'ru'] as const

function built(lang: Lang, base = '/wmkit/'): Document {
  return new DOMParser().parseFromString(
    renderLanding(template, dictionaries[lang], { lang, base }),
    'text/html',
  )
}

function attribute(doc: Document, selector: string, name: string): string | null {
  return doc.querySelector(selector)?.getAttribute(name) ?? null
}

describe('what the landing tells a screen reader', () => {
  it('sums up many windows changed at once, in the language of the page', () => {
    for (const key of ['openedMany', 'closedMany', 'minimizedMany', 'restoredMany'] as const) {
      const [en, ru] = LANGS.map((lang) => dictionaries[lang].announce[key]?.(5) ?? '')
      expect(en, key).toMatch(/5/)
      expect(en, key).not.toMatch(/[а-яё]/i)
      expect(ru, key).toMatch(/5/)
      expect(ru, key).toMatch(/[а-яё]/i)
    }
  })
})

describe('the landing page before its script runs', () => {
  it('shows the English catalogue as its static text', () => {
    const nodes = [...page.querySelectorAll<HTMLElement>('[data-i18n]')]
    expect(nodes.length).toBeGreaterThan(10)
    for (const node of nodes) {
      const key = node.dataset.i18n ?? ''
      expect(squash(node.textContent), key).toBe(dictionaries.en.ui[key])
    }
  })

  it('names every landmark through the catalogue, in both languages', () => {
    const labelled = [...page.querySelectorAll<HTMLElement>('[aria-label]')]
    expect(labelled.length).toBeGreaterThan(0)
    for (const node of labelled) {
      const key = node.dataset.i18nAria ?? ''
      expect(key, node.outerHTML.slice(0, 60)).not.toBe('')
      expect(node.getAttribute('aria-label'), key).toBe(dictionaries.en.ui[key])
      expect(dictionaries.ru.ui[key], key).toBeTruthy()
    }
  })

  it('gives both languages the same interface keys', () => {
    expect(Object.keys(dictionaries.ru.ui).sort()).toEqual(Object.keys(dictionaries.en.ui).sort())
  })
})

describe('the landing page as the build writes it', () => {
  for (const lang of LANGS) {
    const dict = dictionaries[lang]

    it(`carries its ${lang} text from the catalogue the script uses`, () => {
      const doc = built(lang)
      expect(doc.documentElement.lang).toBe(lang)
      expect(doc.title).toBe(dict.meta.title)
      expect(attribute(doc, 'meta[name="description"]', 'content')).toBe(dict.meta.description)
      const texts = [...doc.querySelectorAll<HTMLElement>('[data-i18n]')]
      expect(texts.length).toBeGreaterThan(10)
      for (const node of texts) {
        expect(node.textContent, node.dataset.i18n).toBe(dict.ui[node.dataset.i18n ?? ''])
      }
      for (const node of doc.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
        expect(node.getAttribute('aria-label')).toBe(dict.ui[node.dataset.i18nAria ?? ''])
      }
    })

    it(`lists the ${lang} features, adapters and comparison before any script runs`, () => {
      const doc = built(lang)
      const titles = [...doc.querySelectorAll('#feature-grid .feature h3')].map(
        (h) => h.textContent,
      )
      expect(titles).toEqual(dict.features.map((feature) => feature.title))
      expect(doc.querySelectorAll('#fw-row > div')).toHaveLength(dict.frameworks.length)
      const table = doc.querySelector('#compare-table table')
      expect(table?.querySelector('thead .col-wmkit')?.textContent).toBe('wmkit')
      expect(table?.querySelectorAll('tbody tr')).toHaveLength(dict.compareRows.length)
      expect(table?.querySelector('tbody th')?.textContent).toBe(dict.compareRows[0]?.label)
    })

    it(`names its own ${lang} address and its twin for search engines and link previews`, () => {
      const doc = built(lang)
      const own = `${HOST}${LANDING_PATHS[lang]}`
      expect(attribute(doc, 'link[rel="canonical"]', 'href')).toBe(own)
      expect(attribute(doc, 'link[hreflang="en"]', 'href')).toBe(`${HOST}/`)
      expect(attribute(doc, 'link[hreflang="ru"]', 'href')).toBe(`${HOST}/ru/`)
      expect(attribute(doc, 'link[hreflang="x-default"]', 'href')).toBe(`${HOST}/`)
      expect(attribute(doc, 'meta[property="og:url"]', 'content')).toBe(own)
      expect(attribute(doc, 'meta[property="og:locale"]', 'content')).toBe(
        lang === 'ru' ? 'ru_RU' : 'en_US',
      )
      expect(attribute(doc, 'meta[property="og:title"]', 'content')).toBe(dict.meta.title)
      expect(attribute(doc, 'meta[property="og:description"]', 'content')).toBe(dict.meta.og)
      expect(attribute(doc, 'meta[property="og:image"]', 'content')).toBe(`${HOST}/og.png`)
      expect(attribute(doc, 'meta[property="og:image:alt"]', 'content')).toBe(dict.meta.image)
      expect(attribute(doc, 'meta[name="twitter:card"]', 'content')).toBe('summary_large_image')
      expect(attribute(doc, 'meta[name="twitter:image"]', 'content')).toBe(`${HOST}/og.png`)
    })

    it(`points the ${lang} docs link at the docs of the same language under any base`, () => {
      for (const base of ['/', '/wmkit/']) {
        const link = built(lang, base).querySelector('[data-i18n-href="link.docs"]')
        expect(link?.getAttribute('href'), base).toBe(`${base}${dict.ui['link.docs']}`)
      }
    })
  }

  it('declares the real size of the preview image', () => {
    const png = readFileSync(`${root}site/public/og.png`)
    const doc = built('en')
    expect(Number(attribute(doc, 'meta[property="og:image:width"]', 'content'))).toBe(
      png.readUInt32BE(16),
    )
    expect(Number(attribute(doc, 'meta[property="og:image:height"]', 'content'))).toBe(
      png.readUInt32BE(20),
    )
  })

  it('shows Russian on the Russian page, not the English template', () => {
    const doc = built('ru')
    expect(doc.querySelector('h1')?.textContent).toContain('ОКНА')
    expect(doc.body.textContent).not.toContain('Everything a desktop has')
  })
})

describe('the readme app', () => {
  it('promises no adapter size the adapters break', () => {
    const longest = Math.max(
      ...readdirSync(`${root}src/adapters`).map(
        (file) => readFileSync(`${root}src/adapters/${file}`, 'utf8').trimEnd().split('\n').length,
      ),
    )
    for (const dict of Object.values(dictionaries)) {
      const claim = /around (\d+) lines/.exec(dict.readme.body)
      if (claim) expect(longest, dict.lang).toBeLessThanOrEqual(Number(claim[1]) * 1.25)
    }
  })
})

describe('the window designer', () => {
  it('moves preset CSS into a shadow root that beats the page theme', () => {
    const scope = '[data-wm-desktop] [data-wm-window][data-wm-skin="custom"]'
    const css = [
      `${scope} { background: #fff; color: red !important; }`,
      `${scope} [data-wm-drag] { display: flex; }`,
      `${scope} [data-wm-content] { padding: 14px; }`,
      `${scope} .lights button:hover { opacity: 1; }`,
    ].join('\n')
    expect(shadowCss(css).split('\n')).toEqual([
      ':host { background: #fff !important; color: red !important; }',
      '[data-wm-drag] { display: flex; }',
      '::slotted([data-wm-content]) { padding: 14px !important; }',
      '.lights button:hover { opacity: 1; }',
    ])
    expect(shadowCss(':host { color: red; }')).toBe(':host { color: red !important; }')
  })
})
