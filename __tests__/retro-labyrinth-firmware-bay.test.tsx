// @vitest-environment jsdom
//
// #2085: the Firmware Bay spends banked crypto on tiers that change the next
// run's starting stats, and locked classes open on their milestones.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import type { DungeonRoom, Enemy } from "@/lib/dungeon";

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

// A two-room run of open rooms, each exit one step right of the start. Room 1
// stands in for FaceForge, so clearing it is the APT Specialist milestone and
// clearing room 2 finishes the run.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: (): DungeonRoom[] => {
      const base = actual.generateRoguelikeCampaign()[0];
      const grid = base.grid.map((row, y) =>
        row.map((_, x) =>
          y === 0 || x === 0 || y === base.grid.length - 1 || x === 14
            ? "#"
            : " "
        )
      );
      const drone: Enemy = {
        id: "test-drone",
        type: "drone",
        name: "Test Drone",
        x: 11,
        y: 7,
        hp: 40,
        maxHp: 40,
        state: "patrol",
        patrolDir: "right",
        minX: 11,
        maxX: 11,
        symbol: "D",
        color: "#38bdf8",
      };
      const room = (index: number, enemies: Enemy[]): DungeonRoom => ({
        ...base,
        index,
        grid: grid.map((row) => [...row]),
        startX: 12,
        startY: 7,
        exitX: 13,
        exitY: 7,
        enemies,
        items: [],
        boss: undefined,
        tspNodes: [],
        tspMovingWalls: [],
      });
      return [{ ...room(1, [drone]), id: "faceforge" }, room(2, [])];
    },
  };
});

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { FirmwareBay } from "@/components/retro-labyrinth/FirmwareBay";
import { DEFAULT_CYBERDECK_PROFILE, STORAGE_KEY_PROFILE } from "@/lib/dungeon";
import { safeRemoveItem } from "@/lib/safe-storage";

