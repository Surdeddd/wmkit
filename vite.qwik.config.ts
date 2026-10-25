import { qwikVite } from '@builder.io/qwik/optimizer'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'src/adapters/qwik.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => `qwik.qwik.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [/^@builder\.io\/qwik/, /^@surdeddd\/wmkit/],
    },
  },
  plugins: [qwikVite()],
})
