import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

export default defineConfig({
  plugins: [viteSingleFile()],
  root: resolve(__dirname, 'src'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    minify: false,
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/ui.html'),
      output: {
        dir: resolve(__dirname, 'dist'),
      },
    },
  },
  define: {
    global: 'globalThis',
  },
})
