// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { GENERATED_BUILD_ARTIFACTS } from "../lib/dx/source-state";
import { inspectSourceState } from "../lib/dx/source-state";
import {
  BUILD_PROVENANCE_FILE,
  validateBuildProvenance,
} from "../lib/dx/benchmark-runner";

const root = process.cwd();
const provenanceModule = path.join(root, "scripts/build-provenance.js");

/**
 * #1769: scripts/build.js writes .next/build-provenance.json so that
 * `bench:pages --assert` can measure CI's one build instead of building again.
 * The record must use the same definition of a clean tree as
 * inspectSourceState(), or a valid build would be rejected (or worse, a dirty
 * one accepted).
 */
describe("build provenance (#1769)", () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  /** A throwaway git repository with one commit and a fake build. */
  function fixtureRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "build-provenance-"));
    temps.push(dir);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("config", "user.email", "ci@example.test");
    git("config", "user.name", "CI");
    git("config", "commit.gpgsign", "false");
    fs.writeFileSync(path.join(dir, ".gitignore"), "/.next/\n");
    fs.mkdirSync(path.join(dir, "public"));
    fs.writeFileSync(path.join(dir, "public/garmin-engine.js"), "v1\n");
    fs.writeFileSync(path.join(dir, "app.ts"), "export {};\n");
    git("add", ".");
    git("commit", "-q", "--no-verify", "-m", "init");
    fs.mkdirSync(path.join(dir, ".next"));
    fs.writeFileSync(path.join(dir, ".next/BUILD_ID"), "fixture-build\n");
    return dir;
  }

  /** Runs the CommonJS helpers in a child without VITEST, as a real build does. */
  function runBuildProvenance(dir: string, script: string): string {
    const env = { ...process.env };
    delete env.VITEST;
    delete env.VITEST_WORKER_ID;
    delete env.VITEST_POOL_ID;
    return execFileSync(
      process.execPath,
      [
        "-e",
        `const p = require(${JSON.stringify(provenanceModule)}); ${script}`,
      ],
      { cwd: dir, env, encoding: "utf-8" }
    );
  }

  it("excludes the same rewritten build artifacts as inspectSourceState()", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const helpers = require(provenanceModule) as {
      GENERATED_BUILD_ARTIFACTS: string[];
      BUILD_PROVENANCE_FILE: string;
    };
    expect(helpers.GENERATED_BUILD_ARTIFACTS).toEqual([
      ...GENERATED_BUILD_ARTIFACTS,
    ]);
    expect(helpers.BUILD_PROVENANCE_FILE.replace(/\\/g, "/")).toBe(
      BUILD_PROVENANCE_FILE
    );
  });

  it("writes a record the benchmark accepts for a clean build", () => {
    const dir = fixtureRepo();
    runBuildProvenance(
      dir,
      "const before = p.captureSourceState(); p.clearBuildProvenance(); require('fs').writeFileSync('public/garmin-engine.js', 'v2\\n'); p.writeBuildProvenance(before);"
    );

    const record = JSON.parse(
      fs.readFileSync(path.join(dir, BUILD_PROVENANCE_FILE), "utf-8")
    );
    expect(record).toMatchObject({
      version: 1,
      command: "npm run build",
      sourceDirty: false,
      sourceDirtyAfterBuild: false,
      buildId: "fixture-build",
    });
    expect(
      validateBuildProvenance(record, {
        source: inspectSourceState(dir),
        buildId: "fixture-build",
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("records a build that started from a dirty tree, which the benchmark rejects", () => {
    const dir = fixtureRepo();
    fs.writeFileSync(path.join(dir, "app.ts"), "export const x = 1;\n");
    runBuildProvenance(dir, "p.writeBuildProvenance(p.captureSourceState());");
    const record = JSON.parse(
      fs.readFileSync(path.join(dir, BUILD_PROVENANCE_FILE), "utf-8")
    );
    expect(record.sourceDirty).toBe(true);
    expect(
      validateBuildProvenance(record, {
        source: { revision: record.sourceRevision, dirty: false },
        buildId: "fixture-build",
      }).valid
    ).toBe(false);
  });

  it("clears a previous record so a failed build cannot be reused", () => {
    const dir = fixtureRepo();
    fs.writeFileSync(path.join(dir, BUILD_PROVENANCE_FILE), "{}");
    runBuildProvenance(dir, "p.clearBuildProvenance();");
    expect(fs.existsSync(path.join(dir, BUILD_PROVENANCE_FILE))).toBe(false);
  });

  it("never touches .next under Vitest, where build.js runs with a mocked build", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const helpers = require(provenanceModule) as {
      captureSourceState: () => { revision: string | null };
      writeBuildProvenance: (before: unknown, cwd: string) => unknown;
    };
    const dir = fixtureRepo();
    expect(helpers.captureSourceState().revision).toBeNull();
    expect(
      helpers.writeBuildProvenance({ revision: "x", dirty: false }, dir)
    ).toBeNull();
    expect(fs.existsSync(path.join(dir, BUILD_PROVENANCE_FILE))).toBe(false);
  });

  it("clears the record before building and writes it only after next build succeeds", () => {
    const build = fs.readFileSync(path.join(root, "scripts/build.js"), "utf-8");
    const clear = build.indexOf("clearBuildProvenance();");
    const nextBuild = build.indexOf(
      'runStep("npx", ["next", "build", "--webpack"])'
    );
    const write = build.indexOf("writeBuildProvenance(sourceBeforeBuild)");
    expect(clear).toBeGreaterThan(-1);
    expect(nextBuild).toBeGreaterThan(clear);
    expect(write).toBeGreaterThan(nextBuild);
  });
});
