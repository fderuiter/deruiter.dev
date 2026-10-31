# Husky Hook Initialization and Lifecycle Detection: Technical Specifications & Research

This document provides the foundational research, behavioral analysis, and technical specifications for resolving **Issue #3616**: *"fix(setup): detect incomplete Husky hook initialization"*. It investigates the exact runtime contracts of Husky v9 (specifically v9.1.7), Git's `core.hooksPath` mechanics, npm's lifecycle execution guarantees, and their interaction with the setup wizard (`scripts/setup.sh`), diagnostic checks (`lib/dx/git-guard.ts`), and CI pipelines.

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Silent Failure Mode
In this repository, safety, code quality, and branch protection are heavily anchored to client-side Git hooks managed by Husky:
- `.husky/pre-commit`: Enforces secret scanning, lint-staged, TypeScript compilation, architectural module boundaries, TypeDoc drift checks, staged Vitest test suites, and dependency audit gates.
- `.husky/pre-push`: Enforces branch naming patterns and protects `main` against direct pushes or destructive operations.
- `.husky/commit-msg`: Enforces Conventional Commits specification.
- `.husky/post-checkout`: Warns immediately when a non-standard branch is created.

Husky v9 hooks rely on Git routing all hook invocations to internal dispatcher scripts located in `.husky/_/` via the Git configuration setting:
```bash
git config core.hooksPath .husky/_
```

Under normal circumstances, a fresh checkout running `npm ci` executes the npm `prepare` lifecycle script, which in turn invokes `husky` to configure `core.hooksPath` and populate `.husky/_/`.

However, in real-world developer and agent environments, `npm ci` is frequently skipped or lifecycle scripts are bypassed:
1. **Reused Dependencies**: `scripts/setup.sh` detects that `node_modules` is already up to date with `package-lock.json` and skips `npm ci`.
2. **Symlinked `node_modules`**: Shared multi-worktree environments or local caches symlink `node_modules`; `scripts/setup.sh` intentionally skips `npm ci` to prevent wiping the shared target.
3. **Skipped Lifecycle Scripts**: Contributors or CI environments invoke `npm ci --ignore-scripts`.
4. **New Git Worktrees**: A new worktree shares the parent repository's `.git/config` (where `core.hooksPath` is `.husky/_`), but the `.husky/_/` dispatcher directory is git-ignored and does not exist in the new worktree.
5. **Pre-commit Bypass via Environment**: `npm ci` was run in a context where `HUSKY=0` was exported.

**The Crucial Failure**: Git's native behavior when `core.hooksPath` is unset or points to a non-existent directory is to **silently succeed without executing any hooks**. Furthermore, the current `npm run doctor` check (`checkGitHygieneConfig` in `lib/dx/git-guard.ts`) only checks for the presence of `.husky/pre-commit` and `.husky/commit-msg`. Because these user scripts are tracked in Git, the check reports `status: "pass"`, falsely assuring developers and agents that commit hygiene policies are active when zero hooks are firing.

---

## 2. Husky v9 Architecture & Execution Internals

### 2.1 The Husky v8 vs v9 Architectural Shift
Husky v9 introduced a fundamental structural shift from v8:
- **Husky v8**: `core.hooksPath` was pointed directly to `.husky`. Every individual hook file (such as `.husky/pre-commit`) required boilerplate shell code sourcing an internal helper:
  ```sh
  #!/usr/bin/env sh
  . "$(dirname -- "$0")/_/husky.sh"
  ```
- **Husky v9**: `core.hooksPath` is pointed to `.husky/_` (an internal, git-ignored subfolder). The user-authored hook files in `.husky/` (e.g. `.husky/pre-commit`, `.husky/pre-push`) are now clean, native scripts without any framework bootstrap wrappers. Git invokes auto-generated dispatcher scripts inside `.husky/_/`, which in turn delegate to `.husky/<hook-name>`.

### 2.2 What the `husky` CLI Does (`bin.js` and `index.js`)
When `husky` is run with no arguments (e.g., triggered by `"prepare": "husky"` in `package.json`):

