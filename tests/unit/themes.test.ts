import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { themeCss, themeNames, themeShadowCss, themeStyle } from '../../src/themes/index'

const root = new URL('../../', import.meta.url).pathname
const read = (file: string) => readFileSync(join(root, file), 'utf8')
const generator = new URL('../../scripts/shadow-css.mjs', import.meta.url).href
const { toShadowCss } = (await import(generator)) as { toShadowCss: (css: string) => string }

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
