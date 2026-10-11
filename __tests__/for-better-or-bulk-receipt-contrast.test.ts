// @vitest-environment node
/**
 * Measures the receipt's text contrast (WCAG 2.x, 1.4.3). It reads the real
 * [data-fbb-cabinet] tokens from app/arcade/arcade.css and every text colour
 * class in ReceiptView.tsx, pairs each with the background on its own line
 * (or the receipt panel), and asserts at least 4.5:1 for normal text.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = process.cwd();
const AA_NORMAL_TEXT = 4.5;

function read(relative: string): string {
  return readFileSync(path.resolve(ROOT, relative), "utf8");
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours, from 1 to 21. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The CSS with comments and @keyframes blocks removed: the static rules only. */
function staticRules(css: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let index = 0;
  for (;;) {
    const start = withoutComments.indexOf("@keyframes", index);
    if (start === -1) return out + withoutComments.slice(index);
    out += withoutComments.slice(index, start);
    const open = withoutComments.indexOf("{", start);
    let depth = 0;
    let end = open;
    for (; end < withoutComments.length; end++) {
      const ch = withoutComments[end];
      if (ch === "{") depth++;
      if (ch === "}" && --depth === 0) break;
    }
    index = end + 1;
  }
}

/** Opacity values below 1 on rules that style the cabinet, receipt included. */
function dimmingCabinetRules(css: string): string[] {
  const dimmed: string[] = [];
  for (const rule of staticRules(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim();
    if (!selector.includes("data-fbb-cabinet")) continue;
    for (const decl of rule[2].matchAll(/(?<![\w-])opacity:\s*([\d.]+)/g)) {
      if (Number(decl[1]) < 1)
        dimmed.push(`${selector} { opacity: ${decl[1]} }`);
    }
  }
  return dimmed;
}

/** The custom properties declared in the cabinet's own block, as hex values. */
function cabinetTokens(css: string): Map<string, string> {
  const block = /\[data-fbb-cabinet\] \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/--(fbb-[\w-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    tokens.set(match[1], match[2]);
  }
  return tokens;
}

/** Resolves `var(--fbb-*)` or a literal #rrggbb to a hex colour. */
function resolveColor(
  value: string,
  tokens: ReadonlyMap<string, string>
): string {
  const variable = /^var\(--(fbb-[\w-]+)\)$/.exec(value);
  if (!variable) return value;
  const hex = tokens.get(variable[1]);
  if (!hex) throw new Error(`--${variable[1]} is not a hex token`);
  return hex;
}

interface Pair {
  readonly line: number;
  readonly colour: string;
  readonly ratio: number;
}

/** Every text colour on the receipt, paired with its own background. */
function receiptPairs(source: string, tokens: ReadonlyMap<string, string>) {
  const surface = resolveColor(
    /bg-\[(var\(--fbb-[\w-]+\))\]/.exec(source)?.[1] ?? "",
    tokens
  );
  const pairs: Pair[] = [];
  source.split("\n").forEach((text, index) => {
    const bgClass = /bg-\[(var\(--fbb-[\w-]+\)|#[0-9a-fA-F]{6})\]/.exec(text);
    const background = bgClass ? resolveColor(bgClass[1], tokens) : surface;
    for (const match of text.matchAll(
      /(?<![\w-])text-\[(var\(--fbb-[\w-]+\)|#[0-9a-fA-F]{6})\]/g
    )) {
      const colour = resolveColor(match[1], tokens);
      pairs.push({
        line: index + 1,
        colour: match[1],
        ratio: contrastRatio(colour, background),
      });
    }
  });
  return pairs;
}

describe("receipt text contrast (#1927)", () => {
  const css = read("app/arcade/arcade.css");
  const source = read("components/for-better-or-bulk/ReceiptView.tsx");
  const tokens = cabinetTokens(css);
  const pairs = receiptPairs(source, tokens);

  it("reads the cabinet tokens the receipt uses", () => {
    for (const name of ["fbb-panel", "fbb-text", "fbb-dim", "fbb-accent"]) {
      expect(tokens.has(name), name).toBe(true);
    }
  });

  it("finds every text colour on the receipt", () => {
    const colours = new Set(pairs.map((pair) => pair.colour));
    expect(colours).toEqual(
      new Set([
        "var(--fbb-text)",
        "var(--fbb-dim)",
        "var(--fbb-accent)",
        "var(--fbb-ok)",
        "#94a3b8",
        "#0d0e11",
      ])
    );
  });

  it("meets 4.5:1 for every text colour against its own background", () => {
    const failing = pairs.filter((pair) => pair.ratio < AA_NORMAL_TEXT);
    expect(
      failing.map(
        (pair) => `line ${pair.line} ${pair.colour} ${pair.ratio.toFixed(2)}:1`
      )
    ).toEqual([]);
  });

  it("keeps the dim receipt text above 4.5:1", () => {
    const dim = pairs.filter((pair) => pair.colour === "var(--fbb-dim)");
    expect(dim.length).toBeGreaterThan(0);
    for (const pair of dim) {
      expect(pair.ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it("uses no opacity to fade receipt text, in the component or the cabinet's rules", () => {
    expect(source).not.toMatch(/text-[^\s"`]*\/\d+|\bopacity-\d+/);
    expect(dimmingCabinetRules(css)).toEqual([]);
  });
});
