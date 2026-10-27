// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportUniversalCrfJson } from "@/lib/crf";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import {
  CrfInputError,
  DEFAULT_FILE,
  loadProtocol,
  saveProtocol,
} from "../../scripts/crf-input";

// #3091: the CLI used to swap a missing or unparseable study file for the
// oncology preset without a word, then write preset content to the path.
describe("CRF CLI study file input (#3091)", () => {
  let dir: string;
  const preset = getOncologyPresetSync();

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "crf-cli-input-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("loads a named file that exists and parses", () => {
    const file = path.join(dir, "mine.crf.json");
    const study = { ...preset, protocolNumber: "MINE-001" };
    fs.writeFileSync(file, exportUniversalCrfJson(study));
    const loaded = loadProtocol(file);
    expect(loaded.fromDemo).toBe(false);
    expect(loaded.path).toBe(file);
    expect(loaded.study.protocolNumber).toBe("MINE-001");
  });

  it("refuses a named file that does not exist", () => {
    const file = path.join(dir, "missing.crf.json");
    expect(() => loadProtocol(file)).toThrow(CrfInputError);
    expect(() => loadProtocol(file)).toThrow(`${file} does not exist.`);
  });

  it("refuses a file that does not parse, and leaves it untouched", () => {
    const file = path.join(dir, "broken.crf.json");
    fs.writeFileSync(file, "{ not json");
    expect(() => loadProtocol(file)).toThrow(
      /is not a valid Universal CRF protocol/
    );
    expect(fs.readFileSync(file, "utf8")).toBe("{ not json");
  });

  it("refuses a broken default file instead of showing the demo", () => {
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    fs.writeFileSync(path.join(dir, DEFAULT_FILE), "[]");
    expect(() => loadProtocol(undefined)).toThrow(CrfInputError);
  });

  it("shows the demo preset for a read with no file, and says so", () => {
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    const warn = vi.fn();
    const loaded = loadProtocol(undefined, { warn });
    expect(loaded.fromDemo).toBe(true);
    expect(loaded.study.protocolNumber).toBe(preset.protocolNumber);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("oncology demo preset")
    );
  });

  it("never writes a change made to the demo preset", () => {
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    const loaded = loadProtocol(undefined, { warn: () => {} });
    expect(() => saveProtocol(loaded, loaded.study)).toThrow(
      /Nothing was saved/
    );
    expect(fs.existsSync(path.join(dir, DEFAULT_FILE))).toBe(false);
  });

  it("lets preset load create a file that does not exist yet", () => {
    const file = path.join(dir, "new.crf.json");
    const warn = vi.fn();
    const loaded = loadProtocol(file, { allowMissing: true, warn });
    expect(warn).not.toHaveBeenCalled();
    saveProtocol(loaded, preset, { replaces: true });
    expect(loadProtocol(file).study.protocolNumber).toBe(preset.protocolNumber);
  });

  it("writes a change back to the file it came from", () => {
    const file = path.join(dir, "mine.crf.json");
    fs.writeFileSync(file, exportUniversalCrfJson(preset));
    const loaded = loadProtocol(file);
    saveProtocol(loaded, { ...loaded.study, protocolNumber: "EDITED-002" });
    expect(loadProtocol(file).study.protocolNumber).toBe("EDITED-002");
  });

  it("exits non-zero with a plain message when the named file is missing", () => {
    const file = path.join(dir, "missing.crf.json");
    const run = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/crf.ts", "validate", file],
      { cwd: process.cwd(), encoding: "utf8", timeout: 60_000 }
    );
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`${file} does not exist.`);
    expect(run.stderr).not.toContain("Fatal error");
  }, 60_000);
});
