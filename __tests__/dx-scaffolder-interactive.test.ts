// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  scaffold,
  scaffoldHook,
  validateScaffoldType,
  validateScaffoldName,
  VALID_SCAFFOLD_TYPES,
} from "@/lib/dx/scaffolder";

describe("DX Universal Scaffolder - Interactive & Validation Expansion", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "dx-scaffold-interactive-test-")
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("validates template types correctly for all 7 supported architecture types", () => {
    expect(VALID_SCAFFOLD_TYPES).toHaveLength(7);
    expect(VALID_SCAFFOLD_TYPES).toContain("component");
    expect(VALID_SCAFFOLD_TYPES).toContain("hook");
    expect(VALID_SCAFFOLD_TYPES).toContain("api");
    expect(VALID_SCAFFOLD_TYPES).toContain("adr");
    expect(VALID_SCAFFOLD_TYPES).toContain("case-study");
    expect(VALID_SCAFFOLD_TYPES).toContain("arcade");
    expect(VALID_SCAFFOLD_TYPES).toContain("game");

    for (const t of VALID_SCAFFOLD_TYPES) {
      const res = validateScaffoldType(t);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    }

    const invalidType = validateScaffoldType("invalid-type");
    expect(invalidType.valid).toBe(false);
    expect(invalidType.error).toContain("Unsupported template type");

    const emptyType = validateScaffoldType("");
    expect(emptyType.valid).toBe(false);
    expect(emptyType.error).toContain("required");
  });

  it("validates feature and asset names correctly", () => {
    expect(validateScaffoldName("my-feature").valid).toBe(true);
    expect(validateScaffoldName("analytics_card").valid).toBe(true);
    expect(validateScaffoldName("matrix defender").valid).toBe(true);

    const emptyName = validateScaffoldName("  ");
    expect(emptyName.valid).toBe(false);
    expect(emptyName.error).toContain("cannot be empty");

    const invalidChar = validateScaffoldName("feature@#!");
    expect(invalidChar.valid).toBe(false);
    expect(invalidChar.error).toContain("Invalid name format");
  });

  it("scaffolds React hook with custom implementation and unit test", () => {
    const generated = scaffoldHook(tempDir, "use-telemetry-filter", false);
    expect(generated.length).toBe(2);

    const hookFile = path.join(tempDir, "hooks", "useTelemetryFilter.ts");
    const testFile = path.join(
      tempDir,
      "__tests__",
      "telemetry-filter-hook.test.ts"
    );

    expect(fs.existsSync(hookFile)).toBe(true);
    expect(fs.existsSync(testFile)).toBe(true);

    const hookContent = fs.readFileSync(hookFile, "utf-8");
    expect(hookContent).toContain("export function useTelemetryFilter");

    const testContent = fs.readFileSync(testFile, "utf-8");
    expect(testContent).toContain("renderHook");
    expect(testContent).toContain("useTelemetryFilter");
  });

  it("scaffolds case study with page and companion unit test file", () => {
    const paletteFile = path.join(tempDir, "components", "CommandPalette.tsx");
    fs.mkdirSync(path.dirname(paletteFile), { recursive: true });
    fs.writeFileSync(
      paletteFile,
      'const staticNavs: PaletteItem[] = [\n      { id: "nav-work", url: "/#work" }\n    ];'
    );

    const generated = scaffold({
      type: "case-study",
      name: "quantum-compiler",
      workspaceRoot: tempDir,
    });
    expect(generated.length).toBeGreaterThan(0);

    const routeFile = path.join(
      tempDir,
      "app",
      "case-studies",
      "quantum-compiler",
      "page.tsx"
    );
    const testFile = path.join(
      tempDir,
      "__tests__",
      "quantum-compiler-case-study.test.ts"
    );

    expect(fs.existsSync(routeFile)).toBe(true);
    expect(fs.existsSync(testFile)).toBe(true);

    const testContent = fs.readFileSync(testFile, "utf-8");
    expect(testContent).toContain("QuantumCompilerCaseStudyPage");
  });

  it("supports non-interactive scaffold execution for hook type via dispatcher", () => {
    const generated = scaffold({
      type: "hook",
      name: "debounce-state",
      dryRun: false,
      workspaceRoot: tempDir,
    });

    expect(generated.length).toBe(2);
    const hookFile = path.join(tempDir, "hooks", "useDebounceState.ts");
    expect(fs.existsSync(hookFile)).toBe(true);
  });
});
