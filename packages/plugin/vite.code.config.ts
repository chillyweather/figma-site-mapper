import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "dist"),
    minify: false,
    emptyOutDir: false,
    target: "es2018",
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "code",
      formats: ["es"],
      fileName: () => "code.js",
    },
    rollupOptions: {
      external: [],
      output: {
        format: "es",
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2018",
    },
  },
  esbuild: {
    target: "es2018",
  },
});
