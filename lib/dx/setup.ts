import fs from "fs";
import path from "path";
import readline from "readline";
import { execSync } from "child_process";
import { colors, formatHeader, badge, formatSection } from "./utils";
import { checkEnvironmentVariables } from "./env-guard";
import { getEnv } from "../env";

export interface SetupOptions {
  workspaceRoot?: string;
  interactive?: boolean;
  skipDb?: boolean;
  skipDbSeed?: boolean;
  forceEnv?: boolean;
}

export interface SetupResult {
  success: boolean;
  nodeVersionValid: boolean;
  packageManagerValid: boolean;
  lockfileValid: boolean;
  envCreatedOrValidated: boolean;
  dbSchemaPushed: boolean;
  dbSeeded: boolean;
  errors: string[];
}

/**
 * Validate the Node.js runtime floor. Node 22 LTS and Node 24 LTS are both
 * supported, matching engines.node and the version CI runs.
 */
export function validateNodeRuntime(): {
  valid: boolean;
  currentVersion: string;
} {
  const currentVersion = process.versions.node;
  const major = parseInt(currentVersion.split(".")[0], 10);
  return { valid: major >= 22, currentVersion };
}

/**
 * Validate npm package manager enforcement
 */
export function validatePackageManager(): { valid: boolean; agent: string } {
  const agent = getEnv().npm_config_user_agent || "";
  const isBun =
    typeof (process.versions as Record<string, unknown>).bun !== "undefined" ||
    agent.startsWith("bun/");
  const isYarn = agent.startsWith("yarn/");
  const isPnpm = agent.startsWith("pnpm/");

  if (isBun || isYarn || isPnpm || (agent && !agent.startsWith("npm/"))) {
    return { valid: false, agent: agent || "unsupported package manager" };
  }
  return { valid: true, agent: agent || "npm" };
}

/**
 * Check lockfile integrity (package-lock.json must exist, no alternative lockfiles)
 */
