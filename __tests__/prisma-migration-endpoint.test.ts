// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Migrations must not run through Neon's pooled endpoint. Prisma holds an
 * advisory lock for the duration of `migrate deploy`, and PgBouncer in
 * transaction mode does not carry session state across statements, so the lock
 * can be lost or the DDL can deadlock.
 *
 * This is a source-level assertion rather than a behavioural one because
 * prisma.config.ts loads dotenv at import time, which would read the developer's
 * real .env.local into the test process.
 */
describe("prisma migration datasource precedence", () => {
  const source = readFileSync(join(process.cwd(), "prisma.config.ts"), "utf-8");

  function indexOfVar(name: string): number {
    const i = source.indexOf(`process.env["${name}"]`);
    expect(i, `${name} should appear in the datasource chain`).toBeGreaterThan(
      -1
    );
    return i;
  }

  it("prefers the unpooled endpoint over the pooled one", () => {
    expect(indexOfVar("DATABASE_URL_UNPOOLED")).toBeLessThan(
      indexOfVar("DATABASE_URL")
    );
  });

  it("still lets an explicit DIRECT_URL win, which is what CI sets", () => {
    // scripts/build.js sets DIRECT_URL from DATABASE_URL_UNPOOLED on Vercel
    // production builds, and migration replays set it explicitly.
    expect(indexOfVar("DIRECT_URL")).toBeLessThan(
      indexOfVar("DATABASE_URL_UNPOOLED")
    );
  });

  it("keeps disposable and replay databases ahead of everything else", () => {
    expect(indexOfVar("MIGRATION_REPLAY_URL")).toBeLessThan(
      indexOfVar("DIRECT_URL")
    );
    expect(indexOfVar("DISPOSABLE_DATABASE_URL")).toBeLessThan(
      indexOfVar("DIRECT_URL")
    );
  });

  it("retains the pooled endpoint only as a last resort", () => {
    const names = [
      "MIGRATION_REPLAY_URL",
      "DISPOSABLE_DATABASE_URL",
      "DIRECT_URL",
      "DATABASE_URL_UNPOOLED",
      "DATABASE_URL",
    ];
    const positions = names.map(indexOfVar);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(Math.max(...positions)).toBe(indexOfVar("DATABASE_URL"));
  });
});
