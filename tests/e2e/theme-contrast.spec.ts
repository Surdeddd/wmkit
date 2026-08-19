import { expect, test } from '@playwright/test'

const THEMES = [
  'glass',
  'light',
  'retro',
  'terminal',
  'paper',
  'neon',
  'aqua',
  'frost',
  'candy',
  'carbon',
  'brutalist',
  'blueprint',
  'amber',
  'noir',
  'forest',
  'synth',
] as const

const AA = 4.5

interface Finding {
  ratio: number
  node: string
  text: string
  color: string
  on: string
}

function probe(): Finding[] {
  interface Rgb {
    r: number
    g: number
    b: number
    a: number
  }
  const parse = (value: string): Rgb | null => {
    const match = /rgba?\(([^)]+)\)/.exec(value)
    if (!match) return null
    const [r = 0, g = 0, b = 0, a = 1] = (match[1] as string).split(',').map(Number.parseFloat)
    return { r, g, b, a }
  }
  const over = (fg: Rgb, bg: Rgb): Rgb => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })
  const lum = ({ r, g, b }: Rgb): number => {
    const channel = (value: number) => {
      const s = value / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const ratio = (a: Rgb, b: Rgb): number => {
    const [high, low] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]
    return (high + 0.05) / (low + 0.05)
  }

  // every surface the text may sit on: a gradient is judged by its worst stop
  const surfaces = (node: Element): Rgb[] => {
    let base: Rgb = { r: 255, g: 255, b: 255, a: 1 }
    let stops: Rgb[] | null = null
    const chain: Element[] = []
    for (let el: Element | null = node; el; el = el.parentElement) chain.unshift(el)
    for (const el of chain) {
      const style = getComputedStyle(el)
      const background = parse(style.backgroundColor)
      if (background && background.a > 0) {
        base = over(background, stops?.[0] ?? base)
        stops = null
      }
      if (style.backgroundImage !== 'none') {
        const found = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)]
          .map((match) => parse(match[0]))
          .filter((value): value is Rgb => value !== null)
        if (found.length > 0) stops = found.map((stop) => over(stop, base))
      }
    }
    return stops ?? [base]
  }

  const findings: Finding[] = []
  for (const win of document.querySelectorAll('[data-wm-window]')) {
    for (const node of win.querySelectorAll('[data-wm-content] *, [data-wm-drag] *')) {
      const text = (node.textContent ?? '').trim()
      if (text === '' || node.children.length > 0) continue
      const box = node.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) continue
      const style = getComputedStyle(node)
      if (style.visibility === 'hidden' || style.opacity === '0') continue
      const color = parse(style.color)
      if (!color) continue
      let worst = Number.POSITIVE_INFINITY
      let on: Rgb | null = null
      for (const surface of surfaces(node)) {
        const value = ratio(over(color, surface), surface)
        if (value < worst) {
          worst = value
          on = surface
        }
      }
      if (on === null) continue
      findings.push({
        ratio: Math.round(worst * 100) / 100,
        node: node.tagName.toLowerCase(),
        text: text.slice(0, 20),
        color: style.color,
        on: `${Math.round(on.r)},${Math.round(on.g)},${Math.round(on.b)}`,
      })
    }
  }
  return findings.sort((a, b) => a.ratio - b.ratio).slice(0, 5)
}

test('every shipped theme keeps the demo readable', async ({ page }) => {
  await page.goto('?lang=en')
  await page.click('#launcher button[data-app="terminal"]')
  await page.click('#launcher button[data-app="skins"]')
  await expect(page.locator('[data-testid="window-skins"]')).toBeVisible()

  const failures: string[] = []
  for (const theme of THEMES) {
    await page.locator(`.skin-${theme}`).click()
    await expect(page.locator('#desktop')).toHaveAttribute('data-theme', theme)
    await page.waitForTimeout(120)

    for (const finding of await page.evaluate(probe)) {
      if (finding.ratio >= AA) continue
      failures.push(
        `${theme}: ${finding.ratio}:1 — <${finding.node}> "${finding.text}" ` +
          `in ${finding.color} on rgb(${finding.on})`,
      )
    }
  }

  expect(failures, failures.join('\n')).toEqual([])
})
