import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    include: [
      "**/__tests__/proof-workspace.test.ts",
      "**/__tests__/proof-engine-extended.test.ts",
      "**/__tests__/proof-theorems.test.ts",
      "**/__tests__/proof-export.test.ts",
      "**/__tests__/proof-fallacy.test.ts",
      "**/__tests__/proof-truth-table.test.tsx",
      "**/__tests__/proof-drag-guides.test.tsx",
      "**/__tests__/integration-interactive-studios.test.tsx",
      "**/__tests__/pretext-block-parser.test.ts",
      "**/__tests__/css-layout-budget-precompute.test.tsx",
      "**/__tests__/masonry.test.ts",
      "**/__tests__/error-sanitization.test.ts",
      "**/__tests__/security.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
  },
});
