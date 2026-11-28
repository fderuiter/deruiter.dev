import { execFileSync } from "child_process";
import path from "path";
import {
  formatFinding,
  scanRepositoryText,
  shouldScanRepositoryPath,
} from "../lib/security-scan";

export function getStagedFiles(): string[] {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=d", "-z"],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return output.split("\0").filter((f) => f.length > 0);
}

function getStagedFileBuffer(filePath: string): Buffer {
  // Explicit stage zero prevents a pathname such as 0:config.ts from
  // selecting the unrelated config.ts index entry.
  return execFileSync("git", ["show", `:0:${filePath}`], {
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function getStagedFileContent(filePath: string): string {
  return getStagedFileBuffer(filePath).toString("utf-8");
}

export function shouldScanFile(filePath: string): boolean {
  return shouldScanRepositoryPath(filePath);
}

function main() {
  const startTime = Date.now();
  console.log("Starting Pre-Commit Regex Guards validation...");

  let stagedFiles: string[];
  try {
    stagedFiles = getStagedFiles();
  } catch {
    console.error(
      "❌ [BLOCKER] Failed to enumerate staged files from Git index. Check Git index health."
    );
    process.exit(1);
  }

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

    let stagedBuffer: Buffer;
    try {
      stagedBuffer = getStagedFileBuffer(file);
    } catch {
      // Child-process errors can contain raw indexed stdout. Never print
      // the error object or captured streams before redacted scanning.
      console.error(
        `\n❌ [BLOCKER] Failed to read staged content from Git index for file: ${file}. Check staged file size and Git index health.`
      );
      hasViolation = true;
      break;
    }

    const findings = scanRepositoryText(stagedBuffer, file);

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
