import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { render, screen, cleanup } from "@testing-library/react";
import { HeroHeadline } from "@/components/Hero";

/**
 * Regression suite for #817 — Largest Contentful Paint element render delay.
 *
 * Chromium and WebKit paint engines disregard fully transparent text when
 * scoring LCP candidacy. The hero previously painted a static fallback during
 * SSR, then tore it down on `isReady` and mounted a Framer Motion tree whose
 * words started at `opacity: 0`, which both flickered and postponed the
 * recorded LCP until the entrance animation settled. These tests pin the two
 * invariants that prevent that regression from returning.
 */
describe("[#817] LCP paint candidacy & hydration render delay", () => {
  const heroPath = path.resolve(__dirname, "../components/Hero.tsx");
  const pretextHookPath = path.resolve(
    __dirname,
    "../hooks/usePretextLayout.tsx"
  );

  describe("Hero headline entrance never starts transparent", () => {
    it.each([
      ["HeroHeadline", 0, /y:\s*14/, /scale:\s*0\.97/],
      ["HeroText", 1, /y:\s*8/, /scale:\s*0\.98/],
    ])(
      "%s declares a transform-only entrance with no opacity-0 initial state",
      (_name, occurrence, offsetPattern, scalePattern) => {
        const content = fs.readFileSync(heroPath, "utf-8");

        // Both hero layers paint above the fold and are LCP candidates, so
        // each needs its own guard rather than a single whole-file scan.
        let start = -1;
        for (let i = 0; i <= occurrence; i++) {
          start = content.indexOf("const wordVariants", start + 1);
        }
        expect(start).toBeGreaterThan(-1);
        const variantsBlock = content.slice(
          start,
          content.indexOf("return (", start)
        );

        expect(variantsBlock).not.toMatch(/opacity:\s*0/);
        // The entrance itself must survive: transform-only, not removed.
        expect(variantsBlock).toMatch(offsetPattern);
        expect(variantsBlock).toMatch(scalePattern);
        expect(variantsBlock).toMatch(/y:\s*0/);
        expect(variantsBlock).toMatch(/scale:\s*1/);
      }
    );

    it("renders opaque headline text on the very first paint", () => {
      const text = "Clinical data systems that hold up";
      render(<HeroHeadline text={text} />);

      // The semantic heading carries the paint candidate (#817, ADR 0052).
      // Before measurement resolves it is the static fallback; either way
      // the text must be present and must not be hidden behind a zero opacity.
      const painted = document.querySelector('[data-pretext-layer="heading"]');
      expect(painted).not.toBeNull();
      expect(painted?.textContent).toContain(text);
      expect((painted as HTMLElement).style.opacity).not.toBe("0");
    });

    it("keeps the accessible semantic heading as a single h1", () => {
      const text = "Clinical data systems that hold up";
      render(<HeroHeadline text={text} />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.getAttribute("data-pretext-layer")).toBe("heading");
      expect(heading.textContent).toBe(text);
    });
  });

  describe("Pretext layout drift validation never measures in production", () => {
    it("gates getBoundingClientRect diagnostic behind isLayoutValidationEnabled", () => {
      const content = fs.readFileSync(pretextHookPath, "utf-8");

      const guards = content.match(
        /if \(!isLayoutValidationEnabled\(\)\) return;/g
      );
      // Guard for usePretextLayout.
      expect(guards).toHaveLength(1);

      // Every drift measurement must sit behind a guard, so no validation
      // read can be reintroduced without one.
      const measurements = content.match(
        /const actualHeight = containerRef\.current\.getBoundingClientRect\(\)\.height;/g
      );
      expect(measurements).toHaveLength(1);
    });

    it("skips the forced-reflow read when NODE_ENV is production", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        getEnv: () => ({ NODE_ENV: "production" }),
      }));

      const { isLayoutValidationEnabled } =
        await import("@/lib/graphics-engine");
      expect(isLayoutValidationEnabled()).toBe(false);
    });

    it("keeps the diagnostic active outside production", async () => {
      vi.resetModules();
      vi.doMock("@/lib/env", () => ({
        getEnv: () => ({ NODE_ENV: "development" }),
      }));

      const { isLayoutValidationEnabled } =
        await import("@/lib/graphics-engine");
      expect(isLayoutValidationEnabled()).toBe(true);
    });
  });

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    cleanup();
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });
});
