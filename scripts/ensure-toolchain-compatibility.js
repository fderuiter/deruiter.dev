/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");

function ensureNestedTypescript(targetDir) {
  if (!fs.existsSync(targetDir)) return;
  const tsDir = path.join(targetDir, "node_modules", "typescript");
  if (!fs.existsSync(tsDir)) {
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

const targets = [
  path.join(
    root,
    "node_modules",
    "eslint-config-next",
    "node_modules",
    "typescript-eslint"
  ),
  path.join(root, "node_modules", "typedoc"),
];

for (const target of targets) {
  ensureNestedTypescript(target);
}
