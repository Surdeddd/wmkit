import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const site = fileURLToPath(new URL('../site', import.meta.url))
const page = 'test/vanilla.html'
const counts = [50, 200, 400]
const rates = [1, 4]
const steps = 120

const gpuFlags = {
  darwin: ['--use-angle=metal'],
  win32: ['--use-angle=d3d11'],
  linux: ['--use-angle=vulkan', '--enable-features=Vulkan'],
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

function percentile(values, p) {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

async function launch() {
  const args = [...(gpuFlags[process.platform] ?? []), '--enable-gpu', '--ignore-gpu-blocklist']
  const attempts = [
    { label: 'gpu flags', options: { args } },
    { label: 'default flags', options: {} },
  ]
  let failure = null
  for (const { label, options } of attempts) {
    try {
      const browser = await chromium.launch(options)
      const probe = await browser.newPage()
      const renderer = await probe.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl')
        if (!gl) return 'no webgl'
        const info = gl.getExtension('WEBGL_debug_renderer_info')
        return String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
      })
      await probe.close()
      if (label === 'gpu flags' && /swiftshader|llvmpipe|software|no webgl/i.test(renderer)) {
        await browser.close()
        failure = `gpu flags gave a software renderer (${renderer})`
        continue
      }
      return { browser, label, renderer, failure }
    } catch (error) {
      failure = `${label} failed: ${String(error.message ?? error).split('\n')[0]}`
    }
  }
  throw new Error(failure ?? 'could not launch Chromium')
}

async function measure(browser, base, windows, rate) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  try {
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
    )
    const tab = await context.newPage()
    const errors = []
    tab.on('pageerror', (error) => errors.push(error.message))
    await tab.goto(`${base}${page}`)
    await tab.evaluate(() => localStorage.clear())
    await tab.reload()
    await tab.locator('#btn-stress').waitFor()
    for (let i = 0; i < windows / 50; i += 1) await tab.click('#btn-stress')
    const open = await tab.locator('[data-wm-window]').count()
    if (open !== windows) throw new Error(`expected ${windows} windows, found ${open}`)
    await tab.waitForTimeout(600)

    const cdp = await context.newCDPSession(tab)
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    const bar = tab.locator('[data-wm-window][data-wm-focused] [data-wm-drag]').first()
    const box = await bar.boundingBox()
    if (!box) throw new Error('the focused window has no titlebar on screen')
    const from = { x: box.x + Math.min(60, box.width / 2), y: box.y + box.height / 2 }

    await tab.evaluate(() => {
      const probe = { frames: [], on: true }
      window.__bench = probe
      let last = performance.now()
      const tick = (now) => {
        probe.frames.push(now - last)
        last = now
        if (probe.on) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const script = async () =>
      (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'ScriptDuration')
        ?.value ?? 0
    const before = await script()
    await tab.mouse.move(from.x, from.y)
    await tab.mouse.down()
    for (let i = 1; i <= steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2
      await tab.mouse.move(from.x + Math.sin(angle) * 100, from.y + (1 - Math.cos(angle)) * 60)
      await tab.waitForTimeout(12)
    }
    await tab.mouse.up()
    const after = await script()
    const frames = (
      await tab.evaluate(() => {
        window.__bench.on = false
        return window.__bench.frames
      })
    ).slice(2)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    if (errors.length > 0) throw new Error(`page error: ${errors[0]}`)
    if (frames.length === 0) throw new Error('no animation frames were recorded')
    return {
      windows,
      rate,
      script: ((after - before) * 1000) / frames.length,
      move: ((after - before) * 1000) / steps,
      median: percentile(frames, 50),
      p95: percentile(frames, 95),
      frames: frames.length,
    }
  } finally {
    await context.close()
  }
}

function table(rows) {
  const head = [
    'windows',
    'CPU',
    'script ms/frame',
    'script ms/move',
    'frame median ms',
    'frame p95 ms',
    'frames',
  ]
  const body = rows.map((row) => [
    String(row.windows),
    row.rate === 1 ? '1x' : `${row.rate}x slower`,
    row.script.toFixed(2),
    row.move.toFixed(2),
    row.median.toFixed(1),
    row.p95.toFixed(1),
    String(row.frames),
  ])
  const widths = head.map((cell, i) => Math.max(cell.length, ...body.map((line) => line[i].length)))
  const line = (cells) => `| ${cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ')} |`
  return [
    line(head),
    `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`,
    ...body.map(line),
  ].join('\n')
}

async function main() {
  if (!existsSync(`${site}/dist/${page}`)) {
    throw new Error(
      `${page} is not built: run WMKIT_E2E=1 pnpm site:build first (the test pages are built only with WMKIT_E2E=1)`,
    )
  }
  const port = await freePort()
  const server = await preview({
    root: site,
    logLevel: 'silent',
    preview: { port, strictPort: true, host: '127.0.0.1', open: false },
  })
  const base = `${server.resolvedUrls?.local[0] ?? `http://127.0.0.1:${port}/`}`
  const { browser, label, renderer, failure } = await launch()
  try {
    const rows = []
    for (const rate of rates) {
      for (const windows of counts) rows.push(await measure(browser, base, windows, rate))
    }
    console.log(
      `wmkit browser bench: drag one window among N on ${page}, glass theme, tab grouping on, ${steps} pointer moves 12 ms apart, 1280x800`,
    )
    console.log(`Chromium ${browser.version()} (${label}), renderer: ${renderer}`)
    console.log(
      'script time is CDP ScriptDuration during the drag, divided by animation frames and by pointer moves; frame times are requestAnimationFrame deltas',
    )
    if (failure) console.log(`note: ${failure}; frame times reflect software rendering`)
    console.log('')
    console.log(table(rows))
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch((error) => {
  console.error(`bench:browser: ${error.message ?? error}`)
  process.exitCode = 1
})
