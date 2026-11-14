// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkDocumentationDrift } from "../scripts/documentation-drift";
import {
  checkLlmsManifestsDrift,
  checkDocumentationIndexParity,
} from "../lib/dx/doctor";
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
    checkDocumentationIndex: () => ({ status: "pass", details: [] }),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("documentation drift checking", () => {
  it("compiles into a scratch directory without touching the tracked documentation", () => {
    const { root, docs } = createFixture();
    const original = fs.readFileSync(path.join(docs, "reference.md"), "utf8");
    let compiledInto = "";

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: (outputDirectory) => {
        compiledInto = outputDirectory;
        fs.writeFileSync(
          path.join(outputDirectory, "reference.md"),
          "# Compiled\n",
          "utf8"
        );
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
    });

    expect(result).toEqual({ status: "pass", details: [] });
    expect(compiledInto.startsWith(root)).toBe(false);
    expect(fs.existsSync(compiledInto)).toBe(false);
    expect(fs.readFileSync(path.join(docs, "reference.md"), "utf8")).toBe(
      original
    );
  });

  it("reports an untracked authored report", () => {
    const { root } = createFixture();

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: () => {},
      getGitStatus: () => ({
        modified: [],
        untracked: ["docs/audits/workflow.md"],
      }),
    });

    expect(result).toMatchObject({ status: "fail" });
    expect(result.details).toContain(
      "Authored documentation untracked: docs/audits/workflow.md. Stage or remove the authored report."
    );
  });

  it("reports an unstaged authored edit", () => {
    const { root } = createFixture();

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: () => {},
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

  it("returns an actionable generator failure", () => {
    const { root } = createFixture();

    const result = checkDocumentationDrift({
      workspaceRoot: root,
      compile: () => {
        throw new Error("TypeDoc failed");
      },
      getGitStatus: () => ({ modified: [], untracked: [] }),
    });

    expect(result.status).toBe("error");
    expect(result.details[0]).toBe(
      "Documentation generator failed: TypeDoc failed"
    );
    expect(result.details[1]).toContain("npm run compile-docs");
  });

  it("returns a failing CLI status when TypeDoc reports a warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dependencies = passingDependencies();
    dependencies.checkDocumentation = () => ({
      status: "error",
      details: ["Documentation generator failed: 1 warning"],
    });

    expect(checkDrift("/workspace", dependencies)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Documentation generator failed: 1 warning")
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

  it("reports documentation index parity drift with exit code 1 in checkDrift", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dependencies = passingDependencies();
    dependencies.checkDocumentationIndex = () => ({
      status: "fail",
      details: [
        "Unindexed markdown file: docs/how-to/new-guide.md. Missing inbound link from docs/README.md or quadrant index.",
      ],
    });

    expect(checkDrift("/workspace", dependencies)).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("Documentation index parity drift detected:")
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("docs/how-to/new-guide.md")
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

describe("documentation index parity checking", () => {
  it("passes when all markdown files are indexed in docs/README.md", () => {
    const { root, docs } = createFixture();
    fs.writeFileSync(
      path.join(docs, "README.md"),
      "# Documentation\n\n- [Reference](reference.md)\n",
      "utf8"
    );

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("pass");
  });

  it("fails when an unindexed markdown file exists in docs/", () => {
    const { root, docs } = createFixture();
    fs.writeFileSync(path.join(docs, "README.md"), "# Documentation\n", "utf8");

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("fail");
    expect(result.details?.some((d) => d.includes("docs/reference.md"))).toBe(
      true
    );
  });

  it("ignores auto-generated TypeDoc files in docs/reference/api/", () => {
    const { root, docs } = createFixture();
    fs.writeFileSync(
      path.join(docs, "README.md"),
      "# Documentation\n\n- [Reference](reference.md)\n",
      "utf8"
    );
    const apiDir = path.join(docs, "reference", "api");
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(
      path.join(apiDir, "generated.md"),
      "# Generated\n",
      "utf8"
    );

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("pass");
  });

  it("ignores internal agent invariant documents covered by local directory index", () => {
    const { root, docs } = createFixture();
    fs.writeFileSync(
      path.join(docs, "README.md"),
      "# Documentation\n\n- [Reference](reference.md)\n",
      "utf8"
    );
    const invariantsDir = path.join(docs, "agents", "invariants");
    fs.mkdirSync(invariantsDir, { recursive: true });
    fs.writeFileSync(
      path.join(invariantsDir, "README.md"),
      "# Invariants\n\n- [Rules](rules.md)\n",
      "utf8"
    );
    fs.writeFileSync(path.join(invariantsDir, "rules.md"), "# Rules\n", "utf8");

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("pass");
  });

  it("fails when an internal agent invariant document is not indexed locally", () => {
    const { root, docs } = createFixture();
    fs.writeFileSync(
      path.join(docs, "README.md"),
      "# Documentation\n\n- [Reference](reference.md)\n",
      "utf8"
    );
    const invariantsDir = path.join(docs, "agents", "invariants");
    fs.mkdirSync(invariantsDir, { recursive: true });
    fs.writeFileSync(
      path.join(invariantsDir, "README.md"),
      "# Invariants\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(invariantsDir, "unindexed-rule.md"),
      "# Unindexed\n",
      "utf8"
    );

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("fail");
    expect(result.details?.some((d) => d.includes("unindexed-rule.md"))).toBe(
      true
    );
  });

  it("reports failure when reading an index file fails", () => {
    const { root, docs } = createFixture();
    fs.writeFileSync(path.join(docs, "README.md"), "# Documentation\n", "utf8");
    const readSpy = vi
      .spyOn(fs, "readFileSync")
      .mockImplementation((file, ...args) => {
        if (String(file).endsWith("README.md")) {
          throw new Error("EACCES: permission denied");
        }
        return Reflect.apply(fs.readFileSync, fs, [file, ...args]);
      });

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("fail");
    expect(
      result.details?.some(
        (d) =>
          d.includes("Failed to read index file") &&
          d.includes("permission denied")
      )
    ).toBe(true);
    readSpy.mockRestore();
  });

  it("reports failure when scanning a directory fails", () => {
    const { root } = createFixture();
    const readdirSpy = vi
      .spyOn(fs, "readdirSync")
      .mockImplementation((dir, ...args) => {
        if (String(dir).includes("docs")) {
          throw new Error("EACCES: permission denied");
        }
        return Reflect.apply(fs.readdirSync, fs, [dir, ...args]);
      });

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("fail");
    expect(
      result.details?.some(
        (d) =>
          d.includes("Failed to read directory") &&
          d.includes("permission denied")
      )
    ).toBe(true);
    readdirSpy.mockRestore();
  });

  it("reports failure when stating a linked target fails", () => {
    const { root, docs } = createFixture();
    fs.writeFileSync(
      path.join(docs, "README.md"),
      "# Documentation\n\n- [Sub](sub)\n",
      "utf8"
    );
    const subDir = path.join(docs, "sub");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, "README.md"), "# Sub\n", "utf8");

    const statSpy = vi
      .spyOn(fs, "statSync")
      .mockImplementation((target, ...args) => {
        if (String(target).endsWith("sub")) {
          throw new Error("EIO: i/o error");
        }
        return Reflect.apply(fs.statSync, fs, [target, ...args]);
      });

    const result = checkDocumentationIndexParity(root);
    expect(result.status).toBe("fail");
    expect(
      result.details?.some(
        (d) => d.includes("Failed to stat path") && d.includes("EIO: i/o error")
      )
    ).toBe(true);
    statSpy.mockRestore();
  });
});

/**
 * The remedy used to read "regenerate only stale references", naming no
 * command. Every public-export change then cost two full pre-commit cycles:
 * one to discover the drift, one after guessing the fix.
 */
describe("Drift remedy guidance", () => {
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

  it("names the documentation index guidance for index parity drift", () => {
    const remedy = formatDriftRemedy(["docs-index-parity"]);
    expect(remedy).toContain("docs/README.md");
    expect(remedy).toContain("npm run check-docs-drift");
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
    const remedy = formatDriftRemedy(["llms-manifests"]);
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
      "llms-manifests",
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
