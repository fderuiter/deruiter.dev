import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SEED,
  DEMO_301_STUDY,
  buildRecordedSuggestionKey,
  loadRecordedSdtmSuggestions,
  runPipeline,
} from "@/lib/study-data";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recorded SDTM mapping suggestions (#3531)", () => {
  it("provides exactly one synthetic suggestion per DEMO-301 raw collected column", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const run = runPipeline(DEMO_301_STUDY, {
      seed: DEFAULT_SEED,
      nSubjects: 10,
    });
    const rawColumns = run.datasets
      .filter((dataset) => dataset.layer === "collected")
      .flatMap((dataset) =>
        dataset.variables.map((variable) => `${dataset.name}.${variable.name}`)
      );

    const loaded = loadRecordedSdtmSuggestions("DEMO-301");
    expect(loaded).not.toBeNull();
    if (!loaded) return;

    expect(loaded.studyId).toBe("DEMO-301");
    expect(loaded.method.trim().length).toBeGreaterThan(0);
    expect(loaded.suggesterVersion.trim().length).toBeGreaterThan(0);
    expect(loaded.syntheticNotice).toMatch(/synthetic/i);

    expect(loaded.suggestions).toHaveLength(rawColumns.length);

    const byRawColumn = new Map<string, (typeof loaded.suggestions)[number]>();
    const seenKeys = new Set<string>();

    for (const suggestion of loaded.suggestions) {
      expect(suggestion.studyId).toBe("DEMO-301");
      expect(suggestion.synthetic).toBe(true);
      expect(suggestion.rawColumn).toBe(
        `${suggestion.sourceDataset}.${suggestion.sourceColumn}`
      );
      expect(suggestion.domain.trim().length).toBeGreaterThan(0);
      expect(suggestion.suggestedVariable.trim().length).toBeGreaterThan(0);
      expect(suggestion.method).toBe(loaded.method);
      expect(suggestion.suggesterVersion).toBe(loaded.suggesterVersion);
      expect(suggestion.rationale.trim().length).toBeGreaterThan(0);

      const expectedKey = buildRecordedSuggestionKey({
        studyId: suggestion.studyId,
        rawColumn: suggestion.rawColumn,
        suggestedVariable: suggestion.suggestedVariable,
        suggesterVersion: suggestion.suggesterVersion,
      });
      expect(suggestion.key).toBe(expectedKey);
      expect(suggestion.key).toBe(
        [
          suggestion.studyId,
          suggestion.rawColumn,
          suggestion.suggestedVariable,
          suggestion.suggesterVersion,
        ].join(":")
      );

      expect(byRawColumn.has(suggestion.rawColumn)).toBe(false);
      byRawColumn.set(suggestion.rawColumn, suggestion);

      expect(seenKeys.has(suggestion.key)).toBe(false);
      seenKeys.add(suggestion.key);
    }

    expect(new Set(byRawColumn.keys())).toEqual(new Set(rawColumns));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null for unknown study ids", () => {
    expect(loadRecordedSdtmSuggestions("UNKNOWN-STUDY")).toBeNull();
  });
});
