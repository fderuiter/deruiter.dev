import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const scriptsDir = path.join(workspaceRoot, "scripts");

/**
 * Script Governance & Inventory Assertion Test
 * Verifies that 100% of executable/code scripts in /scripts have an active integration,
 * preventing orphaned or unreferenced utility scripts from accumulating.
 */
describe("Script Governance - Inventory & Integration Test", () => {
  it("verifies that all script files in /scripts have an active integration", () => {
    const scriptFiles = fs.readdirSync(scriptsDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".ts" || ext === ".js" || ext === ".sh";
    });

    expect(scriptFiles.length).toBeGreaterThan(0);

    const packageJsonPath = path.join(workspaceRoot, "package.json");
    const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
    const packageJsonData = JSON.parse(packageJsonContent);
    const npmScriptsValues = Object.values(packageJsonData.scripts || {}).join(
      " "
    );

    const huskyDir = path.join(workspaceRoot, ".husky");
    let huskyContent = "";
    if (fs.existsSync(huskyDir)) {
      const hooks = fs.readdirSync(huskyDir);
      for (const hook of hooks) {
        const hookPath = path.join(huskyDir, hook);
        if (fs.statSync(hookPath).isFile()) {
          huskyContent += fs.readFileSync(hookPath, "utf-8") + "\n";
        }
      }
    }

    const claudeHooksDir = path.join(workspaceRoot, ".claude", "hooks");
    let claudeHooksContent = "";
    if (fs.existsSync(claudeHooksDir)) {
      const hooks = fs.readdirSync(claudeHooksDir);
      for (const hook of hooks) {
        const hookPath = path.join(claudeHooksDir, hook);
        if (fs.statSync(hookPath).isFile()) {
          claudeHooksContent += fs.readFileSync(hookPath, "utf-8") + "\n";
        }
      }
    }

    const scanDirs = ["scripts", "lib", "__tests__"];
    const unintegratedScripts: string[] = [];

    for (const scriptFile of scriptFiles) {
      const baseNameWithoutExt = path.basename(
        scriptFile,
        path.extname(scriptFile)
      );

      const isInPackageJson = npmScriptsValues.includes(scriptFile);
      const isInHooks =
        huskyContent.includes(scriptFile) ||
        claudeHooksContent.includes(scriptFile);
      const isReferencedInCode = checkCodeReferences(
        scriptFile,
        baseNameWithoutExt,
        workspaceRoot,
        scanDirs
      );

      const hasActiveIntegration =
        isInPackageJson || isInHooks || isReferencedInCode;

      if (!hasActiveIntegration) {
        unintegratedScripts.push(scriptFile);
      }
    }

    expect(
      unintegratedScripts,
      `Orphaned or unintegrated scripts found in /scripts: ${unintegratedScripts.join(", ")}`
    ).toEqual([]);
  });

  it("asserts that removed obsolete scripts remain absent", () => {
    const obsoleteScripts = ["setup-github-project.sh", "validate-commit.ts"];
    for (const script of obsoleteScripts) {
      const scriptPath = path.join(scriptsDir, script);
      expect(
        fs.existsSync(scriptPath),
        `Obsolete script ${script} should be removed from /scripts`
      ).toBe(false);
    }
  });
});

function getAllFiles(dirPath: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dirPath);
  for (const file of list) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function checkCodeReferences(
  scriptFile: string,
  baseNameWithoutExt: string,
  workspaceRoot: string,
  scanDirs: string[]
): boolean {
  for (const dirName of scanDirs) {
    const dirPath = path.join(workspaceRoot, dirName);
    if (!fs.existsSync(dirPath)) continue;

    const files = getAllFiles(dirPath);
    for (const filePath of files) {
      const relativePath = path.relative(workspaceRoot, filePath);
      if (relativePath === path.join("scripts", scriptFile)) continue;

      if (/\.(ts|tsx|js|jsx)$/i.test(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        if (
          content.includes(scriptFile) ||
          content.includes(baseNameWithoutExt)
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
