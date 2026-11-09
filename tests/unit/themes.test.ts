import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as themes from '../../src/themes/index'
import { themeCss, themeNames, themeShadowCss, themeStyle } from '../../src/themes/index'

const root = new URL('../../', import.meta.url).pathname
const read = (file: string) => readFileSync(join(root, file), 'utf8')
const generator = new URL('../../scripts/shadow-css.mjs', import.meta.url).href
const { toShadowCss } = (await import(generator)) as { toShadowCss: (css: string) => string }

type Flavour = 'document' | 'shadow'

const FLAVOURS: Record<Flavour, Record<string, string>> = {
  document: themeCss,
  shadow: themeShadowCss,
}

interface WindowRule {
  attributes: string[]
  body: string
  order: number
}

function topLevelRules(css: string): Array<{ head: string; body: string }> {
  const rules: Array<{ head: string; body: string }> = []
  let depth = 0
  let start = 0
  let head = ''
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === '{') {
      if (depth === 0) {
        head = css.slice(start, i).trim()
        start = i + 1
      }
      depth += 1
    } else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) {
        if (!head.startsWith('@')) rules.push({ head, body: css.slice(start, i) })
        start = i + 1
      }
    }
  }
  return rules
}

function windowRules(css: string, flavour: Flavour): WindowRule[] {
  const own =
    flavour === 'document'
      ? /^\[data-wm-window\]((?:\[[^\]]*\])*)$/
      : /^:host(?:\(((?:\[[^\]]*\])*)\))?$/
  const found: WindowRule[] = []
  topLevelRules(css).forEach(({ head, body }, order) => {
    for (const selector of head.split(',').map((part) => part.trim())) {
      const match = own.exec(selector)
      if (match) found.push({ attributes: match[1]?.match(/\[[^\]]*\]/g) ?? [], body, order })
    }
  })
  return found
}

function declared(body: string, property: string): string | undefined {
  const pattern = new RegExp(`(?<![\\w-])${property}\\s*:\\s*([^;]*);`, 'g')
  const values = [...body.matchAll(pattern)].map((match) => (match[1] as string).trim())
  return values.at(-1)
}

function effective(
  css: string,
  flavour: Flavour,
  attributes: string[],
  property: string,
): string | undefined {
  const winner = windowRules(css, flavour)
    .filter((rule) => rule.attributes.every((attribute) => attributes.includes(attribute)))
    .filter((rule) => declared(rule.body, property) !== undefined)
    .sort((a, b) => a.attributes.length - b.attributes.length || a.order - b.order)
    .at(-1)
  return winner && declared(winner.body, property)
}

function token(css: string, value: string): string {
  const first = topLevelRules(css)[0]?.body ?? ''
  return value.replace(/var\((--wm-[a-z-]+)\)/g, (whole, name: string) => {
    const defined = new RegExp(`(?:^|\\s)${name}:\\s*([^;]+);`).exec(first)?.[1]
    return defined === undefined ? whole : defined.trim()
  })
}

function alpha(colour: string): number | null {
  if (/^#[0-9a-f]{6}$|^#[0-9a-f]{3}$/i.test(colour)) return 1
  const match = /^rgba?\(([^)]+)\)$/.exec(colour)
  if (!match) return null
  const parts = (match[1] as string).split(/[\s,/]+/).filter(Boolean)
  return parts.length === 4 ? Number.parseFloat(parts[3] as string) : 1
}

const GEOMETRY = /(^|[\s,])(transform|width|height)\s/
const GESTURES = ['[data-wm-dragging]', '[data-wm-resizing]', '[data-wm-live]']
const ALONGSIDE = [
  [],
  ['[data-wm-focused]'],
  ['[data-wm-stage="maximized"]'],
  ['[data-wm-stage="snapped"]'],
]

