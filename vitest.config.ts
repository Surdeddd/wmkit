import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'wmkit/persist': new URL('./src/persist.ts', import.meta.url).pathname,
      'wmkit/popout': new URL('./src/popout.ts', import.meta.url).pathname,
      'wmkit/react': new URL('./src/react.ts', import.meta.url).pathname,
      'wmkit/vue': new URL('./src/vue.ts', import.meta.url).pathname,
      'wmkit/svelte': new URL('./src/svelte.ts', import.meta.url).pathname,
      'wmkit/solid': new URL('./src/solid.ts', import.meta.url).pathname,
      wmkit: new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/persist.ts'],
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
