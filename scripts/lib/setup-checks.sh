#!/usr/bin/env bash
# shellcheck shell=bash
#
# Pure checks for scripts/setup.sh: version ranges, platform detection and
# remediation text. Source it; nothing here installs or changes anything.
# setup_satisfies_range implements the same grammar as
# satisfiesVersionRange in lib/dx/preflight.ts, and a test runs both on the
# same cases.

# setup_version_compare A B prints -1, 0 or 1. Missing parts count as 0 and
# a pre-release suffix is ignored.
setup_version_compare() {
  local a="${1#v}" b="${2#v}" i x y
  local -a left right
  IFS=. read -r -a left <<<"$a"
  IFS=. read -r -a right <<<"$b"
  for i in 0 1 2; do
    x="${left[i]:-0}"; y="${right[i]:-0}"
    x="${x%%[!0-9]*}"; y="${y%%[!0-9]*}"
    x="${x:-0}"; y="${y:-0}"
    if ((10#$x > 10#$y)); then echo 1; return; fi
    if ((10#$x < 10#$y)); then echo -1; return; fi
  done
  echo 0
}

# _setup_bump MAJOR MINOR PATCH INDEX prints the version with part INDEX
# incremented and every later part zeroed.
_setup_bump() {
  local -a parts=("$1" "$2" "$3")
  local index="$4" later
  parts[index]=$((parts[index] + 1))
  for ((later = index + 1; later < 3; later++)); do parts[later]=0; done
  echo "${parts[0]}.${parts[1]}.${parts[2]}"
}

# _setup_holds VERSION OP BOUND succeeds when VERSION OP BOUND holds.
_setup_holds() {
  local cmp
  cmp=$(setup_version_compare "$1" "$3")
  case "$2" in
    ">=") ((cmp >= 0)) ;;
    ">") ((cmp > 0)) ;;
    "<=") ((cmp <= 0)) ;;
    "<") ((cmp < 0)) ;;
    *) ((cmp == 0)) ;;
  esac
}

# _setup_comparator_holds VERSION COMPARATOR desugars one comparator the
# way npm semver does (x-ranges, ^ and ~) and checks it.
_setup_comparator_holds() {
  local actual="$1" comparator="$2" op given keep
  local pattern='^(>=|<=|>|<|=|\^|~)?v?([0-9]+|[xX*])(\.([0-9]+|[xX*]))?(\.([0-9]+|[xX*]))?$'
  [[ "$comparator" =~ $pattern ]] || return 1
  op="${BASH_REMATCH[1]}"
  local -a raw=("${BASH_REMATCH[2]}" "${BASH_REMATCH[4]}" "${BASH_REMATCH[6]}")
  local -a low=(0 0 0)
  given=0
  while ((given < 3)) && [[ "${raw[given]}" =~ ^[0-9]+$ ]]; do
    low[given]=$((10#${raw[given]}))
    given=$((given + 1))
  done
  ((given == 0)) && return 0
  local lower="${low[0]}.${low[1]}.${low[2]}" upper
  upper=$(_setup_bump "${low[0]}" "${low[1]}" "${low[2]}" $((given - 1)))
  case "$op" in
    ">=") _setup_holds "$actual" ">=" "$lower" ;;
    "<") _setup_holds "$actual" "<" "$lower" ;;
    ">")
      if ((given == 3)); then _setup_holds "$actual" ">" "$lower"; else _setup_holds "$actual" ">=" "$upper"; fi
      ;;
    "<=")
      if ((given == 3)); then _setup_holds "$actual" "<=" "$lower"; else _setup_holds "$actual" "<" "$upper"; fi
      ;;
    "^")
      if ((low[0] > 0 || given == 1)); then keep=0
      elif ((low[1] > 0 || given == 2)); then keep=1
      else keep=2; fi
      _setup_holds "$actual" ">=" "$lower" &&
        _setup_holds "$actual" "<" "$(_setup_bump "${low[0]}" "${low[1]}" "${low[2]}" "$keep")"
      ;;
    "~")
      if ((given >= 2)); then keep=1; else keep=0; fi
      _setup_holds "$actual" ">=" "$lower" &&
        _setup_holds "$actual" "<" "$(_setup_bump "${low[0]}" "${low[1]}" "${low[2]}" "$keep")"
      ;;
    *)
      if ((given == 3)); then _setup_holds "$actual" "=" "$lower"
      else _setup_holds "$actual" ">=" "$lower" && _setup_holds "$actual" "<" "$upper"; fi
      ;;
  esac
}

