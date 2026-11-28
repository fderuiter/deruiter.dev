#!/usr/bin/env bash
# Claude Code PreToolUse Hook Compatibility Wrapper
# Delegates to project root git safety guardrail script.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ ! -f "$ROOT_DIR/scripts/git-guardrail.sh" ]; then
  echo "BLOCKED: Git safety guardrail script not found at '$ROOT_DIR/scripts/git-guardrail.sh'." >&2
  exit 2
fi

if bash "$ROOT_DIR/scripts/git-guardrail.sh" "$@"; then
  exit 0
fi

exit 2
