import { fromAny } from "@total-typescript/shoehorn";
// Monkey C Mayhem watch art (#1520): the data-field ring stays off the lane
// and inside the round screen, obstacles map to pictograms, the crash face
// is one layer, and the hardware geometry keeps the canvas on the screen.
import { describe, it, expect, vi } from "vitest";
import {
  CANVAS_SIZE,
  GROUND_Y,
  PLAYER_HEIGHT,
  createInitialState,
  startGame,
  type GameEngineState,
  type ObstacleType,
} from "@/lib/garmin-engine";
import {
  FACE_CENTER,
  FACE_RADIUS,
  OBSTACLE_PICTOGRAMS,
  RING_RADIUS,
  batteryTone,
  endFaceFor,
  meterTone,
  parallaxOffset,
  renderWatchFace,
  ringFillSpan,
  runnerPose,
  stepsFor,
} from "@/components/garmin-watch/watch-face-art";
import {
  CASE_RADIUS,
  PUSHER_ANGLES,
  SCREEN_RADIUS,
  WATCH_CENTER,
  WATCH_VIEW_HEIGHT,
  WATCH_VIEW_WIDTH,
  pusherAnchorPercent,
  screenBoxPercent,
  type PusherId,
} from "@/components/garmin-watch/watch-geometry";

interface TextCall {
  text: string;
  x: number;
  y: number;
  px: number;
  align: CanvasTextAlign;
}

/** A recording 2D context: every fillText with its font size and alignment. */
function recordingCtx() {
  const calls: TextCall[] = [];
  const state = {
    font: "10px monospace",
    textAlign: "start" as CanvasTextAlign,
  };
  const gradient = { addColorStop: vi.fn() };
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy(state as Record<string, unknown>, {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === "fillText") {
          return (text: string, x: number, y: number) => {
            const px = Number(
              /([\d.]+)px/.exec(String(target.font))?.[1] ?? 10
            );
            calls.push({
              text,
              x,
              y,
              px,
              align: target.textAlign as CanvasTextAlign,
            });
          };
        }
        if (key === "measureText") {
          return (text: string) => ({ width: text.length * 6 });
        }
        if (key === "createLinearGradient" || key === "createRadialGradient") {
          return () => gradient;
        }
        return () => {};
      },
      set(target, key: string, value) {
        target[key] = value;
        return true;
      },
    })
  );
  return { ctx, calls };
}

function running(over: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0), "fenix"),
    obstacles: [],
    ...over,
  };
}

/** Horizontal extent of a text call, using 0.6 em per monospace glyph. */
function extent(call: TextCall): [number, number] {
  const w = call.text.length * call.px * 0.6;
  if (call.align === "left") return [call.x, call.x + w];
  if (call.align === "right") return [call.x - w, call.x];
  return [call.x - w / 2, call.x + w / 2];
}

const halfChord = (y: number) =>
  Math.sqrt(Math.max(0, FACE_RADIUS ** 2 - (FACE_CENTER - y) ** 2));

describe("watch face meters", () => {
  it("tones RAM and flash at 65% and 85%, battery at 30% and 15%", () => {
    expect(meterTone(0.2)).toBe("ok");
    expect(meterTone(0.7)).toBe("warn");
    expect(meterTone(0.9)).toBe("danger");
    expect(meterTone(Number.NaN)).toBe("ok");
    expect(batteryTone(80)).toBe("ok");
    expect(batteryTone(20)).toBe("warn");
    expect(batteryTone(10)).toBe("danger");
  });

  it("fills RAM clockwise up the left and flash anticlockwise up the right", () => {
    const ram = ringFillSpan("ram", 1);
    expect(ram.anticlockwise).toBe(false);
    expect((ram.from * 180) / Math.PI).toBeCloseTo(165);
    expect((ram.to * 180) / Math.PI).toBeCloseTo(255);
    const flash = ringFillSpan("flash", 0.5);
    expect(flash.anticlockwise).toBe(true);
    expect((flash.to * 180) / Math.PI).toBeCloseTo(15 - 45);
    expect(ringFillSpan("ram", 4).to).toBeCloseTo(ram.to);
    expect(ringFillSpan("ram", Number.NaN).to).toBeCloseTo(ram.from);
  });

  it("keeps both arcs above the running lane", () => {
    const laneTop = GROUND_Y - PLAYER_HEIGHT;
    for (const side of ["ram", "flash"] as const) {
      const { from, to } = ringFillSpan(side, 1);
      for (let i = 0; i <= 20; i++) {
        const a = from + ((to - from) * i) / 20;
        expect(FACE_CENTER + RING_RADIUS * Math.sin(a)).toBeLessThan(laneTop);
      }
    }
  });
});

