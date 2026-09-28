import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { getRouteSourceFilePath } from "../lib/fs-stat-mapping";

const workspaceRoot = path.resolve(__dirname, "..");

/** Recursively collects .tsx files under a directory. */
function collectTsx(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTsx(full);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [full] : [];
  });
}

const countH1 = (source: string): number =>
  (source.match(/<h1\b/gu) || []).length;

/**
 * `/crf` rendered no h1 on the server, and after hydration its h1 was whichever
 * mode panel happened to be open — so the document's top-level heading changed
 * as the operator switched modes, and an open modal could introduce a second.
 * Screen reader users navigate by heading level, and AGENTS.md section 10
 * commits this project to WCAG 2.1 AA.
 */
describe("Page heading hierarchy", () => {
  it("gives the CRF studio route exactly one page-level heading", () => {
    const source = fs.readFileSync(
      getRouteSourceFilePath("crf"),
      "utf8"
    );
    expect(countH1(source)).toBe(1);
    expect(source).toContain('className="sr-only"');
  });

  it("uses no h1 for panel titles inside the CRF studio", () => {
    const offenders = collectTsx(path.join(workspaceRoot, "components/crf"))
      .filter((file) => countH1(fs.readFileSync(file, "utf8")) > 0)
      .map((file) => path.relative(workspaceRoot, file));

    expect(
      offenders,
      "a mode panel or modal title is not the page title; the h1 belongs to app/crf/page.tsx"
    ).toEqual([]);
  });

  it("keeps the studio routes' page headings stable", () => {
    // The sibling studios were fixed the same way; they must not regress.
    for (const route of [
      "neuro",
      "patrol",
      "simulator",
      "crf",
    ]) {
      const source = fs.readFileSync(getRouteSourceFilePath(route), "utf8");
      expect(countH1(source), `${route} must declare exactly one h1`).toBe(1);
    }
  });

  it("leaves no CRF component heading level skipped from the page h1", () => {
    // With the page at h1, panel titles sit at h2 and their sections at h3.
    const files = collectTsx(path.join(workspaceRoot, "components/crf"));
    const hasH2 = files.some((file) =>
      /<h2\b/u.test(fs.readFileSync(file, "utf8"))
    );
    expect(hasH2).toBe(true);
  });
});
