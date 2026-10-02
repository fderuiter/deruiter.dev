// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

// Helper function equivalent to the ones in our components
const isWithinBoundary = (target: unknown) => {
  if (
    target &&
    typeof target === "object" &&
    "closest" in target &&
    typeof (target as { closest: unknown }).closest === "function"
  ) {
    return !!(target as { closest: (selector: string) => unknown }).closest(
      "[data-keyboard-boundary]"
    );
  }
  return false;
};

describe("Keyboard Boundary Exclusion Logic", () => {
  it("should detect when an element is inside a keyboard boundary", () => {
    // Mock element within boundary
    const mockElementInside = {
      closest: vi.fn((selector: string) => {
        if (selector === "[data-keyboard-boundary]") {
          return { "data-keyboard-boundary": "true" };
        }
        return null;
      }),
    };

    expect(isWithinBoundary(mockElementInside)).toBe(true);
    expect(mockElementInside.closest).toHaveBeenCalledWith(
      "[data-keyboard-boundary]"
    );
  });

  it("should detect when an element is NOT inside a keyboard boundary", () => {
    // Mock element not in boundary
    const mockElementOutside = {
      closest: vi.fn(() => null),
    };

    expect(isWithinBoundary(mockElementOutside)).toBe(false);
    expect(mockElementOutside.closest).toHaveBeenCalledWith(
      "[data-keyboard-boundary]"
    );
  });

  it("should handle null or invalid event targets gracefully", () => {
    expect(isWithinBoundary(null)).toBe(false);
    expect(isWithinBoundary(undefined)).toBe(false);
    expect(isWithinBoundary({})).toBe(false);
  });
});

describe("Garmin Watch Simulator Input Handling", () => {
  it("should intercept ArrowUp, ArrowDown and LIGHT key events", () => {
    const preventedEvents: string[] = [];
    const mockEvent = {
      key: "ArrowUp",
      preventDefault: () => {
        preventedEvents.push("ArrowUp");
      },
    };

    // Simulate keydown logic inside GarminWatchSimulator
    const interceptKeys = ["ArrowUp", "ArrowDown", " ", "l", "L", "Enter"];
    if (interceptKeys.includes(mockEvent.key)) {
      mockEvent.preventDefault();
    }

    expect(preventedEvents).toContain("ArrowUp");
  });

  it("should NOT intercept unrelated key events", () => {
    const preventedEvents: string[] = [];
    const mockEvent = {
      key: "k",
      preventDefault: () => {
        preventedEvents.push("k");
      },
    };

    // Simulate keydown logic inside GarminWatchSimulator
    const interceptKeys = ["ArrowUp", "ArrowDown", " ", "l", "L", "Enter"];
    if (interceptKeys.includes(mockEvent.key)) {
      mockEvent.preventDefault();
    }

    expect(preventedEvents).not.toContain("k");
  });
});

interface SimpleKeyboardEvent {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  target: unknown;
}

describe("Global Command Palette Listener", () => {
  it("should ignore Cmd+K if event target is within boundary", () => {
    let commandPaletteOpened = false;

    const simulateGlobalKeydown = (event: SimpleKeyboardEvent) => {
      // Check keyboard boundary first
      if (isWithinBoundary(event.target)) {
        return; // Ignore event!
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        commandPaletteOpened = true;
      }
    };

    const mockTargetInsideBoundary = {
      closest: (selector: string) =>
        selector === "[data-keyboard-boundary]" ? {} : null,
    };

    simulateGlobalKeydown({
      key: "k",
      metaKey: true,
      target: mockTargetInsideBoundary,
    });

    expect(commandPaletteOpened).toBe(false);
  });

  it("should open Cmd+K if event target is outside boundary", () => {
    let commandPaletteOpened = false;

    const simulateGlobalKeydown = (event: SimpleKeyboardEvent) => {
      // Check keyboard boundary first
      if (isWithinBoundary(event.target)) {
        return; // Ignore event!
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        commandPaletteOpened = true;
      }
    };

    const mockTargetOutsideBoundary = {
      closest: () => null,
    };

    simulateGlobalKeydown({
      key: "k",
      metaKey: true,
      target: mockTargetOutsideBoundary,
    });

    expect(commandPaletteOpened).toBe(true);
  });
});
