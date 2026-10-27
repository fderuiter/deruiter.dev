// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createRequire } from "module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { decideBuild } = require("../scripts/vercel-ignore-build.js");

const script = path.resolve(process.cwd(), "scripts/vercel-ignore-build.js");

function exitCode(vercelEnv: string): number | null {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, VERCEL_ENV: vercelEnv },
    encoding: "utf8",
  }).status;
}

describe("Ignored Build Step", () => {
  it("always builds production", () => {
    expect(decideBuild({ VERCEL_ENV: "production" }).build).toBe(true);
    expect(exitCode("production")).toBe(1);
  });

  it("builds an on-demand preview", () => {
    expect(decideBuild({ VERCEL_ENV: "preview" }).build).toBe(true);
    expect(exitCode("preview")).toBe(1);
  });

  it("skips anything else", () => {
    expect(decideBuild({ VERCEL_ENV: "development" }).build).toBe(false);
    expect(decideBuild({}).build).toBe(false);
    expect(exitCode("development")).toBe(0);
  });

  it("needs nothing but Node, because it runs before npm ci", () => {
    const source = readFileSync(script, "utf8");
    expect(source.match(/require\(/g) ?? []).toHaveLength(0);
  });
});

describe("vercel.json", () => {
  const config = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8")
  );

  it("owns the Ignored Build Step", () => {
    expect(config.ignoreCommand).toBe("node scripts/vercel-ignore-build.js");
  });

  it("keeps Git deployments off, so every build was asked for", () => {
    expect(config.git.deploymentEnabled).toBe(false);
  });
});
