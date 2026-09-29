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

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_DIR: path.join(repo, ".git"),
        GIT_WORK_TREE: repo,
      };
      delete env.ALLOW_DANGEROUS_GIT;
      delete env.JULES_SESSION_ID;
      if (options.julesSession) env.JULES_SESSION_ID = "test-session";

      return spawnSync("bash", [path.join(workspaceRoot, ".husky/pre-push")], {
        cwd: workspaceRoot,
        input: "",
        encoding: "utf-8",
        env,
      });
    };

    it("rejects a non-conforming branch and names the generator", () => {
      const result = runPrePush("nope");
      expect(result.status).toBe(1);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain("npm run dx branch");
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

  describe("pre-commit ordering", () => {
    it("fails fast on drift before the slower staged suite and audit", () => {
      // Drift is the most frequent and cheapest-to-detect failure here, and
      // paying typecheck plus the staged suite before discovering it is what
      // made every public-export change cost two full pre-commit cycles.
      const hook = readHook("pre-commit");
      expect(hook.indexOf("check-docs-drift")).toBeGreaterThan(-1);
      expect(hook.indexOf("check-docs-drift")).toBeLessThan(
        hook.indexOf("test:staged")
      );
      expect(hook.indexOf("check-docs-drift")).toBeLessThan(
        hook.indexOf("audit:security")
      );
    });

    it("keeps lint:boundaries ahead of the test suite", () => {
      const hook = readHook("pre-commit");
      expect(hook.indexOf("lint:boundaries")).toBeLessThan(
        hook.indexOf("test:staged")
      );
    });
  });
});
