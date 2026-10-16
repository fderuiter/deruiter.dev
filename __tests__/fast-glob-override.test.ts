// @vitest-environment node
import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { describe, expect, it } from "vitest";

// #1783: braces has no patched release for GHSA-vfj7-8cjw-p6xm, so the
// package.json override replaces fast-glob (its only path into the tree) with
// tinyglobby. That holds only while @next/eslint-plugin-next calls nothing
// tinyglobby lacks, so this suite pins the call it makes and keeps braces out.

const root = process.cwd();
const pluginRequire = createRequire(
  path.join(root, "node_modules/@next/eslint-plugin-next/package.json")
);

describe("fast-glob override for the braces advisory (#1783)", () => {
  it("keeps braces out of the lockfile", () => {
    const lock = JSON.parse(
      fs.readFileSync(path.join(root, "package-lock.json"), "utf-8")
    ) as { packages: Record<string, unknown> };
    const bracesPaths = Object.keys(lock.packages).filter((key) =>
      key.endsWith("node_modules/braces")
    );
    expect(bracesPaths).toEqual([]);
  });

  it("calls only globSync from fast-glob in the Next.js lint plugin", () => {
    const source = fs.readFileSync(
      pluginRequire.resolve("./dist/utils/get-root-dirs.js"),
      "utf-8"
    );
    const calls = [...source.matchAll(/_fastglob\.(\w+)/g)].map((m) => m[1]);
    expect(calls).toEqual(["globSync"]);
  });

  it("resolves the plugin's fast-glob to a working globSync", () => {
    const glob = pluginRequire("fast-glob") as {
      globSync: (
        pattern: string,
        options: { onlyDirectories: boolean }
      ) => string[];
    };
    const dirs = glob.globSync("app/a*", { onlyDirectories: true });
    expect(dirs.map((dir) => dir.replace(/\/$/, ""))).toEqual(
      expect.arrayContaining(["app/admin", "app/api"])
    );
  });

  // tinyglobby expands a literal directory pattern to its subdirectories,
  // which fast-glob does not, so a `settings.next.rootDir` naming one folder
  // would make the lint rule scan every nested folder for pages. The call
  // only runs when that setting exists, so keep it unset while the override
  // stands.
  it("leaves settings.next.rootDir unset in the ESLint config", async () => {
    const config = (await import("../eslint.config.mjs")).default as Array<{
      settings?: { next?: { rootDir?: unknown } };
    }>;
    const rootDirs = config
      .map((entry) => entry.settings?.next?.rootDir)
      .filter((value) => value !== undefined);
    expect(rootDirs).toEqual([]);
  });
});
