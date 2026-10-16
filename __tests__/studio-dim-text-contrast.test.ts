// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  path.join(process.cwd(), "components/crf/studio-theme.css"),
  "utf8"
);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function themeTokens(theme: "light" | "dark"): Record<string, string> {
  const block = new RegExp(
    `\\[data-studio-theme="${theme}"\\]\\s*\\{([^}]*)\\}`
  ).exec(css)?.[1];
  if (!block) throw new Error(`no ${theme} studio token block`);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(
    /--(crf-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g
  )) {
    tokens[name] = value;
  }
  return tokens;
}

describe("studio dim text contrast (WCAG 1.4.3, #2307)", () => {
  for (const theme of ["light", "dark"] as const) {
    const t = themeTokens(theme);

    it(`${theme}: crf-text-dim meets 4.5:1 on every studio surface`, () => {
      for (const ground of [
        "crf-bg",
        "crf-surface-1",
        "crf-surface-2",
        "crf-surface-3",
        "crf-input-bg",
      ]) {
        expect(
          contrast(t["crf-text-dim"], t[ground]),
          `${theme} crf-text-dim on ${ground}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${theme}: crf-text-dim stays dimmer than crf-text-muted`, () => {
      expect(contrast(t["crf-text-dim"], t["crf-bg"])).toBeLessThan(
        contrast(t["crf-text-muted"], t["crf-bg"])
      );
    });
  }
});
