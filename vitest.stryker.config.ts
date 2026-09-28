import { defineConfig } from "vitest/config";
import path from "path";
import os from "os";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
    execArgv: ["--max-old-space-size=4096", "--no-warnings"],
    maxWorkers: Math.max(1, Math.floor(os.cpus().length / 2)),
    include: [
      "**/__tests__/proof-*.test.ts*",
      "**/__tests__/integration-*.test.tsx",
      "**/__tests__/pretext-block-parser.test.ts",
      "**/__tests__/css-layout-budget-precompute.test.tsx",
      "**/__tests__/masonry.test.ts",
      "**/__tests__/error-sanitization.test.ts",
      "**/__tests__/security.test.ts",
      "**/__tests__/content-sanitizer.test.ts",
      "**/__tests__/garmin-*.test.ts*",
      "**/__tests__/working-with-duck-*.test.ts*",
      "**/__tests__/trial-and-error-*.test.ts*",
      "**/__tests__/crf-*.test.ts*",
      "**/__tests__/dungeon-*.test.ts",
      "**/__tests__/laser-loon-*.test.ts*",
      "**/__tests__/quasi-perfect-*.test.ts*",
      "**/__tests__/retro-labyrinth-*.test.ts*",
      "**/__tests__/neuro-*.test.ts*",
      "**/__tests__/patrol-*.test.ts*",
      "**/__tests__/clinical-*.test.ts*",
      "**/__tests__/term-compiler.test.tsx",
      "**/__tests__/search.test.ts",
      "**/__tests__/accessibility-utils.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
