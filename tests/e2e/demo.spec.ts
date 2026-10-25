import { readFileSync } from 'node:fs'
import { expect, type Page, test } from './fixtures'

const readme = '[data-testid="window-readme"]'
const latin = /[A-Za-z]/

async function boot(page: Page, lang: 'en' | 'ru' = 'en'): Promise<void> {
  await page.goto(`?lang=${lang}`)
  await expect(page.locator(readme)).toBeVisible()
}

async function launch(page: Page, app: string) {
  await page.click(`#launcher button[data-app="${app}"]`)
  const window = page.locator(`[data-testid="window-${app}"]`)
  await expect(window).toBeVisible()
  return window
}

function windowCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__wmDemo.wm.getState().order.length)
}

async function run(page: Page, line: string): Promise<void> {
  const input = page.locator('[data-testid="window-terminal"] .term-form input')
  await input.fill(line)
  await input.press('Enter')
}

test.describe('the demo history', () => {
  test('opening an app is one undo step', async ({ page }) => {
    await boot(page)
    await page.evaluate(() => window.__wmDemo.wm.clearHistory())
    await launch(page, 'paint')

    expect(await page.evaluate(() => window.__wmDemo.wm.undo())).toBe(true)
    await expect(page.locator('[data-testid="window-paint"]')).toHaveCount(0)
  })

  test('an undone close can be redone', async ({ page }) => {
    await boot(page)
    await launch(page, 'paint')
    await page.evaluate(() => window.__wmDemo.wm.clearHistory())
    await page.evaluate(() => window.__wmDemo.wm.close('paint'))
    await expect(page.locator('[data-testid="window-paint"]')).toHaveCount(0)

    expect(await page.evaluate(() => window.__wmDemo.wm.undo())).toBe(true)
    await expect(page.locator('[data-testid="window-paint"]')).toBeVisible()
    expect(await page.evaluate(() => window.__wmDemo.wm.canRedo())).toBe(true)
  })

  test('the bench burst is one undo step', async ({ page }) => {
    await boot(page)
    const bench = await launch(page, 'bench')
    await page.evaluate(() => window.__wmDemo.wm.clearHistory())
    const before = await windowCount(page)

    await bench.locator('.app-actions button').click()
    await expect.poll(() => windowCount(page)).toBe(before + 50)
    await page.evaluate(() => window.__wmDemo.wm.undo())
    expect(await windowCount(page)).toBe(before)
  })
})

test('a settings toggle keeps every open app running, once', async ({ page }) => {
  await boot(page)
  const terminal = await launch(page, 'terminal')
  await run(page, 'state')
  await expect(terminal.locator('.term-log .cmd').last()).toHaveText('state')
  await launch(page, 'inspector')
  await page.evaluate(() => {
    const log = document.querySelector('[data-testid="window-inspector"] .evlog')
    Object.assign(window, { inspectorLog: log })
  })

  const settings = await launch(page, 'settings')
  const off = settings.locator('.setting').nth(1).getByRole('button', { name: 'off', exact: true })
  await off.click()
  await expect(off).toHaveAttribute('aria-pressed', 'true')

  await expect(page.locator('[data-testid="window-terminal"] .term-log')).toContainText('state')
  expect(
    await page.evaluate(
      () => (window as unknown as { inspectorLog: Element }).inspectorLog.isConnected,
    ),
  ).toBe(true)
  await page.evaluate(() => window.__wmDemo.wm.open({ id: 'probe', title: 'probe' }))
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('.evlog li')].filter((li) => li.textContent === 'openprobe')
            .length,
      ),
    )
    .toBe(1)
})

test('a variant lands on the window the user focused', async ({ page }) => {
  await boot(page)
  const skins = await launch(page, 'skins')
  await page.evaluate(() => window.__wmDemo.wm.focus('readme'))

  await skins.locator('.skin-variant').nth(1).click()

  await expect(page.locator('[data-wm-window="readme"]')).toHaveAttribute(
    'data-wm-variant',
    'accent',
  )
  await expect(page.locator('[data-wm-window="skins"]')).not.toHaveAttribute('data-wm-variant')
})

