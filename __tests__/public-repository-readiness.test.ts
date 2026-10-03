import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string): string =>
  fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

const sha256 = (content: string): string =>
  createHash("sha256").update(content, "utf8").digest("hex");

/**
 * Pinned content hashes for every license/notice file that the three-layer
 * reuse boundary (ADR 0045) depends on being byte-identical. A truncation, a
 * silently widened grant, or a docs-generation step that re-serializes the
 * text with different whitespace all change the hash, so this catches
 * mutations that a `toContain` substring check would miss.
 *
 * Update these only after a deliberate, reviewed edit to the license or
 * notice text, and recompute with:
 *   shasum -a 256 <file>
 */
const EXPECTED_HASHES: Record<string, string> = {
  LICENSE: "f8225b59f17909e08220e9dc57d38d8ec857a1e77cc780c03ea5176a7b2c120d",
  NOTICE: "893e0ea6ea801fa264526003f04568d7d2fb8b4937837853aa6a1f7048afb58d",
  "public/files/LICENSE.txt":
    "fe200206479d4485ef58d8a73d8bdc4a4bf6467619876701b3d08aa0f2fd1d98",
  "docs/reference/api/_media/LICENSE":
    "f8225b59f17909e08220e9dc57d38d8ec857a1e77cc780c03ea5176a7b2c120d",
  "docs/reference/api/_media/LICENSE.txt":
    "fe200206479d4485ef58d8a73d8bdc4a4bf6467619876701b3d08aa0f2fd1d98",
  "docs/reference/api/_media/NOTICE":
    "893e0ea6ea801fa264526003f04568d7d2fb8b4937837853aa6a1f7048afb58d",
};

const assertPinnedContent = (file: string): void => {
  const content = read(file);
  const actual = sha256(content);
  const expected = EXPECTED_HASHES[file];
  if (actual !== expected) {
    throw new Error(
      `${file} no longer matches its pinned content hash.\n` +
        `  expected sha256: ${expected}\n` +
        `  actual sha256:   ${actual}\n` +
        `  actual length:   ${content.length} chars\n` +
        "This fails on truncation, an unauthorized rewording of the grant, " +
        "or a docs-generation step that drifted from the source file. If " +
        "this is a deliberate, reviewed license/notice edit, recompute the " +
        "hash with `shasum -a 256 " +
        file +
        "` and update EXPECTED_HASHES."
    );
  }
};

