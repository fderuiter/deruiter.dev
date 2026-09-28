#!/usr/bin/env bash
# Git & Deploy Safety Guardrail Interceptor
# Intercepts destructive git and deploy operations across AI agent runners and CLI sessions.
# Bypass with: ALLOW_DANGEROUS_GIT=1 <command>
#
# Matching is per-segment and anchored to each segment's leading program. Grepping
# for a pattern, echoing one as an example, or asserting on one in a test is not the
# operation itself, and a guard that cannot be inspected or tested is one operators
# learn to bypass reflexively.

set -euo pipefail

# 1. Check for intentional bypass flag
if [ "${ALLOW_DANGEROUS_GIT:-0}" = "1" ]; then
  exit 0
fi

# 2. Capture command from arguments or stdin
COMMAND=""
if [ "$#" -gt 0 ]; then
  COMMAND="$*"
else
  # Read stdin if available
  if [ ! -t 0 ]; then
    INPUT=$(cat)
    # Check if input is a JSON payload from an agent tool runner (e.g. Claude Code or generic tool calls)
    if echo "$INPUT" | grep -q '"tool_input"'; then
      if command -v jq >/dev/null 2>&1; then
        COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
      fi
      # Fallback to regex extraction if jq is unavailable or didn't match
      if [ -z "$COMMAND" ]; then
        COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/"command"[[:space:]]*:[[:space:]]*"([^"]*)"/\1/' || true)
      fi
    else
      COMMAND="$INPUT"
    fi
  fi
fi

# If no command found, allow execution
if [ -z "$COMMAND" ]; then
  exit 0
fi

# 3. Dangerous patterns, grouped by the program they apply to.
#
# The bulk-discard forms below are anchored to end-of-segment. Unanchored, the
# `-- .` alternative also matched every precise single-file restore of a dotfile,
# which is the careful operation rather than the dangerous one.
GIT_PATTERNS=(
  "^git[[:space:]]+push.*[[:space:]](--force-with-lease(=[^[:space:]]+)?|--force|-f)([[:space:]]|$)"
  "^git[[:space:]]+push.*[[:space:]]([a-zA-Z0-9_-]+[[:space:]]+)?main([[:space:]]|$)"
  "^git[[:space:]]+push.*:main([[:space:]]|$)"
  "^git[[:space:]]+reset[[:space:]]+--hard"
  "^git[[:space:]]+clean[[:space:]]+.*-f"
  "^git[[:space:]]+branch[[:space:]]+.*-D"
  "^git[[:space:]]+checkout[[:space:]]+(\.[[:space:]]*$|--[[:space:]]+\.[[:space:]]*$)"
  "^git[[:space:]]+restore[[:space:]]+(\.[[:space:]]*$|--staged[[:space:]]+\.[[:space:]]*$)"
)

# Until an approved replacement release policy is verified, Production must
# start in the Vercel Dashboard. Keep the CLI guard active under CI too; no repository workflow
# owns the manual Production button action (ADR 0051).
DEPLOY_PATTERNS=(
  "^vercel[[:space:]]+.*deploy.*[[:space:]]--prebuilt([[:space:]]|$)"
  "^vercel([[:space:]]|$).*--prod([[:space:]]|$)"
  "^vercel[[:space:]]+promote([[:space:]]|$)"
)
DEPLOY_REASONS=(
  "--prebuilt ships a locally built artifact without rebuilding. A build whose data source was unreachable still exits 0 and bakes fallback content into every page. For Preview, run an ordinary remote build with npx vercel deploy; during the manual-release hold, start Production in Vercel Dashboard → Deployments → Create Deployment from the current main SHA."
  "Production deployments are Dashboard-only until an approved replacement release policy is verified (ADR 0051; issue #1168). After CI passes, use Vercel Dashboard → Deployments → Create Deployment and select the current main SHA."
  "Production promotion is Dashboard-only until an approved replacement release policy is verified (ADR 0051; issue #1168). Use Vercel Dashboard → Deployments → Create Deployment and select the current main SHA."
)

# Other consequential provider operations are skipped under CI, where
# automation carries its own verification.
if [ "${CI:-}" != "true" ]; then
  DEPLOY_PATTERNS+=("^vercel[[:space:]]+env[[:space:]]+rm([[:space:]]|$)")
  DEPLOY_REASONS+=("Removing a Vercel environment variable is hard to undo and can break production at the next cold start.")

  DEPLOY_PATTERNS+=("^vercel[[:space:]]+domains[[:space:]]+rm([[:space:]]|$)")
  DEPLOY_REASONS+=("Removing a domain detaches production traffic and its certificate.")

  DEPLOY_PATTERNS+=("^prisma[[:space:]]+migrate[[:space:]]+deploy([[:space:]]|$)")
  DEPLOY_REASONS+=("Nothing here distinguishes the production database from a disposable branch at the moment of running it. Confirm the resolved host first.")
fi

# 4. Resolve each segment's leading program, then match only patterns that apply to it.
block() {
  echo "BLOCKED: $1" >&2
  echo "Segment: '$2'" >&2
  echo "Reason: $3" >&2
  echo "To bypass intentionally, set ALLOW_DANGEROUS_GIT=1 before executing." >&2
  exit 2
}

# Quoted spans are data, not commands. A message, an example in a script, or a
# test fixture may legitimately contain a separator followed by a real program
# name; matching that text would block the inspection rather than the operation.
# Backticks count as quoting: commit messages and markdown use them constantly,
# and this guard blocked its own commit message before they were stripped.
MATCH_TARGET=$(printf '%s' "$COMMAND" | sed -E "s/\`[^\`]*\`//g; s/'[^']*'//g; s/\"[^\"]*\"//g")

SEGMENTS=$(printf '%s\n' "$MATCH_TARGET" | awk '{gsub(/\|\||&&|;|\|/, "\n"); print}')

while IFS= read -r segment; do
  [ -z "${segment//[[:space:]]/}" ] && continue

  # Trim, drop leading environment assignments and package-runner prefixes so the
  # leading program is the one that actually executes.
  read -r -a tokens <<< "$segment" || true
  idx=0
  program=""
  while [ "$idx" -lt "${#tokens[@]}" ]; do
    token="${tokens[$idx]}"
    case "$token" in
      [A-Za-z_]*=*) idx=$((idx + 1)); continue ;;
      npx|bunx|pnpm|yarn|command|sudo) idx=$((idx + 1)); continue ;;
    esac
    program="${token##*/}"
    break
  done
  [ -z "$program" ] && continue

  # Re-form the segment from its leading program so the anchored patterns apply.
  normalized="${tokens[*]:$idx}"

  if [ "$program" = "git" ]; then
    for pattern in "${GIT_PATTERNS[@]}"; do
      if echo "$normalized" | grep -qE "$pattern"; then
        block "Destructive git operation intercepted: '$COMMAND'" "$normalized" \
          "Command matches safety guardrail pattern '$pattern'."
      fi
    done
  fi

  if [ "$program" = "vercel" ] || [ "$program" = "prisma" ]; then
    i=0
    while [ "$i" -lt "${#DEPLOY_PATTERNS[@]}" ]; do
      if echo "$normalized" | grep -qE "${DEPLOY_PATTERNS[$i]}"; then
        block "Consequential deploy operation intercepted: '$COMMAND'" "$normalized" \
          "${DEPLOY_REASONS[$i]}"
      fi
      i=$((i + 1))
    done
  fi
done <<< "$SEGMENTS"

exit 0
