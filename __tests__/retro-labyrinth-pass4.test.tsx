// @vitest-environment jsdom
//
// Pass-4 arcade playtest of Retro Labyrinth:
// #1665 an enemy stepping onto the player ended the run at full HP, and each
//       campaign drone left a static copy on its spawn tile.
// #1667 retrying the boss room kept spent ammo, so the boss could not be
//       beaten, and the HUD never showed the boss's HP.
// #1668 crypto was added to the score again at every exit, and the last room
//       had no ending.
// #1669 the run kept going behind the Field Manual, ? never opened it from
//       the board, overlay keys scrolled the page, and picking a class
//       dropped the player into live boss fire.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DungeonRoom, Enemy, ItemPickup } from "@/lib/dungeon";

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
  };
});

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

describe("Retro Labyrinth pass-4 fixes", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    // Frames run only when a test advances the fake clock.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
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

  function score(): number {
    return Number(container.textContent?.match(/SCORE: (\d+)/)?.[1]);
  }

  function cryptoBalance(): number {
    const label = Array.from(container.querySelectorAll("span")).find((s) =>
      /^\d+ Crypto$/.test(s.textContent ?? "")
    );
    return Number(label?.textContent?.split(" ")[0]);
  }

  function status(): string | undefined {
    const output = Array.from(container.querySelectorAll("output")).find((o) =>
      o.textContent?.startsWith("Game Status:")
    );
    return output?.textContent?.replace("Game Status:", "").trim();
  }

  function position(): string | undefined {
    return container.textContent?.match(/Grid \((\d+, \d+)\)/)?.[1];
  }

  function isCaught(): boolean {
    return container.textContent?.includes("IP TRACE INTERCEPTED") ?? false;
  }

  async function press(key: string, target: HTMLElement = board()) {
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

  async function advance(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
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

  describe("enemy contact and drone copies (#1665)", () => {
    it("costs HP when an enemy walks into the player, and ends the run only at 0 HP", async () => {
      mockCampaign.build = (actual) => [
        plainRoom(actual, {
          enemies: [drone({ x: 2, y: 1, patrolDir: "left", minX: 1, maxX: 2 })],
        }),
        ...actual.generateRoguelikeCampaign().slice(1),
      ];
      await mount();
      expect(hp()).toBe(80);

      await advance(400);
      expect(hp()).toBe(55);
      expect(isCaught()).toBe(false);
      expect(status()).toBe("playing");

      // Advance in short slices so React commits between enemy steps.
      for (let i = 0; i < 40 && !isCaught(); i++) await advance(250);
      expect(hp()).toBe(0);
      expect(isCaught()).toBe(true);
    });

    it("leaves no static drone on the spawn tile once the drone moves", async () => {
      mockCampaign.build = (actual) => [
        plainRoom(actual, {
          enemies: [
            drone({ x: 3, y: 1, patrolDir: "right", minX: 3, maxX: 4 }),
          ],
        }),
        ...actual.generateRoguelikeCampaign().slice(1),
      ];
      await mount();
      await advance(400);

      await press("ArrowRight");
      await press("ArrowRight");
      expect(position()).toBe("3, 1");
      expect(hp()).toBe(80);
    });
  });

  describe("boss room retry (#1667)", () => {
    function bossRoom(actual: typeof import("@/lib/dungeon")): DungeonRoom[] {
      const room = actual.generateFaceForgeRoom();
      return [
        {
          ...room,
          grid: openGrid(),
          boss: actual.createFaceForgeBoss(4, 2),
          items: [],
          enemies: [drone({ x: 1, y: 6, minX: 1, maxX: 1 })],
        },
        ...actual.generateRoguelikeCampaign().slice(1),
      ];
    }

    function bossHud(): string | undefined {
      return container
        .querySelector('[data-testid="labyrinth-boss-hp"]')
        ?.lastElementChild?.textContent?.trim();
    }

    it("restores ammo on retry, so the boss can still be beaten", async () => {
      mockCampaign.build = bossRoom;
      await mount();
      expect(bossHud()).toBe("300");
      expect(container.textContent).toContain("Boss HP: 300 / 300");

      // Six npm install charges: 270 damage, 30 short of the boss's HP.
      for (let i = 0; i < 6; i++) await press("1");
      expect(bossHud()).toBe("30");

      // Die on the drone further down the room.
      for (let i = 0; i < 4; i++) await press("ArrowDown");
      for (let i = 0; i < 10 && !isCaught(); i++) await press("ArrowDown");
      expect(isCaught()).toBe(true);

      await act(async () => {
        button("RETRY BREACH")?.click();
      });
      expect(bossHud()).toBe("300");
      expect(button("[1] npm i")?.textContent).toContain("(12)");

      for (let i = 0; i < 6; i++) await press("1");
      // Two steps regain the RAM for the seventh charge.
      await press("ArrowRight");
      await press("ArrowRight");
      await press("1");
      expect(bossHud()).toBe("DOWN");
      expect(container.textContent).toContain("Boss defeated.");
    });
  });

  describe("scoring and the end of the run (#1668)", () => {
    function cryptoStash(): ItemPickup {
      return {
        id: "test-crypto",
        itemId: "crypto_stash",
        name: "Crypto Stash",
        x: 12,
        y: 7,
        symbol: "C",
        color: "#fbbf24",
        collected: false,
      };
    }

    // Four rooms: start two steps from the exit with a crypto stash between.
    function shortRun(actual: typeof import("@/lib/dungeon")): DungeonRoom[] {
      return Array.from({ length: 4 }, () =>
        plainRoom(actual, { startX: 11, startY: 7, items: [cryptoStash()] })
      );
    }

    async function clearRoom() {
      await press("ArrowRight");
      await press("ArrowRight");
    }

    it("adds each room's crypto to the score once", async () => {
      mockCampaign.build = shortRun;
      await mount();

      // Pickup 300, speed bonus 1000 - 2 x 20 = 960, this room's crypto 150.
      await clearRoom();
      expect(score()).toBe(1410);
      expect(container.textContent).toContain("Crypto Harvested: +150");

      await press("Enter");
      await clearRoom();
      expect(score()).toBe(2820);
      expect(container.textContent).toContain("Crypto Harvested: +150");

      await press("Enter");
      await clearRoom();
      expect(score()).toBe(4230);
    });

    it("ends the run after the last room and starts a new one from Room 01", async () => {
      mockCampaign.build = shortRun;
      await mount();
      for (let room = 0; room < 4; room++) {
        if (room > 0) await press("Enter");
        await clearRoom();
      }
      expect(score()).toBe(5640);
      expect(container.textContent).toContain("RUN COMPLETE");
      expect(container.textContent).toContain("High Score: 5640");
      expect(button("New Run")).toBeDefined();
      expect(button("Play Again")).toBeUndefined();

      await press("Enter");
      expect(status()).toBe("playing");
      expect(score()).toBe(0);
      expect(container.textContent).toContain("ROOM 01");
      expect(cryptoBalance()).toBe(0);
      expect(position()).toBe("11, 7");
    });
  });

  describe("overlays, the manual and class select (#1669)", () => {
    it("opens the manual with ? from the focused board and pauses the run", async () => {
      mockCampaign.build = (actual) => [
        plainRoom(actual, {}),
        ...actual.generateRoguelikeCampaign().slice(1),
      ];
      await mount();
      board().focus();
      expect(status()).toBe("playing");

      await press("?");
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
      expect(status()).toBe("paused");
    });

    it("pauses the run when the Manual button is clicked", async () => {
      await mount();
      const manual = container.querySelector<HTMLButtonElement>(
        'button[aria-label^="Open Field Manual"]'
      );
      await act(async () => {
        manual?.click();
      });
      expect(status()).toBe("paused");
    });

    it("consumes arrows and Space on the trace and victory overlays", async () => {
      mockCampaign.build = (actual) => [
        plainRoom(actual, {
          startX: 12,
          startY: 7,
          enemies: [drone({ x: 12, y: 6, minX: 12, maxX: 12 })],
        }),
        ...actual.generateRoguelikeCampaign().slice(1),
      ];
      await mount();
      for (let i = 0; i < 4; i++) await press("ArrowUp");
      expect(isCaught()).toBe(true);
      for (const key of ["ArrowUp", "ArrowDown", " ", "s", "PageDown"]) {
        expect((await press(key)).defaultPrevented, key).toBe(true);
      }

      await act(async () => {
        button("RETRY BREACH")?.click();
      });
      await press("ArrowRight");
      expect(container.textContent).toContain("MAINFRAME TIER BREACHED");
      expect((await press(" ")).defaultPrevented).toBe(true);
      expect((await press("ArrowDown")).defaultPrevented).toBe(true);

      // A focused overlay button keeps its native Space.
      const next = button("Next Room")!;
      expect((await press(" ", next)).defaultPrevented).toBe(false);
    });

    it("returns to a paused, restarted room after choosing a class", async () => {
      await mount();
      await press("ArrowDown");
      const badge = container.querySelector<HTMLButtonElement>(
        'button[title="Change Cyberdeck Class"]'
      );
      await act(async () => {
        badge?.click();
      });
      expect(status()).toBe("class_select");

      await act(async () => {
        button("Cryptanalyst")?.click();
      });
      expect(status()).toBe("paused");
      expect(hp()).toBe(100);
      expect(position()).toBe("1, 1");
    });

    it("comes back paused from the Market", async () => {
      await mount();
      await act(async () => {
        button("Market")?.click();
      });
      expect(status()).toBe("darknet_shop");
      await act(async () => {
        button("Close Darknet Market")?.click();
      });
      expect(status()).toBe("paused");
    });
  });
});
