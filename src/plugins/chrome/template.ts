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
const BREAKOUT =
  /^(b|big|blockquote|body|br|center|code|dd|div|dl|dt|em|embed|font|h[1-6]|head|hr|i|img|li|listing|menu|meta|nobr|ol|p|pre|ruby|s|small|span|strong|strike|sub|sup|table|tt|u|ul|var)$/
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/
const POINT = /^(\/|(foreignobject|desc|title)$)/
const NEVER = /(?!)/
const SPACE = /[\t\n\f\r ]/
const UNSAFE =
  'wmkit: a {{placeholder}} belongs in text or in a quoted aria-*, data-*, title, alt, class, id, role, lang, dir, for, value, placeholder or label attribute'
const STRAY =
  'wmkit: a tag may only be spaced with tab, line feed, form feed, carriage return or space'

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
  const frames: string[] = []
  let doubt = false
  let strict = false
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
    const name = String(tag).replace(/[A-Z]+/g, (upper) => upper.toLowerCase())
    const top = frames.at(-1)
    const html = top === undefined || POINT.test(top)
    state = TEXT
    if (name[0] === '/') {
      const target = name.slice(1)
      let k = frames.length - 1
      if (html) k = top === name || top === target ? k : -1
      else while (k >= 0 && frames[k] !== target && frames[k]?.[0] !== '/') k -= 1
      if (k >= 0 && (html || frames[k] === target)) frames.length = k
      else if (top !== undefined) doubt = true
    } else if (
      name === 'math' ||
      name === 'select' ||
      (html ? top && name === 'a' : BREAKOUT.test(name))
    ) {
      doubt = true
    } else if (doubt && name === 'title') strict = true
    else if (!html || name === 'svg') {
      if (!html && RAW.test(name) && name !== 'title') tainted = true
      else if (!selfClosing) frames.push(name)
    } else {
      if (top && !VOID.test(name)) frames.push(`/${name}`)
      if (RAW.test(name)) {
        if (doubt || name === 'noscript') tainted = true
        state = RAWTEXT
        close = name === 'plaintext' ? NEVER : new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, 'i')
      }
    }
  }
  const skipTo = (pattern: RegExp) => {
    state = SKIP
    close = pattern
  }

  const fail = (message: string, found: string, before: string) => {
    throw new Error(`${message} (${found} after '${before.slice(-20)}')`)
  }

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      if (tainted || (state !== TEXT && !(state === QUOTED && INERT.test(attribute)))) {
        fail(UNSAFE, `{{${part}}}`, seen)
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
        if (strict && !/^<\/title[\t\n\f\r />]/i.test(part.slice(i, i + 8))) tainted = true
        strict = false
        const ahead = part.slice(i, i + 9)
        const top = frames.at(-1)
        const cdata = ahead === '<![CDATA['
        if (ahead.startsWith('<!--')) skipTo(/-->/)
        else if (cdata && !doubt && top !== undefined && !POINT.test(top)) skipTo(/]]>/)
        else if (/^<(\/?[a-z]|$)/i.test(ahead)) {
          state = TAG
          tag = null
          attribute = ''
          continue
        } else if (/^<[!?/]/.test(ahead)) {
          if (cdata && (doubt || top) && part.indexOf('>', i) !== part.indexOf(']]>', i) + 2) {
            tainted = true
          }
          skipTo(/>/)
        } else continue
        i += 1
      } else if (state === QUOTED) {
        if (char === quote) {
          state = TAG
          attribute = ''
        }
      } else if (/\s/.test(char) && !SPACE.test(char)) {
        fail(
          STRAY,
          `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
          seen.slice(0, i - part.length),
        )
      } else if (char === '>') end(state === TAG && part[i - 1] === '/')
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
