// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The workflow runs a Postgres service container published on a host port.
 * Steps that deliberately run *without* a database use a placeholder DSN, and
 * that placeholder must not land on the service's port.
 *
 * lib/db.ts drives @neondatabase/serverless over a WebSocket. Aimed at the
 * Postgres container it sends an HTTP upgrade request to a server speaking the
 * Postgres wire protocol, receives no HTTP response, and waits with no
 * handshake timeout. The build step hung for over ninety minutes this way,
 * which is invisible locally because nothing listens on 5432 there and the
 * connection is refused immediately.
 */
describe("CI Service Container Isolation", () => {
  const workflowDir = path.join(process.cwd(), ".github/workflows");
  const ciPath = path.join(workflowDir, "ci.yml");
  const ci = fs.readFileSync(ciPath, "utf8");

  /** Host ports published by service containers, from `- <host>:<container>`. */
  const servicePorts = [...ci.matchAll(/^\s*-\s*"?(\d+):(\d+)"?\s*$/gm)].map(
    (m) => Number(m[1])
  );

  /** Placeholder DSNs: the ones that name a throwaway credential. */
  const placeholderDsns = [
    ...ci.matchAll(/DATABASE_URL:\s*"([^"]*dummy[^"]*)"/g),
  ].map((m) => m[1]);

  it("publishes at least one service container port", () => {
    expect(servicePorts.length).toBeGreaterThan(0);
    expect(servicePorts).toContain(5432);
  });

  it("declares placeholder database URLs for database-free steps", () => {
    expect(placeholderDsns.length).toBeGreaterThan(0);
  });

  it.each(placeholderDsns)(
    "placeholder DSN %s does not target a live service container port",
    (dsn) => {
      const port = Number(new URL(dsn).port);
      expect(Number.isNaN(port)).toBe(false);
      expect(servicePorts).not.toContain(port);
    }
  );

  /**
   * Steps split into two kinds. The Prisma CLI (`migrate deploy`, `migrate
   * diff`) talks to Postgres through the native migration engine and needs the
   * service container. Everything else reaches the database through lib/db.ts,
   * which is @neondatabase/serverless over a WebSocket and cannot speak to a
   * plain Postgres server at all. Handing the service DSN to one of those steps
   * is what made 25 unit tests bypass their `@/lib/db` mock and assert against
   * a database they could never reach.
   */
  const steps = ci
    .split(/^ {6}- name: /m)
    .slice(1)
    .map((block) => ({
      name: block.split("\n")[0].trim(),
      body: block,
    }));

  const MIGRATION_ENGINE_STEPS =
    /prisma migrate|migration:replay|migrations:drift/;

  const runtimeStepsWithServiceDsn = steps.filter((step) => {
    const dsn = step.body.match(/DATABASE_URL:\s*"?([^"\n]+)"?/)?.[1];
    if (!dsn || MIGRATION_ENGINE_STEPS.test(step.body)) return false;
    return servicePorts.includes(Number(new URL(dsn).port));
  });

  it("keeps the service container DSN away from steps that run application code", () => {
    expect(runtimeStepsWithServiceDsn.map((step) => step.name)).toEqual([]);
  });

  /**
   * Clerk is scoped to the admin area (see proxy.ts and
   * __tests__/proxy-clerk-scope.test.ts), so no CI step needs a Clerk key to
   * boot the production server. Placeholder keys are worse than none: the
   * published example key is format-valid but resolves to no live instance,
   * so Clerk's handshake answers `host_invalid` and the middleware returns
   * that JSON as the page body -- which reads as a content failure, not a
   * credential one. It cost a full CI cycle to trace.
   */
  it("does not hand the workflow placeholder Clerk credentials", () => {
    expect(ci).not.toMatch(
      /CLERK_SECRET_KEY|NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/
    );
  });

  it("bounds every job so a hang fails fast instead of running to the 6h default", () => {
    const jobsBlock = ci.slice(ci.indexOf("\njobs:"));
    const runsOn = (jobsBlock.match(/^\s{4}runs-on:/gm) ?? []).length;
    const timeouts = (jobsBlock.match(/^\s{4}timeout-minutes:/gm) ?? []).length;

    expect(runsOn).toBeGreaterThan(0);
    expect(timeouts).toBe(runsOn);
  });
});
