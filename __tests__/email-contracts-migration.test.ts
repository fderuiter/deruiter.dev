// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Email and Suppression State Contracts (Ticket #631)", () => {
  const root = process.cwd();
  const schemaPath = resolve(root, "prisma/schema.prisma");
  const migrationDir = resolve(
    root,
    "prisma/migrations/20261016000000_enforce_email_contracts"
  );
  const migrationSqlPath = resolve(migrationDir, "migration.sql");

  it("declares SuppressionReason and OutboundEmailStatus enums in schema.prisma", () => {
    const schema = readFileSync(schemaPath, "utf8");

    expect(schema).toMatch(
      /enum\s+SuppressionReason\s*\{[\s\S]*?BOUNCE[\s\S]*?COMPLAINT[\s\S]*?UNSUBSCRIBE[\s\S]*?\}/
    );
    expect(schema).toMatch(
      /enum\s+OutboundEmailStatus\s*\{[\s\S]*?PENDING[\s\S]*?RETRYING[\s\S]*?DELIVERED[\s\S]*?FAILED[\s\S]*?\}/
    );

    // SuppressionList model uses the enum
    expect(schema).toMatch(
      /model\s+SuppressionList\s*\{[\s\S]*?reason\s+SuppressionReason[\s\S]*?\}/
    );
    // OutboundEmailQueue model uses the enum
    expect(schema).toMatch(
      /model\s+OutboundEmailQueue\s*\{[\s\S]*?status\s+OutboundEmailStatus[\s\S]*?\}/
    );
  });

  it("removes redundant duplicate index on SuppressionList(email)", () => {
    const schema = readFileSync(schemaPath, "utf8");
    const suppressionListModel = schema.match(
      /model\s+SuppressionList\s*\{([\s\S]*?)\}/
    );

    expect(suppressionListModel).not.toBeNull();
    const modelBody = suppressionListModel![1];
    expect(modelBody).toMatch(/email\s+String\s+@unique/);
    expect(modelBody).not.toContain("@@index([email])");
  });

  it("provides a forward-only migration SQL file with preflight and safe type casting", () => {
    expect(existsSync(migrationSqlPath)).toBe(true);
    const sql = readFileSync(migrationSqlPath, "utf8");

    // Must include preflight check for incompatible rows
    expect(sql).toContain("Preflight check failed");
    expect(sql).toMatch(/SELECT\s+1\s+FROM\s+"SuppressionList"/i);
    expect(sql).toMatch(/SELECT\s+1\s+FROM\s+"OutboundEmailQueue"/i);

    // Must create enums
    expect(sql).toContain('CREATE TYPE "SuppressionReason" AS ENUM');
    expect(sql).toContain('CREATE TYPE "OutboundEmailStatus" AS ENUM');

    // Must drop redundant index
    expect(sql).toContain('DROP INDEX IF EXISTS "SuppressionList_email_idx"');

    // Must alter columns via USING cast without dropping columns
    expect(sql).toMatch(
      /ALTER\s+COLUMN\s+"reason"\s+TYPE\s+"SuppressionReason"\s+USING/i
    );
    expect(sql).toMatch(
      /ALTER\s+COLUMN\s+"status"\s+TYPE\s+"OutboundEmailStatus"\s+USING/i
    );

    // Zero destructive column or table drops
    expect(sql).not.toMatch(/DROP\s+COLUMN/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
  });

  it("exports matching TypeScript runtime enums from generated client", async () => {
    const { SuppressionReason, OutboundEmailStatus } =
      await import("../app/generated/prisma/enums");

    expect(SuppressionReason).toBeDefined();
    expect(Object.values(SuppressionReason)).toEqual([
      "BOUNCE",
      "COMPLAINT",
      "UNSUBSCRIBE",
    ]);

    expect(OutboundEmailStatus).toBeDefined();
    expect(Object.values(OutboundEmailStatus)).toEqual([
      "PENDING",
      "RETRYING",
      "DELIVERED",
      "FAILED",
    ]);
  });

  it("simulates preflight logic on synthetic legacy and invalid rows", () => {
    const validReasons = new Set(["BOUNCE", "COMPLAINT", "UNSUBSCRIBE"]);
    const validStatuses = new Set([
      "PENDING",
      "RETRYING",
      "DELIVERED",
      "FAILED",
    ]);

    const syntheticSuppressionRows = [
      { id: "1", reason: "BOUNCE" },
      { id: "2", reason: "COMPLAINT" },
      { id: "3", reason: "UNSUBSCRIBE" },
    ];
    const invalidSuppressionRows = [
      ...syntheticSuppressionRows,
      { id: "4", reason: "invalid_reason" },
    ];

    const isSuppressionPreflightClean = (rows: Array<{ reason: string }>) =>
      rows.every((r) => validReasons.has(r.reason));

    expect(isSuppressionPreflightClean(syntheticSuppressionRows)).toBe(true);
    expect(isSuppressionPreflightClean(invalidSuppressionRows)).toBe(false);

    const syntheticQueueRows = [
      { id: "q1", status: "PENDING" },
      { id: "q2", status: "RETRYING" },
      { id: "q3", status: "DELIVERED" },
      { id: "q4", status: "FAILED" },
    ];
    const invalidQueueRows = [
      ...syntheticQueueRows,
      { id: "q5", status: "UNKNOWN_STATUS" },
    ];

    const isQueuePreflightClean = (rows: Array<{ status: string }>) =>
      rows.every((r) => validStatuses.has(r.status));

    expect(isQueuePreflightClean(syntheticQueueRows)).toBe(true);
    expect(isQueuePreflightClean(invalidQueueRows)).toBe(false);
  });
});
