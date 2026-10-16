// @vitest-environment jsdom
//
// Retro Labyrinth polish (#2291): the Market at the rest stop, feedback for an
// empty tool slot, the room and run cards, and the side-effect strip. Harness
// from the #1943 playtest suite.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { cleanup, render, screen } from "@testing-library/react";
import type { DungeonRoom, Enemy } from "@/lib/dungeon";

const mockCampaign = vi.hoisted(() => ({
  build: null as
    null | ((actual: typeof import("@/lib/dungeon")) => DungeonRoom[]),
}));
const announced = vi.hoisted(() => ({ messages: [] as string[] }));

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

vi.mock("@/hooks/useAnnouncer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useAnnouncer")>();
  const announce = (message: string) => {
    announced.messages.push(message);
  };
  return { ...actual, useAnnouncer: () => ({ announce }) };
});

vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: () =>
      mockCampaign.build
        ? mockCampaign.build(actual)
        : actual.generateRoguelikeCampaign(),
  };
});

let contactSkew = 0;

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { RoomClearedCard } from "@/components/retro-labyrinth/RoomClearedCard";
import {
  RETRO_LABYRINTH_HIGH_SCORE_KEY,
  drawRunRewards,
  type RunReward,
} from "@/lib/dungeon";
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

/** Four rooms; the first has a drone to bump three times, 25 HP each. */
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

describe("Retro Labyrinth polish in play (#2291)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    contactSkew = 0;
    const fakeNow = performance.now.bind(performance);
    vi.spyOn(performance, "now").mockImplementation(
      () => fakeNow() + contactSkew
    );
    vi.spyOn(Math, "random").mockReturnValue(0);
    announced.messages = [];
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

  function status(): string | undefined {
    const output = Array.from(container.querySelectorAll("output")).find((o) =>
      o.textContent?.startsWith("Game Status:")
    );
    return output?.textContent?.replace("Game Status:", "").trim();
  }

  async function press(key: string) {
    contactSkew += 1000;
    await act(async () => {
      board().dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    });
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

  it("opens the Market at the rest stop (N1)", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, { id: "darknet_vault" }),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    expect(button("Market")?.disabled).toBe(false);
    expect(
      container.querySelector('[data-testid="labyrinth-market-closed"]')
    ).toBeNull();
    await act(async () => {
      button("Market")?.click();
    });
    expect(container.textContent).toContain("DARKNET EXPLOIT BLACK-MARKET");
  });

  it("keeps the Market shut in a room that is not the rest stop (N1)", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, {}),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    expect(button("Market")?.disabled).toBe(true);
    expect(container.textContent).toContain("Market opens at the rest stop");
  });

  it("says so when an empty tool slot is pressed (N4)", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, {}),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    await press("4");
    await press("5");
    expect(announced.messages).toEqual([
      "Slot 4 is empty. Rewards fill slots 4 and 5",
      "Slot 5 is empty. Rewards fill slots 4 and 5",
    ]);
  });

  it("shows one EMP button for slot 3 and Space (N4)", async () => {
    await mount();
    expect(button("[3/SPACE] EMP")).toBeDefined();
    expect(button("[SPACE] EMP")).toBeUndefined();
  });

  it("greys out the Patch Kit at full HP (N2)", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, { startX: 12, startY: 7 }),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    await press("ArrowRight");
    expect(status()).toBe("victory");
    const kit = button("Patch Kit");
    expect(kit?.disabled).toBe(true);
    expect(kit?.textContent).toContain("HP full");
  });

  it("reports damage, run time and room names, and ignores R once the run is over (N11, N12)", async () => {
    mockCampaign.build = bruisingRun;
    await mount();
    for (let i = 0; i < 3; i++) await press("ArrowLeft");
    await press("ArrowDown");
    await press("ArrowRight");
    for (let room = 1; room < 4; room++) {
      await press("Enter");
      await press("Enter");
      await press("ArrowRight");
    }
    expect(container.textContent).toContain("RUN COMPLETE");
    const stats = container.querySelector(
      '[data-testid="labyrinth-run-stats"]'
    )?.textContent;
    expect(stats).toContain("Damage taken: 75 HP");
    expect(stats).toMatch(/Run time: \d+:\d{2}/);
    expect(
      container.querySelector('[data-testid="labyrinth-run-rooms"]')
        ?.textContent
    ).toBe(
      "R01 BlinkBrowse 2 · R02 BlinkBrowse 1 · R03 BlinkBrowse 1 · R04 BlinkBrowse 1"
    );
    expect(container.textContent).not.toContain("R to retry this room");
    // R used to replay the last room after the run had ended.
    await press("r");
    expect(status()).toBe("victory");
    expect(container.textContent).toContain("RUN COMPLETE");
  });

  it("lays the side-effect strip over the board instead of above it (N7)", async () => {
    mockCampaign.build = (actual) => [
      plainRoom(actual, {}),
      ...actual.generateRoguelikeCampaign().slice(1),
    ];
    await mount();
    await press("1");
    const strip = container.querySelector(
      '[data-testid="labyrinth-side-effect"]'
    );
    expect(strip).not.toBeNull();
    expect(strip?.className).toContain("absolute");
    expect(strip?.closest(".arcade-labyrinth-canvas")).not.toBeNull();
  });
});

describe("RoomClearedCard copy (#2291)", () => {
  afterEach(() => {
    cleanup();
  });

  const base = {
    campaignRoomCount: 6,
    runMoves: [12, 9],
    runCrypto: 300,
    movesCount: 9,
    roomCrypto: 100,
    score: 1320,
    highScore: 1500,
    hint: "Enter to continue",
    onNextRoom: vi.fn(),
    onRestart: vi.fn(),
  };

  it('says "Score" until the run ends and "Final Score" after (N5)', () => {
    const { unmount } = render(
      <RoomClearedCard {...base} isFinalRoom={false} showNextRoom />
    );
    expect(screen.queryByText(/Final Score/)).toBeNull();
    expect(screen.getByText(/^Score:/)).toBeTruthy();
    unmount();
    render(
      <RoomClearedCard {...base} isFinalRoom={true} showNextRoom={false} />
    );
    expect(screen.getByText(/Final Score/)).toBeTruthy();
  });

  it("says the crypto was earned, not what is left to spend (N3)", () => {
    render(<RoomClearedCard {...base} isFinalRoom={false} showNextRoom />);
    expect(document.body.textContent).toContain("Crypto earned: +100");
  });

  it("disables an unavailable reward and shows why (N2)", () => {
    const offer: RunReward[] = drawRunRewards("LAB-TEST01", 0, ["npm_install"]);
    const onSelect = vi.fn();
    render(
      <RoomClearedCard
        {...base}
        isFinalRoom={false}
        showNextRoom
        rewards={{
          offer,
          selected: null,
          onSelect,
          unavailable: offer.map((r) => (r.kind === "heal" ? "HP full" : null)),
        }}
      />
    );
    const kit = screen.getByRole("button", { name: /Patch Kit/ });
    expect((kit as HTMLButtonElement).disabled).toBe(true);
    expect(kit.textContent).toContain("HP full");
    kit.click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
