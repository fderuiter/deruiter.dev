# Refresh the win-ratio reference values

The win-ratio engine (`lib/study-data/internal/tlf/win-ratio.ts`) is checked
against numbers computed somewhere else. `scripts/r/win-ratio-reference.R`
builds seeded synthetic data sets, runs each through the CRAN package WINS
(`win.stat`, unadjusted, the variance of Dong et al.), computes the
Finkelstein-Schoenfeld test with its own R code written from the 1999
paper, and writes one JSON file per data set to
`__tests__/fixtures/study-data/win-ratio/`.

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

1. Install R 4.3 or later. On Ubuntu:

   ```bash
   apt-get install -y r-base-core libgsl-dev r-cran-ggpubr r-cran-viridis \
     r-cran-reshape2 r-cran-ggplot2 r-cran-stringr r-cran-survival r-cran-jsonlite
   ```

2. Install WINS and its remaining dependency into a user library:

   ```bash
   mkdir -p ~/Rlib
   Rscript -e 'install.packages(c("copula", "WINS"), lib = "~/Rlib", repos = "https://cloud.r-project.org")'
   ```

3. From the repository root, regenerate the fixtures:

   ```bash
   R_LIBS_USER=~/Rlib Rscript scripts/r/win-ratio-reference.R
   ```

4. Run the parity test and commit the fixtures with the change that needed
   them:

   ```bash
   npx vitest run __tests__/study-data-win-ratio.test.ts
   ```

Each fixture records the R and WINS versions that produced it.

## What the fixtures cover

| Fixture | Hierarchy | Exercises |
| --- | --- | --- |
| `cv-unstratified` | death, hospitalisation (times to event, 365-day horizon), quality-of-life change (5-point margin) | censoring, shared follow-up, a value set to the worst after death |
| `cv-stratified-mh` | the same data | three strata, Mantel-Haenszel-type weights |
| `cv-stratified-equal` | the same data | three strata, equal weights |
| `bp-fixed-window` | two binary events (0 is better), blood pressure change (lower is better, 5 mmHg margin) | no censoring, alpha 0.1 |
| `recovery-earlier-better` | time to recovery (earlier is better, 2-day margin, 60-day horizon) | margins on event times |

The data are synthetic and say nothing about any treatment.
