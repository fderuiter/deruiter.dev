/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");

function ensureNestedTypescript(targetDir) {
  if (!fs.existsSync(targetDir)) return;
  const tsDir = path.join(targetDir, "node_modules", "typescript");
  if (!fs.existsSync(tsDir)) {
    const sourceTsDir = [
      path.join(root, "node_modules", "typedoc", "node_modules", "typescript"),
      path.join(
        root,
        "node_modules",
        "eslint-config-next",
        "node_modules",
        "typescript-eslint",
        "node_modules",
        "typescript"
      ),
    ].find((p) => fs.existsSync(p));

    const targetNodeModules = path.join(targetDir, "node_modules");
    if (!fs.existsSync(targetNodeModules)) {
      fs.mkdirSync(targetNodeModules, { recursive: true });
    }

    if (sourceTsDir) {
      fs.cpSync(sourceTsDir, tsDir, { recursive: true });
    } else {
      try {
        execSync("npm install typescript@6.0.3 --no-save", {
          cwd: targetDir,
          stdio: "ignore",
        });
      } catch {
        // Ignore if npm install is restricted or unnecessary
      }
    }
  }
}

const targets = [
  path.join(
    root,
    "node_modules",
    "eslint-config-next",
    "node_modules",
    "typescript-eslint"
  ),
  path.join(root, "node_modules", "typedoc"),
  path.join(root, "node_modules", "@stryker-mutator", "core"),
  path.join(root, "node_modules", "@stryker-mutator", "vitest-runner"),
  path.join(root, "node_modules", "dependency-cruiser"),
];

for (const target of targets) {
  ensureNestedTypescript(target);
}
