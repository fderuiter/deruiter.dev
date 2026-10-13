// #2039: the touch cabinet's room fits its stage on both axes, so the top of
// the room is never cropped under the HUD.

import { describe, it, expect } from "vitest";
import {
  fitRoomToStage,
  ROOM_ASPECT,
} from "@/components/working-with-duck/room-fit";
import { computeCanvasResolution } from "@/lib/arcade";

describe("fitRoomToStage (#2039)", () => {
  it("takes the stage height as the limit when the stage is wider than the room", () => {
    // Landscape: the 560 px height allows 896 px across, which is narrower
    // than the 1000 px stage, so the height is the limit.
    expect(fitRoomToStage(1000, 560)).toEqual({ width: 896, height: 560 });
  });

  it("fills the stage width and follows the aspect when the stage is tall", () => {
    // Portrait: the width is the limit, and the room is 437 px tall, which
    // leaves the rest of the stage spare above it.
    expect(fitRoomToStage(700, 900)).toEqual({ width: 700, height: 437 });
  });

  it("shrinks to the stage height when the stage is short and wide", () => {
    expect(fitRoomToStage(900, 300)).toEqual({ width: 480, height: 300 });
  });

  it("returns an empty box for an empty or invalid stage", () => {
    expect(fitRoomToStage(0, 400)).toEqual({ width: 0, height: 0 });
    expect(fitRoomToStage(400, 0)).toEqual({ width: 0, height: 0 });
    expect(fitRoomToStage(-5, 400)).toEqual({ width: 0, height: 0 });
    expect(fitRoomToStage(Number.NaN, 400)).toEqual({ width: 0, height: 0 });
  });

  it("never exceeds the stage on either axis, and keeps the room's aspect", () => {
    for (let w = 100; w <= 1400; w += 37) {
      for (let h = 100; h <= 1400; h += 41) {
        const { width, height } = fitRoomToStage(w, h);
        expect(width).toBeLessThanOrEqual(w);
        expect(height).toBeLessThanOrEqual(h);
        expect(Math.abs(width / height - ROOM_ASPECT)).toBeLessThan(0.02);
      }
    }
  });
});

// The canvas's backing store and its CSS box must describe the same picture:
// the backing store is the box times the device pixel ratio (capped), and both
// keep the room's 800x500 aspect, so the whole room is drawn into the box.
describe("room canvas backing store and CSS box (#2039)", () => {
  const LOGICAL_WIDTH = 800;
  const LOGICAL_HEIGHT = 500;

  it("sizes the backing store to the CSS box times the device pixel ratio", () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      const effective = Math.min(dpr, 2);
      for (let stageW = 900; stageW <= 1400; stageW += 61) {
        for (const stageH of [480, 560, 700]) {
          const css = fitRoomToStage(stageW, stageH);
          // Below the logical size the store stays at 800 px (scale never
          // drops under 1), so the ratio only holds from there up.
          if (css.width * effective < LOGICAL_WIDTH) continue;
          const backing = computeCanvasResolution(
            LOGICAL_WIDTH,
            LOGICAL_HEIGHT,
            css.width,
            dpr
          );
          // Rounding to whole device pixels is the only slack allowed.
          expect(
            Math.abs(backing.width / css.width - effective)
          ).toBeLessThanOrEqual(0.5 / css.width + 1e-9);
        }
      }
    }
  });

  it("keeps the backing store and the CSS box at the room's aspect", () => {
    for (const dpr of [1, 2]) {
      for (let stageW = 500; stageW <= 1400; stageW += 83) {
        for (let stageH = 300; stageH <= 1100; stageH += 97) {
          const css = fitRoomToStage(stageW, stageH);
          if (css.width === 0) continue;
          const backing = computeCanvasResolution(
            LOGICAL_WIDTH,
            LOGICAL_HEIGHT,
            css.width,
            dpr
          );
          expect(
            Math.abs(css.height / css.width - LOGICAL_HEIGHT / LOGICAL_WIDTH)
          ).toBeLessThanOrEqual(1 / css.width);
          expect(
            Math.abs(
              backing.height / backing.width - LOGICAL_HEIGHT / LOGICAL_WIDTH
            )
          ).toBeLessThanOrEqual(1 / backing.width);
        }
      }
    }
  });
});
