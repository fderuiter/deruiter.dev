// @vitest-environment node
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const guardrailScript = path.join(workspaceRoot, "scripts", "git-guardrail.sh");

function runGuardrail(
  commandOrJson: string,
  env: Record<string, string> = {},
  useStdin = true
): { exitCode: number | null; stdout: string; stderr: string } {
  if (useStdin) {
    const result = spawnSync("bash", [guardrailScript], {
      input: commandOrJson,
      encoding: "utf-8",
      env: { ...process.env, ALLOW_DANGEROUS_GIT: "0", CI: "", ...env },
    });
    return {
      exitCode: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  }

  const result = spawnSync(
    "bash",
    [guardrailScript, ...commandOrJson.split(" ")],
    {
      encoding: "utf-8",
      env: { ...process.env, ALLOW_DANGEROUS_GIT: "0", CI: "", ...env },
    }
  );
  return {
    exitCode: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

describe("Git Safety Guardrail Interceptor (scripts/git-guardrail.sh)", () => {
  describe("Dangerous Commands Interception (Exit Code 2)", () => {
    const dangerousCommands = [
      "git push --force",
      "git push --force-with-lease",
      "git push --force-with-lease=dev origin dev",
      "git push origin dev --force-with-lease",
      "git push origin --force",
      "git push origin feat/test --force",
      "git push -f",
      "git push origin -f",
      "git push origin main",
      "git push main",
      "git reset --hard",
      "git reset --hard HEAD~1",
      "git clean -f",
      "git clean -fd",
      "git clean -f -d",
      "git branch -D feature-branch",
      "git checkout .",
      "git checkout -- .",
      "git restore .",
      "git restore --staged .",
    ];

    dangerousCommands.forEach((cmd) => {
      it(`blocks dangerous raw command: '${cmd}'`, () => {
        const result = runGuardrail(cmd);
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain(
          "BLOCKED: Destructive git operation intercepted"
        );
      });

      it(`blocks dangerous agent tool JSON payload: '${cmd}'`, () => {
        const jsonPayload = JSON.stringify({
          tool_input: {
            command: cmd,
          },
        });
        const result = runGuardrail(jsonPayload);
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain(
          "BLOCKED: Destructive git operation intercepted"
        );
      });

      it(`blocks dangerous command passed as CLI arguments: '${cmd}'`, () => {
        const result = runGuardrail(cmd, {}, false);
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain(
          "BLOCKED: Destructive git operation intercepted"
        );
      });
    });
  });

  describe("Safe Commands Pass-Through (Exit Code 0)", () => {
    const safeCommands = [
      "git status",
      "git log -n 5",
      "git diff HEAD~1",
      "git add .",
      "git add src/index.ts",
      "git commit -m 'feat(dx): add git guardrail hook'",
      "git push origin feat/git-guardrails",
      "git push origin dev",
      "git checkout -b feat/experiment",
      "git branch -d feat/merged-branch",
      "git restore src/specific-file.ts",
    ];

    safeCommands.forEach((cmd) => {
      it(`allows safe raw command: '${cmd}'`, () => {
        const result = runGuardrail(cmd);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
      });

      it(`allows safe agent tool JSON payload: '${cmd}'`, () => {
        const jsonPayload = JSON.stringify({
          tool_input: {
            command: cmd,
          },
        });
        const result = runGuardrail(jsonPayload);
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
      });
    });
  });

  describe("Surgical single-file restores are not the bulk discard", () => {
    // The bulk form discards every local change. Restoring one named file is the
    // opposite operation, and blocking it trains the reflex to set the bypass.
    const surgicalCommands = [
      "git checkout -- .gitignore",
      "git checkout -- .husky/pre-commit",
      "git checkout -- .env.example",
      "git restore .husky/pre-push",
      "git restore -- .gitignore",
      "git restore --staged .gitignore",
    ];

    surgicalCommands.forEach((cmd) => {
      it(`allows surgical restore: '${cmd}'`, () => {
        const result = runGuardrail(cmd);
        expect(result.exitCode).toBe(0);
      });
    });

    it("still blocks the bulk discard forms it is meant to catch", () => {
      for (const cmd of ["git checkout -- .", "git restore --staged ."]) {
        expect(runGuardrail(cmd).exitCode).toBe(2);
      }
    });
  });

  describe("Command text versus command effect", () => {
    // A guard that cannot be inspected or tested without the bypass is a guard
    // operators learn to bypass reflexively.
    const inspectionCommands = [
      'grep -n "git reset --hard" scripts/git-guardrail.sh',
      "echo 'git push --force is blocked here'",
      'rg --files-with-matches "git clean -fd"',
      "cat scripts/git-guardrail.sh",
    ];

    inspectionCommands.forEach((cmd) => {
      it(`allows inspection that only mentions a pattern: '${cmd}'`, () => {
        const result = runGuardrail(cmd);
        expect(result.exitCode).toBe(0);
      });
    });

    it("allows backticked examples in messages and documentation", () => {
      // Commit messages and markdown quote commands constantly; this guard
      // rejected its own commit message before backticks were treated as
      // quoting.
      const result = runGuardrail(
        'echo "see `git reset --hard` in the release notes"'
      );
      expect(result.exitCode).toBe(0);
    });

    it("still blocks a dangerous command chained after another program", () => {
      // Leading-token matching alone would miss this; segments are resolved
      // individually so `cd` cannot be used to smuggle the operation through.
      expect(runGuardrail("cd /tmp && git reset --hard").exitCode).toBe(2);
      expect(runGuardrail("npm run build; git push --force").exitCode).toBe(2);
    });
  });

  describe("Consequential deploy operations", () => {
    const blockedDeploys: Array<[string, string]> = [
      ["npx vercel deploy --prebuilt", "fallback content"],
      ["vercel deploy --prod --prebuilt", "fallback content"],
      ["npx vercel deploy --prod", "Dashboard-only"],
      ["vercel --prod", "Dashboard-only"],
      ["npx vercel promote dpl_example", "Dashboard-only"],
      ["vercel env rm DATABASE_URL production", "hard to undo"],
      ["vercel domains rm deruiter.dev", "detaches production traffic"],
      ["npx prisma migrate deploy", "disposable branch"],
    ];

    blockedDeploys.forEach(([cmd, reasonFragment]) => {
      it(`blocks '${cmd}' and explains why`, () => {
        const result = runGuardrail(cmd, { CI: "" });
        expect(result.exitCode).toBe(2);
        expect(result.stderr).toContain(
          "Consequential deploy operation intercepted"
        );
        expect(result.stderr).toContain(reasonFragment);
      });
    });

    it("names the manual Dashboard release path as the alternative to --prebuilt", () => {
      const result = runGuardrail("npx vercel deploy --prebuilt", { CI: "" });
      expect(result.stderr).toContain("Create Deployment");
    });

    it("blocks CLI Production deployment even when CI is set", () => {
      const result = runGuardrail("npx vercel deploy --prod", {
        CI: "true",
      });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Dashboard-only");
    });

    it("allows an ordinary remote Preview build in CI", () => {
      const result = runGuardrail("npx vercel deploy", { CI: "true" });
      expect(result.exitCode).toBe(0);
    });

    it("allows ordinary vercel and prisma subcommands", () => {
      for (const cmd of [
        "vercel env pull",
        "vercel ls",
        "npx prisma generate",
        "npx prisma migrate dev",
      ]) {
        expect(runGuardrail(cmd, { CI: "" }).exitCode).toBe(0);
      }
    });

    it("honours the single documented override for deploys too", () => {
      const result = runGuardrail("npx vercel deploy --prebuilt", {
        CI: "",
        ALLOW_DANGEROUS_GIT: "1",
      });
      expect(result.exitCode).toBe(0);
    });
  });

  describe("Intentional Override Bypass (ALLOW_DANGEROUS_GIT=1)", () => {
    it("permits git push --force when ALLOW_DANGEROUS_GIT=1 is set", () => {
      const result = runGuardrail("git push --force", {
        ALLOW_DANGEROUS_GIT: "1",
      });
      expect(result.exitCode).toBe(0);
    });

    it("permits git reset --hard when ALLOW_DANGEROUS_GIT=1 is set", () => {
      const result = runGuardrail("git reset --hard", {
        ALLOW_DANGEROUS_GIT: "1",
      });
      expect(result.exitCode).toBe(0);
    });
  });
});
