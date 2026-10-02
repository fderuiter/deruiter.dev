// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateBrandIcons } from "../scripts/generate-brand-icons";
import { generateTheme } from "../scripts/generate-theme";
import { designManifest } from "../lib/design-manifest";

const workspaceRoot = process.cwd();
const tsxCli = path.join(workspaceRoot, "node_modules/tsx/dist/cli.mjs");
const standaloneScript = path.join(
  workspaceRoot,
  "scripts/build-standalone-engine.ts"
);
const trackedOutputs = [
  "app/icon.svg",
  "app/favicon.ico",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "lib/design-manifest.ts",
  "public/garmin-engine.js",
  "public/monkey-c-mayhem.js",
];

describe("asset generation and staging workflow", () => {
  let temporaryRoot: string;
  let sourceSnapshots: Map<string, Buffer>;

  beforeAll(() => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-assets-test-")
    );
    sourceSnapshots = new Map(
      trackedOutputs.map((relativePath) => [
        relativePath,
        fs.readFileSync(path.join(workspaceRoot, relativePath)),
      ])
    );
  });

  afterAll(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it("generates deterministic icon and theme outputs outside the workspace", async () => {
    const iconOutputRoot = path.join(temporaryRoot, "icons");
    const themeOutputPath = path.join(
      temporaryRoot,
      "theme",
      "design-manifest.ts"
    );

    await generateBrandIcons({
      sourceRoot: workspaceRoot,
      outputRoot: iconOutputRoot,
    });
    const firstTheme = generateTheme({
      sourceRoot: workspaceRoot,
      outputPath: themeOutputPath,
    });
    const firstIcon = fs.readFileSync(
      path.join(iconOutputRoot, "public/favicon.ico")
    );

    await generateBrandIcons({
      sourceRoot: workspaceRoot,
      outputRoot: iconOutputRoot,
    });
    const secondTheme = generateTheme({
      sourceRoot: workspaceRoot,
      outputPath: themeOutputPath,
    });
    const secondIcon = fs.readFileSync(
      path.join(iconOutputRoot, "public/favicon.ico")
    );

    expect(firstTheme).toBe(secondTheme);
    expect(firstIcon.equals(secondIcon)).toBe(true);
    expect(
      fs
        .readFileSync(path.join(iconOutputRoot, "app/favicon.ico"))
        .equals(secondIcon)
    ).toBe(true);
    expect(
      fs.readFileSync(path.join(iconOutputRoot, "app/icon.svg"), "utf8")
    ).toBe(
      fs.readFileSync(path.join(iconOutputRoot, "public/favicon.svg"), "utf8")
    );
  });

  it("builds identical standalone aliases in an isolated directory and leaves no failed output", () => {
    const outputDir = path.join(temporaryRoot, "standalone");
    const build = (directory: string, maxSizeBytes?: number) =>
      execFileSync(
        process.execPath,
        [
          tsxCli,
          standaloneScript,
          "--source-root",
          workspaceRoot,
          "--output-dir",
          directory,
          ...(maxSizeBytes ? ["--max-size-bytes", String(maxSizeBytes)] : []),
        ],
        { cwd: workspaceRoot, stdio: "pipe" }
      );
    build(outputDir);
    const firstBuild = fs.readFileSync(
      path.join(outputDir, "garmin-engine.js")
    );

    build(outputDir);
    expect(
      fs
        .readFileSync(path.join(outputDir, "garmin-engine.js"))
        .equals(firstBuild)
    ).toBe(true);
    expect(
      fs
        .readFileSync(path.join(outputDir, "monkey-c-mayhem.js"))
        .equals(firstBuild)
    ).toBe(true);

    const rejectedOutputDir = path.join(temporaryRoot, "rejected-standalone");
    expect(() => build(rejectedOutputDir, 1)).toThrow();
    expect(fs.existsSync(rejectedOutputDir)).toBe(false);
  });

  it("preserves all tracked generator destinations during validation", () => {
    for (const [relativePath, snapshot] of sourceSnapshots) {
      expect(
        fs.readFileSync(path.join(workspaceRoot, relativePath)).equals(snapshot)
      ).toBe(true);
    }
  });

  it("regenerates the committed design manifest byte for byte", () => {
    const committedPath = path.join(workspaceRoot, "lib/design-manifest.ts");
    const committed = fs.readFileSync(committedPath, "utf8");
    const regenerated = generateTheme({
      sourceRoot: workspaceRoot,
      outputPath: path.join(temporaryRoot, "committed-parity-manifest.ts"),
    });

    expect(regenerated).toBe(committed);
  });

  it("annotates generated tokens with the CSS variable they compile from", () => {
    const regenerated = generateTheme({
      sourceRoot: workspaceRoot,
      outputPath: path.join(temporaryRoot, "annotated-manifest.ts"),
    });

    expect(regenerated).toContain("/** Original CSS Variable: --background */");
    expect(regenerated).toContain(
      "/** Original CSS Variable: --layout-masonry-padding-with-stats */"
    );
    expect(regenerated).toContain(
      "/** Original CSS Variable: --breakpoint-2xl */"
    );
    expect(regenerated).toContain("/** Font stack for sans-serif */");
  });

  it("exports strongly typed runtime design tokens", () => {
    expect(designManifest.colors.background).toBeDefined();
    expect(designManifest.typography.fonts.sans).toContain(
      "var(--font-atkinson)"
    );
    expect(designManifest.typography.fonts.heading).toContain(
      "var(--font-lexend)"
    );
    expect(designManifest.motion.springs).toBeDefined();
  });

  it("runs formatting before linting and skips generated artifacts", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lintStagedConfig = require("../lint-staged.config.cjs") as Record<
      string,
      (files: string[]) => string[]
    >;
    const commands = lintStagedConfig["*"]([
      "/repo/components/Example File.tsx",
      "/repo/public/garmin-engine.js",
      "/repo/docs/guide.md",
    ]);

    expect(commands).toHaveLength(2);
    expect(commands[0]).toContain("prettier");
    expect(commands[0]).toContain("Example File.tsx");
    expect(commands[0]).not.toContain("garmin-engine.js");
    expect(commands[1]).toContain("eslint");
    expect(commands[1]).toContain("Example File.tsx");
  });

  it("keeps test setup non-mutating", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(workspaceRoot, "package.json"), "utf8")
    );
    expect(packageJson.scripts.pretest).toBe("prisma generate");
  });
});