describe("Retro Labyrinth meta progression (#2085)", () => {
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

  function saved(): typeof DEFAULT_CYBERDECK_PROFILE {
    return JSON.parse(store[STORAGE_KEY_PROFILE]);
  }

  function findButton(label: RegExp): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll("button")).find((b) =>
      label.test(b.textContent ?? "")
    );
  }

  async function clickButton(label: RegExp) {
    const button = findButton(label);
    expect(button, String(label)).toBeDefined();
    await act(async () => {
      button!.click();
    });
  }

  async function step(key: "ArrowRight") {
    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    });
  }

  // The HUD's RAM readout, which shows the current RAM; a fresh run starts full.
  function ram(): string {
    return /RAM(\d+)🪙/.exec(container.textContent ?? "")?.[1] ?? "";
  }

  function chips(): string {
    return /Bypass Chips: (\d+)/.exec(container.textContent ?? "")?.[1] ?? "";
  }

  it("buys a tier, saves it, and applies it from the next run", async () => {
    store[STORAGE_KEY_PROFILE] = JSON.stringify({ totalCrypto: 1000 });
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    // Script Kiddie: 24 GB RAM and 2 bypass chips.
    expect(ram()).toBe("24");
    expect(chips()).toBe("2");

    await clickButton(/Script Kiddie/);
    await clickButton(/^Firmware Upgrades$/);
    const bay = container.querySelector(
      '[data-testid="labyrinth-firmware-bay"]'
    );
    expect(bay?.getAttribute("role")).toBe("dialog");
    expect(bay?.textContent).toContain("1000 Crypto Banked");

    const buyRam = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Buy RAM Expansion tier 1 for 300 crypto"]'
    );
    await act(async () => {
      buyRam!.click();
    });
    const buyChips = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Buy Chip Fabricator tier 1 for 300 crypto"]'
    );
    await act(async () => {
      buyChips!.click();
    });
    expect(saved().totalCrypto).toBe(400);
    expect(saved().firmwareUpgrades.maxRamTier).toBe(1);
    expect(saved().firmwareUpgrades.startChipsTier).toBe(1);
    expect(bay?.textContent).toContain("400 Crypto Banked");
    expect(bay?.textContent).toContain("Tier 1/3");
    // 400 crypto cannot buy RAM tier 2 at 700.
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Buy RAM Expansion tier 2 for 700 crypto"]'
      )?.disabled
    ).toBe(true);

    // The run under way keeps its stats.
    await clickButton(/^Close Firmware Bay$/);
    expect(ram()).toBe("24");

    // A new run starts with +8 GB RAM and +1 chip.
    await clickButton(/^Graveyard Roguelike$/);
    expect(ram()).toBe("32");
    expect(chips()).toBe("3");
  });

  it("offers every class to a player whose save predates the locks", async () => {
    store[STORAGE_KEY_PROFILE] = JSON.stringify({
      totalCrypto: 0,
      highScore: 0,
      runsCompleted: 2,
      unlockedClasses: ["script_kiddie", "cryptanalyst"],
      selectedClass: "script_kiddie",
    });
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    await clickButton(/Script Kiddie/);
    const apt = findButton(/APT Specialist/)!;
    expect(apt.getAttribute("aria-disabled")).toBeNull();
    expect(apt.textContent).not.toContain("Locked");
    await act(async () => {
      apt.click();
    });
    expect(container.textContent).toContain("💀APT Specialist");
  });

  it("keeps a locked class unpickable until its milestone, then saves it", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    await clickButton(/Script Kiddie/);
    const apt = findButton(/APT Specialist/)!;
    expect(apt.getAttribute("aria-disabled")).toBe("true");
    expect(apt.textContent).toContain("Locked");
    expect(apt.textContent).toContain("Clear the FaceForge boss room");
    await act(async () => {
      apt.click();
    });
    // Still on the picker, still Script Kiddie.
    expect(container.textContent).toContain(
      "SELECT CYBERDECK FIRMWARE ARCHETYPE"
    );
    await clickButton(/Confirm Loadout/);
    await act(async () => {
      findButton(/Resume/)?.click();
    });

    // Clearing the FaceForge room unlocks the APT Specialist.
    await step("ArrowRight");
    expect(
      container.querySelector('[data-testid="labyrinth-unlock-notice"]')
        ?.textContent
    ).toContain("APT Specialist");
    expect(saved().unlockedClasses).toContain("apt_specialist");
    expect(saved().unlockedClasses).not.toContain("hardware_hacker");

    // Finishing the run unlocks the Hardware Hacker, and the run-complete
    // card offers the Firmware Bay.
    await clickButton(/^Next Room$/);
    await step("ArrowRight");
    expect(container.textContent).toContain("RUN COMPLETE");
    expect(saved().unlockedClasses).toContain("hardware_hacker");
    expect(findButton(/^Firmware Upgrades$/)).toBeDefined();
  });
});

describe("FirmwareBay (#2085)", () => {
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
    container.remove();
  });

  it("marks maxed and unaffordable tracks in words and calls back", async () => {
    const onBuy = vi.fn();
    const onClose = vi.fn();
    await act(async () => {
      root.render(
        <FirmwareBay
          bankedCrypto={500}
          firmware={{
            maxRamTier: 3,
            scanSpeedTier: 1,
            exploitRadiusTier: 0,
            startChipsTier: 0,
          }}
          onBuy={onBuy}
          onClose={onClose}
        />
      );
    });
    const buttons = Array.from(container.querySelectorAll("button"));
    const ram = buttons.find((b) => b.textContent === "Maxed")!;
    expect(ram.disabled).toBe(true);
    expect(ram.getAttribute("aria-label")).toBe(
      "RAM Expansion is at its top tier"
    );
    const scan = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Buy Scan Accelerator tier 2 for 700 crypto"]'
    )!;
    expect(scan.disabled).toBe(true);
    const radius = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Buy Payload Amplifier tier 1 for 300 crypto"]'
    )!;
    expect(radius.disabled).toBe(false);
    expect(radius.className).toContain("min-h-11");
    await act(async () => {
      radius.click();
    });
    expect(onBuy).toHaveBeenCalledWith("exploitRadiusTier");

    await act(async () => {
      container
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
        );
    });
    expect(onClose).toHaveBeenCalled();
  });
});
