import { spawnSync } from "child_process";
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

/**
 * Validates a commit message string against the Conventional Commits 1.0.0 specification.
 */
export function validateCommitMessage(message: string): CommitValidationResult {
  const cleanMsg = message.trim();
  const errors: string[] = [];

  if (!cleanMsg) {
    return { valid: false, errors: ["Commit message cannot be empty."] };
  }

  // Handle merge commits, squash headers, or automated release commits
  if (
    cleanMsg.startsWith("Merge ") ||
    cleanMsg.startsWith('Revert "') ||
    cleanMsg.startsWith("v") ||
    cleanMsg.startsWith("Release ")
  ) {
    return { valid: true, errors: [] };
  }

  // Extract first line (header)
  const header = cleanMsg.split("\n")[0].trim();

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
    // Subject should be lowercase start (soft convention)
    if (
      /^[A-Z]/.test(subject) &&
      !subject.startsWith("API") &&
      !subject.startsWith("DX") &&
      !subject.startsWith("WCAG") &&
      !subject.startsWith("AST") &&
      !subject.startsWith("CRF") &&
      !subject.startsWith("ADR")
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

export type HuskyLifecycleState =
  "active" | "uninitialized" | "disabled" | "custom" | "readonly" | "nongit";

export interface HuskyStatusResult {
  state: HuskyLifecycleState;
  detail?: string;
  hooksPath?: string;
}

/**
 * Detects the current operational lifecycle state of Husky git hooks.
 */
export function detectHuskyHookStatus(root: string): HuskyStatusResult {
  const envHusky = process.env.HUSKY;
  if (envHusky === "0" || envHusky === "false") {
    return {
      state: "disabled",
      detail: `HUSKY=${envHusky} is set in environment; hooks are intentionally bypassed.`,
    };
  }

  const gitCheck = spawnSync(
    "git",
    ["-C", root, "rev-parse", "--is-inside-work-tree"],
    { encoding: "utf-8" }
  );
  if (gitCheck.status !== 0) {
    return { state: "nongit", detail: "Not inside a Git worktree." };
  }

  const huskyDir = path.join(root, ".husky");
  if (!fs.existsSync(huskyDir)) {
    return { state: "nongit", detail: ".husky directory does not exist." };
  }

  const hooksPathCheck = spawnSync(
    "git",
    ["-C", root, "config", "--get", "core.hooksPath"],
    { encoding: "utf-8" }
  );
  const hooksPath = hooksPathCheck.stdout ? hooksPathCheck.stdout.trim() : "";

  if (hooksPath && hooksPath !== ".husky/_" && hooksPath !== ".husky/_/") {
    return {
      state: "custom",
      hooksPath,
      detail: `Custom core.hooksPath is configured: ${hooksPath}`,
    };
  }

  const dispatcherH = path.join(huskyDir, "_", "h");
  const preCommitDispatcher = path.join(huskyDir, "_", "pre-commit");

  if (
    fs.existsSync(dispatcherH) &&
    fs.existsSync(preCommitDispatcher) &&
    (hooksPath === ".husky/_" || hooksPath === ".husky/_/")
  ) {
    return { state: "active" };
  }

  try {
    fs.accessSync(root, fs.constants.W_OK);
    const gitDirResult = spawnSync(
      "git",
      ["-C", root, "rev-parse", "--git-dir"],
      { encoding: "utf-8" }
    );
    if (gitDirResult.status === 0 && gitDirResult.stdout.trim()) {
      const gitDir = path.resolve(root, gitDirResult.stdout.trim());
      fs.accessSync(gitDir, fs.constants.W_OK);
    }
  } catch {
    return {
      state: "readonly",
      detail: "Repository or git directory is read-only.",
    };
  }

  return {
    state: "uninitialized",
    detail:
      "Husky hook dispatchers (.husky/_) or core.hooksPath are uninitialized.",
  };
}

/**
 * Diagnostic check for Husky git hooks and commit hygiene policy.
 */
export function checkGitHygieneConfig(
  root: string,
  fix = false
): DiagnosticCheckResult {
  const huskyDir = path.join(root, ".husky");
  const preCommitHook = path.join(huskyDir, "pre-commit");
  const commitMsgHook = path.join(huskyDir, "commit-msg");

  const issues: string[] = [];

  if (!fs.existsSync(huskyDir)) {
    issues.push(".husky directory not found.");
  }

  if (!fs.existsSync(preCommitHook)) {
    issues.push(".husky/pre-commit hook not found.");
  }

  if (!fs.existsSync(commitMsgHook)) {
    issues.push(".husky/commit-msg hook not found.");
  }

  const hookStatus = detectHuskyHookStatus(root);

  if (hookStatus.state === "uninitialized") {
    issues.push(
      hookStatus.detail ??
        "Husky hook dispatchers (.husky/_) are uninitialized or core.hooksPath is unset."
    );
  } else if (hookStatus.state === "readonly") {
    issues.push(
      hookStatus.detail ??
        "Repository is read-only; Git hooks cannot be verified or updated."
    );
  }

  if (issues.length > 0) {
    if (fix) {
      if (!fs.existsSync(huskyDir)) fs.mkdirSync(huskyDir, { recursive: true });
      if (!fs.existsSync(commitMsgHook)) {
        fs.writeFileSync(
          commitMsgHook,
          `#!/bin/sh\nnpx tsx scripts/validate-commit-msg.ts "$1"\n`,
          { encoding: "utf-8", mode: 0o755 }
        );
      }
      if (hookStatus.state === "uninitialized") {
        const huskyPkgBin = path.join(root, "node_modules", "husky", "bin.js");
        const huskyBin = path.join(root, "node_modules", ".bin", "husky");
        if (fs.existsSync(huskyPkgBin)) {
          spawnSync(process.execPath, [huskyPkgBin], {
            cwd: root,
            encoding: "utf-8",
          });
        } else if (fs.existsSync(huskyBin)) {
          spawnSync(huskyBin, [], {
            cwd: root,
            encoding: "utf-8",
            shell: true,
          });
        } else {
          spawnSync("npx", ["--no-install", "husky"], {
            cwd: root,
            encoding: "utf-8",
            shell: true,
          });
        }
      }
      return {
        id: "git-hygiene-config",
        name: "Git Hooks & Commit Hygiene Standards",
        category: "quality",
        status: "fixed",
        message:
          "Installed and configured Husky git hooks for Conventional Commits.",
        fixedMessage:
          "Created commit-msg hook and initialized Husky core.hooksPath.",
      };
    }

    return {
      id: "git-hygiene-config",
      name: "Git Hooks & Commit Hygiene Standards",
      category: "quality",
      status: "fail",
      message: "Git hygiene hooks are incomplete or uninitialized.",
      details: issues,
      fixable: true,
    };
  }

  if (hookStatus.state === "disabled") {
    return {
      id: "git-hygiene-config",
      name: "Git Hooks & Commit Hygiene Standards",
      category: "quality",
      status: "pass",
      message:
        hookStatus.detail ??
        "Husky hooks are intentionally disabled via environment (HUSKY).",
    };
  }

  if (hookStatus.state === "custom") {
    return {
      id: "git-hygiene-config",
      name: "Git Hooks & Commit Hygiene Standards",
      category: "quality",
      status: "pass",
      message:
        hookStatus.detail ??
        "Custom core.hooksPath configured; preserving user hooks.",
    };
  }

  return {
    id: "git-hygiene-config",
    name: "Git Hooks & Commit Hygiene Standards",
    category: "quality",
    status: "pass",
    message:
      "Husky pre-commit and commit-msg hooks are properly configured for Conventional Commits.",
  };
}
