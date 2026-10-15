// @vitest-environment jsdom
//
// Retro Labyrinth playtest fixes (#1943): keys, tab order, room entry health,
// run totals and the trace card's cause. Harness from the pass-4 suite.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DungeonRoom, Enemy } from "@/lib/dungeon";

const mockCampaign = vi.hoisted(() => ({
  build: null as
    null | ((actual: typeof import("@/lib/dungeon")) => DungeonRoom[]),
}));

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playSuccess: vi.fn(),
      playNote: vi.fn(),
      playHover: vi.fn(),
      playAutocomplete: vi.fn(),
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: () =>
      mockCampaign.build
        ? mockCampaign.build(actual)
        : actual.generateRoguelikeCampaign(),
    // A fixed 4x4 terminal whose target is the first cell of row 1 then the
    // cell below it, so two clicks solve it.
    generateHexMatrixPuzzle: () => ({
      ...actual.generateHexMatrixPuzzle(1),
      grid: Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 4 }, (_, col) => ({
          row,
          col,
          byte:
            row === 0 && col === 0
              ? "AA"
              : row === 1 && col === 0
                ? "BB"
                : "11",
          selected: false,
        }))
      ),
      targetSequence: ["AA", "BB"],
    }),
  };
});

let contactSkew = 0;

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { RETRO_LABYRINTH_HIGH_SCORE_KEY } from "@/lib/dungeon";
import { safeRemoveItem } from "@/lib/safe-storage";

/** A 15x9 room of open floor inside a wall border. */
function openGrid(): string[][] {
  return Array.from({ length: 9 }, (_, y) =>
    Array.from({ length: 15 }, (_, x) =>
      y === 0 || y === 8 || x === 0 || x === 14 ? "#" : " "
    )
  );
}

function drone(overrides: Partial<Enemy>): Enemy {
  return {
    id: "test-drone",
    type: "drone",
    name: "Test Drone",
    x: 3,
    y: 1,
    hp: 40,
    maxHp: 40,
    state: "patrol",
    patrolDir: "right",
    symbol: "D",
    color: "#ef4444",
    ...overrides,
  };
}

/** Plain rooms with no boss, route nodes or moving walls. */
function plainRoom(
  actual: typeof import("@/lib/dungeon"),
  overrides: Partial<DungeonRoom>
): DungeonRoom {
  return {
    ...actual.generateBlinkBrowseRoom(),
    grid: openGrid(),
    startX: 1,
    startY: 1,
    enemies: [],
    items: [],
    ...overrides,
  };
}

