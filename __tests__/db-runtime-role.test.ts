// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolveRuntimeDatabaseUrl } from "@/lib/db";

// #3036: the running site connects as the least-privilege app_runtime role
// when APP_DATABASE_URL is set, and falls back to the owner's DATABASE_URL.
describe("runtime database role selection", () => {
  it("prefers the least-privilege runtime connection", () => {
    expect(
      resolveRuntimeDatabaseUrl({
        APP_DATABASE_URL: "postgresql://app_runtime@host/db",
        DATABASE_URL: "postgresql://neondb_owner@host/db",
      })
    ).toBe("postgresql://app_runtime@host/db");
  });

  it("falls back to DATABASE_URL when the runtime role is not configured", () => {
    expect(
      resolveRuntimeDatabaseUrl({
        APP_DATABASE_URL: "",
        DATABASE_URL: "postgresql://neondb_owner@host/db",
      })
    ).toBe("postgresql://neondb_owner@host/db");
    expect(resolveRuntimeDatabaseUrl({})).toBeUndefined();
  });
});
