import { expect, type Page, test } from './fixtures'

const readme = '[data-testid="window-readme"]'
const CONTROLS = ['[data-wm-close]', '[data-wm-minimize]', '[data-wm-maximize]'] as const

async function targets(page: Page) {
  return page.evaluate((selectors) => {
    const host = document.querySelector('[data-testid="window-readme"]') as HTMLElement
    return selectors.map((selector) => {
      const button = host.querySelector(selector) as HTMLElement
      const boxes = [button.getBoundingClientRect()]
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(button, pseudo)
        if (style.content === 'none' || style.position !== 'absolute') continue
        const insetBlock = Number.parseFloat(style.top)
        const insetInline = Number.parseFloat(style.left)
        const rect = button.getBoundingClientRect()
        boxes.push(
          new DOMRect(
            rect.x + insetInline,
            rect.y + insetBlock,
            rect.width - 2 * insetInline,
            rect.height - 2 * insetBlock,
          ),
        )
      }
      const widest = boxes.reduce((best, box) =>
        box.width * box.height > best.width * best.height ? box : best,
      )
      return { selector, x: widest.x, y: widest.y, width: widest.width, height: widest.height }
    })
  }, CONTROLS)
}

test.describe('theme pointer targets', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for css rules')

  for (const theme of [
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
  ] as const) {
    test(`${theme} gives window controls a reachable pointer target`, async ({ page }) => {
      await page.addInitScript((name) => {
        localStorage.setItem('wmkit-theme', name)
      }, theme)
      await page.goto('?lang=en')
      await expect(page.locator(readme)).toBeVisible()
      await expect(page.locator('#desktop')).toHaveAttribute('data-theme', theme)
      await page.waitForFunction(() => document.styleSheets.length > 0)
      await page.waitForTimeout(200)

      const boxes = await targets(page)
      for (const box of boxes) {
        expect(Math.round(box.width), `${theme} ${box.selector} width`).toBeGreaterThanOrEqual(24)
        expect(Math.round(box.height), `${theme} ${box.selector} height`).toBeGreaterThanOrEqual(24)
      }

      const ordered = [...boxes].sort((a, b) => a.x - b.x)
      for (let i = 1; i < ordered.length; i += 1) {
        const previous = ordered[i - 1] as (typeof ordered)[number]
        const current = ordered[i] as (typeof ordered)[number]
        const gap = current.x - (previous.x + previous.width)
        expect(gap, `${theme} targets overlap`).toBeGreaterThanOrEqual(-0.5)
      }
    })
  }
})

test.describe('forced colors', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for css rules')

  test('window controls stay distinguishable in high contrast', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('?lang=en')
    await expect(page.locator(readme)).toBeVisible()
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)

    const controls = await page.evaluate((selectors) => {
      const host = document.querySelector('[data-testid="window-readme"]') as HTMLElement
      return selectors.map((selector) => {
        const button = host.querySelector(selector) as HTMLElement
        const rect = button.getBoundingClientRect()
        return {
          glyph: getComputedStyle(button, '::before').content,
          width: rect.width,
          height: rect.height,
        }
      })
    }, CONTROLS)

    expect(new Set(controls.map((control) => control.glyph)).size).toBe(3)
    for (const control of controls) {
      expect(control.glyph).toMatch(/^"\S+"$/)
      expect(control.width).toBeGreaterThanOrEqual(16)
      expect(control.height).toBeGreaterThanOrEqual(14)
    }
  })
})

