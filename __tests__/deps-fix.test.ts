// @vitest-environment node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canonicalPostgresPin,
  checkDuckdbExtensionsDrift,
  lockedDuckdbWasmVersion,
  lockedPlaywrightVersion,
  parseDuckdbExtensionsReadme,
  pinnedPlaywrightVersions,
  refreshDuckdbExtensions,
  rewriteDuckdbExtensionsReadme,
  rewritePlaywrightImages,
  rewritePostgresImages,
} from "../scripts/deps-fix";

const OLD = `sha256:${"a".repeat(64)}`;
const NEW = `sha256:${"b".repeat(64)}`;
const workflow = [
  "jobs:",
  "  unit:",
  "    container:",
  `      image: mcr.microsoft.com/playwright:v1.63.0-noble@${OLD}`,
  "  e2e:",
  "    container:",
  `      image: mcr.microsoft.com/playwright:v1.63.0-noble@${OLD}`,
  "  db:",
  "    services:",
  "      postgres:",
  "        image: postgres:17",
  "",
].join("\n");

describe("deps:fix (#2730)", () => {
  it("reads the locked @playwright/test version", () => {
    const lock = JSON.stringify({
      packages: { "node_modules/@playwright/test": { version: "1.64.1" } },
    });
    expect(lockedPlaywrightVersion(lock)).toBe("1.64.1");
  });

  it("fails when the lockfile has no @playwright/test", () => {
    expect(() => lockedPlaywrightVersion('{"packages":{}}')).toThrow(
      /no @playwright\/test/
    );
  });

  it("lists every pinned Playwright image version", () => {
    expect(pinnedPlaywrightVersions(workflow)).toEqual(["1.63.0", "1.63.0"]);
  });

  it("moves every Playwright image and leaves other images alone", () => {
    const next = rewritePlaywrightImages(workflow, "1.64.1", NEW);
    expect(pinnedPlaywrightVersions(next)).toEqual(["1.64.1", "1.64.1"]);
    expect(next).not.toContain(OLD);
    expect(next.split(NEW)).toHaveLength(3);
    expect(next).toContain("image: postgres:17");
    expect(next.split("\n")).toHaveLength(workflow.split("\n").length);
  });

  it("refuses anything that is not a sha256 digest", () => {
    expect(() => rewritePlaywrightImages(workflow, "1.64.1", "latest")).toThrow(
      /not an image digest/
    );
  });

  describe("Postgres 17 canonical digest helpers", () => {
    const pinA = `postgres:17@sha256:${"c".repeat(64)}`;
    const pinB = `postgres:17@sha256:${"d".repeat(64)}`;

    it("extracts and rewrites canonical postgres:17@sha256 pins", () => {
      expect(canonicalPostgresPin(`# comment\nFROM ${pinA}\n`)).toBe(pinA);
      const sample = `image: ${pinA}\n  "${pinA}"`;
      expect(rewritePostgresImages(sample, pinB)).toBe(
        `image: ${pinB}\n  "${pinB}"`
      );
    });

    it("rejects malformed Dockerfile or target pins", () => {
      expect(() => canonicalPostgresPin("FROM postgres:17-alpine")).toThrow(
        /FROM postgres:17@sha256/
      );
      expect(() => rewritePostgresImages("x", "postgres:17")).toThrow(
        /not a canonical postgres:17 digest pin/
      );
    });
  });

  describe("DuckDB wasm extensions refresh and drift check", () => {
    const tmpDirs: string[] = [];
    afterEach(() => {
      for (const dir of tmpDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });

    const wasmBytesA = Buffer.from([0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 10]);
    const wasmBytesB = Buffer.from([0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 20]);
    const shaA = crypto.createHash("sha256").update(wasmBytesA).digest("hex");
    const shaB = crypto.createHash("sha256").update(wasmBytesB).digest("hex");

    const sampleReadme = [
      "# Vendored DuckDB WebAssembly extensions",
      "",
      "- npm package: `@duckdb/duckdb-wasm` `1.32.0`",
      "- DuckDB version: `v1.4.3`",
      "- Platform: `wasm_eh`",
      "",
      "| File                            | DuckDB version | Platform  | Source URL                                                                   | SHA-256                                                            |",
      "| ------------------------------- | -------------- | --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |",
      `| \`json.duckdb_extension.wasm\`    | \`v1.4.3\`       | \`wasm_eh\` | \`https://extensions.duckdb.org/v1.4.3/wasm_eh/json.duckdb_extension.wasm\`    | \`${shaA}\` |`,
      `| \`parquet.duckdb_extension.wasm\` | \`v1.4.3\`       | \`wasm_eh\` | \`https://extensions.duckdb.org/v1.4.3/wasm_eh/parquet.duckdb_extension.wasm\` | \`${shaB}\` |`,
      "",
    ].join("\n");

    it("reads the locked @duckdb/duckdb-wasm version", () => {
      const lock = JSON.stringify({
        packages: { "node_modules/@duckdb/duckdb-wasm": { version: "1.33.0" } },
      });
      expect(lockedDuckdbWasmVersion(lock)).toBe("1.33.0");
      expect(() => lockedDuckdbWasmVersion('{"packages":{}}')).toThrow(
        /no @duckdb\/duckdb-wasm/
      );
    });

    it("parses and rewrites README versions, URLs, and SHA-256 digests", () => {
      const parsed = parseDuckdbExtensionsReadme(sampleReadme);
      expect(parsed.npmVersion).toBe("1.32.0");
      expect(parsed.duckdbVersion).toBe("v1.4.3");
      expect(parsed.entries).toHaveLength(2);

      const newJsonSha = "1".repeat(64);
      const newParquetSha = "2".repeat(64);
      const rewritten = rewriteDuckdbExtensionsReadme(sampleReadme, {
        npmVersion: "1.33.0",
        duckdbVersion: "v1.5.0",
        digests: {
          "json.duckdb_extension.wasm": newJsonSha,
          "parquet.duckdb_extension.wasm": newParquetSha,
        },
      });

      const reparsed = parseDuckdbExtensionsReadme(rewritten);
      expect(reparsed.npmVersion).toBe("1.33.0");
      expect(reparsed.duckdbVersion).toBe("v1.5.0");
      expect(reparsed.entries).toEqual([
        {
          file: "json.duckdb_extension.wasm",
          duckdbVersion: "v1.5.0",
          platform: "wasm_eh",
          sourceUrl:
            "https://extensions.duckdb.org/v1.5.0/wasm_eh/json.duckdb_extension.wasm",
          sha256: newJsonSha,
        },
        {
          file: "parquet.duckdb_extension.wasm",
          duckdbVersion: "v1.5.0",
          platform: "wasm_eh",
          sourceUrl:
            "https://extensions.duckdb.org/v1.5.0/wasm_eh/parquet.duckdb_extension.wasm",
          sha256: newParquetSha,
        },
      ]);
    });

    it("detects stale versions and SHA-256 drift, and refreshes binaries cleanly", async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deps-fix-duckdb-"));
      tmpDirs.push(dir);
      const readmePath = path.join(dir, "README.md");
      fs.writeFileSync(readmePath, sampleReadme);
      fs.writeFileSync(
        path.join(dir, "json.duckdb_extension.wasm"),
        wasmBytesA
      );
      fs.writeFileSync(
        path.join(dir, "parquet.duckdb_extension.wasm"),
        wasmBytesB
      );

      expect(
        checkDuckdbExtensionsDrift({
          extDir: dir,
          readmeText: sampleReadme,
          lockedNpmVersion: "1.32.0",
          engineVersion: "v1.4.3",
        })
      ).toEqual([]);

      const drift = checkDuckdbExtensionsDrift({
        extDir: dir,
        readmeText: sampleReadme,
        lockedNpmVersion: "1.33.0",
        engineVersion: "v1.5.0",
      });
      expect(drift.length).toBeGreaterThanOrEqual(2);

      const nextJsonBytes = Buffer.from([
        0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 99,
      ]);
      const nextParquetBytes = Buffer.from([
        0x00, 0x61, 0x73, 0x6d, 1, 0, 0, 0, 88,
      ]);
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const body = url.endsWith("json.duckdb_extension.wasm")
          ? nextJsonBytes
          : nextParquetBytes;
        return new Response(body, { status: 200 });
      });

      await refreshDuckdbExtensions({
        extDir: dir,
        readmePath,
        lockedNpmVersion: "1.33.0",
        engineVersion: "v1.5.0",
        fetchImpl: fetchMock,
      });

      expect(
        checkDuckdbExtensionsDrift({
          extDir: dir,
          readmeText: fs.readFileSync(readmePath, "utf8"),
          lockedNpmVersion: "1.33.0",
          engineVersion: "v1.5.0",
        })
      ).toEqual([]);
    });
  });
});
