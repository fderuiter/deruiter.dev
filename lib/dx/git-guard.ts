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
 * Validates branch names against team convention: feat/*, fix/*, chore/*, refactor/*, docs/*, perf/*, dx/*, test/*, dev/*, jules/* (branches opened by the Jules agent), main, master.
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
    "dev/",
    "jules/",
  ];
  const hasValidPrefix = validPrefixes.some((p) => cleanBranch.startsWith(p));

  if (!hasValidPrefix) {
    return {
      valid: false,
      error: `Branch name '${cleanBranch}' does not follow convention. Expected prefixes: ${validPrefixes.join(", ")} (e.g. feat/add-dx-suite)`,
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
      return {
        id: "git-hygiene-config",
        name: "Git Hooks & Commit Hygiene Standards",
        category: "quality",
        status: "fixed",
        message:
          "Installed and configured Husky git hooks for Conventional Commits.",
        fixedMessage: "Created .husky/commit-msg hook.",
      };
    }

    return {
      id: "git-hygiene-config",
      name: "Git Hooks & Commit Hygiene Standards",
      category: "quality",
      status: "fail",
      message: "Git hygiene hooks are incomplete.",
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
      "Husky pre-commit and commit-msg hooks are properly configured for Conventional Commits.",
  };
}
