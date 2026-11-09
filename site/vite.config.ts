import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { version: string }

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const TEST_PAGES = ['vanilla', 'react', 'winbox', 'elements', 'preact', 'lit', 'dock'] as const

const testPages =
  process.env.WMKIT_E2E === '1'
    ? Object.fromEntries(TEST_PAGES.map((name) => [name, page(`./test/${name}.html`)]))
    : {}

export default defineConfig({
  base: process.env.VERCEL ? '/' : '/wmkit/',
  define: {
    __WMKIT_VERSION__: JSON.stringify(pkg.version),
    'import.meta.env.WMKIT_VERSION': JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@surdeddd/wmkit/persist': fileURLToPath(
        new URL('../src/plugins/persist.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/gestures': fileURLToPath(
        new URL('../src/plugins/gestures.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/chrome': fileURLToPath(
        new URL('../src/plugins/chrome/index.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/winbox': fileURLToPath(
        new URL('../src/plugins/winbox/index.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/dock': fileURLToPath(
        new URL('../src/plugins/dock/index.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/elements/define': fileURLToPath(
        new URL('../src/plugins/elements/define.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/elements': fileURLToPath(
        new URL('../src/plugins/elements/index.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/popout': fileURLToPath(new URL('../src/plugins/popout.ts', import.meta.url)),
      '@surdeddd/wmkit/devtools': fileURLToPath(
        new URL('../src/plugins/devtools/index.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/react': fileURLToPath(new URL('../src/adapters/react.ts', import.meta.url)),
      '@surdeddd/wmkit/preact': fileURLToPath(
        new URL('../src/adapters/preact.ts', import.meta.url),
      ),
      '@surdeddd/wmkit/lit': fileURLToPath(new URL('../src/adapters/lit.ts', import.meta.url)),
      '@surdeddd/wmkit/themes': fileURLToPath(new URL('../src/themes', import.meta.url)),
      '@surdeddd/wmkit': fileURLToPath(new URL('../src/index.ts', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: page('./index.html'),
        ...testPages,
      },
    },
  },
})
