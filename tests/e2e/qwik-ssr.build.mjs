import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const fixture = fileURLToPath(new URL('../fixtures/qwik-ssr/', import.meta.url))
const out = fileURLToPath(new URL('../../site/dist/test/qwik-ssr/', import.meta.url))
const base = process.env.VERCEL ? '/test/qwik-ssr/build/' : '/wmkit/test/qwik-ssr/build/'

mkdirSync(`${fixture}dist`, { recursive: true })
const env = { NODE_ENV: process.env.NODE_ENV, TMPDIR: process.env.TMPDIR }
process.env.NODE_ENV = 'production'
process.env.TMPDIR = `${fixture}dist`
try {
  const configFile = `${fixture}vite.config.ts`
  await build({ configFile, logLevel: 'error' })
  await build({ configFile, logLevel: 'error', build: { ssr: true } })
} finally {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

const server = await import(pathToFileURL(`${fixture}dist/server/entry.ssr.js`).href)
const { html } = await server.default({ base, qwikLoader: 'inline' })

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(`${fixture}dist/client/build`, `${out}build`, { recursive: true })
writeFileSync(
  `${out}index.html`,
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>wmkit qwik server-rendered page</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      .desktop { position: relative; width: 800px; height: 600px; background: #eef; overflow: hidden; }
      section { background: #fff; border: 1px solid #889; }
      [data-wm-drag] { height: 28px; background: #dde; display: flex; align-items: center; gap: 8px; }
      nav, output { position: relative; z-index: 1000; }
    </style>
  </head>
  <body>
${html}
  </body>
</html>
`,
)