1. **CLI Routing (`bin.js`)**:
   - `bin.js` inspects `process.argv[2]`.
   - `init` is handled separately (appends `"prepare": "husky"` to `package.json`, runs initialization, creates a starter `.husky/pre-commit`).
   - Deprecated legacy commands (`add`, `set`, `uninstall`) produce deprecation warnings and exit with code 1.
   - `install` produces a deprecation warning and falls through to the default export of `index.js`.
   - With no arguments, `bin.js` calls `index.js` with `d = '.husky'`.

2. **Core Initialization (`index.js`)**:
   The primary entrypoint function executes the following sequence:
   ```javascript
   export default (d = '.husky') => {
     if (process.env.HUSKY === '0') return 'HUSKY=0 skip install'
     if (d.includes('..')) return '.. not allowed'
     if (!f.existsSync('.git')) return `.git can't be found`

     let _ = (x = '') => p.join(d, '_', x)
     let { status: s, stderr: e } = c.spawnSync('git', ['config', 'core.hooksPath', `${d}/_`])
     if (s == null) return 'git command not found'
     if (s) return '' + e

     f.rmSync(_('husky.sh'), { force: true })
     f.mkdirSync(_(), { recursive: true })
     w(_('.gitignore'), '*')
     f.copyFileSync(new URL('husky', import.meta.url), _('h'))
     l.forEach(h => w(_(h), `#!/usr/bin/env sh\n. "\$(dirname "\$0")/h"`, { mode: 0o755 }))
     w(_('husky.sh'), msg)
     return ''
   }
   ```

### 2.3 Files and Directories Created by Husky v9
When `husky` completes successfully, it creates the following structure in the workspace:

| Path | Purpose | Content / Permissions | Tracked in Git? |
|---|---|---|---|
| `.husky/_/` | Internal dispatcher directory | Directory | No (ignored via `.gitignore`) |
| `.husky/_/.gitignore` | Ignore rule | `*` | No |
| `.husky/_/h` | Main runtime dispatch shell script | Shell script copied from Husky package | No (executable) |
| `.husky/_/<hook-name>` | 14 hook dispatchers (`pre-commit`, `pre-push`, `commit-msg`, `post-checkout`, etc.) | `#!/usr/bin/env sh\n. "$(dirname "$0")/h"` (mode `0o755`) | No (executable) |
| `.husky/_/husky.sh` | Legacy compatibility stub | Shell script printing deprecation notice if invoked by v8 hooks | No |

### 2.4 Hook Execution Pipeline at Runtime (`.husky/_/h`)
When Git triggers a hook (e.g. `pre-commit`), the following chain executes:
1. Git reads `core.hooksPath` (`.husky/_`) and executes `.husky/_/pre-commit`.
2. `.husky/_/pre-commit` sources `.husky/_/h`.
3. Inside `.husky/_/h`:
   - Checks `[ "$HUSKY" = "2" ] && set -x`: Enables shell debugging if `HUSKY=2`.
   - Derives script target:
     ```sh
     n=$(basename "$0")                          # e.g., "pre-commit"
     s=$(dirname "$(dirname "$0")")/$n           # resolves to ".husky/pre-commit"
     ```
   - Checks presence: `[ ! -f "$s" ] && exit 0`: If the repository has not authored `.husky/<hook-name>`, it exits with `0` cleanly.
   - Sources user hook configuration: Sinks `~/.config/husky/init.sh` (or warns if legacy `~/.huskyrc` exists).
   - Checks disablement: `[ "${HUSKY-}" = "0" ] && exit 0`: If `HUSKY=0`, it skips hook execution and exits with `0`.
   - Augments path: `export PATH="node_modules/.bin:$PATH"`.
   - Runs user hook: `sh -e "$s" "$@"`.
   - Exits with the user hook's status code.

