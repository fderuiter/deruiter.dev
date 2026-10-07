/**
 * Garmin Simulator Telemetry Ring Buffer & Exporters (CSV and FIT)
 *
 * Records timestamped simulation engine metrics (heart rate, thermal stress,
 * allocated RAM, NV flash, battery level, distance, and score) into a bounded
 * in-memory ring buffer at a default 1000ms sample interval.
 * Provides client-side exporters for CSV and Garmin FIT binary formats.
 */

import type { GameEngineState } from "./garmin-engine";
import { clamp } from "./game-utils";

export interface TelemetrySample {
  /** Timestamp in milliseconds since Unix epoch (Date.now()). */
  timestamp: number;
  /** Heart rate in beats per minute (BPM). */
  heartRate: number;
  /** Thermal stress level (0.0 to 1.0). */
  thermalStress: number;
  /** Currently allocated RAM memory in kilobytes. */
  allocatedRamKb: number;
  /** Currently allocated Non-Volatile Flash storage in kilobytes. */
  allocatedFlashKb: number;
  /** Battery charge percentage (0 to 100). */
  battery: number;
  /** Accumulated run distance in meters. */
  distanceMeters: number;
  /** Current run score points. */
  score: number;
}

export const DEFAULT_TELEMETRY_INTERVAL_MS = 1000;
export const DEFAULT_TELEMETRY_MAX_SAMPLES = 1000;

/**
 * In-memory ring buffer for telemetry snapshots.
 */
export class TelemetryBuffer {
  private samples: TelemetrySample[] = [];
  private maxCapacity: number;
  private sampleIntervalMs: number;
  private lastRecordedTime = 0;

  constructor(
    maxCapacity = DEFAULT_TELEMETRY_MAX_SAMPLES,
    sampleIntervalMs = DEFAULT_TELEMETRY_INTERVAL_MS
  ) {
    this.maxCapacity = maxCapacity;
    this.sampleIntervalMs = sampleIntervalMs;
  }

  /**
   * Resets and clears all recorded telemetry samples.
   */
  public clear(): void {
    this.samples = [];
    this.lastRecordedTime = 0;
  }

  /**
   * Returns a copy of all recorded telemetry samples in chronological order.
   */
  public getSamples(): TelemetrySample[] {
    return [...this.samples];
  }

  /**
   * Returns the total count of recorded telemetry samples.
   */
  public get sampleCount(): number {
    return this.samples.length;
  }

  /**
   * Captures a telemetry snapshot if state is active and sampling interval has elapsed.
   */
  public recordSample(
    state: GameEngineState,
    now: number = Date.now(),
    force = false
  ): boolean {
    if (state.gameState !== "playing" && !force) {
      return false;
    }

    if (!force && now - this.lastRecordedTime < this.sampleIntervalMs) {
      return false;
    }

    const sample: TelemetrySample = {
      timestamp: now,
      heartRate: Math.round(state.heartRate ?? 135),
      thermalStress: Number((state.thermalStress ?? 0).toFixed(4)),
      allocatedRamKb: Number((state.allocatedRamKb ?? 0).toFixed(2)),
      allocatedFlashKb: Number((state.allocatedFlashKb ?? 0).toFixed(2)),
      battery: Number(state.battery.toFixed(1)),
      distanceMeters: Number(state.distanceMeters.toFixed(1)),
      score: Math.round(state.score ?? 0),
    };

    if (this.samples.length >= this.maxCapacity) {
      this.samples.shift(); // Evict oldest entry in ring buffer
    }

    this.samples.push(sample);
    this.lastRecordedTime = now;
    return true;
  }
}

/**
 * Converts recorded telemetry samples into a standard CSV time-series string.
 */
