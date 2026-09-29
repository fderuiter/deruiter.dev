import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const readHook = (name: string): string =>
  fs.readFileSync(path.join(workspaceRoot, ".husky", name), "utf8");

/**
 * A validator that exists but is invoked by nothing passes every unit test it
 * has. These assertions run the hooks themselves, so the wiring is what is
 * under test rather than the function behind it.
 */
describe("Husky hook wiring", () => {
  describe("branch naming (pre-push)", () => {
    let repo: string;

    beforeAll(() => {
      repo = fs.mkdtempSync(path.join(os.tmpdir(), "hook-branch-"));
      const git = (...args: string[]) =>
        spawnSync("git", args, { cwd: repo, encoding: "utf-8" });
      git("init", "-q");
      git("config", "user.email", "test@example.com");
      git("config", "user.name", "Test");
      git("config", "commit.gpgsign", "false");
      fs.writeFileSync(path.join(repo, "seed.txt"), "seed\n");
      git("add", "seed.txt");
      git("commit", "-qm", "chore: seed");
    });

    afterAll(() => {
      fs.rmSync(repo, { recursive: true, force: true });
    });

    /**
     * Runs the real pre-push hook against a scratch repository. The script path
     * resolves from the workspace, while git resolves the branch from GIT_DIR.
     */
    const runPrePush = (
      branch: string,
      options: { julesSession?: boolean } = {}
    ) => {
      spawnSync("git", ["checkout", "-q", "-B", branch], {
        cwd: repo,
        encoding: "utf-8",
      });

      const shimDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "hook-prepush-shim-")
      );
      fs.writeFileSync(path.join(shimDir, "npm"), "#!/bin/sh\nexit 0\n", {
        mode: 0o755,
      });

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `${shimDir}:${process.env.PATH ?? ""}`,
        GIT_DIR: path.join(repo, ".git"),
        GIT_WORK_TREE: repo,
      };
      delete env.GIT_INDEX_FILE;
      delete env.GIT_PREFIX;
      delete env.ALLOW_DANGEROUS_GIT;
      delete env.JULES_SESSION_ID;
      if (options.julesSession) env.JULES_SESSION_ID = "test-session";

      try {
        return spawnSync(
          "bash",
          [path.join(workspaceRoot, ".husky/pre-push")],
          {
            cwd: workspaceRoot,
            input: "",
            encoding: "utf-8",
            env,
          }
        );
      } finally {
        fs.rmSync(shimDir, { recursive: true, force: true });
      }
    };

    it("rejects a non-conforming branch and names the generator", () => {
      const result = runPrePush("nope");
      expect(result.status).toBe(1);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain("npm run dx branch");
    });

    it("rejects stitch/ prefixed branches like stitch/feat/example", () => {
      const result = runPrePush("stitch/feat/example");
      expect(result.status).toBe(1);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain("npm run dx branch");
    });

    it("rejects stitch/feat/example via direct CLI execution of validate-branch.ts", () => {
      const result = spawnSync(
        "npx",
        [
          "tsx",
          path.join(workspaceRoot, "scripts/validate-branch.ts"),
          "stitch/feat/example",
        ],
        {
          cwd: workspaceRoot,
          encoding: "utf-8",
          env: { ...process.env, ALLOW_DANGEROUS_GIT: "0" },
        }
      );
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "Git branch validation failed"
      );
    });

    it("still validates branch names inside Jules sessions", () => {
      const result = runPrePush("nope", { julesSession: true });
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain("npm run dx branch");
    });

    it("accepts a conforming branch", () => {
      expect(runPrePush("fix/a-real-branch").status).toBe(0);
    });

    it("leaves main passing", () => {
      expect(runPrePush("main").status).toBe(0);
    });

    it("honours the single documented override", () => {
      spawnSync("git", ["checkout", "-q", "-B", "nope"], { cwd: repo });
      const result = spawnSync(
        "bash",
        [path.join(workspaceRoot, ".husky/pre-push")],
        {
          cwd: workspaceRoot,
          input: "",
          encoding: "utf-8",
          env: {
            ...process.env,
            GIT_DIR: path.join(repo, ".git"),
            GIT_WORK_TREE: repo,
            ALLOW_DANGEROUS_GIT: "1",
          },
        }
      );
      expect(result.status).toBe(0);
    });

    it("validates the name before the protected-branch guard reads stdin", () => {
      const hook = readHook("pre-push");
      expect(hook.indexOf("validate-branch")).toBeGreaterThan(-1);
      expect(hook.indexOf("validate-branch")).toBeLessThan(
        hook.indexOf("refs/heads/main")
      );
    });

    it("keeps the force-push and direct-push guards intact", () => {
      const hook = readHook("pre-push");
      expect(hook).toContain("refs/heads/main");
      expect(hook).toContain("ALLOW_DANGEROUS_GIT");
    });

    it("includes whole-project typecheck and boundary enforcement", () => {
      const hook = readHook("pre-push");
      expect(hook).toContain("npm run typecheck");
      expect(hook).toContain("npm run lint:boundaries");
    });
  });

  describe("branch naming advisory (post-checkout)", () => {
    it("warns without blocking, because renaming is free at creation", () => {
      const hook = readHook("post-checkout");
      expect(hook).toContain("validate-branch.ts --warn");
      // git passes the branch flag as the third argument; a file checkout is
      // not a branch change and must stay silent.
      expect(hook).toContain('"${3:-0}" != "1"');
    });

    it("never fails a checkout", () => {
      const result = spawnSync(
        "bash",
        [path.join(workspaceRoot, ".husky/post-checkout"), "HEAD", "HEAD", "1"],
        { cwd: workspaceRoot, encoding: "utf-8" }
      );
      expect(result.status).toBe(0);
    });
  });

  describe("pre-commit ordering and guardrails", () => {
    const runPreCommitHook = (
      options: {
        npmExitCode?: number;
        npxExitCode?: number;
      } = {}
    ) => {
      const shimDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "hook-precommit-shim-")
      );
      fs.writeFileSync(
        path.join(shimDir, "npm"),
        `#!/bin/sh\nexit ${options.npmExitCode ?? 0}\n`,
        { mode: 0o755 }
      );
      fs.writeFileSync(
        path.join(shimDir, "npx"),
        `#!/bin/sh\nexit ${options.npxExitCode ?? 0}\n`,
        { mode: 0o755 }
      );

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: `${shimDir}:${process.env.PATH ?? ""}`,
      };

      try {
        return spawnSync(
          "bash",
          [path.join(workspaceRoot, ".husky/pre-commit")],
          {
            cwd: workspaceRoot,
            encoding: "utf-8",
            env,
          }
        );
      } finally {
        fs.rmSync(shimDir, { recursive: true, force: true });
      }
    };

    it("runs validate-commit first as the primary security guardrail", () => {
      const hook = readHook("pre-commit");
      expect(hook.indexOf("scripts/validate-commit.ts")).toBeGreaterThan(-1);
      expect(hook.indexOf("scripts/validate-commit.ts")).toBeLessThan(
        hook.indexOf("lint-staged")
      );
    });

    it("runs early fail-fast checks in order before test:staged and audit:security", () => {
      const hook = readHook("pre-commit");
      expect(hook.indexOf("typecheck")).toBeGreaterThan(-1);
      expect(hook.indexOf("lint:boundaries")).toBeGreaterThan(-1);
      expect(hook.indexOf("check-docs-drift")).toBeGreaterThan(-1);
      expect(hook.indexOf("test:staged")).toBeGreaterThan(-1);
      expect(hook.indexOf("audit:security")).toBeGreaterThan(-1);

      expect(hook.indexOf("lint-staged")).toBeLessThan(
        hook.indexOf("typecheck")
      );
      expect(hook.indexOf("typecheck")).toBeLessThan(
        hook.indexOf("lint:boundaries")
      );
      expect(hook.indexOf("lint:boundaries")).toBeLessThan(
        hook.indexOf("check-docs-drift")
      );
      expect(hook.indexOf("check-docs-drift")).toBeLessThan(
        hook.indexOf("test:staged")
      );
      expect(hook.indexOf("test:staged")).toBeLessThan(
        hook.indexOf("audit:security")
      );
    });

    it("propagates failure when npm quality or audit commands fail", () => {
      const result = runPreCommitHook({ npmExitCode: 1 });
      expect(result.status).toBe(1);
    });

    it("propagates failure when npx validator commands fail", () => {
      const result = runPreCommitHook({ npxExitCode: 1 });
      expect(result.status).toBe(1);
    });
  });

  describe("pre-commit secret scanner enforcement", () => {
    let repo: string;

    beforeAll(() => {
      repo = fs.mkdtempSync(path.join(os.tmpdir(), "hook-commit-"));
      const git = (...args: string[]) =>
        spawnSync("git", args, { cwd: repo, encoding: "utf-8" });
      git("init", "-q");
      git("config", "user.email", "test@example.com");
      git("config", "user.name", "Test");
      git("config", "commit.gpgsign", "false");
      fs.writeFileSync(path.join(repo, "seed.txt"), "seed\n");
      git("add", "seed.txt");
      git("commit", "-qm", "chore: seed");
    });

    afterAll(() => {
      fs.rmSync(repo, { recursive: true, force: true });
    });

    const runValidateCommit = (customEnv: Record<string, string> = {}) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_DIR: path.join(repo, ".git"),
        GIT_WORK_TREE: repo,
        ...customEnv,
      };
      delete env.GIT_INDEX_FILE;
      delete env.GIT_PREFIX;
      delete env.VITEST;
      return spawnSync(
        "npx",
        ["tsx", path.join(workspaceRoot, "scripts/validate-commit.ts")],
        {
          cwd: workspaceRoot,
          encoding: "utf-8",
          env,
        }
      );
    };

    it("blocks staged alternative lockfiles", () => {
      fs.writeFileSync(path.join(repo, "yarn.lock"), "lockfile content\n");
      spawnSync("git", ["add", "yarn.lock"], { cwd: repo });
      const result = runValidateCommit();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Alternative lockfile detected");
      spawnSync("git", ["rm", "-f", "yarn.lock"], { cwd: repo });
    });

    it("blocks staged files containing secret credentials", () => {
      fs.writeFileSync(
        path.join(repo, "config.ts"),
        'const dbUrl = "postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/portfolio_prod";\n'
      );
      spawnSync("git", ["add", "config.ts"], { cwd: repo });
      const result = runValidateCommit();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Sensitive information or credential pattern detected"
      );
      spawnSync("git", ["rm", "-f", "config.ts"], { cwd: repo });
    });

    it("blocks when credential is staged but worktree file has placeholder (partial staging)", () => {
      fs.writeFileSync(
        path.join(repo, "config.ts"),
        'const dbUrl = "postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/portfolio_prod";\n'
      );
      spawnSync("git", ["add", "config.ts"], { cwd: repo });
      fs.writeFileSync(
        path.join(repo, "config.ts"),
        'const dbUrl = "placeholder";\n'
      );
      const result = runValidateCommit();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Sensitive information or credential pattern detected"
      );
      spawnSync("git", ["rm", "-f", "config.ts"], { cwd: repo });
    });

    it("blocks when credential is staged but worktree file is deleted (missing worktree file)", () => {
      fs.writeFileSync(
        path.join(repo, "config.ts"),
        'const dbUrl = "postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/portfolio_prod";\n'
      );
      spawnSync("git", ["add", "config.ts"], { cwd: repo });
      fs.rmSync(path.join(repo, "config.ts"));
      const result = runValidateCommit();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Sensitive information or credential pattern detected"
      );
      spawnSync("git", ["rm", "-f", "config.ts"], { cwd: repo });
    });

    it("passes when clean content is staged even if worktree file has unstaged credentials", () => {
      fs.writeFileSync(
        path.join(repo, "config.ts"),
        'const dbUrl = "placeholder";\n'
      );
      spawnSync("git", ["add", "config.ts"], { cwd: repo });
      fs.writeFileSync(
        path.join(repo, "config.ts"),
        'const dbUrl = "postgresql://user:pass@ep-cool-pooler.us-east-2.aws.neon.tech/portfolio_prod";\n'
      );
      const result = runValidateCommit();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Pre-Commit validation passed");
      spawnSync("git", ["rm", "-f", "config.ts"], { cwd: repo });
    });

    it("fails closed if index enumeration or index read fails", () => {
      const result = runValidateCommit({
        GIT_DIR: path.join(repo, ".invalid_git_dir"),
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Failed to enumerate staged files");
    });
  });
});
