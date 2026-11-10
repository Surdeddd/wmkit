import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rawInlineCode } from '../../docs/.vitepress/markdown'
import {
  alternates,
  HOST,
  LANDING,
  landingSitemap,
  pageUrl,
  robots,
} from '../../docs/.vitepress/seo'

const root = new URL('../../', import.meta.url).pathname

function docsPages(dir = 'docs'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'superpowers') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...docsPages(path))
    else if (entry.name.endsWith('.md')) found.push(path)
  }
  return found
}

function markdownFiles(): string[] {
  return ['README.md', 'README.ru.md', ...docsPages()]
}

function served(page: string): string {
  const path = page.replace(/^docs\//, '').replace(/(^|\/)README(\.ru)?\.md$/, '$1index$2.md')
  return path.endsWith('.ru.md') ? `ru/${path.replace(/\.ru\.md$/, '.md')}` : path
}

function frontMatter(text: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? ''
  const fields: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const field = /^(\w+): (.*)$/.exec(line)
    if (field) fields[field[1] as string] = (field[2] as string).trim()
  }
  return fields
}

interface Line {
  number: number
  text: string
  fenced: boolean
}

/** walk a file, marking which lines a markdown renderer will treat as code */
function scan(source: string): { lines: Line[]; open: string | null } {
  const lines: Line[] = []
  let fence: string | null = null
  for (const [index, text] of source.split('\n').entries()) {
    const marker = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(text)
    const closing = marker !== null && fence !== null && marker[1]?.startsWith(fence) === true
    if (closing) {
      lines.push({ number: index + 1, text, fenced: true })
      fence = null
      continue
    }
    if (marker !== null && fence === null) {
      lines.push({ number: index + 1, text, fenced: true })
      fence = marker[1] as string
      continue
    }
    lines.push({ number: index + 1, text, fenced: fence !== null })
  }
  return { lines, open: fence }
}

function fieldsOf(text: string, name: string): Map<string, string> {
  const block = new RegExp(`interface ${name}\\b[^{\\n]*\\{\\n([\\s\\S]*?)\\n\\}`).exec(text)
  const fields = new Map<string, string>()
  for (const line of (block?.[1] ?? '').split('\n')) {
    const field = /^ {2}(\w+\??): (.*)$/.exec(line)
    if (field) fields.set(field[1] as string, (field[2] as string).replace(/\s*\/\/.*$/, '').trim())
  }
  return fields
}

function blockOf(text: string, name: string): { parents: string[]; body: string } {
  const block = new RegExp(`interface ${name}\\b([^{\\n]*)\\{\\n([\\s\\S]*?)\\n\\}`).exec(text)
  const parents = /extends ([\w, ]+)/.exec(block?.[1] ?? '')?.[1]?.split(',') ?? []
  return { parents: parents.map((parent) => parent.trim()), body: block?.[2] ?? '' }
}

/** member names of an interface, inherited ones included, methods and properties alike */
function membersOf(text: string, name: string): string[] {
  const { parents, body } = blockOf(text, name)
  const own = [...body.matchAll(/^ {2}(\w+)\??[(:]/gm)].map((match) => match[1] as string)
  return [...parents.flatMap((parent) => membersOf(text, parent)), ...own]
}

/** member names of an option object the docs write out inline, on one line or several */
function inlineMembersOf(body: string, field: string): string[] {
  const line = new RegExp(`^ {2}${field}\\?: [^\\n]*$`, 'm').exec(body)
  if (!line) return []
  const head = line[0].replace(/\s*\/\/.*$/, '')
  if (head.endsWith('{')) {
    const rest = body.slice(line.index + line[0].length)
    const nested = rest.slice(0, rest.search(/^ {2}\}/m))
    return [...nested.matchAll(/^ {4}(\w+)\??:/gm)].map((match) => match[1] as string)
  }
  const inline = /\{([^}]*)\}/.exec(head)?.[1] ?? ''
  return [...inline.matchAll(/(\w+)\??:/g)].map((match) => match[1] as string)
}

