// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  scaffold,
  scaffoldArcadeGame,
  scaffoldApiRoute,
  scaffoldAdr,
  scaffoldCaseStudy,
  scaffoldComponent,
} from "@/lib/dx/scaffolder";

describe("DX Universal Scaffolder", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-scaffold-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("scaffolds arcade game with engine, ui, route, tests, and command palette hook", () => {
    const paletteFile = path.join(tempDir, "components", "CommandPalette.tsx");
    fs.mkdirSync(path.dirname(paletteFile), { recursive: true });
    fs.writeFileSync(
      paletteFile,
      'const staticNavs: PaletteItem[] = [\n      { id: "nav-work", url: "/#work" }\n    ];'
    );

    const generated = scaffoldArcadeGame(tempDir, "cyber-vault", false);
    expect(generated.length).toBeGreaterThanOrEqual(5);

    // Verify engine file
    const engineFile = path.join(tempDir, "lib", "cyber-vault-engine.ts");
    expect(fs.existsSync(engineFile)).toBe(true);
    expect(fs.readFileSync(engineFile, "utf-8")).toContain(
      "createInitialCyberVaultState"
    );

    // Verify UI file
    const uiFile = path.join(tempDir, "components", "CyberVault.tsx");
    expect(fs.existsSync(uiFile)).toBe(true);
    expect(fs.readFileSync(uiFile, "utf-8")).toContain(
      "export const CyberVault"
    );

    // Verify route file has pt-28 and NO Navbar
    const routeFile = path.join(
      tempDir,
      "app",
      "arcade",
      "cyber-vault",
      "page.tsx"
    );
    expect(fs.existsSync(routeFile)).toBe(true);
    const routeContent = fs.readFileSync(routeFile, "utf-8");
    expect(routeContent).toContain("pt-28");
    expect(routeContent).not.toContain("<Navbar");

    // Verify tests
    const engineTest = path.join(
      tempDir,
      "__tests__",
      "cyber-vault-engine.test.ts"
    );
    expect(fs.existsSync(engineTest)).toBe(true);

    // Verify CommandPalette updated
    const updatedPalette = fs.readFileSync(paletteFile, "utf-8");
    expect(updatedPalette).toContain('url: "/arcade/cyber-vault"');
  });

  it("scaffolds API route with Zod schema and test suite", () => {
    const generated = scaffoldApiRoute(tempDir, "telemetry-stream", false);
    expect(generated.length).toBe(2);

    const routeFile = path.join(
      tempDir,
      "app",
      "api",
      "telemetry-stream",
      "route.ts"
    );
    const testFile = path.join(
      tempDir,
      "__tests__",
      "telemetry-stream-api.test.ts"
    );

    expect(fs.existsSync(routeFile)).toBe(true);
    expect(fs.existsSync(testFile)).toBe(true);

    const routeContent = fs.readFileSync(routeFile, "utf-8");
    expect(routeContent).toContain("TelemetryStreamQuerySchema");
    expect(routeContent).toContain("TelemetryStreamResponseSchema");
    expect(routeContent).toContain("sanitizeError");

    const testContent = fs.readFileSync(testFile, "utf-8");
    expect(testContent).toContain("TelemetryStreamResponseSchema.safeParse");
  });

  it("scaffolds sequential ADR correctly", () => {
    const adrDir = path.join(tempDir, "adr");
    fs.mkdirSync(adrDir, { recursive: true });
    fs.writeFileSync(path.join(adrDir, "0001-initial.md"), "# 1. Initial");
    fs.writeFileSync(path.join(adrDir, "0002-second.md"), "# 2. Second");

    const generated = scaffoldAdr(tempDir, "event-sourcing-pattern", false);
    expect(generated.length).toBe(1);

    const expectedFile = path.join(adrDir, "0003-event-sourcing-pattern.md");
    expect(fs.existsSync(expectedFile)).toBe(true);

    const content = fs.readFileSync(expectedFile, "utf-8");
    expect(content).toContain("# 0003. Event Sourcing Pattern");
    expect(content).toContain("## Status");
    expect(content).toContain("## Invariant Compliance");
  });

  it("scaffolds case study showcase page", () => {
    const paletteFile = path.join(tempDir, "components", "CommandPalette.tsx");
    fs.mkdirSync(path.dirname(paletteFile), { recursive: true });
    fs.writeFileSync(
      paletteFile,
      'const staticNavs: PaletteItem[] = [\n      { id: "nav-work", url: "/#work" }\n    ];'
    );

    const generated = scaffoldCaseStudy(
      tempDir,
      "high-frequency-compiler",
      false
    );
    expect(generated.length).toBeGreaterThanOrEqual(1);

    const routeFile = path.join(
      tempDir,
      "app",
      "case-studies",
      "high-frequency-compiler",
      "page.tsx"
    );
    expect(fs.existsSync(routeFile)).toBe(true);
  });

  it("scaffolds UI component and test", () => {
    const generated = scaffoldComponent(tempDir, "glass-card", false);
    expect(generated.length).toBe(2);

    const compFile = path.join(tempDir, "components", "ui", "GlassCard.tsx");
    const testFile = path.join(tempDir, "__tests__", "glass-card.test.tsx");

    expect(fs.existsSync(compFile)).toBe(true);
    expect(fs.existsSync(testFile)).toBe(true);
  });

  it("supports --dry-run without creating files on disk", () => {
    const generated = scaffold({
      type: "game",
      name: "virtual-pet",
      dryRun: true,
      workspaceRoot: tempDir,
    });

    expect(generated.length).toBeGreaterThan(0);
    const engineFile = path.join(tempDir, "lib", "virtual-pet-engine.ts");
    expect(fs.existsSync(engineFile)).toBe(false);
  });
});
