import { cp } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/adapters/react.ts',
    vue: 'src/adapters/vue.ts',
    svelte: 'src/adapters/svelte.ts',
    solid: 'src/adapters/solid.ts',
    persist: 'src/plugins/persist.ts',
    popout: 'src/plugins/popout.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  platform: 'browser',
  external: ['react', 'vue', 'svelte', 'solid-js'],
  clean: true,
  treeshake: true,
  splitting: true,
  sourcemap: true,
  async onSuccess() {
    await cp('src/themes', 'dist/themes', { recursive: true })
  },
})
