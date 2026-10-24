import engineConfig from "./stryker.engines.config.mjs";

// @ts-check
/**
 * #2564: the Garmin engine's mutation run, weekly only.
 *
 * It has its own scope beside `stryker.engines.config.mjs` because its
 * mutants (about 4,500 with coverage, 4,259 in `engine.ts` alone) would
 * push the shared engine job past its time bound. `mutation-weekly.yml`
 * runs it as its own job, via `npm run test:mutation -- --garmin`.
 *
 * `fileBreaks` holds each file's floor: its measured score, floored.
 * `scripts/run-mutation-tests.ts` fails the run when any file drops below
 * its floor. Raise a floor as survivors get killed; never lower one.
 *
 * Measured 2026-10-24 (Vitest 5, Stryker 10.1.1): engine 51.85 (624 of
 * its 1,512 undetected mutants have no covering test), medals 61.02,
 * badges 84.50, splits 83.83, plan 87.03, race 90.08, second-wind 98.63,
 * body-battery 98.77. `engine.ts` and `medals.ts` are the ratchet's
 * backlog.
 */
export const fileBreaks = {
  "lib/garmin/engine.ts": 51,
  "lib/garmin/medals.ts": 61,
  "lib/garmin/badges.ts": 84,
  "lib/garmin/splits.ts": 83,
  "lib/garmin/plan.ts": 87,
  "lib/garmin/race.ts": 90,
  "lib/garmin/second-wind.ts": 98,
  "lib/garmin/body-battery.ts": 98,
};

/** Where the JSON report the per-file check reads is written. */
export const ENGINES_JSON_REPORT = ".stryker-tmp/garmin-mutation-report.json";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  ...engineConfig,
  vitest: {
    configFile: "vitest.stryker-garmin.config.mts",
    related: false,
  },
  htmlReporter: {
    fileName: ".stryker-tmp/garmin-mutation-report.html",
  },
  jsonReporter: {
    fileName: ENGINES_JSON_REPORT,
  },
  incrementalFile: "reports/stryker-garmin-incremental.json",
  mutate: Object.keys(fileBreaks),
  // The per-file floors above are the real gate; this keeps Stryker's own
  // aggregate check no weaker than the lowest of them.
  thresholds: {
    high: 85,
    low: 51,
    break: 51,
  },
};

export default config;
