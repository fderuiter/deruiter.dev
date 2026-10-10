/**
 * Run telemetry for the Garmin Watch Simulator.
 *
 * A bounded recorder samples the engine once per second of simulated play
 * time (frame deltas, never the wall clock, so pausing leaves no gaps), and
 * two pure exporters turn the samples into a CSV time series or a FIT
 * activity file. The CSV carries every metric. The FIT file carries only
 * what the FIT profile defines standard fields for (heart rate and
 * distance, plus the session and activity summary a reader expects), so
 * simulator-only metrics such as RAM and thermal stress are not squeezed
 * into unrelated fields. It is stamped with the FIT development
 * manufacturer id, not Garmin's.
 */

import type { GameEngineState } from "./garmin-engine";
import { clamp } from "./game-utils";

/** One telemetry row. */
export interface TelemetrySample {
  /** Seconds of simulated play since the run started. */
  tSec: number;
  heartRate: number;
  /** Thermal stress as a percentage, 0 to 100. */
  thermalPct: number;
  ramKb: number;
  flashKb: number;
  /** Battery percentage, 0 to 100. */
  battery: number;
  distanceM: number;
  score: number;
}

/** Simulated milliseconds between samples. */
export const TELEMETRY_INTERVAL_MS = 1000;
/** Oldest samples are dropped past this many (30 minutes at one per second). */
export const TELEMETRY_MAX_SAMPLES = 1800;

function sampleOf(state: GameEngineState, tSec: number): TelemetrySample {
  const finite = (n: number | undefined, fallback = 0) =>
    Number.isFinite(n) ? (n as number) : fallback;
  return {
    tSec,
    heartRate: Math.round(finite(state.heartRate)),
    thermalPct: Math.round(finite(state.thermalStress) * 1000) / 10,
    ramKb: Math.round(finite(state.allocatedRamKb) * 100) / 100,
    flashKb: Math.round(finite(state.allocatedFlashKb) * 100) / 100,
    battery: Math.round(finite(state.battery) * 10) / 10,
    distanceM: Math.round(finite(state.distanceMeters) * 10) / 10,
    score: Math.round(finite(state.score)),
  };
}

/**
 * Samples a run once per {@link TELEMETRY_INTERVAL_MS} of simulated time.
 * Mutable on purpose: it lives in a ref beside the animation loop and never
 * triggers a render.
 */
export class TelemetryRecorder {
  private rows: TelemetrySample[] = [];
  private elapsedMs = 0;
  private nextAtMs = TELEMETRY_INTERVAL_MS;

  /** Number of stored samples. */
  get count(): number {
    return this.rows.length;
  }

  /** A copy of the stored samples, oldest first. */
  samples(): TelemetrySample[] {
    return [...this.rows];
  }

  /** Forgets every sample and restarts the clock. */
  reset(): void {
    this.rows = [];
    this.elapsedMs = 0;
    this.nextAtMs = TELEMETRY_INTERVAL_MS;
  }

  /**
   * Advances the simulated clock by `deltaMs` and records a sample for each
   * interval boundary crossed. Returns true when a sample was added.
   */
  advance(state: GameEngineState, deltaMs: number): boolean {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return false;
    this.elapsedMs += deltaMs;
    let added = false;
    while (this.elapsedMs >= this.nextAtMs) {
      this.push(sampleOf(state, this.nextAtMs / 1000));
      this.nextAtMs += TELEMETRY_INTERVAL_MS;
      added = true;
    }
    return added;
  }

  /**
   * Records the closing sample of a run at the exact elapsed time, unless a
   * sample already sits there. Returns true when one was added.
   */
  finish(state: GameEngineState): boolean {
    const tSec = Math.round(this.elapsedMs) / 1000;
    const last = this.rows[this.rows.length - 1];
    if (tSec <= 0 || (last && last.tSec >= tSec)) return false;
    this.push(sampleOf(state, tSec));
    return true;
  }

  private push(sample: TelemetrySample): void {
    this.rows.push(sample);
    if (this.rows.length > TELEMETRY_MAX_SAMPLES) this.rows.shift();
  }
}

const CSV_HEADER = [
  "t_sec",
  "heart_rate_bpm",
  "thermal_stress_pct",
  "ram_kb",
  "flash_kb",
  "battery_pct",
  "distance_m",
  "score",
].join(",");

/** The samples as a CSV time series with a header row. */
export function exportTelemetryCsv(
  samples: readonly TelemetrySample[]
): string {
  const rows = samples.map((s) =>
    [
      s.tSec,
      s.heartRate,
      s.thermalPct,
      s.ramKb,
      s.flashKb,
      s.battery,
      s.distanceM,
      s.score,
    ].join(",")
  );
  return [CSV_HEADER, ...rows].join("\n") + "\n";
}

const FIT_CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001,
  0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

