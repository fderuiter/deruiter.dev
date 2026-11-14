#!/usr/bin/env bash
# Runs CDISC CORE over every exported view (#2992): SDTMIG 3.4 for the
# default run and each "Inject an issue" scenario, plus USDM 4.0 and ADaMIG
# 1.3 (or a skip note when CORE publishes no ADaMIG rules) for the default
# run, which is the only view whose USDM and ADaM differ from nothing.
# Given an `export-crf` folder, it also runs USDM 4.0 over every CRF Studio
# preset's USDM export (#3051).
#
# Usage: scripts/study-data-core-views.sh <core-dir> <python> <inputs> <reports> [jobs] [<crf-inputs> <crf-reports>]
#   <core-dir>  a checkout of cdisc-org/cdisc-rules-engine at the pinned tag
#   <python>    the Python interpreter of the venv CORE is installed in
#   <inputs>    the folder `study-data-core.ts export-views` wrote
#   <reports>   where each view's reports are written, as <reports>/<view>/
#   [jobs]      how many SDTM runs at once (default 4)
#   <crf-inputs>  the folder `study-data-core.ts export-crf` wrote
#   <crf-reports> where each preset's report is written, as <crf-reports>/<preset>/
#
# Each SDTM run takes about a minute and a half on one core, so the views
# run in parallel. Used by .github/workflows/study-data-core.yml and by the
# local refresh in docs/how-to/refresh-cdisc-core-findings.md.

set -euo pipefail

if [ "$#" -lt 4 ]; then
  sed -n '9,16p' "$0" >&2
  exit 2
fi

core_dir="$(cd "$1" && pwd)"
python="$2"
inputs="$(cd "$3" && pwd)"
mkdir -p "$4"
reports="$(cd "$4" && pwd)"
jobs="${5:-4}"
crf_inputs="${6:-}"
crf_reports="${7:-}"
if [ -n "$crf_inputs" ] && [ -z "$crf_reports" ]; then
  echo "Name a reports folder for the CRF exports." >&2
  exit 2
fi

core() { (cd "$core_dir" && "$python" core.py "$@"); }

# CORE v1.0.0 keeps one cache in a multiprocessing manager, and its LRUCache
# is not thread-safe, so a rule now and then fails with "OrderedDict mutated
# during iteration" (#3869). That is the engine, not the data, and the
# recorded-findings comparison would read it as a changed finding. Every
# CORE run goes through this: it runs `core validate` with the given
# arguments, writing its log to <log>, and runs it again (three tries in
# all) while the JSON report at <report> carries that error. The inputs are
# the same each time, so a retry can never hide a data finding. A CORE exit
# failure is not retried; it prints the log and fails.
#
# Usage: validate_with_retry <label> <report> <log> <core validate args...>
validate_with_retry() {
  local label="$1" report="$2" log="$3"
  shift 3
  local attempt
  for attempt in 1 2 3; do
    if ! core validate "$@" > "$log" 2>&1; then
      echo "::error::CORE failed on $label; see $log"
      cat "$log" >&2
      return 1
    fi
    if ! grep -q 'mutated during iteration' "$report"; then
      echo "$label done"
      return 0
    fi
    echo "$label hit the engine's cache race (try $attempt of 3)"
  done
  echo "::error::CORE hit its cache race on $label three times (#3869)."
  return 1
}
export -f core validate_with_retry
export core_dir python inputs reports

sdtm() {
  local view="$1"
  local sdtm_dir="$inputs/$view/m5/datasets/tabulations/sdtm"
  mkdir -p "$reports/$view"
  # CORE reports a study-level rule against the first dataset it reads.
  # With -d that is directory order, which differs between machines, so
  # name the datasets in sorted order and the report keys stay the same.
  local paths=()
  while IFS= read -r file; do paths+=(-dp "$file"); done \
    < <(find "$sdtm_dir" -maxdepth 1 -name '*.json' | LC_ALL=C sort)
  validate_with_retry "CORE SDTMIG 3.4: $view" \
    "$reports/$view/sdtm.json" "$reports/$view/sdtm.log" \
    -s sdtmig -v 3-4 -ft json "${paths[@]}" -dxp "$sdtm_dir/define.xml" \
    -o "$reports/$view/sdtm" -of json -p disabled
}
export -f sdtm

find "$inputs" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort |
  xargs -P "$jobs" -I '{}' bash -c 'sdtm "$@"' _ '{}'

default_in="$inputs/default"
default_out="$reports/default"
mkdir -p "$default_out"
validate_with_retry "CORE USDM 4.0: default" \
  "$default_out/usdm.json" "$default_out/usdm.log" \
  -s usdm -v 4-0 -ft json -d "$default_in/usdm" \
  -o "$default_out/usdm" -of json -p disabled
rules="$(core list-rules -s adamig -v 1-3 2>/dev/null | "$python" -c 'import json, sys; print(len(json.load(sys.stdin)))')"
if [ "$rules" = "0" ]; then
  echo "CDISC CORE publishes no ADaMIG 1.3 rules." > "$default_out/adam.skipped"
else
  validate_with_retry "CORE ADaMIG 1.3: default" \
    "$default_out/adam.json" "$default_out/adam.log" \
    -s adamig -v 1-3 -ft json \
    -d "$default_in/m5/datasets/analysis/adam" \
    -dxp "$default_in/m5/datasets/analysis/adam/define.xml" \
    -o "$default_out/adam" -of json -p disabled
fi

if [ -n "$crf_inputs" ]; then
  crf_inputs="$(cd "$crf_inputs" && pwd)"
  mkdir -p "$crf_reports"
  crf_reports="$(cd "$crf_reports" && pwd)"
  for preset_dir in "$crf_inputs"/*/; do
    preset="$(basename "$preset_dir")"
    mkdir -p "$crf_reports/$preset"
    validate_with_retry "CORE USDM 4.0: CRF preset $preset" \
      "$crf_reports/$preset/usdm.json" "$crf_reports/$preset/usdm.log" \
      -s usdm -v 4-0 -ft json -d "$preset_dir/usdm" \
      -o "$crf_reports/$preset/usdm" -of json -p disabled
  done
fi