export function validateLockfiles(root: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const pkgLock = path.join(root, "package-lock.json");
  if (!fs.existsSync(pkgLock)) {
    errors.push("Missing primary package-lock.json file.");
  }
  const prohibitedLocks = [
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "pnpm-lock.yaml",
  ];
  for (const lock of prohibitedLocks) {
    if (fs.existsSync(path.join(root, lock))) {
      errors.push(`Prohibited alternative lockfile detected: ${lock}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Run Interactive DX Setup Routine
 */
export async function runSetupWorkflow(
  options: SetupOptions = {}
): Promise<SetupResult> {
  const root = options.workspaceRoot || path.resolve(__dirname, "..");
  const isInteractive = options.interactive !== false;
  const skipDb = !!options.skipDb;
  const skipDbSeed = !!options.skipDbSeed;
  const forceEnv = !!options.forceEnv;

  const result: SetupResult = {
    success: false,
    nodeVersionValid: false,
    packageManagerValid: false,
    lockfileValid: false,
    envCreatedOrValidated: false,
    dbSchemaPushed: false,
    dbSeeded: false,
    errors: [],
  };

  console.log(
    formatHeader(
      "Developer Experience (DX) Interactive Setup Wizard",
      "Node.js 22+ • npm • Next.js 16 • Prisma"
    )
  );

  // 1. Engine & Package Manager Guard
  const nodeCheck = validateNodeRuntime();
  if (!nodeCheck.valid) {
    const msg = `Unsupported Node.js version v${nodeCheck.currentVersion}. Node.js 22 or newer is required.`;
    console.error(`${badge("[ENGINE]", "fail")} ${msg}`);
    result.errors.push(msg);
    return result;
  }
  result.nodeVersionValid = true;
  console.log(
    `${badge("[ENGINE]", "pass")} Running on supported Node.js v${nodeCheck.currentVersion}`
  );

  const pmCheck = validatePackageManager();
  if (!pmCheck.valid) {
    const msg = `Unsupported package manager detected (${pmCheck.agent}). npm is the exclusive supported package manager.`;
    console.error(`${badge("[PACKAGE MANAGER]", "fail")} ${msg}`);
    result.errors.push(msg);
    return result;
  }
  result.packageManagerValid = true;
  console.log(
    `${badge("[PACKAGE MANAGER]", "pass")} Validated npm execution context`
  );

  // 2. Lockfile Check
  const lockCheck = validateLockfiles(root);
  if (!lockCheck.valid) {
    console.error(`${badge("[LOCKFILE]", "fail")} Lockfile validation failed:`);
    for (const err of lockCheck.errors) {
      console.error(`  ${colors.red}• ${err}${colors.reset}`);
      result.errors.push(err);
    }
    return result;
  }
  result.lockfileValid = true;
  console.log(
    `${badge("[LOCKFILE]", "pass")} package-lock.json verified (no alternative lockfiles)`
  );

  // 3. Environment Configuration Creation & Overwrite Protection
  const envLocalPath = path.join(root, ".env.local");
  const envExamplePath = path.join(root, ".env.example");

  if (!fs.existsSync(envExamplePath)) {
    const msg = "Environment template file (.env.example) is missing.";
    console.error(`${badge("[ENV]", "fail")} ${msg}`);
    result.errors.push(msg);
    return result;
  }

  let shouldCopyEnv = false;

  if (!fs.existsSync(envLocalPath)) {
    shouldCopyEnv = true;
    console.log(
      `${badge("[ENV]", "pass")} .env.local not found. Creating from .env.example...`
    );
  } else if (forceEnv) {
    shouldCopyEnv = true;
    console.log(
      `${badge("[ENV]", "warn")} Overwriting .env.local from .env.example (--force-env)...`
    );
  } else if (isInteractive) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await new Promise<string>((resolve) =>
      rl.question(
        `${colors.yellow}Local .env.local already exists. Overwrite with template .env.example? (y/N): ${colors.reset}`,
        (ans) => {
          rl.close();
          resolve(ans.trim());
        }
      )
    );
    if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      shouldCopyEnv = true;
    } else {
      console.log(
        `${badge("[ENV]", "pass")} Preserved existing .env.local file.`
      );
    }
  } else {
    console.log(
      `${badge("[ENV]", "pass")} Preserved existing .env.local file (non-interactive mode).`
    );
  }

  if (shouldCopyEnv) {
    fs.copyFileSync(envExamplePath, envLocalPath);
    console.log(`${badge("[ENV]", "fixed")} Copied .env.example -> .env.local`);
  }

  const envCheck = checkEnvironmentVariables(root, false);
  if (envCheck.status === "fail") {
    console.warn(
      `${badge("[ENV]", "warn")} Environment variable validation notes: ${envCheck.message}`
    );
  }
  result.envCreatedOrValidated = true;

  // 4. Database Schema Sync & Seeding
  if (skipDb) {
    console.log(
      `${badge("[DATABASE]", "warn")} Skipping database setup (--skip-db).`
    );
  } else {
    console.log(formatSection("Database Schema Initialization"));

    // Prisma Generate
    try {
      console.log(`Generating Prisma client...`);
      execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
      console.log(
        `${badge("[PRISMA]", "pass")} Prisma client generated successfully.`
      );
    } catch (_err) {
      const msg = "Failed to generate Prisma client.";
      console.error(`${badge("[PRISMA]", "fail")} ${msg}`);
      result.errors.push(msg);
      return result;
    }

    // Prisma DB Push
    try {
      console.log(`Pushing Prisma schema to database (npx prisma db push)...`);
      execSync("npx prisma db push", { cwd: root, stdio: "inherit" });
      result.dbSchemaPushed = true;
      console.log(
        `${badge("[DATABASE]", "pass")} Database schema pushed successfully.`
      );
    } catch (_err) {
      const msg =
        "Database schema push failed. Verify DATABASE_URL connection in .env.local.";
      console.error(`${badge("[DATABASE]", "fail")} ${msg}`);
      result.errors.push(msg);
      if (!isInteractive) {
        return result;
      }
    }

    // Prisma DB Seed
    if (result.dbSchemaPushed && !skipDbSeed) {
      let shouldSeed = true;
      if (isInteractive) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const answer = await new Promise<string>((resolve) =>
          rl.question(
            `${colors.cyan}Seed database with initial data? (Y/n): ${colors.reset}`,
            (ans) => {
              rl.close();
              resolve(ans.trim());
            }
          )
        );
        if (answer.toLowerCase() === "n" || answer.toLowerCase() === "no") {
          shouldSeed = false;
        }
      }

      if (shouldSeed) {
        try {
          console.log(`Seeding database (npx prisma db seed)...`);
          execSync("npx prisma db seed", { cwd: root, stdio: "inherit" });
          result.dbSeeded = true;
          console.log(
            `${badge("[DATABASE]", "pass")} Database seeded successfully.`
          );
        } catch (_err) {
          const msg = "Database seeding failed.";
          console.error(`${badge("[DATABASE]", "warn")} ${msg}`);
        }
      }
    }
  }

  result.success = result.errors.length === 0;

  if (result.success) {
    console.log(
      `\n${colors.brightGreen}======================================================================${colors.reset}`
    );
    console.log(
      `${colors.brightGreen}✅ Interactive DX Setup Completed Successfully!${colors.reset}`
    );
    console.log(
      `You can now run 'npm run dev' to launch the local development server.`
    );
    console.log(
      `${colors.brightGreen}======================================================================${colors.reset}\n`
    );
  } else {
    console.log(
      `\n${colors.brightRed}❌ Interactive DX Setup Encountered Errors.${colors.reset}\n`
    );
  }

  return result;
}
