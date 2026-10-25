// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dictionaries } from '../../site/src/i18n'

const root = `${resolve(dirname(fileURLToPath(import.meta.url)), '../..')}/`
const page = new DOMParser().parseFromString(
  readFileSync(`${root}site/index.html`, 'utf8'),
  'text/html',
)
const squash = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim()

describe('the landing page before its script runs', () => {
  it('shows the English catalogue as its static text', () => {
    const nodes = [...page.querySelectorAll<HTMLElement>('[data-i18n]')]
    expect(nodes.length).toBeGreaterThan(10)
    for (const node of nodes) {
      const key = node.dataset.i18n ?? ''
      expect(squash(node.textContent), key).toBe(dictionaries.en.ui[key])
    }
  })

  it('names every landmark through the catalogue, in both languages', () => {
    const labelled = [...page.querySelectorAll<HTMLElement>('[aria-label]')]
    expect(labelled.length).toBeGreaterThan(0)
    for (const node of labelled) {
      const key = node.dataset.i18nAria ?? ''
      expect(key, node.outerHTML.slice(0, 60)).not.toBe('')
      expect(node.getAttribute('aria-label'), key).toBe(dictionaries.en.ui[key])
      expect(dictionaries.ru.ui[key], key).toBeTruthy()
    }
  })

  it('gives both languages the same interface keys', () => {
    expect(Object.keys(dictionaries.ru.ui).sort()).toEqual(Object.keys(dictionaries.en.ui).sort())
  })
})

describe('the readme app', () => {
  it('promises no adapter size the adapters break', () => {
    const longest = Math.max(
      ...readdirSync(`${root}src/adapters`).map(
        (file) => readFileSync(`${root}src/adapters/${file}`, 'utf8').trimEnd().split('\n').length,
      ),
    )
    for (const dict of Object.values(dictionaries)) {
      const claim = /around (\d+) lines/.exec(dict.readme.body)
      if (claim) expect(longest, dict.lang).toBeLessThanOrEqual(Number(claim[1]) * 1.25)
    }
  })
})
