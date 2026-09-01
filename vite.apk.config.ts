import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(rootDir, "apk-web"),
  base: "/",
  publicDir: false,
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    alias: {
      "@/lib/ai/cloud": resolve(rootDir, "src/lib/ai/cloud-stub.ts"),
      "@": resolve(rootDir, "src"),
      "onnxruntime-node": resolve(rootDir, "src/lib/ai/empty.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["@huggingface/transformers", "onnxruntime-node"],
  },
  worker: { format: "es" },
  build: {
    outDir: resolve(rootDir, "android/app/src/main/assets/www"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: resolve(rootDir, "apk-web/index.html"),
      external: ["onnxruntime-node"],
    },
  },
});
