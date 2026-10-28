import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileDocumentation } from "./compile-docs";

export interface DocumentationGitStatus {
  modified: string[];
  untracked: string[];
}

export interface DocumentationDriftOptions {
  workspaceRoot: string;
  /** Compiles TypeDoc strictly into the given scratch directory. */
  compile: (outputDirectory: string) => void;
  getGitStatus: () => DocumentationGitStatus;
}

export interface DocumentationDriftResult {
  status: "pass" | "fail" | "error";
  details: string[];
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function classifyWorkingTreeChanges(
  gitStatus: DocumentationGitStatus
): string[] {
  const classify = (filePath: string, state: "modified" | "untracked") => {
    const displayPath = normalizePath(filePath).replace(/^docs\//u, "");
    const action =
      state === "modified"
        ? "Stage or revert the authored edit"
        : "Stage or remove the authored report";
    return `Authored documentation ${state}: docs/${displayPath}. ${action}.`;
  };

  return [
    ...gitStatus.modified.map((filePath) => classify(filePath, "modified")),
    ...gitStatus.untracked.map((filePath) => classify(filePath, "untracked")),
  ];
}

/**
 * Compiles the API reference into a scratch directory, so a broken doc comment
 * fails here, and reports authored files under docs/ that are not staged. The
 * compiled reference itself is not committed (ADR 0023, amended 2026-10-28),
 * so there is nothing generated to compare against.
 */
export function checkDocumentationDrift({
  compile,
  getGitStatus,
}: DocumentationDriftOptions): DocumentationDriftResult {
  const outputDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "portfolio-docs-check-")
  );

  try {
    try {
      compile(outputDirectory);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        details: [
          `Documentation generator failed: ${message}`,
          "Fix the doc comment TypeDoc names above; `npm run compile-docs` prints the same warnings.",
        ],
      };
    }

    const details = classifyWorkingTreeChanges(getGitStatus());
    return details.length === 0
      ? { status: "pass", details }
      : { status: "fail", details };
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
}

export function getDocumentationGitStatus(
  workspaceRoot: string
): DocumentationGitStatus {
  const list = (args: string[]) =>
    execFileSync("git", args, {
      cwd: workspaceRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter(Boolean);

  return {
    modified: list(["diff", "--name-only", "--", "docs"]),
    untracked: list(["ls-files", "--others", "--exclude-standard", "docs"]),
  };
}

export { compileDocumentation };
