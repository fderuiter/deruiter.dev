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
    "/test-results/**",
  ],
  mutate: [
    "lib/proof-utils.ts:270-625",
    "lib/proof-utils.ts:2218-2475",
    "lib/proof-utils.ts:2840-3156",
    "lib/masonry.ts",
    "lib/error-sanitization.ts",
    "lib/security.ts",
  ],
  // Ratchet (#960): measured 46.73% in CI and 48.52% locally on 2026-09-24
  // after widening the Vitest include. `break` sits under both so the gate
  // still catches regressions; raise it as tests kill surviving mutants.
  // Target 80.
  thresholds: {
    high: 85,
    low: 75,
    break: 45,
  },
  concurrency: 4,
  timeoutMS: 2000,
  timeoutFactor: 1.5,
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};

export default config;
