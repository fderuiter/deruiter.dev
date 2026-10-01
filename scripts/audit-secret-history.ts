import { execFileSync } from "node:child_process";
import fs from "node:fs";
import {
  formatFinding,
  getDetectorsForSurface,
  scanHistorySnapshot,
  type HistoryFinding,
  type SecretDetector,
} from "../lib/security-scan";

interface Candidate {
  commit: string;
  file: string;
}

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function candidatesFor(detector: SecretDetector): Candidate[] {
  const output = git([
    "log",
    "HEAD",
    "--full-history",
    `-G${detector.gitPattern}`,
    "--format=commit:%H",
    "--name-only",
    "--no-renames",
  ]);
  const candidates: Candidate[] = [];
  let commit = "";

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("commit:")) {
      commit = line.slice("commit:".length);
    } else if (commit && line.trim()) {
      candidates.push({ commit, file: line.trim() });
    }
  }

  return candidates;
}

function readVersions({ commit, file }: Candidate): string[] {
  const versions: string[] = [];
  for (const revision of [commit, `${commit}^`]) {
    try {
      versions.push(git(["show", `${revision}:${file}`]));
    } catch {
      // Added and deleted files only exist on one side of their commit.
    }
  }
  return versions;
}

function dedupe(findings: HistoryFinding[]): HistoryFinding[] {
  return findings.filter(
    (finding, index, all) =>
      index ===
      all.findIndex(
        (other) =>
          other.commit === finding.commit &&
          other.file === finding.file &&
          other.detectorId === finding.detectorId &&
          other.line === finding.line
      )
  );
}

/**
 * Pickaxe-searches every reachable commit for each `historyAudit` detector's
 * `gitPattern`, then re-scans just the candidate commits (and their parent,
 * to catch deletions) with that same single detector. Scoping each rescan
 * to the detector that found the candidate avoids re-flagging an unrelated,
 * already-known match elsewhere in a large file on every commit that merely
 * touches it.
 */
export function auditSecretHistory(): HistoryFinding[] {
  const findings: HistoryFinding[] = [];
  const inspected = new Set<string>();

  for (const detector of getDetectorsForSurface("historyAudit")) {
    for (const candidate of candidatesFor(detector)) {
      const key = `${detector.id}:${candidate.commit}:${candidate.file}`;
      if (inspected.has(key)) continue;
      inspected.add(key);
      for (const content of readVersions(candidate)) {
        findings.push(...scanHistorySnapshot(content, candidate, [detector]));
      }
    }
  }

  return dedupe(findings);
}

export function auditCurrentTree(): HistoryFinding[] {
  const findings: HistoryFinding[] = [];
  const files = git([
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
  ])
    .split("\0")
    .filter(Boolean);

  for (const file of files) {
    try {
      const buffer = fs.readFileSync(file);
      if (buffer.includes(0)) continue;
      const content = buffer.toString("utf8");
      findings.push(
        ...scanHistorySnapshot(content, { commit: "WORKTREE", file })
      );
    } catch {
      // Files may disappear between the Git listing and the filesystem read.
    }
  }

  return findings;
}

function main(): void {
  const commitCount = git(["rev-list", "HEAD", "--count"]).trim();
  const detectorCount = getDetectorsForSurface("historyAudit").length;
  console.log(
    `Scanning the current worktree and ${commitCount} reachable commits for ${detectorCount} high-confidence secret patterns...`
  );
  const findings = [...auditCurrentTree(), ...auditSecretHistory()];

  if (findings.length > 0) {
    console.error(
      `Secret history audit found ${findings.length} potential exposure(s). Values are redacted.`
    );
    for (const finding of findings) {
      console.error(formatFinding(finding));
    }
    process.exitCode = 1;
    return;
  }

  console.log("Secret history audit passed with no unallowlisted matches.");
}

if (typeof process.env.VITEST === "undefined") main();
