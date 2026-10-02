// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  formatFinding,
  isAllowlistedSecretValue,
  scanHistorySnapshot,
  type HistoryFinding,
  type SecretDetector,
} from "@/lib/security-scan";

describe("secret audit output", () => {
  it("never echoes a detected value or its source line", () => {
    const finding: HistoryFinding = {
      detectorId: "github-token",
      category: "GitHub token",
      file: "src/config.ts",
      line: 12,
      commit: "a".repeat(40),
    };

    const output = formatFinding(finding);
    expect(output).toContain("src/config.ts:12");
    expect(output).toContain("value redacted");
    expect(output).not.toMatch(/ghp_[A-Za-z0-9]/);
  });

  it("formats a worktree (non-history) finding without a commit", () => {
    const output = formatFinding({
      detectorId: "aws-access-key",
      category: "AWS access key ID",
      file: "leaked.ts",
      line: 3,
    });
    expect(output).toBe("  - leaked.ts:3 [AWS access key ID] (value redacted)");
  });

  it("allows explicit local examples but not realistic remote credentials", () => {
    expect(
      isAllowlistedSecretValue(
        "postgresql://postgres:postgres@localhost:5432/portfolio_ci",
        ".github/workflows/ci.yml"
      )
    ).toBe(true);
    const remoteCredential = [
      "postgresql://owner:",
      "realistic-secret@remote.example.net/database",
    ].join("");
    expect(isAllowlistedSecretValue(remoteCredential, "docs/leak.md")).toBe(
      false
    );
  });

  it("reports only redacted metadata for a candidate", () => {
    const detectedToken = ["ghp_", "abcdefghijklmnopqrstuvwxyz1234567890"].join(
      ""
    );
    const detector: SecretDetector = {
      id: "github-token",
      description: "GitHub token",
      regex: /ghp_[A-Za-z0-9]{20,}/g,
      gitPattern: "ghp_[A-Za-z0-9]{20,}",
      appliesTo: ["historyAudit"],
    };

    const findings = scanHistorySnapshot(
      `const token = '${detectedToken}';`,
      { commit: "a".repeat(40), file: "src/config.ts" },
      [detector]
    );

    expect(findings).toEqual([
      {
        commit: "a".repeat(40),
        file: "src/config.ts",
        detectorId: "github-token",
        category: "GitHub token",
        line: 1,
      },
    ]);
    expect(JSON.stringify(findings)).not.toContain(detectedToken);
  });
});
