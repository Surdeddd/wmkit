import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { surface } from './support/surface'

const root = fileURLToPath(new URL('../../', import.meta.url))
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const generator = new URL('../../scripts/llms.mjs', import.meta.url).href

interface Generator {
  ENTRY_NOTES: Record<string, string>
  RULES: string[]
  llmsText(options?: { version?: string }): string
  exportedEntries(): string[]
  docsIndex(): Array<{ url: string; title: string; description: string }>
}

const load = async (): Promise<Generator> => (await import(generator)) as Generator
const quoted = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1] as string)
const names = (text: string) =>
  quoted(text)
    .map((token) => token.replace(/\(.*\)$/, ''))
    .filter((token) => /^[A-Za-z_$][\w$]*$/.test(token))

function members(file: string, type: string): Set<string> {
  const body = new RegExp(`export interface ${type}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(
    read(file),
  )?.[1]
  return new Set(
    [...(body ?? '').matchAll(/^ {2}([A-Za-z]+)[(<?:]/gm)].map((match) => match[1] as string),
  )
}

describe('llms.txt', () => {
  let exportsOf: Record<string, string[]>

  beforeAll(() => {
    exportsOf = surface()
  }, 120_000)

  it('has a note for every entry point of the package and for nothing else', async () => {
    const { ENTRY_NOTES, exportedEntries } = await load()
    const manifest = JSON.parse(read('package.json')) as { exports: Record<string, unknown> }
    const exported = Object.keys(manifest.exports).filter((entry) => entry !== './package.json')
    expect(exportedEntries()).toEqual(exported)
    expect(Object.keys(ENTRY_NOTES).sort()).toEqual([...exported].sort())
  })

  it('names only what an entry really exports', async () => {
    const { ENTRY_NOTES } = await load()
    const manager = members('src/core/types.ts', 'WindowManager')
    const platform = new Set(['localStorage', 'BroadcastChannel'])
    expect(manager.has('requestClose')).toBe(true)
    for (const [entry, note] of Object.entries(ENTRY_NOTES)) {
      if (entry === './themes/*') continue
      const own = new Set((exportsOf[entry] ?? []).map((line) => line.split(':')[0]))
      const borrowed = entry === './persist/idb' ? new Set(['persist']) : new Set<string>()
      for (const name of names(note)) {
        const known =
          own.has(name) ||
          platform.has(name) ||
          borrowed.has(name) ||
          (entry === '.' && manager.has(name))
        expect(known, `${entry} does not export ${name}`).toBe(true)
      }
      if (!entry.endsWith('/define')) expect(names(note).length, entry).toBeGreaterThan(0)
    }
  })

  it('gives rules that call methods the library has', async () => {
    const { RULES } = await load()
    const manager = members('src/core/types.ts', 'WindowManager')
    const desktop = members('src/dom/shared.ts', 'DesktopController')
    const core = new Set((exportsOf['.'] ?? []).map((line) => line.split(':')[0]))
    const called = RULES.flatMap((rule) => quoted(rule))
    const methods = called.flatMap((token) => [...token.matchAll(/\bwm\.([A-Za-z]+)/g)])
    expect(methods.length).toBeGreaterThan(5)
    for (const [, method] of methods) expect(manager.has(method as string), method).toBe(true)
    expect(desktop.has('attachWindow')).toBe(true)
    expect(called.some((token) => token.startsWith('desktop.attachWindow('))).toBe(true)
    expect(core.has('attachDesktop')).toBe(true)
    for (const attribute of called.filter(
      (token) => token.startsWith('data-wm-') && !token.endsWith('*'),
    )) {
      expect(read('README.md'), attribute).toContain(`\`${attribute}\``)
    }
  })

  it('is the file the generator writes, quotes the quick start of the README and ships in the package', async () => {
    const out = mkdtempSync(join(tmpdir(), 'wmkit-llms-'))
    execFileSync('node', ['scripts/llms.mjs', '--out', out], { cwd: root })
    const written = readFileSync(join(out, 'llms.txt'), 'utf8')
    expect(written).toBe(read('llms.txt'))

    const quick = /## Quick start \(vanilla\)\n\n```js\n([\s\S]*?)```/.exec(read('README.md'))?.[1]
    expect(written).toContain(`\`\`\`js\n${quick}\`\`\``)
    expect(written).not.toMatch(/version \d/)
    const manifest = JSON.parse(read('package.json')) as { files: string[] }
    expect(manifest.files).toContain('llms.txt')
  })

  it('starts with code, because the docs build bundles the generator and puts its own code first', () => {
    expect(read('scripts/llms.mjs').startsWith('#!')).toBe(false)
    expect(read('docs/.vitepress/config.ts')).toContain("from '../../scripts/llms.mjs'")
  })

  it('writes the Context7 settings from the same rules, within the limits of that service', async () => {
    const { RULES } = await load()
    const out = mkdtempSync(join(tmpdir(), 'wmkit-context7-'))
    execFileSync('node', ['scripts/llms.mjs', '--out', out], { cwd: root })
    const written = readFileSync(join(out, 'context7.json'), 'utf8')
    expect(written).toBe(read('context7.json'))
    const config = JSON.parse(written) as {
      projectTitle: string
      description: string
      folders: string[]
      excludeFiles: string[]
      rules: string[]
    }
    expect(config.projectTitle.length).toBeLessThanOrEqual(100)
    expect(config.description.length).toBeLessThanOrEqual(500)
    expect(config.folders).toEqual(['docs'])
    expect(config.rules).toEqual(RULES)
    expect(config.excludeFiles).toContain('api.ru.md')
    expect(config.excludeFiles.every((name) => !name.includes('/'))).toBe(true)
  })

  it('lists every English page of the docs once, by its public address, and states the version only when asked', async () => {
    const { llmsText, docsIndex } = await load()
    const docs = docsIndex()
    const urls = docs.map((page) => page.url)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls).toContain('https://wmkit.vercel.app/docs/')
    expect(urls).toContain('https://wmkit.vercel.app/docs/api.html')
    expect(urls.some((url) => url.includes('/ru/') || url.endsWith('.md'))).toBe(false)
    for (const page of docs) expect(page.description.length, page.url).toBeGreaterThan(60)
    const text = llmsText({ version: '9.9.9' })
    for (const url of urls) expect(text).toContain(`](${url})`)
    expect(text).toContain('for the web, version 9.9.9:')
  })
})
