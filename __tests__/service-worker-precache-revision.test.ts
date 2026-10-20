// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression cover for the stale app shell defect (#721).
 *
 * `app/sw.ts` precached ten HTML routes with `revision: null`. In Workbox
 * derived precaching that does not mean "unversioned" -- it means "this URL
 * is already self-versioned", so `createCacheKey` uses the bare URL as the
 * cache key. That key is identical on every deployment, and
 * `Serwist.handleActivate` only deletes entries whose key is missing from the
 * current manifest, so the entry was never refreshed and never evicted. Those
 * documents were fetched once, on first install, and served from cache
 * indefinitely, embedding `/_next/static/chunks/<buildId>/...` scripts that
 * stop existing after the next deployment.
 */
describe("Service Worker Precache Revisioning", () => {
  const swSource = fs.readFileSync(
    path.resolve(process.cwd(), "app/sw.ts"),
    "utf-8"
  );

  /**
   * Comments in this file discuss `revision: null` at length, so assertions
   * about what the worker *does* have to read the code alone.
   */
  const swCode = swSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("does not precache any entry with a null revision", () => {
    expect(swCode).not.toMatch(/revision:\s*null/);
  });

  it("revisions the app shell routes with a per-build fingerprint", () => {
    expect(swCode).toMatch(/revision:\s*buildRevision/);
    // The fingerprint must derive from the injected manifest, which is the
    // only per-build input available to the worker without extra plumbing.
    expect(swCode).toMatch(/JSON\.stringify\(injectedManifest\)/);
  });

  it("serves the offline shell only when the browser reports no connectivity", () => {
    const fallbackMatcher = swCode.slice(swCode.indexOf("fallbacks:"));
    expect(fallbackMatcher).toMatch(/navigator\.onLine/);
  });

  it("precaches the shared public route registry, not a private copy", () => {
    // The route list moved to lib/public-routes.ts in c0b17b46, which widened
    // precaching from ten shells to the whole public surface. This fix changes
    // how those entries are revisioned, not which routes are covered.
    expect(swCode).toMatch(/PUBLIC_ROUTE_PATHS\.map/);
    expect(swCode).not.toMatch(/const coreAppShellRoutes/);
  });
});

/**
 * The fingerprint only works if it actually changes between builds. This
 * exercises the same expression the worker uses, rather than asserting on its
 * text.
 */
describe("Build Fingerprint Derivation", () => {
  const fingerprint = (manifest: unknown) => {
    const serialized = JSON.stringify(manifest);
    let hash = 5381;
    for (let i = 0; i < serialized.length; i++) {
      hash = ((hash << 5) + hash + serialized.charCodeAt(i)) | 0;
    }
    return (hash >>> 0).toString(36);
  };

  const buildA = [
    { url: "/_next/static/chunks/abc.js", revision: null },
    { url: "/_next/static/css/one.css", revision: null },
  ];

  it("is stable for an identical manifest", () => {
    expect(fingerprint(buildA)).toBe(fingerprint([...buildA]));
  });

  it("changes when any precached asset changes", () => {
    const buildB = [
      { url: "/_next/static/chunks/def.js", revision: null },
      { url: "/_next/static/css/one.css", revision: null },
    ];
    expect(fingerprint(buildA)).not.toBe(fingerprint(buildB));
  });

  it("changes when an asset is added", () => {
    const buildC = [
      ...buildA,
      { url: "/_next/static/chunks/new.js", revision: null },
    ];
    expect(fingerprint(buildA)).not.toBe(fingerprint(buildC));
  });

  it("produces a url-safe token", () => {
    expect(fingerprint(buildA)).toMatch(/^[a-z0-9]+$/);
  });
});
