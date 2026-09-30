import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkPublicRouteRegistryDrift,
  routeExistsOnDisk,
} from "../lib/dx/doctor";
import {
  checkDrift,
  formatDriftRemedy,
  type DriftCheckDependencies,
} from "../scripts/check-drift";

const temporaryDirectories: string[] = [];

function createFixtureWorkspace(): {
  root: string;
  appDir: string;
  libDir: string;
  publicRoutesPath: string;
} {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "public-route-drift-test-")
  );
  temporaryDirectories.push(root);

  const appDir = path.join(root, "app");
  const libDir = path.join(root, "lib");
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(libDir, { recursive: true });

  // Create sample app pages
  fs.writeFileSync(
    path.join(appDir, "page.tsx"),
    "export default function Page() { return null; }"
  );

  const arcadeDir = path.join(appDir, "arcade");
  fs.mkdirSync(arcadeDir, { recursive: true });
  fs.writeFileSync(
    path.join(arcadeDir, "page.tsx"),
    "export default function Page() { return null; }"
  );

  const trialGameDir = path.join(arcadeDir, "trial-and-error");
  fs.mkdirSync(trialGameDir, { recursive: true });
  fs.writeFileSync(
    path.join(trialGameDir, "page.tsx"),
    "export default function Page() { return null; }"
  );

  // Dynamic route app/case-studies/[slug]/page.tsx
  const csSlugDir = path.join(appDir, "case-studies", "[slug]");
  fs.mkdirSync(csSlugDir, { recursive: true });
  fs.writeFileSync(
    path.join(csSlugDir, "page.tsx"),
    "export default function Page() { return null; }"
  );

  // Admin route (should be excluded)
  const adminDir = path.join(appDir, "admin");
  fs.mkdirSync(adminDir, { recursive: true });
  fs.writeFileSync(
    path.join(adminDir, "page.tsx"),
    "export default function Page() { return null; }"
  );

  // API route (should be excluded)
  const apiDir = path.join(appDir, "api", "telemetry");
  fs.mkdirSync(apiDir, { recursive: true });
  fs.writeFileSync(
    path.join(apiDir, "route.ts"),
    "export async function GET() {}"
  );

  const publicRoutesContent = `export interface PublicRouteDefinition {
  path: string;
  name: string;
  category: "top-level" | "case-study" | "arcade" | "tool";
}

export const PUBLIC_ROUTE_REGISTRY = [
  { path: "/", name: "Homepage", category: "top-level" },
  { path: "/arcade", name: "Arcade Hub", category: "top-level" },
  { path: "/arcade/trial-and-error", name: "Game: Trial & Error", category: "arcade" },
  { path: "/case-studies/clinical-data-mapper", name: "CS: Clinical Data Mapper", category: "case-study" },
] as const satisfies readonly PublicRouteDefinition[];
`;

  const publicRoutesPath = path.join(libDir, "public-routes.ts");
  fs.writeFileSync(publicRoutesPath, publicRoutesContent, "utf-8");

  return { root, appDir, libDir, publicRoutesPath };
}

