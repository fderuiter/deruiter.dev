#!/usr/bin/env bash
#
# Fresh-clone setup for deruiter.dev. Run it from anywhere:
#
#   ./scripts/setup.sh            # guided, for a person at a terminal
#   ./scripts/setup.sh --help     # every flag
#
# This script owns the stages that must run before Node.js dependencies
# exist (platform, toolchain, dependencies), then hands over to
# `npm run setup` (lib/dx/setup.ts) for the environment profile,
# integrations, database and verification. It installs nothing system-wide:
# when a tool is missing it prints the command to install it and stops.
# It never prints a credential value.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Usage: ./scripts/setup.sh [options]

Stages: platform, toolchain, dependencies (this script), then lockfile,
environment, integrations, database and verification (npm run setup).

Options:
  --help                 Show this help and exit.
  --yes, -y              No prompts; accept each question's safe default.
                         Never publishes credentials and never mutates a
                         hosted or production database.
  --non-interactive      No prompts; decline every optional step.
  --dry-run              Report what would change; write and run nothing.
  --resume               Skip stages that completed in an earlier run.
  --profile NAME         local-minimal (default), hosted-development or
                         deployment.
  --skip-db              Skip Prisma generation, schema and seed.
  --skip-db-seed         Skip loading sample data.
  --skip-integrations    Leave every optional integration in degraded mode.
  --integrations LIST    Configure these adapters, e.g. clerk,resend.
  --apply-schema         Apply the schema without asking.
  --seed                 Load sample data without asking.
  --allow-production-db HOST
                         Allow schema and seed on HOST despite production
                         markers; you still type the host to confirm.
  --verify [LIST]        Run checks: static, env, prisma, db, providers,
                         doctor, quality. A bare flag runs all of them.
  --publish github|vercel --publish-env ENV
                         Offer to publish integration values (asks first).
  --force-env            Back up .env.local, then replace it with the
                         template.
  --json                 Print one JSON summary on stdout; progress goes to
                         stderr.

Exit codes: 0 done, 1 a stage failed, 2 done with manual steps pending,
130 cancelled. Progress is kept in .setup-state.json (no secrets).
EOF
}

YES=0; NON_INTERACTIVE=0; DRY_RUN=0; JSON=0
for arg in ${1+"$@"}; do
  case "$arg" in
    --help | -h) usage; exit 0 ;;
    --yes | -y) YES=1 ;;
    --non-interactive) NON_INTERACTIVE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --json) JSON=1 ;;
  esac
done

if ((JSON)); then WIZARD_FD=2; else WIZARD_FD=1; fi
export WIZARD_FD
WIZARD_TOTAL_STAGES=3
# shellcheck source=scripts/lib/wizard-ui.sh
. "$ROOT/scripts/lib/wizard-ui.sh"
# shellcheck source=scripts/lib/setup-checks.sh
. "$ROOT/scripts/lib/setup-checks.sh"

INTERACTIVE=1
if ((YES || NON_INTERACTIVE || JSON)) || [[ -n "${CI:-}" ]] || [[ ! -t 0 ]]; then
  INTERACTIVE=0
fi

STAGES=()   # id=status=detail, joined with ";" for npm run setup
record() { STAGES+=("$1=$2=${3//;/,}"); }

# stop prints the summary for a run that ends inside this script.
stop() {
  local code="$1" entry id status detail first=1
  if ((JSON)); then
    printf '{"success":%s,"command":"setup","data":{"stages":[' "$( ((code == 0)) && echo true || echo false )"
    for entry in "${STAGES[@]}"; do
      id="${entry%%=*}"; status="${entry#*=}"; detail="${status#*=}"; status="${status%%=*}"
      ((first)) || printf ','
      first=0
      printf '{"id":"%s","status":"%s","detail":"%s"}' "$id" "$status" "$(setup_json_escape "$detail")"
    done
    printf ']}}\n'
  elif ((code == 0)); then
    wizard_say ""
    wizard_ok "Dry run finished. Install dependencies to preview the remaining stages."
  else
    wizard_say ""
    wizard_fail "Setup stopped. Fix the step above, then rerun ./scripts/setup.sh --resume."
  fi
  exit "$code"
}

