import fs from "fs";
import path from "path";
import type { DiagnosticCheckResult } from "./doctor";

export const ALLOWED_COMMIT_TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
  "dx",
] as const;

export type CommitType = (typeof ALLOWED_COMMIT_TYPES)[number];

export interface ParsedCommit {
  type: string;
  scope?: string;
  subject: string;
  isBreaking: boolean;
  raw: string;
}

export interface CommitValidationResult {
  valid: boolean;
  errors: string[];
  parsed?: ParsedCommit;
}

const SEMVER_RELEASE_HEADER_REGEX =
  /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const LEADING_ACRONYM_SUBJECT_REGEX = /^[A-Z0-9]{2,10}(?:\b|:)/;

const CANONICAL_WORKSPACE_ROOT = path.resolve(__dirname, "../..");

const DEFAULT_HUSKY_HOOKS: Readonly<Record<string, string>> = {
  "pre-commit": [
    "#!/usr/bin/env bash",
    "set -eu",
    "",
    "npx tsx scripts/validate-commit.ts",
    "npx lint-staged",
    "npm run typecheck",
    "npm run lint:boundaries",
    "npm run check-docs-drift",
    "npm run test:staged",
    "npm run audit:security",
    "",
  ].join("\n"),
  "commit-msg": '#!/bin/sh\nnpx tsx scripts/validate-commit-msg.ts "$1"\n',
  "pre-push": [
    "#!/usr/bin/env bash",
    "set -eu",
    "",
    'if [ "${ALLOW_DANGEROUS_GIT:-0}" = "1" ] || [ "$(git config --get hooks.allowdangerousgit 2>/dev/null)" = "true" ]; then',
    "  exit 0",
    "fi",
    "",
    "npx tsx scripts/validate-branch.ts",
    "npm run typecheck",
    "npm run lint:boundaries",
    "exit 0",
    "",
  ].join("\n"),
  "post-checkout": [
    "#!/usr/bin/env bash",
    "set -eu",
    "",
    'if [ "${3:-0}" != "1" ]; then',
    "  exit 0",
    "fi",
    "",
    "npx tsx scripts/validate-branch.ts --warn || true",
    "exit 0",
    "",
  ].join("\n"),
};

const DEFAULT_BLOCK_DANGEROUS_GIT_HOOK = [
  "#!/usr/bin/env bash",
  "# Claude Code PreToolUse Hook Compatibility Wrapper",
  "# Delegates to project root git safety guardrail script.",
  "",
  'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
  'ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"',
  "",
  'if [ ! -f "$ROOT_DIR/scripts/git-guardrail.sh" ]; then',
  "  echo \"BLOCKED: Git safety guardrail script not found at '$ROOT_DIR/scripts/git-guardrail.sh'.\" >&2",
  "  exit 2",
  "fi",
  "",
  'if bash "$ROOT_DIR/scripts/git-guardrail.sh" "$@"; then',
  "  exit 0",
  "fi",
  "",
  "exit 2",
  "",
].join("\n");

const DEFAULT_GIT_GUARDRAIL_SCRIPT = [
  "#!/usr/bin/env bash",
  "set -euo pipefail",
  'if [ "${ALLOW_DANGEROUS_GIT:-0}" = "1" ]; then',
  "  exit 0",
  "fi",
  "exit 0",
  "",
].join("\n");

function hasExecutableMode(filePath: string): boolean {
  if (process.platform === "win32") return true;
  try {
    const mode = fs.statSync(filePath).mode;
    return (mode & 0o111) === 0o111;
  } catch {
    return false;
  }
}

function readCanonicalOrFallback(
  relativeFilePath: string,
  fallbackContent: string
): string {
  const canonicalPath = path.join(CANONICAL_WORKSPACE_ROOT, relativeFilePath);
  try {
    if (fs.existsSync(canonicalPath) && fs.statSync(canonicalPath).isFile()) {
      return fs.readFileSync(canonicalPath, "utf-8");
    }
  } catch {
    // Fall back to embedded template when canonical file cannot be read.
  }
  return fallbackContent;
}