function passingDependencies(): DriftCheckDependencies {
  return {
    checkDocumentation: () => ({ status: "pass", details: [] }),
    checkOpenApi: () => ({ missingRoutes: [], hasDrift: false }),
    checkOnboarding: () => ({ status: "pass" }),
    checkTopology: () => ({ status: "pass" }),
    checkMarkdownLinks: () => ({ status: "pass", details: [] }),
    checkPublicRoutes: () => ({ status: "pass", details: [] }),
    checkTechnicalGuides: () => ({ status: "pass", details: [] }),
    checkLlmsManifests: () => ({ status: "pass", details: [] }),
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("routeExistsOnDisk helper", () => {
  it("resolves static pages, dynamic parameter routes, and rejects missing paths", () => {
    const { appDir } = createFixtureWorkspace();

    expect(routeExistsOnDisk("/", appDir)).toBe(true);
    expect(routeExistsOnDisk("/arcade", appDir)).toBe(true);
    expect(routeExistsOnDisk("/arcade/trial-and-error", appDir)).toBe(true);
    expect(
      routeExistsOnDisk("/case-studies/clinical-data-mapper", appDir)
    ).toBe(true);
    expect(
      routeExistsOnDisk("/case-studies/nonexistent-case-study", appDir)
    ).toBe(false);
    expect(routeExistsOnDisk("/arcade/nonexistent", appDir)).toBe(false);
    expect(routeExistsOnDisk("/nonexistent-page", appDir)).toBe(false);
  });
});

describe("checkPublicRouteRegistryDrift diagnostic check", () => {
  it("passes when all static app pages are registered and no stale entries exist", () => {
    const { root } = createFixtureWorkspace();
    const result = checkPublicRouteRegistryDrift(root, false);

    expect(result.status).toBe("pass");
    expect(result.id).toBe("routes-public-registry-drift");
    expect(result.category).toBe("routes");
  });

  it("detects unregistered public page routes under app/", () => {
    const { root, appDir } = createFixtureWorkspace();

    // Create a new unindexed page: app/arcade/cyber-dash/page.tsx
    const newGameDir = path.join(appDir, "arcade", "cyber-dash");
    fs.mkdirSync(newGameDir, { recursive: true });
    fs.writeFileSync(
      path.join(newGameDir, "page.tsx"),
      "export default function Page() { return null; }"
    );

    const result = checkPublicRouteRegistryDrift(root, false);

    expect(result.status).toBe("fail");
    expect(result.message).toContain("1 unregistered page(s)");
    expect(result.details).toContain(
      "Unregistered public page route: /arcade/cyber-dash (found in app/)"
    );
  });

  it("detects stale route entries in PUBLIC_ROUTE_REGISTRY pointing to missing page files", () => {
    const { root, publicRoutesPath } = createFixtureWorkspace();

    // Add a stale route to public-routes.ts
    const content = fs.readFileSync(publicRoutesPath, "utf-8");
    const staleContent = content.replace(
      '  { path: "/arcade", name: "Arcade Hub", category: "top-level" },',
      '  { path: "/arcade", name: "Arcade Hub", category: "top-level" },\n  { path: "/arcade/stale-game", name: "Stale Game", category: "arcade" },'
    );
    fs.writeFileSync(publicRoutesPath, staleContent, "utf-8");

    const result = checkPublicRouteRegistryDrift(root, false);

    expect(result.status).toBe("fail");
    expect(result.message).toContain("1 stale entry/entries");
    expect(result.details).toContain(
      "Stale route entry in PUBLIC_ROUTE_REGISTRY: /arcade/stale-game (no matching page file on disk)"
    );
  });

  it("auto-registers missing routes and removes stale routes when fix = true", () => {
    const { root, appDir, publicRoutesPath } = createFixtureWorkspace();

    // 1. Add missing page file
    const newGameDir = path.join(appDir, "arcade", "cyber-dash");
    fs.mkdirSync(newGameDir, { recursive: true });
    fs.writeFileSync(
      path.join(newGameDir, "page.tsx"),
      "export default function Page() { return null; }"
    );

    // 2. Add stale route entry
    const content = fs.readFileSync(publicRoutesPath, "utf-8");
    const staleContent = content.replace(
      '  { path: "/arcade", name: "Arcade Hub", category: "top-level" },',
      '  { path: "/arcade", name: "Arcade Hub", category: "top-level" },\n  { path: "/arcade/stale-game", name: "Stale Game", category: "arcade" },'
    );
    fs.writeFileSync(publicRoutesPath, staleContent, "utf-8");

    // Execute fix
    const fixResult = checkPublicRouteRegistryDrift(root, true);

    expect(fixResult.status).toBe("fixed");
    expect(fixResult.message).toContain(
      "Auto-remediated public route registry drift"
    );

    const updatedContent = fs.readFileSync(publicRoutesPath, "utf-8");
    expect(updatedContent).toContain('path: "/arcade/cyber-dash"');
    expect(updatedContent).not.toContain('path: "/arcade/stale-game"');

    // Confirm subsequent check passes cleanly
    const recheckResult = checkPublicRouteRegistryDrift(root, false);
    expect(recheckResult.status).toBe("pass");
  });
});

describe("scripts/check-drift.ts integration with public routes", () => {
  it("reports public route drift with category public-routes and failing exit code", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const dependencies = passingDependencies();
    dependencies.checkPublicRoutes = () => ({
      status: "fail",
      details: [
        "Unregistered public page route: /arcade/cyber-dash (found in app/)",
      ],
    });

    const exitCode = checkDrift("/workspace", dependencies);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Unregistered public page route: /arcade/cyber-dash (found in app/)"
      )
    );

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("formats actionable copy-paste remedy for public-routes category", () => {
    const remedy = formatDriftRemedy(["public-routes"]);

    expect(remedy).toContain("Public route registry drift");
    expect(remedy).toContain("npm run doctor:fix");
    expect(remedy).toContain("git add lib/public-routes.ts");
  });
});
