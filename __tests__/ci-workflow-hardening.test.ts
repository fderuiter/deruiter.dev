// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowDir = path.join(process.cwd(), ".github/workflows");
const workflowFiles = fs
  .readdirSync(workflowDir)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

const readWorkflow = (file: string): string =>
  fs.readFileSync(path.join(workflowDir, file), "utf8");

/**
 * Extracts `run:` blocks (inline or block scalars) from a workflow file so
 * security invariants can inspect shell bodies without depending on a third-party
 * YAML parser.
 */
function extractRunBlocks(content: string): string[] {
  const blocks: string[] = [];
  let current: string[] | null = null;
  let blockIndent = 0;
  let inSteps = false;
  let stepsIndent = 0;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();

    if (current !== null) {
      if (trimmed === "") {
        current.push("");
        continue;
      }
      const indent = line.length - line.trimStart().length;
      if (indent > blockIndent) {
        current.push(line);
        continue;
      }
      blocks.push(current.join("\n"));
      current = null;
    }

    if (trimmed === "") continue;
    const indent = line.length - line.trimStart().length;

    if (inSteps && indent <= stepsIndent && !trimmed.startsWith("#")) {
      inSteps = false;
    }
    if (/^steps:\s*$/.test(trimmed)) {
      inSteps = true;
      stepsIndent = indent;
      continue;
    }
    if (!inSteps) continue;

    if (/^(?:-\s+)?run:\s*[|>][-+]?$/.test(trimmed)) {
      current = [];
      blockIndent = indent;
    } else if (/^(?:-\s+)?run:\s*\S/.test(trimmed)) {
      blocks.push(trimmed.replace(/^(?:-\s+)?run:\s*/, ""));
    }
  }

  if (current !== null) {
    blocks.push(current.join("\n"));
  }
  return blocks;
}

describe("GitHub Actions Workflow Security & Determinism Hardening", () => {
  it.each(workflowFiles)(
    "%s declares explicit top-level permissions and concurrency controls",
    (file) => {
      const content = readWorkflow(file);
      expect(content).toMatch(/^permissions:/m);
      expect(content).toMatch(/^\s*concurrency:\s*\n\s+group:\s*\S+/m);
    }
  );

  // Only workflows that push bot PR branches via scripts/open-bot-pr.sh keep
  // actions/checkout's persisted git credentials. Every other checkout must
  // opt out so GITHUB_TOKEN is never left in .git/config during npm/test runs.
  const BOT_PUSH_WORKFLOWS = new Set([
    "cdisc-library-sync.yml",
    "standards-watch.yml",
  ]);

  it.each(workflowFiles.filter((file) => !BOT_PUSH_WORKFLOWS.has(file)))(
    "%s disables persisted git credentials on every actions/checkout step",
    (file) => {
      const content = readWorkflow(file);
      const steps = content.split(/\n\s+-\s+name:\s+/).slice(1);
      const checkoutSteps = steps.filter((step) =>
        /uses:\s*actions\/checkout@/.test(step)
      );

      for (const step of checkoutSteps) {
        const stepName = step.split("\n")[0]?.trim() ?? file;
        expect(step, `${file} -> ${stepName}`).toMatch(
          /persist-credentials:\s*false\b/
        );
      }
    }
  );

  it.each(workflowFiles)(
    "%s pins cache-dependency-path to package-lock.json whenever setup-node enables npm caching",
    (file) => {
      const content = readWorkflow(file);
      const steps = content.split(/\n\s+-\s+name:\s+/).slice(1);
      const npmCacheSteps = steps.filter(
        (step) =>
          /uses:\s*actions\/setup-node@/.test(step) &&
          /cache:\s*"?npm"?/.test(step)
      );

      for (const step of npmCacheSteps) {
        const stepName = step.split("\n")[0]?.trim() ?? file;
        expect(step, `${file} -> ${stepName}`).toContain(
          'cache-dependency-path: "package-lock.json"'
        );
      }
    }
  );

  it("keeps ci.yml caches restore-only on pull requests and save-only on main pushes", () => {
    const ci = readWorkflow("ci.yml");
    expect(ci).not.toMatch(/uses:\s*actions\/cache@[0-9a-f]{40}/);

    const saveSteps = ci
      .split(/\n\s+-\s+name:\s+/)
      .slice(1)
      .filter((step) => /uses:\s*actions\/cache\/save@/.test(step));
    expect(saveSteps.length).toBeGreaterThanOrEqual(3);
    for (const step of saveSteps) {
      const stepName = step.split("\n")[0]?.trim() ?? "save step";
      expect(step, stepName).toMatch(/refs\/heads\/main|steps\.nextjs-cache/);
    }
  });

  it("scopes elevated issue-triage permissions strictly to the job in scheduled-security-audit.yml and overrides-audit.yml", () => {
    for (const file of [
      "scheduled-security-audit.yml",
      "overrides-audit.yml",
    ]) {
      const content = readWorkflow(file);
      const header = content.slice(0, content.indexOf("\njobs:\n"));
      expect(header, file).toMatch(
        /^permissions:(?:\s*\{\}|\n\s{2}contents:\s*read)$/m
      );
      expect(header, file).not.toContain("issues: write");
      expect(content, file).toMatch(
        /^\s{4}permissions:\n\s{6}contents:\s*read\n\s{6}issues:\s*write$/m
      );
    }
  });

  it("isolates workflow_call runs in synthetic-probes.yml concurrency and validates target_url via env", () => {
    const probes = readWorkflow("synthetic-probes.yml");
    expect(probes).toContain(
      "group: synthetic-probes-${{ github.event_name }}-${{ github.ref }}"
    );
    expect(probes).toContain(
      "cancel-in-progress: ${{ github.event_name != 'workflow_call' }}"
    );
    expect(probes).toContain("PROBE_TARGET: ${{ steps.target.outputs.url }}");
    expect(probes).toContain("PROBES_OUTCOME: ${{ steps.probes.outcome }}");

    for (const runBlock of extractRunBlocks(probes)) {
      expect(runBlock).not.toContain("${{");
    }
  });

  it.each(workflowFiles)(
    "%s never interpolates untrusted inputs, step outputs, or event fields directly into run: scripts",
    (file) => {
      const content = readWorkflow(file);
      for (const runBlock of extractRunBlocks(content)) {
        expect(runBlock, file).not.toMatch(
          /\$\{\{\s*(?:inputs\.|steps\.|github\.event\.|github\.head_ref\b|github\.ref_name\b)/
        );
      }
    }
  );
});
