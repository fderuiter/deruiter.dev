import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  checkRouteIndexing,
  checkNavbarHierarchy,
  checkPageTopPadding,
  checkTestPathResolution,
  checkSecretLeaks,
  checkMigrationGuard,
  checkHydrationSafety,
  checkAccessibilityStandards,
  checkDocumentationParity,
  checkDirectoryTopology,
  checkOpenApiParity,
  checkDefectRemediationInvariants,
  checkDesignTokens,
  checkTouchTargetDimensions,
  checkSectionStructures,
  checkServiceResultTypes,
  checkSubRoutePerformance,
  checkSeoSocialIntegrity,
  runDiagnostics,
  printDoctorReport,
} from "@/lib/dx/doctor";

describe("DX Invariant Doctor Engine", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-doctor-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("checkRouteIndexing", () => {
    it("fails when a route page is not registered in CommandPalette.tsx", () => {
      // Setup fake workspace with app/arcade/cyber-dash/page.tsx and un-indexed CommandPalette
      const appArcadeDir = path.join(tempDir, "app", "arcade", "cyber-dash");
      fs.mkdirSync(appArcadeDir, { recursive: true });
      fs.writeFileSync(
        path.join(appArcadeDir, "page.tsx"),
        "export default function Page() { return null; }"
      );

      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "CommandPalette.tsx"),
        'const staticNavs: PaletteItem[] = [\n      { id: "nav-work", url: "/#work" }\n    ];'
      );

      const result = checkRouteIndexing(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("1 route(s) not registered");
      expect(result.details?.[0]).toContain("/arcade/cyber-dash");
    });

    it("auto-fixes missing route registrations when fix=true", () => {
      const appArcadeDir = path.join(tempDir, "app", "arcade", "cyber-dash");
      fs.mkdirSync(appArcadeDir, { recursive: true });
      fs.writeFileSync(
        path.join(appArcadeDir, "page.tsx"),
        "export default function Page() { return null; }"
      );

      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "CommandPalette.tsx"),
        'const staticNavs: PaletteItem[] = [\n      { id: "nav-work", url: "/#work" }\n    ];'
      );

      const fixResult = checkRouteIndexing(tempDir, true);
      expect(fixResult.status).toBe("fixed");

      // Verify file was written
      const updatedPalette = fs.readFileSync(
        path.join(compDir, "CommandPalette.tsx"),
        "utf-8"
      );
      expect(updatedPalette).toContain('url: "/arcade/cyber-dash"');
    });
  });

  describe("checkNavbarHierarchy", () => {
    it("fails if a subpage imports or mounts <Navbar />", () => {
      const appDir = path.join(tempDir, "app", "arcade");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        'import { Navbar } from "@/components/Navbar";\nexport default function Page() { return <Navbar />; }'
      );

      const result = checkNavbarHierarchy(tempDir);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("Secondary <Navbar />");
    });

    it("passes when Navbar is only in app/layout.tsx", () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        'import { Navbar } from "@/components/Navbar";\nexport default function Layout() { return <Navbar />; }'
      );
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        "export default function Page() { return <main>Content</main>; }"
      );

      const result = checkNavbarHierarchy(tempDir);
      expect(result.status).toBe("pass");
    });
  });

  describe("checkTestPathResolution", () => {
    it("fails if tests contain hardcoded root paths", () => {
      const testsDir = path.join(tempDir, "__tests__");
      fs.mkdirSync(testsDir, { recursive: true });
      fs.writeFileSync(
        path.join(testsDir, "bad.test.ts"),
        "const root = " + '"/app/config.json";'
      );

      const result = checkTestPathResolution(tempDir);
      expect(result.status).toBe("fail");
      expect(result.details?.[0]).toContain("bad.test.ts");
    });

    it("passes when tests use process.cwd() or path.resolve", () => {
      const testsDir = path.join(tempDir, "__tests__");
      fs.mkdirSync(testsDir, { recursive: true });
      fs.writeFileSync(
        path.join(testsDir, "good.test.ts"),
        'const root = path.resolve(process.cwd(), "config.json");'
      );

      const result = checkTestPathResolution(tempDir);
      expect(result.status).toBe("pass");
    });
  });

  describe("checkSecretLeaks", () => {
    it("detects secret patterns", () => {
      const secretFile = path.join(tempDir, "leaked.ts");
      fs.writeFileSync(
        secretFile,
        'const key = "' + "ghp_" + '123456789012345678901234567890123456";'
      );

      const result = checkSecretLeaks(tempDir);
      expect(result.status).toBe("fail");
    });

    it("flags secret patterns in scripts/audit-secret-history.ts too (no more file-path special-casing)", () => {
      const scriptsDir = path.join(tempDir, "scripts");
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptsDir, "audit-secret-history.ts"),
        'const fixture = "' + "ghp_" + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01234";'
      );

      const result = checkSecretLeaks(tempDir);
      expect(result.status).toBe("fail");
    });

    it("skips agent worktrees and Stryker sandboxes, which copy the source tree (#964)", () => {
      const leak =
        'const key = "' + "ghp_" + '123456789012345678901234567890123456";';
      for (const dir of [
        path.join(".claude", "worktrees", "agent-x", "lib"),
        path.join(".stryker-tmp", "sandbox-1", "lib"),
      ]) {
        fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
        fs.writeFileSync(path.join(tempDir, dir, "allowlist.ts"), leak);
      }
      expect(checkSecretLeaks(tempDir).status).toBe("pass");

      // The same content in the real tree is still caught.
      fs.writeFileSync(path.join(tempDir, "leaked.ts"), leak);
      expect(checkSecretLeaks(tempDir).status).toBe("fail");
    });

    it("still ignores known-safe placeholder values from .env.example / env-guard.ts", () => {
      fs.writeFileSync(
        path.join(tempDir, ".env.example"),
        'UPSTASH_REDIS_REST_TOKEN="example_dev_token"'
      );

      const result = checkSecretLeaks(tempDir);
      expect(result.status).toBe("pass");
    });
  });

  describe("checkMigrationGuard", () => {
    it("flags destructive DROP COLUMN statement without override", () => {
      const migDir = path.join(
        tempDir,
        "prisma",
        "migrations",
        "20260814_test"
      );
      fs.mkdirSync(migDir, { recursive: true });
      fs.writeFileSync(
        path.join(migDir, "migration.sql"),
        "ALTER TABLE users DROP COLUMN password;"
      );

      const result = checkMigrationGuard(tempDir);
      expect(result.status).toBe("fail");
      expect(result.details?.[0]).toContain("DROP COLUMN");
    });

    it("flags DATABASE_MIGRATIONS.md when missing mandatory release or drift commands", () => {
      const migDir = path.join(
        tempDir,
        "prisma",
        "migrations",
        "20260814000000_init"
      );
      fs.mkdirSync(migDir, { recursive: true });
      fs.writeFileSync(
        path.join(migDir, "migration.sql"),
        "CREATE TABLE users (id INT);"
      );

      // Incomplete documentation without Vercel production migration or drift guidance
      fs.writeFileSync(
        path.join(tempDir, "DATABASE_MIGRATIONS.md"),
        "# Migrations\n- `20260814000000_init`\n\nRun `npm run check:migrations`."
      );

      const result = checkMigrationGuard(tempDir);
      expect(result.status).toBe("fail");
      expect(
        result.details?.some((d) => d.includes("schema drift verification"))
      ).toBe(true);
      expect(
        result.details?.some((d) =>
          d.includes("guarded Vercel production migration")
        )
      ).toBe(true);
    });
  });

  describe("checkPageTopPadding", () => {
    it("flags pages missing header clearance top padding", () => {
      const appDir = path.join(tempDir, "app", "demo");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        "export default function Page() { return <div>No padding</div>; }"
      );

      const result = checkPageTopPadding(tempDir);
      expect(result.status).toBe("warn");
      expect(result.details?.[0]).toContain("demo");
    });

    it("passes when pages include header clearance top padding", () => {
      const appDir = path.join(tempDir, "app", "demo");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        "export default function Page() { return <main className='pt-28'>Content</main>; }"
      );

      const result = checkPageTopPadding(tempDir);
      expect(result.status).toBe("pass");
    });
  });

  describe("checkDocumentationParity", () => {
    it("fails if docs directory is missing", () => {
      const result = checkDocumentationParity(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("docs/ directory does not exist");
    });

    it("passes when docs directory exists without drift", () => {
      const docsDir = path.join(tempDir, "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "README.md"), "# Docs");

      const result = checkDocumentationParity(tempDir, false);
      expect(result.status).toBe("pass");
    });
  });

  describe("checkDirectoryTopology", () => {
    it("fails when ARCHITECTURE.md is missing", () => {
      const result = checkDirectoryTopology(tempDir);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("ARCHITECTURE.md file not found");
    });

    it("fails when a top-level directory is missing from ARCHITECTURE.md topology section", () => {
      fs.writeFileSync(
        path.join(tempDir, "ARCHITECTURE.md"),
        `# Architecture\n\n## System Architecture & Directory Topology\n\n\`\`\`text\napp/\ncomponents/\n\`\`\`\n`
      );
      fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "components"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });

      const result = checkDirectoryTopology(tempDir);
      expect(result.status).toBe("fail");
      expect(result.message).toContain(
        "1 top-level directory/directories missing"
      );
      expect(result.details?.some((d) => d.includes("scripts/"))).toBe(true);
    });

    it("passes when all top-level repository directories are documented in ARCHITECTURE.md", () => {
      fs.writeFileSync(
        path.join(tempDir, "ARCHITECTURE.md"),
        `# Architecture\n\n## System Architecture & Directory Topology\n\n\`\`\`text\napp/\ncomponents/\nscripts/\n\`\`\`\n`
      );
      fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "components"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "scripts"), { recursive: true });

      const result = checkDirectoryTopology(tempDir);
      expect(result.status).toBe("pass");
      expect(result.message).toContain(
        "All top-level repository directories are explicitly documented"
      );
    });
  });

  describe("checkOpenApiParity", () => {
    it("warns if openapi.json or generator script is missing", () => {
      const result = checkOpenApiParity(tempDir, false);
      expect(result.status).toBe("warn");
      expect(result.message).toContain("not found");
    });

    it("fails when an app/api route is missing from openapi.json", () => {
      const apiDir = path.join(tempDir, "app", "api", "metrics");
      fs.mkdirSync(apiDir, { recursive: true });
      fs.writeFileSync(
        path.join(apiDir, "route.ts"),
        "export async function GET() { return null; }"
      );

      const scriptsDir = path.join(tempDir, "scripts");
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptsDir, "generate-openapi.ts"),
        "// generator"
      );

      fs.writeFileSync(
        path.join(tempDir, "openapi.json"),
        JSON.stringify({ openapi: "3.0.0", paths: { "/api/other": {} } })
      );

      const result = checkOpenApiParity(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("1 route(s) missing from openapi.json");
      expect(result.details?.[0]).toContain("/api/metrics");
    });

    it("passes when all app/api routes are documented in openapi.json", () => {
      const apiDir = path.join(tempDir, "app", "api", "telemetry");
      fs.mkdirSync(apiDir, { recursive: true });
      fs.writeFileSync(
        path.join(apiDir, "route.ts"),
        "export async function GET() { return null; }"
      );

      const scriptsDir = path.join(tempDir, "scripts");
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptsDir, "generate-openapi.ts"),
        "// generator"
      );

      fs.writeFileSync(
        path.join(tempDir, "openapi.json"),
        JSON.stringify({ openapi: "3.0.0", paths: { "/api/telemetry": {} } })
      );

      const result = checkOpenApiParity(tempDir, false);
      expect(result.status).toBe("pass");
      expect(result.message).toContain("All app/api routes are documented");
    });

    it("normalizes a dynamic route segment from [id] to its OpenAPI {id} path", () => {
      const apiDir = path.join(tempDir, "app", "api", "case-studies", "[id]");
      fs.mkdirSync(apiDir, { recursive: true });
      fs.writeFileSync(
        path.join(apiDir, "route.ts"),
        "export async function GET() { return null; }"
      );

      const scriptsDir = path.join(tempDir, "scripts");
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptsDir, "generate-openapi.ts"),
        "// generator"
      );

      fs.writeFileSync(
        path.join(tempDir, "openapi.json"),
        JSON.stringify({
          openapi: "3.0.0",
          paths: { "/api/case-studies/{id}": {} },
        })
      );

      expect(checkOpenApiParity(tempDir, false).status).toBe("pass");
    });

    it("converts Next.js bracket parameter syntax to OpenAPI template syntax for admin routes", () => {
      const apiDir = path.join(tempDir, "app", "api", "admin", "blog", "[id]");
      fs.mkdirSync(apiDir, { recursive: true });
      fs.writeFileSync(
        path.join(apiDir, "route.ts"),
        "export async function GET() { return null; }"
      );

      const scriptsDir = path.join(tempDir, "scripts");
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptsDir, "generate-openapi.ts"),
        "// generator"
      );

      fs.writeFileSync(
        path.join(tempDir, "openapi.json"),
        JSON.stringify({
          openapi: "3.0.0",
          paths: { "/api/admin/blog/{id}": {} },
        })
      );

      const result = checkOpenApiParity(tempDir, false);
      expect(result.status).toBe("pass");
      expect(result.message).toContain("All app/api routes are documented");
    });
  });

  describe("checkAccessibilityStandards", () => {
    it("fails when app/layout.tsx is missing skip link, main landmark, or announcer provider", () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        "export default function Layout({ children }: { children: React.ReactNode }) { return <div>{children}</div>; }"
      );

      const result = checkAccessibilityStandards(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.details?.length).toBeGreaterThan(0);
    });

    it("passes when app/layout.tsx satisfies all accessibility landmark requirements", () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        `import { SkipToContent } from "@/components/SkipToContent";
import { A11yProvider } from "@/components/providers/A11yProvider";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <body>
      <SkipToContent />
      <A11yProvider>
        <main id="main-content">{children}</main>
      </A11yProvider>
    </body>
  );
}`
      );

      const result = checkAccessibilityStandards(tempDir, false);
      expect(result.status).toBe("pass");
    });

    it("auto-fixes missing skip link and main landmarks when fix=true", () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        `import { A11yProvider } from "@/components/providers/A11yProvider";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <body>
      <A11yProvider>
        <div className="flex-grow flex flex-col">{children}</div>
      </A11yProvider>
    </body>
  );
}`
      );

      const fixResult = checkAccessibilityStandards(tempDir, true);
      expect(fixResult.status).toBe("fixed");

      const updated = fs.readFileSync(path.join(appDir, "layout.tsx"), "utf-8");
      expect(updated).toContain("SkipToContent");
      expect(updated).toContain('id="main-content"');
    });
  });

  describe("checkHydrationSafety", () => {
    it("passes when no hydration anti-patterns are found", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "TestComp.tsx"),
        "export function TestComp() { return <div>Static text</div>; }"
      );

      const result = checkHydrationSafety(tempDir);
      expect(result.status).toBe("pass");
    });

    it("warns when unsuppressed Math.random is found in JSX", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "TestComp.tsx"),
        "export function TestComp() { return <div>{Math.random()}</div>; }"
      );

      const result = checkHydrationSafety(tempDir);
      expect(result.status).toBe("warn");
      expect(result.details?.[0]).toContain("Math.random()");
    });
  });

  describe("checkDefectRemediationInvariants", () => {
    it("fails when regression test suite or ADR 0007 are missing", () => {
      const result = checkDefectRemediationInvariants(tempDir);
      expect(result.status).toBe("fail");
      expect(result.message).toContain(
        "defect remediation invariant violation"
      );
    });

    it("passes when all computational engines and regression suites are verified", () => {
      const workspaceRoot = path.resolve(__dirname, "..");
      const result = checkDefectRemediationInvariants(workspaceRoot);
      expect(result.status).toBe("pass");
      expect(result.category).toBe("quality");
    });
  });

  describe("checkDesignTokens", () => {
    it("passes when no core components contain unconstrained inline style properties", () => {
      const workspaceRoot = path.resolve(__dirname, "..");
      const result = checkDesignTokens(workspaceRoot);
      expect(result.status).toBe("pass");
      expect(result.message).toContain("Zero raw inline style overrides");
    });

    it("detects raw inline style properties in core layout components", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "Hero.tsx"),
        'export function Hero() { return <div style={{ height: "500px" }}>Hero</div>; }'
      );

      const result = checkDesignTokens(tempDir);
      expect(result.status).toBe("fail");
      expect(result.details?.[0]).toContain(
        "Raw unconstrained inline style property detected"
      );
    });
  });

  describe("checkTouchTargetDimensions (ADR-0003 & ADR-0019)", () => {
    it("fails when an interactive button lacks 48px touch target styling", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "SmallButton.tsx"),
        'export function SmallButton() { return <button className="text-xs">Click</button>; }'
      );

      const result = checkTouchTargetDimensions(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("ADR-0003");
      expect(result.message).toContain("ADR-0019");
    });

    it("auto-fixes missing touch target dimensions when fix=true", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "SmallButton.tsx"),
        'export function SmallButton() { return <button className="text-xs">Click</button>; }'
      );

      const result = checkTouchTargetDimensions(tempDir, true);
      expect(result.status).toBe("fixed");

      const updated = fs.readFileSync(
        path.join(compDir, "SmallButton.tsx"),
        "utf-8"
      );
      expect(updated).toContain("min-h-[48px]");
    });

    it("does not claim universal rendered compliance in its pass message (static heuristic disclaimer)", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "ValidButton.tsx"),
        'export function ValidButton() { return <button className="min-h-[48px] min-w-[48px]">Click</button>; }'
      );

      const result = checkTouchTargetDimensions(tempDir, false);
      expect(result.status).toBe("pass");
      // Must not claim every control "satisfies" the standard on rendered
      // output -- this is a source-text heuristic, not a browser measurement.
      expect(result.message.toLowerCase()).not.toContain("all interactive");
      expect(result.message.toLowerCase()).toContain("static heuristic");
      expect(result.message).toContain("touch-controls.spec.ts");
    });

    it("counterexample: fails a 40px button (h-10) even though it also carries other loosely-matched utilities", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      // h-10 = 2.5rem = 40px, below the 48px standard. Regression coverage
      // for a real bug where h-10/h-11/w-10/w-11 (40px/44px) were previously
      // accepted as if they satisfied the 48px minimum.
      fs.writeFileSync(
        path.join(compDir, "FortyPxButton.tsx"),
        'export function FortyPxButton() { return <button className="h-10 w-10 flex items-center justify-center">X</button>; }'
      );

      const result = checkTouchTargetDimensions(tempDir, false);
      expect(result.status).toBe("fail");
    });

    it("counterexample: fails a 44px button (h-11)", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "FortyFourPxButton.tsx"),
        'export function FortyFourPxButton() { return <button className="h-11 w-11">X</button>; }'
      );

      const result = checkTouchTargetDimensions(tempDir, false);
      expect(result.status).toBe("fail");
    });

    it("passes a control that genuinely declares 48px dimensions", () => {
      const compDir = path.join(tempDir, "components");
      fs.mkdirSync(compDir, { recursive: true });
      fs.writeFileSync(
        path.join(compDir, "FortyEightPxButton.tsx"),
        'export function FortyEightPxButton() { return <button className="h-12 w-12">X</button>; }'
      );

      const result = checkTouchTargetDimensions(tempDir, false);
      expect(result.status).toBe("pass");
    });
  });

  describe("checkSectionStructures (ADR-0009 & ADR-0023)", () => {
    it("fails when a documentation guide lacks title heading", () => {
      const docsDir = path.join(tempDir, "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(
        path.join(docsDir, "guide.md"),
        "This guide contains raw text without a title heading."
      );

      const result = checkSectionStructures(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("ADR-0023");
    });

    it("auto-fixes missing title heading when fix=true", () => {
      const docsDir = path.join(tempDir, "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(
        path.join(docsDir, "guide.md"),
        "This guide contains raw text without a title heading."
      );

      const result = checkSectionStructures(tempDir, true);
      expect(result.status).toBe("fixed");

      const updated = fs.readFileSync(path.join(docsDir, "guide.md"), "utf-8");
      expect(updated).toContain("# Guide");
    });
  });

  describe("checkServiceResultTypes (ADR-0028)", () => {
    it("fails when a service handler lacks ServiceResult envelope structure", () => {
      const serviceDir = path.join(tempDir, "lib", "services", "custom");
      fs.mkdirSync(serviceDir, { recursive: true });
      fs.writeFileSync(
        path.join(serviceDir, "handler.ts"),
        "export class CustomHandler { execute() { return { value: 1 }; } }"
      );

      const result = checkServiceResultTypes(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.message).toContain("ADR-0028");
    });

    it("passes when a service handler uses ServiceResult envelope pattern", () => {
      const serviceDir = path.join(tempDir, "lib", "services", "custom");
      fs.mkdirSync(serviceDir, { recursive: true });
      fs.writeFileSync(
        path.join(serviceDir, "handler.ts"),
        'import { ServiceResult, createSuccess } from "@/lib/services/service-result";\nexport class CustomHandler { execute(): ServiceResult<number> { return createSuccess(1); } }'
      );

      const result = checkServiceResultTypes(tempDir, false);
      expect(result.status).toBe("pass");
    });

    it("scans *-service.ts modules for raw throws unless they are pending migration", () => {
      const serviceDir = path.join(tempDir, "lib", "services");
      fs.mkdirSync(serviceDir, { recursive: true });
      const body =
        'import type { ServiceResult } from "./service-result";\nexport function run(): ServiceResult<number> { throw new Error("boom"); }\n';
      fs.writeFileSync(path.join(serviceDir, "widget-service.ts"), body);
      // Listed as pending migration (#1140), so its raw throw is tolerated.
      fs.writeFileSync(path.join(serviceDir, "blog-service.ts"), body);

      const result = checkServiceResultTypes(tempDir, false);
      expect(result.status).toBe("fail");
      expect(result.details).toEqual([
        expect.stringContaining(
          `${path.join("lib", "services", "widget-service.ts")}:2`
        ),
      ]);
    });
  });

  describe("checkSubRoutePerformance", () => {
    it("rejects missing production evidence at the diagnostic assertion gate", () => {
      const result = checkSubRoutePerformance(tempDir);

      expect(result.status).toBe("fail");
      expect(result.message).toContain("assertion gate cannot pass");
    });

    it("rejects malformed versioned evidence instead of treating it as a pass", () => {
      const evidenceDirectory = path.join(tempDir, ".benchmark-results");
      fs.mkdirSync(evidenceDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(evidenceDirectory, "benchmark-results.v1.json"),
        '{"routes":[]}'
      );

      const result = checkSubRoutePerformance(tempDir);

      expect(result.status).toBe("fail");
      expect(result.message).toContain("not valid");
    });
  });

  describe("Full Workspace Health Diagnostic", () => {
    // Runs against a small fixture workspace rather than the repository
    // (#937). A whole-repo run spawned depcruise over every source directory
    // and walked ignored build and benchmark artifacts, so it took ~20s under
    // load and its result depended on what happened to be on disk locally.
    const writeFixture = (relative: string, contents: string) => {
      const file = path.join(tempDir, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, contents);
    };

    const snapshotTree = (dir: string): Record<string, string> => {
      const tree: Record<string, string> = {};
      const walk = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) walk(full);
          else tree[path.relative(dir, full)] = fs.readFileSync(full, "utf-8");
        }
      };
      walk(dir);
      return tree;
    };

    beforeEach(() => {
      writeFixture(
        "package.json",
        JSON.stringify({ name: "doctor-fixture", private: true }, null, 2)
      );
      writeFixture(
        "app/page.tsx",
        'export default function Home() {\n  return <main className="min-h-dvh pt-24">Home</main>;\n}\n'
      );
      writeFixture(
        "__tests__/example.test.ts",
        'import path from "path";\nexport const root = path.resolve(__dirname, "..");\n'
      );
      writeFixture(".env.example", "DATABASE_URL=\n");
    });

    it("runs every check against a workspace and reports a consistent summary", async () => {
      const before = snapshotTree(tempDir);
      const startedAt = performance.now();

      const summary = await runDiagnostics({
        workspaceRoot: tempDir,
        fix: false,
        ci: true,
      });

      // Bounded well under the default timeout so a slow check that creeps
      // back in (a spawned tool, a whole-tree walk) fails here, not as a flake.
      expect(performance.now() - startedAt).toBeLessThan(5000);

      const ids = summary.results.map((result) => result.id);
      expect(summary.results.length).toBeGreaterThan(20);
      expect(new Set(ids).size).toBe(ids.length);
      for (const result of summary.results) {
        expect(result.name.length).toBeGreaterThan(0);
        expect(["pass", "fail", "warn", "fixed"]).toContain(result.status);
      }

      const count = (status: string) =>
        summary.results.filter((result) => result.status === status).length;
      expect(summary.totalPassed).toBe(count("pass"));
      expect(summary.totalFailed).toBe(count("fail"));
      expect(summary.totalWarned).toBe(count("warn"));
      expect(summary.totalFixed).toBe(count("fixed"));
      expect(summary.totalPassed).toBeGreaterThan(0);
      expect(summary.hasFailures).toBe(summary.totalFailed > 0);
      expect(summary.hasWarnings).toBe(summary.totalWarned > 0);

      // Every failing auto-fixable check points at the fix command.
      for (const result of summary.results) {
        if (result.status === "fail" && result.fixable) {
          expect(result.remediation?.command).toBe("npm run doctor:fix");
        }
      }

      // A read-only run never writes to the workspace.
      expect(snapshotTree(tempDir)).toEqual(before);

      expect(() => printDoctorReport(summary, true)).not.toThrow();
    });

    it("prints a report containing failures and fixes", () => {
      const summary = {
        results: [
          {
            id: "fake-check",
            name: "Fake Invariant",
            category: "routes" as const,
            status: "fail" as const,
            message: "Missing mock route",
            details: ["/mock/path"],
          },
        ],
        hasFailures: true,
        hasWarnings: true,
        totalPassed: 0,
        totalFailed: 1,
        totalWarned: 1,
        totalFixed: 1,
        remediations: [],
      };
      expect(() => printDoctorReport(summary, false)).not.toThrow();
    });
  });

  describe("checkSeoSocialIntegrity", () => {
    const title = "A Route Title That Fits Well"; // 28 + 22 template = 50
    const description = "d".repeat(140);

    const writeWorkspace = (
      overrides: {
        title?: string;
        description?: string;
        llms?: string;
        layout?: string;
      } = {}
    ) => {
      fs.mkdirSync(path.join(tempDir, "lib"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "app"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, "public"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "lib", "seo-metadata.ts"),
        `export const ROUTE_METADATA_CONFIGS = {\n  demo: {\n    title: "${overrides.title ?? title}",\n    description:\n      "${overrides.description ?? description}",\n    path: "/demo",\n  },\n};\n`
      );
      const manifest =
        overrides.llms ?? "- [Demo](https://deruiter.dev/demo): text\n";
      fs.writeFileSync(path.join(tempDir, "public", "llms.txt"), manifest);
      fs.writeFileSync(path.join(tempDir, "public", "llms-full.txt"), manifest);
      fs.writeFileSync(
        path.join(tempDir, "app", "layout.tsx"),
        overrides.layout ??
          'export const viewport = { themeColor: "#090D16", colorScheme: "dark" };\n'
      );
    };

    it("passes when bounds, manifests and theme color hold", () => {
      writeWorkspace();
      expect(checkSeoSocialIntegrity(tempDir).status).toBe("pass");
    });

    it("passes when the workspace has no route metadata", () => {
      expect(checkSeoSocialIntegrity(tempDir).status).toBe("pass");
    });

    it("fails on short or long titles and descriptions", () => {
      writeWorkspace({ title: "Short", description: "d".repeat(161) });
      const result = checkSeoSocialIntegrity(tempDir);
      expect(result.status).toBe("fail");
      expect(result.details?.join("\n")).toMatch(/rendered title is 27/);
      expect(result.details?.join("\n")).toMatch(/description is 161/);
    });

    it("fails on a title that carries the site name", () => {
      writeWorkspace({ title: "Book a Chat With Frederick de Ruiter" });
      expect(checkSeoSocialIntegrity(tempDir).details?.join("\n")).toMatch(
        /repeats the site name/
      );
    });

    it("fails when a route is missing from the llms manifests", () => {
      writeWorkspace({ llms: "- [Other](https://deruiter.dev/other): text\n" });
      expect(checkSeoSocialIntegrity(tempDir).details?.join("\n")).toMatch(
        /\/demo missing from public\/llms\.txt/
      );
    });

    it("fails when the viewport loses the brand theme color", () => {
      writeWorkspace({
        layout: 'export const viewport = { themeColor: "#000" };\n',
      });
      expect(checkSeoSocialIntegrity(tempDir).details?.join("\n")).toMatch(
        /themeColor/
      );
    });
  });
});
