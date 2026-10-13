// #2039: the touch cabinet's room fits its stage on both axes, so the top of
// the room is never cropped under the HUD.

import { describe, it, expect } from "vitest";
import {
  fitRoomToStage,
  ROOM_ASPECT,
} from "@/components/working-with-duck/room-fit";

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
