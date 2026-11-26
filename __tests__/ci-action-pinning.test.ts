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

  it.each(workflowFiles)(
    "%s declares explicit token permissions and concurrency controls",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      expect(content).toMatch(/^permissions:/m);
      expect(content).toMatch(/^\s*concurrency:/m);
    }
  );

  // Only standards-watch.yml and cdisc-library-sync.yml push branches through
  // scripts/open-bot-pr.sh (`git push origin "$branch"`); every other workflow
  // must disable credential persistence in .git/config on checkout.
  const gitPushWorkflows = new Set([
    "cdisc-library-sync.yml",
    "standards-watch.yml",
  ]);

  it.each(workflowFiles.filter((file) => !gitPushWorkflows.has(file)))(
    "%s disables credential persistence on every actions/checkout step",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      const checkouts = content
        .split(/\n\s+-\s+name:\s+/)
        .slice(1)
        .filter((step) => /uses:\s*actions\/checkout@/.test(step));
      for (const step of checkouts) {
        expect(step).toMatch(/persist-credentials:\s*false/);
      }
    }
  );

  it.each(workflowFiles)(
    "%s keys every npm setup-node cache explicitly to package-lock.json",
    (file) => {
      const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
      const cachedNodeSteps = content
        .split(/\n\s+-\s+name:\s+/)
        .slice(1)
        .filter(
          (step) =>
            /uses:\s*actions\/setup-node@/.test(step) &&
            /cache:\s*"npm"/.test(step)
        );
      for (const step of cachedNodeSteps) {
        expect(step).toContain('cache-dependency-path: "package-lock.json"');
      }
    }
  );

  it("never interpolates untrusted dispatch inputs or probe URLs directly inside synthetic-probes.yml shell scripts", () => {
    const content = fs.readFileSync(
      path.join(workflowDir, "synthetic-probes.yml"),
      "utf8"
    );
    const steps = content.split(/\n\s+-\s+name:\s+/).slice(1);
    for (const step of steps) {
      const runMatch = step.match(/\n\s+run:\s*(?:\|\n([\s\S]*)|([^\n]+))/);
      const runBody = runMatch?.[1] ?? runMatch?.[2] ?? "";
      expect(runBody).not.toMatch(/\$\{\{\s*(?:inputs|steps\.target\.outputs)/);
    }
  });

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
