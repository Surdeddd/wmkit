import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { surface } from './support/surface'

const root = fileURLToPath(new URL('../../', import.meta.url))

const AMBIENT: Record<string, string> = {
  wm: "import('@surdeddd/wmkit').WindowManager",
  desktop: "import('@surdeddd/wmkit').DesktopController",
  binder: "import('@surdeddd/wmkit').DesktopBinder",
  win: "import('@surdeddd/wmkit').WindowState",
  state: "import('@surdeddd/wmkit').ManagerState",
  dock: "import('@surdeddd/wmkit/dock').Dock",
  el: 'HTMLElement',
  element: 'HTMLElement',
  desktopEl: 'HTMLElement',
  windowEl: 'HTMLElement',
  content: 'HTMLElement',
  taskbar: 'HTMLElement',
  root: 'HTMLElement',
  id: 'string',
}

const IMPORTS = /^(?:import\s[^\n]*|\}\s*from\s)[^\n]*'@surdeddd\/wmkit/m
const REACT = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'ReactNode']

interface Block {
  name: string
  where: string
  code: string
  script: boolean
}

function pages(): string[] {
  const guides = ['docs/guides', 'docs/compare'].flatMap((dir) =>
    readdirSync(`${root}${dir}`).map((file) => `${dir}/${file}`),
  )
  const docs = readdirSync(`${root}docs`)
    .filter((file) => file.endsWith('.md'))
    .map((file) => `docs/${file}`)
  return ['README.md', 'README.ru.md', ...docs, ...guides].filter((file) => file.endsWith('.md'))
}

function blocks(): Block[] {
  const out: Block[] = []
  for (const page of pages()) {
    const lines = readFileSync(`${root}${page}`, 'utf8').split('\n')
    let open: { lang: string; from: number; body: string[] } | null = null
    lines.forEach((line, index) => {
      const fence = /^```(\w*)\s*$/.exec(line)
      if (!fence) {
        open?.body.push(line)
        return
      }
      if (!open) {
        open = { lang: fence[1] ?? '', from: index + 1, body: [] }
        return
      }
      const { lang, from, body } = open
      open = null
      const text = body.join('\n')
      if (!['js', 'ts', 'tsx', 'jsx'].includes(lang) || !IMPORTS.test(text)) return
      const extension = lang === 'tsx' || lang === 'jsx' ? 'tsx' : 'ts'
      const jsx = /from 'solid-js/.test(text)
        ? 'solid-js'
        : /from '@builder\.io\/qwik/.test(text)
          ? '@builder.io/qwik'
          : /from 'preact/.test(text)
            ? 'preact'
            : 'react'
      out.push({
        name: `${root}.docs/${page.replace(/[^\w]+/g, '-')}-${from}.${extension}`,
        where: `${page}:${from}`,
        code: `/** @jsxImportSource ${jsx} */\n${text}\nexport {}\n`,
        script: lang === 'js' || lang === 'jsx',
      })
    })
  }
  return out
}

function check(sources: Map<string, string>): Map<string, ts.Diagnostic[]> {
  const read = ts.readConfigFile(`${root}tsconfig.json`, ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(read.config, ts.sys, root)
  const settings: ts.CompilerOptions = {
    ...options,
    noEmit: true,
    noImplicitAny: false,
    noUnusedLocals: false,
    noUnusedParameters: false,
    noImplicitReturns: false,
    strictNullChecks: false,
    noUncheckedIndexedAccess: false,
    noImplicitOverride: false,
    verbatimModuleSyntax: false,
    isolatedModules: false,
  }
  const host = ts.createCompilerHost(settings)
  const fileExists = host.fileExists.bind(host)
  const readFile = host.readFile.bind(host)
  const getSourceFile = host.getSourceFile.bind(host)
  host.fileExists = (file) => sources.has(file) || fileExists(file)
  host.readFile = (file) => sources.get(file) ?? readFile(file)
  host.getSourceFile = (file, target, ...rest) => {
    const text = sources.get(file)
    return text === undefined
      ? getSourceFile(file, target, ...rest)
      : ts.createSourceFile(file, text, target, true)
  }
  const program = ts.createProgram([...sources.keys()], settings, host)
  const found = new Map<string, ts.Diagnostic[]>()
  for (const file of sources.keys()) {
    const source = program.getSourceFile(file) as ts.SourceFile
    found.set(file, [
      ...program.getSyntacticDiagnostics(source),
      ...program.getSemanticDiagnostics(source),
    ])
  }
  return found
}

function missing(diagnostic: ts.Diagnostic): string | null {
  if (diagnostic.code !== 2304 && diagnostic.code !== 2552) return null
  const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
  return /Cannot find name '(\w+)'/.exec(text)?.[1] ?? null
}

function outside(diagnostic: ts.Diagnostic): boolean {
  if (diagnostic.code !== 2307) return false
  const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
  const name = /Cannot find module '([^']+)'/.exec(text)?.[1] ?? ''
  return name.includes('?') || !name.startsWith('@surdeddd/wmkit')
}

it('compiles every self-contained code block of the documentation against the sources', () => {
  const all = blocks()
  const exported = new Set(
    Object.values(surface()).flatMap((names) => names.map((name) => name.split(':')[0] as string)),
  )
  for (const name of REACT) exported.add(name)
  const sources = new Map(all.map((block) => [block.name, block.code]))
  const problems: string[] = []
  const first = check(sources)
  for (const block of all) {
    const names = new Set(
      (first.get(block.name) ?? []).map(missing).filter((name) => name !== null),
    )
    if (names.size === 0) continue
    for (const name of names) {
      if (exported.has(name as string))
        problems.push(`${block.where} uses ${name} without importing it`)
    }
    const declared = [...names]
      .map((name) =>
        AMBIENT[name as string]
          ? `declare const ${name}: ${AMBIENT[name as string]}`
          : `declare const ${name}: any\ntype ${name} = any`,
      )
      .join('\n')
    sources.set(block.name, `${block.code}\n${declared}\n`)
  }
  for (const [file, diagnostics] of check(sources)) {
    const block = all.find((entry) => entry.name === file) as Block
    const foreign = diagnostics.some(outside)
    for (const diagnostic of diagnostics) {
      const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')
      if (outside(diagnostic) || (foreign && diagnostic.code === 2300)) continue
      if (
        block.script &&
        /of type 'string' is not assignable|Type 'string' is not assignable/.test(text)
      ) {
        continue
      }
      const at = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line ?? 0
      problems.push(`${block.where}+${at - 1} TS${diagnostic.code} ${text.slice(0, 160)}`)
    }
  }
  expect(all.length, 'too few code blocks were found to compile').toBeGreaterThan(60)
  expect(problems).toEqual([])
}, 300_000)
