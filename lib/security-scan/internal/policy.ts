import fs from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";
import { getDetectorsForSurface, scanText } from "./scan";
import type {
  RepositoryScanContent,
  ScanFinding,
  SecretDetector,
} from "../types";

const IGNORED_LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

/**
 * Vendor, VCS, build, and duplicate-sandbox folder segments that are skipped
 * wherever they appear in a repository-relative path.
 */
const IGNORED_SEGMENT_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".stryker-tmp",
]);

/**
 * Root-anchored vendor, build, cache, and generated output prefixes that are
 * skipped during repository scans.
 */
const IGNORED_ROOT_PREFIXES = [
  "out/",
  "dist/",
  "build/",
  "coverage/",
  ".vercel/",
  ".claude/worktrees/",
  ".agents/worktrees/",
  ".husky/_/",
  "playwright-report/",
  "test-results/",
  "blob-report/",
  "reports/",
  ".vitest/",
  ".nyc_output/",
  ".benchmark-results/",
  "docs/reference/api/",
  "app/generated/prisma/",
  "scripts/r/renv/library/",
  ".yarn/cache/",
  ".yarn/unplugged/",
] as const;

function normalizeRepositoryPath(filePath: string): string {
  const posix = filePath.replaceAll("\\", "/").trim();
  if (!posix) return "";

  if (path.posix.isAbsolute(posix)) {
    const cwdPosix = process.cwd().replaceAll("\\", "/");
    if (posix === cwdPosix) return "";
    if (posix.startsWith(`${cwdPosix}/`)) {
      return posix.slice(cwdPosix.length + 1).replace(/^(?:\.\/)+/, "");
    }
    return posix.replace(/^\/+/, "");
  }

  return posix.replace(/^(?:\.\/)+/, "");
}

function isTestsPath(normalizedPath: string): boolean {
  return (
    normalizedPath === "__tests__" ||
    normalizedPath.startsWith("__tests__/") ||
    normalizedPath.includes("/__tests__/")
  );
}

function getDetectorsForRepositoryPath(
  normalizedPath: string
): readonly SecretDetector[] {
  return isTestsPath(normalizedPath)
    ? getDetectorsForSurface("historyAudit")
    : getDetectorsForSurface("contentGuard");
}

/**
 * Returns whether a repository-relative path should be scanned for secrets.
 *
 * Skips only vendor/VCS/build/output folders and package-manager lockfiles so
 * `.env*`, `__tests__/`, `.husky/*`, `.claude/hooks/*`, `.github/workflows/*`,
 * shell scripts, and all other non-binary tracked files stay in scope.
 */
export function shouldScanRepositoryPath(filePath: string): boolean {
  const normalized = normalizeRepositoryPath(filePath);
  if (!normalized) return false;

  const trimmed = normalized.replace(/\/+$/, "");
  if (!trimmed) return false;

  const baseName = path.posix.basename(trimmed);
  if (IGNORED_LOCKFILES.has(baseName)) {
    return false;
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => IGNORED_SEGMENT_DIRS.has(segment))) {
    return false;
  }

  const withTrailingSlash = `${trimmed}/`;
  for (const prefix of IGNORED_ROOT_PREFIXES) {
    if (withTrailingSlash.startsWith(prefix)) {
      return false;
    }
  }

  return true;
}

/**
 * Scans text or a raw byte buffer under the unified repository policy:
 * skips excluded vendor/build/lockfile paths and NUL-containing binary
 * buffers, runs all 16 `historyAudit` detectors on every eligible file, and
 * additionally runs `database-url-bare` and `generic-assigned-secret` outside
 * `__tests__/`.
 */
export function scanRepositoryText(
  content: RepositoryScanContent,
  file = ""
): ScanFinding[] {
  const normalized = file ? normalizeRepositoryPath(file) : "";
  if (file && !shouldScanRepositoryPath(normalized || file)) {
    return [];
  }

  let text: string;
  if (typeof content === "string") {
    if (content.includes("\0")) return [];
    text = content;
  } else {
    if (content.includes(0)) return [];
    text = Buffer.from(
      content.buffer,
      content.byteOffset,
      content.byteLength
    ).toString("utf-8");
  }

  const detectors = getDetectorsForRepositoryPath(normalized);
  return scanText(text, file, detectors);
}

/**
 * Reads `filePath` as a raw buffer and scans it under the unified repository
 * policy, skipping directories, directory symlinks, excluded paths, and NUL
 * binary files.
 */
export function scanRepositoryFile(
  filePath: string,
  reportedFile = filePath
): ScanFinding[] {
  if (!shouldScanRepositoryPath(reportedFile)) {
    return [];
  }

  try {
    if (!fs.existsSync(filePath)) return [];
    if (!fs.statSync(filePath).isFile()) return [];
    const buffer = fs.readFileSync(filePath);
    if (buffer.includes(0)) return [];
    return scanRepositoryText(buffer, reportedFile);
  } catch (error) {
    logger.error(`Error scanning file ${filePath}:`, error);
    return [];
  }
}
