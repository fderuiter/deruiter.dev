// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The Trial & Error cabinet tokens (`--te-*`) are declared once, in
 * app/arcade/arcade.css under `[data-te-cabinet]` (ADR 0052, #817). This
 * suite reads that declaration directly, so the CSS itself is what is audited.
 */
const css = fs.readFileSync(
  path.resolve(process.cwd(), "app/arcade/arcade.css"),
  "utf-8"
);

function cabinetTokens(): Record<string, string> {
  const block = /\[data-te-cabinet\]\s*\{([^}]*)\}/.exec(css);
  expect(
    block,
    "app/arcade/arcade.css must declare a [data-te-cabinet] block"
  ).not.toBeNull();
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block![1].matchAll(
    /(--te-[\w-]+)\s*:\s*([^;]+);/g
  )) {
    tokens[name] = value.trim();
  }
  return tokens;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Expected a 6-digit hex colour, got ${hex}`);
  const channels = [0, 2, 4].map(
    (i) => parseInt(match[1].slice(i, i + 2), 16) / 255
  );
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["--te-surface-0", "--te-surface-1"];
const TEXT_TOKENS = [
  "--te-text",
  "--te-text-muted",
  "--te-chips",
  "--te-plus-mult",
  "--te-x-mult",
  "--te-redline",
  "--te-validated",
  "--te-fire",
  "--te-suit-itt",
  "--te-suit-safety",
  "--te-suit-pp",
  "--te-suit-fas",
  "--te-suit-screened",
];

describe("Trial & Error cabinet tokens", () => {
  const tokens = cabinetTokens();

  it("declares every token the presentation tickets rely on", () => {
    for (const name of [...SURFACES, ...TEXT_TOKENS, "--te-hairline"]) {
      expect(tokens[name], `${name} is missing`).toBeDefined();
    }
    expect(tokens["--te-surface-0"]).toBe("#0d0e11");
    expect(tokens["--te-surface-1"]).toBe("#13151a");
  });

  it.each(
    TEXT_TOKENS.flatMap((text) => SURFACES.map((surface) => [text, surface]))
  )("%s on %s meets WCAG AA (4.5:1)", (text, surface) => {
    expect(contrast(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the five population suits visually distinct", () => {
    const suits = ["itt", "safety", "pp", "fas", "screened"].map(
      (s) => tokens[`--te-suit-${s}`]
    );
    expect(new Set(suits).size).toBe(5);
  });

  it("scopes loud-moment layers to a cabinet with loud effects on", () => {
    const loudSelectors = [
      ...css.matchAll(/([^{}]*\.te-loud-[\w-]+[^{}]*)\{/g),
    ].map((m) => m[1].trim());
    expect(loudSelectors.length).toBeGreaterThan(0);
    for (const selector of loudSelectors) {
      expect(selector).toMatch(/\[data-te-cabinet\]\[data-te-loud="on"\]/);
    }
  });
});
