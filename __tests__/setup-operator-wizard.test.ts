// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const wizard = path.resolve("scripts/setup-operator-wizard.sh");
const scriptAvailable =
  spawnSync("script", ["--version"], { stdio: "ignore" }).status === 0;

describe.skipIf(!scriptAvailable)("read-only operator wizard", () => {
  for (const mode of ["backup", "release"]) {
    for (const location of ["checkout", "fork"]) {
      it(`binds ${mode} checks to the production repository from ${location}`, () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "operator-wizard-"));
        const bin = path.join(root, "bin");
        fs.mkdirSync(bin);
        const log = path.join(root, "calls");
        fs.writeFileSync(
          path.join(bin, "gh"),
          `#!/bin/sh
printf '%s\\n' "$*" >> "$CALLS"
case "$1 $2" in
  'repo view') echo fderuiter/deruiter.dev ;;
  'issue list') echo 1 ;;
  'secret list'|'variable list') exit 1 ;;
  *) exit 99 ;;
esac
`,
          { mode: 0o755 }
        );
        fs.writeFileSync(path.join(bin, "xdg-open"), "#!/bin/sh\nexit 0\n", {
          mode: 0o755,
        });
        const env = { ...process.env };
        for (const key of execFileSync(
          "git",
          ["rev-parse", "--local-env-vars"],
          { encoding: "utf8" }
        )
          .trim()
          .split("\n"))
          delete env[key];
        try {
          const fork = path.join(root, "fork");
          fs.mkdirSync(fork);
          execFileSync("git", ["init", "-q"], { cwd: fork, env });
          execFileSync(
            "git",
            ["remote", "add", "origin", "https://github.com/example/fork.git"],
            { cwd: fork, env }
          );
          const result = execFileSync(
            "script",
            ["-q", "-e", "-c", `bash '${wizard}' ${mode}`, "/dev/null"],
            {
              cwd:
                location === "checkout"
                  ? path.dirname(path.dirname(wizard))
                  : fork,
              input: "\n\n\n\n",
              encoding: "utf8",
              env: {
                ...env,
                PATH: `${bin}:${env.PATH ?? ""}`,
                CALLS: log,
                TERM: "dumb",
              },
            }
          );
          const calls = fs.readFileSync(log, "utf8").trim().split("\n");
          expect(calls.length).toBeGreaterThan(2);
          for (const call of calls)
            expect(call).toContain("fderuiter/deruiter.dev");
          expect(result).toContain("status unknown");
          if (mode === "release")
            expect(result).toContain("Open release holds: 1");
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});
