const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '{': '&#123;',
}

const INERT = /^(aria-|data-)|^(title|alt|class|id|role|lang|dir|for|value|placeholder|label)$/i
const RAW = /^(script|style|textarea|title|xmp|iframe|noembed|noframes|noscript|plaintext)$/i
const NEVER = /(?!)/
const SPACE = /\s/
const UNSAFE =
  'wmkit: a {{placeholder}} belongs in text or in a quoted aria-*, data-*, title, alt, class, id, role, lang, dir, for, value, placeholder or label attribute'

const TEXT = 0
const TAG = 1
const VALUE = 2
const QUOTED = 3
const UNQUOTED = 4
const SKIP = 5
const RAWTEXT = 6

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"'{]/g, (char) => ESCAPES[char] as string)
}

export interface Compiled {
  render(values: Record<string, string>): string
  attributes: string[]
}

export function compile(template: string): Compiled {
  const parts = template.split(/\{\{\s*([a-z]+)\s*\}\}/i)
  const attributes: string[] = []
  let state = TEXT
  let word = ''
  let tag: string | null = null
  let attribute = ''
  let quote = ''
  let close = NEVER
  let foreign = 0
  let tainted = false
  let seen = ''

  const finish = () => {
    if (word === '') return
    if (tag === null) tag = word
    else {
      attribute = word.toLowerCase()
      attributes.push(attribute)
    }
    word = ''
  }
  const end = (selfClosing: boolean) => {
    finish()
    const name = String(tag).toLowerCase()
    state = TEXT
    if (name === 'svg' || name === 'math') foreign += selfClosing ? 0 : 1
    else if (name === '/svg' || name === '/math') foreign = Math.max(0, foreign - 1)
    else if (RAW.test(name)) {
      if (name === 'noscript' || (foreign > 0 && (name === 'style' || name === 'script'))) {
        tainted = true
      }
      if (foreign === 0) {
        state = RAWTEXT
        close = name === 'plaintext' ? NEVER : new RegExp(`</${name}(?=[\\s/>])`, 'i')
      }
    }
  }
  const skipTo = (pattern: RegExp) => {
    state = SKIP
    close = pattern
  }

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      if (tainted || (state !== TEXT && !(state === QUOTED && INERT.test(attribute)))) {
        throw new Error(`${UNSAFE} ({{${part}}} after '${seen.slice(-20)}')`)
      }
      seen += `{{${part}}}`
      return
    }
    seen += part
    for (let i = 0; i < part.length; i += 1) {
      const char = part[i] as string
      if (state === SKIP || state === RAWTEXT) {
        const found = close.exec(part.slice(i))
        if (found === null) break
        i += found.index + (state === SKIP ? found[0].length : 0) - 1
        state = TEXT
      } else if (state === TEXT) {
        if (char !== '<') continue
        const ahead = part.slice(i, i + 9)
        if (ahead.startsWith('<!--')) skipTo(/-->/)
        else if (foreign > 0 && ahead === '<![CDATA[') skipTo(/]]>/)
        else if (/^<(\/?[a-z]|$)/i.test(ahead)) {
          state = TAG
          tag = null
          attribute = ''
          continue
        } else if (/^<[!?/]/.test(ahead)) skipTo(/>/)
        else continue
        i += 1
      } else if (state === QUOTED) {
        if (char === quote) {
          state = TAG
          attribute = ''
        }
      } else if (char === '>') end(part[i - 1] === '/')
      else if (state === VALUE) {
        if (char === '"' || char === "'") {
          state = QUOTED
          quote = char
        } else if (!SPACE.test(char)) state = UNQUOTED
      } else if (state === UNQUOTED) {
        if (SPACE.test(char)) {
          state = TAG
          attribute = ''
        }
      } else if (char === '=' && tag !== null && (word !== '' || attribute !== '')) {
        finish()
        state = VALUE
      } else if (SPACE.test(char) || (char === '/' && (word !== '' || tag !== null))) finish()
      else word += char
    }
  })

  return {
    attributes,
    render: (values) =>
      parts
        .map((part, index) =>
          index % 2 === 0 ? part : escapeHtml((Object.hasOwn(values, part) && values[part]) || ''),
        )
        .join(''),
  }
}

export function compileTemplate(template: string): (values: Record<string, string>) => string {
  return compile(template).render
}