function writeExecutableScript(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: "utf-8", mode: 0o755 });
  if (process.platform !== "win32") {
    fs.chmodSync(filePath, 0o755);
  }
}

function resolveWorktreeMainHuskyUnderscore(root: string): string | null {
  const dotGitPath = path.join(root, ".git");
  try {
    if (!fs.existsSync(dotGitPath)) return null;
    const dotGitStat = fs.lstatSync(dotGitPath);
    if (!dotGitStat.isFile()) return null;

    const dotGitContent = fs.readFileSync(dotGitPath, "utf-8");
    const match = dotGitContent.match(/^gitdir:\s*(.+)$/m);
    if (!match?.[1]) return null;

    const gitDir = path.resolve(root, match[1].trim());
    const commonDirFile = path.join(gitDir, "commondir");
    const commonDir = fs.existsSync(commonDirFile)
      ? path.resolve(gitDir, fs.readFileSync(commonDirFile, "utf-8").trim())
      : path.resolve(gitDir, "../..");

    const mainCheckoutRoot = path.dirname(commonDir);
    if (path.resolve(mainCheckoutRoot) === path.resolve(root)) {
      return null;
    }
    return path.join(mainCheckoutRoot, ".husky", "_");
  } catch {
    return null;
  }
}

function isValidWorktreeHuskyLink(
  worktreeHuskyUnderscore: string,
  mainHuskyUnderscore: string
): boolean {
  try {
    const stat = fs.lstatSync(worktreeHuskyUnderscore);
    if (!stat.isSymbolicLink()) return false;
    if (!fs.existsSync(worktreeHuskyUnderscore)) return false;
    if (!fs.existsSync(mainHuskyUnderscore)) return false;
    return (
      fs.realpathSync(worktreeHuskyUnderscore) ===
      fs.realpathSync(mainHuskyUnderscore)
    );
  } catch {
    return false;
  }
}

/**
 * Validates a commit message string against the Conventional Commits 1.0.0 specification.
 */
