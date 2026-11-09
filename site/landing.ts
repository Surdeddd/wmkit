import type { Dict, Lang } from './src/i18n'

export const HOST = 'https://wmkit.vercel.app'

export const LANDING_PATHS: Record<Lang, string> = { en: '/', ru: '/ru/' }

const LOCALES: Record<Lang, string> = { en: 'en_US', ru: 'ru_RU' }
const OTHER: Record<Lang, Lang> = { en: 'ru', ru: 'en' }

export interface LandingOptions {
  lang: Lang
  base: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rewrite(
  html: string,
  pattern: RegExp,
  replace: (groups: string[]) => string,
  what: string,
): string {
  let found = 0
  const out = html.replace(pattern, (...args: unknown[]) => {
    found += 1
    return replace(args.map((arg) => (typeof arg === 'string' ? arg : '')))
  })
  if (found === 0) throw new Error(`wmkit landing: the page template has no ${what}`)
  return out
}

function phrase(dict: Dict, key: string): string {
  const text = dict.ui[key]
  if (text === undefined) throw new Error(`wmkit landing: no ${dict.lang} text for ${key}`)
  return text
}

function classes(...names: string[]): string {
  const kept = names.filter((name) => name !== '')
  return kept.length === 0 ? '' : ` class="${kept.join(' ')}"`
}

function features(dict: Dict): string {
  return dict.features
    .map(
      (feature, index) =>
        `<article class="feature"><p class="num">${String(index + 1).padStart(2, '0')}</p>` +
        `<h3>${escapeHtml(feature.title)}</h3><p>${escapeHtml(feature.text)}</p></article>`,
    )
    .join('')
}

function frameworks(dict: Dict): string {
  return dict.frameworks
    .map(([name, note]) => `<div><b>${escapeHtml(name)}</b><span>${escapeHtml(note)}</span></div>`)
    .join('')
}

function comparison(dict: Dict): string {
  const head = dict.compareHead
    .map((label, index) => {
      const own = classes(label ? '' : 'sr-only-text', index === 1 ? 'col-wmkit' : '')
      const text = label || (dict.ui['cmp.title'] ?? 'wmkit')
      return `<th scope="col"${own}>${escapeHtml(text)}</th>`
    })
    .join('')
  const rows = dict.compareRows
    .map((row) => {
      const cells = row.cells
        .map((cell, index) => {
          const own = classes(
            cell.tone === 'plain' ? '' : cell.tone,
            index === 0 ? 'col-wmkit' : '',
          )
          return `<td${own}>${escapeHtml(cell.text)}</td>`
        })
        .join('')
      return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}</tr>`
    })
    .join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`
}

function headTags(dict: Dict, lang: Lang): string[] {
  const url = (which: Lang) => `${HOST}${LANDING_PATHS[which]}`
  const image = `${HOST}/og.png`
  const alt = escapeHtml(dict.meta.image)
  return [
    `<link rel="canonical" href="${url(lang)}" />`,
    `<link rel="alternate" hreflang="en" href="${url('en')}" />`,
    `<link rel="alternate" hreflang="ru" href="${url('ru')}" />`,
    `<link rel="alternate" hreflang="x-default" href="${url('en')}" />`,
    `<meta property="og:url" content="${url(lang)}" />`,
    '<meta property="og:site_name" content="wmkit" />',
    `<meta property="og:locale" content="${LOCALES[lang]}" />`,
    `<meta property="og:locale:alternate" content="${LOCALES[OTHER[lang]]}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${alt}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(dict.meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(dict.meta.og)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${alt}" />`,
  ]
}

function setMeta(html: string, attribute: string, key: string, value: string): string {
  return rewrite(
    html,
    new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`),
    ([, open, close]) => `${open}${escapeHtml(value)}${close}`,
    `${key} meta`,
  )
}

function fill(html: string, id: string, inner: string): string {
  return rewrite(
    html,
    new RegExp(`(<div\\b[^>]*\\sid="${id}"[^>]*>)\\s*(</div>)`),
    ([, open, close]) => `${open}${inner}${close}`,
    `#${id}`,
  )
}

export function renderLanding(
  template: string,
  dict: Dict,
  { lang, base }: LandingOptions,
): string {
  let html = rewrite(template, /<html lang="[^"]*">/, () => `<html lang="${lang}">`, 'html lang')
  html = rewrite(
    html,
    /<title>[^<]*<\/title>/,
    () => `<title>${escapeHtml(dict.meta.title)}</title>`,
    'title',
  )
  html = setMeta(html, 'name', 'description', dict.meta.description)
  html = setMeta(html, 'property', 'og:title', dict.meta.title)
  html = setMeta(html, 'property', 'og:description', dict.meta.og)
  html = rewrite(
    html,
    /( *)(<meta property="og:type"[^>]*>)/,
    ([, indent, tag]) =>
      [tag, ...headTags(dict, lang)].map((line) => `${indent}${line}`).join('\n'),
    'og:type meta',
  )
  html = rewrite(
    html,
    /(<([a-z][a-z0-9]*)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)[\s\S]*?(<\/\2>)/g,
    ([, open, , key, close]) => `${open}${escapeHtml(phrase(dict, key ?? ''))}${close}`,
    '[data-i18n]',
  )
  html = rewrite(
    html,
    /<[a-z][^>]*\sdata-i18n-aria="([^"]+)"[^>]*>/g,
    ([tag, key]) =>
      (tag ?? '').replace(
        /(\saria-label=")[^"]*(")/,
        (_whole, open: string, close: string) =>
          `${open}${escapeHtml(phrase(dict, key ?? ''))}${close}`,
      ),
    '[data-i18n-aria]',
  )
  html = rewrite(
    html,
    /<[a-z][^>]*\sdata-i18n-href="([^"]+)"[^>]*>/g,
    ([tag, key]) =>
      (tag ?? '').replace(
        /(\shref=")[^"]*(")/,
        (_whole, open: string, close: string) =>
          `${open}${escapeHtml(base + phrase(dict, key ?? ''))}${close}`,
      ),
    '[data-i18n-href]',
  )
  html = fill(html, 'feature-grid', features(dict))
  html = fill(html, 'fw-row', frameworks(dict))
  return fill(html, 'compare-table', comparison(dict))
}
