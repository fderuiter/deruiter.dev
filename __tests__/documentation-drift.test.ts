import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkDocumentationDrift } from "../scripts/documentation-drift";
import { checkLlmsManifestsDrift } from "../lib/dx/doctor";
import { buildLlmsManifests } from "../scripts/generate-llms-txt";
import {
  checkDrift,
  formatDriftRemedy,
  type DriftCheckDependencies,
} from "../scripts/check-drift";

const temporaryDirectories: string[] = [];

function createFixture(): { root: string; docs: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-doc-drift-"));
  temporaryDirectories.push(root);
  const docs = path.join(root, "docs");
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, "reference.md"), "# Reference\n", "utf8");
  return { root, docs };
}

function passingDependencies(): DriftCheckDependencies {
  return {
    checkDocumentation: () => ({ status: "pass", details: [] }),
    checkOpenApi: () => ({ missingRoutes: [], hasDrift: false }),
    checkOnboarding: () => ({ status: "pass" }),
    checkTopology: () => ({ status: "pass" }),
    checkMarkdownLinks: () => ({ status: "pass", details: [] }),
    checkPublicRoutes: () => ({ status: "pass", details: [] }),
    checkTechnicalGuides: () => ({ status: "pass", details: [] }),
    checkLlmsManifests: () => ({ status: "pass", details: [] }),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("documentation drift checking", () => {
  it("compares an isolated compilation without rewriting the tracked documentation", () => {
    const { root, docs } = createFixture();
    const original = fs.readFileSync(path.join(docs, "reference.md"), "utf8");

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        fs.mkdirSync(outputDirectory, { recursive: true });
        fs.writeFileSync(
          path.join(outputDirectory, "reference.md"),
          original,
          "utf8"
        );
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
    });

    expect(result.status).toBe("pass");
    expect(fs.readFileSync(path.join(docs, "reference.md"), "utf8")).toBe(
      original
    );
  });

  it("reports stale generated references without rewriting them", () => {
    const { root, docs } = createFixture();
    const original = fs.readFileSync(path.join(docs, "reference.md"), "utf8");

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        fs.writeFileSync(
          path.join(outputDirectory, "reference.md"),
          "# Updated reference\n",
          "utf8"
        );
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
    });

    expect(result).toMatchObject({ status: "fail" });
    expect(result.details).toContain(
      "Stale generated reference: docs/reference.md differs from generated output"
    );
    expect(fs.readFileSync(path.join(docs, "reference.md"), "utf8")).toBe(
      original
    );
  });

  it("reports a missing generated page when a public export is added", () => {
    const { root } = createFixture();

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        fs.writeFileSync(
          path.join(outputDirectory, "reference.md"),
          "# Reference\n",
          "utf8"
        );
        fs.mkdirSync(path.join(outputDirectory, "hooks"), { recursive: true });
        fs.writeFileSync(
          path.join(outputDirectory, "hooks", "useNewExport.md"),
          "# New public export\n",
          "utf8"
        );
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
    });

    expect(result).toMatchObject({ status: "fail" });
    expect(result.details).toContain(
      "Stale generated reference: missing docs/hooks/useNewExport.md"
    );
  });

  it("distinguishes an untracked authored audit report from generated drift", () => {
    const { root, docs } = createFixture();
    const auditPath = path.join(docs, "audits", "workflow.md");
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.writeFileSync(auditPath, "# Workflow audit\n", "utf8");

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        fs.writeFileSync(
          path.join(outputDirectory, "reference.md"),
          "# Reference\n",
          "utf8"
        );
      },
      getGitStatus: () => ({
        modified: [],
        untracked: ["docs/audits/workflow.md"],
      }),
    });

    expect(result).toMatchObject({ status: "fail" });
    expect(result.details).toContain(
      "Authored documentation untracked: docs/audits/workflow.md. Stage or remove the authored report."
    );
    expect(fs.readFileSync(auditPath, "utf8")).toBe("# Workflow audit\n");
  });

  it("distinguishes an authored documentation edit from generated drift", () => {
    const { root } = createFixture();

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        fs.writeFileSync(
          path.join(outputDirectory, "reference.md"),
          "# Reference\n",
          "utf8"
        );
      },
      getGitStatus: () => ({
        modified: ["docs/planning/next.md"],
        untracked: [],
      }),
    });

    expect(result).toMatchObject({ status: "fail" });
    expect(result.details).toContain(
      "Authored documentation modified: docs/planning/next.md. Stage or revert the authored edit."
    );
  });

  it("compares generated output against a custom generatedDocsRelativePath instead of the docs root (ADR 0023)", () => {
    const { root } = createFixture();
    const apiReferenceDir = path.join(root, "docs", "reference", "api");
    fs.mkdirSync(apiReferenceDir, { recursive: true });
    fs.writeFileSync(
      path.join(apiReferenceDir, "modules.md"),
      "# Modules\n",
      "utf8"
    );

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        fs.writeFileSync(
          path.join(outputDirectory, "modules.md"),
          "# Modules\n",
          "utf8"
        );
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
      generatedDocsRelativePath: path.join("docs", "reference", "api"),
    });

    expect(result).toEqual({ status: "pass", details: [] });
  });

  it("reports a stale generated reference at the custom generatedDocsRelativePath location, not the docs root", () => {
    const { root, docs } = createFixture();
    // Nothing exists yet at docs/reference/api/modules.md.

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        fs.writeFileSync(
          path.join(outputDirectory, "modules.md"),
          "# Modules\n",
          "utf8"
        );
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
      generatedDocsRelativePath: path.join("docs", "reference", "api"),
    });

    expect(result).toMatchObject({ status: "fail" });
    expect(result.details).toContain(
      "Stale generated reference: missing docs/reference/api/modules.md"
    );
    // The pre-existing docs/reference.md fixture at the plain docs root is
    // untouched and irrelevant to this custom-path comparison.
    expect(fs.existsSync(path.join(docs, "reference.md"))).toBe(true);
  });

  it("returns an actionable generator failure", () => {
    const { root } = createFixture();

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: () => {
        throw new Error("TypeDoc failed");
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
    });

    expect(result).toEqual({
      status: "error",
      details: ["Documentation generator failed: TypeDoc failed"],
    });
  });

  it("returns a failing CLI status for stale generated references", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dependencies = passingDependencies();
    dependencies.checkDocumentation = () => ({
      status: "fail",
      details: ["Stale generated reference: missing docs/hooks/useRemoved.md"],
    });

    expect(checkDrift("/workspace", dependencies)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Stale generated reference: missing docs/hooks/useRemoved.md"
      )
    );
    error.mockRestore();
  });

  it("reports missing API contracts with a failing CLI status", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dependencies = passingDependencies();
    dependencies.checkOpenApi = () => ({
      missingRoutes: ["/api/telemetry"],
      hasDrift: false,
    });

    expect(checkDrift("/workspace", dependencies)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Undocumented API routes detected (1):\n  - /api/telemetry"
      )
    );
    error.mockRestore();
  });

  it("reports LLM manifest drift with exit code 1 in checkDrift", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dependencies = passingDependencies();
    dependencies.checkLlmsManifests = () => ({
      status: "fail",
      details: [
        "public/llms.txt is out of sync with route metadata or case studies",
      ],
    });

    expect(checkDrift("/workspace", dependencies)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("LLM discovery manifest drift detected:")
    );
    error.mockRestore();
  });
});

