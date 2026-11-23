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

test('a docs address without .html opens the page', async ({ page }) => {
  for (const path of ['docs/api', 'docs/ru/api', 'docs/guides/react-draggable-resizable-window']) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.locator('.vp-doc h1').first(), path).toBeVisible()
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical, path).toBe(`https://wmkit.vercel.app/${path}.html`)
  }
})

test('inline code keeps its template placeholders', async ({ page }) => {
  for (const path of ['docs/api.html', 'docs/ru/api.html']) {
    await page.goto(path)
    const doc = page.locator('.vp-doc')
    await expect(doc.locator('code', { hasText: /^\{\{title\}\}$/ }).first(), path).toBeVisible()
    await expect(doc.locator('code', { hasText: /^\{\{id\}\}$/ }).first(), path).toBeVisible()
    const empty = await doc
      .locator('p code')
      .evaluateAll((nodes) => nodes.filter((node) => (node.textContent ?? '').trim() === '').length)
    expect(empty, `${path} has empty inline code`).toBe(0)
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

test('llms.txt names the entry points, and the pages describe themselves as structured data', async ({
  request,
}) => {
  const llms = await (await request.get('llms.txt')).text()
  expect(llms).toMatch(/for the web, version \d+\.\d+\.\d+:/)
  expect(llms).toContain('- `@surdeddd/wmkit/dock`: ')
  expect(llms).toContain('## Rules that prevent the usual mistakes')

  const structured = async (path: string) => {
    const html = await (await request.get(path)).text()
    const found = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    expect(found, path).toHaveLength(1)
    return JSON.parse(found[0]?.[1] ?? '') as Record<string, unknown>
  }
  const landing = (await structured('')) as { '@graph': Array<Record<string, unknown>> }
  expect(landing['@graph'][1]).toMatchObject({ '@type': 'SoftwareSourceCode', inLanguage: 'en' })
  expect(String(landing['@graph'][1]?.version)).toMatch(/^\d+\.\d+\.\d+$/)
  const russian = (await structured('ru/')) as { '@graph': Array<Record<string, unknown>> }
  expect(russian['@graph'][1]).toMatchObject({ inLanguage: 'ru' })
  expect(await structured('docs/guides/ai-coding-agents.html')).toMatchObject({
    '@type': 'TechArticle',
    inLanguage: 'en',
    url: 'https://wmkit.vercel.app/docs/guides/ai-coding-agents.html',
  })
  expect(await structured('docs/ru/api.html')).toMatchObject({ inLanguage: 'ru' })
})
