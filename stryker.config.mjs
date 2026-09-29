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
    "lib/proof-utils.ts:270-625",
    "lib/proof-utils.ts:2218-2475",
    "lib/proof-utils.ts:2840-3156",
    "lib/masonry.ts",
    "lib/error-sanitization.ts",
    "lib/security.ts",
  ],
  // Ratchet (#960, #968): measured 55.79% locally on 2026-09-29 (48.37% before
  // the masonry and error-sanitization tests). CI ran about 1.8 points below
  // local in #960, so `break` keeps that margin. Raise it as tests kill
  // surviving mutants. Target 80.
  thresholds: {
    high: 85,
    low: 75,
    break: 53,
  },
  concurrency: 4,
  timeoutMS: 2000,
  timeoutFactor: 1.5,
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};

export default config;