test('the desktop narrates itself in the language of the page', async ({ page }) => {
  await boot(page, 'ru')
  const region = page.locator('#desktop [data-wm-announcer]')
  await page.click('#launcher button[data-app="paint"]')
  await expect(region).toHaveText(/рисовалка/)
  expect(await region.textContent()).not.toMatch(latin)

  await page.click('#lang button[data-lang="en"]')
  await page.click('#launcher button[data-app="layouts"]')
  await expect(region).toHaveText('layouts window opened')
})

test('the demo boots when the page may not touch storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('storage is blocked', 'SecurityError')
      },
    })
  })
  await page.goto('?lang=en')
  const blocked = await page.evaluate(() => {
    try {
      return typeof window.localStorage === 'undefined'
    } catch {
      return true
    }
  })
  expect(blocked).toBe(true)
  await expect(page.locator(readme)).toBeVisible()

  await page.click('#lang button[data-lang="ru"]')
  await expect(page.locator('h1')).toContainText('ОКНА')
})

test('the terminal only offers the workspaces the desktop has', async ({ page }) => {
  await boot(page)
  const terminal = await launch(page, 'terminal')
  for (const arg of ['9', '0']) {
    await run(page, `workspace ${arg}`)
    expect(await page.evaluate(() => window.__wmDemo.wm.getState().workspace)).toBe(0)
    await expect(terminal.locator('.term-log > div').last()).toHaveClass('err')
  }

  await run(page, 'workspace 2')
  await expect(page.locator('#workspaces button[data-workspace="1"]')).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('the Russian demo labels its own controls in Russian', async ({ page }) => {
  await boot(page, 'ru')
  for (const selector of ['#menus', '#workspaces', '#demo', '#launcher', '#dock']) {
    const label = (await page.locator(selector).getAttribute('aria-label')) ?? ''
    expect(label.replace('wmkit', ''), selector).not.toMatch(latin)
  }
  for (const tab of await page.locator('#workspaces button').all()) {
    expect(await tab.getAttribute('aria-label')).not.toMatch(latin)
  }

  const terminal = await launch(page, 'terminal')
  expect(await terminal.locator('.term-form input').getAttribute('aria-label')).not.toMatch(latin)
  await page.evaluate(() => window.__wmDemo.wm.clearHistory())
  for (const line of ['undo', 'redo']) {
    await run(page, line)
    await expect(terminal.locator('.term-log > div').last()).not.toHaveText(latin)
  }

  const layouts = await launch(page, 'layouts')
  for (const button of await layouts.locator('.app-actions button').all()) {
    const label = (await button.textContent()) ?? ''
    if (label !== '+') expect(label).not.toMatch(latin)
  }

  const bench = await launch(page, 'bench')
  for (const term of await bench.locator('dt').allTextContents()) expect(term).not.toMatch(latin)

  const paint = await launch(page, 'paint')
  for (const swatch of await paint.locator('button[data-swatch]').all()) {
    expect(await swatch.getAttribute('aria-label')).not.toMatch(latin)
  }

  const inspector = await launch(page, 'inspector')
  const head = ((await inspector.locator('.state-tree').textContent()) ?? '').split('\n')[0]
  expect(head).not.toMatch(latin)
})

test.describe('before any script runs', () => {
  test.use({ javaScriptEnabled: false })

  test('the page names the version it ships', async ({ page }) => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as {
      version: string
    }
    await page.goto('?lang=en')
    await expect(page.locator('#brand-ver')).toHaveText(`v${pkg.version}`)
  })
})

test('the boot log counts every theme the demo ships', async ({ page }) => {
  await boot(page)
  const settings = await launch(page, 'settings')
  const themes = await settings.locator('.setting').first().locator('.seg button').count()
  expect(themes).toBeGreaterThan(3)
  await expect(page.locator('#boot-log')).toContainText(
    new RegExp(`^themes \\.+ ${themes}\\b`, 'm'),
  )
})

test('the readme install button copies the command it shows', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only here')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await boot(page)
  const button = page.locator(`${readme} .app-actions button`).first()
  const label = await button.textContent()
  await button.click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(label)
})
