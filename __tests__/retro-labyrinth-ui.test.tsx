/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import * as dungeon from "@/lib/dungeon";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

const mockPlaySuccess = vi.fn();
const mockPlayNote = vi.fn();

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playSuccess: mockPlaySuccess,
      playNote: mockPlayNote,
      playHover: vi.fn(),
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mockRecordEvent = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: mockRecordEvent,
  }),
}));

describe("RetroLabyrinth React Component UI Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createPattern: vi.fn(() => ({}) as any),
      setLineDash: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 240,
      height: 144,
      right: 240,
      bottom: 144,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("should mount and render roguelike HUD and weapons bar", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    expect(container.textContent).toContain("Graveyard Roguelike");
    expect(container.textContent).toContain("HP");
    expect(container.textContent).toContain("SCORE:");
    expect(container.textContent).toContain("[1] npm i");
    expect(container.textContent).toContain("[2] Port Scan");
    expect(container.textContent).toContain("[3] EMP");
  });

  it("states the objective and marks the player and the fogged exit (#1187)", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain("OBJECTIVE");
    expect(container.textContent).toContain("to the EXIT");

    const ctx = HTMLCanvasElement.prototype.getContext("2d") as unknown as {
      fillText: ReturnType<typeof vi.fn>;
    };
    const drawn = ctx.fillText.mock.calls.map((call) => call[0]);
    expect(drawn).toContain("@");
    expect(drawn).toContain("EXIT");
    expect(drawn).toContain("REACH THE EXIT >>");
  });

  it("should render ASCII fallback when isMounted is false", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={false} />);
    });

    expect(container.textContent).toContain("SYSTEM_LABYRINTH.EXE");
    expect(container.textContent).toContain(
      "[INITIALIZING LABYRINTH ENGINE...]"
    );
  });

  it("should enforce keyboard boundary with data-keyboard-boundary='true'", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const boundary = container.querySelector('[data-keyboard-boundary="true"]');
    expect(boundary).not.toBeNull();
    expect(boundary?.getAttribute("tabIndex")).toBe("0");
  });

  it("should handle weapon switching via hotkeys", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;

    // Press '2' to switch to slot 2 (Port Scan for Script Kiddie)
    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "2",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    const portScanBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Port Scan")
    );
    expect(portScanBtn?.className).toContain("bg-amber-500/20");
  });

  it("should dynamically populate HUD hotbar with starter weapons when changing class", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    // Open class select modal
    const classBadge = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Script Kiddie")
    );
    await act(async () => {
      classBadge?.click();
    });

    // Select Cryptanalyst class
    const cryptanalystBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("Cryptanalyst"));
    await act(async () => {
      cryptanalystBtn?.click();
    });

    // Cryptanalyst starterWeapons are ["port_scan", "zero_day", "npm_install"]
    expect(container.textContent).toContain("[1] Port Scan");
    expect(container.textContent).toContain("[2] 0-Day");
    expect(container.textContent).toContain("[3] npm i");
    expect(container.textContent).toContain("[4] ---");
    expect(container.textContent).toContain("[5] ---");
  });

  it("should select and fire weapon on HUD hotbar button click", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const portScanBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("[2] Port Scan")
    );
    expect(portScanBtn).toBeTruthy();

    await act(async () => {
      portScanBtn?.click();
    });

    expect(portScanBtn?.className).toContain("bg-amber-500/20");
  });

  it("should prevent selection or firing of unassigned empty slots", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;

    // Press '4' (unassigned in Script Kiddie loadout)
    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "4",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    // Slot 1 (npm i) should remain active
    const npmBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("[1] npm i")
    );
    expect(npmBtn?.className).toContain("bg-amber-500/20");
  });

  it("should respond to directional keyboard input", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;

    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(mockPlayNote).toHaveBeenCalled();
  });

  it("should load existing high score from localStorage", async () => {
    mockStorage.setItem("retro_labyrinth_highscore", "15400");

    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    expect(container.textContent).toContain("15400");
  });

  it("should render Cyberdeck RAM, Crypto counter, and Class selector", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    expect(container.textContent).toContain("RAM");
    expect(container.textContent).toContain("Script Kiddie");
    expect(container.textContent).toContain("Chips");

    // Click class badge to open class selector modal
    const classBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Script Kiddie")
    );
    await act(async () => {
      classBtn?.click();
    });

    expect(container.textContent).toContain(
      "SELECT CYBERDECK FIRMWARE ARCHETYPE"
    );
    expect(container.textContent).toContain("Cryptanalyst");
    expect(container.textContent).toContain("APT Specialist");
  });

  it("should open Darknet Market modal and show vendor items", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const marketBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Market")
    );
    await act(async () => {
      marketBtn?.click();
    });

    expect(container.textContent).toContain("DARKNET EXPLOIT BLACK-MARKET");
    expect(container.textContent).toContain("Overclocked 16GB DDR5 RAM");
    expect(container.textContent).toContain("Hardware Jumper Bypass Chip");
  });

  it("should open CRT calibration modal and permit switching display presets", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const crtBtn = container.querySelector(
      "button[aria-label='Calibrate CRT Display & Phosphor Shaders']"
    );
    expect(crtBtn).toBeTruthy();

    await act(async () => {
      (crtBtn as HTMLButtonElement)?.click();
    });

    expect(container.textContent).toContain("CRT Display Calibration");
    expect(container.textContent).toContain("Display Archetype Presets");
    expect(container.textContent).toContain("Trinitron PVM Pro");
    expect(container.textContent).toContain("Amber Mainframe Terminal");

    // Click Trinitron preset
    const trinitronBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Trinitron PVM Pro")
    );
    expect(trinitronBtn).toBeTruthy();
    await act(async () => {
      trinitronBtn?.click();
    });

    const savedRaw = mockStorage.getItem("retro_labyrinth_crt_calibration");
    expect(savedRaw).toBeTruthy();
    const savedConfig = JSON.parse(savedRaw!);
    expect(savedConfig.phosphorMask).toBe("aperture-grille");
    expect(savedConfig.scanlinesEnabled).toBe(true);

    // Close modal
    const closeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Apply & Close")
    );
    await act(async () => {
      closeBtn?.click();
    });

    expect(container.textContent).not.toContain("Display Archetype Presets");
  });

  it("should memoize Traveling Salesman shortest tour calculation and skip recalculation on non-position state updates", async () => {
    const tourSpy = vi.spyOn(dungeon, "computeShortestTour");

    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const initialCallCount = tourSpy.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    // Trigger a non-coordinate state update, e.g. switching CRT phosphor theme
    const amberThemeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("title")?.includes("Amber Hacker")
    );
    expect(amberThemeBtn).toBeTruthy();

    await act(async () => {
      amberThemeBtn?.click();
    });

    // computeShortestTour should NOT have been called again during theme switch
    expect(tourSpy.mock.calls.length).toBe(initialCallCount);

    // Trigger a coordinate change by moving right
    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      );
    });

    // computeShortestTour SHOULD have been called when position updated
    expect(tourSpy.mock.calls.length).toBeGreaterThan(initialCallCount);

    tourSpy.mockRestore();
  });
});