### 2.5 Environment Variable Semantics (`HUSKY` flags)
- `HUSKY=0`:
  - **At install time**: Husky's `index.js` checks `process.env.HUSKY === '0'`. It immediately halts, outputs `'HUSKY=0 skip install'`, and does **not** touch `core.hooksPath` or disk.
  - **At hook runtime**: `.husky/_/h` checks `[ "${HUSKY-}" = "0" ] && exit 0`. All hook scripts are bypassed.
- `HUSKY=false`:
  - **Note**: Husky's official source code strictly checks for `"0"` (string equality). However, many developers and tools export `HUSKY=false`. Diagnostic tools and setup checks should recognize both `HUSKY=0` and `HUSKY=false` as intentional disablement to avoid unwanted mutations.
- `HUSKY=2`:
  - Activates `set -x` verbose execution tracing in `.husky/_/h`.

### 2.6 Edge Cases in Husky Behavior
1. **Git Not Installed / Missing from `PATH`**:
   `spawnSync('git', ...)` returns `status: null`. Husky returns `'git command not found'` without writing files.
2. **Not in a Git Repository**:
   Husky executes `!fs.existsSync('.git')`. If `.git` does not exist in `process.cwd()`, Husky returns `'.git can\'t be found'`.
   *Subtle detail*: Husky checks for `.git` in the current working directory, not by running `git rev-parse --show-toplevel`. If run from a subdirectory, it fails.
3. **Bare Repository**:
   A bare repository has no `.git` directory (the repo root *is* the git dir). `!fs.existsSync('.git')` evaluates to true, so Husky returns `'.git can\'t be found'`.
4. **Git Worktrees**:
   In a Git worktree, `.git` is a regular text file containing `gitdir: <path>`. `fs.existsSync('.git')` returns `true`. Husky successfully initializes inside the worktree directory.
5. **Read-Only Filesystem**:
   `git config` fails with a lock error or `fs.mkdirSync` throws `EACCES` / `EROFS`. Husky does not catch filesystem errors gracefully; they bubble up as exceptions.
6. **Pre-Existing Custom `core.hooksPath`**:
   Husky's `index.js` unconditionally runs `git config core.hooksPath .husky/_`. **It does not check if the user previously had a custom hook path configured**. If run blindly, it clobbers user and repository custom hook configurations.

---

## 3. Git `core.hooksPath` Mechanics

### 3.1 Scope Levels and Precedence
Git configuration adheres to strict scoping rules:
```text
--worktree (local to specific worktree, if extensions.worktreeConfig is enabled)
    ↓ overrides
--local    (stored in .git/config)
    ↓ overrides
--global   (stored in ~/.gitconfig or $XDG_CONFIG_HOME/git/config)
    ↓ overrides
--system   (stored in /etc/gitconfig or installation root)
```

Commands:
- `git config --get core.hooksPath`: Retrieves the effective value respecting scope precedence.
- `git config --local --get core.hooksPath`: Queries exclusively the repository-level `.git/config`. Returns exit code `1` if unset at the local level (even if configured globally).

### 3.2 Unset Behavior
When `core.hooksPath` is unset at all levels:
- Git defaults to `$GIT_DIR/hooks` (e.g. `.git/hooks/`).
- Git looks for executable scripts such as `.git/hooks/pre-commit`.
- The repository's `.husky/` directory is completely ignored.

### 3.3 Non-Existent Path Behavior (The Silent Bypass Trap)
If `core.hooksPath` is configured to point to a path that does not exist on disk:
- When a developer runs `git commit` or `git push`, Git attempts to resolve `<core.hooksPath>/<hook-name>`.
- If the directory or the specific hook file does not exist, **Git treats it as "no hook defined" and exits 0**.
- Git emits **no warning, no error, and no diagnostic notice**.

### 3.4 Relative vs Absolute Paths
- When `core.hooksPath` is specified as a relative path (such as `.husky/_`), Git resolves it **relative to the root of the current working tree**.
- In Git worktrees: If `core.hooksPath` was set in the common `.git/config` during an earlier setup on `main`, a new worktree has `core.hooksPath = .husky/_`. However, because `.husky/_` is ignored by Git, the new worktree has no `.husky/_` folder until Husky is explicitly run in that worktree. Git silently bypasses all hooks.