describe("Retro Labyrinth playtest fixes (#1943)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    // Frames run only when a test advances the fake clock.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    // A contact hit protects the player for a moment (#2176). Each key
    // press here moves the contact clock past it, without running frames,
    // so repeated bumps each land.
    contactSkew = 0;
    const fakeNow = performance.now.bind(performance);
    vi.spyOn(performance, "now").mockImplementation(
      () => fakeNow() + contactSkew
    );
    // Before #1665 a 5% roll per frame gated each enemy step; pin it so the
    // old code would step on every frame.
    vi.spyOn(Math, "random").mockReturnValue(0);
    store = {};
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = String(value);
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {},
      },
    });
    safeRemoveItem(RETRO_LABYRINTH_HIGH_SCORE_KEY);
    const ctx = new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === "measureText"
            ? () => ({ width: 8 })
            : prop === "createRadialGradient" || prop === "createLinearGradient"
              ? () => ({ addColorStop: () => {} })
              : () => {},
        set: () => true,
      }
    );
    HTMLCanvasElement.prototype.getContext = fromAny(
      vi.fn(() => fromAny<CanvasRenderingContext2D, unknown>(ctx))
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    mockCampaign.build = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function board(): HTMLElement {
    return container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
  }

  function hp(): number {
    const label = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "HP"
    );
    return Number(label?.parentElement?.lastElementChild?.textContent);
  }

  function status(): string | undefined {
    const output = Array.from(container.querySelectorAll("output")).find((o) =>
      o.textContent?.startsWith("Game Status:")
    );
    return output?.textContent?.replace("Game Status:", "").trim();
  }

  function isCaught(): boolean {
    return container.textContent?.includes("IP TRACE INTERCEPTED") ?? false;
  }

  async function press(key: string, target: HTMLElement = board()) {
    contactSkew += 1000;
    let event: KeyboardEvent | undefined;
    await act(async () => {
      event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
    });
    return event!;
  }

  async function mount() {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
  }

  function button(text: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes(text)
    );
  }

  it("pauses on Escape as well as P", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, {}),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    await press("Escape");
    expect(status()).toBe("paused");
    await press("Escape");
    expect(status()).toBe("playing");
  });

  it("closes the Market on Escape", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, {}),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    await act(async () => {
      button("Market")?.click();
    });
    expect(status()).toBe("darknet_shop");
    await press("Escape");
    expect(status()).toBe("paused");
  });

  it("keeps the screen-reader action buttons out of the Tab order", async () => {
    await mount();
    const group = container.querySelector(
      '[aria-label="Interactive Navigation and Combat Actions"]'
    );
    const buttons = Array.from(group?.querySelectorAll("button") ?? []);
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b.tabIndex).toBe(-1);
  });

  // A drone beside the start: each bump into it costs 25 HP.
  function bruisingRun(actual: typeof import("@/lib/dungeon")): DungeonRoom[] {
    return [
      plainRoom(actual, {
        startX: 12,
        startY: 6,
        enemies: [drone({ x: 11, y: 6, minX: 11, maxX: 11 })],
      }),
      plainRoom(actual, { startX: 12, startY: 7 }),
      plainRoom(actual, { startX: 12, startY: 7 }),
      plainRoom(actual, { startX: 12, startY: 7 }),
    ];
  }

  it("opens the next room with at least half health", async () => {
    mockCampaign.build = bruisingRun;
    await mount();
    for (let i = 0; i < 3; i++) await press("ArrowLeft");
    expect(hp()).toBe(5);
    await press("ArrowDown");
    await press("ArrowRight");
    expect(status()).toBe("victory");
    // Enter asks about the unpicked reward first, then skips it (#2177).
    await press("Enter");
    await press("Enter");
    expect(hp()).toBe(40);
  });

  it("names what traced the player", async () => {
    mockCampaign.build = bruisingRun;
    await mount();
    for (let i = 0; i < 4; i++) await press("ArrowLeft");
    expect(isCaught()).toBe(true);
    expect(
      container.querySelector('[data-testid="labyrinth-trace-cause"]')
        ?.textContent
    ).toContain("patrolling security process");
  });

  it("reports the whole run on the run-complete card", async () => {
    mockCampaign.build = bruisingRun;
    await mount();
    // Room 01: down, right (2 moves). Rooms 02-04: right (1 move each).
    await press("ArrowDown");
    await press("ArrowRight");
    for (let room = 1; room < 4; room++) {
      await press("Enter");
      await press("Enter");
      await press("ArrowRight");
    }
    expect(container.textContent).toContain("RUN COMPLETE");
    expect(container.textContent).toContain("Run total: 5 moves");
    expect(
      container.querySelector('[data-testid="labyrinth-run-rooms"]')
        ?.textContent
    ).toBe("R01 2 · R02 1 · R03 1 · R04 1");
  });

  it("hands focus to Complete Decryption when the terminal is solved", async () => {
    mockCampaign.build = (actual) => {
      const grid = openGrid();
      grid[1][2] = "H";
      return [
        plainRoom(actual, { grid }),
        ...actual.generateRoguelikeCampaign().slice(1),
      ];
    };
    await mount();
    await press("ArrowRight");
    expect(status()).toBe("hacking");

    const cell = (byte: string) =>
      Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === byte && !b.disabled
      );
    await act(async () => {
      cell("AA")?.focus();
      cell("AA")?.click();
    });
    await act(async () => {
      cell("BB")?.focus();
      cell("BB")?.click();
    });
    expect(document.activeElement?.textContent).toBe("Complete Decryption");

    await press("Enter", document.activeElement as HTMLElement);
    expect(status()).toBe("playing");
  });

  it("lays a 4x4 terminal out as four cells per row (#2175)", async () => {
    mockCampaign.build = (actual) => {
      const grid = openGrid();
      grid[1][2] = "H";
      return [
        plainRoom(actual, { grid }),
        ...actual.generateRoguelikeCampaign().slice(1),
      ];
    };
    await mount();
    await press("ArrowRight");
    const hexGrid = container.querySelector<HTMLElement>(
      '[data-testid="labyrinth-hex-grid"]'
    );
    expect(hexGrid?.style.gridTemplateColumns).toBe(
      "repeat(4, minmax(0, 1fr))"
    );
    expect(hexGrid?.querySelectorAll("button")).toHaveLength(16);
  });

  it("runs the class picker as a dialog that takes focus and closes on Escape (#2179)", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, {}),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    await act(async () => {
      button("Script Kiddie")?.click();
    });
    expect(status()).toBe("class_select");
    const dialog = container.querySelector(
      '[data-testid="labyrinth-class-select"]'
    );
    expect(dialog?.getAttribute("role")).toBe("dialog");
    // The focus trap moves focus on its next tick.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(dialog?.contains(document.activeElement)).toBe(true);
    await press("Escape", document.activeElement as HTMLElement);
    expect(status()).toBe("paused");
    expect(board().contains(document.activeElement)).toBe(true);
  });
});