describe("LLM discovery manifests drift checking", () => {
  it("passes when public manifests match buildLlmsManifests output", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-llms-drift-")
    );
    temporaryDirectories.push(root);
    const publicDir = path.join(root, "public");
    fs.mkdirSync(publicDir, { recursive: true });

    const { llms, full } = buildLlmsManifests();
    fs.writeFileSync(path.join(publicDir, "llms.txt"), llms, "utf8");
    fs.writeFileSync(path.join(publicDir, "llms-full.txt"), full, "utf8");

    const result = checkLlmsManifestsDrift(root);
    expect(result.status).toBe("pass");
  });

  it("handles CRLF line endings without reporting drift", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-llms-drift-")
    );
    temporaryDirectories.push(root);
    const publicDir = path.join(root, "public");
    fs.mkdirSync(publicDir, { recursive: true });

    const { llms, full } = buildLlmsManifests();
    fs.writeFileSync(
      path.join(publicDir, "llms.txt"),
      llms.replace(/\n/g, "\r\n"),
      "utf8"
    );
    fs.writeFileSync(
      path.join(publicDir, "llms-full.txt"),
      full.replace(/\n/g, "\r\n"),
      "utf8"
    );

    const result = checkLlmsManifestsDrift(root);
    expect(result.status).toBe("pass");
  });

  it("reports failure when manifests are missing or stale", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-llms-drift-")
    );
    temporaryDirectories.push(root);
    const publicDir = path.join(root, "public");
    fs.mkdirSync(publicDir, { recursive: true });

    fs.writeFileSync(path.join(publicDir, "llms.txt"), "stale content", "utf8");
    fs.writeFileSync(
      path.join(publicDir, "llms-full.txt"),
      "stale content",
      "utf8"
    );

    const result = checkLlmsManifestsDrift(root);
    expect(result.status).toBe("fail");
    expect(result.fixable).toBe(true);
    expect(result.details).toContain(
      "public/llms.txt is out of sync with route metadata or case studies"
    );
    expect(result.details).toContain(
      "public/llms-full.txt is out of sync with route metadata or case studies"
    );
  });

  it("auto-remediates drift when fix option is enabled", () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "portfolio-llms-drift-")
    );
    temporaryDirectories.push(root);

    const result = checkLlmsManifestsDrift(root, true);
    expect(result.status).toBe("fixed");

    const { llms, full } = buildLlmsManifests();
    expect(fs.readFileSync(path.join(root, "public", "llms.txt"), "utf8")).toBe(
      llms
    );
    expect(
      fs.readFileSync(path.join(root, "public", "llms-full.txt"), "utf8")
    ).toBe(full);
  });
});

