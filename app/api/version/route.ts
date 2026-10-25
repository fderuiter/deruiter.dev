import { NextResponse } from "next/server";
import { buildTimestamp, getEnv } from "@/lib/env";
import { createApiHandler } from "@/lib/route-wrapper";
import { VersionResponseSchema, type VersionResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Reports which commit the serving deployment was built from, so the release
 * train can tell what is live without a Vercel token (#2534). Every field is
 * public build metadata. It touches no database or cache, and as a GET it
 * bypasses the rate limiter (AGENTS.md §22).
 */
export const GET = createApiHandler(
  async () => {
    const env = getEnv();
    const body: VersionResponse = VersionResponseSchema.parse({
      sha: env.VERCEL_GIT_COMMIT_SHA || "unknown",
      ref: env.VERCEL_GIT_COMMIT_REF || null,
      env: env.VERCEL_ENV || null,
      builtAt: buildTimestamp(),
    });
    return NextResponse.json(body, {
      headers: { "Cache-Control": "no-store" },
    });
  },
  { auth: "public" }
);
