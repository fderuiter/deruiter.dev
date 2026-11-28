// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { shouldSkipPostinstall } from "../scripts/postinstall.mjs";

const tempDirs: string[] = [];

function makeFakeRoot(withBins: readonly string[]): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "postinstall-test-"));
  tempDirs.push(root);
  const binDir = path.join(root, "node_modules", ".bin");
  fs.mkdirSync(binDir, { recursive: true });
  for (const name of withBins) {
    fs.writeFileSync(path.join(binDir, name), "#!/bin/sh\n");
  }
  return root;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("production-safe postinstall and prisma.config.ts", () => {
  it("skips postinstall when npm_config_omit includes dev", () => {
    const root = makeFakeRoot(["prisma", "tsx"]);
    expect(
      shouldSkipPostinstall({
        root,
        platform: "linux",
        env: { npm_config_omit: "dev" },
      })
    ).toBe(true);
    expect(
      shouldSkipPostinstall({
        root,
        platform: "linux",
        env: { npm_config_omit: "optional, dev" },
      })
    ).toBe(true);
  });

  it("skips postinstall when prisma or tsx binaries are absent", () => {
    expect(
      shouldSkipPostinstall({
        root: makeFakeRoot(["prisma"]),
        platform: "linux",
        env: {},
      })
    ).toBe(true);
    expect(
      shouldSkipPostinstall({
        root: makeFakeRoot(["tsx"]),
        platform: "linux",
        env: {},
      })
    ).toBe(true);
  });

  it("runs postinstall when dev binaries exist and dev is not omitted", () => {
    const root = makeFakeRoot(["prisma", "tsx"]);
    expect(
      shouldSkipPostinstall({
        root,
        platform: "linux",
        env: { npm_config_omit: "optional" },
      })
    ).toBe(false);
  });

  it("loads env files in prisma.config.ts via process.loadEnvFile without dotenv", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "prisma.config.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/\bdotenv\b/);
    expect(source).toContain("process.loadEnvFile");
    expect(source).toContain("fs.existsSync");
  });
});
