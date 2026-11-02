# Refresh the win-ratio reference values

The win-ratio engine (`lib/study-data/internal/tlf/win-ratio.ts`) is checked
against numbers computed somewhere else. `scripts/r/win-ratio-reference.R`
builds seeded synthetic data sets, runs each through the CRAN package WINS
(`win.stat`, unadjusted, the variance of Dong et al.), computes the
Finkelstein-Schoenfeld test with its own R code written from the 1999
paper, and writes one JSON file per data set to
`__tests__/fixtures/study-data/win-ratio/`, and the device fixture to
`__tests__/fixtures/study-data/win-ratio-device/`.

`__tests__/study-data-win-ratio.test.ts` reads those files. Win and loss
counts must match exactly; estimates, confidence limits, z statistics and
p-values must match to a relative 1e-12. The test needs no R. R is only
needed when the fixtures change.

## When to refresh

- A fixture is added or its data changes.
- WINS publishes a new version and you want the fixtures to record it.

Changing the engine is not a reason to refresh. If the engine stops
matching, the engine is wrong until shown otherwise.

## Steps

`scripts/r/renv.lock` pins the R package set that reproduced every committed
fixture byte for byte on 2026-11-02: R 4.3.3, WINS 1.5.1, jsonlite 1.8.8 and
their dependencies, 94 packages in all (#3574).

1. Install R 4.3 and the GSL system library. On Ubuntu:

   ```bash
   apt-get install -y r-base-core r-cran-renv libgsl-dev
   ```

   Use R 4.3, the version the lockfile records. The pinned `gsl` 2.1-8 is the
   last release that builds on it: CRAN's current `gsl` needs R 4.5, and
   `renv` fetches 2.1-8 from the CRAN archive.

2. Restore the pinned packages into the project library
   (`scripts/r/renv/library/`, which Git ignores):

   ```bash
   (cd scripts/r && Rscript -e 'renv::restore(prompt = FALSE)')
   ```

3. Write the device fixture's input, the seeded TAVR versus SAVR study's Full
   Analysis Set (#3424):

   ```bash
   npx tsx scripts/win-ratio-device-input.ts
   ```

4. From the repository root, regenerate the fixtures with the pinned
   packages:

   ```bash
   Rscript -e 'renv::load("scripts/r"); source("scripts/r/win-ratio-reference.R")'
   ```

5. Run the parity tests and commit the fixtures with the change that needed
   them:

   ```bash
   npx vitest run __tests__/study-data-win-ratio.test.ts __tests__/study-data-device-win.test.ts
   ```

Each fixture records the R and WINS versions that produced it.

### Without renv

If `renv::restore()` can't run, install the packages from apt and CRAN into
a user library instead. The versions are then whatever those sources serve
that day, so check that the fixtures' recorded versions don't change.

```bash
apt-get install -y r-base-core libgsl-dev r-cran-ggpubr r-cran-viridis \
  r-cran-reshape2 r-cran-ggplot2 r-cran-stringr r-cran-survival r-cran-jsonlite
mkdir -p ~/Rlib
Rscript -e 'install.packages(c("copula", "WINS"), lib = "~/Rlib", repos = "https://cloud.r-project.org")'
R_LIBS_USER=~/Rlib Rscript scripts/r/win-ratio-reference.R
```

### Updating the pins

To record a newer WINS, install it into the renv project
(`renv::install("WINS")` with `renv::load("scripts/r")` active), regenerate
the fixtures, and run `renv::snapshot()` in `scripts/r` once the parity tests
pass. Commit the lockfile and the fixtures together.

## What the fixtures cover

| Fixture | Hierarchy | Exercises |
| --- | --- | --- |
| `cv-unstratified` | death, hospitalisation (times to event, 365-day horizon), quality-of-life change (5-point margin) | censoring, shared follow-up, a value set to the worst after death |
| `cv-stratified-mh` | the same data | three strata, Mantel-Haenszel-type weights |
| `cv-stratified-equal` | the same data | three strata, equal weights |
| `bp-fixed-window` | two binary events (0 is better), blood pressure change (lower is better, 5 mmHg margin) | no censoring, alpha 0.1 |
| `recovery-earlier-better` | time to recovery (earlier is better, 2-day margin, 60-day horizon) | margins on event times |
| `win-ratio-device/tavr-savr-stratified-mh` | death, disabling stroke, rehospitalisation (times to event), VSFS change (5-point margin) | the seeded device study's Full Analysis Set, two surgical-risk strata, Mantel-Haenszel-type weights, a missing 1-year score tied by a custom `win.strategy`, and pair-by-pair stratum counts |

The data are synthetic and say nothing about any treatment.
