// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TabletOrientationHint } from "@/components/arcade/TabletOrientationHint";

describe("TabletOrientationHint Component Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("1. hides on non-touch desktop environments by default", async () => {
    await act(async () => {
      root.render(<TabletOrientationHint />);
    });

    expect(container.children.length).toBe(0);
  });

  it("2. displays when a touch device is in portrait mode on tablet width", async () => {
    // Mock touch and portrait orientation
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("coarse") || query.includes("portrait"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 768, // iPad / Tablet width
    });

    await act(async () => {
      root.render(<TabletOrientationHint />);
    });

    const banner = container.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain("Rotate to landscape");
  });

  it("3. dismisses the banner when the close button is clicked", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("coarse") || query.includes("portrait"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 800,
    });

    await act(async () => {
      root.render(<TabletOrientationHint />);
    });

    const closeBtn = container.querySelector(
      'button[aria-label="Dismiss orientation recommendation"]'
    );
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.children.length).toBe(0);
  });

  it("4. responds to orientationchange window events dynamically", async () => {
    let isPortrait = true;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches:
          query.includes("coarse") ||
          (query.includes("portrait") && isPortrait),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      value: 768,
    });

    await act(async () => {
      root.render(<TabletOrientationHint />);
    });
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    // User rotates tablet to landscape
    isPortrait = false;
    await act(async () => {
      window.dispatchEvent(new Event("orientationchange"));
    });

    expect(container.children.length).toBe(0);
  });
});
