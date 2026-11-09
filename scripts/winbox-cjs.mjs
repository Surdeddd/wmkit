import { readFileSync, writeFileSync } from 'node:fs'

const jsFile = 'dist/winbox.cjs'
const typesFile = 'dist/winbox.d.cts'

function fail(message) {
  console.error(`winbox-cjs: ${message}`)
  process.exit(1)
}

function patchCode() {
  const code = readFileSync(jsFile, 'utf8')
  const mapComment = code.indexOf('\n//# sourceMappingURL=')
  if (mapComment === -1) fail(`${jsFile} has no source map comment`)
  if (!/\nexports\.default = \w+;\n/.test(code)) fail(`${jsFile} has no exports.default`)
  if (code.includes('module.exports')) fail(`${jsFile} already assigns module.exports`)
  const interop =
    '\nmodule.exports = Object.defineProperties(exports.default, Object.getOwnPropertyDescriptors(exports));'
  writeFileSync(jsFile, code.slice(0, mapComment) + interop + code.slice(mapComment))
}

function parseSpecifier(text) {
  const match = /^(type )?(\w+)(?: as (\w+))?$/.exec(text.trim())
  if (!match) fail(`cannot read export specifier "${text}" in ${typesFile}`)
  const [, typeOnly, local, exported] = match
  return { typeOnly: Boolean(typeOnly), local, exported: exported ?? local }
}

function patchTypes() {
  const types = readFileSync(typesFile, 'utf8')
  const exportStatement = /\nexport \{ ([^}]+) \};\n*$/.exec(types)
  if (!exportStatement) fail(`${typesFile} does not end with a single export statement`)
  const specifiers = exportStatement[1].split(',').map(parseSpecifier)
  const fallback = specifiers.find((specifier) => specifier.exported === 'default')
  if (!fallback || fallback.typeOnly) fail(`${typesFile} has no default value export`)
  const name = fallback.local
  const declaration = new RegExp(`\\ndeclare const ${name}: (\\w+);\\n`).exec(types)
  if (!declaration) fail(`${typesFile} does not declare "${name}" as a const of a named type`)
  const exportsType = `${name}Exports`
  if (new RegExp(`\\b${exportsType}\\b`).test(types))
    fail(`${typesFile} already uses ${exportsType}`)

  const values = specifiers.filter((specifier) => !specifier.typeOnly && specifier !== fallback)
  const classes = values.filter((specifier) =>
    types.includes(`\ndeclare class ${specifier.local} `),
  )
  const typeNames = specifiers.filter((specifier) => specifier.typeOnly).concat(classes)
  for (const { local } of typeNames) {
    if (new RegExp(`\\b(?:type|interface|class) ${local}<`).test(types)) fail(`${local} is generic`)
    if (new RegExp(`\\b_${local}\\b`).test(types)) fail(`${typesFile} already uses _${local}`)
  }
  const members = [
    `    default: ${exportsType};`,
    ...values.map((specifier) => `    ${specifier.exported}: typeof ${specifier.local};`),
  ]
  const ordered = [...typeNames].sort((a, b) => a.exported.localeCompare(b.exported))

  const head = types
    .slice(0, exportStatement.index)
    .replace(declaration[0], () =>
      [
        '',
        `interface ${exportsType} extends ${declaration[1]} {`,
        ...members,
        '}',
        `declare const ${name}: ${exportsType};`,
        '',
      ].join('\n'),
    )
  const tail = [
    '',
    ...ordered.map((specifier) => `type _${specifier.local} = ${specifier.local};`),
    `declare namespace ${name} {`,
    ...ordered.map((specifier) => `    export type ${specifier.exported} = _${specifier.local};`),
    '}',
    `export = ${name};`,
    '',
  ].join('\n')
  writeFileSync(typesFile, head + tail)
}

patchCode()
patchTypes()
