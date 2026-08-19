#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toShadowCss } from './shadow-css.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src', 'themes')

const outFlag = process.argv.indexOf('--out')
const out = outFlag === -1 ? source : process.argv[outFlag + 1]
mkdirSync(out, { recursive: true })

const names = readdirSync(source)
  .filter((file) => file.endsWith('.css'))
  .map((file) => file.slice(0, -4))
  .sort()

if (names.length === 0) throw new Error('wmkit: no theme stylesheets found')

const quote = (css) => css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

const read = (name) => readFileSync(join(source, `${name}.css`), 'utf8')

const css = [
  "import type { ThemeName } from './index'",
  '',
  'export const themeCss: Record<ThemeName, string> = {',
  ...names.map((name) => `  ${name}: \`${quote(read(name))}\`,`),
  '}',
  '',
  'export const themeShadowCss: Record<ThemeName, string> = {',
  ...names.map((name) => `  ${name}: \`${quote(toShadowCss(read(name)))}\`,`),
  '}',
  '',
].join('\n')

const index = [
  "import { themeCss, themeShadowCss } from './css'",
  '',
  'export const themeNames = [',
  ...names.map((name) => `  '${name}',`),
  '] as const',
  '',
  'export type ThemeName = (typeof themeNames)[number]',
  '',
  'export { themeCss, themeShadowCss }',
  '',
  'export interface ThemeStyleOptions {',
  '  shadow?: boolean',
  '}',
  '',
  'export function themeStyle(name: ThemeName, options: ThemeStyleOptions = {}): string {',
  '  return options.shadow === true ? themeShadowCss[name] : themeCss[name]',
  '}',
  '',
].join('\n')

writeFileSync(join(out, 'css.ts'), css)
writeFileSync(join(out, 'index.ts'), index)

process.stdout.write(`wmkit: wrote ${names.length} themes to ${out}\n`)
