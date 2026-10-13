// Monkey C Mayhem run clock art (#2018): the top-centre readout shows the run
// clock during a run (0:00.00 while GPS holds), the score stays on the line
// beneath it, TIME and PACE can fill a ground-strip slot, and a long lap
// banner shrinks to fit its pill.
import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi } from "vitest";
import {
  createInitialState,
  startGame,
  type GameEngineState,
} from "@/lib/garmin-engine";
import {
  GROUND_STRIP_FIELDS,
  GROUND_STRIP_FIELD_LABELS,
  isGroundStripField,
  type GroundStripLayout,
} from "@/lib/garmin-ground-strip";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";

interface DrawnText {
  text: string;
  font: string;
}

/** A recording 2D context: every fillText call is logged with its font. */
function spyCtx() {
  const state: Record<string, unknown> = {
    font: "10px monospace",
    textAlign: "start",
  };
  const drawn: DrawnText[] = [];
  const gradient = { addColorStop: vi.fn() };
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy(state, {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === "fillText") {
          return (value: string) => {
            drawn.push({ text: value, font: String(target.font) });
          };
        }
        if (key === "measureText") {
          return (value: string) => ({ width: value.length * 6 });
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
  return { ctx, drawn };
}

function running(over: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...startGame(createInitialState("fenix", 0), "fenix"),
    obstacles: [],
    ...over,
  };
}

function drawnTexts(
  state: GameEngineState,
  strip?: GroundStripLayout
): DrawnText[] {
  const { ctx, drawn } = spyCtx();
  renderWatchFace(ctx, state, strip);
  return drawn;
}

describe("run clock readout", () => {
  it("draws the run clock while playing", () => {
    const drawn = drawnTexts(running({ runClockMs: 64380 }));
    expect(drawn.map((d) => d.text)).toContain("1:04.38");
  });

  it("keeps the score on the line beneath the clock", () => {
    const drawn = drawnTexts(running({ runClockMs: 64380, score: 1234 }));
    expect(drawn.map((d) => d.text)).toContain("1234 PTS");
  });

  it("holds at 0:00.00 while GPS is still locking", () => {
    const drawn = drawnTexts(
      running({ rules: "fitness", runClockMs: 12000, gpsMs: 3000 })
    );
    const texts = drawn.map((d) => d.text);
    expect(texts).toContain("0:00.00");
    expect(texts).not.toContain("0:12.00");
  });

  it("shows the clock while paused", () => {
    const drawn = drawnTexts(
      running({ gameState: "paused", runClockMs: 64380 })
    );
    expect(drawn.map((d) => d.text)).toContain("1:04.38");
  });

  it("draws no clock on the idle face", () => {
    const drawn = drawnTexts(createInitialState("fenix", 0));
    expect(drawn.map((d) => d.text)).not.toContain("0:00.00");
  });
});

describe("TIME and PACE ground-strip fields", () => {
  it("is selectable and labelled", () => {
    expect(isGroundStripField("time")).toBe(true);
    expect(isGroundStripField("pace")).toBe(true);
    expect(GROUND_STRIP_FIELDS).toContain("time");
    expect(GROUND_STRIP_FIELDS).toContain("pace");
    expect(GROUND_STRIP_FIELD_LABELS.time).toBe("Run time");
    expect(GROUND_STRIP_FIELD_LABELS.pace).toBe("Pace");
  });

  it("draws TIME as m:ss and PACE without the /km suffix", () => {
    // 64.38 s over 2000 m is 32.19 s/km, which reads as 0:32/km.
    const drawn = drawnTexts(
      running({ runClockMs: 64380, distanceMeters: 2000 }),
      ["time", "pace", "vars"]
    );
    const texts = drawn.map((d) => d.text);
    expect(texts).toContain("1:04");
    expect(texts).toContain("TIME");
    expect(texts).toContain("0:32");
    expect(texts).toContain("PACE");
    expect(texts.some((t) => t.endsWith("/km"))).toBe(false);
  });

  it("shows a dash for pace before any distance", () => {
    const drawn = drawnTexts(running({ runClockMs: 0, distanceMeters: 0 }), [
      "pace",
      "time",
      "vars",
    ]);
    expect(drawn.map((d) => d.text)).toContain("--:--");
  });
});

describe("lap banner", () => {
  it("draws the engine's lap banner text", () => {
    const drawn = drawnTexts(
      running({
        banner: {
          text: "LAP 2 · 1:04.38 · TE 3.4",
          ttlMs: 1000,
          tone: "good",
        },
      })
    );
    expect(drawn.map((d) => d.text)).toContain("LAP 2 · 1:04.38 · TE 3.4");
  });

  it("shrinks a long banner to fit without throwing", () => {
    const long =
      "LAP 12 · 1:04.38 · TE 3.4 · NEW PERSONAL RECORD ON THIS DEVICE";
    const drawn = drawnTexts(
      running({ banner: { text: long, ttlMs: 1000, tone: "warn" } })
    );
    const banner = drawn.find((d) => d.text === long);
    expect(banner).toBeDefined();
    const px = Number.parseFloat(
      banner?.font.match(/(\d+(\.\d+)?)px/)?.[1] ?? "0"
    );
    expect(px).toBeLessThan(7.5);
    expect(px).toBeGreaterThanOrEqual(5);
  });
});
