/* eslint-disable */
/**
 * Enforce npm as the exclusive package manager for local development.
 * Blocks package installation attempts made with yarn, pnpm, bun, etc.
 * Enforces Node.js and npm engine versions.
 */
const path = require("path");
const fs = require("fs");

// 1. Enforce npm as the package manager
const agent = process.env.npm_config_user_agent || "";
if (agent && !agent.startsWith("npm/")) {
  console.error(
    "\n======================================================================"
  );
  console.error(
    "❌ ERROR: npm is the exclusive package manager for this repository."
  );
  console.error(
    `You attempted to run this install with: ${agent.split(" ")[0]}`
  );
  console.error("Please run 'npm install' or 'npm ci' instead.");
  console.error(
    "======================================================================\n"
  );
  process.exit(1);
}

// 2. Enforce Node.js and npm engine versions
const packageJsonPath = path.join(__dirname, "../package.json");
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const engines = packageJson.engines || {};

    if (engines.node) {
      const requiredNodeRange = engines.node;
      const currentNodeVersion = process.versions.node;
      const currentMajor = parseInt(currentNodeVersion.split(".")[0], 10);
      const requiredMajorMatch = requiredNodeRange.match(/>=?\s*(\d+)/);
      if (requiredMajorMatch) {
        const requiredMajor = parseInt(requiredMajorMatch[1], 10);
        if (currentMajor < requiredMajor) {
          console.error(
            `\n❌ ERROR: Node.js version is too old. Current: v${currentNodeVersion}, Required: ${requiredNodeRange}\n`
          );
          process.exit(1);
        }
      }
    }
  } catch (err) {
    // Ignore JSON parsing errors of package.json to prevent installation blockages on bad formatting
  }
}

// 3. Enforce lifecycle script allowlist policy
const allowlistPath = path.join(__dirname, "install-script-allowlist.json");
const lockPath = path.join(__dirname, "../package-lock.json");

if (fs.existsSync(packageJsonPath) && fs.existsSync(allowlistPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));

    if (pkg.ignoreScripts !== undefined) {
      console.error(
        "\n❌ ERROR: 'ignoreScripts' must be removed from package.json\n"
      );
      process.exit(1);
    }
    if (pkg.trustedDependencies !== undefined) {
      console.error(
        "\n❌ ERROR: 'trustedDependencies' must be removed from package.json\n"
      );
      process.exit(1);
    }

    if (!pkg.allowScripts || typeof pkg.allowScripts !== "object") {
      console.error(
        "\n❌ ERROR: 'allowScripts' must be defined as an object in package.json\n"
      );
      process.exit(1);
    }

    const allowScriptsKeys = Object.keys(pkg.allowScripts).sort();
    const allowlistKeys = Object.keys(allowlist).sort();

    if (JSON.stringify(allowScriptsKeys) !== JSON.stringify(allowlistKeys)) {
      console.error(
        "\n❌ ERROR: package.json 'allowScripts' keys do not match 'scripts/install-script-allowlist.json'."
      );
      console.error(`allowScripts keys: ${allowScriptsKeys.join(", ")}`);
      console.error(`allowlist keys:    ${allowlistKeys.join(", ")}\n`);
      process.exit(1);
    }

    for (const [name, enabled] of Object.entries(pkg.allowScripts)) {
      if (enabled !== true) {
        console.error(
          `\n❌ ERROR: allowScripts entry for '${name}' must be true\n`
        );
        process.exit(1);
      }
    }

    for (const [name, reason] of Object.entries(allowlist)) {
      if (typeof reason !== "string" || reason.trim().length === 0) {
        console.error(
          `\n❌ ERROR: Allowlist entry '${name}' in scripts/install-script-allowlist.json needs a justification reason.\n`
        );
        process.exit(1);
      }
    }

    if (fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (lock.packages && typeof lock.packages === "object") {
        const withInstallScripts = new Set(
          Object.entries(lock.packages)
            .filter(
              ([key, meta]) => key !== "" && meta && meta.hasInstallScript
            )
            .map(([key]) => key.slice(key.lastIndexOf("node_modules/") + 13))
        );

        const unreviewed = [...withInstallScripts].filter(
          (n) => !(n in allowlist)
        );
        const stale = Object.keys(allowlist).filter(
          (n) => !withInstallScripts.has(n)
        );

        if (unreviewed.length > 0) {
          console.error(
            `\n❌ ERROR: New unreviewed install scripts detected in dependencies: ${unreviewed.join(", ")}`
          );
          console.error(
            "Review each package's lifecycle script, then add it to scripts/install-script-allowlist.json and package.json allowScripts with a justification.\n"
          );
          process.exit(1);
        }

        if (stale.length > 0) {
          console.error(
            `\n❌ ERROR: Stale install script allowlist entries detected: ${stale.join(", ")}`
          );
          console.error(
            "These packages no longer run install scripts; remove them from scripts/install-script-allowlist.json and package.json allowScripts.\n"
          );
          process.exit(1);
        }
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT" && !err.message.includes("process.exit")) {
      console.error(
        "\n❌ ERROR checking lifecycle script policy:",
        err.message,
        "\n"
      );
      process.exit(1);
    }
  }
}
