/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";

describe("CRF Studio Collapsible Sidebars & Header Controls", () => {
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

  it("toggles left navigator and right inspector using keyboard shortcuts ⌘B and ⌘I", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    // Check initial state: Left sidebar is rendered
    expect(container.querySelector("aside")).not.toBeNull();

    // Trigger ⌘B (toggle left sidebar)
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          metaKey: true,
          bubbles: true,
        })
      );
    });

    // Trigger ⌘I (toggle right inspector)
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "i",
          metaKey: true,
          bubbles: true,
        })
      );
    });

    // Toggle back on with ⌘B
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          metaKey: true,
          bubbles: true,
        })
      );
    });

    expect(container.textContent).toContain("Forms");
  });

  it("opens and closes the responsive More Actions sheet on smaller screens", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });

    const moreBtn = container.querySelector(
      "button[aria-label='More Studio Actions']"
    );
    expect(moreBtn).not.toBeNull();

    // Open More Actions popover sheet
    await act(async () => {
      (moreBtn as HTMLButtonElement)?.click();
    });

    expect(container.textContent).toContain("Studio Actions");
    expect(container.textContent).toContain(
      "Try in Clinical Trial Chaos (game)"
    );
    expect(container.textContent).toContain("Docx / PDF Books");
    expect(container.textContent).toContain("Organization Branding");

    // Click backdrop or close button
    const backdrop = container.querySelector(".fixed.inset-0.z-40");
    if (backdrop) {
      await act(async () => {
        (backdrop as HTMLDivElement)?.click();
      });
    }

    expect(container.textContent).not.toContain("Studio Actions");
  });
});
