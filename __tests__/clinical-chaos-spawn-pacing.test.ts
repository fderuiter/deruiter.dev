// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  EMPTY_QUEUE_SPAWN_DELAY_SECONDS,
  SPAWN_INTERVAL_BY_PHASE,
  getSpawnIntervalSeconds,
  applyOfficeSpawnInterval,
  getOfficeById,
} from "../lib/clinical-trial-chaos";

describe("Clinical Trial Chaos spawn pacing (#1327)", () => {
  it("refills an empty queue almost at once in every phase", () => {
    for (const phase of [1, 2, 3] as const) {
      expect(getSpawnIntervalSeconds(phase, 0)).toBe(
        EMPTY_QUEUE_SPAWN_DELAY_SECONDS
      );
    }
    expect(EMPTY_QUEUE_SPAWN_DELAY_SECONDS).toBeLessThan(1);
  });

  it("fills a queue with one subject left at twice the phase rate", () => {
    expect(getSpawnIntervalSeconds(3, 1)).toBe(SPAWN_INTERVAL_BY_PHASE[3] / 2);
    expect(getSpawnIntervalSeconds(1, 1)).toBe(SPAWN_INTERVAL_BY_PHASE[1] / 2);
  });

  it("keeps the phase rate once the queue has work, faster each phase", () => {
    expect(getSpawnIntervalSeconds(1, 3)).toBe(6.5);
    expect(getSpawnIntervalSeconds(2, 3)).toBe(4.8);
    expect(getSpawnIntervalSeconds(3, 3)).toBe(3.5);
  });

  it("applies the office modifier to the phase rate but not to the refill", () => {
    const office = getOfficeById(null);
    const scale = (s: number) => applyOfficeSpawnInterval(s, office);
    expect(getSpawnIntervalSeconds(3, 2, scale)).toBe(scale(3.5));
    expect(getSpawnIntervalSeconds(3, 0, () => 99)).toBe(
      EMPTY_QUEUE_SPAWN_DELAY_SECONDS
    );
  });
});
