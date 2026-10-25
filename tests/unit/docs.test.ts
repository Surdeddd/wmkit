import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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

describe('the markdown we ship', () => {
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
})
