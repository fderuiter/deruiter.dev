// @vitest-environment node
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// #1368: the Vitest configs are native ES modules (.mts), so Vite loads them
// without the "ESM syntax in a file loaded as CommonJS" notice and no script
// needs VITE_CONFIG_NATIVE_IGNORE_WARNING to hide it.

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf-8");

describe("Vitest configs load as native ESM (#1368)", () => {
  it("keeps every config as .mts with no .ts copies", () => {
    for (const name of [
      "vitest.config",
      "config/stryker/vitest.stryker.config",
      "config/stryker/vitest.stryker-engines.config",
      "config/stryker/vitest.stryker-garmin.config",
      "config/stryker/vitest.stryker-study-data.config",
    ]) {
      expect(fs.existsSync(path.join(root, `${name}.mts`))).toBe(true);
      expect(fs.existsSync(path.join(root, `${name}.ts`))).toBe(false);
    }
    expect(read("config/stryker/stryker.config.mjs")).toContain(
      'configFile: "config/stryker/vitest.stryker.config.mts"'
    );
    expect(read("config/stryker/stryker.engines.config.mjs")).toContain(
      'configFile: "config/stryker/vitest.stryker-engines.config.mts"'
    );
    expect(read("config/stryker/stryker.garmin.config.mjs")).toContain(
      'configFile: "config/stryker/vitest.stryker-garmin.config.mts"'
    );
    expect(read("config/stryker/stryker.study-data.config.mjs")).toContain(
      'configFile: "config/stryker/vitest.stryker-study-data.config.mts"'
    );
  });

  it("resolves paths with import.meta.dirname, not CommonJS __dirname", () => {
    for (const file of [
      "vitest.config.mts",
      "config/stryker/vitest.stryker.config.mts",
      "config/stryker/vitest.stryker-engines.config.mts",
      "config/stryker/vitest.stryker-garmin.config.mts",
      "config/stryker/vitest.stryker-study-data.config.mts",
    ]) {
      const source = read(file);
      expect(source).toContain("import.meta.dirname");
      expect(source).not.toMatch(/\b__dirname\b/);
    }
  });

  it("no longer suppresses the config loader notice anywhere", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    for (const [name, command] of Object.entries(pkg.scripts)) {
      expect(command, name).not.toContain("VITE_CONFIG_NATIVE_IGNORE_WARNING");
    }
    for (const file of [
      "vitest.config.mts",
      "scripts/test-staged.ts",
      "scripts/run-mutation-tests.ts",
    ]) {
      expect(read(file), file).not.toContain(
        "VITE_CONFIG_NATIVE_IGNORE_WARNING"
      );
    }
  });
});
