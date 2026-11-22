/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";
import { VisitMatrixEditor } from "@/components/crf/Modes/VisitMatrixEditor";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("CRF Studio Mobile & Tablet Responsiveness", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
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

  it("renders mobile bottom navigation bar and allows switching between Forms, Canvas, and Inspector views", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    // Verify mobile navigation bar is present
    const mobileNav = container.querySelector(
      "nav[aria-label='Mobile View Navigation']"
    );
    expect(mobileNav).not.toBeNull();

    // Check buttons inside mobile navigation
    const navButtons = Array.from(mobileNav?.querySelectorAll("button") || []);
    expect(navButtons.length).toBe(3); // Forms, Canvas, Inspector

    const formsBtn = navButtons.find((b) => b.textContent?.includes("Forms"));
    const canvasBtn = navButtons.find((b) => b.textContent?.includes("Canvas"));
    const inspectorBtn = navButtons.find((b) =>
      b.textContent?.includes("Inspector")
    );

    expect(formsBtn).toBeDefined();
    expect(canvasBtn).toBeDefined();
    expect(inspectorBtn).toBeDefined();

    // Switch to Forms/Spine view on mobile
    await act(async () => {
      formsBtn?.click();
    });
    expect(container.textContent).toContain("Study Timeline");

    // Switch to Inspector view on mobile
    await act(async () => {
      inspectorBtn?.click();
    });
    expect(container.textContent).toContain("Form-Level Settings");

    // Switch back to Canvas view
    await act(async () => {
      canvasBtn?.click();
    });
    expect(container.textContent).toContain("Layout Canvas");
  });

  it("opens mobile widget bottom sheet when clicking the FAB or Add Widget button", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const fabBtn = container.querySelector(
      "button[data-tooltip='Add Field / Open Widget Palette']"
    );
    expect(fabBtn).not.toBeNull();

    await act(async () => {
      (fabBtn as HTMLButtonElement)?.click();
    });

    // Should render the mobile bottom sheet for widget selection
    expect(container.textContent).toContain("Add Clinical Widget");
    expect(container.textContent).toContain("Single-Line Text");
    expect(container.textContent).toContain("Visual Analog Scale");

    // Close bottom sheet
    const closeBtn = container.querySelector(
      "button[aria-label='Close Widget Palette']"
    );
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      (closeBtn as HTMLButtonElement)?.click();
    });

    expect(container.textContent).not.toContain("Add Clinical Widget");
  });

  it("renders Visit Matrix with both Table View and Mobile Cards View", async () => {
    const handleUpdateVisits = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <VisitMatrixEditor
          study={ONCOLOGY_RECIST_PRESET}
          onUpdateVisits={handleUpdateVisits}
        />
      );
    });

    // Default is Table view
    expect(container.querySelector("table")).not.toBeNull();

    // Switch to Cards view
    const cardsToggle = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Cards")
    );
    expect(cardsToggle).toBeDefined();

    await act(async () => {
      cardsToggle?.click();
    });

    // Cards view should display visit pill selector and assigned forms list
    expect(container.textContent).toContain("Assigned Protocol Forms");
    expect(container.textContent).toContain("Target Day");

    // Switch back to Table view
    const tableToggle = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Table")
    );
    await act(async () => {
      tableToggle?.click();
    });

    expect(container.querySelector("table")).not.toBeNull();
  });
});
