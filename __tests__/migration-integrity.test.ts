/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The production guard is CommonJS because it runs directly under Node.
const {
  getDocMigrations,
  getLockProvider,
  getSchemaProvider,
  validateDocMigrations,
  validateDocCommands,
  validateMigrationFiles,
  validateProductionMigrationGuard,
} = require("../scripts/check-migration-integrity.js");

const {
  runUnifiedMigrationCheck,
  checkDestructiveMigrations,
} = require("../scripts/check-migrations.js");

describe("Prisma migration integrity", () => {
  it("reads the provider from a Prisma datasource block", () => {
    expect(
      getSchemaProvider(`
        generator client { provider = "prisma-client" }
        datasource db {
          provider = "postgresql"
        }
      `)
    ).toBe("postgresql");
  });

  it("reads the provider from the migration lock", () => {
    expect(getLockProvider('provider = "postgresql"')).toBe("postgresql");
  });

  const rootDir = process.cwd();
  const migrationsDir = resolve(rootDir, "prisma/migrations");
  const docPath = resolve(rootDir, "DATABASE_MIGRATIONS.md");

  function readMigrationSql(migrationName: string): string {
    return readFileSync(
      resolve(migrationsDir, migrationName, "migration.sql"),
      "utf8"
    );
  }

  const EXPECTED_MIGRATIONS = [
    "20260417215437_init",
    "20260528000000_add_telemetry_event",
    "20260814000000_add_simulated_telemetry",
    "20260818000000_add_feedback_and_reactions",
    "20261014000000_add_commands_and_playback",
    "20261015000000_add_email_resilience",
    "20261016000000_enforce_email_contracts",
    "20261017000000_add_telemetry_daily_rollups",
    "20261018000000_add_blog_post",
    "20261019000000_add_blog_post_reaction",
    "20261020000000_add_case_study_hero_image",
    "20261021000000_add_newsletter_subscribers",
    "20261022000000_add_case_study_reaction_unique_constraint",
    "20261023000000_add_telemetry_event_created_at_idx",
    "20261024000000_add_case_study_and_blog_post_composite_indexes",
    "20261024000000_add_telemetry_event_compound_idx",
  ];

  it("validates every checked-in migration file", () => {
    expect(validateMigrationFiles(migrationsDir)).toEqual(EXPECTED_MIGRATIONS);
  });

  it("extracts migration identifiers from markdown documentation", () => {
    const sampleDoc = `
      # Database Migrations
      - \`20260417215437_init\`
      - \`20260528000000_add_telemetry_event\`
      Some random text with 20260814000000_add_simulated_telemetry in code block.
    `;
    expect(getDocMigrations(sampleDoc)).toEqual([
      "20260417215437_init",
      "20260528000000_add_telemetry_event",
      "20260814000000_add_simulated_telemetry",
    ]);
  });

  it("validates documentation parity against active repository migration assets", () => {
    expect(validateDocMigrations(docPath, migrationsDir)).toEqual(
      EXPECTED_MIGRATIONS
    );
  });

  it("keeps the email resilience migration additive, indexed, and upgrade-safe", () => {
    const migration = readMigrationSql("20261015000000_add_email_resilience");

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "SuppressionList"');
    expect(migration).toContain('"email" TEXT NOT NULL');
    expect(migration).toContain('"reason" TEXT NOT NULL');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "SuppressionList_email_key"'
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "SuppressionList_email_idx"'
    );

    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "OutboundEmailQueue"'
    );
    expect(migration).toContain('"html" TEXT NOT NULL');
    expect(migration).toContain('"tags" JSONB');
    expect(migration).toContain('"attempts" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain("\"status\" TEXT NOT NULL DEFAULT 'PENDING'");
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "OutboundEmailQueue_status_nextRetryAt_idx"'
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "OutboundEmailQueue_createdAt_idx"'
    );
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("keeps the telemetry rollup migration aligned with Prisma updatedAt semantics", () => {
    const migration = readMigrationSql(
      "20261017000000_add_telemetry_daily_rollups"
    );

    expect(migration).toContain(
      '"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'
    );
    expect(migration).toContain('"updatedAt" TIMESTAMP(3) NOT NULL');
    expect(migration).not.toMatch(
      /"updatedAt"\s+TIMESTAMP\(3\)\s+NOT NULL\s+DEFAULT\s+CURRENT_TIMESTAMP/
    );
  });

  it("keeps the blog post migration additive, indexed, and non-destructive", () => {
    const migration = readMigrationSql("20261018000000_add_blog_post");

    expect(migration).toContain('CREATE TABLE "BlogPost"');
    expect(migration).toContain('"slug" TEXT NOT NULL');
    expect(migration).toContain('"published" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug")'
    );
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("keeps the blog post reaction migration additive, indexed, and non-destructive", () => {
    const migration = readMigrationSql("20261019000000_add_blog_post_reaction");

    expect(migration).toContain('CREATE TABLE "BlogPostReaction"');
    expect(migration).toContain('"blogPostSlug" TEXT NOT NULL');
    expect(migration).toContain('"reactionType" TEXT NOT NULL');
    expect(migration).toContain('"connectionHash" TEXT NOT NULL');
    expect(migration).toContain(
      'CREATE INDEX "BlogPostReaction_blogPostSlug_idx" ON "BlogPostReaction"("blogPostSlug")'
    );
    expect(migration).toContain(
      'CREATE INDEX "BlogPostReaction_blogPostSlug_reactionType_idx" ON "BlogPostReaction"("blogPostSlug", "reactionType")'
    );
    expect(migration).toContain(
      'CREATE INDEX "BlogPostReaction_connectionHash_idx" ON "BlogPostReaction"("connectionHash")'
    );
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
  });

  it("deduplicates case study reactions before enforcing payload uniqueness", () => {
    const migration = readMigrationSql(
      "20261022000000_add_case_study_reaction_unique_constraint"
    );

    expect(migration).toContain(
      'PARTITION BY "caseStudySlug", "reactionType", "connectionHash"'
    );
    expect(migration).toContain("BEGIN;");
    expect(migration).toContain(
      'LOCK TABLE "CaseStudyReaction" IN SHARE ROW EXCLUSIVE MODE;'
    );
    expect(migration).toContain("COMMIT;");
    expect(migration).toContain('ORDER BY "createdAt" ASC, "id" ASC');
    expect(migration).toContain("duplicate_rank > 1");
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "CaseStudyReaction_caseStudySlug_reactionType_connectionHash_key"\s+ON "CaseStudyReaction"\("caseStudySlug", "reactionType", "connectionHash"\)/
    );
    expect(migration.indexOf('DELETE FROM "CaseStudyReaction"')).toBeLessThan(
      migration.indexOf(
        'CREATE UNIQUE INDEX "CaseStudyReaction_caseStudySlug_reactionType_connectionHash_key"'
      )
    );
    expect(
      migration.indexOf(
        'LOCK TABLE "CaseStudyReaction" IN SHARE ROW EXCLUSIVE MODE;'
      )
    ).toBeLessThan(migration.indexOf('DELETE FROM "CaseStudyReaction"'));
  });

  it("adds the TelemetryEvent createdAt index without destructive drops", () => {
    const migration = readMigrationSql(
      "20261023000000_add_telemetry_event_created_at_idx"
    );

    expect(migration).toMatch(
      /CREATE INDEX(?: IF NOT EXISTS)? "TelemetryEvent_createdAt_idx"\s+ON "TelemetryEvent"\("createdAt"\)/
    );
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
  });

  it("adds the CaseStudy and BlogPost composite indexes without destructive drops", () => {
    const migration = readMigrationSql(
      "20261024000000_add_case_study_and_blog_post_composite_indexes"
    );

    for (const index of [
      /"CaseStudy_published_created_at_idx"\s+ON "CaseStudy"\("published", "created_at"\)/,
      /"CaseStudyFeedback_caseStudySlug_createdAt_idx"\s+ON "CaseStudyFeedback"\("caseStudySlug", "createdAt"\)/,
      /"CaseStudyFeedback_caseStudySlug_connectionHash_createdAt_idx"\s+ON "CaseStudyFeedback"\("caseStudySlug", "connectionHash", "createdAt"\)/,
      /"BlogPost_published_created_at_idx"\s+ON "BlogPost"\("published", "created_at"\)/,
      /"BlogPost_published_updated_at_idx"\s+ON "BlogPost"\("published", "updated_at"\)/,
    ]) {
      expect(migration).toMatch(
        new RegExp(`CREATE INDEX(?: IF NOT EXISTS)? ${index.source}`)
      );
    }
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
  });

  it("adds the TelemetryEvent compound index without destructive drops", () => {
    const migration = readMigrationSql(
      "20261024000000_add_telemetry_event_compound_idx"
    );

    expect(migration).toMatch(
      /CREATE INDEX(?: IF NOT EXISTS)? "TelemetryEvent_eventType_projectSlug_idx"\s+ON "TelemetryEvent"\("eventType", "projectSlug"\)/
    );
    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/i);
  });

  it("fails migration file validation when a migration asset is missing or empty", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "migration-asset-test-")
    );
    const brokenMigrationDir = path.join(
      tmpDir,
      "20260101000000_broken_migration"
    );

    try {
      expect(() => validateMigrationFiles(tmpDir)).toThrow(
        "No migration directories were found."
      );

      fs.mkdirSync(brokenMigrationDir, { recursive: true });
      expect(() => validateMigrationFiles(tmpDir)).toThrow(
        /Migration 20260101000000_broken_migration has no non-empty migration\.sql file\./
      );

      fs.writeFileSync(
        path.join(brokenMigrationDir, "migration.sql"),
        "   \n  \t\n"
      );
      expect(() => validateMigrationFiles(tmpDir)).toThrow(
        /Migration 20260101000000_broken_migration has no non-empty migration\.sql file\./
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("fails drift check with diagnostic error when documentation misses a migration folder", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doc-drift-test-"));
    const tempMigrationsDir = path.join(tmpDir, "migrations");
    const tempDocFile = path.join(tmpDir, "DATABASE_MIGRATIONS.md");

    try {
      const mig1 = path.join(
        tempMigrationsDir,
        "20260101000000_first_migration"
      );
      const mig2 = path.join(
        tempMigrationsDir,
        "20260201000000_second_migration"
      );
      fs.mkdirSync(mig1, { recursive: true });
      fs.mkdirSync(mig2, { recursive: true });
      fs.writeFileSync(path.join(mig1, "migration.sql"), "-- first");
      fs.writeFileSync(path.join(mig2, "migration.sql"), "-- second");

      fs.writeFileSync(
        tempDocFile,
        "# Migrations\n- `20260101000000_first_migration`\n"
      );

      expect(() =>
        validateDocMigrations(tempDocFile, tempMigrationsDir)
      ).toThrowError(/Documentation drift detected/);
      expect(() =>
        validateDocMigrations(tempDocFile, tempMigrationsDir)
      ).toThrowError(
        /Missing in documentation: 20260201000000_second_migration/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("fails drift check with diagnostic error when documentation has mismatched or extra migrations", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "doc-drift-extra-test-")
    );
    const tempMigrationsDir = path.join(tmpDir, "migrations");
    const tempDocFile = path.join(tmpDir, "DATABASE_MIGRATIONS.md");

    try {
      const mig1 = path.join(
        tempMigrationsDir,
        "20260101000000_first_migration"
      );
      fs.mkdirSync(mig1, { recursive: true });
      fs.writeFileSync(path.join(mig1, "migration.sql"), "-- first");

      fs.writeFileSync(
        tempDocFile,
        "# Migrations\n- `20260101000000_first_migration`\n- `20260909000000_obsolete_migration`\n"
      );

      expect(() =>
        validateDocMigrations(tempDocFile, tempMigrationsDir)
      ).toThrowError(
        /Extra\/mismatched in documentation: 20260909000000_obsolete_migration/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects a datasource with no literal provider", () => {
    expect(() =>
      getSchemaProvider('datasource db { url = env("DATABASE_URL") }')
    ).toThrow("Could not read the datasource provider");
  });

  it("executes unified migration validator cleanly across current codebase", () => {
    expect(() => runUnifiedMigrationCheck()).not.toThrow();
  });

  it("detects destructive migrations when present and respects override flag", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-test-"));
    const migrationDir = path.join(tmpDir, "20260901_drop_test");

    try {
      fs.mkdirSync(migrationDir, { recursive: true });
      fs.writeFileSync(
        path.join(migrationDir, "migration.sql"),
        'ALTER TABLE "CaseStudy" DROP COLUMN "title";'
      );

      expect(() => checkDestructiveMigrations(tmpDir, false)).toThrow(
        "Destructive migrations are blocked"
      );
      expect(() => checkDestructiveMigrations(tmpDir, true)).not.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("validates that DATABASE_MIGRATIONS.md contains all required operational commands and environment variables", () => {
    expect(() => validateDocCommands(docPath)).not.toThrow();
  });

  it("validates the production migration guard in scripts/build.js", () => {
    expect(() =>
      validateProductionMigrationGuard(resolve(rootDir, "scripts/build.js"))
    ).not.toThrow();
  });

  it("rejects a build script without the Vercel production guard", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-guard-test-"));
    const buildFile = path.join(tmpDir, "build.js");

    try {
      fs.writeFileSync(
        buildFile,
        'const migrationUrl = process.env.DATABASE_URL_UNPOOLED; runStep("npx", ["prisma", "migrate", "deploy"]);'
      );
      expect(() => validateProductionMigrationGuard(buildFile)).toThrow(
        /Vercel production environment guard/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("fails validateDocCommands when mandatory operational commands are omitted from documentation", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "doc-cmd-test-"));
    const docFile = path.join(tmpDir, "DATABASE_MIGRATIONS.md");

    try {
      // Documentation missing guarded Vercel execution and drift verification
      fs.writeFileSync(
        docFile,
        "# Migrations\nRun `npm run check:migrations` and set `ALLOW_DESTRUCTIVE_MIGRATIONS=true`.\n"
      );

      expect(() => validateDocCommands(docFile)).toThrow(
        /Documentation completeness check failed/
      );
      expect(() => validateDocCommands(docFile)).toThrow(
        /schema drift verification/
      );
      expect(() => validateDocCommands(docFile)).toThrow(
        /guarded Vercel production migration execution/
      );
      expect(() => validateDocCommands(docFile)).toThrow(
        /disposable migration replay/
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
