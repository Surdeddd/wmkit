export const HOST = 'https://wmkit.vercel.app'

export const LANDING = { en: `${HOST}/`, ru: `${HOST}/ru/` } as const

type HeadTag = [string, Record<string, string>]

export function pageUrl(relativePath: string): string {
  const path = relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html')
  return `${HOST}/docs/${path}`
}

export function twins(relativePath: string): { en: string; ru: string } {
  const en = relativePath.replace(/^ru\//, '')
  return { en, ru: `ru/${en}` }
}

export function alternates(relativePath: string, served: ReadonlySet<string>): HeadTag[] {
  const { en, ru } = twins(relativePath)
  if (!served.has(en) || !served.has(ru)) return []
  return [
    ['link', { rel: 'alternate', hreflang: 'en', href: pageUrl(en) }],
    ['link', { rel: 'alternate', hreflang: 'ru', href: pageUrl(ru) }],
    ['link', { rel: 'alternate', hreflang: 'x-default', href: pageUrl(en) }],
  ]
}

export function landingSitemap(): string {
  const links = [
    `    <xhtml:link rel="alternate" hreflang="en" href="${LANDING.en}"/>`,
    `    <xhtml:link rel="alternate" hreflang="ru" href="${LANDING.ru}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${LANDING.en}"/>`,
  ]
  const entry = (url: string) => ['  <url>', `    <loc>${url}</loc>`, ...links, '  </url>']
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entry(LANDING.en),
    ...entry(LANDING.ru),
    '</urlset>',
    '',
  ].join('\n')
}

export function robots(): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${HOST}/sitemap.xml`,
    `Sitemap: ${HOST}/docs/sitemap.xml`,
    '',
  ].join('\n')
}