# setup_satisfies_range VERSION RANGE succeeds when VERSION satisfies a
# package.json engines range: space-separated comparators that must all
# hold, || between alternatives, x-ranges, ^ and ~.
setup_satisfies_range() {
  local actual="$1" range="$2" alternative comparator all
  local -a comparators
  while IFS= read -r alternative; do
    read -r -a comparators <<<"$alternative"
    ((${#comparators[@]} == 0)) && continue
    all=1
    for comparator in "${comparators[@]}"; do
      _setup_comparator_holds "$actual" "$comparator" || { all=0; break; }
    done
    ((all)) && return 0
  done <<<"${range//||/$'\n'}"
  return 1
}

# setup_read_engine node|npm PACKAGE_JSON prints the engines range.
setup_read_engine() {
  awk -v key="$1" '
    /"engines"[[:space:]]*:/ { inside = 1 }
    inside && $0 ~ "\"" key "\"[[:space:]]*:" {
      line = $0
      sub(/^[^:]*:[[:space:]]*"/, "", line)
      sub(/".*$/, "", line)
      print line
      exit
    }
    inside && /}/ { inside = 0 }
  ' "$2"
}

# setup_read_package_manager PACKAGE_JSON prints e.g. npm@10.9.2.
setup_read_package_manager() {
  sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$1" | head -n 1
}

# setup_recommended_node_major RANGE prints the newest even (LTS) major
# that satisfies RANGE, or nothing.
setup_recommended_node_major() {
  local major
  for major in 30 28 26 24 22 20 18; do
    if setup_satisfies_range "$major.0.0" "$1"; then echo "$major"; return; fi
  done
}

# setup_detect_os prints macos, linux, wsl, windows or unknown.
setup_detect_os() {
  case "$(uname -s 2>/dev/null)" in
    Darwin) echo macos ;;
    Linux)
      if grep -qi microsoft /proc/version 2>/dev/null; then echo wsl; else echo linux; fi
      ;;
    MINGW* | MSYS* | CYGWIN*) echo windows ;;
    *) echo unknown ;;
  esac
}

# setup_detect_linux_family prints debian, fedora, arch, alpine, suse or other.
setup_detect_linux_family() {
  local ids=""
  if [[ -r /etc/os-release ]]; then
    ids=$(. /etc/os-release && printf '%s %s' "${ID:-}" "${ID_LIKE:-}")
  fi
  case " $ids " in
    *" debian "* | *" ubuntu "*) echo debian ;;
    *" fedora "* | *" rhel "* | *" centos "*) echo fedora ;;
    *" arch "*) echo arch ;;
    *" alpine "*) echo alpine ;;
    *" suse "* | *" opensuse "*) echo suse ;;
    *) echo other ;;
  esac
}

# setup_detect_installers prints the package and version managers present.
setup_detect_installers() {
  local found=() tool
  for tool in brew apt-get dnf yum pacman zypper apk nix-env fnm volta asdf mise; do
    command -v "$tool" >/dev/null 2>&1 && found+=("$tool")
  done
  [[ -n "${NVM_DIR:-}" && -s "${NVM_DIR}/nvm.sh" ]] && found+=("nvm")
  printf '%s' "${found[*]:-none}"
}

# setup_remedy_node OS FAMILY MAJOR prints copyable commands that install
# Node.js MAJOR. Nothing is run.
setup_remedy_node() {
  local os="$1" family="$2" major="${3:-24}"
  echo "fnm install $major && fnm use $major    # any OS, via https://github.com/Schniz/fnm"
  case "$os" in
    macos) echo "brew install node@$major && brew link --overwrite node@$major" ;;
    linux | wsl)
      case "$family" in
        debian) echo "curl -fsSL https://deb.nodesource.com/setup_$major.x | sudo -E bash - && sudo apt-get install -y nodejs" ;;
        fedora) echo "sudo dnf install -y nodejs npm    # check node -v; use fnm above for a specific major" ;;
        arch) echo "sudo pacman -S nodejs npm    # check node -v; use fnm above for a specific major" ;;
        alpine) echo "sudo apk add nodejs npm    # check node -v; use fnm above for a specific major" ;;
        *) echo "Install Node.js $major from https://nodejs.org/en/download" ;;
      esac
      ;;
    windows)
      echo "wsl --install -d Ubuntu    # in an elevated PowerShell; then clone and run setup inside Ubuntu"
      ;;
    *) echo "Install Node.js $major from https://nodejs.org/en/download" ;;
  esac
}

# setup_remedy_git OS FAMILY prints copyable commands that install git.
setup_remedy_git() {
  case "$1" in
    macos) echo "xcode-select --install    # or: brew install git" ;;
    linux | wsl)
      case "$2" in
        debian) echo "sudo apt-get update && sudo apt-get install -y git" ;;
        fedora) echo "sudo dnf install -y git" ;;
        arch) echo "sudo pacman -S git" ;;
        alpine) echo "sudo apk add git" ;;
        suse) echo "sudo zypper install -y git" ;;
        *) echo "Install git from https://git-scm.com/downloads" ;;
      esac
      ;;
    windows) echo "wsl --install -d Ubuntu    # then: sudo apt-get install -y git inside Ubuntu" ;;
    *) echo "Install git from https://git-scm.com/downloads" ;;
  esac
}

# setup_json_escape TEXT prints TEXT escaped for a JSON string.
setup_json_escape() {
  local text="$1"
  text="${text//\\/\\\\}"
  text="${text//\"/\\\"}"
  text="${text//$'\n'/ }"
  printf '%s' "$text"
}
