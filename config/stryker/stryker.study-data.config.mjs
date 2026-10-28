import engineConfig from "./stryker.engines.config.mjs";

// @ts-check
/**
 * #2607: the study data derivations' mutation run, weekly only.
 *
 * SDTM, ADaM and TLF derivations (`lib/study-data/internal/{sdtm,adam,tlf}`)
 * run in their own scope beside `stryker.engines.config.mjs` and
 * `stryker.garmin.config.mjs`, via `npm run test:mutation -- --study-data`
 * in `mutation-weekly.yml`.
 *
 * `fileBreaks` holds each file's floor: its measured score, floored. The
 * 2026-10-24 baseline was 80.65% over 1,891 mutants (adam/core 91.90,
 * where 91.06, km 88.26, subject-domains 83.05, stats 81.03, trial-design
 * 78.46, km-evaluate 76.27, adam/events 74.90, row-sets 69.57, evaluate
 * 65.09, adam/shared 64.15, row-ids 61.19, tables 56.90). sdtm/codelists.ts
 * holds only data, so Stryker finds nothing in it to mutate.
 * `scripts/run-mutation-tests.ts` fails the run when any file drops below
 * its floor. Raise a floor as survivors get killed; never lower one.
 */
export const fileBreaks = {
  "lib/study-data/internal/sdtm/subject-domains.ts": 83,
  "lib/study-data/internal/sdtm/trial-design.ts": 78,
  "lib/study-data/internal/adam/core.ts": 91,
  "lib/study-data/internal/adam/events.ts": 74,
  "lib/study-data/internal/adam/shared.ts": 64,
  "lib/study-data/internal/tlf/evaluate.ts": 65,
  "lib/study-data/internal/tlf/km.ts": 88,
  "lib/study-data/internal/tlf/km-evaluate.ts": 76,
  "lib/study-data/internal/tlf/stats.ts": 81,
  "lib/study-data/internal/tlf/tables.ts": 56,
  "lib/study-data/internal/tlf/where.ts": 91,
  "lib/study-data/internal/tlf/row-sets.ts": 69,
  "lib/study-data/internal/tlf/row-ids.ts": 61,
};

/** Where the JSON report the per-file check reads is written. */
export const ENGINES_JSON_REPORT =
  ".stryker-tmp/study-data-mutation-report.json";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  ...engineConfig,
  vitest: {
    configFile: "config/stryker/vitest.stryker-study-data.config.mts",
    related: false,
  },
  htmlReporter: {
    fileName: ".stryker-tmp/study-data-mutation-report.html",
  },
  jsonReporter: {
    fileName: ENGINES_JSON_REPORT,
  },
  incrementalFile: "reports/stryker-study-data-incremental.json",
  mutate: Object.keys(fileBreaks),
  thresholds: {
    high: 90,
    low: 80,
    break: 80,
  },
};

export default config;
