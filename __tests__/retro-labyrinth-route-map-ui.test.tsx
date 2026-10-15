// @vitest-environment jsdom
//
// #2084: the room-cleared screen shows the run's route map, offers a choice
// of next rooms and a 1-of-3 reward, and a picked reward lasts the run.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import type { DungeonRoom } from "@/lib/dungeon";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

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
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

const SEED = "LAB-TEST01";

// The real seven-room library with every room opened up: no walls, enemies,
// pickups, bosses or route nodes, and the exit one step right of the start.
// The route logic sees the real room ids, so it plans the real six-room run.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    createRunSeed: () => SEED,
    generateRoguelikeCampaign: (): DungeonRoom[] =>
      actual.generateRoguelikeCampaign().map((room) => ({
        ...room,
        grid: room.grid.map((row, y) =>
          row.map((_, x) =>
            y === 0 || x === 0 || y === room.grid.length - 1 || x === 14
              ? "#"
              : x === 13 && y === 7
                ? "E"
                : " "
          )
        ),
        startX: 12,
        startY: 7,
        exitX: 13,
        exitY: 7,
        enemies: [],
        items: [],
        boss: undefined,
        tspNodes: [],
        tspMovingWalls: [],
      })),
  };
});

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import {
  STORAGE_KEY_PROFILE,
  drawRouteOptions,
  generateRoguelikeCampaign,
  routeRoomName,
  startRunRoute,
} from "@/lib/dungeon";
import { safeRemoveItem } from "@/lib/safe-storage";

