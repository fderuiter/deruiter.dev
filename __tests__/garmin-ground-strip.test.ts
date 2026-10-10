// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_GROUND_STRIP,
  GROUND_STRIP_FIELDS,
  GROUND_STRIP_FIELD_LABELS,
  GROUND_STRIP_STORAGE_KEY,
  isGroundStripField,
  loadGroundStrip,
  saveGroundStrip,
} from "@/lib/garmin-ground-strip";

let store: Record<string, string>;

beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    },
  });
});

describe("ground strip layout", () => {
  it("defaults to steps, distance and variables", () => {
    expect(loadGroundStrip()).toEqual(["steps", "distance", "vars"]);
  });

  it("labels every field", () => {
    for (const field of GROUND_STRIP_FIELDS) {
      expect(GROUND_STRIP_FIELD_LABELS[field]).toBeTruthy();
    }
  });

  it("round-trips a saved layout", () => {
    expect(saveGroundStrip(["heartRate", "thermal", "ram"])).toBe(true);
    expect(loadGroundStrip()).toEqual(["heartRate", "thermal", "ram"]);
  });

  it("replaces only the unknown slots with their defaults", () => {
    store[GROUND_STRIP_STORAGE_KEY] = JSON.stringify(["fog", "nope", 7]);
    expect(loadGroundStrip()).toEqual(["fog", "distance", "vars"]);
  });

  it("does not accept names inherited from Object.prototype", () => {
    for (const name of [
      "toString",
      "constructor",
      "__proto__",
      "hasOwnProperty",
    ]) {
      expect(isGroundStripField(name)).toBe(false);
    }
    store[GROUND_STRIP_STORAGE_KEY] = JSON.stringify([
      "toString",
      "constructor",
      "__proto__",
    ]);
    expect(loadGroundStrip()).toEqual(DEFAULT_GROUND_STRIP);
  });

  it("falls back to the defaults for corrupt or wrongly shaped data", () => {
    for (const raw of ["{not json", "null", "42", '{"0":"fog"}', '"fog"']) {
      store[GROUND_STRIP_STORAGE_KEY] = raw;
      expect(loadGroundStrip()).toEqual(DEFAULT_GROUND_STRIP);
    }
  });

  it("tolerates a short saved array", () => {
    store[GROUND_STRIP_STORAGE_KEY] = JSON.stringify(["fog"]);
    expect(loadGroundStrip()).toEqual(["fog", "distance", "vars"]);
  });
});
