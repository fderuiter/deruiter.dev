// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createInitialState, startGame } from "@/lib/garmin-engine";
import {
  FIT_EPOCH_OFFSET_SEC,
  TELEMETRY_INTERVAL_MS,
  TELEMETRY_MAX_SAMPLES,
  TelemetryRecorder,
  computeFitCrc,
  exportTelemetryCsv,
  exportTelemetryFit,
  type TelemetrySample,
} from "@/lib/garmin-telemetry";

const running = () => startGame(createInitialState("fenix", 0), "fenix");

const sample = (tSec: number): TelemetrySample => ({
  tSec,
  heartRate: 130 + tSec,
  thermalPct: 12.5,
  ramKb: 5,
  flashKb: 1,
  battery: 99,
  distanceM: tSec * 12.5,
  score: tSec,
});

describe("computeFitCrc", () => {
  it("matches the CRC-16/ARC check value", () => {
    const data = new TextEncoder().encode("123456789");
    expect(computeFitCrc(data)).toBe(0xbb3d);
  });

  it("honours the start and end bounds", () => {
    const data = new TextEncoder().encode("xx123456789yy");
    expect(computeFitCrc(data, 2, 11)).toBe(0xbb3d);
  });
});

describe("TelemetryRecorder", () => {
  it("samples once per simulated second, however the time is sliced", () => {
    const recorder = new TelemetryRecorder();
    const state = running();
    let added = 0;
    for (let i = 0; i < 250; i++) added += recorder.advance(state, 16) ? 1 : 0;
    // 4000 ms of play.
    expect(recorder.count).toBe(4);
    expect(added).toBe(4);
    expect(recorder.samples().map((s) => s.tSec)).toEqual([1, 2, 3, 4]);
  });

  it("records several samples when one large step crosses boundaries", () => {
    const recorder = new TelemetryRecorder();
    recorder.advance(running(), TELEMETRY_INTERVAL_MS * 3 + 1);
    expect(recorder.count).toBe(3);
  });

  it("ignores zero, negative and non-finite steps", () => {
    const recorder = new TelemetryRecorder();
    for (const delta of [0, -5, NaN, Infinity]) {
      expect(recorder.advance(running(), delta)).toBe(false);
    }
    expect(recorder.count).toBe(0);
  });

  it("finish adds a closing sample at the exact elapsed time, once", () => {
    const recorder = new TelemetryRecorder();
    recorder.advance(running(), 2500);
    expect(recorder.finish(running())).toBe(true);
    expect(recorder.samples().at(-1)?.tSec).toBe(2.5);
    expect(recorder.finish(running())).toBe(false);
  });

  it("finish adds nothing when no time has passed or a sample already sits there", () => {
    const recorder = new TelemetryRecorder();
    expect(recorder.finish(running())).toBe(false);
    recorder.advance(running(), 2000);
    expect(recorder.finish(running())).toBe(false);
    expect(recorder.count).toBe(2);
  });

  it("keeps only the newest samples past the cap", () => {
    const recorder = new TelemetryRecorder();
    recorder.advance(
      running(),
      (TELEMETRY_MAX_SAMPLES + 5) * TELEMETRY_INTERVAL_MS
    );
    expect(recorder.count).toBe(TELEMETRY_MAX_SAMPLES);
    expect(recorder.samples()[0].tSec).toBe(6);
  });

  it("reset forgets samples and restarts the clock", () => {
    const recorder = new TelemetryRecorder();
    recorder.advance(running(), 3000);
    recorder.reset();
    expect(recorder.count).toBe(0);
    recorder.advance(running(), 1000);
    expect(recorder.samples().map((s) => s.tSec)).toEqual([1]);
  });

  it("returns a copy, and survives non-finite engine values", () => {
    const recorder = new TelemetryRecorder();
    const state = { ...running(), heartRate: NaN, thermalStress: NaN };
    recorder.advance(state, 1000);
    recorder.samples().pop();
    expect(recorder.count).toBe(1);
    const [row] = recorder.samples();
    expect(row.heartRate).toBe(0);
    expect(row.thermalPct).toBe(0);
  });

  it("reads thermal stress as a percentage", () => {
    const recorder = new TelemetryRecorder();
    recorder.advance({ ...running(), thermalStress: 0.4567 }, 1000);
    expect(recorder.samples()[0].thermalPct).toBe(45.7);
  });
});

describe("exportTelemetryCsv", () => {
  it("writes a header and one row per sample", () => {
    const lines = exportTelemetryCsv([sample(1), sample(2)])
      .trim()
      .split("\n");
    expect(lines[0]).toBe(
      "t_sec,heart_rate_bpm,thermal_stress_pct,ram_kb,flash_kb,battery_pct,distance_m,score"
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("1,131,12.5,5,1,99,12.5,1");
  });

  it("is just a header with no samples", () => {
    expect(exportTelemetryCsv([]).trim().split("\n")).toHaveLength(1);
  });
});

describe("exportTelemetryFit", () => {
  const startMs = Date.UTC(2026, 9, 10, 12, 0, 0);
  const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset);

  it("writes a valid header and both CRCs", () => {
    const fit = exportTelemetryFit([sample(1), sample(2), sample(3)], startMs);
    expect(fit[0]).toBe(14);
    expect(new TextDecoder().decode(fit.slice(8, 12))).toBe(".FIT");
    expect(view(fit).getUint32(4, true)).toBe(fit.length - 14 - 2);
    expect(view(fit).getUint16(12, true)).toBe(computeFitCrc(fit, 0, 12));
    expect(view(fit).getUint16(fit.length - 2, true)).toBe(
      computeFitCrc(fit, 0, fit.length - 2)
    );
  });

  it("stamps the run start in the FIT epoch and the development manufacturer", () => {
    const fit = exportTelemetryFit([sample(1)], startMs);
    // file_id: header byte, 3-field definition (6 + 9 bytes), then the data record.
    const data = 14 + 15;
    expect(fit[data]).toBe(0);
    expect(fit[data + 1]).toBe(4); // activity
    expect(view(fit).getUint16(data + 2, true)).toBe(255);
    expect(view(fit).getUint32(data + 4, true)).toBe(
      startMs / 1000 - FIT_EPOCH_OFFSET_SEC
    );
  });

  it("grows by a fixed size per record", () => {
    const one = exportTelemetryFit([sample(1)], startMs).length;
    const four = exportTelemetryFit(
      [sample(1), sample(2), sample(3), sample(4)],
      startMs
    ).length;
    expect(four - one).toBe(3 * (1 + 4 + 1 + 4));
  });

  it("encodes an empty run without throwing", () => {
    const fit = exportTelemetryFit([], startMs);
    expect(view(fit).getUint16(fit.length - 2, true)).toBe(
      computeFitCrc(fit, 0, fit.length - 2)
    );
  });

  it("clamps heart rate into a byte and never writes negative distance", () => {
    const fit = exportTelemetryFit(
      [{ ...sample(1), heartRate: 999, distanceM: -5 }],
      startMs
    );
    expect(view(fit).getUint16(fit.length - 2, true)).toBe(
      computeFitCrc(fit, 0, fit.length - 2)
    );
    expect(fit).toContain(255);
  });

  it("clamps a pre-1989 start to the FIT epoch", () => {
    const fit = exportTelemetryFit([sample(1)], 0);
    expect(view(fit).getUint32(14 + 15 + 4, true)).toBe(0);
  });
});
