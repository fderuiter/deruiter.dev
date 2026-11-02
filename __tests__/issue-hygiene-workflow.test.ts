// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Issue Hygiene (#3591): an open work item with no acceptance section gets
 * `needs-info` and one comment. Structural issues are skipped: the
 * governance doc gives epics, initiatives and portfolios an objective and a
 * checklist and no triage state, so labelling them `needs-info` would be
 * wrong. The 2026-11-02 dry run would have flagged six of them.
 */
const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/issue-hygiene.yml"),
  "utf8"
);
const script = workflow.slice(
  workflow.indexOf("- name: Check the issue and act if allowed")
);

describe("issue-hygiene.yml", () => {
  it("reads the labels with the body, from gh rather than the event text", () => {
    expect(script).toContain("--json body,state,comments,labels");
    expect(script).not.toMatch(/\$\{\{\s*github\.event\.issue\.(body|title)/);
  });

  it("skips every structural issue type before checking for acceptance", () => {
    for (const label of ["type:epic", "type:initiative", "type:portfolio"]) {
      expect(script).toContain(`. == "${label}"`);
    }
    expect(script.indexOf("is a structural issue")).toBeGreaterThan(-1);
    expect(script.indexOf("is a structural issue")).toBeLessThan(
      script.indexOf("grep -qi 'acceptance'")
    );
  });

  it("only applies a change when ISSUE_HYGIENE_APPLY is exactly true", () => {
    expect(workflow).toContain("APPLY: ${{ vars.ISSUE_HYGIENE_APPLY }}");
    expect(script.indexOf('if [ "$APPLY" != "true" ]; then')).toBeLessThan(
      script.indexOf("--add-label needs-info")
    );
  });

  it("grants issues: write to the job only", () => {
    expect(workflow).toContain("permissions: {}");
    expect(workflow).toMatch(/permissions:\n\s+issues: write/);
  });
});
