import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../../src/${path}`, import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('../../../templates/dashboard', import.meta.url)),
  base: process.env.VERCEL ? '/test/dashboard/' : '/wmkit/test/dashboard/',
  resolve: {
    alias: {
      '@surdeddd/wmkit/dock': src('plugins/dock/index.ts'),
      '@surdeddd/wmkit/elements': src('plugins/elements/index.ts'),
      '@surdeddd/wmkit/themes': src('themes/index.ts'),
      '@surdeddd/wmkit': src('index.ts'),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../../site/dist/test/dashboard', import.meta.url)),
    emptyOutDir: true,
  },
})
