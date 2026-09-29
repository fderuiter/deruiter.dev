import fs from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";
import { SECRET_DETECTORS } from "./catalog";
import { isAllowlistedSecretValue } from "./allowlist";
import type {
  HistoryFinding,
  ScanFinding,
  ScannerSurface,
  SecretDetector,
} from "../types";

/** Detectors whose `appliesTo` includes the given scanning surface. */
export function getDetectorsForSurface(
  surface: ScannerSurface
): readonly SecretDetector[] {
  return SECRET_DETECTORS.filter((detector) =>
    (detector.appliesTo as readonly ScannerSurface[]).includes(surface)
  );
}

function normalizeAllowlistPath(file: string): string {
  const posix = file.replaceAll("\\", "/");
  return path.isAbsolute(posix)
    ? path.relative(process.cwd(), file).replaceAll("\\", "/")
    : posix;
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

/**
 * Scans text against every `contentGuard`-surface detector, reporting at
 * most one finding per line (the first detector to match), mirroring the
 * behavior DX Doctor and the pre-commit guard have always relied on.
 *
 * `file` identifies the source for allowlist purposes (and is echoed back
 * on the returned finding); it may be an absolute path, in which case it is
 * normalized relative to `process.cwd()` before allowlist lookups.
 */
export function scanText(text: string, file = ""): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const allowlistFile = normalizeAllowlistPath(file);
  const detectors = getDetectorsForSurface("contentGuard");
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    for (const detector of detectors) {
      detector.regex.lastIndex = 0;
      const match = line.match(detector.regex);
      if (!match) continue;
      // A line yields at most one verdict: once any detector matches, stop
      // checking the rest even if this match turns out to be allowlisted.
      // Otherwise a broader detector (e.g. the bare-URL pattern) could
      // re-fire on the same credentialed URL a stricter detector just
      // cleared, since it matches a different substring of the same line.
      if (!isAllowlistedSecretValue(match[0], allowlistFile)) {
        findings.push({
          detectorId: detector.id,
          category: detector.description,
          file,
          line: index + 1,
        });
      }
      break;
    }
  }

  return findings;
}

/** Reads `filePath` and scans it with {@link scanText}. */
export function scanFile(
  filePath: string,
  reportedFile = filePath
): ScanFinding[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    if (!fs.statSync(filePath).isFile()) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    return scanText(content, reportedFile);
  } catch (error) {
    logger.error(`Error scanning file ${filePath}:`, error);
    return [];
  }
}

/**
 * Scans a single snapshot of file content (a working-tree file, or a file
 * as it existed at a specific commit) against every match of every given
 * detector, reporting every occurrence rather than one-per-line. Defaults
 * to the full `historyAudit`-surface detector set; callers auditing a
 * pickaxe candidate for one specific detector should narrow it explicitly
 * so an unrelated pre-existing match elsewhere in the file isn't
 * re-reported against every commit that merely touches the file.
 */
export function scanHistorySnapshot(
  content: string,
  candidate: { readonly commit: string; readonly file: string },
  detectors: readonly SecretDetector[] = getDetectorsForSurface("historyAudit")
): HistoryFinding[] {
  const findings: HistoryFinding[] = [];
  const allowlistFile = normalizeAllowlistPath(candidate.file);
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    for (const detector of detectors) {
      detector.regex.lastIndex = 0;
      for (const match of line.matchAll(detector.regex)) {
        if (isAllowlistedSecretValue(match[0], allowlistFile)) continue;
        findings.push({
          detectorId: detector.id,
          category: detector.description,
          file: candidate.file,
          line: index + 1,
          commit: candidate.commit,
        });
      }
    }
  }

  return findings;
}