/** The FIT CRC-16 (the reflected 0xA001 polynomial, zero seed) of `data[start, end)`. */
export function computeFitCrc(
  data: Uint8Array,
  start = 0,
  end = data.length
): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const byte = data[i];
    crc = (crc >> 4) ^ FIT_CRC_TABLE[crc & 0xf] ^ FIT_CRC_TABLE[byte & 0xf];
    crc =
      (crc >> 4) ^ FIT_CRC_TABLE[crc & 0xf] ^ FIT_CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc & 0xffff;
}

/** Seconds from the Unix epoch to the FIT epoch (1989-12-31T00:00:00Z). */
export const FIT_EPOCH_OFFSET_SEC = 631065600;

/** FIT manufacturer id reserved for development, not Garmin's. */
const FIT_MANUFACTURER_DEVELOPMENT = 255;

const BASE_ENUM = 0x00;
const BASE_UINT8 = 0x02;
const BASE_UINT16 = 0x84;
const BASE_UINT32 = 0x86;

const FIELD_TIMESTAMP = 253;

type FieldDef = readonly [num: number, size: number, base: number];

function fitTime(unixMs: number): number {
  return Math.max(0, Math.floor(unixMs / 1000) - FIT_EPOCH_OFFSET_SEC);
}

/**
 * A FIT activity file for the samples: file id, one record per sample (heart
 * rate and distance), then the session and activity summaries.
 *
 * @param samples - Samples, oldest first.
 * @param startUnixMs - Wall-clock start of the run, in milliseconds since the Unix epoch.
 */
export function exportTelemetryFit(
  samples: readonly TelemetrySample[],
  startUnixMs: number
): Uint8Array<ArrayBuffer> {
  const body: number[] = [];
  const u8 = (v: number) => body.push(v & 0xff);
  const u16 = (v: number) => {
    u8(v);
    u8(v >>> 8);
  };
  const u32 = (v: number) => {
    u16(v);
    u16(v >>> 16);
  };
  const define = (local: number, globalNum: number, fields: FieldDef[]) => {
    u8(0x40 | local);
    u8(0); // reserved
    u8(0); // little endian
    u16(globalNum);
    u8(fields.length);
    for (const [num, size, base] of fields) {
      u8(num);
      u8(size);
      u8(base);
    }
  };

  const start = fitTime(startUnixMs);
  const last = samples[samples.length - 1];
  const totalSec = last ? last.tSec : 0;
  const endTime = start + Math.round(totalSec);
  const totalMs = Math.round(totalSec * 1000);
  const totalCm = last ? Math.round(last.distanceM * 100) : 0;

  define(0, 0, [
    [0, 1, BASE_ENUM], // type
    [1, 2, BASE_UINT16], // manufacturer
    [4, 4, BASE_UINT32], // time_created
  ]);
  u8(0);
  u8(4); // activity
  u16(FIT_MANUFACTURER_DEVELOPMENT);
  u32(start);

  define(1, 20, [
    [FIELD_TIMESTAMP, 4, BASE_UINT32],
    [3, 1, BASE_UINT8], // heart_rate
    [5, 4, BASE_UINT32], // distance, scale 100
  ]);
  for (const s of samples) {
    u8(1);
    u32(start + Math.round(s.tSec));
    u8(clamp(s.heartRate, 0, 255));
    u32(Math.max(0, Math.round(s.distanceM * 100)));
  }

  define(2, 18, [
    [FIELD_TIMESTAMP, 4, BASE_UINT32],
    [2, 4, BASE_UINT32], // start_time
    [7, 4, BASE_UINT32], // total_elapsed_time, scale 1000
    [8, 4, BASE_UINT32], // total_timer_time, scale 1000
    [9, 4, BASE_UINT32], // total_distance, scale 100
    [5, 1, BASE_ENUM], // sport
  ]);
  u8(2);
  u32(endTime);
  u32(start);
  u32(totalMs);
  u32(totalMs);
  u32(totalCm);
  u8(0); // generic

  define(3, 34, [
    [FIELD_TIMESTAMP, 4, BASE_UINT32],
    [0, 4, BASE_UINT32], // total_timer_time, scale 1000
    [1, 2, BASE_UINT16], // num_sessions
    [2, 1, BASE_ENUM], // type: manual
    [3, 1, BASE_ENUM], // event: activity
    [4, 1, BASE_ENUM], // event_type: stop
  ]);
  u8(3);
  u32(endTime);
  u32(totalMs);
  u16(1);
  u8(0);
  u8(26);
  u8(1);

  const headerSize = 14;
  const file = new Uint8Array(headerSize + body.length + 2);
  file[0] = headerSize;
  file[1] = 0x20; // protocol 2.0
  file[2] = 0x34; // profile 21.00, little endian
  file[3] = 0x08;
  new DataView(file.buffer).setUint32(4, body.length, true);
  file.set([0x2e, 0x46, 0x49, 0x54], 8); // ".FIT"
  new DataView(file.buffer).setUint16(12, computeFitCrc(file, 0, 12), true);
  file.set(body, headerSize);
  const end = headerSize + body.length;
  new DataView(file.buffer).setUint16(end, computeFitCrc(file, 0, end), true);
  return file;
}