/**
 * The remedy used to read "regenerate only stale references", naming no
 * command. Every public-export change then cost two full pre-commit cycles:
 * one to discover the drift, one after guessing the fix.
 */
describe("Drift remedy guidance", () => {
  it("names the exact command for stale generated references", () => {
    const remedy = formatDriftRemedy(["generated-docs"]);
    expect(remedy).toContain("npm run compile-docs");
    expect(remedy).toContain("git add docs/");
  });

  it("names the contract regeneration command for OpenAPI drift", () => {
    const remedy = formatDriftRemedy(["openapi"]);
    expect(remedy).toContain("npm run doctor:fix");
    expect(remedy).toContain("openapi.json");
  });

  it("names the generator command for LLM manifest drift", () => {
    const remedy = formatDriftRemedy(["llms-manifests"]);
    expect(remedy).toContain("npm run generate:llms");
    expect(remedy).toContain("public/llms.txt");
  });

  it("never offers to regenerate authored documentation", () => {
    // A human edited these deliberately; restaging them silently would discard
    // that intent, so the remedy only tells them to stage it.
    const remedy = formatDriftRemedy(["authored-docs"]);
    expect(remedy).toContain("git add docs/");
    expect(remedy).not.toContain("compile-docs");
    expect(remedy).not.toContain("doctor:fix");
  });

  it("reports only the categories that actually failed", () => {
    const remedy = formatDriftRemedy(["generated-docs"]);
    expect(remedy).not.toContain("Broken markdown links");
    expect(remedy).not.toContain("openapi.json");
  });

  it("de-duplicates repeated categories", () => {
    const remedy = formatDriftRemedy(["openapi", "openapi", "openapi"]);
    expect(remedy.match(/npm run doctor:fix/gu)).toHaveLength(1);
  });

  it("returns nothing when there is no drift", () => {
    expect(formatDriftRemedy([])).toBe("");
  });

  it("stays copy-pasteable rather than prose", () => {
    const remedy = formatDriftRemedy([
      "generated-docs",
      "openapi",
      "authored-docs",
    ]);
    expect(remedy).not.toContain("Remedy the reported category");
    // Every non-empty line is either a heading or an indented command.
    const commandLines = remedy
      .split("\n")
      .filter((line) => line.startsWith("    ") && line.trim().length > 0);
    expect(commandLines.length).toBeGreaterThanOrEqual(4);
  });
});
