// @vitest-environment node
// Retro Labyrinth polish (#2291): the pure run rules the cabinet applies.
import { describe, it, expect } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  MARKET_CLOSED_REASON,
  formatRunTime,
  holdBossSpin,
  isMarketOpen,
  rewardUnavailableReasons,
  slotUnavailableMessage,
  stillParticles,
} from "@/components/retro-labyrinth/run-rules";
import {
  drawRunRewards,
  generateRoguelikeCampaign,
  type BossState,
  type ParticleEffect,
} from "@/lib/dungeon";
import { FINAL_ROOM_HINT } from "@/components/retro-labyrinth/control-hints";

describe("the Market opens only at the rest stop (N1)", () => {
  const library = generateRoguelikeCampaign();
  const byId = (id: string) => library.find((room) => room.id === id);

  it("is open in the Darknet Vault and shut in the other run rooms", () => {
    // The run's Darknet Vault is the billable_hours room.
    expect(isMarketOpen("roguelike", byId("billable_hours"))).toBe(true);
    expect(isMarketOpen("roguelike", { id: "darknet_vault" })).toBe(true);
    for (const id of ["dmz_gateway", "tsp", "faceforge", "neural_warden"]) {
      const room = byId(id);
      expect(room).toBeDefined();
      expect(isMarketOpen("roguelike", room)).toBe(false);
    }
  });

  it("stays open in the classic stages, which have no route", () => {
    expect(isMarketOpen("classic", undefined)).toBe(true);
  });

  it("gives a short reason", () => {
    expect(MARKET_CLOSED_REASON).toBe("Market opens at the rest stop");
  });
});

describe("a Patch Kit at full HP (N2)", () => {
  const offer = drawRunRewards("LAB-TEST01", 0, ["npm_install"]);

  it("says HP full at full health and nothing otherwise", () => {
    const healAt = offer.findIndex((reward) => reward.kind === "heal");
    expect(rewardUnavailableReasons(offer, 80, 80)[healAt]).toBe("HP full");
    expect(rewardUnavailableReasons(offer, 79, 80)[healAt]).toBeNull();
  });

  it("never blocks a weapon or a passive", () => {
    const reasons = rewardUnavailableReasons(offer, 80, 80);
    offer.forEach((reward, i) => {
      if (reward.kind !== "heal") expect(reasons[i]).toBeNull();
    });
  });
});

describe("an empty tool slot (N4)", () => {
  it("names the empty slot and where tools come from", () => {
    expect(slotUnavailableMessage(3, undefined)).toBe(
      "Slot 4 is empty. Rewards fill slots 4 and 5"
    );
  });

  it("names a spent tool", () => {
    expect(slotUnavailableMessage(0, "npm install")).toBe(
      "Slot 1: npm install is out of ammo"
    );
  });
});

describe("reduced motion (N8)", () => {
  it("stops every particle of a burst and spreads them along their paths", () => {
    const burst: ParticleEffect[] = [
      {
        x: 5,
        y: 5,
        vx: 2.5,
        vy: 0,
        color: "#fff",
        alpha: 1,
        decay: 0.03,
        radius: 3,
      },
      {
        x: 5,
        y: 5,
        vx: 0,
        vy: -2.5,
        color: "#fff",
        alpha: 1,
        decay: 0.03,
        radius: 3,
      },
    ];
    const still = stillParticles(burst);
    expect(still.every((p) => p.vx === 0 && p.vy === 0)).toBe(true);
    expect(still[0].x).toBeCloseTo(6);
    expect(still[1].y).toBeCloseTo(4);
    // The input burst is not changed.
    expect(burst[0].vx).toBe(2.5);
  });

  it("holds the boss mesh at its old angle and keeps the rest of the frame", () => {
    const mesh = {
      vertices: [],
      edges: [],
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      rotSpeed: { x: 1, y: 1, z: 1 },
      scale: 1,
      color: "#f00",
    };
    const before = fromPartial<BossState>({ hp: 100, mesh });
    const after = fromPartial<BossState>({
      hp: 90,
      mesh: { ...mesh, rotation: { x: 1, y: 2, z: 3 }, color: "#0f0" },
    });
    const held = holdBossSpin(before, after);
    expect(held.mesh.rotation).toEqual({ x: 0.1, y: 0.2, z: 0.3 });
    expect(held.mesh.color).toBe("#0f0");
    expect(held.hp).toBe(90);
  });
});

describe("the run-complete card (N11, N12)", () => {
  it("offers only a new run on the keyboard", () => {
    expect(FINAL_ROOM_HINT.desktop).toBe("Enter for a new run from Room 01");
    expect(FINAL_ROOM_HINT.desktop).not.toMatch(/\bR\b/);
  });

  it("formats the run time as minutes and seconds", () => {
    expect(formatRunTime(0)).toBe("0:00");
    expect(formatRunTime(65_000)).toBe("1:05");
    expect(formatRunTime(128_400)).toBe("2:08");
    expect(formatRunTime(-5)).toBe("0:00");
  });
});
