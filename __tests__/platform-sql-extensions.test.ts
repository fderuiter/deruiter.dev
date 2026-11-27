// @vitest-environment node
/**
 * Guards the vendored DuckDB WebAssembly extension binaries in
 * `components/platform/sql/extensions/` against silent drift when
 * `@duckdb/duckdb-wasm` is upgraded. A DuckDB extension only loads into the
 * exact engine version and platform (`wasm_eh`) it was compiled for, so every
 * binary's SHA-256, embedded `duckdb_signature` trailer, recorded DuckDB
 * version, `@duckdb/duckdb-wasm` package pin, and MIT attribution are checked
 * here in CI.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { PACKAGE_VERSION } from "@duckdb/duckdb-wasm";
import {
  NODE_RUNTIME,
  VoidLogger,
  createDuckDB,
} from "@duckdb/duckdb-wasm/blocking";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const EXTENSIONS_DIR = path.join(
  ROOT,
  "components",
  "platform",
  "sql",
  "extensions"
);

interface RecordedExtension {
  file: string;
  duckdbVersion: string;
  platform: string;
  sourceUrl: string;
  sha256: string;
}

interface ParsedExtensionReadme {
  npmVersion: string;
  duckdbVersion: string;
  platform: string;
  entries: RecordedExtension[];
}

function parseExtensionReadme(markdown: string): ParsedExtensionReadme {
  const npmMatch = /^- npm package: `@duckdb\/duckdb-wasm` `([^`]+)`$/m.exec(
    markdown
  );
  const duckdbMatch = /^- DuckDB version: `(v\d+\.\d+\.\d+)`$/m.exec(markdown);
  const platformMatch = /^- Platform: `([^`]+)`$/m.exec(markdown);
  if (!npmMatch || !duckdbMatch || !platformMatch) {
    throw new Error(
      "components/platform/sql/extensions/README.md is missing version or platform metadata bullets."
    );
  }

  const rowPattern =
    /^\|\s*`([^`]+\.duckdb_extension\.wasm)`\s*\|\s*`(v\d+\.\d+\.\d+)`\s*\|\s*`([^`]+)`\s*\|\s*`(https:\/\/extensions\.duckdb\.org\/[^`]+)`\s*\|\s*`([0-9a-f]{64})`\s*\|$/gm;
  const entries: RecordedExtension[] = [];
  for (const match of markdown.matchAll(rowPattern)) {
    entries.push({
      file: match[1],
      duckdbVersion: match[2],
      platform: match[3],
      sourceUrl: match[4],
      sha256: match[5],
    });
  }
  return {
    npmVersion: npmMatch[1],
    duckdbVersion: duckdbMatch[1],
    platform: platformMatch[1],
    entries,
  };
}

/**
 * Reads the 8 x 32-byte metadata slots preceding the 256-byte RSA signature in
 * DuckDB's 512-byte `duckdb_signature` WebAssembly custom section trailer.
 */
function readDuckdbExtensionMetadata(binary: Buffer): {
  abiType: string;
  duckdbVersion: string;
  platform: string;
} {
  const marker = Buffer.from("duckdb_signature", "ascii");
  const markerAt = binary.lastIndexOf(marker);
  if (markerAt < 0 || binary.length < 512) {
    throw new Error("Missing duckdb_signature WebAssembly custom section.");
  }
  // Custom section payload ends at EOF: 8 x 32-byte null-padded fields + 256-byte signature = 512 bytes.
  const payload = binary.subarray(binary.length - 512);
  const slot = (index: number) =>
    payload
      .subarray(index * 32, (index + 1) * 32)
      .toString("utf8")
      .replace(/\0+$/, "");
  return {
    abiType: slot(3),
    duckdbVersion: slot(4),
    platform: slot(6),
  };
}

describe("vendored DuckDB WebAssembly extensions", () => {
  const readme = fs.readFileSync(
    path.join(EXTENSIONS_DIR, "README.md"),
    "utf8"
  );
  const parsed = parseExtensionReadme(readme);

  it("records every .duckdb_extension.wasm binary on disk with matching SHA-256, URL, and embedded signature metadata", () => {
    const wasmFilesOnDisk = fs
      .readdirSync(EXTENSIONS_DIR)
      .filter((name) => name.endsWith(".duckdb_extension.wasm"))
      .sort();

    expect(wasmFilesOnDisk).toEqual([
      "json.duckdb_extension.wasm",
      "parquet.duckdb_extension.wasm",
    ]);
    expect(parsed.platform).toBe("wasm_eh");
    expect(parsed.entries.map((entry) => entry.file).sort()).toEqual(
      wasmFilesOnDisk
    );

    for (const entry of parsed.entries) {
      expect(entry.duckdbVersion, entry.file).toBe(parsed.duckdbVersion);
      expect(entry.platform, entry.file).toBe("wasm_eh");
      expect(entry.sourceUrl, entry.file).toBe(
        `https://extensions.duckdb.org/${parsed.duckdbVersion}/wasm_eh/${entry.file}`
      );

      const bytes = fs.readFileSync(path.join(EXTENSIONS_DIR, entry.file));
      const actualSha256 = crypto
        .createHash("sha256")
        .update(bytes)
        .digest("hex");
      expect(
        actualSha256,
        `${entry.file} SHA-256 drifted from components/platform/sql/extensions/README.md`
      ).toBe(entry.sha256);

      const trailer = readDuckdbExtensionMetadata(bytes);
      expect(trailer, `${entry.file} duckdb_signature metadata`).toEqual({
        abiType: "CPP",
        duckdbVersion: parsed.duckdbVersion,
        platform: "wasm_eh",
      });
    }
  });

  it("matches both the @duckdb/duckdb-wasm version in package.json and the DuckDB engine version it reports", async () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
    ) as { dependencies?: Record<string, string> };
    const lock = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8")
    ) as { packages?: Record<string, { version?: string }> };

    expect(pkg.dependencies?.["@duckdb/duckdb-wasm"]).toBe(parsed.npmVersion);
    expect(lock.packages?.["node_modules/@duckdb/duckdb-wasm"]?.version).toBe(
      parsed.npmVersion
    );
    expect(PACKAGE_VERSION).toBe(parsed.npmVersion);

    const dist = path.dirname(
      createRequire(import.meta.url).resolve("@duckdb/duckdb-wasm/blocking")
    );
    const db = await createDuckDB(
      {
        mvp: { mainModule: path.join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
        eh: { mainModule: path.join(dist, "duckdb-eh.wasm"), mainWorker: "" },
      },
      new VoidLogger(),
      NODE_RUNTIME
    );
    try {
      await db.instantiate(() => {});
      expect(
        db.getVersion(),
        "Vendored DuckDB extensions do not match @duckdb/duckdb-wasm engine version; run the refresh command in components/platform/sql/extensions/README.md"
      ).toBe(parsed.duckdbVersion);
    } finally {
      db.reset();
    }
  });

  it("keeps the MIT license text and non-npm OSS credits for the vendored extensions", () => {
    const license = fs.readFileSync(
      path.join(EXTENSIONS_DIR, "LICENSE"),
      "utf8"
    );
    expect(license).toContain(
      "Copyright 2018-2025 Stichting DuckDB Foundation"
    );
    expect(license).toContain("Permission is hereby granted, free of charge");

    const rootNotice = fs.readFileSync(path.join(ROOT, "NOTICE"), "utf8");
    expect(rootNotice).toContain("components/platform/sql/extensions/");
    expect(rootNotice).toContain("https://github.com/duckdb/duckdb");
  });
});