trap 'record "${CURRENT_STAGE:-platform}" cancelled "Cancelled by the user."; stop 130' INT

wizard_banner "deruiter.dev setup" "Toolchain, dependencies, environment, database and checks."

# ── Stage 1: platform ───────────────────────────────────────────────────
CURRENT_STAGE=platform
wizard_stage "Platform"
OS="$(setup_detect_os)"
FAMILY="other"
[[ "$OS" == linux || "$OS" == wsl ]] && FAMILY="$(setup_detect_linux_family)"
INSTALLERS="$(setup_detect_installers)"
wizard_say "OS: $OS ($(uname -m 2>/dev/null || echo unknown)), shell: bash ${BASH_VERSION%%(*}"
wizard_say "Installers found: $INSTALLERS"
((INTERACTIVE)) || wizard_note "Running without prompts."
if [[ "$OS" == windows ]]; then
  wizard_fail "Native Windows shells are not supported; scripts, hooks and tests need a POSIX environment."
  wizard_say "Install WSL 2, then clone and run setup inside Ubuntu:"
  wizard_command "wsl --install -d Ubuntu"
  record platform failed "Native Windows is unsupported; use WSL 2."
  stop 1
fi
record platform completed "$OS on $(uname -m 2>/dev/null || echo unknown)."

# ── Stage 2: toolchain ──────────────────────────────────────────────────
CURRENT_STAGE=toolchain
wizard_stage "Toolchain"
NODE_RANGE="$(setup_read_engine node package.json)"
NPM_RANGE="$(setup_read_engine npm package.json)"
PACKAGE_MANAGER="$(setup_read_package_manager package.json)"
NODE_MAJOR="$(setup_recommended_node_major "$NODE_RANGE")"
PROBLEMS=()

if command -v git >/dev/null 2>&1; then
  wizard_ok "git $(git --version | awk '{print $3}')"
else
  wizard_fail "git is not installed."
  wizard_say "Install it with:"
  wizard_command "$(setup_remedy_git "$OS" "$FAMILY")"
  PROBLEMS+=("git missing")
fi

if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node --version)"
  if setup_satisfies_range "$NODE_VERSION" "$NODE_RANGE"; then
    wizard_ok "Node.js $NODE_VERSION satisfies $NODE_RANGE"
  else
    wizard_fail "Node.js $NODE_VERSION does not satisfy $NODE_RANGE (package.json engines.node)."
    PROBLEMS+=("Node.js $NODE_VERSION outside $NODE_RANGE")
  fi
else
  wizard_fail "Node.js is not installed."
  PROBLEMS+=("Node.js missing")
fi
if [[ " ${PROBLEMS[*]-} " == *"Node.js"* ]]; then
  wizard_say "Install Node.js $NODE_MAJOR with one of:"
  while IFS= read -r line; do wizard_command "$line"; done < <(setup_remedy_node "$OS" "$FAMILY" "$NODE_MAJOR")
fi

if command -v npm >/dev/null 2>&1; then
  NPM_VERSION="$(npm --version)"
  if setup_satisfies_range "$NPM_VERSION" "$NPM_RANGE"; then
    wizard_ok "npm $NPM_VERSION satisfies $NPM_RANGE"
  else
    wizard_fail "npm $NPM_VERSION does not satisfy $NPM_RANGE (package.json engines.npm)."
    wizard_command "npm install -g ${PACKAGE_MANAGER:-npm@latest}"
    PROBLEMS+=("npm $NPM_VERSION outside $NPM_RANGE")
  fi
  if [[ "$PACKAGE_MANAGER" != npm@* ]]; then
    wizard_fail "package.json packageManager is \"$PACKAGE_MANAGER\"; this repository supports npm only."
    PROBLEMS+=("packageManager is not npm")
  elif [[ "npm@$NPM_VERSION" != "$PACKAGE_MANAGER" ]]; then
    wizard_warn "packageManager pins $PACKAGE_MANAGER; you have npm $NPM_VERSION. To match CI exactly:"
    wizard_command "npm install -g $PACKAGE_MANAGER"
  fi
