import { defineConfig } from "vitest/config";
import path from "path";

// #2529: tests for the weekly game engine mutation run
// (stryker.engines.config.mjs). Stryker re-imports every file holding a
// test that covers a mutant, so this lists the suites that assert scores
// and validation directly. The .tsx UI suites and the balance, campaign
// and replay simulations cover nearly every mutant and would add seconds
// to each one without asserting a specific score.
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    include: [
      "**/__tests__/trial-and-error-scoring.test.ts",
      "**/__tests__/trial-and-error-validator.test.ts",
      "**/__tests__/trial-and-error-hands.test.ts",
      "**/__tests__/trial-and-error-hand-input.test.ts",
      "**/__tests__/trial-and-error-km.test.ts",
      "**/__tests__/trial-and-error-trace.test.ts",
      "**/__tests__/trial-and-error-timeline.test.ts",
      "**/__tests__/trial-and-error-snapshots.test.ts",
      "**/__tests__/trial-and-error-table.test.ts",
      "**/__tests__/trial-and-error-levels.test.ts",
      "**/__tests__/trial-and-error-relics.test.ts",
      "**/__tests__/trial-and-error-schemas.test.ts",
      "**/__tests__/trial-and-error-economy.test.ts",
      "**/__tests__/trial-and-error-act.test.ts",
      "**/__tests__/working-with-duck-*.test.ts",
      "**/__tests__/duck-engine-scenarios.test.ts",
      "**/__tests__/services/duck/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.stryker-tmp/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