describe("Retro Labyrinth route map and reward pick (#2084)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
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
    safeRemoveItem(STORAGE_KEY_PROFILE);
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
    safeRemoveItem(STORAGE_KEY_PROFILE);
    vi.useRealTimers();
  });

  const board = () =>
    container.querySelector('[data-keyboard-boundary="true"]') as HTMLElement;

  async function key(name: string, target: HTMLElement = board()) {
    await act(async () => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: name,
          bubbles: true,
          cancelable: true,
        })
      );
    });
  }

  async function click(button: HTMLElement) {
    await act(async () => {
      button.click();
    });
  }

  function group(name: string): HTMLElement {
    const heading = Array.from(container.querySelectorAll("h3")).find(
      (h) => h.textContent === name
    );
    expect(heading, name).toBeDefined();
    return container.querySelector(
      `[aria-labelledby="${heading!.id}"]`
    ) as HTMLElement;
  }

  const buttonsIn = (el: HTMLElement) =>
    Array.from(el.querySelectorAll("button"));

  const slotFour = () =>
    Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").startsWith("[4]")
    );

  function runsCompleted(): number {
    const raw = store[STORAGE_KEY_PROFILE];
    return raw
      ? (JSON.parse(raw) as { runsCompleted: number }).runsCompleted
      : 0;
  }

  async function mount() {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
  }

  it("shows the seeded map and lets the player choose the next room and a reward", async () => {
    await mount();
    expect(container.textContent).toContain("Room 1 of 6");
    await key("ArrowRight");
    expect(container.textContent).toContain("MAINFRAME TIER BREACHED");

    const map = container.querySelector('ol[aria-label="Route map"]');
    expect(map?.querySelectorAll("li")).toHaveLength(6);
    expect(
      container.querySelector('[data-testid="labyrinth-run-seed"]')?.textContent
    ).toBe(SEED);

    const library = generateRoguelikeCampaign();
    const expected = drawRouteOptions(library, startRunRoute(SEED)).map((i) =>
      routeRoomName(library[i])
    );
    const rooms = buttonsIn(group("Choose the next room"));
    expect(rooms.map((b) => b.querySelector("span")?.textContent)).toEqual(
      expected
    );
    // The first room is chosen until the player picks the other.
    expect(rooms.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
    ]);
    for (const b of rooms) expect(b.className).toContain("min-h-11");

    const rewards = buttonsIn(group("Pick a reward"));
    expect(rewards).toHaveLength(3);
    expect(rewards.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "false",
    ]);

    await click(rooms[1]);
    await click(rewards[0]);
    expect(rooms[1].getAttribute("aria-pressed")).toBe("true");
    expect(rewards[0].getAttribute("aria-pressed")).toBe("true");
    const weaponName = rewards[0].querySelectorAll("span")[1].textContent;
    expect(
      container.querySelector('[data-testid="labyrinth-next-pick"]')
        ?.textContent
    ).toBe(`Next: ${expected[1]} · Reward: ${weaponName}`);

    // Tapping a picked reward again leaves it.
    await click(rewards[0]);
    expect(rewards[0].getAttribute("aria-pressed")).toBe("false");
    await click(rewards[0]);

    expect(slotFour()?.textContent).toContain("---");
    const next = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Next Room"
    );
    await click(next!);
    expect(container.textContent).toContain("Room 2 of 6");
    expect(slotFour()?.textContent).not.toContain("---");

    await key("ArrowRight");
    const step = container.querySelectorAll('ol[aria-label="Route map"] li')[1];
    expect(step.textContent).toContain(expected[1]);
    expect(step.textContent).toContain("you are here");
  });

  it("keeps a picked weapon through later rooms and counts the run once", async () => {
    await mount();
    await key("ArrowRight");
    await click(buttonsIn(group("Pick a reward"))[0]);
    await key("Enter");
    const tool = slotFour()?.textContent;
    expect(tool).not.toContain("---");

    // Rooms 2 to 5, taking no reward: the weapon stays in slot 4.
    for (let room = 2; room <= 5; room++) {
      expect(container.textContent).toContain(`Room ${room} of 6`);
      await key("ArrowRight");
      expect(runsCompleted()).toBe(0);
      // Enter with no pick asks first; a second Enter skips (#2177).
      await key("Enter");
      await key("Enter");
      expect(slotFour()?.textContent?.split("(")[0]).toBe(tool?.split("(")[0]);
    }
    expect(container.textContent).toContain("Room 6 of 6");
    await key("ArrowRight");
    expect(container.textContent).toContain("RUN COMPLETE");
    expect(container.querySelector('ol[aria-label="Route map"]')).toBeNull();
    expect(runsCompleted()).toBe(1);
  });

  it("asks before Enter skips the reward, then skips on a second Enter (#2177)", async () => {
    await mount();
    await key("ArrowRight");
    await key("Enter");
    expect(container.textContent).toContain("MAINFRAME TIER BREACHED");
    expect(container.textContent).toContain("Room 1 of 6");
    expect(
      container.querySelector('[data-testid="labyrinth-reward-prompt"]')
        ?.textContent
    ).toContain("press Enter again to skip");
    await key("Enter");
    expect(container.textContent).toContain("Room 2 of 6");
    expect(slotFour()?.textContent).toContain("---");
  });

  it("lets Enter on a focused pick select it rather than leave the room", async () => {
    await mount();
    await key("ArrowRight");
    const option = buttonsIn(group("Choose the next room"))[1];
    option.focus();
    await key("Enter", option);
    expect(container.textContent).toContain("MAINFRAME TIER BREACHED");
    expect(container.textContent).toContain("Room 1 of 6");
  });

  it("applies a passive on entry and keeps it through a retry", async () => {
    await mount();
    expect(container.textContent).toContain("RAM24");
    await key("ArrowRight");
    const rewards = buttonsIn(group("Pick a reward"));
    expect(rewards[1].textContent).toContain("Patch Kit");
    // This seed's first passive is the DDR5 Bank: +16 max RAM.
    expect(rewards[2].textContent).toContain("DDR5 Bank");
    await click(rewards[2]);
    await key("Enter");
    expect(container.textContent).toContain("Room 2 of 6");
    expect(container.textContent).toContain("RAM40");
    // R retries the cleared room; the passive was taken on the way in.
    await key("ArrowRight");
    await key("r");
    expect(container.textContent).toContain("Room 2 of 6");
    expect(container.textContent).toContain("RAM40");
  });
});
