// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { compile } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";

/**
 * #2325: Shift+Tab back from the footer parked focused controls under the
 * fixed navbar (WCAG 2.2 SC 2.4.11), because the page set no
 * scroll-padding-top. The real-browser journey lives in
 * __tests__/e2e/accessibility.spec.ts; this pins the CSS contract.
 */
const root = process.cwd();
const read = (file: string) =>
  fs.readFileSync(path.resolve(root, file), "utf-8");
const css = read("app/globals.css");

/** The body of the first top-level rule whose selector is exactly `selector`. */
function ruleBody(source: string, selector: string): string {
  const match = new RegExp(`(^|\\n)${selector}\\s*\\{`).exec(source);
  expect(match, `${selector} rule exists`).not.toBeNull();
  const start = (match?.index ?? 0) + (match?.[0].length ?? 0);
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

describe("the page scroller clears the fixed navbar (#2325)", () => {
  it("sets scroll-padding-top on the root from the navbar clearance", () => {
    expect(ruleBody(css, "html")).toMatch(
      /scroll-padding-top:\s*var\(--scroll-clearance\)/
    );
  });

  it("derives the clearance from the measured navbar plus its chrome", () => {
    const vars = ruleBody(css, ":root");
    const clearance = /--scroll-clearance:\s*([^;]+);/.exec(vars)?.[1] ?? "";
    expect(clearance).toContain("var(--navbar-height)");
    expect(clearance).toContain("var(--navbar-chrome)");
    expect(clearance).toContain("safe-area-inset-top");
    // --navbar-height is the header's content box (Navbar.tsx measures
    // contentRect), so the chrome must cover the at-rest py-5 padding and
    // the scrolled border. If the header's padding changes, change this too.
    expect(vars).toMatch(/--navbar-chrome:\s*calc\(2\.5rem \+ 1px\)/);
    const navbar = read("components/Navbar.tsx");
    expect(navbar).toContain("entry.contentRect.height");
    expect(navbar).toMatch(/border-b [^"]*py-3/);
    expect(navbar).toContain("py-5");
  });

  it("keeps existing anchor margins from doubling the padding", () => {
    for (const selector of [
      ".blog-prose :is(h2, h3, h4)",
      ".portfolio-home :is(#case-studies, #about, #contact)",
    ]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const margin =
        /scroll-margin-top:\s*([^;]+);/.exec(ruleBody(css, escaped))?.[1] ?? "";
      expect(margin, selector).toContain("- var(--scroll-clearance)");
      expect(margin, selector).toMatch(/^max\(\s*0px/);
    }
  });

  it("compiles scroll-mt-nav-* as the margin beyond the clearance", async () => {
    const compiler = await compile(css, {
      base: path.resolve(root, "app"),
      onDependency: () => {},
    });
    const out = compiler.build(["scroll-mt-nav-24"]);
    expect(out).toMatch(
      /\.scroll-mt-nav-24\s*\{\s*scroll-margin-top:\s*max\(\s*0px,\s*calc\(var\(--spacing\) \* 24 - var\(--scroll-clearance\)\)\s*\);/
    );
  });

  it("natively scrolled targets use scroll-mt-nav-*, not a fixed margin", () => {
    for (const file of [
      "components/protocol-drift/ProtocolDriftGame.tsx",
      "components/arcade/PlayCabinet.tsx",
      "app/case-studies/[slug]/page.tsx",
      "components/EngineeringBridge.tsx",
      "components/for-better-or-bulk/ReplayControls.tsx",
      "components/QuasiPerfectPuzzler/QuasiPerfectPuzzler.tsx",
      "components/study-director-world/DayCards.tsx",
      "components/study-director-world/StudyDirectorWorld.tsx",
      "components/stack/StackOverviewView.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/\bscroll-mt-(\d|\[)/);
    }
  });
});
