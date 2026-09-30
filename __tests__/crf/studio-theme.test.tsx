/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
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
  // lib/crf/study-draft-storage.ts is a separate path.)
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
          onOpenCdashScaffolder={vi.fn()}
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
});