describe("watch face world", () => {
  it("scrolls parallax layers inside one tile and slower for far layers", () => {
    expect(parallaxOffset(0, 0.15, 140)).toBe(0);
    const far = parallaxOffset(10, 0.15, 1000);
    const near = parallaxOffset(10, 1, 1000);
    expect(near).toBeGreaterThan(far);
    for (const d of [0, 3.3, 57, 1234.5]) {
      const o = parallaxOffset(d, 0.45, 90);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(90);
    }
    expect(parallaxOffset(Number.NaN, 1, 24)).toBe(0);
    expect(parallaxOffset(-5, 1, 24)).toBe(0);
    expect(parallaxOffset(5, 1, 0)).toBe(0);
  });

  it("swings the runner's legs in opposition and tucks in the air", () => {
    const stride = runnerPose(1.5, true);
    expect(stride.frontLeg).toBeCloseTo(-stride.backLeg);
    expect(Math.sign(stride.frontArm)).toBe(-Math.sign(stride.frontLeg));
    expect(stride.airborne).toBe(false);
    const still = runnerPose(0, true);
    expect(still.frontLeg).toBeCloseTo(0);
    expect(still.bob).toBeCloseTo(0);
    const jump = runnerPose(1.5, false);
    expect(jump.airborne).toBe(true);
    expect(jump.frontLeg).toBeGreaterThan(0);
    expect(Number.isFinite(runnerPose(Number.NaN, true).frontLeg)).toBe(true);
  });

  it("draws every obstacle type as its own pictogram", () => {
    const types: ObstacleType[] = [
      "null_pointer",
      "watchdog",
      "stack_overflow",
      "mem_token",
      "flash_token",
    ];
    const pictograms = types.map((t) => OBSTACLE_PICTOGRAMS[t]);
    expect(new Set(pictograms).size).toBe(types.length);
    expect(OBSTACLE_PICTOGRAMS.null_pointer).toBe("bug");
    expect(OBSTACLE_PICTOGRAMS.stack_overflow).toBe("stack");
  });

  it("drops the old three-letter labels from obstacles", () => {
    const { ctx, calls } = recordingCtx();
    renderWatchFace(
      ctx,
      running({
        obstacles: (
          ["null_pointer", "watchdog", "stack_overflow"] as const
        ).map((type, i) => ({
          id: i,
          x: 120 + i * 30,
          y: GROUND_Y - 20,
          width: 16,
          height: 20,
          type,
          label:
            type === "watchdog"
              ? "DOG"
              : type === "null_pointer"
                ? "NULL"
                : "STK",
          speed: 2,
        })),
      })
    );
    const texts = calls.map((c) => c.text);
    for (const label of ["NULL", "DOG", "STK", "5s"]) {
      expect(texts).not.toContain(label);
    }
  });

  it("counts steps from distance", () => {
    expect(stepsFor(100)).toBe(135);
    expect(stepsFor(-3)).toBe(0);
    expect(stepsFor(Number.NaN)).toBe(0);
  });
});

describe("watch face data-field ring", () => {
  const lowBattery = running({
    score: 12345,
    battery: 9,
    allocatedRamKb: 31.9,
    allocatedFlashKb: 63.5,
    distanceMeters: 2400,
  });

  it("draws no text over the running lane", () => {
    const { ctx, calls } = recordingCtx();
    renderWatchFace(ctx, lowBattery);
    expect(calls.length).toBeGreaterThan(8);
    const laneTop = GROUND_Y - PLAYER_HEIGHT - 4;
    for (const call of calls) {
      const inLane = call.y >= laneTop && call.y - call.px <= GROUND_Y + 6;
      expect(inLane, `"${call.text}" at y=${call.y}`).toBe(false);
    }
  });

  it("keeps every field inside the round screen", () => {
    const { ctx, calls } = recordingCtx();
    renderWatchFace(ctx, lowBattery);
    for (const call of calls) {
      const [left, right] = extent(call);
      const top = call.y - call.px * 0.75;
      const chord = Math.min(halfChord(top), halfChord(call.y));
      expect(left, `"${call.text}" left`).toBeGreaterThanOrEqual(
        FACE_CENTER - chord + 4
      );
      expect(right, `"${call.text}" right`).toBeLessThanOrEqual(
        FACE_CENTER + chord - 4
      );
    }
  });

  it("shows score, heart rate, battery, RAM, flash and steps while running", () => {
    const { ctx, calls } = recordingCtx();
    renderWatchFace(ctx, lowBattery);
    const texts = calls.map((c) => c.text);
    expect(texts).toContain("12345");
    expect(texts).toContain(`${lowBattery.heartRate}`);
    expect(texts).toContain("9%");
    expect(texts).toContain("31.9K");
    expect(texts).toContain("63.5K");
    expect(texts).toContain(`${stepsFor(2400)}`);
    expect(texts).toContain("LOW BAT");
  });

  it("leaves the ring empty while idle, under the start card", () => {
    const { ctx, calls } = recordingCtx();
    renderWatchFace(ctx, createInitialState("fenix", 0));
    expect(calls).toHaveLength(0);
  });

  it("still marks a paused frame", () => {
    const { ctx, calls } = recordingCtx();
    renderWatchFace(ctx, running({ gameState: "paused" }));
    expect(calls.map((c) => c.text)).toContain("PAUSED");
  });
});