describe('the markdown we ship', () => {
  it('keeps double braces in inline code out of the page compiler', () => {
    const marked: Array<[string, string]> = []
    const token = { attrSet: (name: string, value: string) => void marked.push([name, value]) }
    const md: Parameters<typeof rawInlineCode>[0] = {
      renderer: { rules: { code_inline: () => '<code>{{title}}</code>' } },
    }
    rawInlineCode(md)
    expect(md.renderer.rules.code_inline?.([token], 0, {}, {}, {})).toBe('<code>{{title}}</code>')
    expect(marked).toEqual([['v-pre', '']])

    const bare: Parameters<typeof rawInlineCode>[0] = { renderer: { rules: {} } }
    expect(() => rawInlineCode(bare)).not.toThrow()
    expect(bare.renderer.rules).toEqual({})
  })

  it('writes double braces only where the page compiler cannot see them', () => {
    const exposed: string[] = []
    for (const file of docsPages()) {
      const prose = readFileSync(join(root, file), 'utf8')
        .replace(/^(`{3,}|~{3,})[\s\S]*?^\1[ \t]*$/gm, '')
        .replace(/<span v-pre>[\s\S]*?<\/span>/g, '')
        .replace(/`[^`\n]*`/g, '')
      if (prose.includes('{{')) exposed.push(file)
    }
    expect(exposed, `${exposed.join(', ')} show {{ outside code`).toEqual([])
  })

  it('closes every code fence it opens', () => {
    const unbalanced: string[] = []
    for (const file of markdownFiles()) {
      const { open } = scan(readFileSync(join(root, file), 'utf8'))
      if (open !== null) unbalanced.push(file)
    }
    expect(unbalanced, `${unbalanced.join(', ')} end inside a code block`).toEqual([])
  })

  it('never swallows a heading into a code block', () => {
    const swallowed: string[] = []
    for (const file of markdownFiles()) {
      const { lines } = scan(readFileSync(join(root, file), 'utf8'))
      for (const line of lines) {
        // a heading is only a heading outside a fence; one inside is almost always a lost section
        if (line.fenced && /^#{2,4} /.test(line.text)) {
          swallowed.push(`${file}:${line.number} ${line.text.trim().slice(0, 60)}`)
        }
      }
    }
    expect(swallowed, swallowed.join('\n')).toEqual([])
  })

  it('gives every English docs page a Russian twin', () => {
    const missing = docsPages()
      .filter((page) => !page.endsWith('.ru.md'))
      .map((page) => page.replace(/\.md$/, '.ru.md'))
      .filter((twin) => !existsSync(join(root, twin)))
    expect(missing, `missing twins: ${missing.join(', ')}`).toEqual([])
  })

  it('links only to files that exist', () => {
    const dead: string[] = []
    for (const file of markdownFiles()) {
      const { lines } = scan(readFileSync(join(root, file), 'utf8'))
      for (const line of lines) {
        if (line.fenced) continue
        for (const [, href] of line.text.matchAll(/\]\(([^)\s]+)\)/g)) {
          if (!href || /^[a-z]+:|^#|^\//i.test(href)) continue
          const target = resolve(dirname(join(root, file)), href.split('#')[0] as string)
          if (!existsSync(target)) dead.push(`${file}:${line.number} ${href}`)
        }
      }
    }
    expect(dead, dead.join('\n')).toEqual([])
  })

  it('declares the public state types exactly as the source does', () => {
    const source = readFileSync(join(root, 'src/core/types.ts'), 'utf8')
    const api = readFileSync(join(root, 'docs/api.md'), 'utf8')
    const names = [
      'WindowFlags',
      'WindowState',
      'WindowInit',
      'WindowGroup',
      'ManagerState',
      'SerializedState',
      'ManagerEvents',
      'ManagerOptions',
    ]
    const drifted: string[] = []
    for (const name of names) {
      const documented = fieldsOf(api, name)
      const declared = fieldsOf(source, name)
      expect(declared.size, `${name} was not found in src/core/types.ts`).toBeGreaterThan(0)
      expect(documented.size, `${name} was not found in docs/api.md`).toBeGreaterThan(0)
      for (const [field, type] of declared) {
        if (documented.get(field) !== type) {
          drifted.push(
            `${name}.${field}: source ${type}, docs ${documented.get(field) ?? 'missing'}`,
          )
        }
      }
      for (const field of documented.keys()) {
        if (!declared.has(field)) drifted.push(`${name}.${field}: documented, not in the source`)
      }
    }
    expect(drifted, drifted.join('\n')).toEqual([])
  })

  it('lists every member of the desktop options and controller the source declares', () => {
    const source = ['src/dom/shared.ts', 'src/core/geometry.ts']
      .map((file) => readFileSync(join(root, file), 'utf8'))
      .join('\n')
    const api = readFileSync(join(root, 'docs/api.md'), 'utf8')
    const drifted: string[] = []
    const compare = (label: string, declared: string[], documented: string[]) => {
      expect(declared.length, `${label} was not found in the source`).toBeGreaterThan(0)
      expect(documented.length, `${label} was not found in docs/api.md`).toBeGreaterThan(0)
      for (const member of declared) {
        if (!documented.includes(member)) drifted.push(`${label}.${member}: not documented`)
      }
      for (const member of documented) {
        if (!declared.includes(member)) drifted.push(`${label}.${member}: not in the source`)
      }
    }
    for (const name of ['DesktopOptions', 'DesktopController']) {
      compare(name, membersOf(source, name), membersOf(api, name))
    }
    const options = blockOf(source, 'DesktopOptions').body
    const documented = blockOf(api, 'DesktopOptions').body
    const nested = [...options.matchAll(/^ {2}(\w+)\?: (?:boolean \| )?(\w+Options)$/gm)]
    expect(nested.length, 'no nested option object was found').toBeGreaterThanOrEqual(6)
    for (const [, field, type] of nested) {
      compare(
        `DesktopOptions.${field}`,
        membersOf(source, type as string),
        inlineMembersOf(documented, field as string),
      )
    }
    expect(drifted, drifted.join('\n')).toEqual([])
  })
})

describe('what the docs tell search engines', () => {
  it('describes every page in words of its own, in the language of the page', () => {
    const seen: Record<'en' | 'ru', Map<string, string>> = { en: new Map(), ru: new Map() }
    for (const page of docsPages()) {
      const lang = page.endsWith('.ru.md') ? 'ru' : 'en'
      const description = frontMatter(readFileSync(join(root, page), 'utf8')).description ?? ''
      expect(description.length, `${page} has no description`).toBeGreaterThan(60)
      expect(description, page).not.toMatch(/: | #|^[@`'"*&!|>%{[]/)
      expect(/[а-яё]/i.test(description), `${page} is described in the wrong language`).toBe(
        lang === 'ru',
      )
      expect(seen[lang].get(description), `${page} repeats ${seen[lang].get(description)}`).toBe(
        undefined,
      )
      seen[lang].set(description, page)
    }
  })

  it('links every page to its twin in the other language', () => {
    const pages = new Set(docsPages().map(served))
    expect(pages.has('index.md') && pages.has('ru/index.md')).toBe(true)
    for (const page of pages) {
      const english = page.replace(/^ru\//, '')
      const links = Object.fromEntries(
        alternates(page, pages).map(([, attributes]) => [attributes.hreflang, attributes.href]),
      )
      expect(links, page).toEqual({
        en: pageUrl(english),
        ru: pageUrl(`ru/${english}`),
        'x-default': pageUrl(english),
      })
    }
    expect(alternates('orphan.md', new Set(['orphan.md']))).toEqual([])
    expect(pageUrl('ru/guides/windows-95-desktop-react.md')).toBe(
      `${HOST}/docs/ru/guides/windows-95-desktop-react.html`,
    )
  })

  it('lists the landing in both languages in a sitemap that robots.txt points to', () => {
    const sitemap = landingSitemap()
    for (const url of [LANDING.en, LANDING.ru]) expect(sitemap).toContain(`<loc>${url}</loc>`)
    expect(sitemap).toContain(`hreflang="ru" href="${HOST}/ru/"`)
    expect(robots()).toContain(`Sitemap: ${HOST}/sitemap.xml`)
    expect(robots()).toContain(`Sitemap: ${HOST}/docs/sitemap.xml`)
  })

  it('answers a docs address without .html on Vercel, as the mirror and preview already do', () => {
    const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
      rewrites?: Array<{ source: string; destination: string }>
    }
    const rewrite = (path: string): string | null => {
      for (const { source, destination } of config.rewrites ?? []) {
        const names: string[] = []
        const pattern = source.replace(
          /:(\w+)(?:\(((?:[^()]|\([^()]*\))*)\))?/g,
          (_whole, name: string, custom?: string) => {
            names.push(name)
            return `(${custom ?? '[^/]+'})`
          },
        )
        const match = new RegExp(`^${pattern}$`).exec(path)
        if (!match) continue
        return names.reduce(
          (target, name, index) => target.replace(`:${name}`, match[index + 1] as string),
          destination,
        )
      }
      return null
    }
    for (const page of docsPages().map(served)) {
      if (page.endsWith('index.md')) continue
      const address = new URL(pageUrl(page)).pathname
      expect(rewrite(address.replace(/\.html$/, '')), page).toBe(address)
    }
    for (const kept of [
      '/docs/ru',
      '/docs/sitemap.xml',
      '/docs/assets/app.js',
      '/docs/ru/assets/app.js',
    ]) {
      expect(rewrite(kept), kept).toBeNull()
    }
  })
})
