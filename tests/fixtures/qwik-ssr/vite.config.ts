import { fileURLToPath } from 'node:url'
import { qwikVite } from '@builder.io/qwik/optimizer'
import { defineConfig } from 'vite'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: here('.'),
  logLevel: 'warn',
  resolve: {
    alias: {
      '@surdeddd/wmkit/qwik': here('../../../src/adapters/qwik.ts'),
      '@surdeddd/wmkit': here('../../../src/index.ts'),
    },
  },
  build: { minify: false, emptyOutDir: true },
  plugins: [
    qwikVite({
      srcDir: here('.'),
      client: { input: here('root.ts'), outDir: here('dist/client') },
      ssr: { input: here('entry.ssr.ts'), outDir: here('dist/server') },
    }),
  ],
})