export function validateCommitMessage(message: string): CommitValidationResult {
  const cleanMsg = message.trim();
  const errors: string[] = [];

  if (!cleanMsg) {
    return { valid: false, errors: ["Commit message cannot be empty."] };
  }

  // Extract first line (header)
  const header = cleanMsg.split(/\r?\n/)[0].trim();

  // Handle merge commits, squash headers, or automated SemVer release commits
  if (
    cleanMsg.startsWith("Merge ") ||
    cleanMsg.startsWith('Revert "') ||
    SEMVER_RELEASE_HEADER_REGEX.test(header) ||
    cleanMsg.startsWith("Release ")
  ) {
    return { valid: true, errors: [] };
  }

  // Max header length: 100 characters
  if (header.length > 100) {
    errors.push(`Header length (${header.length}) exceeds 100 characters.`);
  }

  // Regex pattern for Conventional Commits: type(scope)!: subject or type: subject
  const conventionalRegex = /^([a-z]+)(?:\(([a-z0-9-_]+)\))?(!)?:\s+(.+)$/;
  const match = header.match(conventionalRegex);

  if (!match) {
    errors.push(
      `Header must follow format '<type>(<scope>): <subject>' or '<type>: <subject>'. Example: 'feat(dx): add commit validator'`
    );
    return { valid: false, errors };
  }

  const [, type, scope, exclamation, subject] = match;

  if (!ALLOWED_COMMIT_TYPES.includes(type as CommitType)) {
    errors.push(
      `Invalid type '${type}'. Allowed types: ${ALLOWED_COMMIT_TYPES.join(", ")}`
    );
  }

  if (!subject || subject.trim().length === 0) {
    errors.push("Commit subject cannot be empty.");
  } else {
    // Subject shouldn't end with a period
    if (subject.endsWith(".")) {
      errors.push("Commit subject should not end with a period.");
    }
    // Subject should start with a lowercase letter or canonical acronym
    if (
      /^[A-Z]/.test(subject) &&
      !LEADING_ACRONYM_SUBJECT_REGEX.test(subject)
    ) {
      errors.push(
        "Commit subject should start with a lowercase letter or canonical acronym."
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: {
      type,
      scope,
      subject,
      isBreaking: Boolean(exclamation),
      raw: cleanMsg,
    },
  };
}

/**
 * Validates branch names against team convention: feat/*, fix/*, chore/*, refactor/*, docs/*, perf/*, dx/*, test/*, ci/*, dev/*, jules/* (branches opened by the Jules agent), main, master.
 */
export function validateBranchName(branch: string): {
  valid: boolean;
  error?: string;
} {
  const cleanBranch = branch.trim();
  if (["main", "master", "develop", "dev", "HEAD"].includes(cleanBranch)) {
    return { valid: true };
  }

  const validPrefixes = [
    "feat/",
    "fix/",
    "chore/",
    "refactor/",
    "docs/",
    "perf/",
    "dx/",
    "test/",
    "ci/",
    "dev/",
    "jules/",
  ];

  const hasValidPrefix = validPrefixes.some((p) => cleanBranch.startsWith(p));

  if (!hasValidPrefix) {
    return {
      valid: false,
      error: `Branch name '${cleanBranch}' does not follow convention. Expected prefixes: ${validPrefixes.join(", ")} (e.g. feat/add-dx-suite). Cloud sessions push as dx/<slug>, not claude/<slug>.`,
    };
  }

  // Check for disallowed characters
  if (/[^a-z0-9/_-]/.test(cleanBranch)) {
    return {
      valid: false,
      error: `Branch name '${cleanBranch}' contains invalid characters. Use only lowercase alphanumeric, hyphens, and slashes.`,
    };
  }

  return { valid: true };
}

/**
 * Diagnostic check for Husky git hooks, Claude Code hook scripts, guardrail
 * executable modes, and git worktree `.husky/_` symlinks.
 */
export function checkGitHygieneConfig(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const huskyDir = path.join(root, ".husky");
  const claudeHooksDir = path.join(root, ".claude", "hooks");
  const guardrailRelPath = path.posix.join("scripts", "git-guardrail.sh");
  const guardrailPath = path.join(root, "scripts", "git-guardrail.sh");
  const blockDangerousHookRelPath = path.posix.join(
    ".claude",
    "hooks",
    "block-dangerous-git.sh"
  );
  const blockDangerousHookPath = path.join(
    claudeHooksDir,
    "block-dangerous-git.sh"
  );

  const requiredHuskyHooks = [
    "pre-commit",
    "commit-msg",
    "pre-push",
    "post-checkout",
  ] as const;

  const issues: string[] = [];

  if (!fs.existsSync(huskyDir)) {
    issues.push(".husky directory not found.");
  }

  for (const hookName of requiredHuskyHooks) {
    const hookPath = path.join(huskyDir, hookName);
    if (!fs.existsSync(hookPath)) {
      issues.push(`.husky/${hookName} hook not found.`);
    } else if (!hasExecutableMode(hookPath)) {
      issues.push(`.husky/${hookName} is not executable (expected 0o755).`);
    }
  }

  if (!fs.existsSync(blockDangerousHookPath)) {
    issues.push(`${blockDangerousHookRelPath} hook script not found.`);
  }

  if (
    fs.existsSync(claudeHooksDir) &&
    fs.statSync(claudeHooksDir).isDirectory()
  ) {
    const claudeScripts = fs
      .readdirSync(claudeHooksDir)
      .filter((entry) => entry.endsWith(".sh"))
      .sort();
    for (const scriptName of claudeScripts) {
      const scriptPath = path.join(claudeHooksDir, scriptName);
      if (!hasExecutableMode(scriptPath)) {
        issues.push(
          `.claude/hooks/${scriptName} is not executable (expected 0o755).`
        );
      }
    }
  }

  if (!fs.existsSync(guardrailPath)) {
    issues.push(`${guardrailRelPath} script not found.`);
  } else if (!hasExecutableMode(guardrailPath)) {
    issues.push(`${guardrailRelPath} is not executable (expected 0o755).`);
  }

  const mainHuskyUnderscore = resolveWorktreeMainHuskyUnderscore(root);
  const worktreeHuskyUnderscore = path.join(huskyDir, "_");
  if (
    mainHuskyUnderscore &&
    !isValidWorktreeHuskyLink(worktreeHuskyUnderscore, mainHuskyUnderscore)
  ) {
    issues.push(
      ".husky/_ worktree symlink is missing or does not point to the main checkout's .husky/_."
    );
  }

  if (issues.length > 0) {
    if (fix) {
      const fixesApplied: string[] = [];
      fs.mkdirSync(huskyDir, { recursive: true });

      for (const hookName of requiredHuskyHooks) {
        const hookPath = path.join(huskyDir, hookName);
        const relPath = path.posix.join(".husky", hookName);
        if (!fs.existsSync(hookPath)) {
          writeExecutableScript(
            hookPath,
            readCanonicalOrFallback(relPath, DEFAULT_HUSKY_HOOKS[hookName])
          );
          fixesApplied.push(`Created ${relPath} (0o755)`);
        } else if (!hasExecutableMode(hookPath)) {
          fs.chmodSync(hookPath, 0o755);
          fixesApplied.push(`Restored 0o755 mode on ${relPath}`);
        }
      }

      fs.mkdirSync(claudeHooksDir, { recursive: true });
      if (!fs.existsSync(blockDangerousHookPath)) {
        writeExecutableScript(
          blockDangerousHookPath,
          readCanonicalOrFallback(
            blockDangerousHookRelPath,
            DEFAULT_BLOCK_DANGEROUS_GIT_HOOK
          )
        );
        fixesApplied.push(`Created ${blockDangerousHookRelPath} (0o755)`);
      }

      for (const scriptName of fs
        .readdirSync(claudeHooksDir)
        .filter((entry) => entry.endsWith(".sh"))
        .sort()) {
        const scriptPath = path.join(claudeHooksDir, scriptName);
        if (!hasExecutableMode(scriptPath)) {
          fs.chmodSync(scriptPath, 0o755);
          fixesApplied.push(
            `Restored 0o755 mode on .claude/hooks/${scriptName}`
          );
        }
      }

      if (!fs.existsSync(guardrailPath)) {
        writeExecutableScript(
          guardrailPath,
          readCanonicalOrFallback(
            guardrailRelPath,
            DEFAULT_GIT_GUARDRAIL_SCRIPT
          )
        );
        fixesApplied.push(`Created ${guardrailRelPath} (0o755)`);
      } else if (!hasExecutableMode(guardrailPath)) {
        fs.chmodSync(guardrailPath, 0o755);
        fixesApplied.push(`Restored 0o755 mode on ${guardrailRelPath}`);
      }

      if (
        mainHuskyUnderscore &&
        !isValidWorktreeHuskyLink(worktreeHuskyUnderscore, mainHuskyUnderscore)
      ) {
        fs.mkdirSync(mainHuskyUnderscore, { recursive: true });
        try {
          fs.lstatSync(worktreeHuskyUnderscore);
          fs.rmSync(worktreeHuskyUnderscore, { recursive: true, force: true });
        } catch {
          // Nothing to remove before linking.
        }
        fs.symlinkSync(
          mainHuskyUnderscore,
          worktreeHuskyUnderscore,
          process.platform === "win32" ? "junction" : "dir"
        );
        fixesApplied.push("Linked worktree .husky/_ to main checkout");
      }

      return {
        id: "git-hygiene-config",
        name: "Git Hooks & Commit Hygiene Standards",
        category: "quality",
        status: "fixed",
        message:
          "Installed and repaired Husky hooks, Claude hook modes, git-guardrail.sh permissions, and worktree links.",
        details: fixesApplied,
        fixedMessage: fixesApplied.join("; "),
      };
    }

    return {
      id: "git-hygiene-config",
      name: "Git Hooks & Commit Hygiene Standards",
      category: "quality",
      status: "fail",
      message: "Git hygiene hooks or executable permissions are incomplete.",
      details: issues,
      fixable: true,
    };
  }

  return {
    id: "git-hygiene-config",
    name: "Git Hooks & Commit Hygiene Standards",
    category: "quality",
    status: "pass",
    message:
      "Husky hooks, Claude PreToolUse wrappers, and git-guardrail.sh modes are properly configured.",
  };
}
