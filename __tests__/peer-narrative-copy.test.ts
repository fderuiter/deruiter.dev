/**
 * ADR 0047 regression gate: user-facing source must not drift back to
 * job-seeking or recruiter framing. The site is a peer engineering showcase.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LEGACY_SUMMARY_PERSONA_VALUE } from "@/lib/persona";

const ROOT = process.cwd();

/** Directories whose every .ts/.tsx file renders or feeds public pages. */
const SCANNED_DIRS = ["app", "components", "hooks", "lib/blog"];

/**
 * Content modules in lib/ that hold page copy. The rest of lib/ is engine and
 * tooling code, where words like "job" mean a background task.
 */
const SCANNED_FILES = [
  "lib/i18n-dictionary.ts",
  "lib/case-studies-data.ts",
  "lib/fallback-blog-posts.ts",
  "lib/faq-content.ts",
  "lib/seo-metadata.ts",
  "lib/seo.ts",
  "lib/og-dossier.ts",
  "lib/engineering-bridges.ts",
  "lib/media-registry.ts",
  "lib/persona.ts",
  "public/llms.txt",
  "public/llms-full.txt",
];

const DEPRECATED: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "recruiter", pattern: /recruiter/i },
  { label: "a role I might fit", pattern: /a role I might fit/i },
  { label: "a job", pattern: /\ba job\b/i },
  {
    label: "the exact skills Fred brings",
    pattern: /the exact skills Fred brings/i,
  },
  {
    label: "hiring engineering leaders",
    pattern: /hiring engineering leaders/i,
  },
];

/**
 * Exact lines allowed to contain a deprecated phrase, with the reason.
 * Keep this list as short as the reasons are good.
 */
const ALLOWED_LINES: ReadonlyArray<{
  file: string;
  line: string;
  why: string;
}> = [
  {
    file: "lib/persona.ts",
    line: `export const LEGACY_SUMMARY_PERSONA_VALUE = "${LEGACY_SUMMARY_PERSONA_VALUE}";`,
    why: "Storage migration must spell the pre-rename value to map it to Professional.",
  },
];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

function scannedFiles(): string[] {
  const files = new Set<string>();
  for (const dir of SCANNED_DIRS) walk(dir).forEach((f) => files.add(f));
  for (const file of SCANNED_FILES) {
    if (fs.existsSync(path.join(ROOT, file))) files.add(file);
  }
  return [...files].map((f) => f.split(path.sep).join("/")).sort();
}

describe("peer engineering narrative copy (ADR 0047)", () => {
  const files = scannedFiles();

  it("scans the user-facing source tree", () => {
    expect(files).toContain("app/page.tsx");
    expect(files).toContain("app/contact/page.tsx");
    expect(files).toContain("components/Navbar.tsx");
    expect(files).toContain("lib/i18n-dictionary.ts");
    expect(files.length).toBeGreaterThan(100);
  });

  it("contains zero deprecated job-seeking phrases outside the allowlist", () => {
    const violations: string[] = [];
    for (const file of files) {
      const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
      lines.forEach((text, idx) => {
        for (const { label, pattern } of DEPRECATED) {
          if (!pattern.test(text)) continue;
          const allowed = ALLOWED_LINES.some(
            (a) => a.file === file && text.trim() === a.line
          );
          if (!allowed) violations.push(`${file}:${idx + 1} "${label}"`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it("keeps every allowlisted line present, so stale exceptions are removed", () => {
    for (const { file, line } of ALLOWED_LINES) {
      const source = fs.readFileSync(path.join(ROOT, file), "utf8");
      expect(source.split("\n").map((l) => l.trim())).toContain(line);
    }
  });
});
