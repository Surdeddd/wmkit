import { cp } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/adapters/react.ts',
    vue: 'src/adapters/vue.ts',
    svelte: 'src/adapters/svelte.ts',
    solid: 'src/adapters/solid.ts',
    angular: 'src/adapters/angular.ts',
    preact: 'src/adapters/preact.ts',
    lit: 'src/adapters/lit.ts',
    persist: 'src/plugins/persist.ts',
    popout: 'src/plugins/popout.ts',
    devtools: 'src/plugins/devtools/index.ts',
    gestures: 'src/plugins/gestures.ts',
    chrome: 'src/plugins/chrome/index.ts',
    winbox: 'src/plugins/winbox/index.ts',
    dock: 'src/plugins/dock/index.ts',
    elements: 'src/plugins/elements/index.ts',
    'elements/define': 'src/plugins/elements/define.ts',
    themes: 'src/themes/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  platform: 'browser',
  external: ['react', 'vue', 'svelte', 'solid-js', '@angular/core', /^preact/, /^lit/],
  clean: true,
  treeshake: true,
  splitting: true,
  sourcemap: true,
  async onSuccess() {
    await cp('src/themes', 'dist/themes', {
      recursive: true,
      filter: (source) => !source.endsWith('.ts'),
    })
  },
})
