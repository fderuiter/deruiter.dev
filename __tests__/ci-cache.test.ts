import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("CI Workflow Dual Caching and Isolation Suite", () => {
  const workflowPath = path.join(process.cwd(), ".github/workflows/ci.yml");

  it("should have the ci.yml workflow file present", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  const content = fs.readFileSync(workflowPath, "utf8");

  describe("Playwright Browser Caching Config", () => {
    // PR #775 split the single `playwright-*` cache key into browser-family
    // scoped keys: `playwright-chromium-*` for the single-browser Heavy Gate
    // job and `playwright-full-*` for jobs that install chromium + webkit
    // (post-merge device smoke and the on-demand cross-device matrix). A
    // browser-family mismatch would silently restore the wrong browser set
    // from cache, so every "Cache Playwright Browsers" block must be
    // checked, not just the first one in the file.
    const cacheSections = content
      .split("- name:")
      .filter(
        (section) =>
          section.includes("Cache Playwright Browsers") &&
          section.includes("path: ~/.cache/ms-playwright")
      );

    const extractRestoreKeys = (section: string) => {
      const restoreKeysMatch = section.match(
        /restore-keys:\s*\|((?:\n\s{12,}\S.*)+)/
      );
      return restoreKeysMatch
        ? restoreKeysMatch[1]
            .trim()
            .split("\n")
            .map((k) => k.trim())
        : null;
    };

    it("should find at least one chromium-scoped and one full-browser-scoped cache block", () => {
      expect(cacheSections.length).toBeGreaterThanOrEqual(3);
    });

    it("should configure branch-isolated, lockfile-invalidated caching for the chromium-only cache (Heavy Gate)", () => {
      const chromiumSections = cacheSections.filter((section) =>
        /key:\s*playwright-chromium-/.test(section)
      );
      expect(chromiumSections.length).toBeGreaterThanOrEqual(1);

      for (const section of chromiumSections) {
        expect(section).toMatch(
          /key:\s*playwright-chromium-\$\{\{\s*github\.head_ref\s*\|\|\s*github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
        );

        const restoreKeys = extractRestoreKeys(section);
        expect(restoreKeys).not.toBeNull();

        if (restoreKeys) {
          // Exact, not >=: an unchecked third restore key -- e.g. an
          // unscoped `playwright-chromium-` fallback with no branch or
          // lockfile hash -- would silently restore *any* cache entry
          // sharing that prefix, from any branch or lockfile version,
          // defeating both isolation guarantees below without this test
          // ever looking at it.
          expect(restoreKeys.length).toBe(2);
          expect(restoreKeys[0]).toMatch(
            /playwright-chromium-\$\{\{\s*github\.head_ref\s*\|\|\s*github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
          );
          expect(restoreKeys[1]).toMatch(
            /playwright-chromium-main-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
          );
        }
      }
    });

    it("should configure branch-isolated, lockfile-invalidated caching for the full multi-browser cache (Post-Merge Device Smoke / Cross-Device Matrix)", () => {
      const fullSections = cacheSections.filter((section) =>
        /key:\s*playwright-full-/.test(section)
      );
      expect(fullSections.length).toBeGreaterThanOrEqual(2);

      for (const section of fullSections) {
        expect(section).toMatch(
          /key:\s*playwright-full-\$\{\{\s*(?:github\.head_ref\s*\|\|\s*)?github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
        );

        const restoreKeys = extractRestoreKeys(section);
        expect(restoreKeys).not.toBeNull();

        if (restoreKeys) {
          // Exact, not >=: see the chromium block above for why an
          // unchecked additional key is unsafe, not merely redundant.
          expect(restoreKeys.length).toBe(2);
          expect(restoreKeys[0]).toMatch(
            /playwright-full-\$\{\{\s*(?:github\.head_ref\s*\|\|\s*)?github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
          );
          expect(restoreKeys[1]).toMatch(
            /playwright-full-main-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
          );
        }
      }
    });

    it("should never mix browser-family prefixes across cache keys", () => {
      const keys = cacheSections
        .map((section) => section.match(/key:\s*(\S+)/)?.[1])
        .filter((key): key is string => Boolean(key));

      expect(keys.length).toBe(cacheSections.length);
      expect(
        keys.every(
          (key) =>
            key.startsWith("playwright-chromium-") ||
            key.startsWith("playwright-full-")
        )
      ).toBe(true);
    });

    describe("Regex contract fixtures (in-memory, do not require workflow changes)", () => {
      const chromiumKeyPattern =
        /key:\s*playwright-chromium-\$\{\{\s*github\.head_ref\s*\|\|\s*github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/;
      const fullKeyPattern =
        /key:\s*playwright-full-\$\{\{\s*(?:github\.head_ref\s*\|\|\s*)?github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/;

      it("should reject a chromium key fixture that is missing the lockfile hash", () => {
        const missingHashFixture =
          "          key: playwright-chromium-${{ github.head_ref || github.ref_name }}\n";
        expect(chromiumKeyPattern.test(missingHashFixture)).toBe(false);
      });

      it("should reject a chromium key fixture using the wrong browser-family prefix", () => {
        const mismatchedFamilyFixture =
          "          key: playwright-full-${{ github.head_ref || github.ref_name }}-${{ hashFiles('package-lock.json') }}\n";
        expect(chromiumKeyPattern.test(mismatchedFamilyFixture)).toBe(false);
      });

      it("should reject a full-browser key fixture that is missing the lockfile hash", () => {
        const missingHashFixture =
          "          key: playwright-full-${{ github.ref_name }}\n";
        expect(fullKeyPattern.test(missingHashFixture)).toBe(false);
      });

      it("should reject a full-browser key fixture using the wrong browser-family prefix", () => {
        const mismatchedFamilyFixture =
          "          key: playwright-chromium-${{ github.ref_name }}-${{ hashFiles('package-lock.json') }}\n";
        expect(fullKeyPattern.test(mismatchedFamilyFixture)).toBe(false);
      });

      it("should accept the canonical chromium and full-browser key fixtures", () => {
        const chromiumFixture =
          "          key: playwright-chromium-${{ github.head_ref || github.ref_name }}-${{ hashFiles('package-lock.json') }}\n";
        const fullFixture =
          "          key: playwright-full-${{ github.ref_name }}-${{ hashFiles('package-lock.json') }}\n";
        const fullPRFixture =
          "          key: playwright-full-${{ github.head_ref || github.ref_name }}-${{ hashFiles('package-lock.json') }}\n";
        expect(chromiumKeyPattern.test(chromiumFixture)).toBe(true);
        expect(fullKeyPattern.test(fullFixture)).toBe(true);
        expect(fullKeyPattern.test(fullPRFixture)).toBe(true);
      });

      it("should reject a restore-keys fixture carrying an unsafe unscoped third fallback key", () => {
        // The real assertions above used to accept `restoreKeys.length >=
        // 2` and only ever looked at index 0 and 1, so a third key --
        // however unsafe -- would never fail the test. `extractRestoreKeys`
        // itself has no opinion on count; this fixture proves the parser
        // faithfully returns all three lines, so the `toHaveLength(2)`
        // assertions on the real cache blocks above are what must (and now
        // do) reject this shape rather than silently accepting it.
        const unsafeThirdKeyFixture =
          "        restore-keys: |\n" +
          "            playwright-chromium-${{ github.head_ref || github.ref_name }}-${{ hashFiles('package-lock.json') }}\n" +
          "            playwright-chromium-main-${{ hashFiles('package-lock.json') }}\n" +
          "            playwright-chromium-\n";

        const restoreKeys = extractRestoreKeys(unsafeThirdKeyFixture);
        expect(restoreKeys).not.toBeNull();
        // A third, branch/lockfile-unscoped fallback like
        // `playwright-chromium-` would restore *any* cache entry sharing
        // that prefix -- any branch, any lockfile version -- silently
        // reintroducing stale or cross-branch browser binaries.
        expect(restoreKeys).toHaveLength(3);
        expect(restoreKeys?.[2]).toBe("playwright-chromium-");
      });
    });
  });

  describe("Next.js Build Caching Config", () => {
    it("should configure branch-isolated incremental caching with lockfile-based invalidation for Next.js", () => {
      // Find the Next.js cache block
      const nextjsSection = content
        .split("- name:")
        .find((section) => section.includes("Next.js Cache"));
      expect(nextjsSection).toBeDefined();

      if (nextjsSection) {
        // Path should be correct
        expect(nextjsSection).toContain(
          "path: ${{ github.workspace }}/.next/cache"
        );

        // Key should be branch-isolated and lockfile hash dependent (excluding github.sha to allow cache hits across sequential commits)
        expect(nextjsSection).toMatch(
          /key:\s*nextjs-\$\{\{\s*github\.head_ref\s*\|\|\s*github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
        );

        // Restore keys should fallback to same branch or main branch, with lockfile hash prefix for complete invalidation on lockfile changes
        const restoreKeysMatch = nextjsSection.match(
          /restore-keys:\s*\|((?:\n\s{12,}\S.*)+)/
        );
        expect(restoreKeysMatch).not.toBeNull();

        if (restoreKeysMatch) {
          const restoreKeys = restoreKeysMatch[1]
            .trim()
            .split("\n")
            .map((k) => k.trim());

          // Should have at least two restore keys: branch specific with hash and main specific with hash
          expect(restoreKeys.length).toBeGreaterThanOrEqual(2);

          // Branch specific restore key prefix with hash
          const branchSpecificRestoreKey = restoreKeys[0];
          expect(branchSpecificRestoreKey).toMatch(
            /nextjs-\$\{\{\s*github\.head_ref\s*\|\|\s*github\.ref_name\s*\}\}-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
          );

          // Main specific fallback restore key prefix with hash
          const mainSpecificRestoreKey = restoreKeys[1];
          expect(mainSpecificRestoreKey).toMatch(
            /nextjs-main-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
          );
        }
      }
    });
  });

  describe("Synthetic Probes Workflow Caching and Dependency Suite", () => {
    const syntheticWorkflowPath = path.join(
      process.cwd(),
      ".github/workflows/synthetic-probes.yml"
    );

    it("should have the synthetic-probes.yml workflow file present", () => {
      expect(fs.existsSync(syntheticWorkflowPath)).toBe(true);
    });

    const syntheticContent = fs.readFileSync(syntheticWorkflowPath, "utf8");

    it("should configure Playwright cache and conditional host dependency installation on cache hit", () => {
      // Find the Playwright cache block in synthetic probes
      const playwrightCacheSection = syntheticContent
        .split("- name:")
        .find((section) => section.includes("Cache Playwright Browsers"));
      expect(playwrightCacheSection).toBeDefined();

      if (playwrightCacheSection) {
        expect(playwrightCacheSection).toContain(
          "path: ~/.cache/ms-playwright"
        );
        expect(playwrightCacheSection).toMatch(
          /key:\s*playwright-synthetic-\$\{\{\s*hashFiles\(['"]package-lock\.json['"]\)\s*\}\}/
        );
      }

      // Check cache miss installation step
      const cacheMissSection = syntheticContent
        .split("- name:")
        .find((section) =>
          section.includes("Install Playwright Browsers (Cache Miss)")
        );
      expect(cacheMissSection).toBeDefined();
      if (cacheMissSection) {
        expect(cacheMissSection).toContain(
          "if: steps.playwright-cache.outputs.cache-hit != 'true'"
        );
        expect(cacheMissSection).toContain(
          "run: npx --no-install playwright install chromium --with-deps"
        );
      }

      // Check cache hit dependency-only installation step
      const cacheHitSection = syntheticContent
        .split("- name:")
        .find((section) =>
          section.includes("Install Playwright Dependencies Only (Cache Hit)")
        );
      expect(cacheHitSection).toBeDefined();
      if (cacheHitSection) {
        expect(cacheHitSection).toContain(
          "if: steps.playwright-cache.outputs.cache-hit == 'true'"
        );
        expect(cacheHitSection).toContain(
          "run: npx --no-install playwright install-deps chromium"
        );
      }
    });
  });
});
