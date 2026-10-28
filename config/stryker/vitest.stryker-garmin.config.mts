import { defineConfig } from "vitest/config";
import path from "path";

// #2564: tests for the weekly Garmin engine mutation run
// (stryker.garmin.config.mjs). Stryker re-imports every file holding a
// test that covers a mutant, so the whole-run simulations (balance,
// difficulty) stay out, as do the suites that assert rendering data
// rather than rules (*-art, heatmap, manual).
const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  root: repoRoot,
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    include: ["**/__tests__/garmin-*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/e2e/**",
      "**/.stryker-tmp/**",
      "**/__tests__/garmin-balance.test.ts",
      "**/__tests__/garmin-difficulty.test.ts",
      "**/__tests__/garmin-*-art.test.ts",
      "**/__tests__/garmin-heatmap.test.ts",
      "**/__tests__/garmin-manual.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": repoRoot,
    },
  },
});
