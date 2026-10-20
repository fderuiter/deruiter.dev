import baseConfig from "./stryker.config.mjs";

// @ts-check
/**
 * #2529: game engine mutation run, weekly only.
 *
 * `stryker.config.mjs` stays the PR `mutation-gate`'s scope, so pull
 * requests don't pay for these files. `mutation-weekly.yml` runs this
 * config as its own job beside the full base run, via
 * `npm run test:mutation -- --engines`.
 * It keeps its own incremental report and break, because one global score
 * across both scopes would let a strong file hide a weak one.
 *
 * `fileBreaks` holds each file's floor: its measured score, floored.
 * `scripts/run-mutation-tests.ts` fails the run when any file drops below
 * its floor. Raise a floor as survivors get killed; never lower one.
 * `lib/garmin/engine.ts` (moved there by #2512) can join once its floor is measured.
 *
 * Measured 2026-10-19 on 4 cores: first run rounding 95.18, scoring 89.52,
 * validator 91.41, Duck 51.35; after the cheapest survivors got tests,
 * 96.39, 98.10, 93.94 and 52.55. Duck's 838 survivors sit mostly in
 * `stepDuckGame` (the per-frame simulation) and are the ratchet's backlog.
 */
export const fileBreaks = {
  "lib/trial-and-error/internal/scoring.ts": 98,
  "lib/trial-and-error/internal/validator.ts": 93,
  "lib/trial-and-error/internal/rounding.ts": 96,
  "lib/working-with-duck-engine.ts": 52,
};

/** Where the JSON report the per-file check reads is written. */
export const ENGINES_JSON_REPORT = ".stryker-tmp/engines-mutation-report.json";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  ...baseConfig,
  reporters: ["html", "json", "clear-text", "progress"],
  vitest: {
    configFile: "vitest.stryker-engines.config.mts",
    related: false,
  },
  htmlReporter: {
    fileName: ".stryker-tmp/engines-mutation-report.html",
  },
  jsonReporter: {
    fileName: ENGINES_JSON_REPORT,
  },
  incrementalFile: "reports/stryker-engines-incremental.json",
  mutate: Object.keys(fileBreaks),
  // The per-file floors above are the real gate; this keeps Stryker's own
  // aggregate check no weaker than the lowest of them.
  thresholds: {
    high: 85,
    low: 52,
    break: 52,
  },
};

export default config;