export function exportTelemetryToCsv(samples: TelemetrySample[]): string {
  const headers = [
    "iso_timestamp",
    "timestamp_ms",
    "heart_rate_bpm",
    "thermal_stress_pct",
    "allocated_ram_kb",
    "allocated_flash_kb",
    "battery_pct",
    "distance_m",
    "score_pts",
  ];

  const rows = samples.map((s) => {
    const iso = new Date(s.timestamp).toISOString();
    const thermalPct = (s.thermalStress * 100).toFixed(1);
    return [
      iso,
      s.timestamp,
      s.heartRate,
      thermalPct,
      s.allocatedRamKb,
      s.allocatedFlashKb,
      s.battery,
      s.distanceMeters,
      s.score,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/** FIT protocol CRC-16 computation lookup table */
const FIT_CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001,
  0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

/**
 * Computes FIT protocol CRC-16 over a byte array segment.
 */
export function computeFitCrc(
  data: Uint8Array,
  start = 0,
  end = data.length
): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const byte = data[i];
    let tmp = FIT_CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) ^ tmp ^ FIT_CRC_TABLE[byte & 0xf];
    tmp = FIT_CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) ^ tmp ^ FIT_CRC_TABLE[(byte >> 4) & 0xf];
  }
  return crc & 0xffff;
}

/** Seconds between Unix epoch (1970-01-01) and FIT epoch (1989-12-31T00:00:00Z) */
export const FIT_EPOCH_DELTA_SEC = 631065600;

/**
 * Converts Unix timestamp (ms) to FIT epoch timestamp (seconds).
 */
export function unixMsToFitTime(unixMs: number): number {
  const unixSec = Math.floor(unixMs / 1000);
  return Math.max(0, unixSec - FIT_EPOCH_DELTA_SEC);
}

/**
 * Converts recorded telemetry samples into a structured Garmin FIT binary file (Uint8Array).
 *
 * Structure:
 * - 14-byte Header (length, protocol, profile, data size, '.FIT', header CRC)
 * - File ID Message (Definition + Data): file_id (type 4 = activity, manufacturer 1 = garmin)
 * - Record Message Definition (Msg #20: record)
 * - Record Data Messages for each sample (timestamp, heart_rate, distance, battery, temperature/stress)
 * - 2-byte File CRC-16
 */
