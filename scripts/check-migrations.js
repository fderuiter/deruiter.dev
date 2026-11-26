/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require("fs");
const path = require("path");
const { checkMigrationIntegrity } = require("./check-migration-integrity");

function checkDestructiveMigrations(migrationsDir, overrideFlag) {
  if (!fs.existsSync(migrationsDir)) return false;

  const dirs = fs.readdirSync(migrationsDir).filter((f) => {
    return fs.statSync(path.join(migrationsDir, f)).isDirectory();
  });

  let hasDestructive = false;
  const destructiveDirs = [];

  for (const dir of dirs) {
    const sqlFile = path.join(migrationsDir, dir, "migration.sql");
    if (fs.existsSync(sqlFile)) {
      const content = fs.readFileSync(sqlFile, "utf8").toUpperCase();
      if (/DROP\s+COLUMN/i.test(content) || /DROP\s+TABLE/i.test(content)) {
        console.warn(
          `\n⚠️  WARNING: Destructive change detected in migration: ${dir}`
        );
        hasDestructive = true;
        destructiveDirs.push(dir);
      }
    }
  }

  if (hasDestructive) {
    if (overrideFlag) {
      console.log(
        "Override flag ALLOW_DESTRUCTIVE_MIGRATIONS is set. Proceeding with destructive migrations..."
      );
    } else {
      throw new Error(
        `Destructive migrations are blocked in: ${destructiveDirs.join(", ")}. ` +
          `Set ALLOW_DESTRUCTIVE_MIGRATIONS=true to override.`
      );
    }
  }

  return hasDestructive;
}

function runUnifiedMigrationCheck() {
  const root = path.resolve(__dirname, "..");
  const migrationsDir = path.join(root, "prisma/migrations");
  const overrideFlag = process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === "true";

  console.log(
    "Running Unified Migration Validator (Provider Parity, File Integrity, Destructive Guard)..."
  );

  // 1 & 2. Provider Parity & Migration File Integrity
  checkMigrationIntegrity();

  // 3. Destructive Query Scan
  checkDestructiveMigrations(migrationsDir, overrideFlag);

  console.log("✅ Unified migration validation passed cleanly.");
}

if (require.main === module) {
  try {
    runUnifiedMigrationCheck();
  } catch (error) {
    console.error(`\n❌ Migration check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  runUnifiedMigrationCheck,
  checkDestructiveMigrations,
};
