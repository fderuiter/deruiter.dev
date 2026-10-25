// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/version/route";
import { buildTimestamp } from "@/lib/env";
import { VersionResponseSchema } from "@/lib/schemas";

const KEYS = [
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_ENV",
  "BUILD_TIMESTAMP",
] as const;
const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

const request = () => new NextRequest("http://localhost/api/version");

describe("GET /api/version (#2534)", () => {
  it("reports the deployment's commit, branch, environment and build time", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA =
      "0965d756fba0abdb41bea2d3e55b60192201a200";
    process.env.VERCEL_GIT_COMMIT_REF = "main";
    process.env.VERCEL_ENV = "production";
    process.env.BUILD_TIMESTAMP = "2026-10-25T06:00:00.000Z";

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(VersionResponseSchema.parse(await response.json())).toEqual({
      sha: "0965d756fba0abdb41bea2d3e55b60192201a200",
      ref: "main",
      env: "production",
      builtAt: "2026-10-25T06:00:00.000Z",
    });
  });

  it("falls back to unknown and nulls outside a Vercel build", async () => {
    for (const key of KEYS) delete process.env[key];

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sha: "unknown",
      ref: null,
      env: null,
      builtAt: null,
    });
  });

  it("returns exactly the four public fields and nothing else from the environment", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "abc";
    const body = await (await GET(request())).json();
    expect(Object.keys(body).sort()).toEqual([
      "builtAt",
      "env",
      "ref",
      "sha",
    ]);
  });

  it("reads the build time through the literal Next inlines", () => {
    process.env.BUILD_TIMESTAMP = "2026-10-25T00:00:00.000Z";
    expect(buildTimestamp()).toBe("2026-10-25T00:00:00.000Z");
    const config = fs.readFileSync(
      path.join(process.cwd(), "next.config.ts"),
      "utf8"
    );
    expect(config).toMatch(/BUILD_TIMESTAMP: new Date\(\)\.toISOString\(\)/);
  });

  it("touches no database or cache", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/api/version/route.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/prisma|redis|@\/lib\/db|ratelimit/i);
  });
});
