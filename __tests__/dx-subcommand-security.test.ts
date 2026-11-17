// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

describe("DX CLI Subcommand Dispatch Security (Command Injection Prevention)", () => {
  const root = path.resolve(process.cwd());
  const dxScript = path.join(root, "scripts/dx.ts");
  const canaryFile = path.join(
    "/tmp",
    `canary-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  );

  const cleanEnv = { ...process.env };
  delete cleanEnv.VITEST;

  afterEach(() => {
    if (fs.existsSync(canaryFile)) {
      try {
        fs.unlinkSync(canaryFile);
      } catch {
        // Ignore cleanup error
      }
    }
  });

  it("prevents command injection in crf subcommand when arguments contain shell metacharacters", () => {
    const maliciousArg = `; echo INJECTED > "${canaryFile}" ; #`;

    spawnSync("npx", ["tsx", dxScript, "crf", maliciousArg], {
      cwd: root,
      env: cleanEnv,
      stdio: "pipe",
    });

    expect(fs.existsSync(canaryFile)).toBe(false);
  });

  it("prevents command injection in sync-issues subcommand when arguments contain shell metacharacters", () => {
    const maliciousArg = `; echo INJECTED > "${canaryFile}" ; #`;

    spawnSync("npx", ["tsx", dxScript, "sync-issues", maliciousArg], {
      cwd: root,
      env: cleanEnv,
      stdio: "pipe",
    });

    expect(fs.existsSync(canaryFile)).toBe(false);
  });

  it("prevents command injection in issues:sync subcommand when arguments contain shell metacharacters", () => {
    const maliciousArg = `; echo INJECTED > "${canaryFile}" ; #`;

    spawnSync("npx", ["tsx", dxScript, "issues:sync", maliciousArg], {
      cwd: root,
      env: cleanEnv,
      stdio: "pipe",
    });

    expect(fs.existsSync(canaryFile)).toBe(false);
  });

  it("preserves discrete arguments containing spaces when forwarding to child processes", () => {
    const spacedFilename = "non existent file with spaces.json";
    const res = spawnSync(
      "npx",
      ["tsx", dxScript, "crf", "info", spacedFilename],
      {
        cwd: root,
        env: cleanEnv,
        encoding: "utf-8",
      }
    );

    expect(res.stdout + res.stderr).toContain(spacedFilename);
  });

  it("propagates child process exit code cleanly without uncaught exceptions", () => {
    const res = spawnSync(
      "npx",
      ["tsx", dxScript, "crf", "validate", "definitely_non_existent.json"],
      {
        cwd: root,
        env: cleanEnv,
        encoding: "utf-8",
      }
    );

    expect(res.status).toBe(1);
    expect(res.stderr).not.toContain("Fatal error in DX CLI");
  });
});
