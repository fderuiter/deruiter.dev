import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileDocumentation } from "./compile-docs";
import { sameExceptUnionOrder } from "./docs-union-order";

export interface DocumentationGitStatus {
  modified: string[];
  untracked: string[];
}

export interface DocumentationDriftOptions {
  workspaceRoot: string;
  compile: (outputDirectory: string) => void;
  getGitStatus: () => DocumentationGitStatus;
  /**
   * Path (relative to workspaceRoot, forward-slash normalized) where
   * compiled TypeDoc reference output is checked in, e.g.
   * "docs/reference/api" (ADR 0023). Defaults to "docs" so callers that
   * don't relocate generated output keep comparing against the docs root.
   */
  generatedDocsRelativePath?: string;
}

export interface DocumentationDriftResult {
/* jscpd:ignore-start */
  status: "pass" | "fail" | "error";
  details: string[];
}

function listFiles(directory: string, relativeDirectory = ""): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory()
/* jscpd:ignore-end */
      ? listFiles(absolutePath, relativePath)
      : [relativePath];
  });
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function getGeneratedDifferences(
  generatedDirectory: string,
  docsDirectory: string,
  displayPrefix: string
): string[] {
  return listFiles(generatedDirectory).flatMap((relativePath) => {
    const generatedPath = path.join(generatedDirectory, relativePath);
    const documentationPath = path.join(docsDirectory, relativePath);
    const displayPath = `${displayPrefix}/${normalizePath(relativePath)}`;
    if (!fs.existsSync(documentationPath)) {
      return [`Stale generated reference: missing ${displayPath}`];
    }
    // Literal-union order is load-order noise, not drift (#951).
    return sameExceptUnionOrder(
      fs.readFileSync(generatedPath, "utf8"),
      fs.readFileSync(documentationPath, "utf8")
    )
      ? []
      : [
          `Stale generated reference: ${displayPath} differs from generated output`,
        ];
  });
}

function classifyWorkingTreeChanges(
  gitStatus: DocumentationGitStatus,
  generatedFiles: Set<string>,
  generatedDocsRelativePath: string
): string[] {
  const generatedPrefix = `${normalizePath(generatedDocsRelativePath)}/`;

  const classify = (filePath: string, state: "modified" | "untracked") => {
    const normalizedFull = normalizePath(filePath);
    const displayPath = normalizedFull.replace(/^docs\//u, "");
    const isGenerated =
      normalizedFull.startsWith(generatedPrefix) &&
      generatedFiles.has(normalizedFull.slice(generatedPrefix.length));
    if (isGenerated) {
      return `Stale generated reference: docs/${displayPath} is ${state}`;
    }
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
 * Compiles generated documentation into a temporary destination and compares it
 * with the checked-in references without mutating the workspace.
 */
export function checkDocumentationDrift({
  workspaceRoot,
  compile,
  getGitStatus,
  generatedDocsRelativePath = "docs",
}: DocumentationDriftOptions): DocumentationDriftResult {
  const outputDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "portfolio-docs-check-")
  );
  const docsDirectory = path.join(workspaceRoot, generatedDocsRelativePath);

  try {
    try {
      compile(outputDirectory);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "error",
        details: [`Documentation generator failed: ${message}`],
      };
    }

    const generatedFiles = new Set(
      listFiles(outputDirectory).map(normalizePath)
    );
    const details = [
      ...getGeneratedDifferences(
        outputDirectory,
        docsDirectory,
        normalizePath(generatedDocsRelativePath)
      ),
      ...classifyWorkingTreeChanges(
        getGitStatus(),
        generatedFiles,
        generatedDocsRelativePath
      ),
    ];
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
