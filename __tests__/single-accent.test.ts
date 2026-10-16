// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const css = read("app/globals.css");

function rootColor(name: string): string {
  const value = new RegExp(`\\s--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
    css
  )?.[1];
  if (!value) throw new Error(`--${name} is not a hex color`);
  return value.toLowerCase();
}

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

// Site chrome that every route renders. Games, studios and categorical
// colour maps (language badges, syntax highlighting) are out of scope.
const CHROME = [
  "components/Navbar.tsx",
  "components/Footer.tsx",
  "components/nav/DesktopNavMenu.tsx",
  "components/nav/MobileNavSections.tsx",
  "components/nav/NavIcon.tsx",
  "components/nav/PreferencesMenu.tsx",
  "components/ui/Breadcrumbs.tsx",
  "components/ui/Tooltip.tsx",
  "components/ui/NextPrevNav.tsx",
  "components/ui/TracingBeam.tsx",
  "components/SkipToContent.tsx",
  "components/UnifiedErrorLayout.tsx",
];

const OFF_ACCENT =
  /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|from|to|via|fill|stroke|outline|decoration|accent)-(?:(?:cyan|sky|blue|indigo|teal|purple|violet)-\d{2,3}|brand-cyan|brand-blue)\b/;

describe("single interactive accent (#2309)", () => {
  it("--accent is Precision Amber and meets 4.5:1 on the page and cards", () => {
    const accent = rootColor("accent");
    expect(accent).toBe("#f59e0b");
    for (const ground of ["#0d0e11", "#13151a", "#191c22"]) {
      expect(contrast(accent, ground)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("--error clears 4.5:1 and differs from --warning in lightness, not only hue", () => {
    const error = rootColor("error");
    const warning = rootColor("warning");
    for (const ground of ["#0d0e11", "#13151a", "#191c22"]) {
      expect(contrast(error, ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(luminance(warning) / luminance(error)).toBeGreaterThan(1.5);
  });

  it.each(CHROME)("%s uses no secondary accent hue", (file) => {
    expect(read(file)).not.toMatch(OFF_ACCENT);
  });
});
