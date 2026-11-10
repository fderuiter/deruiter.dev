import { describe, expect, it } from "vitest";
import { toCanvasFontFamily } from "@/lib/graphics-engine";
import { resolveSingleThemeFont, resolveThemeFonts } from "@/lib/layout-config";

// Pretext 1.0 throws on a font string Canvas ignores, and Canvas ignores any
// family list that still holds a CSS custom property (#3498).
describe("toCanvasFontFamily", () => {
  it("drops var() entries and keeps concrete families", () => {
    expect(
      toCanvasFontFamily(
        "var(--font-atkinson), system-ui, -apple-system, sans-serif"
      )
    ).toBe("system-ui, -apple-system, sans-serif");
  });

  it("keeps commas inside a var() fallback with their entry", () => {
    expect(
      toCanvasFontFamily("var(--font-x, 'A', serif), 'Atkinson Hyperlegible'")
    ).toBe("'Atkinson Hyperlegible'");
  });

  it("returns the fallback when nothing concrete remains", () => {
    expect(toCanvasFontFamily("var(--font-geist-mono)", "monospace")).toBe(
      "monospace"
    );
    expect(toCanvasFontFamily("")).toBe("sans-serif");
  });

  it("leaves a concrete list unchanged", () => {
    expect(toCanvasFontFamily("'Lexend', 'Lexend Fallback'")).toBe(
      "'Lexend', 'Lexend Fallback'"
    );
  });
});

describe("theme font resolvers", () => {
  it("never hand Pretext a var() font string", () => {
    const fonts = resolveThemeFonts(13);
    for (const font of Object.values(fonts)) {
      expect(font).not.toMatch(/var\(/);
    }
    expect(resolveSingleThemeFont(16, "--font-heading")).not.toMatch(/var\(/);
  });
});
