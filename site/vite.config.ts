import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
) as { version: string }

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
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        vanilla: fileURLToPath(new URL('./test/vanilla.html', import.meta.url)),
        react: fileURLToPath(new URL('./test/react.html', import.meta.url)),
        winbox: fileURLToPath(new URL('./test/winbox.html', import.meta.url)),
        elements: fileURLToPath(new URL('./test/elements.html', import.meta.url)),
        preact: fileURLToPath(new URL('./test/preact.html', import.meta.url)),
        lit: fileURLToPath(new URL('./test/lit.html', import.meta.url)),
        dock: fileURLToPath(new URL('./test/dock.html', import.meta.url)),
      },
    },
  },
})
