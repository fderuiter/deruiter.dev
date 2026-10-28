/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require("fs");
const path = require("path");

function readProvider(source, pattern, sourceName) {
  const match = source.match(pattern);
  if (!match) {
    throw new Error(
      `Could not read the datasource provider from ${sourceName}.`
    );
  }
  return match[1];
}

function getSchemaProvider(schema) {
  const datasource = schema.match(/datasource\s+\w+\s*\{([\s\S]*?)\}/);
  if (!datasource) {
    throw new Error(
      "Could not find a datasource block in prisma/schema.prisma."
    );
  }
  return readProvider(
    datasource[1],
    /provider\s*=\s*["']([^"']+)["']/,
    "prisma/schema.prisma"
  );
}

function getLockProvider(lock) {
  return readProvider(
    lock,
    /^provider\s*=\s*["']([^"']+)["']/m,
    "prisma/migrations/migration_lock.toml"
  );
}

function validateMigrationFiles(directory) {
  const migrations = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (migrations.length === 0) {
    throw new Error("No migration directories were found.");
  }

  for (const migration of migrations) {
    const sqlPath = path.join(directory, migration, "migration.sql");
    if (
      !fs.existsSync(sqlPath) ||
      fs.readFileSync(sqlPath, "utf8").trim() === ""
    ) {
      throw new Error(
        `Migration ${migration} has no non-empty migration.sql file.`
      );
    }
  }

  return migrations;
}

function getDocMigrations(docContent) {
  if (typeof docContent !== "string") return [];
  const matches = docContent.match(/\b\d{14}_[a-z0-9_]+\b/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase()))).sort();
}

function validateDocMigrations(docPath, migrationsPath) {
  if (!fs.existsSync(docPath)) {
    throw new Error(`Migration documentation file not found at ${docPath}.`);
  }
  const docContent = fs.readFileSync(docPath, "utf8");
  const documentedMigrations = getDocMigrations(docContent);
  const actualMigrations = validateMigrationFiles(migrationsPath);

  const actualLowerMap = new Map(
    actualMigrations.map((m) => [m.toLowerCase(), m])
  );
  const missingInDoc = actualMigrations.filter(
    (m) => !documentedMigrations.includes(m.toLowerCase())
  );
  const extraInDoc = documentedMigrations.filter((m) => !actualLowerMap.has(m));

  if (missingInDoc.length > 0 || extraInDoc.length > 0) {
    const details = [];
    if (missingInDoc.length > 0) {
      details.push(`Missing in documentation: ${missingInDoc.join(", ")}`);
    }
    if (extraInDoc.length > 0) {
      details.push(
        `Extra/mismatched in documentation: ${extraInDoc.join(", ")}`
      );
    }
    throw new Error(
      `Documentation drift detected in ${path.basename(docPath)}:\n  ${details.join("\n  ")}\nPlease update ${path.basename(docPath)} to match active repository migrations.`
    );
  }

  return documentedMigrations;
}

const REQUIRED_DOC_COMMANDS = [
  {
    name: "schema drift verification ('npm run check:migrations:drift' or 'prisma migrate diff')",
    pattern: /check:migrations:drift|prisma migrate diff/i,
  },
  {
    name: "disposable migration replay ('npm run migration:replay')",
    pattern: /migration:replay/i,
  },
  {
    name: "guarded Vercel production migration execution",
    pattern: /VERCEL=1[\s\S]*VERCEL_ENV=production|Vercel production build/i,
  },
  {
    name: "destructive migration environment variable ('ALLOW_DESTRUCTIVE_MIGRATIONS')",
    pattern: /ALLOW_DESTRUCTIVE_MIGRATIONS/i,
  },
  {
    name: "unified migration check ('npm run check:migrations')",
    pattern: /check:migrations\b/i,
  },
];

function validateProductionMigrationGuard(buildPath) {
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Production build script not found at ${buildPath}.`);
  }

  const buildContent = fs.readFileSync(buildPath, "utf8");
  const requirements = [
    {
      name: "Vercel production environment guard",
      pattern:
        /process\.env\.VERCEL\s*===\s*["']1["']\s*&&\s*process\.env\.VERCEL_ENV\s*===\s*["']production["']/,
    },
    {
      name: "Vercel/Neon unpooled migration credential",
      pattern: /process\.env\.DATABASE_URL_UNPOOLED/,
    },
    {
      name: "Prisma migration deployment",
      pattern:
        /runStep\(["']npx["'],\s*\[["']prisma["'],\s*["']migrate["'],\s*["']deploy["']\]/,
    },
  ];
  const missing = requirements
    .filter(({ pattern }) => !pattern.test(buildContent))
    .map(({ name }) => name);

  if (missing.length > 0) {
    throw new Error(
      `Production migration guard check failed in ${path.basename(buildPath)}:\n` +
        missing.map((name) => `  - Missing ${name}`).join("\n")
    );
  }
  return true;
}

function validateDocCommands(docPath) {
  if (!fs.existsSync(docPath)) {
    throw new Error(`Migration documentation file not found at ${docPath}.`);
  }
  const docContent = fs.readFileSync(docPath, "utf8");
  const missing = [];

  for (const cmd of REQUIRED_DOC_COMMANDS) {
    if (!cmd.pattern.test(docContent)) {
      missing.push(cmd.name);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Documentation completeness check failed in ${path.basename(docPath)}:\n` +
        `  Missing required operational command/variable documentation:\n` +
        missing.map((m) => `    - ${m}`).join("\n") +
        `\nPlease update ${path.basename(docPath)} to explicitly document all required database release and drift verification procedures.`
    );
  }

  return true;
}

function checkMigrationIntegrity(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const schemaFile =
    options.schemaPath || path.join(rootDir, "prisma/schema.prisma");
  const lockFile =
    options.lockPath ||
    path.join(rootDir, "prisma/migrations/migration_lock.toml");
  const migrationsDir =
    options.migrationsPath || path.join(rootDir, "prisma/migrations");
  const docFile =
    options.docPath ||
    path.join(rootDir, "docs/how-to/write-a-database-migration.md");

  const schemaProvider = getSchemaProvider(fs.readFileSync(schemaFile, "utf8"));
  const lockProvider = getLockProvider(fs.readFileSync(lockFile, "utf8"));

  if (schemaProvider !== lockProvider) {
    throw new Error(
      `Datasource provider mismatch: schema.prisma uses ${schemaProvider}, ` +
        `but migration_lock.toml uses ${lockProvider}.`
    );
  }

  const migrations = validateMigrationFiles(migrationsDir);
  const docMigrations = validateDocMigrations(docFile, migrationsDir);
  validateDocCommands(docFile);
  validateProductionMigrationGuard(path.join(rootDir, "scripts/build.js"));

  console.log(
    `Migration integrity check passed: provider=${schemaProvider}, migrations=${migrations.length}, docMigrations=${docMigrations.length}.`
  );
}

if (require.main === module) {
  try {
    checkMigrationIntegrity();
  } catch (error) {
    console.error(`Migration integrity check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  checkMigrationIntegrity,
  getDocMigrations,
  getLockProvider,
  getSchemaProvider,
  validateDocMigrations,
  validateDocCommands,
  validateMigrationFiles,
  validateProductionMigrationGuard,
  REQUIRED_DOC_COMMANDS,
};
