import { execSync } from "child_process";
import path from "path";
import { formatFinding, scanFile } from "../lib/security-scan";

function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=d", {
      encoding: "utf-8",
    });
    return output
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  } catch (error) {
    console.error("Error executing git command:", error);
    return [];
  }
}

export function shouldScanFile(filePath: string): boolean {
  // Exclude node_modules, package locks, binary files, configurations that are meant to hold env configs, etc.
  const ignoredExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".db",
    ".zip",
    ".tar",
    ".gz",
    ".pdf",
    ".mp4",
    ".mov",
  ];
  const ignoredFiles = [
    "package-lock.json",
    "bun.lock",
    "yarn.lock",
    "pnpm-lock.yaml",
  ];
  const ignoredDirectories = [
    "node_modules/",
    ".git/",
    ".next/",
    "dist/",
    "build/",
    "__tests__/",
  ];

  const baseName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (
    ignoredExtensions.includes(ext) ||
    ignoredFiles.includes(baseName) ||
    baseName.startsWith(".env")
  ) {
    return false;
  }

  for (const dir of ignoredDirectories) {
    if (filePath.startsWith(dir) || filePath.includes("/" + dir)) {
      return false;
    }
  }

  return true;
}

function main() {
  const startTime = Date.now();
  console.log("Starting Pre-Commit Regex Guards validation...");

  const stagedFiles = getStagedFiles();

  // Block the inclusion of alternative lockfiles
  const alternativeLockfiles = [
    "bun.lock",
    "bun.lockb",
    "yarn.lock",
    "pnpm-lock.yaml",
  ];
  for (const file of stagedFiles) {
    const baseName = path.basename(file);
    if (alternativeLockfiles.includes(baseName)) {
      console.error(`\n❌ [BLOCKER] Alternative lockfile detected: ${file}`);
      console.error(
        "This repository has standardized on npm exclusively. Alternative lockfiles are strictly prohibited.\n"
      );
      process.exit(1);
    }
  }

  let hasViolation = false;

  for (const file of stagedFiles) {
    if (!shouldScanFile(file)) {
      continue;
    }

    const absolutePath = path.resolve(process.cwd(), file);
    const findings = scanFile(absolutePath, file);

    if (findings.length > 0) {
      hasViolation = true;
      console.error(
        `\n❌ [SECURITY ALERT] Sensitive information or credential pattern detected in staged file: ${file}`
      );
      for (const finding of findings) {
        console.error(formatFinding(finding));
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`Pre-Commit validation completed in ${duration}ms.`);

  if (hasViolation) {
    console.error(
      "\n❌ Commit blocked. Please sanitize all highlighted credentials before committing.\n"
    );
    process.exit(1);
  } else {
    console.log(
      "✅ Pre-Commit validation passed. No credential patterns detected."
    );
    process.exit(0);
  }
}

if (typeof process.env.VITEST === "undefined") {
  main();
}
