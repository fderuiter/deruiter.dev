// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// Tailwind's stock zinc ramp, which the graphite ramp replaces step for step.
const STOCK_ZINC: Record<(typeof STEPS)[number], string> = {
  50: "#fafafa",
  100: "#f4f4f5",
  200: "#e4e4e7",
  300: "#d4d4d8",
  400: "#a1a1aa",
  500: "#71717a",
  600: "#52525b",
  700: "#3f3f46",
  800: "#27272a",
  900: "#18181b",
  950: "#09090b",
};

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

function themeColor(name: string): string {
  const value = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
    css
  )?.[1];
  if (!value) throw new Error(`--color-${name} is not defined`);
  return value.toLowerCase();
}

function rootColor(name: string): string {
  const value = new RegExp(`\\s--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
    css
  )?.[1];
  if (!value) throw new Error(`--${name} is not defined`);
  return value.toLowerCase();
}

describe("graphite gray ramp (#2308)", () => {
  it("zinc, slate and neutral all resolve to the gray ramp", () => {
    for (const step of STEPS) {
      const gray = themeColor(`gray-${step}`);
      for (const family of ["zinc", "slate", "neutral"]) {
        expect(themeColor(`${family}-${step}`), `${family}-${step}`).toBe(gray);
      }
    }
  });

  it("each step keeps the contrast of the zinc step it replaces", () => {
    // Text written against stock zinc must not lose contrast on dark or light
    // grounds, so every step stays within 10% of zinc's ratio on both.
    for (const step of STEPS) {
      const gray = themeColor(`gray-${step}`);
      for (const ground of ["#0d0e11", "#ffffff"]) {
        const ratio =
          contrast(gray, ground) / contrast(STOCK_ZINC[step], ground);
        expect(ratio, `gray-${step} on ${ground}`).toBeGreaterThan(0.9);
        expect(ratio, `gray-${step} on ${ground}`).toBeLessThan(1.1);
      }
    }
  });

  it("the darkest step is the page background", () => {
    expect(themeColor("gray-950")).toBe(rootColor("background"));
  });

  it("muted text tokens come from the ramp", () => {
    expect(rootColor("muted")).toBe(themeColor("gray-400"));
    expect(rootColor("text-secondary")).toBe(themeColor("gray-400"));
    expect(rootColor("muted-strong")).toBe(themeColor("gray-300"));
  });
});
