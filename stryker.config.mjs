import os from "node:os";

// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",
  mutator: {
    excludedMutations: [
      "BlockStatement",
      "StringLiteral",
      "ObjectLiteral",
      "ArrayDeclaration",
    ],
  },
  vitest: {
    configFile: "vitest.stryker.config.mts",
    related: false,
  },
  htmlReporter: {
    fileName: ".stryker-tmp/mutation-report.html",
  },
  ignorePatterns: [
    "/.benchmark-results/**",
    "/.claude/**",
    "/.next/**",
    "/.stryker-tmp/**",
    "/.vercel/**",
    "/coverage/**",
    "/playwright-report/**",
    "/reports/**",
    "/test-results/**",
  ],
  // #1772: `npm run test:mutation -- --incremental` reuses results recorded
  // here for unchanged mutants. CI restores the newest copy a `main` push
  // saved and only ever saves from `main`. The path is gitignored (/reports).
  incrementalFile: "reports/stryker-incremental.json",
  mutate: [
    "lib/proof-utils.ts:270-350",
    "lib/masonry.ts",
    "lib/error-sanitization.ts",
    "lib/security.ts",
    "lib/telemetry/outbox.ts",
    "lib/crf/ast-evaluator.ts",
    "lib/crf/expression-evaluator.ts:1-150",
    "lib/crf/conditional-logic.ts:1-100",
    "lib/crf/cross-visit-rules.ts",
    "lib/crf/form-health.ts",
  ],
  // Ratchet (#960, #968): break went 45, 53, 65, 75, and reached the 80
  // target on 2026-10-02, when CI and a full local run both measured 82.24%
  // (532 killed, 33 timed out, 110 survived, 12 without coverage). Never
  // lower it.
  thresholds: {
    high: 85,
    low: 80,
    break: 80,
  },
  concurrency: Math.max(1, Math.min(4, os.cpus().length)),
  timeoutMS: 2000,
  timeoutFactor: 1.5,
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};

export default config;
