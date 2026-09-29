import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const prePushHook = path.join(workspaceRoot, ".husky", "pre-push");

function runPrePush(
  branch: string,
  refs: string,
  options: {
    julesSession?: boolean;
    npxExitCode?: number;
    mergeBaseExitCode?: number;
  } = {}
) {
  const commandDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "pre-push-hook-")
  );
  const npxLog = path.join(commandDirectory, "npx.log");
  const gitShim = path.join(commandDirectory, "git");
  const npxShim = path.join(commandDirectory, "npx");

  fs.writeFileSync(
    gitShim,
    '#!/bin/sh\nif [ "$1" = "merge-base" ]; then exit "${PRE_PUSH_MERGE_BASE_EXIT_CODE:-0}"; fi\nexit 0\n',
    { mode: 0o755 }
  );
  fs.writeFileSync(
    npxShim,
    '#!/bin/sh\nprintf "called\\n" >> "$PRE_PUSH_NPX_LOG"\nexit "${PRE_PUSH_NPX_EXIT_CODE:-0}"\n',
    { mode: 0o755 }
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${commandDirectory}:${process.env.PATH ?? ""}`,
    PRE_PUSH_TEST_BRANCH: branch,
    PRE_PUSH_NPX_LOG: npxLog,
    PRE_PUSH_NPX_EXIT_CODE: String(options.npxExitCode ?? 0),
    PRE_PUSH_MERGE_BASE_EXIT_CODE: String(options.mergeBaseExitCode ?? 0),
  };
  delete env.ALLOW_DANGEROUS_GIT;
  if (options.julesSession) env.JULES_SESSION_ID = "test-session";
  else delete env.JULES_SESSION_ID;

  try {
    const result = spawnSync("bash", [prePushHook], {
      cwd: workspaceRoot,
      encoding: "utf-8",
      env,
      input: refs,
    });

    return {
      ...result,
      npxWasCalled: fs.existsSync(npxLog),
    };
  } finally {
    fs.rmSync(commandDirectory, { recursive: true, force: true });
  }
}

describe("pre-push branch protection", () => {
  it("blocks a direct push to main during a Jules session", () => {
    const result = runPrePush(
      "dev",
      "refs/heads/jules/agent-work 0123456789abcdef0123456789abcdef01234567 refs/heads/main 0000000000000000000000000000000000000000\n",
      { julesSession: true }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "BLOCKED: Direct push to 'main' branch is prohibited."
    );
  });

  it("runs branch-name validation on Jules workspace branches", () => {
    const result = runPrePush(
      "jules/agent-work",
      "refs/heads/jules/agent-work 0123456789abcdef0123456789abcdef01234567 refs/heads/dev 0000000000000000000000000000000000000000\n",
      { npxExitCode: 1 }
    );

    expect(result.status).toBe(1);
    expect(result.npxWasCalled).toBe(true);
  });

  it("blocks non-fast-forward updates to dev", () => {
    const result = runPrePush(
      "dev",
      "refs/heads/dev 2222222222222222222222222222222222222222 refs/heads/dev 1111111111111111111111111111111111111111\n",
      { mergeBaseExitCode: 1 }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "BLOCKED: Non-fast-forward update to 'refs/heads/dev' is prohibited."
    );
  });

  it("allows fast-forward updates to dev", () => {
    const result = runPrePush(
      "dev",
      "refs/heads/dev 2222222222222222222222222222222222222222 refs/heads/dev 1111111111111111111111111111111111111111\n"
    );

    expect(result.status).toBe(0);
  });

  it("blocks deletion of remote branches", () => {
    const result = runPrePush(
      "dev",
      "refs/heads/dev 0000000000000000000000000000000000000000 refs/heads/dev 1111111111111111111111111111111111111111\n"
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "BLOCKED: Deleting remote branch 'refs/heads/dev' is prohibited."
    );
  });
});
