// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StudioHeader } from "@/components/crf/StudioHeader";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("StudioHeader & Keyboard Shortcuts Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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

  it("renders all 6 mode tabs with numeric shortcut hints (1-6)", async () => {
    await act(async () => {
      root.render(
        <StudioHeader
          study={ONCOLOGY_RECIST_PRESET}
          activeMode="designer"
          canUndo={true}
          canRedo={false}
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

    expect(container.textContent).toContain("Form Designer");
    expect(container.textContent).toContain("Visit Matrix (SoA)");
    expect(container.textContent).toContain("Logic & AST Rules");
    expect(container.textContent).toContain("Live EDC Simulation");
    expect(container.textContent).toContain("Annotated aCRF");
    expect(container.textContent).toContain("CDISC / Exports");

    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("3");
    expect(container.textContent).toContain("4");
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("6");
  });

  it("triggers onOpenWizard when clicking 'How It Works' button", async () => {
    const handleWizard = vi.fn();

    await act(async () => {
      root.render(
        <StudioHeader
          study={ONCOLOGY_RECIST_PRESET}
          activeMode="designer"
          canUndo={true}
          canRedo={false}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onChangeMode={vi.fn()}
          onSelectPreset={vi.fn()}
          onOpenDiagnostics={vi.fn()}
          onOpenFormCatalog={vi.fn()}
          onOpenBranding={vi.fn()}
          onOpenExportDocument={vi.fn()}
          onOpenWizard={handleWizard}
        />
      );
    });

    const moreBtn = container.querySelector(
      "button[aria-label='More Studio Actions']"
    );
    if (moreBtn) {
      await act(async () => {
        (moreBtn as HTMLButtonElement).click();
      });
    }

    const howItWorksBtn = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.textContent?.includes("Interactive Guide") ||
        b.textContent?.includes("How")
    );
    expect(howItWorksBtn).toBeDefined();

    await act(async () => {
      howItWorksBtn?.click();
    });

    expect(handleWizard).toHaveBeenCalled();
  });

  it("calls onChangeMode when clicking a mode navigation button", async () => {
    const handleMode = vi.fn();

    await act(async () => {
      root.render(
        <StudioHeader
          study={ONCOLOGY_RECIST_PRESET}
          activeMode="designer"
          canUndo={true}
          canRedo={false}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          onChangeMode={handleMode}
          onSelectPreset={vi.fn()}
          onOpenDiagnostics={vi.fn()}
          onOpenFormCatalog={vi.fn()}
          onOpenBranding={vi.fn()}
          onOpenExportDocument={vi.fn()}
          onOpenWizard={vi.fn()}
        />
      );
    });

    const matrixTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Visit Matrix (SoA)")
    );
    expect(matrixTab).toBeDefined();

    await act(async () => {
      matrixTab?.click();
    });

    expect(handleMode).toHaveBeenCalledWith("matrix");
  });
});
