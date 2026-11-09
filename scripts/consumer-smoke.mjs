import { execFile, execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))
const work = join(root, '.cache', 'consumer-smoke')
const template = process.argv.includes('--template')

const probe = `import { createRequire } from 'node:module'
const [format, spec] = process.argv.slice(2)
const options = spec.endsWith('.json') ? { with: { type: 'json' } } : undefined
try {
  const loaded =
    format === 'esm' ? await import(spec, options) : createRequire(import.meta.url)(spec)
  const names = format === 'esm' ? Object.keys(loaded) : Object.getOwnPropertyNames(loaded)
  const self = format === 'cjs' && loaded !== null && loaded.default === loaded
  console.log(JSON.stringify({ type: typeof loaded, names, self }))
} catch (error) {
  console.log(JSON.stringify({ error: String(error).split('\\n')[0] }))
  process.exitCode = 1
}
`

const winboxTypes = {
  'winbox.cts': `import WinBox = require('@surdeddd/wmkit/winbox')

export const called: WinBox = WinBox('called')
export const constructed: WinBox = new WinBox('constructed')
export const named: WinBox.WinBox = new WinBox.WinBox('named')
export const fallback: WinBox = new WinBox.default('fallback')
export const options: WinBox.WinBoxOptions = { title: WinBox.winboxMessagesRu.close }
`,
  'winbox.mts': `import WinBox, { WinBox as Box, type WinBoxOptions, winboxMessages } from '@surdeddd/wmkit/winbox'

export const constructed: WinBox = new WinBox('constructed')
export const named: Box = new Box('named')
export const options: WinBoxOptions = { title: winboxMessages.close }
`,
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      module: 'node16',
      moduleResolution: 'node16',
      target: 'es2022',
      lib: ['es2022', 'dom'],
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      types: [],
    },
    files: ['winbox.cts', 'winbox.mts'],
  }),
}

function fail(message) {
  console.error(`consumer-smoke: ${message}`)
  console.error(`consumer-smoke: the work directory is kept at ${work}`)
  process.exit(1)
}

function pack() {
  if (!existsSync(join(root, 'dist', 'index.js'))) fail('dist/ is missing, run `pnpm build` first')
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  execFileSync('npm', ['pack', '--pack-destination', work], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const tarballs = readdirSync(work).filter((name) => name.endsWith('.tgz'))
  if (tarballs.length !== 1) fail(`npm pack wrote ${tarballs.length} tarballs`)
  console.log(`packed ${tarballs[0]}`)
  return join(work, tarballs[0])
}

function install(tarball) {
  writeFileSync(
    join(work, 'package.json'),
    `${JSON.stringify({ name: 'wmkit-consumer-smoke', private: true }, null, 2)}\n`,
  )
  const unpacked = join(work, 'unpacked')
  mkdirSync(unpacked)
  execFileSync('tar', ['-xzf', tarball, '-C', unpacked])
  const target = join(work, 'node_modules', '@surdeddd', 'wmkit')
  mkdirSync(join(target, '..'), { recursive: true })
  renameSync(join(unpacked, 'package'), target)
  return target
}

function subpaths(pkg, target) {
  const specs = []
  const patterns = []
  for (const [key, value] of Object.entries(pkg.exports)) {
    const spec = key === '.' ? pkg.name : `${pkg.name}/${key.slice(2)}`
    if (!key.includes('*')) {
      specs.push(spec)
      continue
    }
    if (typeof value !== 'string') fail(`cannot expand the export pattern ${key}`)
    const [prefix, suffix] = value.split('*')
    const files = readdirSync(join(target, prefix), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
      .map((entry) => entry.name)
    if (files.length === 0) fail(`the export pattern ${key} matches no file`)
    for (const file of files)
      patterns.push(spec.replace('*', file.slice(0, file.length - suffix.length)))
  }
  return { specs, patterns }
}

async function load(format, spec) {
  const outcome = await run(process.execPath, [join(work, 'probe.mjs'), format, spec], {
    cwd: work,
  }).catch((error) => error)
  const line = String(outcome.stdout ?? '')
    .trim()
    .split('\n')
    .at(-1)
  let result
  try {
    result = JSON.parse(line)
  } catch {
    result = undefined
  }
  if (result?.error) return result
  if (outcome instanceof Error) {
    const cause = String(outcome.stderr ?? '')
      .split('\n')
      .find((text) => /Error/.test(text))
    return { error: `the probe exited with code ${outcome.code}${cause ? `: ${cause}` : ''}` }
  }
  return result ?? { error: 'the probe printed no result' }
}

async function checkImports() {
  const target = install(pack())
  const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
  const { specs, patterns } = subpaths(pkg, target)
  writeFileSync(join(work, 'probe.mjs'), probe)
  const failures = []

  for (const spec of specs) {
    const esm = await load('esm', spec)
    const cjs = await load('cjs', spec)
    for (const [format, result] of [
      ['esm', esm],
      ['cjs', cjs],
    ]) {
      if (result.error) failures.push(`${format} ${spec}: ${result.error}`)
      else console.log(`ok   ${format} ${spec}`)
    }
    if (spec === `${pkg.name}/winbox` && !cjs.error && (cjs.type !== 'function' || !cjs.self)) {
      failures.push(`cjs ${spec}: require() must return the WinBox constructor`)
    }
    if (esm.error || cjs.error || spec.endsWith('.json')) continue
    const missing = esm.names.filter((name) => !cjs.names.includes(name))
    if (missing.length > 0) failures.push(`cjs ${spec}: missing ${missing.join(', ')}`)
  }
  if (!specs.includes(`${pkg.name}/winbox`)) failures.push('the winbox entry is not exported')

  const resolve = createRequire(join(work, 'package.json')).resolve
  for (const spec of patterns) {
    try {
      resolve(spec)
    } catch (error) {
      failures.push(`resolve ${spec}: ${String(error).split('\n')[0]}`)
    }
  }
  console.log(`ok   resolve ${patterns.length} files under the export patterns`)

  const types = join(work, 'types')
  mkdirSync(types)
  for (const [name, text] of Object.entries(winboxTypes)) writeFileSync(join(types, name), text)
  const tsc = createRequire(join(root, 'package.json')).resolve('typescript/bin/tsc')
  try {
    execFileSync(process.execPath, [tsc, '-p', types], { cwd: types, encoding: 'utf8' })
    console.log('ok   types of the winbox entry for CommonJS and ES module consumers')
  } catch (error) {
    failures.push(`types of the winbox entry:\n${error.stdout}`)
  }

  return failures
}

function checkTemplate() {
  const tarball = pack()
  const app = join(work, 'dashboard')
  cpSync(join(root, 'templates', 'dashboard'), app, {
    recursive: true,
    filter: (source) => !/[\\/](node_modules|dist)$/.test(source),
  })
  const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
  if (!manifest.dependencies?.['@surdeddd/wmkit']) fail('the template does not depend on wmkit')
  manifest.dependencies['@surdeddd/wmkit'] = `file:${tarball}`
  writeFileSync(join(app, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const options = { cwd: app, stdio: 'inherit' }
  try {
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], options)
    execFileSync('npm', ['run', 'build'], options)
  } catch {
    return ['the dashboard template does not build against the packed package']
  }
  if (!existsSync(join(app, 'dist', 'index.html')))
    return ['the template build wrote no index.html']
  console.log('ok   the dashboard template builds against the packed package')
  return []
}

const failures = template ? checkTemplate() : await checkImports()
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  fail(`${failures.length} check(s) failed`)
}
rmSync(work, { recursive: true, force: true })
console.log('consumer-smoke: all checks passed')