describe('the shipped themes', () => {
  it('exports every stylesheet in the folder and nothing else', () => {
    const onDisk = readdirSync(join(root, 'src/themes'))
      .filter((file) => file.endsWith('.css'))
      .map((file) => file.slice(0, -4))
      .sort()

    expect([...themeNames]).toEqual(onDisk)
    for (const name of themeNames) {
      expect(themeStyle(name), name).toBe(read(`src/themes/${name}.css`))
    }
  })

  it('comes out of the generator byte for byte', () => {
    const out = mkdtempSync(join(tmpdir(), 'wmkit-themes-'))
    execFileSync('node', ['scripts/themes.mjs', '--out', out], { cwd: root })

    expect(readFileSync(join(out, 'css.ts'), 'utf8')).toBe(read('src/themes/css.ts'))
    expect(readFileSync(join(out, 'index.ts'), 'utf8')).toBe(read('src/themes/index.ts'))
  })

  it('never leans on a token it does not define without a fallback', () => {
    for (const name of themeNames) {
      const css = themeCss[name]
      const defined = new Set([...css.matchAll(/^\s+(--wm-[a-z-]+):/gm)].map((m) => m[1]))
      const bare = [...css.matchAll(/var\((--wm-[a-z-]+)\)/g)].map((m) => m[1] as string)

      expect(
        bare.filter((token) => !defined.has(token)),
        `${name} leaks a token`,
      ).toEqual([])
    }
  })

  it('offers a shadow flavour of every theme', () => {
    expect(Object.keys(themeShadowCss).sort()).toEqual([...themeNames].sort())
    for (const name of themeNames) {
      expect(themeStyle(name, { shadow: true }), name).toBe(themeShadowCss[name])
      expect(themeStyle(name, { shadow: false }), name).toBe(themeCss[name])
      expect(themeStyle(name), name).toBe(themeCss[name])
    }
  })

  it('leaves nothing in a shadow flavour that a shadow root cannot match', () => {
    for (const name of themeNames) {
      const css = themeShadowCss[name]
      for (const outside of ['[data-wm-window]', '[data-wm-desktop]', '[data-wm-snap-preview]']) {
        expect(css, `${name} still reaches for ${outside}`).not.toContain(outside)
      }
      expect(css, `${name} never speaks about its host`).toContain(':host')
    }
  })

  it('keeps the window rules of a shadow flavour, only re-anchored', () => {
    const light = themeCss.carbon
    const shadow = themeShadowCss.carbon

    expect(shadow).toContain(':host([data-wm-focused])')
    expect(shadow).toContain(':host([data-wm-stage="maximized"]) [data-wm-drag]')
    expect(shadow).toMatch(/^\[data-wm-drag\] \{/m)
    expect(shadow).toContain('--wm-titlebar-bg')
    expect(light).toContain('[data-wm-window][data-wm-focused]')
    expect(light).not.toContain(':host')
  })

  it('carries the tokens of the desktop block and drops its layout', () => {
    const shadow = themeShadowCss.light
    const host = shadow.slice(0, shadow.indexOf('}'))

    expect(host).toContain('--wm-radius')
    expect(host).not.toContain('overflow: hidden')
    expect(host).not.toContain('position: relative')
  })

  it('styles the projected content through ::slotted, the only way a shadow rule reaches it', () => {
    for (const name of themeNames) {
      const css = themeShadowCss[name]
      expect(css, name).toMatch(/^::slotted\(\[data-wm-content\]\) \{[^}]*overflow: auto/m)
      expect(css.replaceAll('::slotted([data-wm-content])', ''), name).not.toContain(
        '[data-wm-content]',
      )
    }
  })

  it('gives every theme feedback while a window is being handled', () => {
    for (const name of themeNames) {
      const css = themeCss[name]
      for (const state of ['dragging', 'resizing', 'pinching', 'focused', 'flash']) {
        expect(css, `${name} says nothing about ${state}`).toContain(`data-wm-${state}`)
      }
    }
  })
})

describe('geometry that has to follow the pointer', () => {
  it('reads the transition every theme gives a resting window', () => {
    const animated = themeNames.filter((name) =>
      GEOMETRY.test(effective(themeCss[name], 'document', [], 'transition') ?? ''),
    )
    expect(animated).toEqual(themeNames.filter((name) => name !== 'retro'))
  })

  it('stops animating geometry while a window is dragged, resized or kept live', () => {
    const lagging: string[] = []
    for (const name of themeNames) {
      for (const [flavour, sheets] of Object.entries(FLAVOURS) as [Flavour, typeof themeCss][]) {
        const css = sheets[name] as string
        if (!GEOMETRY.test(effective(css, flavour, [], 'transition') ?? '')) continue
        for (const gesture of GESTURES) {
          for (const extra of ALONGSIDE) {
            const value = effective(css, flavour, [gesture, ...extra], 'transition') ?? ''
            if (GEOMETRY.test(value)) lagging.push(`${name} ${flavour} ${gesture}${extra.join('')}`)
          }
        }
      }
    }
    expect(lagging, lagging.join('\n')).toEqual([])
  })

  it('keeps the transition of a window that carries none of those states', () => {
    for (const name of themeNames.filter((name) => name !== 'retro')) {
      for (const [flavour, sheets] of Object.entries(FLAVOURS) as [Flavour, typeof themeCss][]) {
        const css = sheets[name] as string
        for (const extra of ALONGSIDE) {
          const value = effective(css, flavour, extra, 'transition') ?? ''
          expect(value, `${name} ${flavour} ${extra.join('')}`).toMatch(GEOMETRY)
        }
      }
    }
  })
})

describe('windows deep in the stack', () => {
  const blurred = (name: (typeof themeNames)[number]) =>
    (effective(themeCss[name], 'document', [], 'backdrop-filter') ?? 'none') !== 'none'

  it('finds the themes that blur what lies under a window', () => {
    expect(themeNames.filter(blurred).sort()).toEqual(
      ['aqua', 'frost', 'glass', 'light', 'neon', 'synth'].sort(),
    )
  })

  it('stop blurring and turn opaque, in both flavours', () => {
    const costly: string[] = []
    for (const name of themeNames.filter(blurred)) {
      for (const [flavour, sheets] of Object.entries(FLAVOURS) as [Flavour, typeof themeCss][]) {
        const css = sheets[name] as string
        for (const extra of ALONGSIDE) {
          const attributes = ['[data-wm-deep]', ...extra]
          const where = `${name} ${flavour} ${attributes.join('')}`
          for (const property of ['backdrop-filter', '-webkit-backdrop-filter']) {
            const value = effective(css, flavour, attributes, property)
            if (value !== 'none') costly.push(`${where} keeps ${property}: ${value}`)
          }
          const background = token(css, effective(css, flavour, attributes, 'background') ?? '')
          if (alpha(background) !== 1) costly.push(`${where} sits on ${background}`)
        }
      }
    }
    expect(costly, costly.join('\n')).toEqual([])
  })

  it('leave every other window exactly as it was', () => {
    for (const name of themeNames.filter(blurred)) {
      for (const [flavour, sheets] of Object.entries(FLAVOURS) as [Flavour, typeof themeCss][]) {
        const css = sheets[name] as string
        for (const extra of ALONGSIDE) {
          const where = `${name} ${flavour} ${extra.join('')}`
          expect(effective(css, flavour, extra, 'backdrop-filter'), where).not.toBe('none')
          expect(effective(css, flavour, extra, 'background'), where).toMatch(/^var\(--wm-bg/)
          expect(effective(css, flavour, extra, 'background'), where).not.toContain('solid')
        }
      }
    }
  })
})

describe('one theme at a time', () => {
  const exported = themes as unknown as Record<string, unknown>

  it('exports every theme on its own, in both flavours', () => {
    for (const name of themeNames) {
      expect(exported[`${name}Theme`], name).toBe(themeCss[name])
      expect(exported[`${name}ShadowTheme`], name).toBe(themeShadowCss[name])
    }
  })

  it('types them as strings, so the declarations do not repeat every stylesheet', () => {
    const source = read('src/themes/css.ts')
    const declared = [...source.matchAll(/^export const (\w+)(: string)? = `/gm)]
    expect(declared).toHaveLength(themeNames.length * 2)
    for (const [, name, typed] of declared) expect(typed, name).toBe(': string')
  })

  it('names them so no theme can shadow another export', () => {
    const generated = themeNames.flatMap((name) => [`${name}Theme`, `${name}ShadowTheme`])
    const others = Object.keys(exported).filter((key) => !generated.includes(key))
    expect(new Set(generated).size).toBe(generated.length)
    expect(others.sort()).toEqual(['themeCss', 'themeNames', 'themeShadowCss', 'themeStyle'])
    for (const name of themeNames) expect(name).toMatch(/^[a-z][a-z0-9]*$/)
  })

  it('bundles a single theme into an app that imports one', async () => {
    const { build } = await import('vite')
    const entry = '\0one-theme'
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      root,
      plugins: [
        {
          name: 'one-theme',
          resolveId: (id) => (id.endsWith('one-theme') ? entry : null),
          load: (id) =>
            id === entry
              ? `import { retroShadowTheme } from ${JSON.stringify(join(root, 'src/themes/index.ts'))}\nexport default retroShadowTheme\n`
              : null,
        },
      ],
      build: {
        write: false,
        minify: false,
        lib: { entry: 'one-theme', formats: ['es'], fileName: 'one' },
      },
    })
    const outputs = (Array.isArray(result) ? result : [result]) as Array<{
      output: Array<{ type: string; code?: string }>
    }>
    const code = outputs
      .flatMap((bundle) => bundle.output)
      .map((chunk) => chunk.code ?? '')
      .join('')
    expect(code).toContain('--wm-face-dark')
    expect(code.length).toBeLessThan(themeShadowCss.retro.length * 1.25)
  })
})

describe('the shadow generator', () => {
  it('keeps the desktop tokens on the host so a shadow skin wears its own theme', () => {
    const css =
      '[data-wm-desktop] {\n  --wm-accent: #7c6cff;\n  --wm-ink: var(--wm-accent);\n  overflow: hidden;\n}\n\n' +
      '[data-wm-window] {\n  color: var(--wm-ink);\n}\n\n' +
      '[data-wm-window] [data-wm-drag] {\n  color: var(--wm-accent);\n}\n'
    expect(toShadowCss(css)).toBe(
      ':host {\n  --wm-accent: #7c6cff;\n  --wm-ink: var(--wm-accent);\n}\n\n' +
        ':host {\n  color: var(--wm-ink);\n}\n\n' +
        '[data-wm-drag] {\n  color: var(--wm-accent);\n}\n',
    )
    expect(toShadowCss('[data-wm-desktop] { overflow: hidden }')).toBe('\n')
  })

  it('re-anchors every combinator and pseudo-class onto the host', () => {
    const cases: [string, string][] = [
      ['[data-wm-window] > [data-wm-drag] { a: b }', ':host > [data-wm-drag] { a: b }'],
      ['[data-wm-window]>[data-wm-drag]{a:b}', ':host > [data-wm-drag] {a:b}'],
      [
        '[data-wm-window][data-wm-focused]>[data-wm-drag] { a: b }',
        ':host([data-wm-focused]) > [data-wm-drag] { a: b }',
      ],
      ['[data-wm-window]:hover [data-wm-drag] { a: b }', ':host(:hover) [data-wm-drag] { a: b }'],
      [
        '[data-wm-window][data-wm-focused]:hover::after { a: b }',
        ':host([data-wm-focused]:hover)::after { a: b }',
      ],
      [
        '[data-wm-window][data-wm-stage="a b"] [data-wm-drag] { a: b }',
        ':host([data-wm-stage="a b"]) [data-wm-drag] { a: b }',
      ],
      ['[data-wm-desktop] [data-wm-window] { a: b }', ':host { a: b }'],
      ['[data-wm-desktop] > [data-wm-window] [data-wm-title] { a: b }', '[data-wm-title] { a: b }'],
      ['/* { note } */\n[data-wm-window] [data-wm-title] { a: b }', '[data-wm-title] { a: b }'],
      ['[data-wm-window] [data-wm-content] { a: b }', '::slotted([data-wm-content]) { a: b }'],
      [
        '[data-wm-window][data-wm-focused] > [data-wm-content]:hover { a: b }',
        ':host([data-wm-focused]) > ::slotted([data-wm-content]:hover) { a: b }',
      ],
    ]
    for (const [light, shadow] of cases) expect(toShadowCss(light), light).toBe(`${shadow}\n`)
  })

  it('drops what no rule inside a shadow root could ever match', () => {
    for (const light of [
      '[data-wm-window] + [data-wm-window] { a: b }',
      '[data-wm-window] ~ [data-wm-drag] { a: b }',
      '.page [data-wm-window] [data-wm-drag] { a: b }',
      '[data-wm-desktop][data-theme="x"] [data-wm-window] { a: b }',
      '[data-wm-desktop] .toolbar { a: b }',
      '[data-wm-window] [data-wm-window] { a: b }',
      '[data-wm-window] [data-wm-content] p { a: b }',
      '[data-wm-desktop] [data-wm-snap-preview] { a: b }',
    ]) {
      expect(toShadowCss(light), light).toBe('\n')
    }
    expect(toShadowCss('.page [data-wm-window], [data-wm-window] [data-wm-drag] { a: b }')).toBe(
      '[data-wm-drag] { a: b }\n',
    )
  })
})
