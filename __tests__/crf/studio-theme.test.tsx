/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

class MockStorage implements Storage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

const mockLocalStorage = new MockStorage();
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

import { VisitMatrixEditor } from "@/components/crf/Modes/VisitMatrixEditor";
import { RuleGraphStudio } from "@/components/crf/Modes/RuleGraphStudio";
import { LiveEdcSimulator } from "@/components/crf/Modes/LiveEdcSimulator";
import { WorkflowWizardModal } from "@/components/crf/Wizard/WorkflowWizardModal";
import { AcrfOverlayViewer } from "@/components/crf/Modes/AcrfOverlayViewer";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { BrandingConfigModal } from "@/components/crf/Branding/BrandingConfigModal";
import { DiagnosticsDrawer } from "@/components/crf/DiagnosticsDrawer";
import { SpotlightTourOverlay } from "@/components/crf/Wizard/SpotlightTourOverlay";

(globalThis as any).mockComponents = {
  VisitMatrixEditor,
  RuleGraphStudio,
  LiveEdcSimulator,
  WorkflowWizardModal,
  AcrfOverlayViewer,
  ExportImportModal,
  BrandingConfigModal,
  DiagnosticsDrawer,
  SpotlightTourOverlay,
};

vi.mock("next/dynamic", () => {
  return {
    default: (loader: any, options: any) => {
      const loaderStr = loader.toString();

      return function DynamicComponent(props: any) {
        const registry = (globalThis as any).mockComponents || {};
        let Component: any = null;

        if (loaderStr.includes("VisitMatrixEditor")) {
          Component = registry.VisitMatrixEditor;
        } else if (loaderStr.includes("RuleGraphStudio")) {
          Component = registry.RuleGraphStudio;
        } else if (loaderStr.includes("LiveEdcSimulator")) {
          Component = registry.LiveEdcSimulator;
        } else if (loaderStr.includes("WorkflowWizardModal")) {
          Component = registry.WorkflowWizardModal;
        } else if (loaderStr.includes("AcrfOverlayViewer")) {
          Component = registry.AcrfOverlayViewer;
        } else if (loaderStr.includes("ExportImportModal")) {
          Component = registry.ExportImportModal;
        } else if (loaderStr.includes("BrandingConfigModal")) {
          Component = registry.BrandingConfigModal;
        } else if (loaderStr.includes("DiagnosticsDrawer")) {
          Component = registry.DiagnosticsDrawer;
        } else if (loaderStr.includes("SpotlightTourOverlay")) {
          Component = registry.SpotlightTourOverlay;
        }

        if (Component) {
          return React.createElement(Component, props);
        }
        if (options && options.loading) {
          return options.loading();
        }
        return null;
      };
    },
  };
});

