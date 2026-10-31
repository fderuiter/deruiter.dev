# Refresh the recorded CDISC CORE findings

The Study Data Pipeline does not grade its own homework. The open-source
CDISC Rules Engine (CORE) validates the default run and every "Inject an
issue" scenario, 17 views in all, and its findings are committed in
`lib/study-data/internal/core/recorded-findings.json` (#2992). It also runs
CORE's USDM 4.0 rules over the USDM export of every CRF Studio preset
(#3051), and records those findings in the same file. The site
reads that file. Nothing runs CORE at request time.

The file is generated. Never edit it by hand.

The Study Data page shows these findings on its conformance stage, but only
for a run CORE actually saw: the default study at the default seed and
subject count, with or without one injected issue. Any other run says that
only the local rules checked it.

## When it goes stale

Two checks tell you the file no longer matches the code:

- `__tests__/study-data-core-recorded.test.ts`, in the ordinary unit suite,
  fingerprints the SDTM Dataset-JSON and Define-XML of every view, and the
  USDM export of every CRF Studio preset, and fails when one differs from
  the fingerprint recorded with the findings. It needs
  no Python, so it fails fast, locally and in `ci.yml`.
- The `Study Data CDISC CORE` workflow (`.github/workflows/study-data-core.yml`)
  runs CORE over every view and every preset export, regenerates the file
  and fails when it differs from the committed one. It runs on pull
  requests that touch `lib/study-data/**`, `lib/crf/**`,
  `lib/clinical-standards/**` or its own scripts,
  on `main`, and weekly. On `main` it catches two PRs that each matched
  the file on their own branch but not once both were merged (#3189): the
  failed run's summary names the refresh, which a fix PR commits.

Any change to the generator, a scenario, a domain or the Define-XML moves
the fingerprints, so a PR that changes study data output refreshes this file
in the same PR. So does a PR that changes what CRF Studio's USDM export
writes for any preset: the adapter, a preset, or the domain templates.

## Refresh from CI (no local setup)

1. Push the change. The `Study Data CDISC CORE` workflow fails at **Check the
   Recorded Findings Are Current**.
2. Open the run's summary and download the
   `study-data-core-recorded-findings` artifact.
3. Unzip it over `lib/study-data/internal/core/recorded-findings.json`,
   review the diff and commit it.

Read the diff before you commit. A finding added to the default view is a
new defect in the pipeline's output, or a CORE change: fix the output, or
explain it in `scripts/study-data-core-allowlist.json`, which the same
workflow reconciles. Preset findings are explained by `crf-usdm` entries,
which may name the `presets` they cover; an entry fails as stale on any
preset it covers that no longer reports it. A scenario that loses all its added findings is a
planted defect CORE no longer sees.

## Refresh locally

CORE needs Python 3.12 (3.13 is refused) and about a minute and a half per
view on one core.

```bash
CORE_TAG=v0.17.1   # read both from .github/workflows/study-data-core.yml
CORE_COMMIT=2a90a3872a7e3b07c15abe84744026c94a7a04b0
work="$(mktemp -d)"
git clone --quiet --depth 1 --branch "$CORE_TAG" \
  https://github.com/cdisc-org/cdisc-rules-engine.git "$work/core"
test "$(git -C "$work/core" rev-parse HEAD)" = "$CORE_COMMIT"
python3.12 -m venv "$work/venv"
"$work/venv/bin/pip" install --quiet \
  -c scripts/study-data-core-constraints.txt "$work/core"

ct="$(ls "$work/core/resources/cache" | sed -n 's/^sdtmct-\(.*\)\.pkl$/\1/p' | sort | tail -n 1)"
npx tsx scripts/study-data-core.ts export-views "$work/in" --ct-version "$ct"
scripts/study-data-core-views.sh "$work/core" "$work/venv/bin/python" \
  "$work/in" "$work/reports" 4
npx tsx scripts/study-data-core.ts export-crf "$work/crf-in" --ct-version "$ct"
scripts/study-data-core-views.sh "$work/core" "$work/venv/bin/python" \
  "$work/in" "$work/reports" 4 "$work/crf-in" "$work/crf-reports"
npx tsx scripts/study-data-core.ts reconcile \
  "$work/in/default" "$work/reports/default" --engine "CDISC CORE $CORE_TAG"
npx tsx scripts/study-data-core.ts reconcile-crf \
  "$work/crf-in" "$work/crf-reports" --engine "CDISC CORE $CORE_TAG"
npx tsx scripts/study-data-core.ts record "$work/in" "$work/reports" \
  --core-tag "$CORE_TAG" --core-commit "$CORE_COMMIT" \
  --crf-inputs "$work/crf-in" --crf-reports "$work/crf-reports"
```

`reconcile` exits non-zero when a default-view finding is not explained by
the allowlist, and `reconcile-crf` does the same for the preset exports.
`record` rewrites the committed file.

## After editing the allowlist or the crosswalk

The file also carries the allowlist's reason for each accepted finding and
the crosswalk's CORE twins for each local rule, because the page shows both.
After changing `scripts/study-data-core-allowlist.json` or
`scripts/study-data-core-crosswalk.json`, copy them in without running CORE:

```bash
npx tsx scripts/study-data-core.ts annotate
```

`__tests__/study-data-core-recorded.test.ts` fails until you do.

## What the file holds

- `lock`: the CORE tag and commit, the standards each target ran against,
  and the controlled terminology release the pipeline declares beside the
  one CORE validated against (CORE's cache can lag the declared release).
- `rules`: every SDTMIG 3.4 and USDM 4.0 rule CORE ran on the default view,
  with its outcome (`SUCCESS`, `ISSUE REPORTED`, `SKIPPED` when it does not
  apply, or `EXECUTION ERROR`), the CDISC and FDA rule ids it cites and its
  message.
- `explained`: the allowlist's category, reason and tracking issue for each
  accepted SDTM and USDM finding on the default view, by `CORE-id dataset`.
- `twins`: each local SD- rule the crosswalk measured CORE to catch, with
  the CORE rules and whether they report the defect itself or a
  consequence of it.
- `views.default`: every finding, one line each: CORE rule, dataset, record
  (`USUBJID#SEQ`) and the variables with the values CORE saw.
- `views.<scenario>`: the findings the scenario adds and removes against the
  default view, and the rules whose outcome it changes. Scenarios change
  collected data only, so they are validated against SDTMIG and nothing else.
  A scenario that puts a value outside a non-extensible codelist cannot be
  described by Define-XML, so its data is validated against the default
  run's Define-XML, the planned metadata.
- `crf.<preset>`: every USDM finding on that CRF Studio preset's export,
  its fingerprint, and the rules whose outcome differs from the pipeline's
  USDM fixture. Presets build fixed ids (`PRESET_ID_STAMP`), so the export
  is the same on every run.

ADaM is reported as not run while CORE publishes no ADaMIG rules.
