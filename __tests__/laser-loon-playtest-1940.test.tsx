// Laser Loon playtest fixes (#1940): truthful counters, keyboard aim,
// minions that shoot back from Act 3, par stars, and honest copy.
import React from "react";
import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  CAMPAIGN_ACTS,
  MINION_FIRE_MAX_SHOTS,
  getActProgressReadout,
  getActStars,
  pickKeyboardAim,
  updateMinionFire,
  type Target,
} from "@/lib/laser-loon";
import { LaserLoon } from "@/components/LaserLoon";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

function minion(overrides: Partial<Target> = {}): Target {
  return fromPartial<Target>({
    id: 1,
    x: 600,
    y: 200,
    vx: -1,
    vy: 0,
    radius: 16,
    type: "mosquito",
    label: "Mosquito",
    color: "#fff",
    hp: 1,
    maxHp: 1,
    points: 10,
    pulsePhase: 0,
    frozenTimer: 0,
    ...overrides,
  });
}

describe("Laser Loon act progress readout (#1940)", () => {
  it("clamps kills to the quota instead of reading 12/8", () => {
    const boss = { active: false, hp: 0, maxHp: 20 };
    expect(getActProgressReadout(12, 8, boss)).toEqual({
      label: "Kills",
      value: "8/8",
    });
    expect(getActProgressReadout(3, 8, boss).value).toBe("3/8");
  });

  it("switches to the boss's HP once the boss is up", () => {
    expect(
      getActProgressReadout(10, 8, { active: true, hp: 13.4, maxHp: 20 })
    ).toEqual({ label: "Boss", value: "14/20 HP" });
  });
});

describe("Laser Loon keyboard aim (#1940)", () => {
  it("aims at the nearest enemy ahead of the loon", () => {
    const aim = pickKeyboardAim(
      [
        minion({ id: 1, x: 700, y: 100 }),
        minion({ id: 2, x: 300, y: 190 }),
        minion({ id: 3, x: 80, y: 180 }),
      ],
      150,
      180
    );
    expect(aim).toEqual({ x: 300, y: 190 });
  });

  it("prefers a real enemy over an incoming shot", () => {
    const aim = pickKeyboardAim(
      [
        minion({ id: 1, x: 200, y: 180, isProjectile: true }),
        minion({ id: 2, x: 600, y: 180 }),
      ],
      150,
      180
    );
    expect(aim).toEqual({ x: 600, y: 180 });
  });

  it("fires straight ahead when the sky is clear", () => {
    expect(pickKeyboardAim([], 150, 180, 768)).toEqual({ x: 748, y: 180 });
  });
});

describe("Laser Loon minion fire (#1940)", () => {
  const ready = (overrides: Partial<Target> = {}) =>
    minion({ fireTimer: 10_000, ...overrides });

  it("stays quiet in Acts 1 and 2", () => {
    for (const actNumber of [1, 2]) {
      const result = updateMinionFire([ready()], 1, 120, 180, actNumber, 50);
      expect(result.fired).toBe(0);
      expect(result.targets).toHaveLength(1);
    }
  });

  it("fires an aimed shot at the loon from Act 3", () => {
    const result = updateMinionFire([ready()], 1, 120, 200, 3, 50);
    expect(result.fired).toBe(1);
    const shot = result.targets.find((t) => t.isProjectile);
    expect(shot?.id).toBe(50);
    expect(shot?.vx).toBeLessThan(0);
    expect(shot?.vy).toBeCloseTo(0);
    expect(result.nextId).toBe(51);
  });

  it("holds fire for frozen minions, bosses and minions behind the loon", () => {
    const result = updateMinionFire(
      [
        ready({ id: 1, frozenTimer: 30 }),
        ready({ id: 2, isBoss: true }),
        ready({ id: 3, x: 150 }),
      ],
      1,
      120,
      180,
      4,
      50
    );
    expect(result.fired).toBe(0);
  });

  it("never puts more than the cap in the air", () => {
    const crowd = Array.from({ length: 8 }, (_, i) =>
      ready({ id: i + 1, y: 60 + i * 30 })
    );
    const result = updateMinionFire(crowd, 1, 120, 180, 4, 100);
    expect(result.fired).toBe(MINION_FIRE_MAX_SHOTS);
  });

  it("staggers a fresh minion's first shot", () => {
    const result = updateMinionFire([minion()], 1, 120, 180, 3, 50, () => 0.5);
    expect(result.fired).toBe(0);
    expect(result.targets[0].fireTimer).toBeLessThan(0);
  });
});

describe("Laser Loon par stars (#1940)", () => {
  it("gives one star to clear, one for par and one for no hits", () => {
    expect(getActStars(30, 20, 2)).toBe(1);
    expect(getActStars(18, 20, 1)).toBe(2);
    expect(getActStars(30, 20, 0)).toBe(2);
    expect(getActStars(20, 20, 0)).toBe(3);
  });

  it("gives every act a par time", () => {
    for (const act of CAMPAIGN_ACTS) {
      expect(act.parSeconds).toBeGreaterThan(0);
    }
  });
});

describe("Laser Loon copy (#1940)", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "components/LaserLoon.tsx"),
    "utf8"
  );

  it("keeps the ending out of the Act 4 headline", () => {
    const finale = CAMPAIGN_ACTS[CAMPAIGN_ACTS.length - 1];
    expect(finale.newspaperHeadline).not.toMatch(/HISTORY WRITTEN|HOISTED/);
    expect(finale.victoryQuote).toMatch(/HISTORY WRITTEN/);
  });

  it("separates the game's ending from the real fundraiser", () => {
    expect(source).toContain("In this game");
    expect(source).toContain("In real life");
  });

  it("documents flying and pausing in the controls strip", () => {
    expect(source).toMatch(/WASD or arrows to fly/);
    expect(source).toMatch(/P or Esc to\s+pause/);
  });

  it("shows the best-score line only on run-ending cards", () => {
    expect(source.match(/previousBest=\{runStartBest\}/g)).toHaveLength(2);
  });
});

describe("Laser Loon arcade clock (#1940)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });
  afterEach(() => {
    cleanup();
  });

  it("reads 45s before an arcade run starts, not 999s", async () => {
    const { container } = render(<LaserLoon />);
    // A campaign run leaves its 999s clock behind.
    const playfield = container.querySelector(".arcade-shooter-playfield");
    if (!playfield) throw new Error("no playfield");
    await act(async () => {
      fireEvent.keyDown(playfield, { key: " " });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Arcade Survival/i }));
    });
    const hud = screen.getByLabelText("Game status");
    expect(hud.textContent).toContain("45s");
    expect(hud.textContent).not.toContain("999");
  });
});