---

## 4. npm Lifecycle & Installation Mechanics

### 4.1 When `prepare` Runs
Under npm v7, v8, v9, and v10:
- `npm install` (without arguments): Runs `preinstall` → `install` → `postinstall` → `prepublish` → `prepare`.
- `npm ci`: Runs `preinstall` → `install` → `postinstall` → `prepare`.
- `npm install <package>`: Does **not** run `prepare`.
- `npm ci --ignore-scripts` (or `npm install --ignore-scripts`): Skips **all** lifecycle scripts, including `prepare`.

### 4.2 Why Reusing Dependencies Bypasses `prepare`
In `scripts/setup.sh` (lines 198-207):
```bash
INSTALLED_MARKER="node_modules/.package-lock.json"
if [[ -L node_modules ]]; then
  wizard_warn "node_modules is a symlink to a shared install; leaving it alone instead of running npm ci."
  DEPS_STATUS=skipped; DEPS_DETAIL="node_modules is a symlink, so npm ci was not run."
elif [[ -f "$INSTALLED_MARKER" && "$INSTALLED_MARKER" -nt package-lock.json && "$INSTALLED_MARKER" -nt package.json ]]; then
  wizard_ok "node_modules is up to date with package-lock.json."
  DEPS_STATUS=completed; DEPS_DETAIL="Already installed."
...
```
When `setup.sh` detects that `node_modules` is up to date or symlinked, it skips `npm ci` for efficiency and safety. Because `npm ci` does not execute, npm's `prepare` script (`husky`) is never triggered.

If the working tree does not already have `.husky/_` and `core.hooksPath` initialized, `setup.sh` exits Stage 3 without initializing hooks.

---

## 5. Current Codebase Review & Gap Analysis

### 5.1 `scripts/setup.sh` (Stage 3: Dependencies)
- **Lines 242-252 (The Prisma Self-Healing Pattern)**:
  `scripts/setup.sh` recognizes that npm lockfiles can survive failed lifecycle scripts:
  ```bash
  if [[ "$DEPS_STATUS" != failed && ! -f app/generated/prisma/client.ts ]] && (( ! DRY_RUN )); then
    wizard_say "Generating the missing Prisma client..."
    if npx --no-install prisma generate >&"$WIZARD_FD"; then
      rm -f tsconfig.tsbuildinfo
    ...
  ```
- **The Gap**: Setup implements self-healing for Prisma, but has **no self-healing or detection for Husky hooks**. When dependencies are reused or symlinked, hooks are ignored.

### 5.2 `scripts/lib/setup-checks.sh`
- Contains pure helper functions for Node/npm version ranges (`setup_satisfies_range`), OS detection (`setup_detect_os`), installer detection, and JSON string escaping.
- Contains **no helper functions** for inspecting Git hook configuration or determining Husky readiness.

### 5.3 `lib/dx/git-guard.ts` (`checkGitHygieneConfig`)
Lines 168-230 implement the Git hygiene diagnostic check:
```typescript
export function checkGitHygieneConfig(root: string, fix = false): DiagnosticCheckResult {
  const huskyDir = path.join(root, ".husky");
  const preCommitHook = path.join(huskyDir, "pre-commit");
  const commitMsgHook = path.join(huskyDir, "commit-msg");
  ...
  if (!fs.existsSync(huskyDir)) issues.push(".husky directory not found.");
  if (!fs.existsSync(preCommitHook)) issues.push(".husky/pre-commit hook not found.");
  if (!fs.existsSync(commitMsgHook)) issues.push(".husky/commit-msg hook not found.");
  ...
}
```
**Critical Deficiencies**:
1. It only verifies that `.husky/pre-commit` and `.husky/commit-msg` exist on disk.
2. It does not inspect `git config core.hooksPath`.
3. It does not check if `.husky/_/` or `.husky/_/h` exists.
4. If `core.hooksPath` is unset or points to an external directory, it still returns `status: "pass"`.
5. Its `fix` routine simply creates a placeholder `commit-msg` script; it does not invoke `husky` to wire Git hooks.

