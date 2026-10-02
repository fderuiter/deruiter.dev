// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("CI Workflow Dual Caching and Isolation Suite", () => {
  const workflowPath = path.join(process.cwd(), ".github/workflows/ci.yml");

  it("should have the ci.yml workflow file present", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  const content = fs.readFileSync(workflowPath, "utf8");

  /**
   * #1771: browser caches never warmed (PR caches are scoped to
   * refs/pull/N/merge, and nothing wrote the `main` fallback), so a new PR's
   * Device Gate downloaded Chromium and WebKit and ran apt, once for 18
   * minutes. The browser jobs now run in the official Playwright image,
   * pinned by digest, so there is no browser cache to key or restore.
   */
  describe("Playwright browsers come from the pinned image (#1771)", () => {
    const syntheticContent = fs.readFileSync(
      path.join(process.cwd(), ".github/workflows/synthetic-probes.yml"),
      "utf8"
    );

    it.each([
      ["ci.yml", content],
      ["synthetic-probes.yml", syntheticContent],
    ])("%s keeps no browser cache and installs no browser", (_name, text) => {
      expect(text).not.toMatch(/ms-playwright/);
      expect(text).not.toMatch(/key:\s*playwright-/);
      expect(text).not.toMatch(/playwright install/);
    });

    it("never restores a cache through an unscoped playwright- prefix", () => {
      expect(content).not.toMatch(/^\s+playwright-[a-z-]*\s*$/m);
      expect(syntheticContent).not.toMatch(/^\s+playwright-[a-z-]*\s*$/m);
    });
  });

  /**
   * #1769: the old key (`nextjs-<branch>-<lockfile>`) had no source hash, so
   * a branch's first entry was hit exactly on every later push and never
   * refreshed, and nothing wrote the `main` fallback. The key now carries a
   * source hash with a lockfile-scoped prefix fallback; pull requests only
   * restore, and the cache-warm job saves from each main push.
   */
  describe("Next.js Build Caching Config", () => {
    const sourceKey =
      "nextjs-${{ hashFiles('package-lock.json') }}-${{ hashFiles('app/**', 'components/**', 'lib/**', 'hooks/**', '*.config.*') }}";
    const prefixKey = "nextjs-${{ hashFiles('package-lock.json') }}-";

    const nextSections = content
      .split("- name:")
      .filter((section) =>
        section.includes("path: ${{ github.workspace }}/.next/cache")
      );

    it("restores the webpack cache in the PR build and saves it only from cache-warm", () => {
      // build: restore; cache-warm: restore + save.
      expect(nextSections.length).toBe(3);
      for (const section of nextSections) {
        expect(section).toContain(`key: ${sourceKey}`);
        expect(section).not.toMatch(/uses: actions\/cache@/);
      }
      const saves = nextSections.filter((s) => /actions\/cache\/save@/.test(s));
      expect(saves).toHaveLength(1);
      expect(saves[0]).toContain("Save Next.js Cache");
    });

    it("falls back only to a lockfile-scoped prefix", () => {
      const restores = nextSections.filter((s) =>
        /actions\/cache\/restore@/.test(s)
      );
      expect(restores).toHaveLength(2);
      for (const section of restores) {
        const restoreKeys = section
          .match(/restore-keys:\s*\|((?:\n\s{12,}\S.*)+)/)?.[1]
          .trim()
          .split("\n")
          .map((k) => k.trim());
        expect(restoreKeys).toEqual([prefixKey]);
      }
    });

    it("never restores a cache whose key ignores the lockfile", () => {
      expect(content).not.toMatch(/^\s+nextjs-\s*$/m);
      expect(content).not.toMatch(
        /nextjs-\$\{\{\s*github\.(head_ref|ref_name)/
      );
    });
  });

  /**
   * #1769: cache-warm writes the `main` webpack cache from each main push.
   * It warms nothing else: browsers ship in the Playwright image (#1771).
   */
  describe("cache-warm (#1769)", () => {
    const lines = content.split("\n");
    const start = lines.findIndex((line) => line === "  cache-warm:");
    const end = lines.findIndex(
      (line, index) => index > start && /^ {2}[a-z][a-z0-9-]*:$/.test(line)
    );
    const block = lines
      .slice(start, end === -1 ? lines.length : end)
      .join("\n");

    it("runs only on a push to main", () => {
      expect(start).toBeGreaterThan(-1);
      expect(block).toMatch(
        /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/
      );
    });

    it("saves only the Next.js cache, through the shipped build entrypoint", () => {
      const saves = [...block.matchAll(/uses: actions\/cache\/save@/g)];
      expect(saves).toHaveLength(1);
      expect(block).toMatch(/run: npm run build\n/);
      expect(block).toContain("path: ${{ github.workspace }}/.next/cache");
    });
  });

  describe("Synthetic Probes Workflow (#1771)", () => {
    const syntheticWorkflowPath = path.join(
      process.cwd(),
      ".github/workflows/synthetic-probes.yml"
    );

    it("should have the synthetic-probes.yml workflow file present", () => {
      expect(fs.existsSync(syntheticWorkflowPath)).toBe(true);
    });

    it("runs the probes in the same pinned Playwright image as ci.yml", () => {
      const syntheticContent = fs.readFileSync(syntheticWorkflowPath, "utf8");
      const image = /image: (mcr\.microsoft\.com\/playwright:\S+)/;
      const ciImage = content.match(image)?.[1];
      expect(ciImage).toMatch(/@sha256:[0-9a-f]{64}$/);
      expect(syntheticContent.match(image)?.[1]).toBe(ciImage);
      expect(syntheticContent.indexOf("container:")).toBeLessThan(
        syntheticContent.indexOf("playwright test")
      );
    });
  });
});
