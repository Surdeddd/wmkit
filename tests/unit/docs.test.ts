import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('../../', import.meta.url).pathname

function markdownFiles(): string[] {
  const found = ['README.md', 'README.ru.md']
  for (const name of readdirSync(join(root, 'docs'))) {
    if (name.endsWith('.md')) found.push(join('docs', name))
  }
  return found
}

interface Line {
  number: number
  text: string
  fenced: boolean
}

/** walk a file, marking which lines a markdown renderer will treat as code */
function scan(source: string): { lines: Line[]; open: string | null } {
  const lines: Line[] = []
  let fence: string | null = null
  for (const [index, text] of source.split('\n').entries()) {
    const marker = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(text)
    const closing = marker !== null && fence !== null && marker[1]?.startsWith(fence) === true
    if (closing) {
      lines.push({ number: index + 1, text, fenced: true })
      fence = null
      continue
    }
    if (marker !== null && fence === null) {
      lines.push({ number: index + 1, text, fenced: true })
      fence = marker[1] as string
      continue
    }
    lines.push({ number: index + 1, text, fenced: fence !== null })
  }
  return { lines, open: fence }
}

describe('the markdown we ship', () => {
  it('closes every code fence it opens', () => {
    const unbalanced: string[] = []
    for (const file of markdownFiles()) {
      const { open } = scan(readFileSync(join(root, file), 'utf8'))
      if (open !== null) unbalanced.push(file)
    }
    expect(unbalanced, `${unbalanced.join(', ')} end inside a code block`).toEqual([])
  })

  it('never swallows a heading into a code block', () => {
    const swallowed: string[] = []
    for (const file of markdownFiles()) {
      const { lines } = scan(readFileSync(join(root, file), 'utf8'))
      for (const line of lines) {
        // a heading is only a heading outside a fence; one inside is almost always a lost section
        if (line.fenced && /^#{2,4} /.test(line.text)) {
          swallowed.push(`${file}:${line.number} ${line.text.trim().slice(0, 60)}`)
        }
      }
    }
    expect(swallowed, swallowed.join('\n')).toEqual([])
  })
})
