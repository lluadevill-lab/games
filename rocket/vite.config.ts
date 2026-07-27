import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build em arquivo único: abre por file://, GitHub Pages ou qualquer host.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
  },
});
