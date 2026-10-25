import { expect, test } from './fixtures'
import { boxOf, dragBy } from './utils'

const PAGES = [
  'docs/',
  'docs/api.html',
  'docs/adapters.html',
  'docs/recipes.html',
  'docs/theming.html',
  'docs/browser-support.html',
  'docs/winbox-migration.html',
  'docs/guides/react-draggable-resizable-window.html',
  'docs/guides/windows-95-desktop-react.html',
  'docs/compare/winbox-alternative.html',
]

test('every English page renders with a canonical link and a Russian twin', async ({ page }) => {
  for (const path of PAGES) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.locator('.vp-doc h1').first(), path).toBeVisible()
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical, path).toMatch(/^https:\/\/wmkit\.vercel\.app\/docs\//)
    const twin = await page.goto(path.replace(/^docs\//, 'docs/ru/'))
    expect(twin?.status(), path).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  }
})

test('the sidebar navigates and the language menu switches to Russian', async ({
  page,
  isMobile,
}) => {
  await page.goto('docs/')
  if (isMobile) await page.locator('.VPLocalNav button.menu').click()
  await page.locator('.VPSidebar').getByRole('link', { name: 'API', exact: true }).click()
  await expect(page).toHaveURL(/docs\/api\.html$/)
  await page.goto('docs/ru/')
  await expect(page.locator('.VPSidebar')).toContainText('Руководство')
})

test('the React walkthrough runs a live demo you can drag', async ({ page }) => {
  await page.goto('docs/guides/react-draggable-resizable-window.html')
  const demo = page.locator('.wm-demo[data-demo="react-window"]')
  const notes = demo.locator('[data-wm-window="notes"]')
  await expect(notes).toBeVisible()
  const before = await boxOf(notes)
  await dragBy(page, notes.locator('[data-wm-drag]'), 60, 40)
  const after = await boxOf(notes)
  expect(Math.abs(after.x - before.x - 60)).toBeLessThanOrEqual(2)
})

test('the retro desktop and the WinBox demo mount their windows', async ({ page }) => {
  await page.goto('docs/guides/windows-95-desktop-react.html')
  const retro = page.locator('.wm-demo[data-demo="retro-desktop"]')
  await retro.getByRole('button', { name: 'Start' }).click()
  await retro.getByRole('menuitem', { name: 'Notepad' }).click()
  await expect(retro.locator('[data-wm-window]')).toHaveCount(1)
  await page.goto('docs/compare/winbox-alternative.html')
  await expect(page.locator('.wm-demo[data-demo="winbox"] .winbox')).toHaveCount(2)
})

test('llms.txt, the sitemap and robots.txt list the docs', async ({ request }) => {
  const llms = await (await request.get('llms.txt')).text()
  for (const path of PAGES.slice(1)) {
    expect(llms, path).toContain(`https://wmkit.vercel.app/${path}`)
  }
  expect(llms).not.toContain('/docs/ru/')
  const full = await (await request.get('llms-full.txt')).text()
  expect(full).toContain('interface WindowState')
  const sitemap = await (await request.get('docs/sitemap.xml')).text()
  expect(sitemap).toContain('https://wmkit.vercel.app/docs/ru/api.html')
  const robots = await (await request.get('robots.txt')).text()
  expect(robots).toContain('Sitemap: https://wmkit.vercel.app/docs/sitemap.xml')
})
