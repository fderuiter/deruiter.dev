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
    configFile: "vitest.stryker.config.ts",
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
  // Ratchet (#960, #968): threshold raised to 65% for telemetry and clinical core expansion
  thresholds: {
    high: 85,
    low: 75,
    break: 65,
  },
  concurrency: 4,
  timeoutMS: 2000,
  timeoutFactor: 1.5,
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};

export default config;
