// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  validateNodeRuntime,
  validatePackageManager,
  validateLockfiles,
  runSetupWorkflow,
} from "@/lib/dx/setup";
import {
  CANONICAL_SETUP_COMMAND,
  checkOnboardingDocsDrift,
  checkSetupContractDocs,
} from "@/lib/dx/doctor";

describe("Interactive DX Setup Command & Documentation Sync", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-setup-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("setup CLI guards & validators", () => {
    it("validates Node.js runtime version", () => {
      const result = validateNodeRuntime();
      expect(typeof result.valid).toBe("boolean");
      expect(result.currentVersion).toBe(process.versions.node);
    });

    it("validates npm package manager context", () => {
      const result = validatePackageManager();
      expect(typeof result.valid).toBe("boolean");
    });

    it("detects missing package-lock.json and alternative lockfiles", () => {
      // Empty directory
      const check1 = validateLockfiles(tempDir);
      expect(check1.valid).toBe(false);
      expect(check1.errors).toContain(
        "Missing primary package-lock.json file."
      );

      // Add valid package-lock.json
      fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
      const check2 = validateLockfiles(tempDir);
      expect(check2.valid).toBe(true);

      // Add prohibited yarn.lock
      fs.writeFileSync(path.join(tempDir, "yarn.lock"), "");
      const check3 = validateLockfiles(tempDir);
      expect(check3.valid).toBe(false);
      expect(check3.errors.some((e) => e.includes("yarn.lock"))).toBe(true);
    });
  });

  describe("runSetupWorkflow", () => {
    it("creates .env.local from .env.example if missing", async () => {
      fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-app", engines: { node: "22.x" } })
      );
      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        'DATABASE_URL="postgresql://localhost:5432/db"'
      );

      const result = await runSetupWorkflow({
        workspaceRoot: tempDir,
        interactive: false,
        skipDb: true,
        log: () => undefined,
      });

      expect(result.environment?.templateCreated).toBe(true);
      expect(result.environment?.schemaValid).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".env.local"))).toBe(true);
      const content = fs.readFileSync(
        path.join(tempDir, ".env.local"),
        "utf-8"
      );
      expect(content).toContain(
        'DATABASE_URL="postgresql://localhost:5432/db"'
      );
    });

    it("does not overwrite existing .env.local without forceEnv in non-interactive mode", async () => {
      fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-app" })
      );
      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        'DATABASE_URL="new_value"'
      );
      fs.writeFileSync(
        path.join(tempDir, ".env.local"),
        'DATABASE_URL="custom_existing_value"'
      );

      await runSetupWorkflow({
        workspaceRoot: tempDir,
        interactive: false,
        skipDb: true,
        log: () => undefined,
      });

      const content = fs.readFileSync(
        path.join(tempDir, ".env.local"),
        "utf-8"
      );
      expect(content).toContain("custom_existing_value");
    });

    it("overwrites existing .env.local when forceEnv is true", async () => {
      fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-app" })
      );
      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        'DATABASE_URL="new_value"'
      );
      fs.writeFileSync(
        path.join(tempDir, ".env.local"),
        'DATABASE_URL="custom_existing_value"'
      );

      await runSetupWorkflow({
        workspaceRoot: tempDir,
        interactive: false,
        skipDb: true,
        forceEnv: true,
        log: () => undefined,
      });

      const content = fs.readFileSync(
        path.join(tempDir, ".env.local"),
        "utf-8"
      );
      expect(content).toContain("new_value");
    });
  });

  describe("checkOnboardingDocsDrift", () => {
    it("fails when obsolete Python badges are present in README.md", () => {
      const readme = `# Portfolio\n\n![Python 3.12](https://img.shields.io/badge/Python-3.12-blue)\n\n## Prerequisites\nNode.js 22.x\nnpm\nCopy .env.example\nnpx prisma db push\nnpx prisma db seed`;
      fs.writeFileSync(path.join(tempDir, "README.md"), readme);

      const result = checkOnboardingDocsDrift(tempDir);
      expect(result.status).toBe("fail");
      expect(
        result.details?.some((d) =>
          d.includes("Obsolete Python technology badge")
        )
      ).toBe(true);
    });

    it("fails when invalid environment template .env.local.example is referenced", () => {
      const readme = `# Portfolio\n\n## Prerequisites\nNode.js 22.x\nnpm\nCopy .env.local.example to .env.local\n.env.example\nnpx prisma db push\nnpx prisma db seed`;
      fs.writeFileSync(path.join(tempDir, "README.md"), readme);

      const result = checkOnboardingDocsDrift(tempDir);
      expect(result.status).toBe("fail");
      expect(
        result.details?.some((d) => d.includes(".env.local.example"))
      ).toBe(true);
    });

    it("fails when prisma db push is missing before prisma db seed", () => {
      const readme = `# Portfolio\n\n## Prerequisites\nNode.js 22.x\nnpm\nCopy .env.example\n\n## Setup\n1. npx prisma generate\n2. npx prisma db seed`;
      fs.writeFileSync(path.join(tempDir, "README.md"), readme);

      const result = checkOnboardingDocsDrift(tempDir);
      expect(result.status).toBe("fail");
      expect(result.details?.some((d) => d.includes("prisma db push"))).toBe(
        true
      );
    });

    it("passes when README.md contains accurate prerequisites, env references, and db push sequence", () => {
      const readme = `# Portfolio\n\n![Node.js](https://img.shields.io/badge/Node.js-22.x-339933)\n![npm](https://img.shields.io/badge/npm-%3E%3D10.0.0-CB3837)\n\n## Prerequisites\n- **Node.js**: 22.x\n- **npm**: >=10.0.0\n\n## Setup Instructions\n1. Copy .env.example to .env.local\n2. npx prisma db push\n3. npx prisma db seed`;
      fs.writeFileSync(path.join(tempDir, "README.md"), readme);

      const result = checkOnboardingDocsDrift(tempDir);
      expect(result.status).toBe("pass");
    });
  });
  describe("setup contract drift (#986)", () => {
    const repo = process.cwd();
    const reference = fs.readFileSync(
      path.join(repo, "docs", "reference", "setup.md"),
      "utf-8"
    );
    const readme = `# App\n\n${CANONICAL_SETUP_COMMAND}\n\nOr: npm install\n`;

    const seed = (files: Record<string, string>) => {
      fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "docs", "reference"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(tempDir, "scripts", "setup.sh"),
        "#!/bin/sh\n"
      );
      fs.copyFileSync(
        path.join(repo, "package.json"),
        path.join(tempDir, "package.json")
      );
      for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(tempDir, name), content);
      }
      return [path.join(tempDir, "README.md")];
    };

    it("passes for the repository's own documentation", () => {
      const result = checkOnboardingDocsDrift(repo);
      expect(result.details ?? []).toEqual([]);
      expect(result.status).toBe("pass");
    });

    it("does not apply to a workspace without scripts/setup.sh", () => {
      fs.writeFileSync(path.join(tempDir, "README.md"), "# App\n");
      expect(
        checkSetupContractDocs(tempDir, [path.join(tempDir, "README.md")])
      ).toEqual([]);
    });

    it("requires the canonical command before any manual install", () => {
      const files = seed({
        "README.md": "npm install\n\nthen ./scripts/setup.sh\n",
        "docs/reference/setup.md": reference,
      });
      expect(checkSetupContractDocs(tempDir, files)).toEqual([
        "README.md: Presents a manual install command before './scripts/setup.sh'.",
      ]);
      fs.writeFileSync(path.join(tempDir, "README.md"), "# App\n");
      expect(checkSetupContractDocs(tempDir, files)[0]).toMatch(
        /Missing the canonical fresh-clone command/
      );
    });

    it("fails when the engines range in package.json changes without the reference", () => {
      const files = seed({
        "README.md": readme,
        "docs/reference/setup.md": reference,
      });
      const pkg = JSON.parse(
        fs.readFileSync(path.join(tempDir, "package.json"), "utf-8")
      );
      pkg.engines.node = ">=22.0.0 <27.0.0";
      fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(pkg));
      expect(checkSetupContractDocs(tempDir, files)).toEqual([
        "docs/reference/setup.md: Does not state package.json engines.node ('>=22.0.0 <27.0.0') verbatim.",
      ]);
    });

    it("fails when a profile, a verification level or the production override is undocumented", () => {
      const files = seed({
        "README.md": readme,
        "docs/reference/setup.md": reference
          .replaceAll("`hosted-development`", "hosted development")
          .replaceAll("`quality`", "quality")
          .replaceAll("--allow-production-db", "--override"),
      });
      expect(checkSetupContractDocs(tempDir, files)).toEqual([
        "docs/reference/setup.md: Missing environment profile 'hosted-development'.",
        "docs/reference/setup.md: Missing verification level 'quality'.",
        "docs/reference/setup.md: Missing the production database override '--allow-production-db'.",
      ]);
    });

    it("fails when the database steps are out of order", () => {
      const files = seed({
        "README.md": readme,
        "docs/reference/setup.md": "npx prisma db seed\n" + reference,
      });
      expect(checkSetupContractDocs(tempDir, files)[0]).toMatch(
        /must appear in the order/
      );
    });
  });
});
