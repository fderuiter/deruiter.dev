// @vitest-environment node
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { DEFAULT_IGNORE_LIST } from "../scripts/security-audit";

interface PackageLock {
  packages?: Record<string, { dependencies?: Record<string, string> }>;
}

interface AuditIgnoreRule {
  advisory?: string;
  package?: string;
}

const repositoryRoot = path.resolve(__dirname, "..");
const extractZipAdvisories = new Set([
  "GHSA-jmr9-qjv8-65gv",
  "GHSA-7pqw-9j4j-h8q3",
]);

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, relativePath), "utf-8")
  ) as T;
}

interface ZipEntry {
  name: string;
  data: string;
  isSymlink?: boolean;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries: ZipEntry[]): Buffer {
  const localRecords: Buffer[] = [];
  const centralRecords: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data);
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localRecords.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(
      (entry.isSymlink ? 0o120777 : 0o100644) * 0x1_0000,
      38
    );
    centralHeader.writeUInt32LE(offset, 42);
    centralRecords.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralRecords);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);

  return Buffer.concat([
    ...localRecords,
    centralDirectory,
    endOfCentralDirectory,
  ]);
}

describe("extract-zip remediation", () => {
  it("removes the vulnerable extractor and its legacy Lighthouse CI owner", () => {
    const packageManifest = readJson<{
      devDependencies?: Record<string, string>;
    }>("package.json");
    const lockfile = readJson<PackageLock>("package-lock.json");

    expect(packageManifest.devDependencies).not.toHaveProperty("@lhci/cli");
    expect(lockfile.packages).not.toHaveProperty("node_modules/extract-zip");
    expect(lockfile.packages).not.toHaveProperty("node_modules/@lhci/cli");
  });

  it("does not invoke Lighthouse CI through the build pipeline", () => {
    const ciWorkflow = fs.readFileSync(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf-8"
    );

    expect(ciWorkflow).not.toContain("lhci");
    expect(ciWorkflow).not.toContain("lighthouse");
  });

  it("keeps a malicious symlink archive inside an isolated destination", () => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "extract-zip-remediation-")
    );
    const destinationDirectory = path.join(fixtureRoot, "destination");
    const outsideDestination = path.join(fixtureRoot, "outside");
    const archivePath = path.join(fixtureRoot, "malicious-symlink.zip");

    try {
      fs.mkdirSync(outsideDestination);
      fs.writeFileSync(
        archivePath,
        createStoredZip([
          { name: "escape-link", data: "../outside", isSymlink: true },
          {
            name: "escape-link/escaped-payload.txt",
            data: "malicious payload",
          },
        ])
      );

      const extraction = spawnSync(
        "unzip",
        ["-qq", archivePath, "-d", destinationDirectory],
        { encoding: "utf-8" }
      );
      expect(extraction.error).toBeUndefined();
      expect(extraction.status).not.toBeNull();
      expect(fs.readdirSync(outsideDestination)).toEqual([]);
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("does not silently accept either extract-zip advisory", () => {
    const ignoreSources = [
      readJson<AuditIgnoreRule[]>("security-audit-ignore.json"),
      readJson<AuditIgnoreRule[]>("scripts/security-audit-ignore.json"),
      DEFAULT_IGNORE_LIST,
    ];

    for (const rules of ignoreSources) {
      expect(
        rules.filter(
          (rule) =>
            rule.package === "extract-zip" &&
            extractZipAdvisories.has(rule.advisory ?? "")
        )
      ).toEqual([]);
    }
  });
});
