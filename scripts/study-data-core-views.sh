#!/usr/bin/env bash
# Runs CDISC CORE over every exported view (#2992): SDTMIG 3.4 for the
# default run and each "Inject an issue" scenario, plus USDM 4.0 and ADaMIG
# 1.3 (or a skip note when CORE publishes no ADaMIG rules) for the default
# run, which is the only view whose USDM and ADaM differ from nothing.
#
# Usage: scripts/study-data-core-views.sh <core-dir> <python> <inputs> <reports> [jobs]
#   <core-dir>  a checkout of cdisc-org/cdisc-rules-engine at the pinned tag
#   <python>    the Python interpreter of the venv CORE is installed in
#   <inputs>    the folder `study-data-core.ts export-views` wrote
#   <reports>   where each view's reports are written, as <reports>/<view>/
#   [jobs]      how many SDTM runs at once (default 4)
#
# Each SDTM run takes about a minute and a half on one core, so the views
# run in parallel. Used by .github/workflows/study-data-core.yml and by the
# local refresh in docs/how-to/refresh-cdisc-core-findings.md.

set -euo pipefail

if [ "$#" -lt 4 ]; then
  sed -n '7,12p' "$0" >&2
  exit 2
fi

core_dir="$(cd "$1" && pwd)"
python="$2"
inputs="$(cd "$3" && pwd)"
mkdir -p "$4"
reports="$(cd "$4" && pwd)"
jobs="${5:-4}"

core() { (cd "$core_dir" && "$python" core.py "$@"); }
export -f core
export core_dir python inputs reports

sdtm() {
  local view="$1"
  local sdtm_dir="$inputs/$view/m5/datasets/tabulations/sdtm"
  mkdir -p "$reports/$view"
  if core validate -s sdtmig -v 3-4 -ft json \
    -d "$sdtm_dir" -dxp "$sdtm_dir/define.xml" \
    -o "$reports/$view/sdtm" -of json -p disabled \
    > "$reports/$view/sdtm.log" 2>&1; then
    echo "CORE SDTMIG 3.4: $view done"
  else
    echo "::error::CORE failed on the $view view; see $reports/$view/sdtm.log"
    cat "$reports/$view/sdtm.log" >&2
    return 1
  fi
}
export -f sdtm

find "$inputs" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort |
  xargs -P "$jobs" -I '{}' bash -c 'sdtm "$@"' _ '{}'

default_in="$inputs/default"
default_out="$reports/default"
core validate -s usdm -v 4-0 -ft json -d "$default_in/usdm" \
  -o "$default_out/usdm" -of json -p disabled
rules="$(core list-rules -s adamig -v 1-3 2>/dev/null | "$python" -c 'import json, sys; print(len(json.load(sys.stdin)))')"
if [ "$rules" = "0" ]; then
  echo "CDISC CORE publishes no ADaMIG 1.3 rules." > "$default_out/adam.skipped"
else
  core validate -s adamig -v 1-3 -ft json \
    -d "$default_in/m5/datasets/analysis/adam" \
    -dxp "$default_in/m5/datasets/analysis/adam/define.xml" \
    -o "$default_out/adam" -of json -p disabled
fi
