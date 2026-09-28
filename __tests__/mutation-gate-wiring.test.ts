import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  parseScope,
  resolveTargetsForScope,
  CORE_TARGETS,
  FULL_TARGETS,
} from "../scripts/run-mutation-tests";

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

  it("configures stryker.config.mjs with empty excludedMutations array", () => {
    const configSource = fs.readFileSync(
      path.join(workspaceRoot, "stryker.config.mjs"),
      "utf8"
    );
    expect(configSource).toContain("excludedMutations: []");
  });

  it("parses scope flags correctly in scripts/run-mutation-tests.ts", () => {
    expect(parseScope([])).toBe("core");
    expect(parseScope(["--scope=full"])).toBe("full");
    expect(parseScope(["--scope=staged"])).toBe("staged");
    expect(parseScope(["--scope=core"])).toBe("core");
    expect(parseScope(["--scope", "full"])).toBe("full");
    expect(parseScope(["--scope", "staged"])).toBe("staged");
    expect(parseScope(["--invalid-flag"])).toBe("core");
  });

  it("resolves target lists for each scope", () => {
    expect(resolveTargetsForScope("core")).toEqual(CORE_TARGETS);
    expect(resolveTargetsForScope("full")).toEqual(FULL_TARGETS);
    const stagedTargets = resolveTargetsForScope("staged");
    expect(Array.isArray(stagedTargets)).toBe(true);
    expect(stagedTargets.length).toBeGreaterThan(0);
  });

  it("verifies vitest.config.ts removes blanket UI exclusions and declares tiered thresholds", () => {
    const vitestConfig = fs.readFileSync(
      path.join(workspaceRoot, "vitest.config.ts"),
      "utf8"
    );
    // Extract exclude block from vitestConfig
    const excludeMatch = vitestConfig.match(/exclude:\s*\[([\s\S]*?)\]/);
    expect(excludeMatch).not.toBeNull();
    const excludeBlock = excludeMatch![1];

    expect(excludeBlock).not.toContain('"components/**"');
    expect(excludeBlock).not.toContain('"app/**/page.tsx"');
    expect(excludeBlock).not.toContain('"app/**/layout.tsx"');

    expect(vitestConfig).toContain('"components/**":');
    expect(vitestConfig).toContain('"app/**":');
    expect(vitestConfig).toContain('"lib/proof-utils.ts":');
    expect(vitestConfig).toContain('"lib/trial-and-error/**":');
  });
});