describe("public repository readiness contracts", () => {
  it("distinguishes current public status from the historical pre-publication audit", () => {
    const readiness = read("docs/reference/public-repository-readiness.md");

    expect(readiness).toContain("The repository became public on");
    expect(readiness).toContain("This document is a pre-publication snapshot");
    expect(readiness).toContain(
      "Historical Go/No-Go Status (2026-09-22 Snapshot)"
    );
    expect(readiness).toContain("issues/732");
    expect(readiness).toContain("issues/863");
  });

  it("keeps public documentation on the main-only workflow", () => {
    const readme = read("README.md");
    const security = read("SECURITY.md");

    expect(readme).not.toContain("portfolio/tree/dev");
    expect(readme).not.toContain("portfolio/blob/dev");
    expect(readme).not.toContain("rigor-pipeline");
    expect(security).not.toContain("targeting `dev`");
  });

  it("ships public contribution and private security-reporting guidance", () => {
    expect(fs.existsSync(path.join(root, "CODE_OF_CONDUCT.md"))).toBe(true);
    expect(
      fs.existsSync(path.join(root, ".github/ISSUE_TEMPLATE/bug_report.yml"))
    ).toBe(true);
    expect(read("SECURITY.md")).toContain("Report a vulnerability");
    expect(read(".github/ISSUE_TEMPLATE/config.yml")).toContain(
      "/security/advisories/new"
    );
  });

  it("uses the canonical apex for scheduled production probes", () => {
    const workflow = read(".github/workflows/synthetic-probes.yml");
    expect(workflow).toContain('DEFAULT_PROBE_TARGET: "https://deruiter.dev"');
    expect(workflow).not.toContain(
      'DEFAULT_PROBE_TARGET: "https://www.deruiter.dev"'
    );
  });

  it("runs the redacted secret audit against full history in CI", () => {
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("run: npm run audit:secrets");
  });

  it("pins the complete Apache-2.0 LICENSE text against truncation or mutation", () => {
    assertPinnedContent("LICENSE");

    const license = read("LICENSE");
    expect(license).toContain("Apache License");
    expect(license).toContain("Version 2.0, January 2004");
    expect(license).toContain("Copyright 2026 Frederick de Ruiter");

    // Section 6 is why Apache-2.0 was chosen over MIT for a personal-brand
    // deployment: reusing the engineering must not imply reusing the identity.
    // The hash pin above already fails on partial deletion of this section;
    // this assertion names the specific clause a reviewer should look for.
    expect(license).toContain("6. Trademarks.");
  });

  it("pins the complete CC0 asset dedication, not just its label", () => {
    assertPinnedContent("public/files/LICENSE.txt");

    const assetLicense = read("public/files/LICENSE.txt");
    expect(assetLicense).toContain(
      "Creative Commons CC0 1.0 Universal (CC0 1.0) Public Domain Dedication"
    );
    expect(assetLicense).toContain(
      "has waived all copyright and related or neighboring rights"
    );
    expect(assetLicense).toContain(
      "Adapt — remix, transform, and build upon the material for any purpose, even commercially."
    );
    expect(assetLicense).toContain("No attribution is required.");
    expect(assetLicense).toContain(
      "https://creativecommons.org/publicdomain/zero/1.0/legalcode"
    );
    // Copies obtained under the earlier grant keep their terms.
    expect(assetLicense).toContain(
      "first published under Creative Commons Attribution 4.0"
    );
  });

  it("carries the source NOTICE layer intact and scoped to the application", () => {
    assertPinnedContent("NOTICE");

    const notice = read("NOTICE");
    expect(notice).toContain("Licensed under the Apache License, Version 2.0");
    expect(notice).toContain(
      "1. Application source code — Apache License 2.0 (LICENSE)."
    );
  });

  it("carries the assets NOTICE layer intact and scoped to public/files/", () => {
    assertPinnedContent("NOTICE");

    const notice = read("NOTICE");
    expect(notice).toContain(
      "2. Laser Loon brand artwork — Creative Commons CC0 1.0 Universal (public domain dedication)."
    );
    expect(notice).toContain("public/files/LICENSE.txt");
    expect(notice).toContain("Unchanged by this NOTICE.");
  });

  it("carries the editorial (all-rights-reserved) NOTICE layer intact", () => {
    assertPinnedContent("NOTICE");

    const notice = read("NOTICE");
    expect(notice).toContain(
      "3. Editorial content and personal identity material — all rights reserved."
    );
    expect(notice).toContain("deruiter.dev");
  });

  it("keeps the generated-assets NOTICE and LICENSE mirrors byte-identical to their source", () => {
    assertPinnedContent("docs/reference/api/_media/LICENSE");
    assertPinnedContent("docs/reference/api/_media/LICENSE.txt");
    assertPinnedContent("docs/reference/api/_media/NOTICE");

    expect(read("docs/reference/api/_media/LICENSE")).toBe(read("LICENSE"));
    expect(read("docs/reference/api/_media/LICENSE.txt")).toBe(
      read("public/files/LICENSE.txt")
    );
    expect(read("docs/reference/api/_media/NOTICE")).toBe(read("NOTICE"));
  });

  it("states inbound = outbound contribution terms", () => {
    expect(read("CONTRIBUTING.md")).toContain("inbound = outbound");
    expect(read("README.md")).toContain("## License");
  });

  it("declares public repository metadata without enabling npm publication", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      private: boolean;
      description?: string;
      homepage?: string;
      license?: string;
      repository?: { url?: string };
      bugs?: { url?: string };
    };

    expect(packageJson.private).toBe(true);
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.description).toBeTruthy();
    expect(packageJson.homepage).toBe("https://deruiter.dev");
    expect(packageJson.repository?.url).toContain("fderuiter/portfolio");
    expect(packageJson.bugs?.url).toContain("fderuiter/portfolio/issues");
  });
});
