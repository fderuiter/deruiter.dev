import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findClinicalClaims } from "@/lib/clinical-platform";

const root = process.cwd();

/**
 * Clinical surfaces and their copy sources (#2705). Arcade games are not
 * scanned: they are framed as games, not as evidence. The policy module is
 * left out because it names the phrases in order to ban them.
 */
const SCANNED = [
  "app/crf",
  "app/platform",
  "components/platform",
  "app/study-data",
  "components/crf",
  "lib/crf",
  "lib/study-data",
  "lib/clinical-platform",
  "lib/fallback-blog-posts.ts",
  "lib/og-image.tsx",
  "components/RetroChaosOverlay.tsx",
  "CONTEXT.md",
];
const EXCLUDED = new Set(["lib/clinical-platform/internal/policy.ts"]);
const EXTENSIONS = /\.(?:ts|tsx|md)$/;

function collect(relative: string): string[] {
  const absolute = path.join(root, relative);
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    return [];
  }
  if (stats.isFile()) return EXTENSIONS.test(relative) ? [relative] : [];
  return readdirSync(absolute).flatMap((entry) =>
    collect(path.posix.join(relative, entry))
  );
}

const files = SCANNED.flatMap(collect).filter((file) => !EXCLUDED.has(file));

describe("findClinicalClaims", () => {
  it("flags the phrases removed in #2705", () => {
    for (const claim of [
      "100% CDISC &amp; SDTM Compliant",
      "✔ 100% Compliant",
      "CDISC CDASH 2.2 compliant standard forms",
      "FDA-compliant CDISC ODM and SDTM datasets",
      "REGULATORY COMPLIANT CASE REPORT FORM BOOK",
      "comply with CDISC CDASH 2.2 and 21 CFR Part 11 requirements",
      "21 CFR Part 11 Immutable Audit Trail Log",
      "CDISC COMPLIANT // GxP READY",
      "21 CFR Part 11: Valid",
      "SDTM metadata &amp; 21 CFR Part 11 conformance",
      "satisfying FDA 21 CFR Part 11 electronic record requirements",
      "Live 21 CFR EDC",
      "conform strictly to CDASH 2.2",
    ]) {
      expect(findClinicalClaims(claim), claim).not.toEqual([]);
    }
  });

  it("allows descriptions of what is implemented", () => {
    for (const honest of [
      "No findings from the implemented checks",
      "Part 11-style audit trail (simulation)",
      "Modelled on CDISC CDASHIG 2.2. Synthetic demo, not a validated system.",
      "RFC-4180 compliant tabular CSV format",
      "Date default value not compliant with ISO 8601",
      "Three non-compliant records.",
    ]) {
      expect(findClinicalClaims(honest), honest).toEqual([]);
    }
  });
});

describe("clinical surfaces make no compliance claims", () => {
  it("scans a meaningful set of files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)("%s", (file) => {
    const text = readFileSync(path.join(root, file), "utf8");
    expect(findClinicalClaims(text).map((finding) => finding.message)).toEqual(
      []
    );
  });
});
