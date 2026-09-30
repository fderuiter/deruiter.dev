// Reproduction for #1645: while a sprint is paused, every state-changing
// player action must be a no-op, so a paused player cannot defuse the
// meters or bank points with the clock stopped.
import { describe, it, expect } from "vitest";
import {
  createInitialDuckGameState,
  performTrick,
  giveTreat,
  throwBall,
  applySqueakyToy,
  applyKongToy,
  scrubBelly,
  interactStation,
  mopIndoorPuddle,
  startDraggingDuck,
  dragDuckTo,
  releaseDuck,
  enterBathtub,
  scrubBathtub,
  rinseBathtub,
  exitBathtub,
  enterDogPark,
  throwParkBall,
  jumpParkHurdle,
  steerParkDuck,
  tapParkWhistle,
  exitDogPark,
  activeCodeBurst,
  equipAccessory,
  BACK_DOOR_BOUNDS,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { DuckCommandHandler, InteractHazardHandler } from "@/lib/services";

function officeState(
  overrides: Partial<WorkingWithDuckState> = {}
): WorkingWithDuckState {
  const base = createInitialDuckGameState(1);
  return {
    ...base,
    status: "paused",
    excitement: 42,
    bladder: 70,
    naughtyVsGood: 15,
    totalScore: 1046,
    ...overrides,
  };
}

function parkState(): WorkingWithDuckState {
  const running = enterDogPark({ ...officeState(), status: "running" });
  return { ...running, status: "paused" };
}

function bathState(): WorkingWithDuckState {
  const running = enterBathtub({ ...officeState(), status: "running" });
  return { ...running, status: "paused" };
}

describe("Working With Duck: a paused sprint ignores player actions (#1645)", () => {
  type Setup = (s: WorkingWithDuckState) => WorkingWithDuckState;
  const asIs: Setup = (s) => s;
  const flop: Setup = (s) => ({ ...s, duck: { ...s.duck, state: "THE_FLOP" } });
  const noTakeThrow: Setup = (s) => ({
    ...s,
    duck: { ...s.duck, state: "NO_TAKE_THROW" },
  });
  const puddle: Setup = (s) => ({
    ...s,
    indoorPuddles: [{ id: 1, x: 300, y: 300, radius: 20, mopProgress: 0 }],
  });

  const officeActions: Array<
    [string, Setup, (s: WorkingWithDuckState) => WorkingWithDuckState]
  > = [
    ["performTrick SIT", asIs, (s) => performTrick(s, "SIT")],
    ["performTrick SPIN", asIs, (s) => performTrick(s, "SPIN")],
    ["giveTreat", asIs, (s) => giveTreat(s)],
    ["giveTreat (No Take Only Throw)", noTakeThrow, (s) => giveTreat(s)],
    ["throwBall", asIs, (s) => throwBall(s, 300, 300)],
    ["applySqueakyToy", asIs, (s) => applySqueakyToy(s, 400, 250)],
    ["applyKongToy", asIs, (s) => applyKongToy(s, 400, 250)],
    ["scrubBelly (The Flop)", flop, (s) => scrubBelly(s, s.duck.x, s.duck.y)],
    ["interactStation water", asIs, (s) => interactStation(s, "water")],
    ["interactStation food", asIs, (s) => interactStation(s, "food")],
    ["mopIndoorPuddle", puddle, (s) => mopIndoorPuddle(s, 300, 300)],
    ["startDraggingDuck", asIs, (s) => startDraggingDuck(s)],
    ["dragDuckTo", asIs, (s) => dragDuckTo(s, 700, 400)],
    ["activeCodeBurst", asIs, (s) => activeCodeBurst(s)],
    ["enterBathtub", asIs, (s) => enterBathtub(s)],
    ["enterDogPark", asIs, (s) => enterDogPark(s)],
  ];

  it.each(officeActions)("%s is a no-op while paused", (_name, setup, act) => {
    const paused = setup(officeState());
    const next = act(paused);
    expect(next).toBe(paused);
    expect(next.excitement).toBe(42);
    expect(next.totalScore).toBe(1046);
  });

  it.each(officeActions)(
    "%s still changes the game while running",
    (_name, setup, act) => {
      const running = setup(officeState({ status: "running" }));
      // activeCodeBurst is rate-limited but always acts on the first burst.
      expect(act(running)).not.toBe(running);
    }
  );

  it("returns the same state object for a paused trick and treat", () => {
    const paused = officeState();
    expect(performTrick(paused, "SIT")).toBe(paused);
    expect(giveTreat(paused)).toBe(paused);
    expect(startDraggingDuck(paused)).toBe(paused);
    expect(dragDuckTo(paused, 700, 400)).toBe(paused);
  });

  it("does not drop a held Duck at the Back Door while paused", () => {
    const held = officeState({
      duck: {
        ...officeState().duck,
        state: "DRAGGED",
        x: BACK_DOOR_BOUNDS.x + 10,
        y: BACK_DOOR_BOUNDS.y + 10,
      },
    });
    const next = releaseDuck(held);
    expect(next).toBe(held);
    expect(next.bladder).toBe(70);
    expect(next.totalScore).toBe(1046);
  });

  it("freezes the Dog Park while paused", () => {
    const paused = parkState();
    expect(throwParkBall(paused, 5, -3)).toBe(paused);
    expect(jumpParkHurdle(paused)).toBe(paused);
    expect(steerParkDuck(paused, 100)).toBe(paused);
    expect(tapParkWhistle(paused)).toBe(paused);
    expect(exitDogPark(paused, true)).toBe(paused);
  });

  it("freezes the Bathtub while paused", () => {
    const paused = bathState();
    expect(scrubBathtub(paused, 400, 250)).toBe(paused);
    expect(rinseBathtub(paused)).toBe(paused);
    expect(exitBathtub(paused)).toBe(paused);
  });

  it("still lets the wardrobe equip an unlocked accessory while paused", () => {
    // The wardrobe dialog pauses the sprint itself, so equipping has to work
    // while paused; it changes no meter or score.
    const paused = officeState({ unlockedAccessories: ["bandana"] });
    const next = equipAccessory(paused, "bandana");
    expect(next.activeAccessory).toBe("bandana");
    expect(next.totalScore).toBe(paused.totalScore);
  });

  it("leaves the same actions working once the sprint is running", () => {
    const running = officeState({ status: "running" });
    expect(giveTreat(running).excitement).toBeLessThan(42);
    expect(performTrick(running, "SIT").activeTrick).not.toBeNull();
    expect(startDraggingDuck(running).duck.state).toBe("DRAGGED");
  });

  it("the command and hazard services pass a paused state through unchanged", () => {
    const paused = officeState();
    const commands = new DuckCommandHandler();
    for (const input of [
      { type: "treat" as const, state: paused },
      { type: "trick" as const, state: paused, trick: "HIGH_FIVE" as const },
      { type: "station" as const, state: paused, station: "water" as const },
      {
        type: "throw_ball" as const,
        state: paused,
        targetX: 200,
        targetY: 200,
      },
    ]) {
      const res = commands.execute(input);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.state).toBe(paused);
    }

    const hazards = new InteractHazardHandler();
    const hazardId = paused.hazards[0]?.id;
    const chewed = {
      ...paused,
      hazards: paused.hazards.map((h, i) =>
        i === 0 ? { ...h, isChewed: true } : h
      ),
    };
    for (const input of [
      { state: paused, action: "distract_with_squeaky" as const },
      { state: paused, action: "distract_with_kong" as const },
      { state: chewed, action: "fix_hazard" as const, hazardId },
    ]) {
      const res = hazards.execute(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.state).toBe(input.state);
        expect(res.data.scoreBonus).toBe(0);
      }
    }
  });
});
