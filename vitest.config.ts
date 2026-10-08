import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Konfigurasi Vitest (Phase 1 — database smoke tests, environment: node).
 * Component test UI (jsdom) menyusul pada phase UI; jsdom sudah terpasang.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Test database menyentuh satu DB test yang sama → jalankan serial.
    fileParallelism: false,
  },
});
