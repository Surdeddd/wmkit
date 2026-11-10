import { expect, type Page, test } from './fixtures'

const readme = '[data-testid="window-readme"]'

async function head(page: Page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    alternates: Object.fromEntries(
      [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => [
        link.getAttribute('hreflang'),
        link.getAttribute('href'),
      ]),
    ),
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    twitter: document.querySelector('meta[name="twitter:card"]')?.getAttribute('content'),
    headline: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(),
  }))
}

test.describe('the landing as served, before any script runs', () => {
  test.use({ javaScriptEnabled: false })

  test('/ru/ is a Russian page with its own address and its English twin', async ({ page }) => {
    const response = await page.goto('ru/')
    expect(response?.status()).toBe(200)
    expect(await head(page)).toEqual({
      lang: 'ru',
      canonical: 'https://wmkit.vercel.app/ru/',
      alternates: {
        en: 'https://wmkit.vercel.app/',
        ru: 'https://wmkit.vercel.app/ru/',
        'x-default': 'https://wmkit.vercel.app/',
      },
      ogImage: 'https://wmkit.vercel.app/og.png',
      twitter: 'summary_large_image',
      headline: 'ОКНА в вашем веб-приложении',
    })
    await expect(page.locator('#features')).toContainText(/[а-яё]{4}/)
  })

  test('the English page points at the Russian one', async ({ page }) => {
    await page.goto('')
    const english = await head(page)
    expect(english.lang).toBe('en')
    expect(english.canonical).toBe('https://wmkit.vercel.app/')
    expect(english.alternates.ru).toBe('https://wmkit.vercel.app/ru/')
    expect(english.headline).toBe('WINDOWS in your web app')
  })
})

test('the Russian page boots its desktop in Russian', async ({ page }) => {
  await page.goto('ru/')
  await expect(page.locator(readme)).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await expect(page.locator('#lang button[data-lang="ru"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#launcher button[data-app="settings"]')).toContainText('настройки')
})

test('?lang=ru still switches the English page to Russian', async ({ page }) => {
  await page.goto('?lang=ru')
  await expect(page.locator(readme)).toBeVisible()
  await expect(page.locator('h1')).toContainText('ОКНА')
  await expect(page.locator('#lang button[data-lang="ru"]')).toHaveAttribute('aria-pressed', 'true')
})