### 5.4 `docs/reference/setup.md`
- Outlines the stages (`platform`, `toolchain`, `dependencies`, `lockfile`, `environment`, `integrations`, `database`, `verification`).
- Mentions Prisma self-healing in Stage 3, but does not document hook verification or the conditions under which Husky is initialized or skipped.

### 5.5 Test Coverage Gaps
- `__tests__/dx-setup-shell.test.ts`: Tests `setup.sh` behavior in a fresh temporary directory, but mocks `tsx` and Prisma generation without testing Git hook detection or Husky lifecycle execution.
- `__tests__/husky-hook-wiring.test.ts`: Tests the execution of individual hook scripts (like `.husky/pre-push` and `validate-commit.ts`) by spawning bash directly against isolated scratch repositories, but does not test the initialization state, setup lifecycle interaction, or `checkGitHygieneConfig`.

---

## 6. Synthesized Best Practices & Technical Specifications

### 6.1 Hook Lifecycle State Classification Matrix
A robust detection system must classify the repository into one of the following mutually exclusive states:

| State | Condition | Meaning | Safe Action |
|---|---|---|---|
| `ACTIVE` | `core.hooksPath` is `.husky/_`, `.husky/_/h` exists, `.husky/pre-commit` exists, `HUSKY` is not `0`/`false` | Hooks are correctly wired and active | Do nothing (pass) |
| `UNINITIALIZED` | In a Git repo, `.husky/` exists, `core.hooksPath` is unset or `.husky/_`, but `.husky/_/h` or dispatcher is missing | Hooks were skipped during install/setup | Auto-initialize via `husky` if writable and not dry-run |
| `DISABLED` | `HUSKY=0` or `HUSKY=false` in environment | Explicit user/CI intent to disable hooks | Skip without error; report accurately as disabled |
| `CUSTOM_HOOKS_PATH` | `core.hooksPath` is set to something other than `.husky/_` (or empty) | User has configured custom global or local hooks | Respect user configuration; **never overwrite**; report as custom |
| `READ_ONLY` | Worktree or `.git` directory is read-only | Filesystem cannot accept writes | Warn and skip; do not fail dependencies stage |
| `DRY_RUN` | Setup invoked with `--dry-run` | Preview execution only | Note that Husky would be initialized; do not run |
| `NON_GIT` | Not in a Git repository (or bare repo) | Git operations invalid | Skip cleanly |

### 6.2 Exact Detection Logic

#### Shell Implementation (`scripts/lib/setup-checks.sh` / `scripts/setup.sh`)
```bash
# Returns: active, uninitialized, disabled, custom, readonly, nongit
setup_detect_husky_status() {
  local root="${1:-.}"
  
  # 1. Check for intentional environment disablement
  if [[ "${HUSKY:-}" == "0" || "${HUSKY:-}" == "false" ]]; then
    echo "disabled"
    return 0
  fi

  # 2. Check Git repository context
  if ! git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "nongit"
    return 0
  fi

  # 3. Check for repository hook definitions
  if [[ ! -d "$root/.husky" ]]; then
    echo "nongit"
    return 0
  fi

  # 4. Check core.hooksPath configuration
  local hooks_path
  hooks_path=$(git -C "$root" config --get core.hooksPath 2>/dev/null || true)

  # If hooksPath is set to anything other than .husky/_ (or .husky/_/), it's a custom override
  if [[ -n "$hooks_path" && "$hooks_path" != ".husky/_" && "$hooks_path" != ".husky/_/" ]]; then
    echo "custom"
    return 0
  fi

  # 5. Check if internal Husky dispatchers exist
  if [[ -f "$root/.husky/_/h" && -x "$root/.husky/_/pre-commit" ]]; then
    if [[ "$hooks_path" == ".husky/_" || "$hooks_path" == ".husky/_/" ]]; then
      echo "active"
      return 0
    fi
  fi

  # 6. Check filesystem writability
  if [[ ! -w "$root" || ( -d "$root/.git" && ! -w "$root/.git" ) ]]; then
    echo "readonly"
    return 0
  fi

  echo "uninitialized"
}
```

