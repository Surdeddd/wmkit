import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { themeCss, themeNames, themeShadowCss, themeStyle } from '../../src/themes/index'

const root = new URL('../../', import.meta.url).pathname
const read = (file: string) => readFileSync(join(root, file), 'utf8')

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

  it('gives every theme feedback while a window is being handled', () => {
    for (const name of themeNames) {
      const css = themeCss[name]
      for (const state of ['dragging', 'resizing', 'pinching', 'focused', 'flash']) {
        expect(css, `${name} says nothing about ${state}`).toContain(`data-wm-${state}`)
      }
    }
  })
})
