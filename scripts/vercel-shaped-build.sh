#!/usr/bin/env bash
# Runs `npm run build` inside a cgroup shaped like Vercel's Hobby build
# machine: 2 cores, 8 GB of memory and no swap. GitHub's runners have 4 cores
# and 16 GB, which is how two out-of-memory failures on 2026-10-28 reached
# production before any check saw them (docs/how-to/release-and-deploy.md#build-memory).
#
# The build fails here the way it would on Vercel if it outgrows the limit,
# and it also fails when its peak anonymous memory passes BUDGET_PERCENT of
# the limit, so the warning comes while there is still room to fix it.
# Anonymous memory is what the build itself holds; the cgroup's page cache is
# reclaimed before the kernel kills anything, so it is reported, not judged.
#
# Needs cgroup v2 and passwordless sudo, as on GitHub's Ubuntu runners.
set -euo pipefail

LIMIT_BYTES=$((8 * 1024 * 1024 * 1024))
CPUS="0-1"
BUDGET_PERCENT=85
CG=/sys/fs/cgroup/vercel-shaped-build
PEAK_FILE="$(mktemp)"

if [ ! -f /sys/fs/cgroup/cgroup.controllers ]; then
  echo "::error::The Vercel-shaped build needs cgroup v2 (/sys/fs/cgroup/cgroup.controllers is missing)."
  exit 1
fi

for controller in cpuset memory; do
  if ! grep -qw "$controller" /sys/fs/cgroup/cgroup.subtree_control; then
    echo "+$controller" | sudo tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null
  fi
done
sudo mkdir -p "$CG"
echo "$LIMIT_BYTES" | sudo tee "$CG/memory.max" >/dev/null
echo 0 | sudo tee "$CG/memory.swap.max" >/dev/null
echo "$CPUS" | sudo tee "$CG/cpuset.cpus" >/dev/null

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

echo "Building in $CG: cpus $CPUS, memory.max $LIMIT_BYTES bytes, no swap."
set +e
# The shell moves itself into the cgroup, then becomes the build, so the build
# and every process it starts run under the limit with the job's environment.
bash -c 'echo $$ | sudo tee "$1/cgroup.procs" >/dev/null && exec npm run build' _ "$CG"
status=$?
set -e

kill "$SAMPLER" 2>/dev/null || true
wait "$SAMPLER" 2>/dev/null || true

gib() { awk -v b="$1" 'BEGIN { printf "%.2f", b / 1024 / 1024 / 1024 }'; }
peak_anon=$(cat "$PEAK_FILE")
peak_total=$(cat "$CG/memory.peak" 2>/dev/null || echo 0)
oom_kills=$(awk '$1 == "oom_kill" { print $2 }' "$CG/memory.events")
budget=$((LIMIT_BYTES * BUDGET_PERCENT / 100))

report="Vercel-shaped build: peak build memory $(gib "$peak_anon") GiB of 8 GiB (budget $(gib "$budget") GiB, ${BUDGET_PERCENT}%); peak including page cache $(gib "$peak_total") GiB; OOM kills ${oom_kills:-0}; exit ${status}."
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
if [ "$peak_anon" -gt "$budget" ]; then
  echo "::error::The build peaked at $(gib "$peak_anon") GiB, above ${BUDGET_PERCENT}% of Vercel's 8 GB build machine. Cut build memory before this reaches production."
  exit 1
fi
