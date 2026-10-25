// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkMigrationSafety,
  findDestructiveStatements,
  formatReport,
  splitStatements,
} from "../scripts/check-migration-safety";

const kinds = (sql: string) =>
  findDestructiveStatements("m.sql", sql).map(({ kind }) => kind);

describe("check-migration-safety (#2537)", () => {
  it.each([
    ["drop-table", 'DROP TABLE "Legacy";'],
    ["drop-column", 'ALTER TABLE "User" DROP COLUMN "nickname";'],
    ["rename", 'ALTER TABLE "User" RENAME COLUMN "name" TO "fullName";'],
    ["rename", 'ALTER TABLE "User" RENAME TO "Account";'],
    ["set-not-null", 'ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;'],
    [
      "add-required-column",
      'ALTER TABLE "User" ADD COLUMN "tier" TEXT NOT NULL;',
    ],
    [
      "alter-type",
      'ALTER TABLE "User" ALTER COLUMN "age" SET DATA TYPE BIGINT;',
    ],
    [
      "alter-type",
      'ALTER TABLE "S" ALTER COLUMN "reason" TYPE "Reason" USING ("reason"::text::"Reason");',
    ],
  ])("flags %s", (kind, sql) => {
    expect(kinds(sql)).toEqual([kind]);
  });

  it.each([
    [
      "a new table",
      'CREATE TABLE "Post" ("id" TEXT NOT NULL, CONSTRAINT "Post_pkey" PRIMARY KEY ("id"));',
    ],
    ["a nullable column", 'ALTER TABLE "User" ADD COLUMN "bio" TEXT;'],
    [
      "a required column with a default",
      'ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;',
    ],
    [
      "an index change",
      'DROP INDEX "a_idx";\nCREATE INDEX "b_idx" ON "T"("x");',
    ],
    ["an index rename", 'ALTER INDEX "a_idx" RENAME TO "b_idx";'],
    [
      "a foreign key",
      'ALTER TABLE "R" ADD CONSTRAINT "R_fk" FOREIGN KEY ("p") REFERENCES "P"("id") ON DELETE CASCADE;',
    ],
  ])("treats %s as additive", (_label, sql) => {
    expect(kinds(sql)).toEqual([]);
  });

  it("ignores keywords in comments and string literals", () => {
    const sql = [
      "/*",
      "  Warnings:",
      "  - You are about to DROP COLUMN `x`. All the data will be lost.",
      "*/",
      "-- DROP TABLE in a comment",
      "DO $$",
      "BEGIN",
      "  RAISE EXCEPTION 'cannot DROP TABLE; fix rows first';",
      "END $$;",
    ].join("\n");
    expect(kinds(sql)).toEqual([]);
  });

  it("keeps a dollar-quoted body in one statement and still checks it", () => {
    const sql = 'DO $body$ BEGIN DROP TABLE "T"; END $body$;\nSELECT 1;';
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(2);
    expect(findDestructiveStatements("m.sql", sql)).toMatchObject([
      { kind: "drop-table", line: 1 },
    ]);
  });

  it("reports each statement's first line", () => {
    const sql =
      '-- AddColumn\nALTER TABLE "A" ADD COLUMN "b" TEXT;\n\n-- Drop\nALTER TABLE "A"\n  DROP COLUMN "c";';
    expect(findDestructiveStatements("m.sql", sql)).toEqual([
      {
        file: "m.sql",
        line: 5,
        kind: "drop-column",
        statement: 'ALTER TABLE "A"\n  DROP COLUMN "c";',
      },
    ]);
  });

  it("checks only the migrations added between the two commits", () => {
    const files: Record<string, string> = {
      "prisma/migrations/2_add/migration.sql":
        'ALTER TABLE "A" ADD COLUMN "b" TEXT;',
      "prisma/migrations/3_drop/migration.sql": 'DROP TABLE "Old";',
    };
    const report = checkMigrationSafety(
      "live",
      "candidate",
      (sha, file) => {
        expect(sha).toBe("candidate");
        return files[file];
      },
      () => Object.keys(files).reverse()
    );
    expect(report.added).toEqual(Object.keys(files));
    expect(report.destructive).toMatchObject([
      { file: "prisma/migrations/3_drop/migration.sql", kind: "drop-table" },
    ]);
    expect(formatReport(report)).toContain(
      "prisma/migrations/3_drop/migration.sql:1 drop-table"
    );
  });

  it("summarizes an additive range and an empty one", () => {
    expect(
      formatReport({
        from: "aaaaaaaaa",
        to: "bbbbbbbbb",
        added: [],
        destructive: [],
      })
    ).toBe("No migrations added in aaaaaaaa..bbbbbbbb.");
    expect(
      formatReport({
        from: "a",
        to: "b",
        added: ["prisma/migrations/x/migration.sql"],
        destructive: [],
      })
    ).toMatch(/All are additive\.$/);
  });

  it("runs over the repository's own migrations without crashing", () => {
    const dir = path.join(process.cwd(), "prisma/migrations");
    const migrations = fs
      .readdirSync(dir)
      .filter((name) => fs.existsSync(path.join(dir, name, "migration.sql")));
    expect(migrations.length).toBeGreaterThan(0);
    const findings = migrations.flatMap((name) =>
      findDestructiveStatements(
        name,
        fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8")
      )
    );
    // The email-contract migration casts two columns to enums; nothing drops.
    expect(new Set(findings.map(({ kind }) => kind))).not.toContain(
      "drop-table"
    );
  });

  it("is read-only and never reaches a database", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "scripts/check-migration-safety.ts"),
      "utf8"
    );
    expect(source).not.toMatch(
      /@prisma|prisma\s+migrate"|DATABASE_URL|writeFile/
    );
  });

  const exitStatus = (args: string[]) => {
    try {
      execFileSync(
        "npx",
        ["tsx", "scripts/check-migration-safety.ts", ...args],
        {
          cwd: process.cwd(),
          env: { ...process.env, VITEST: undefined },
          stdio: "pipe",
        }
      );
      return 0;
    } catch (error) {
      return (error as { status: number }).status;
    }
  };

  it("exits 2 with usage when a commit is missing", () => {
    expect(exitStatus([])).toBe(2);
  });

  it("exits 2, not 1, when git cannot resolve a commit", () => {
    expect(exitStatus(["not-a-commit", "HEAD"])).toBe(2);
  });
});
