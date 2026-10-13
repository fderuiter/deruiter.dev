import { describe, it, expect } from "vitest";
import { patrolThreat } from "@/components/retro-labyrinth/threat";

describe("patrolThreat (phone fairness)", () => {
  const player = { x: 5, y: 5 };
  const patrol = (x: number, y: number) => ({ x, y, state: "patrol" });

  it("is red when a live patrol is one orthogonal step away", () => {
    for (const cell of [
      { x: 4, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 4 },
      { x: 5, y: 6 },
    ]) {
      expect(patrolThreat(player, [patrol(cell.x, cell.y)])).toBe("red");
    }
  });

  it("is amber when a live patrol is two steps away", () => {
    expect(patrolThreat(player, [patrol(3, 5)])).toBe("amber");
    expect(patrolThreat(player, [patrol(6, 6)])).toBe("amber");
    expect(patrolThreat(player, [patrol(4, 4)])).toBe("amber");
  });

  it("is none for a patrol three or more steps away", () => {
    expect(patrolThreat(player, [patrol(2, 5)])).toBe("none");
    expect(patrolThreat(player, [patrol(12, 1)])).toBe("none");
  });

  it("skips stunned and frozen patrols, which cannot step", () => {
    expect(patrolThreat(player, [{ x: 4, y: 5, state: "stunned" }])).toBe(
      "none"
    );
    expect(patrolThreat(player, [{ x: 4, y: 5, state: "frozen" }])).toBe(
      "none"
    );
    expect(patrolThreat(player, [{ x: 6, y: 5, state: "stunned" }])).toBe(
      "none"
    );
    expect(patrolThreat(player, [{ x: 5, y: 7, state: "frozen" }])).toBe(
      "none"
    );
  });

  it("does not let a stunned patrol hide a live one nearby", () => {
    expect(
      patrolThreat(player, [{ x: 4, y: 5, state: "stunned" }, patrol(3, 5)])
    ).toBe("amber");
  });

  it("is none with no patrols in the room", () => {
    expect(patrolThreat(player, [])).toBe("none");
  });

  it("reports the closest live patrol when several are present", () => {
    expect(patrolThreat(player, [patrol(0, 0), patrol(5, 6)])).toBe("red");
    expect(patrolThreat(player, [patrol(0, 0), patrol(3, 5)])).toBe("amber");
  });
});
