const WINDOW = '[data-wm-window]'
const DESKTOP = '[data-wm-desktop]'
const DESKTOP_ONLY = '[data-wm-snap-preview]'
const CONTENT = '[data-wm-content]'

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

function compounds(selector) {
  const list = []
  let depth = 0
  let quote = ''
  let current = ''
  let combinator = ''
  for (const char of selector) {
    if (quote !== '') {
      if (char === quote) quote = ''
    } else if (char === '"' || char === "'") quote = char
    else if (char === '[' || char === '(') depth += 1
    else if (char === ']' || char === ')') depth -= 1
    else if (depth === 0 && /[\s>+~]/.test(char)) {
      if (current !== '') {
        list.push({ combinator, compound: current })
        combinator = ' '
      }
      if (char.trim() !== '') combinator = char
      current = ''
      continue
    }
    current += char
  }
  if (current !== '') list.push({ combinator, compound: current })
  return list
}

function joinCompounds(list) {
  return list
    .map(({ combinator, compound }, index) => {
      if (index === 0) return compound
      return combinator === ' ' ? ` ${compound}` : ` ${combinator} ${compound}`
    })
    .join('')
}

function pseudoElement(compound) {
  const at = compound.indexOf('::')
  return at === -1 ? [compound, ''] : [compound.slice(0, at), compound.slice(at)]
}

function rewriteCompound(compound) {
  const [qualifiers, element] = pseudoElement(compound.slice(WINDOW.length))
  return qualifiers === '' ? `:host${element}` : `:host(${qualifiers})${element}`
}

function rewriteSelector(selector) {
  if (selector.includes(DESKTOP_ONLY)) return null
  let list = compounds(selector)
  if (list[0]?.compound === DESKTOP && list[1]?.compound.startsWith(WINDOW)) {
    if (list[1].combinator === ' ' || list[1].combinator === '>') list = list.slice(1)
  }
  if (list[0]?.compound.startsWith(WINDOW)) {
    const host = rewriteCompound(list[0].compound)
    const next = list[1]
    if (next && next.combinator !== ' ' && next.combinator !== '>') return null
    list =
      next && next.combinator === ' ' && host === ':host'
        ? list.slice(1)
        : [{ combinator: '', compound: host }, ...list.slice(1)]
  }
  const content = list.findIndex(({ compound }) => compound.includes(CONTENT))
  if (content !== -1) {
    if (content !== list.length - 1) return null
    const [inner, element] = pseudoElement(list[content].compound)
    list[content] = { ...list[content], compound: `::slotted(${inner})${element}` }
  }
  const result = joinCompounds(list)
  return result.includes(WINDOW) || result.includes(DESKTOP) ? null : result
}

function isDesktopRoot(head) {
  return splitTop(head, ',').every((selector) => selector.trim() === DESKTOP)
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

function transform(css) {
  const out = []
  for (const { head, body } of blocks(css)) {
    if (head.startsWith('@keyframes')) {
      out.push(`${head} {${body}}`)
      continue
    }
    if (head.startsWith('@')) {
      const inner = transform(body)
      if (inner.trim() !== '') out.push(`${head} {\n${indent(inner)}\n}`)
      continue
    }
    if (isDesktopRoot(head)) {
      const kept = tokensOnly(body)
      if (kept !== null) out.push(`:host {\n  ${kept}\n}`)
      continue
    }
    const selectors = splitTop(head, ',')
      .map(rewriteSelector)
      .filter((selector) => selector !== null && selector !== '')
    if (selectors.length === 0) continue
    out.push(`${selectors.join(',\n')} {${body}}`)
  }
  return `${out.join('\n\n')}\n`
}

export function toShadowCss(css) {
  return transform(css.replace(/\/\*[\s\S]*?\*\//g, ''))
}
