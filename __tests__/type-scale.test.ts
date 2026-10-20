// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const css = read("app/globals.css");

function utility(name: string): Record<string, string> {
  const start = css.indexOf(`@utility ${name} {`);
  expect(start, `${name} is defined`).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
  );
}

// The approved scale from #2311.
const SCALE = {
  "type-display": ["clamp(2.25rem, 5vw, 3.75rem)", "1.05", "800", "-0.035em"],
  "type-title": ["clamp(1.75rem, 3.5vw, 2.5rem)", "1.15", "800", "-0.03em"],
  "type-heading": ["1.5rem", "1.25", "700", "-0.02em"],
  "type-subheading": ["1.125rem", "1.4", "700", "-0.01em"],
  "type-body": ["clamp(0.9375rem, 1.2vw, 1.0625rem)", "1.6", "400", "0"],
  "type-small": ["0.8125rem", "1.4", "400", "0"],
} as const;

const PAGE_TITLES: Array<[string, keyof typeof SCALE]> = [
  ["app/contact/page.tsx", "type-display"],
  ["app/blog/page.tsx", "type-display"],
  ["app/case-studies/page.tsx", "type-display"],
  ["app/schedule/page.tsx", "type-display"],
  ["components/stack/StackOverviewView.tsx", "type-display"],
  ["app/blog/[slug]/page.tsx", "type-title"],
  ["app/case-studies/[slug]/page.tsx", "type-title"],
  ["app/error.tsx", "type-heading"],
];

describe("named type scale (#2311)", () => {
  it.each(Object.entries(SCALE))(
    "%s matches the approved step",
    (name, step) => {
      const [size, lineHeight, weight, tracking] = step;
      expect(utility(name)).toEqual({
        "font-size": size,
        "line-height": lineHeight,
        "font-weight": weight,
        "letter-spacing": tracking,
      });
    }
  );

  it.each(PAGE_TITLES)("%s titles its page with %s", (file, step) => {
    const h1 = read(file).match(/<h1[^>]*className="([^"]*)"/);
    expect(h1?.[1].split(/\s+/)).toContain(step);
    expect(h1?.[1]).not.toMatch(
      /(?:^|\s)(?:\w+:)?(?:text-\dxl|font-(?:bold|extrabold|black))/
    );
  });

  it.each([
    "app/blog/[slug]/page.tsx",
    "app/case-studies/[slug]/page.tsx",
    "components/SchemaFlowWorkspace.tsx",
    "components/UnifiedErrorLayout.tsx",
    "components/crf/Modes/AcrfOverlayViewer.tsx",
  ])("%s does not use font-black", (file) => {
    expect(read(file)).not.toMatch(/\bfont-black\b/);
  });
});
