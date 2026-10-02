// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression cover for the duplicate landmark findings in #727.
 *
 * `app/layout.tsx` renders the one `<main id="main-content" tabIndex={-1}>`
 * that AGENTS.md section 10 requires and `<SkipToContent />` targets. Nine
 * components rendered a second `<main>` inside it, which axe reported three
 * ways at once -- `landmark-no-duplicate-main`, `landmark-main-is-top-level`
 * and `landmark-unique` -- for 58 of the 134 violation instances in a single
 * CI run.
 *
 * `components/PageLayout.tsx` already documents the rule and will not accept
 * `as="main"`; these components bypassed it by writing the tag directly.
 */
describe("Single Main Landmark", () => {
  const roots = ["app", "components"];

  const sources = roots.flatMap((root) => {
    const dir = path.resolve(process.cwd(), root);
    const walk = (current: string): string[] =>
      fs.readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith(".tsx") ? [full] : [];
      });
    return walk(dir);
  });

  /**
   * PageLayout's own doc comment mentions `<main>`, so the scan has to read
   * code rather than prose.
   */
  const stripComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const withMain = sources.filter((file) =>
    /<main(?=[\s>])/.test(stripComments(fs.readFileSync(file, "utf-8")))
  );

  it("scans the component tree", () => {
    expect(sources.length).toBeGreaterThan(50);
  });

  it("renders exactly one <main> element, in the root layout", () => {
    const relative = withMain
      .map((f) => path.relative(process.cwd(), f).replace(/\\/g, "/"))
      .sort();
    expect(relative).toEqual(["app/layout.tsx"]);
  });

  it("keeps the root layout's main addressable by the skip link", () => {
    const layout = fs.readFileSync(
      path.resolve(process.cwd(), "app/layout.tsx"),
      "utf-8"
    );
    expect(layout).toMatch(/id="main-content"/);
  });
});
