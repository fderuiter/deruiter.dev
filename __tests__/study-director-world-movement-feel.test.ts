// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CRO_FLOOR,
  WALK_MINUTES_PER_TILE,
  forgivingStep,
  isBlocked,
  newWorld,
  passTime,
  startDay,
  step,
  stepFrom,
  tileAt,
  type Facing,
  type TilePoint,
  type WorldState,
} from "@/lib/study-director-world";

const fresh = (): WorldState => startDay(newWorld("feel-1", "standard")).world;

const SIDEWAYS: Record<Facing, [Facing, Facing]> = {
  up: ["left", "right"],
  down: ["left", "right"],
  left: ["up", "down"],
  right: ["up", "down"],
};

/** A tile one off a doorway, pressed toward the wall beside the door. */
function offsetFromDoor(): { at: TilePoint; facing: Facing; slideTo: Facing } {
  for (let y = 0; y < CRO_FLOOR.height; y += 1)
    for (let x = 0; x < CRO_FLOOR.width; x += 1) {
      if (isBlocked(CRO_FLOOR, x, y)) continue;
      for (const facing of ["up", "down", "left", "right"] as Facing[]) {
        const ahead = stepFrom({ x, y }, facing);
        if (tileAt(CRO_FLOOR, ahead.x, ahead.y) !== "wall") continue;
        const open = SIDEWAYS[facing].filter((side) => {
          const beside = stepFrom({ x, y }, side);
          const beyond = stepFrom(beside, facing);
          return (
            !isBlocked(CRO_FLOOR, beside.x, beside.y) &&
            !isBlocked(CRO_FLOOR, beyond.x, beyond.y)
          );
        });
        if (open.length === 1)
          return { at: { x, y }, facing, slideTo: open[0] };
      }
    }
  throw new Error("no offset doorway on the CRO floor");
}

describe("forgivingStep", () => {
  it("slides along a wall into a doorway one tile away", () => {
    const { at, facing, slideTo } = offsetFromDoor();
    const world = { ...fresh(), player: { ...at, facing } };
    expect(step(world, facing).ok && step(world, facing)).toMatchObject({
      moved: false,
    });
    const result = forgivingStep(world, facing);
    expect(result).toMatchObject({ ok: true, moved: true });
    if (!result.ok) return;
    expect(result.world.player).toEqual({
      ...stepFrom(at, slideTo),
      facing,
    });
    // The slide is a real step: it costs a step's clock time.
    expect(result.world.minute).toBeCloseTo(
      world.minute + WALK_MINUTES_PER_TILE
    );
    expect(result.world.walked).toBe(world.walked + 1);
  });

  it("then walks straight through the doorway", () => {
    const { at, facing } = offsetFromDoor();
    const world = { ...fresh(), player: { ...at, facing } };
    const slid = forgivingStep(world, facing);
    if (!slid.ok) throw new Error("slide failed");
    const through = forgivingStep(slid.world, facing);
    expect(through).toMatchObject({ ok: true, moved: true });
  });

  it("does not slide into a doorway someone is standing in", () => {
    const { at, facing, slideTo } = offsetFromDoor();
    const world = { ...fresh(), player: { ...at, facing } };
    const doorway = stepFrom(stepFrom(at, slideTo), facing);
    const result = forgivingStep(world, facing, CRO_FLOOR, [doorway]);
    expect(result).toMatchObject({ ok: true, moved: false });
  });

  it("behaves like step when the way ahead is open", () => {
    const world = fresh();
    for (const facing of ["up", "down", "left", "right"] as Facing[]) {
      const a = forgivingStep(world, facing);
      const b = step(world, facing);
      expect(a).toEqual(b);
    }
  });

  it("does not guess when neither side opens onto a free tile", () => {
    // The spawn faces a wall in the lobby corner somewhere: find any blocked
    // press with no sideways opening and check it stays put.
    let checked = 0;
    for (let y = 0; y < CRO_FLOOR.height; y += 1)
      for (let x = 0; x < CRO_FLOOR.width; x += 1) {
        if (isBlocked(CRO_FLOOR, x, y)) continue;
        for (const facing of ["up", "down", "left", "right"] as Facing[]) {
          const ahead = stepFrom({ x, y }, facing);
          if (tileAt(CRO_FLOOR, ahead.x, ahead.y) !== "wall") continue;
          const open = SIDEWAYS[facing].filter((side) => {
            const beside = stepFrom({ x, y }, side);
            const beyond = stepFrom(beside, facing);
            return (
              !isBlocked(CRO_FLOOR, beside.x, beside.y) &&
              !isBlocked(CRO_FLOOR, beyond.x, beyond.y)
            );
          });
          if (open.length === 1) continue;
          const world = { ...fresh(), player: { x, y, facing } };
          const result = forgivingStep(world, facing);
          expect(result).toMatchObject({ ok: true, moved: false });
          checked += 1;
        }
      }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("passTime", () => {
  it("costs the minutes and nothing else", () => {
    const world = fresh();
    const result = passTime(world, 1);
    if (!result.ok) throw new Error("refused");
    expect(result.world.minute).toBe(world.minute + 1);
    expect(result.world.energy).toBe(world.energy);
    expect(result.world.focus).toBe(world.focus);
  });

  it("turns waiting past the end of the day into overtime", () => {
    const late = { ...fresh(), minute: 18 * 60 };
    const result = passTime(late, 5);
    if (!result.ok) throw new Error("refused");
    expect(result.world.overtime).toBe(late.overtime + 5);
  });

  it("is refused past the hard stop, and clamps silly lengths", () => {
    expect(passTime({ ...fresh(), minute: 21 * 60 + 59 }, 5)).toMatchObject({
      ok: false,
      reason: "too-late",
    });
    const long = passTime(fresh(), 10_000);
    if (!long.ok) throw new Error("refused");
    expect(long.world.minute - fresh().minute).toBe(60);
  });
});
