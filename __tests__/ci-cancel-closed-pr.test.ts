import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowDir = path.join(process.cwd(), ".github/workflows");
const read = (file: string) =>
  fs.readFileSync(path.join(workflowDir, file), "utf8");

describe("cancel-closed-pr-ci workflow (#1389)", () => {
  const ci = read("ci.yml");
  const cancel = read("cancel-closed-pr-ci.yml");

  it("runs only when a pull request into main closes", () => {
    expect(cancel).toMatch(/pull_request:\s*\n\s*types: \[closed\]/);
    expect(cancel).toMatch(/branches: \["main"\]/);
    expect(cancel).not.toMatch(/^\s*push:/m);
  });

  it("joins the same concurrency group as the PR's CI Pipeline runs", () => {
    const workflowName = ci.match(/^name:\s*(.+)$/m)?.[1].trim();
    expect(workflowName).toBe("CI Pipeline");
    expect(ci).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}"
    );
    expect(cancel).toContain(
      `group: ci-${workflowName}-\${{ github.event.pull_request.number }}`
    );
    expect(cancel).toMatch(/cancel-in-progress: true/);
  });

  it("holds no permissions", () => {
    expect(cancel).toMatch(/^permissions: \{\}$/m);
  });
});
