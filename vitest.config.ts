import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@surdeddd/wmkit/persist': new URL('./src/plugins/persist.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/popout': new URL('./src/plugins/popout.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/react': new URL('./src/adapters/react.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/vue': new URL('./src/adapters/vue.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/svelte': new URL('./src/adapters/svelte.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/solid': new URL('./src/adapters/solid.ts', import.meta.url).pathname,
      '@surdeddd/wmkit': new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/plugins/persist.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
      reporter: ['text', 'html'],
    },
  },
})
