import { fileURLToPath } from 'node:url'
import { qwikVite } from '@builder.io/qwik/optimizer'
import { defineConfig } from 'vite'

const src = (path: string) => fileURLToPath(new URL(`../../../src/${path}`, import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.VERCEL ? '/test/qwik/' : '/wmkit/test/qwik/',
  resolve: {
    alias: {
      '@surdeddd/wmkit/qwik': src('adapters/qwik.ts'),
      '@surdeddd/wmkit/themes': src('themes'),
      '@surdeddd/wmkit': src('index.ts'),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../../../site/dist/test/qwik', import.meta.url)),
    emptyOutDir: true,
  },
  plugins: [qwikVite({ csr: true, srcDir: fileURLToPath(new URL('.', import.meta.url)) })],
})
