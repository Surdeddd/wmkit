import { cp } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    vue: 'src/vue.ts',
    svelte: 'src/svelte.ts',
    solid: 'src/solid.ts',
    persist: 'src/persist.ts',
    popout: 'src/popout.ts',
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
