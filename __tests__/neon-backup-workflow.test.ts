// @vitest-environment node
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// #3036: the weekly Neon backup is encrypted before it leaves the runner,
// because artifacts of a public repository are downloadable by any signed-in
// GitHub user.
describe("Neon backup workflow", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github", "workflows", "neon-backup.yml"),
    "utf8"
  );

  it("runs weekly, before the Monday 01:00 UTC release train", () => {
    expect(workflow).toMatch(/- cron: "0 23 \* \* 0"/);
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/timeout-minutes: \d+/);
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
  });

  it("uploads only ciphertext and destroys the plaintext dump", () => {
    const encrypt = workflow.indexOf("age --encrypt");
    const shred = workflow.indexOf('shred -u "$plain"');
    const upload = workflow.indexOf("actions/upload-artifact@");
    expect(encrypt).toBeGreaterThan(-1);
    expect(shred).toBeGreaterThan(encrypt);
    expect(upload).toBeGreaterThan(shred);
    expect(workflow).toMatch(/path: backup\/\n/);
    expect(workflow).toContain('--output "backup/neon-$stamp.dump.age"');
    // The plaintext is written outside the uploaded directory.
    expect(workflow).toContain('plain="$RUNNER_TEMP/neon-$stamp.dump"');
  });

  it("refuses a dump that pg_restore cannot list", () => {
    expect(workflow).toContain("pg_restore --list");
    expect(workflow).toContain("The dump lists no table data.");
  });

  it("holds only the read-only backup credential", () => {
    const secrets = [...workflow.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]);
    expect(new Set(secrets)).toEqual(new Set(["NEON_BACKUP_DATABASE_URL"]));
    expect(workflow).toContain("permissions:\n  contents: read");
  });
});
