import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/wmkit/',
  resolve: {
    alias: {
      '@surdeddd/wmkit/persist': fileURLToPath(new URL('../src/persist.ts', import.meta.url)),
      '@surdeddd/wmkit/popout': fileURLToPath(new URL('../src/popout.ts', import.meta.url)),
      '@surdeddd/wmkit/react': fileURLToPath(new URL('../src/react.ts', import.meta.url)),
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
      },
    },
  },
})