elif command -v node >/dev/null 2>&1; then
  wizard_fail "npm is missing although Node.js is installed."
  wizard_command "npm install -g ${PACKAGE_MANAGER:-npm@latest}    # or reinstall Node.js"
  PROBLEMS+=("npm missing")
fi

if ((${#PROBLEMS[@]} > 0)); then
  record toolchain failed "$(IFS=';'; echo "${PROBLEMS[*]}")"
  stop 1
fi
record toolchain completed "git, Node.js $NODE_VERSION and npm $NPM_VERSION."

# ── Stage 3: dependencies ───────────────────────────────────────────────
CURRENT_STAGE=dependencies
wizard_stage "Dependencies"
INSTALLED_MARKER="node_modules/.package-lock.json"
DEPS_STATUS=""; DEPS_DETAIL=""
if [[ -L node_modules ]]; then
  # npm ci empties node_modules before installing, and through a symlink
  # that wipes the shared install every other checkout points at.
  wizard_warn "node_modules is a symlink to a shared install; leaving it alone instead of running npm ci."
  DEPS_STATUS=skipped; DEPS_DETAIL="node_modules is a symlink, so npm ci was not run."
elif [[ -f "$INSTALLED_MARKER" && "$INSTALLED_MARKER" -nt package-lock.json && "$INSTALLED_MARKER" -nt package.json ]]; then
  wizard_ok "node_modules is up to date with package-lock.json."
  DEPS_STATUS=completed; DEPS_DETAIL="Already installed."
elif ((DRY_RUN)); then
  wizard_note "Dry run: would run npm ci."
  DEPS_STATUS=skipped; DEPS_DETAIL="Dry run: would run npm ci."
else
  wizard_say "Installing exactly what package-lock.json records (npm ci)..."
  if npm ci >&"$WIZARD_FD"; then
    DEPS_STATUS=completed; DEPS_DETAIL="npm ci finished."
  else
    wizard_fail "npm ci failed. It needs package.json and package-lock.json to agree."
    if ((INTERACTIVE)) && wizard_confirm "Fall back to npm install? It may rewrite package-lock.json."; then
      if npm install >&"$WIZARD_FD"; then
        wizard_warn "npm install changed the lockfile; review git diff package-lock.json before committing."
        DEPS_STATUS=completed; DEPS_DETAIL="npm install fallback (lockfile may have changed)."
      else
        DEPS_STATUS=failed; DEPS_DETAIL="npm ci and npm install both failed."
      fi
    else
      wizard_say "Fix the lockfile mismatch, or run npm install yourself, then rerun setup."
      DEPS_STATUS=failed; DEPS_DETAIL="npm ci failed and the npm install fallback was not confirmed."
    fi
  fi
fi

if [[ "$DEPS_STATUS" != failed && ! -x node_modules/.bin/tsx ]]; then
  if ((DRY_RUN)); then
    wizard_note "Dependencies are not installed, so a dry run cannot preview the remaining stages."
    record dependencies "$DEPS_STATUS" "$DEPS_DETAIL"
    stop 0
  fi
  wizard_fail "node_modules/.bin/tsx is missing, so the remaining stages cannot run."
  DEPS_STATUS=failed; DEPS_DETAIL="$DEPS_DETAIL node_modules/.bin/tsx is missing."
fi
record dependencies "$DEPS_STATUS" "$DEPS_DETAIL"
[[ "$DEPS_STATUS" == failed ]] && stop 1

# ── Hand-off to the TypeScript setup framework ──────────────────────────
SHELL_STAGES="$(IFS=';'; echo "${STAGES[*]}")"
trap - INT
exec node_modules/.bin/tsx scripts/dx.ts setup ${1+"$@"} --shell-stages "$SHELL_STAGES"
