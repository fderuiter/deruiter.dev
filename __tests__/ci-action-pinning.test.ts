// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("GitHub Actions SHA Pinning & Dependabot Verification", () => {
  const workflowDir = path.join(process.cwd(), ".github/workflows");
  const dependabotPath = path.join(process.cwd(), ".github/dependabot.yml");

  const workflowFiles = fs
    .readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

  it("finds workflow files to inspect", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it.each(workflowFiles)(
    "%s pins all external actions to full 40-character commit SHAs with inline comments",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      const unpinnedActions: string[] = [];

      for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();
        if (line.startsWith("uses:")) {
          const usesValue = line.substring(5).trim();
          // Skip local actions (e.g., ./...)
          if (usesValue.startsWith("./")) continue;

          // Match format: action-name@40-char-sha # version-comment
          const shaMatch = usesValue.match(
            /^[\w\-./]+@([a-f0-9]{40})(?:\s+#\s*\S+)?$/i
          );
          if (!shaMatch) {
            unpinnedActions.push(usesValue);
          }
        }
      }

      expect(unpinnedActions).toEqual([]);
    }
  );

  it.each(workflowFiles)(
    "%s pins every container and service image by sha256 digest",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      const images = [...content.matchAll(/^\s+image:\s*(\S+)\s*$/gm)].map(
        (match) => match[1]
      );
      const unpinned = images.filter(
        (image) => !/^[\w.\-/]+:[\w.\-]+@sha256:[0-9a-f]{64}$/.test(image)
      );
      expect(unpinned).toEqual([]);
    }
  );

  // Only the two bot-PR workflows push branches via scripts/open-bot-pr.sh;
  // every other checkout across .github/workflows must disable persisted git
  // credentials so package scripts and subprocesses never read GITHUB_TOKEN
  // from .git/config.
  const GIT_PUSH_WORKFLOWS = new Set([
    "cdisc-library-sync.yml",
    "standards-watch.yml",
  ]);

  it.each(workflowFiles.filter((file) => !GIT_PUSH_WORKFLOWS.has(file)))(
    "%s sets persist-credentials: false on every actions/checkout step",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      const checkoutSteps = content
        .split(/\n\s+-\s+name:\s+/)
        .slice(1)
        .filter((step) => /uses:\s*actions\/checkout@/.test(step));
      for (const step of checkoutSteps) {
        expect(step).toMatch(/persist-credentials:\s*false/);
      }
    }
  );

  it("has dependabot.yml configured for github-actions with weekly schedule", () => {
    expect(fs.existsSync(dependabotPath)).toBe(true);
    const content = fs.readFileSync(dependabotPath, "utf8");
    expect(content).toContain('package-ecosystem: "github-actions"');
    expect(content).toContain('interval: "weekly"');
  });

  it("has dependabot.yml grouping npm patch and minor updates and ignoring majors (#2511)", () => {
    const content = fs.readFileSync(dependabotPath, "utf8");
    expect(content).toContain('package-ecosystem: "npm"');
    expect(content).toContain('"version-update:semver-major"');
    expect(content).toMatch(/npm-minor-and-patch:[\s\S]*"minor"[\s\S]*"patch"/);
  });

  it("groups npm security updates apart from version updates and lets releases age first", () => {
    const content = fs.readFileSync(dependabotPath, "utf8");
    expect(content).toMatch(/npm-security:\n\s+applies-to: security-updates/);
    expect(content).toMatch(
      /playwright:\n\s+patterns:\n\s+- "@playwright\/test"/
    );
    expect(content).toMatch(
      /cooldown:\n\s+default-days: 7\n\s+semver-patch-days: 3/
    );
  });

  it("skips only markdownlint-cli 0.50.0, whose re2js and argparse fail the audits (SECURITY.md)", () => {
    const content = fs.readFileSync(dependabotPath, "utf8");
    expect(content).toMatch(
      /- dependency-name: "markdownlint-cli"\n\s+versions: \["0\.50\.0"\]/
    );
  });
});

describe("GitHub Actions Least-Privilege & Expression Hardening", () => {
  const workflowDir = path.join(process.cwd(), ".github/workflows");
  const readWorkflow = (file: string) =>
    fs.readFileSync(path.join(workflowDir, file), "utf8");

  it.each([
    "ci.yml",
    "study-data-core.yml",
    "synthetic-probes.yml",
    "scheduled-security-audit.yml",
  ])(
    "%s sets persist-credentials: false on every actions/checkout step",
    (file) => {
      const content = readWorkflow(file);
      const steps = content.split(/\n\s+-\s+name:\s+/).slice(1);
      const checkouts = steps.filter((step) =>
        step.includes("uses: actions/checkout@")
      );
      expect(checkouts.length).toBeGreaterThan(0);
      for (const step of checkouts) {
        expect(step).toContain("persist-credentials: false");
      }
    }
  );

  it("synthetic-probes.yml configures concurrency, validates target_url, and avoids ${{ }} inside run blocks", () => {
    const content = readWorkflow("synthetic-probes.yml");
    expect(content).toContain(
      "group: synthetic-probes-${{ github.event_name }}-${{ github.ref }}"
    );
    expect(content).toContain(
      "cancel-in-progress: ${{ github.event_name != 'workflow_call' }}"
    );
    expect(content).toContain("PROBE_TARGET: ${{ steps.target.outputs.url }}");

    const lines = content.split("\n");
    let inRun = false;
    let runIndent = 0;
    const interpolatedLines: string[] = [];
    lines.forEach((line, index) => {
      const runMatch = line.match(/^(\s*(?:-\s+)?)run:\s*(.*)$/);
      if (runMatch) {
        const rest = runMatch[2];
        if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
          inRun = true;
          runIndent = line.indexOf("run:");
        } else {
          inRun = false;
          if (rest.includes("${{")) {
            interpolatedLines.push(`${index + 1}: ${line.trim()}`);
          }
        }
        return;
      }
      if (inRun) {
        if (line.trim() === "") return;
        const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
        if (indent <= runIndent) {
          inRun = false;
        } else if (line.includes("${{")) {
          interpolatedLines.push(`${index + 1}: ${line.trim()}`);
        }
      }
    });
    expect(interpolatedLines).toEqual([]);
  });

  it("scheduled-security-audit.yml configures concurrency and scopes issues: write to the job", () => {
    const content = readWorkflow("scheduled-security-audit.yml");
    expect(content).toContain(
      "group: scheduled-security-audit-${{ github.ref }}"
    );
    expect(content).toContain("cancel-in-progress: true");
    const header = content.slice(0, content.indexOf("\njobs:\n"));
    expect(header).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(header).not.toContain("issues: write");
    const job = content.slice(content.indexOf("\njobs:\n"));
    expect(job).toMatch(
      /^ {4}permissions:\n {6}contents: read\n {6}issues: write$/m
    );
  });
});
