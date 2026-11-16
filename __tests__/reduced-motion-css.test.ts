import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Reduced motion is handled case by case (#3976), as the motion guide in
 * GoogleChrome/modern-web-guidance asks: no global 0.01ms clamp, decorative
 * loops opt in with motion-safe:, and spinners slow down instead of freezing.
 */
const root = path.resolve(__dirname, "..");
const css = readFileSync(path.join(root, "app/globals.css"), "utf8");

const reduceBlocks = () => {
  const blocks: string[] = [];
  const marker = "@media (prefers-reduced-motion: reduce)";
  let index = css.indexOf(marker);
  while (index !== -1) {
    const open = css.indexOf("{", index);
    let depth = 0;
    let end = open;
    for (; end < css.length; end += 1) {
      if (css[end] === "{") depth += 1;
      if (css[end] === "}") depth -= 1;
      if (depth === 0) break;
    }
    blocks.push(css.slice(open, end + 1));
    index = css.indexOf(marker, end);
  }
  return blocks;
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx|ts)$/.test(name) ? [full] : [];
  });

describe("reduced motion without a global clamp (#3976)", () => {
  it("drops the universal 0.01ms reset", () => {
    expect(css).not.toMatch(/animation-duration:\s*0\.01ms/);
    expect(css).not.toMatch(/transition-duration:\s*0\.01ms/);
  });

  it("keeps instant scrolling and slows spinners under reduce", () => {
    const reduce = reduceBlocks().join("\n");
    expect(reduce).toMatch(/html\s*\{[^}]*scroll-behavior:\s*auto/);
    expect(reduce).toMatch(/\.animate-spin\s*\{[^}]*animation-duration:\s*3s/);
  });

  it("keeps colour fades but drops transform from transitions under reduce", () => {
    const reduce = reduceBlocks().join("\n");
    const rule = reduce.match(/\.transition-transform\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("background-color");
    expect(rule).toContain("opacity");
    expect(rule).not.toMatch(/\btransform\b|\btranslate\b|\bscale\b|\brotate\b/);
  });

  it("runs the grid square loop only without a motion preference", () => {
    const rule = css.match(/\.animate-grid-square\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(rule).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{[^}]*grid-square-pulse/
    );
  });

  it("opts every decorative pulse, ping and bounce into motion-safe", () => {
    const offenders = ["app", "components"]
      .flatMap((dir) => sourceFiles(path.join(root, dir)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .filter((line) =>
            /(^|[\s"'`:])animate-(pulse|ping|bounce)\b/.test(
              line.replace(/motion-safe:animate-/g, "")
            )
          )
          .map((line) => `${path.relative(root, file)}: ${line.trim()}`)
      );
    expect(offenders).toEqual([]);
  });
});