import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";
import { StudioHeader } from "@/components/crf/StudioHeader";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("CRF Studio - Light Mode & Theming", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockLocalStorage.clear();
    window.location.hash = "";
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("defaults to dark studio theme and renders data-studio-theme='dark'", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const studioRoot = container.querySelector("[data-studio-theme]");
    expect(studioRoot).toBeDefined();
    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("dark");
  });

  it("initializes to light theme when URL hash contains #theme=light", async () => {
    window.location.hash = "#theme=light";

    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const studioRoot = container.querySelector("[data-studio-theme]");
    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("light");
  });

  it("initializes to light theme when localStorage has crf_studio_theme set to 'light'", async () => {
    mockLocalStorage.setItem("crf_studio_theme", "light");

    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const studioRoot = container.querySelector("[data-studio-theme]");
    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("light");
  });

  it("toggles theme from dark to light when clicking the header theme toggle button", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const studioRoot = container.querySelector("[data-studio-theme]");
    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("dark");

    // Find the theme toggle button by aria-label
    const themeBtn = container.querySelector(
      'button[aria-label="Switch to Clinical Light Mode"]'
    ) as HTMLButtonElement;
    expect(themeBtn).toBeDefined();

    await act(async () => {
      themeBtn?.click();
    });

    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("light");
    expect(mockLocalStorage.getItem("crf_studio_theme")).toBe("light");
    expect(window.location.hash).toContain("theme=light");

    // Click again to toggle back to dark
    const switchBackBtn = container.querySelector(
      'button[aria-label="Switch to Dark Studio Mode"]'
    ) as HTMLButtonElement;
    expect(switchBackBtn).toBeDefined();

    await act(async () => {
      switchBackBtn?.click();
    });

    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("dark");
    expect(mockLocalStorage.getItem("crf_studio_theme")).toBe("dark");
  });

  it("applies data-studio-theme='light' container attribute for theme-scoped WCAG focus ring contrast overrides", async () => {
    mockLocalStorage.setItem("crf_studio_theme", "light");

    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const studioRoot = container.querySelector("[data-studio-theme='light']");
    expect(studioRoot).not.toBeNull();
  });

  // #1514: the theme and default branding now go through lib/safe-storage.
  // Blocked storage for those keys must still give the dark default and a
  // working toggle. (Only these keys throw: the study draft loader in
  // lib/crf/internal/study-draft-storage.ts is a separate path.)
  it("falls back to dark and still toggles when storage throws", async () => {
    const blocked = new Set([
      "crf_studio_theme",
      "crf_studio_default_branding",
    ]);
    const getItem = mockLocalStorage.getItem.bind(mockLocalStorage);
    const setItemOriginal = mockLocalStorage.setItem.bind(mockLocalStorage);
    vi.spyOn(mockLocalStorage, "getItem").mockImplementation((key) => {
      if (blocked.has(key)) throw new Error("SecurityError");
      return getItem(key);
    });
    const setItem = vi
      .spyOn(mockLocalStorage, "setItem")
      .mockImplementation((key, value) => {
        if (blocked.has(key)) throw new Error("QuotaExceededError");
        setItemOriginal(key, value);
      });

    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const studioRoot = container.querySelector("[data-studio-theme]");
    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("dark");

    const themeBtn = container.querySelector(
      'button[aria-label="Switch to Clinical Light Mode"]'
    ) as HTMLButtonElement;
    await act(async () => {
      themeBtn?.click();
    });

    expect(studioRoot?.getAttribute("data-studio-theme")).toBe("light");
    expect(setItem).toHaveBeenCalledWith("crf_studio_theme", "light");
  });

  it("StudioHeader renders theme toggle and triggers onToggleTheme callback", async () => {
    const handleToggle = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <StudioHeader
          study={ONCOLOGY_RECIST_PRESET}
          activeMode="designer"
          canUndo={false}
          canRedo={false}
          theme="dark"
          onToggleTheme={handleToggle}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onChangeMode={vi.fn()}
          onSelectPreset={vi.fn()}
          onOpenDiagnostics={vi.fn()}
          onOpenFormCatalog={vi.fn()}
          onOpenBranding={vi.fn()}
          onOpenExportDocument={vi.fn()}
          onOpenWizard={vi.fn()}
        />
      );
    });

    const toggleBtn = container.querySelector(
      'button[aria-label="Switch to Clinical Light Mode"]'
    ) as HTMLButtonElement;
    expect(toggleBtn).toBeDefined();

    await act(async () => {
      toggleBtn?.click();
    });

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  describe("semantic studio theme tokens & zero-zinc contract", () => {
    it("renders StudioHeader with semantic studio-surface-header and studio-border-default classes", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
          <StudioHeader
            study={ONCOLOGY_RECIST_PRESET}
            activeMode="designer"
            canUndo={false}
            canRedo={false}
            theme="dark"
            onToggleTheme={vi.fn()}
            onUndo={vi.fn()}
            onRedo={vi.fn()}
            onChangeMode={vi.fn()}
            onSelectPreset={vi.fn()}
            onOpenDiagnostics={vi.fn()}
            onOpenFormCatalog={vi.fn()}
            onOpenBranding={vi.fn()}
            onOpenExportDocument={vi.fn()}
            onOpenWizard={vi.fn()}
          />
        );
      });

      const header = container.querySelector("header");
      expect(header).not.toBeNull();
      expect(header?.className).toContain("studio-surface-header");
      expect(header?.className).toContain("studio-border-default");
      expect(header?.className).not.toContain("border-zinc-");
    });

    it("verifies zero raw zinc-* utility class occurrences across components/crf TSX/TS files", () => {
      const crfDir = path.join(process.cwd(), "components/crf");

      function findFiles(dir: string): string[] {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...findFiles(fullPath));
          } else if (
            (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) &&
            !entry.name.endsWith(".test.tsx") &&
            !entry.name.endsWith(".test.ts")
          ) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const crfFiles = findFiles(crfDir);
      const violations: string[] = [];

      for (const filePath of crfFiles) {
        const content = fs.readFileSync(filePath, "utf8");
        const matches = content.match(
          /(?:[a-z-]+:)*(?:border|bg|text|divide|ring|placeholder|decoration)-zinc-\d+(?:\/[\d.[\]]+)?/g
        );
        if (matches) {
          const relPath = path.relative(process.cwd(), filePath);
          violations.push(`${relPath}: ${matches.join(", ")}`);
        }
      }

      expect(
        violations,
        `Found raw zinc-* utility class occurrences in CRF components:\n${violations.join("\n")}`
      ).toHaveLength(0);
    });

    it("verifies studio-theme.css defines scoped semantic tokens without !important and >= 4.5:1 light-mode badge contrast", () => {
      const cssPath = path.join(
        process.cwd(),
        "components/crf/studio-theme.css"
      );
      const cssContent = fs.readFileSync(cssPath, "utf8");

      expect(cssContent).not.toContain("!important");
      expect(cssContent).toContain('[data-studio-theme="light"]');
      expect(cssContent).toContain('[data-studio-theme="dark"]');
      expect(cssContent).toContain("--studio-surface-root:");
      expect(cssContent).toContain("--studio-fg-primary:");
      expect(cssContent).toContain("--studio-border-default:");
      expect(cssContent).toContain("--studio-accent-cyan-fg:");
      expect(cssContent).toContain("--studio-accent-amber-fg:");
      expect(cssContent).toContain("--studio-accent-purple-fg:");
      expect(cssContent).toContain("--studio-accent-emerald-fg:");

      const lightMatch = cssContent.match(
        /\[data-studio-theme="light"\]\s*\{([\s\S]*?)\n\}/
      );
      expect(lightMatch).not.toBeNull();
      const lightBlock = lightMatch![1];

      const readHex = (token: string): string => {
        const m = lightBlock.match(
          new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`)
        );
        expect(m, `Missing hex token ${token} in light theme`).not.toBeNull();
        return m![1];
      };

      const relLuminance = (hex: string): number => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const lin = (c: number) =>
          c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };

      const contrast = (fg: string, bg: string): number => {
        const l1 = relLuminance(fg);
        const l2 = relLuminance(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      // Phase III & CDASH 100% badges (cyan), StudySpine DM badge (muted), Next: Schedule the forms badge (amber), purple & emerald accents
      expect(
        contrast(
          readHex("--studio-fg-muted"),
          readHex("--studio-surface-muted")
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          readHex("--studio-accent-purple-fg"),
          readHex("--studio-accent-purple-bg")
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          readHex("--studio-accent-cyan-fg"),
          readHex("--studio-accent-cyan-bg")
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          readHex("--studio-accent-cyan-fg"),
          readHex("--studio-accent-cyan-bg-strong")
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          readHex("--studio-accent-amber-fg"),
          readHex("--studio-accent-amber-bg")
        )
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          readHex("--studio-accent-emerald-fg"),
          readHex("--studio-accent-emerald-bg")
        )
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
});
