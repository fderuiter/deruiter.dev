// @ts-check
import os from "os";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",
  mutator: {
    excludedMutations: [],
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
    "lib/proof-utils.ts",
    "lib/trial-and-error/**",
    "!lib/trial-and-error/index.ts",
    "!lib/trial-and-error/types.ts",
    "lib/security.ts",
    "lib/error-sanitization.ts",
    "lib/masonry.ts",
    "lib/pretext-block-parser.ts",
    "lib/content-sanitizer.ts",
    "lib/garmin-engine.ts",
    "lib/working-with-duck-engine.ts",
    "lib/crf/**",
    "!lib/crf/index.ts",
    "!lib/crf/types.ts",
    "lib/dungeon/**",
    "!lib/dungeon/index.ts",
    "!lib/dungeon/types.ts",
    "lib/laser-loon/**",
    "!lib/laser-loon/index.ts",
    "!lib/laser-loon/types.ts",
    "lib/quasi-perfect/**",
    "!lib/quasi-perfect/index.ts",
    "!lib/quasi-perfect/types.ts",
    "lib/retro-labyrinth/**",
    "!lib/retro-labyrinth/index.ts",
    "!lib/retro-labyrinth/types.ts",
    "lib/neuro/**",
    "!lib/neuro/index.ts",
    "!lib/neuro/types.ts",
    "lib/patrol/**",
    "!lib/patrol/index.ts",
    "!lib/patrol/types.ts",
    "lib/clinical-trial-chaos/**",
    "!lib/clinical-trial-chaos/index.ts",
    "!lib/clinical-trial-chaos/types.ts",
    "lib/term-compiler.ts",
    "lib/search-utils.ts",
    "lib/accessibility-utils.ts",
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
  concurrency: Math.max(1, Math.floor(os.cpus().length / 2)),
  timeoutMS: 2000,
  timeoutFactor: 1.5,
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};

export default config;
