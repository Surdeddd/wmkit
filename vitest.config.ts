import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@surdeddd/wmkit/persist/idb': new URL('./src/plugins/persist-idb.ts', import.meta.url)
        .pathname,
      '@surdeddd/wmkit/persist': new URL('./src/plugins/persist.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/devtools': new URL('./src/plugins/devtools/index.ts', import.meta.url)
        .pathname,
      '@surdeddd/wmkit/gestures': new URL('./src/plugins/gestures.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/chrome': new URL('./src/plugins/chrome/index.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/winbox': new URL('./src/plugins/winbox/index.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/dock': new URL('./src/plugins/dock/index.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/elements/define': new URL(
        './src/plugins/elements/define.ts',
        import.meta.url,
      ).pathname,
      '@surdeddd/wmkit/elements': new URL('./src/plugins/elements/index.ts', import.meta.url)
        .pathname,
      '@surdeddd/wmkit/themes': new URL('./src/themes/index.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/popout': new URL('./src/plugins/popout.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/react': new URL('./src/adapters/react.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/vue': new URL('./src/adapters/vue.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/svelte': new URL('./src/adapters/svelte.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/solid': new URL('./src/adapters/solid.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/ru': new URL('./src/locales/ru.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/taskbar/define': new URL('./src/plugins/taskbar/define.ts', import.meta.url)
        .pathname,
      '@surdeddd/wmkit/taskbar': new URL('./src/plugins/taskbar/index.ts', import.meta.url)
        .pathname,
      '@surdeddd/wmkit/layouts': new URL('./src/plugins/layouts/index.ts', import.meta.url)
        .pathname,
      '@surdeddd/wmkit/switcher': new URL('./src/plugins/switcher/index.ts', import.meta.url)
        .pathname,
      '@surdeddd/wmkit/sync': new URL('./src/plugins/sync.ts', import.meta.url).pathname,
      '@surdeddd/wmkit/testing': new URL('./src/testing/index.ts', import.meta.url).pathname,
      '@surdeddd/wmkit': new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/adapters/qwik.ts', 'site/**'],
      thresholds: { statements: 100, lines: 100, functions: 100, branches: 100 },
      reporter: ['text', 'html'],
    },
  },
})
