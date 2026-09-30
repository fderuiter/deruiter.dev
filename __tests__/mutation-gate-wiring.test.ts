import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();

describe("mutation gate wiring", () => {
  it("uses the declared modern Stryker CLI and Vitest runner without runtime package fetching", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(workspaceRoot, "package.json"), "utf8")
    ) as {
      devDependencies?: Record<string, string>;
    };
    const runnerSource = fs.readFileSync(
      path.join(workspaceRoot, "scripts/run-mutation-tests.ts"),
      "utf8"
    );
    const configSource = fs.readFileSync(
      path.join(workspaceRoot, "stryker.config.mjs"),
      "utf8"
    );

    expect(
      packageJson.devDependencies?.["@stryker-mutator/core"]
    ).toBeDefined();
    expect(
      packageJson.devDependencies?.["@stryker-mutator/vitest-runner"]
    ).toBeDefined();
    expect(runnerSource).not.toContain("npx stryker");
    expect(runnerSource).toContain("@stryker-mutator/core/bin/stryker.js");
    expect(configSource).toContain("ignorePatterns");
    expect(configSource).toContain('"/.vercel/**"');
    expect(configSource).toContain('"/.stryker-tmp/**"');
    expect(configSource).toContain(
      'fileName: ".stryker-tmp/mutation-report.html"'
    );
  });

  it("never lets the mutation break threshold fall below the ratcheted floor (#968)", async () => {
    const { default: config } = (await import(
      path.join(workspaceRoot, "stryker.config.mjs")
    )) as { default: { thresholds: { break: number } } };

    expect(config.thresholds.break).toBeGreaterThanOrEqual(75);
    expect(config.thresholds.break).toBeLessThanOrEqual(80);
  });
});
