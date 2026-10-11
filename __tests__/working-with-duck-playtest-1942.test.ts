// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createInitialDuckGameState,
  enterBathtub,
  enterDogPark,
  exitBathtub,
  exitDogPark,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";

const running = (over: Partial<WorkingWithDuckState> = {}) => ({
  ...createInitialDuckGameState(1),
  status: "running" as const,
  excitement: 52,
  bladder: 37,
  ...over,
});

describe("Working With Duck playtest fixes (#1942)", () => {
  it("an instant Dog Park round trip only takes the edge off the meters", () => {
    const back = exitDogPark(enterDogPark(running()), false);
    expect(back.inDogPark).toBe(false);
    expect(back.excitement).toBe(37);
    expect(back.bladder).toBe(17);
    expect(back.calmBuffTimer).toBe(0);
  });

  it("a completed fetch still settles the duck fully", () => {
    const park = enterDogPark(running());
    const fetched = {
      ...park,
      parkState: { ...park.parkState, status: "success" as const },
    };
    const back = exitDogPark(fetched, true);
    expect(back.excitement).toBe(0);
    expect(back.bladder).toBe(0);
    expect(back.calmBuffTimer).toBeGreaterThan(0);
  });

  it("closes the Dog Park for a while after a trip", () => {
    const back = exitDogPark(enterDogPark(running()), false);
    const again = enterDogPark(back);
    expect(again.inDogPark).toBe(false);
    expect(again.floatingAlerts.at(-1)?.text).toMatch(/Park opens again/);
    const later = enterDogPark({
      ...back,
      ticks: (back.parkReadyAtTick ?? 0) + 1,
    });
    expect(later.inDogPark).toBe(true);
  });

  it("a bath with no mud is a small treat, not +35 Good Boy", () => {
    const start = running({ naughtyVsGood: 15, isMuddy: false });
    const tub = enterBathtub(start);
    const rinsed = {
      ...tub,
      bathtubState: { ...tub.bathtubState, status: "clean" as const },
    };
    const done = exitBathtub(rinsed);
    expect(done.naughtyVsGood).toBe(20);
    expect(done.totalScore - start.totalScore).toBe(20);
  });

  it("washing off park mud keeps the full reward", () => {
    const start = running({ naughtyVsGood: 15, isMuddy: true });
    const tub = enterBathtub(start);
    const rinsed = {
      ...tub,
      bathtubState: { ...tub.bathtubState, status: "clean" as const },
    };
    const done = exitBathtub(rinsed);
    expect(done.naughtyVsGood).toBe(50);
    expect(done.isMuddy).toBe(false);
  });
});
