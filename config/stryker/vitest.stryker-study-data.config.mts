import { defineConfig } from "vitest/config";
import path from "path";

// #2607: tests for the weekly study data derivation mutation run
// (stryker.study-data.config.mjs). Stryker re-imports every file holding a
// test that covers a mutant, so the independent QC suite, which re-derives
// a whole study in about 30 seconds, stays out; the unit suites below
// assert the derivations directly.
const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  root: repoRoot,
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
    include: [
      "**/__tests__/study-data-adam-core.test.ts",
      "**/__tests__/study-data-adam-edges.test.ts",
      "**/__tests__/study-data-adam-events.test.ts",
      "**/__tests__/study-data-km.test.ts",
      "**/__tests__/study-data-subject-domains.test.ts",
      "**/__tests__/study-data-tlf.test.ts",
      "**/__tests__/study-data-trial-design.test.ts",
      "**/__tests__/study-data.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.stryker-tmp/**"],
  },
  resolve: {
    alias: {
      "@": repoRoot,
    },
  },
});