test.describe('a theme inside a web component', () => {
  for (const theme of [
    'amber',
    'aqua',
    'blueprint',
    'brutalist',
    'candy',
    'carbon',
    'forest',
    'frost',
    'glass',
    'light',
    'neon',
    'noir',
    'paper',
    'retro',
    'synth',
    'terminal',
  ]) {
    test(`${theme} paints the titlebar, title and buttons as it does in the page`, async ({
      page,
    }) => {
      await page.goto(`test/themes.html?theme=${theme}`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('wm-window[window-id="front"]')).toHaveAttribute(
        'data-wm-focused',
        '',
      )
      await page.evaluate(async () => {
        const finite = document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
          )
        await Promise.all(finite.map((animation) => animation.finished.catch(() => {})))
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      const differences = await page.evaluate(() => {
        const BOX = ['width', 'height'] as const
        const LOOK = [
          'opacity',
          'borderTopLeftRadius',
          'borderBottomRightRadius',
          'borderTopWidth',
          'borderTopStyle',
          'borderTopColor',
          'backgroundColor',
          'backgroundImage',
          'color',
          'fontFamily',
          'fontSize',
          'fontWeight',
          'lineHeight',
          'letterSpacing',
          'textTransform',
          'paddingTop',
          'paddingLeft',
          'paddingRight',
          'gap',
          'display',
          'alignItems',
        ] as const
        const SPOTS: Array<[string, string, string?]> = [
          ['titlebar', '[data-wm-drag]'],
          ['title', '[data-wm-title]'],
          ['minimize', '[data-wm-minimize]'],
          ['minimize glyph', '[data-wm-minimize]', '::after'],
          ['maximize', '[data-wm-maximize]'],
          ['maximize glyph', '[data-wm-maximize]', '::after'],
          ['close', '[data-wm-close]'],
          ['close glyph', '[data-wm-close]', '::after'],
        ]
        const apart = (left: string, right: string) => {
          if (left === right) return false
          const [a, b] = [Number.parseFloat(left), Number.parseFloat(right)]
          const unit = (value: string) => value.replace(/^-?[\d.]+/, '')
          return !(Math.abs(a - b) <= 0.5 && unit(left) === unit(right) && unit(left) === 'px')
        }
        const out: string[] = []
        for (const id of ['front', 'behind']) {
          const plain = document.querySelector(`#plain [data-wm-window="${id}"]`) as HTMLElement
          const host = document.querySelector(`wm-window[window-id="${id}"]`) as HTMLElement
          for (const [label, selector, pseudo] of SPOTS) {
            const inPage = plain.querySelector(selector) as HTMLElement
            const inShadow = host.shadowRoot?.querySelector(selector) as HTMLElement
            const a = getComputedStyle(inPage, pseudo)
            const b = getComputedStyle(inShadow, pseudo)
            for (const prop of pseudo ? ([...LOOK, 'content'] as const) : LOOK) {
              if (apart(a[prop], b[prop])) {
                out.push(
                  `${id} ${label} ${prop}: ${a[prop]} in the page, ${b[prop]} in the shadow root`,
                )
              }
            }
            if (pseudo) continue
            const [x, y] = [inPage.getBoundingClientRect(), inShadow.getBoundingClientRect()]
            for (const side of BOX) {
              if (Math.abs(x[side] - y[side]) > 0.5) {
                out.push(
                  `${id} ${label} ${side}: ${x[side]} in the page, ${y[side]} in the shadow root`,
                )
              }
            }
          }
        }
        return out
      })
      expect(differences).toEqual([])
    })
  }
})

test.describe('reduced transparency', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'only Chromium can be told the preference',
  )

  const looks = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#plain [data-wm-window], wm-window')].map(
        (el) => {
          const style = getComputedStyle(el)
          return {
            where: `${el.localName} ${el.dataset.wmWindow}`,
            blur: style.backdropFilter,
            background: style.backgroundColor,
          }
        },
      ),
    )
  const seeThrough = (look: { blur: string; background: string }) =>
    look.blur !== 'none' || !look.background.startsWith('rgb(')

  for (const theme of [
    'amber',
    'aqua',
    'blueprint',
    'candy',
    'forest',
    'frost',
    'glass',
    'light',
    'neon',
    'synth',
    'terminal',
  ]) {
    test(`${theme} paints windows opaque and unblurred, in the page and in a web component`, async ({
      page,
    }) => {
      await page.goto(`test/themes.html?theme=${theme}`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const before = await looks(page)
      expect(before).toHaveLength(4)
      expect(
        before.filter(seeThrough).length,
        'the theme is see-through to begin with',
      ).toBeGreaterThan(0)

      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      })
      await expect
        .poll(() =>
          page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches),
        )
        .toBe(true)
      await expect
        .poll(async () => (await looks(page)).filter(seeThrough).map((look) => look.where))
        .toEqual([])
    })
  }
})