#### TypeScript Implementation (`lib/dx/git-guard.ts`)
```typescript
export interface HuskyStatusResult {
  state: "active" | "uninitialized" | "disabled" | "custom" | "readonly" | "nongit";
  detail?: string;
}

export function detectHuskyHookStatus(root: string): HuskyStatusResult {
  const envHusky = process.env.HUSKY;
  if (envHusky === "0" || envHusky === "false") {
    return { state: "disabled", detail: `HUSKY=${envHusky} is set in environment.` };
  }

  const gitCheck = spawnSync("git", ["-C", root, "rev-parse", "--is-inside-work-tree"], { encoding: "utf-8" });
  if (gitCheck.status !== 0) {
    return { state: "nongit", detail: "Not inside a Git worktree." };
  }

  const huskyDir = path.join(root, ".husky");
  if (!fs.existsSync(huskyDir)) {
    return { state: "nongit", detail: ".husky directory does not exist." };
  }

  const hooksPathCheck = spawnSync("git", ["-C", root, "config", "--get", "core.hooksPath"], { encoding: "utf-8" });
  const hooksPath = hooksPathCheck.stdout.trim();

  if (hooksPath && hooksPath !== ".husky/_" && hooksPath !== ".husky/_/") {
    return { state: "custom", detail: `Custom core.hooksPath is configured: ${hooksPath}` };
  }

  const dispatcherH = path.join(huskyDir, "_", "h");
  const preCommitDispatcher = path.join(huskyDir, "_", "pre-commit");

  if (fs.existsSync(dispatcherH) && fs.existsSync(preCommitDispatcher) && (hooksPath === ".husky/_" || hooksPath === ".husky/_/")) {
    return { state: "active" };
  }

  try {
    fs.accessSync(root, fs.constants.W_OK);
  } catch {
    return { state: "readonly", detail: "Repository root is not writable." };
  }

  return { state: "uninitialized", detail: "Husky dispatchers (.husky/_) or core.hooksPath are missing." };
}
```

---

## 7. Safe Remediation & Initialization Protocol

### 7.1 Remediation Sequence in `scripts/setup.sh`
In Stage 3 (dependencies), immediately following dependency resolution and Prisma client verification:

```bash
# Verify and heal Husky Git hooks if dependencies were reused or symlinked
if [[ "$DEPS_STATUS" != failed ]]; then
  HOOK_STATUS=$(setup_detect_husky_status ".")
  case "$HOOK_STATUS" in
    active)
      wizard_ok "Git hygiene hooks are active."
      ;;
    disabled)
      wizard_note "HUSKY=${HUSKY} set; skipping Git hook initialization."
      ;;
    custom)
      HOOK_PATH=$(git config --get core.hooksPath)
      wizard_warn "Custom core.hooksPath is set ($HOOK_PATH); preserving user hooks."
      ;;
    readonly)
      wizard_warn "Repository is read-only; skipping Git hook initialization."
      ;;
    uninitialized)
      if ((DRY_RUN)); then
        wizard_note "Dry run: would initialize Husky Git hooks."
      elif [[ -x node_modules/.bin/husky ]]; then
        wizard_say "Initializing Husky Git hooks..."
        if node_modules/.bin/husky >&"$WIZARD_FD" 2>&1; then
          wizard_ok "Git hygiene hooks initialized."
        else
          wizard_warn "Failed to initialize Husky hooks; check permissions or run npx husky manually."
        fi
      elif command -v npx >/dev/null 2>&1; then
        wizard_say "Initializing Husky Git hooks..."
        if npx --no-install husky >&"$WIZARD_FD" 2>&1; then
          wizard_ok "Git hygiene hooks initialized."
        else
          wizard_warn "Failed to initialize Husky hooks; check permissions."
        fi
      else
        wizard_warn "node_modules/.bin/husky not found; Git hooks remain uninitialized."
      fi
      ;;
    nongit)
      # Non-git contexts (e.g. tarball extract, docker build) do not need hooks
      ;;
  esac
fi
```

