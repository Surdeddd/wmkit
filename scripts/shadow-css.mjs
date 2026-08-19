const WINDOW = '[data-wm-window]'
const DESKTOP = '[data-wm-desktop]'
const DESKTOP_ONLY = '[data-wm-snap-preview]'

function splitTop(source, separator) {
  const parts = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quote !== '') {
      if (char === quote && source[i - 1] !== '\\') quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    else if (char === separator && depth === 0) {
      parts.push(source.slice(start, i))
      start = i + 1
    }
  }
  parts.push(source.slice(start))
  return parts
}

function qualifiersOf(compound) {
  // everything the window selector carries beyond [data-wm-window]
  return compound.slice(WINDOW.length)
}

function rewriteCompound(compound) {
  const qualifiers = qualifiersOf(compound)
  if (qualifiers === '') return ':host'
  const pseudo = qualifiers.indexOf(':')
  if (pseudo === -1) return `:host(${qualifiers})`
  const attributes = qualifiers.slice(0, pseudo)
  const rest = qualifiers.slice(pseudo)
  return attributes === '' ? `:host${rest}` : `:host(${attributes})${rest}`
}

function rewriteSelector(selector) {
  const trimmed = selector.trim()
  if (trimmed.includes(DESKTOP_ONLY)) return null
  if (trimmed.startsWith(DESKTOP)) return trimmed.replace(DESKTOP, ':host')
  if (!trimmed.startsWith(WINDOW)) return trimmed

  const space = trimmed.indexOf(' ')
  if (space === -1) return rewriteCompound(trimmed)

  const head = rewriteCompound(trimmed.slice(0, space))
  const tail = trimmed.slice(space + 1).trim()
  return head === ':host' ? tail : `${head} ${tail}`
}

function tokensOnly(body) {
  const kept = splitTop(body, ';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration.startsWith('--'))
  return kept.length === 0 ? null : `${kept.join(';\n  ')};`
}

function blocks(source) {
  const found = []
  let depth = 0
  let start = 0
  let head = ''
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (char === '{') {
      if (depth === 0) {
        head = source.slice(start, i)
        start = i + 1
      }
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        found.push({ head: head.trim(), body: source.slice(start, i) })
        start = i + 1
      }
    }
  }
  return found
}

function indent(body) {
  return body
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `  ${line}`))
    .join('\n')
}

export function toShadowCss(css) {
  const out = []
  for (const { head, body } of blocks(css)) {
    if (head.startsWith('@keyframes')) {
      out.push(`${head} {${body}}`)
      continue
    }
    if (head.startsWith('@')) {
      const inner = toShadowCss(body)
      if (inner.trim() !== '') out.push(`${head} {\n${indent(inner)}\n}`)
      continue
    }
    const selectors = splitTop(head, ',')
      .map(rewriteSelector)
      .filter((selector) => selector !== null && selector !== '')
    if (selectors.length === 0) continue

    if (head.trim().startsWith(DESKTOP)) {
      const kept = tokensOnly(body)
      if (kept === null) continue
      out.push(`${selectors.join(',\n')} {\n  ${kept}\n}`)
      continue
    }
    out.push(`${selectors.join(',\n')} {${body}}`)
  }
  return `${out.join('\n\n')}\n`
}
