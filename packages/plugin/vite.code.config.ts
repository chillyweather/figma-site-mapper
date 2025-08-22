import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: resolve(__dirname, 'dist'),
    minify: false,
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'code',
      formats: ['es'],
      fileName: () => 'code.js',
    },
    rollupOptions: {
      external: [],
      output: {
        format: 'es',
      },
    },
  },
})