### 7.2 Safety Invariants
1. **Never Overwrite Custom Hooks**: If `core.hooksPath` is set to any value other than empty or `.husky/_`, setup must **never** run `husky`. Doing so would clobber user configuration.
2. **Never Clobber `HUSKY=0`**: If `HUSKY=0` or `false` is set, setup must skip initialization and must **not** mark hooks as active.
3. **Symlink Safety**: If `node_modules` is a symlink, running `node_modules/.bin/husky` is completely safe because Husky only modifies the repository's local `.git/config` and writes `.husky/_` in the current project root. It makes zero modifications inside `node_modules`.
4. **Dry Run Safety**: In `--dry-run` mode, setup must log what it would do without invoking `husky` or changing `git config`.

---

## 8. Verification & Testing Strategy

To satisfy Acceptance Criteria 3 of Issue #3616, an isolated regression test suite must be added (in `__tests__/husky-hook-wiring.test.ts` or a dedicated test file `__tests__/husky-initialization.test.ts`).

### Test Cases Matrix
1. **Lifecycle Skipped (`uninitialized`)**:
   - Create scratch repository with `.husky/pre-commit`.
   - Leave `core.hooksPath` unset and `.husky/_` absent.
   - Assert `detectHuskyHookStatus` returns `uninitialized`.
   - Assert running setup remediation initializes `.husky/_/h` and sets `core.hooksPath = .husky/_`.
2. **Properly Configured (`active`)**:
   - Initialize Husky in scratch repo.
   - Assert status is `active`.
   - Assert no redundant initialization is triggered.
3. **Intentional Disablement (`disabled`)**:
   - Set `env: { HUSKY: "0" }` and `{ HUSKY: "false" }`.
   - Assert status is `disabled`.
   - Assert setup skips without running `husky` or reporting error.
4. **Custom Hooks Path (`custom`)**:
   - Set `git config core.hooksPath /custom/path`.
   - Assert status is `custom`.
   - Assert remediation preserves `/custom/path` and does not invoke `husky`.
5. **Symlinked Shared `node_modules`**:
   - Symlink `node_modules` containing a mock `husky` CLI binary.
   - Run setup check; assert it safely invokes the binary to create local `.husky/_` without modifying the symlinked target.
6. **Read-Only Checkout**:
   - Remove write permissions from directory (`chmod -w`).
   - Assert status is `readonly` and does not crash.

---

## 9. Primary Sources & Citations

1. **Husky v9 Source Code & Release Notes**:
   - Repository: [github.com/typicode/husky](https://github.com/typicode/husky)
   - CLI Entrypoint: `bin.js` (`process.argv[2]` handling, `init`, `install` deprecation).
   - Core Engine: `index.js` (`core.hooksPath` setting, `.husky/_` structure, 14 hook dispatchers).
   - Dispatcher: `husky` shell binary (`.husky/_/h`, `${HUSKY-}` evaluation, path resolution).
2. **Git Configuration & Hooks Documentation**:
   - Git Reference: `git-config(1)` documentation on `core.hooksPath`.
   - Git Reference: `githooks(5)` hook discovery and execution semantics.
   - Precedence: `--worktree` > `--local` > `--global` > `--system`.
3. **npm CLI Documentation**:
   - npm Documentation: Lifecycle scripts (`prepare`, `preinstall`, `postinstall`).
   - Flags: `--ignore-scripts` behavior across `npm ci` and `npm install`.
4. **Repository Architecture Decision Records**:
   - `adr/0023-diataxis-documentation-architecture-and-zero-drift-governance.md`: Diátaxis documentation governance.
   - `adr/0029-git-guardrails-and-pre-commit-boundary-enforcement.md`: Pre-commit pipeline and `.husky/pre-push` guardrails.
   - `adr/0033-bounded-pre-commit-test-scope.md`: Staged test execution in pre-commit.
   - `docs/reference/setup.md`: Setup wizard contract and dependency lifecycle handling.