export function exportTelemetryToFit(samples: TelemetrySample[]): Uint8Array {
  const recordsDataBuffer: number[] = [];

  // Helper push functions for byte encoding (little-endian)
  const pushU8 = (val: number) => recordsDataBuffer.push(val & 0xff);
  const pushU16 = (val: number) => {
    recordsDataBuffer.push(val & 0xff);
    recordsDataBuffer.push((val >> 8) & 0xff);
  };
  const pushU32 = (val: number) => {
    recordsDataBuffer.push(val & 0xff);
    recordsDataBuffer.push((val >> 8) & 0xff);
    recordsDataBuffer.push((val >> 16) & 0xff);
    recordsDataBuffer.push((val >> 24) & 0xff);
  };

  // 1. File ID Definition Record (Local Msg Header 0x40 = Definition for Local Msg 0)
  pushU8(0x40); // Definition record
  pushU8(0x00); // Reserved
  pushU8(0x00); // Architecture: 0 = Little Endian
  pushU16(0x00); // Global Msg Num 0: file_id
  pushU8(0x03); // Number of fields: 3

  // Field 1: type (enum / uint8)
  pushU8(0x00); // Field definition 0: type
  pushU8(0x01); // Size: 1 byte
  pushU8(0x00); // Base type: enum

  // Field 2: manufacturer (uint16)
  pushU8(0x01); // Field definition 1: manufacturer
  pushU8(0x02); // Size: 2 bytes
  pushU8(0x84); // Base type: uint16

  // Field 3: time_created (uint32)
  pushU8(0x04); // Field definition 4: time_created
  pushU8(0x04); // Size: 4 bytes
  pushU8(0x86); // Base type: uint32

  // File ID Data Record (Local Msg Header 0x00 = Data for Local Msg 0)
  const firstTimestamp = samples.length > 0 ? samples[0].timestamp : Date.now();
  const fitTimeCreated = unixMsToFitTime(firstTimestamp);

  pushU8(0x00); // Local Msg 0 Data Header
  pushU8(0x04); // Type: 4 (Activity)
  pushU16(0x0001); // Manufacturer: Garmin
  pushU32(fitTimeCreated); // time_created

  // 2. Record Definition Record (Local Msg Header 0x41 = Definition for Local Msg 1)
  pushU8(0x41); // Definition record
  pushU8(0x00); // Reserved
  pushU8(0x00); // Architecture: 0 = Little Endian
  pushU16(0x14); // Global Msg Num 20: record
  pushU8(0x05); // Number of fields: 5

  // Field 253: timestamp (uint32)
  pushU8(253);
  pushU8(4);
  pushU8(0x86); // uint32

  // Field 3: heart_rate (uint8)
  pushU8(3);
  pushU8(1);
  pushU8(0x02); // uint8

  // Field 5: distance (uint32 in 100 * meters)
  pushU8(5);
  pushU8(4);
  pushU8(0x86); // uint32

  // Field 13: temperature/thermal (uint8)
  pushU8(13);
  pushU8(1);
  pushU8(0x02); // uint8

  // Field 66: battery (uint8)
  pushU8(66);
  pushU8(1);
  pushU8(0x02); // uint8

  // Record Data Messages for each sample
  for (const s of samples) {
    pushU8(0x01); // Local Msg 1 Data Header
    pushU32(unixMsToFitTime(s.timestamp)); // timestamp
    pushU8(clamp(s.heartRate, 0, 255)); // heart_rate
    pushU32(Math.round(s.distanceMeters * 100)); // distance (scaled x100)
    pushU8(clamp(Math.round(s.thermalStress * 100), 0, 100)); // thermal stress %
    pushU8(clamp(Math.round(s.battery), 0, 100)); // battery %
  }

  // Construct final binary array
  const dataSize = recordsDataBuffer.length;
  const headerSize = 14;
  const totalFileSize = headerSize + dataSize + 2; // Data + 2-byte CRC
  const fitFile = new Uint8Array(totalFileSize);

  // Fill Header
  fitFile[0] = headerSize; // Header Size
  fitFile[1] = 0x20; // Protocol Version (2.0)
  fitFile[2] = 0x34; // Profile Version (21.00 - low byte)
  fitFile[3] = 0x08; // Profile Version (high byte)
  fitFile[4] = dataSize & 0xff;
  fitFile[5] = (dataSize >> 8) & 0xff;
  fitFile[6] = (dataSize >> 16) & 0xff;
  fitFile[7] = (dataSize >> 24) & 0xff;
  fitFile[8] = 0x2e; // '.'
  fitFile[9] = 0x46; // 'F'
  fitFile[10] = 0x49; // 'I'
  fitFile[11] = 0x54; // 'T'

  // Header CRC
  const headerCrc = computeFitCrc(fitFile, 0, 12);
  fitFile[12] = headerCrc & 0xff;
  fitFile[13] = (headerCrc >> 8) & 0xff;

  // Fill Data Records
  fitFile.set(recordsDataBuffer, headerSize);

  // File CRC
  const fileCrc = computeFitCrc(fitFile, 0, headerSize + dataSize);
  fitFile[headerSize + dataSize] = fileCrc & 0xff;
  fitFile[headerSize + dataSize + 1] = (fileCrc >> 8) & 0xff;

  return fitFile;
}

/**
 * Client-side file trigger helper to trigger browser download of CSV or FIT file.
 */
export function downloadClientFile(
  content: string | Uint8Array,
  filename: string,
  mimeType: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const parts: BlobPart[] =
    typeof content === "string" ? [content] : [content.buffer as ArrayBuffer];

  const blob = new Blob(parts, { type: mimeType });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
