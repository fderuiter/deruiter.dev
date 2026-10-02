import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    include: [
      "**/__tests__/proof-engine-extended.test.ts",
      "**/__tests__/proof-theorems.test.ts",
      "**/__tests__/proof-export.test.ts",
      "**/__tests__/proof-fallacy.test.ts",
      "**/__tests__/masonry.test.ts",
      "**/__tests__/masonry-heights.test.ts",
      "**/__tests__/error-sanitization.test.ts",
      "**/__tests__/error-sanitization-mutants.test.ts",
      "**/__tests__/security.test.ts",
      "**/__tests__/telemetry-outbox.test.ts",
      "**/__tests__/crf/ast-evaluator.test.ts",
      "**/__tests__/crf-ast-conformance-engine.test.ts",
      "**/__tests__/crf/conditional-logic.test.ts",
      "**/__tests__/crf/cross-visit-rules.test.ts",
      "**/__tests__/crf/study-engine.test.ts",
      "**/__tests__/crf/form-health.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.stryker-tmp/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
