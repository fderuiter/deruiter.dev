#!/usr/bin/env bash
# Runs `npm run build` inside a cgroup shaped like Vercel's Hobby build
# machine: 2 cores, 8 GB of memory and no swap. GitHub's runners have 4 cores
# and 16 GB, which is how two out-of-memory failures on 2026-10-28 reached
# production before any check saw them (docs/how-to/release-and-deploy.md#build-memory).
#
# The build fails here the way it would on Vercel if it outgrows the limit,
# and it also fails when its kernel high-water memory (`memory.peak`) or
# sampled anonymous memory passes BUDGET_PERCENT of the limit, so the warning
# comes while there is still room to fix it.
#
# Exports VERCEL=1 with VERCEL_ENV unset so scripts/build.js skips TypeDoc just
# as Vercel builds do while keeping production migrations and preview/prod
# preflights off in CI.
#
# Needs cgroup v2 and passwordless sudo, as on GitHub's Ubuntu runners.
set -euo pipefail

export VERCEL=1
unset VERCEL_ENV

LIMIT_BYTES=$((8 * 1024 * 1024 * 1024))
CPUS="0-1"
BUDGET_PERCENT=85
CGROUP_ROOT="${CGROUP_ROOT:-/sys/fs/cgroup}"
CG="${CG:-$CGROUP_ROOT/vercel-shaped-build}"

SAMPLER=""
BUILD_PID=""
CG_CREATED=0
PEAK_FILE="$(mktemp)"

cleanup() {
  if [ -n "${BUILD_PID:-}" ]; then
    kill -TERM "$BUILD_PID" 2>/dev/null || true
    wait "$BUILD_PID" 2>/dev/null || true
    BUILD_PID=""
  fi
  if [ -n "${SAMPLER:-}" ]; then
    kill "$SAMPLER" 2>/dev/null || true
    wait "$SAMPLER" 2>/dev/null || true
    SAMPLER=""
  fi
  if [ -n "${PEAK_FILE:-}" ] && [ -e "$PEAK_FILE" ]; then
    rm -f "$PEAK_FILE"
  fi
  if [ "${CG_CREATED:-0}" -eq 1 ] && [ -d "$CG" ]; then
    if [ -f "$CG/cgroup.kill" ]; then
      echo 1 | sudo tee "$CG/cgroup.kill" >/dev/null 2>&1 || true
    fi
    sudo rmdir "$CG" 2>/dev/null || true
    CG_CREATED=0
  fi
}

handle_signal() {
  local sig="$1"
  cleanup
  trap - "$sig" EXIT
  kill -s "$sig" "$$"
}

trap cleanup EXIT
trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

if [ ! -f "$CGROUP_ROOT/cgroup.controllers" ]; then
  echo "::error::The Vercel-shaped build needs cgroup v2 ($CGROUP_ROOT/cgroup.controllers is missing)."
  exit 1
fi

for controller in cpuset memory; do
  if ! grep -qw "$controller" "$CGROUP_ROOT/cgroup.subtree_control"; then
    echo "+$controller" | sudo tee "$CGROUP_ROOT/cgroup.subtree_control" >/dev/null
  fi
done
sudo mkdir -p "$CG"
CG_CREATED=1
echo "$LIMIT_BYTES" | sudo tee "$CG/memory.max" >/dev/null
echo 0 | sudo tee "$CG/memory.swap.max" >/dev/null

CPUSET_MEMS="$(cat "$CGROUP_ROOT/cpuset.mems.effective" 2>/dev/null || true)"
if [ -z "$CPUSET_MEMS" ]; then
  CPUSET_MEMS="$(cat "$CGROUP_ROOT/cpuset.mems" 2>/dev/null || true)"
fi
CPUSET_MEMS="${CPUSET_MEMS:-0}"
echo "$CPUS" | sudo tee "$CG/cpuset.cpus" >/dev/null
echo "$CPUSET_MEMS" | sudo tee "$CG/cpuset.mems" >/dev/null

echo 0 >"$PEAK_FILE"
(
  peak=0
  while :; do
    anon=$(awk '$1 == "anon" { print $2 }' "$CG/memory.stat" 2>/dev/null || true)
    if [ -n "$anon" ] && [ "$anon" -gt "$peak" ]; then
      peak=$anon
      echo "$peak" >"$PEAK_FILE"
    fi
    sleep 1
  done
) &
SAMPLER=$!

echo "Building in $CG: cpus $CPUS, mems $CPUSET_MEMS, memory.max $LIMIT_BYTES bytes, no swap."
set +e
# The shell moves itself into the cgroup after cpuset.cpus and cpuset.mems are
# populated, then becomes the build, so the build and every process it starts
# run under the limit with VERCEL=1 and VERCEL_ENV unset.
bash -c 'echo $$ | sudo tee "$1/cgroup.procs" >/dev/null && exec npm run build' _ "$CG" &
BUILD_PID=$!
wait "$BUILD_PID"
status=$?
BUILD_PID=""
set -e

kill "$SAMPLER" 2>/dev/null || true
wait "$SAMPLER" 2>/dev/null || true
SAMPLER=""

gib() { awk -v b="$1" 'BEGIN { printf "%.2f", b / 1024 / 1024 / 1024 }'; }
peak_anon=$(cat "$PEAK_FILE" 2>/dev/null || echo 0)
peak_total=$(cat "$CG/memory.peak" 2>/dev/null || echo 0)
oom_kills=$(awk '$1 == "oom_kill" { print $2 }' "$CG/memory.events" 2>/dev/null || echo 0)
budget=$((LIMIT_BYTES * BUDGET_PERCENT / 100))

report="Vercel-shaped build: peak memory $(gib "$peak_total") GiB of 8 GiB (anon $(gib "$peak_anon") GiB, budget $(gib "$budget") GiB, ${BUDGET_PERCENT}%); OOM kills ${oom_kills:-0}; exit ${status}."
echo "$report"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "$report" >>"$GITHUB_STEP_SUMMARY"
fi

if [ "${oom_kills:-0}" -gt 0 ]; then
  echo "::error::The build ran out of memory under Vercel's 8 GB limit. Vercel's build would fail the same way."
  exit 1
fi
if [ "$status" -ne 0 ]; then
  exit "$status"
fi

effective_peak="${peak_total:-0}"
if [ "${peak_anon:-0}" -gt "$effective_peak" ]; then
  effective_peak="$peak_anon"
fi
if [ "$effective_peak" -gt "$budget" ]; then
  echo "::error::The build peaked at $(gib "$effective_peak") GiB (memory.peak $(gib "$peak_total") GiB, anon $(gib "$peak_anon") GiB), above ${BUDGET_PERCENT}% of Vercel's 8 GB build machine. Cut build memory before this reaches production."
  exit 1
fi