describe("watch end faces", () => {
  const crashed = running({
    gameState: "crashed",
    crashReport: {
      errorType: "Null Pointer",
      file: "Garmin_Schvitz_App.mc",
      line: 77,
      stackTrace: [],
      heapUsedKb: 4,
      heapLimitKb: 32,
    },
  });

  it("names the crash and where it happened", () => {
    expect(endFaceFor(crashed)).toEqual({
      kind: "crash",
      headline: "NULL POINTER",
      detail: "Garmin_Schvitz_App.mc:77",
    });
    expect(endFaceFor(running())).toBeNull();
    expect(endFaceFor(running({ gameState: "shutdown" }))?.kind).toBe("power");
    expect(endFaceFor(running({ battery: 0 }))?.kind).toBe("power");
    expect(
      endFaceFor({ gameState: "crashed", battery: 50, crashReport: null })
        ?.headline
    ).toBe("APP CRASHED");
  });

  it("draws the IQ! error face as the whole screen, with one title", () => {
    const { ctx, calls } = recordingCtx();
    renderWatchFace(ctx, crashed);
    const texts = calls.map((c) => c.text);
    expect(texts).toContain("IQ");
    expect(texts).toContain("!");
    expect(texts.filter((t) => t === "NULL POINTER")).toHaveLength(1);
    expect(texts).not.toContain("CONNECT IQ ERROR");
    for (const call of calls) {
      const [left, right] = extent(call);
      expect(left).toBeGreaterThanOrEqual(FACE_CENTER - halfChord(call.y));
      expect(right).toBeLessThanOrEqual(FACE_CENTER + halfChord(call.y));
    }
  });
});

describe("watch hardware geometry", () => {
  it("centres the canvas square on the round screen", () => {
    const box = screenBoxPercent();
    expect(box.left + box.width / 2).toBeCloseTo(
      (WATCH_CENTER.x / WATCH_VIEW_WIDTH) * 100,
      1
    );
    expect(box.top + box.height / 2).toBeCloseTo(
      (WATCH_CENTER.y / WATCH_VIEW_HEIGHT) * 100,
      1
    );
    expect((box.width / 100) * WATCH_VIEW_WIDTH).toBeCloseTo(
      SCREEN_RADIUS * 2,
      0
    );
    // The screen fills most of the watch face: about 74% of its width.
    expect(box.width).toBeGreaterThan(70);
    expect(CANVAS_SIZE).toBe(280);
  });

  it("puts LIGHT, UP and DOWN on the left and START and BACK on the right", () => {
    const sides = Object.fromEntries(
      (Object.keys(PUSHER_ANGLES) as PusherId[]).map((id) => [
        id,
        pusherAnchorPercent(id).side,
      ])
    );
    expect(sides).toEqual({
      light: "left",
      up: "left",
      down: "left",
      start: "right",
      back: "right",
    });
    const light = pusherAnchorPercent("light");
    const down = pusherAnchorPercent("down");
    expect(light.y).toBeLessThan(pusherAnchorPercent("up").y);
    expect(pusherAnchorPercent("up").y).toBeLessThan(down.y);
    for (const id of Object.keys(PUSHER_ANGLES) as PusherId[]) {
      const p = pusherAnchorPercent(id);
      const dx = (p.x / 100) * WATCH_VIEW_WIDTH - WATCH_CENTER.x;
      const dy = (p.y / 100) * WATCH_VIEW_HEIGHT - WATCH_CENTER.y;
      expect(Math.hypot(dx, dy)).toBeGreaterThan(CASE_RADIUS);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
    }
  });
});
