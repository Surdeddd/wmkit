import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { themeCss, themeNames, themeStyle } from '../../src/themes/index'

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

  it('gives every theme feedback while a window is being handled', () => {
    for (const name of themeNames) {
      const css = themeCss[name]
      for (const state of ['dragging', 'resizing', 'pinching', 'focused', 'flash']) {
        expect(css, `${name} says nothing about ${state}`).toContain(`data-wm-${state}`)
      }
    }
  })
})
