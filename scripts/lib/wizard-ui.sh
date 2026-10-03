#!/usr/bin/env bash
# shellcheck shell=bash
#
# Presentation helpers shared by the repository's shell wizards. Source it;
# it defines functions only and changes nothing. Stage logic lives in the
# scripts that source it, so provider steps never duplicate this library.
#
# WIZARD_FD selects the output stream: 1 (default) or 2 when stdout is
# reserved for machine-readable output (--json).

WIZARD_FD="${WIZARD_FD:-1}"

if [[ -t "$WIZARD_FD" ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

_WIZARD_STAGE_INDEX=0
WIZARD_TOTAL_STAGES="${WIZARD_TOTAL_STAGES:-0}"

# banner "Title" "Subtitle" prints the opening frame.
wizard_banner() {
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET" >&"$WIZARD_FD"
  [[ -n "${2:-}" ]] && printf '%s  %s%s\n' "$DIM" "$2" "$RESET" >&"$WIZARD_FD"
  return 0
}

# wizard_stage "Name" announces the next stage with progress.
wizard_stage() {
  _WIZARD_STAGE_INDEX=$((_WIZARD_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_WIZARD_STAGE_INDEX" "$WIZARD_TOTAL_STAGES" "$1" "$RESET" >&"$WIZARD_FD"
}

wizard_say()  { printf '  %s\n' "$1" >&"$WIZARD_FD"; }
wizard_step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1" >&"$WIZARD_FD"; }
wizard_note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET" >&"$WIZARD_FD"; }
wizard_ok()   { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$1" >&"$WIZARD_FD"; }
wizard_warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET" >&"$WIZARD_FD"; }
wizard_fail() { printf '  %s✗ %s%s\n' "$RED" "$1" "$RESET" >&"$WIZARD_FD"; }

# wizard_command "cmd" prints a copyable command on its own line.
wizard_command() { printf '      %s%s%s\n' "$BOLD" "$1" "$RESET" >&"$WIZARD_FD"; }

# wizard_confirm "question" is a y/N gate; returns success on yes.
wizard_confirm() {
  local reply=""
  printf '  %s? %s [y/N]%s ' "$YELLOW" "$1" "$RESET" >&"$WIZARD_FD"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}
