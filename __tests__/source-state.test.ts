// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { inspectSourceState } from "@/lib/dx/source-state";

describe("inspectSourceState (#1377)", () => {
  let repo: string;
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf-8" });

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-source-state-"));
    git("init", "-q");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    fs.mkdirSync(path.join(repo, "public"));
    fs.writeFileSync(path.join(repo, "public", "garmin-engine.js"), "var a=1");
    fs.writeFileSync(
      path.join(repo, "public", "monkey-c-mayhem.js"),
      "var a=1"
    );
    fs.writeFileSync(path.join(repo, "app.ts"), "export {};\n");
    git("add", "-A");
    git("commit", "-q", "-m", "init");
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("is clean when only the regenerated engine bundles changed", () => {
    fs.writeFileSync(path.join(repo, "public", "garmin-engine.js"), "var x=1");
    fs.writeFileSync(
      path.join(repo, "public", "monkey-c-mayhem.js"),
      "var x=1"
    );
    const state = inspectSourceState(repo);
    expect(state.dirty).toBe(false);
    expect(state.revision).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is dirty when authored source changed", () => {
    fs.writeFileSync(path.join(repo, "app.ts"), "export const a = 1;\n");
    expect(inspectSourceState(repo).dirty).toBe(true);
  });

  it("is dirty when an untracked file appears", () => {
    fs.writeFileSync(path.join(repo, "new.ts"), "export {};\n");
    expect(inspectSourceState(repo).dirty).toBe(true);
  });
});

describe("DX Doctor clean-tree definition (#1377)", () => {
  it("reads dirty state through inspectSourceState, not a raw git status", () => {
    const doctor = fs.readFileSync(
      path.resolve(process.cwd(), "lib/dx/doctor.ts"),
      "utf-8"
    );
    const start = doctor.indexOf("export function checkSubRoutePerformance");
    const end = doctor.indexOf("\nexport function", start + 1);
    const body = doctor.slice(start, end === -1 ? undefined : end);
    expect(body).toContain("inspectSourceState(");
    expect(body).not.toContain("git status --porcelain");
  });
});
