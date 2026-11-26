// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import yaml from "yaml";

interface WorkflowStep {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
  run?: string;
}

interface WorkflowJob {
  permissions?: Record<string, string>;
  steps?: WorkflowStep[];
}

interface WorkflowDocument {
  permissions?: Record<string, string>;
  concurrency?: Record<string, unknown>;
  jobs?: Record<string, WorkflowJob>;
}

describe("GitHub Actions SHA Pinning & Dependabot Verification", () => {
  const workflowDir = path.join(process.cwd(), ".github/workflows");
  const dependabotPath = path.join(process.cwd(), ".github/dependabot.yml");

  const workflowFiles = fs
    .readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));

  const parseWorkflow = (file: string): WorkflowDocument => {
    const content = fs.readFileSync(path.join(workflowDir, file), "utf8");
    return yaml
      .parseDocument(content, {
        strict: true,
        uniqueKeys: true,
      })
      .toJS() as WorkflowDocument;
  };

  it("finds workflow files to inspect", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  it.each(workflowFiles)(
    "%s parses cleanly under strict YAML rules with unique keys",
    (file) => {
      const doc = parseWorkflow(file);
      expect(doc.jobs).toBeDefined();
    }
  );

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

  it.each(workflowFiles)(
    "%s disables credential persistence on every actions/checkout step",
    (file) => {
      const doc = parseWorkflow(file);
      for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          if (step.uses?.startsWith("actions/checkout@")) {
            expect(
              step.with?.["persist-credentials"],
              `${file} -> ${jobId} -> ${step.name ?? "checkout"}`
            ).toBe(false);
          }
        }
      }
    }
  );

  it.each(workflowFiles)(
    "%s keys every npm setup-node cache explicitly to package-lock.json",
    (file) => {
      const doc = parseWorkflow(file);
      for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          if (
            step.uses?.startsWith("actions/setup-node@") &&
            step.with?.cache === "npm"
          ) {
            expect(
              step.with?.["cache-dependency-path"],
              `${file} -> ${jobId} -> ${step.name ?? "setup-node"}`
            ).toBe("package-lock.json");
          }
        }
      }
    }
  );

  it.each(workflowFiles)(
    "%s never interpolates untrusted inputs, event payloads, or dynamic outputs directly inside run: shell scripts",
    (file) => {
      const doc = parseWorkflow(file);
      const unsafeExpressions: string[] = [];

      for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
        for (const step of job.steps ?? []) {
          if (!step.run) continue;
          for (const match of step.run.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) {
            const expr = match[1].trim();
            // Only static integer matrix.shard and fixed-enum needs.<job>.result
            // are allowed inside run: blocks; all inputs, event fields, refs,
            // SHAs, step/job outputs, vars, and secrets must pass via env:.
            const isSafeStaticExpr =
              expr === "matrix.shard" ||
              /^needs\.[a-z0-9-]+\.result$/.test(expr);
            if (!isSafeStaticExpr) {
              unsafeExpressions.push(
                `${jobId} -> ${step.name ?? "run"}: \${{ ${expr} }}`
              );
            }
          }
        }
      }

      expect(unsafeExpressions).toEqual([]);
    }
  );

  it("scopes every weekly-train.yml job to explicit least-privilege permissions", () => {
    const doc = parseWorkflow("weekly-train.yml");
    expect(doc.jobs?.gate?.permissions).toEqual({
      contents: "read",
      checks: "read",
      issues: "write",
    });
    expect(doc.jobs?.["rc-build"]?.permissions).toEqual({ contents: "read" });
    expect(doc.jobs?.["rc-browser"]?.permissions).toEqual({ contents: "read" });
    expect(doc.jobs?.["rc-failed"]?.permissions).toEqual({ issues: "write" });
    expect(doc.jobs?.train?.permissions).toEqual({
      contents: "write",
      issues: "write",
    });
    expect(doc.jobs?.probe?.permissions).toEqual({ contents: "read" });
    expect(doc.jobs?.publish?.permissions).toEqual({ contents: "write" });
    expect(doc.jobs?.["hold-after-probe"]?.permissions).toEqual({
      issues: "write",
    });
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
