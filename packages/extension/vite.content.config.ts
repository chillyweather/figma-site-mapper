import { defineConfig } from "vite";
import { resolve } from "path";

// Content scripts must be classic scripts (IIFE) — they cannot be ES modules
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/contentScript.ts"),
      name: "SitemapperContentScript",
      formats: ["iife"],
      fileName: () => "contentScript.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
