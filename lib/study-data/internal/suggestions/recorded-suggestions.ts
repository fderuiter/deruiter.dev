import type {
  RecordedSdtmSuggestion,
  RecordedSdtmSuggestionKeyParts,
  RecordedSdtmSuggestionSet,
  VariableOrigin,
} from "../../types";
import demo301Fixture from "./recorded-demo-301.json";

const KEY_SEPARATOR = ":";

interface RecordedFixtureRow {
  readonly key: string;
  readonly studyId: string;
  readonly rawColumn: string;
  readonly sourceDataset: string;
  readonly sourceColumn: string;
  readonly domain: string;
  readonly suggestedVariable: string;
  readonly suggestedOrigin: VariableOrigin;
  readonly method: string;
  readonly suggesterVersion: string;
  readonly rationale: string;
}

interface RecordedFixtureFile {
  readonly studyId: string;
  readonly method: string;
  readonly suggesterVersion: string;
  readonly syntheticNotice: string;
  readonly suggestions: readonly RecordedFixtureRow[];
}

/**
 * Builds the deterministic key for a recorded suggestion from study
 * identifier, raw column, suggested SDTM variable and suggester version.
 */
export function buildRecordedSuggestionKey(
  parts: RecordedSdtmSuggestionKeyParts
): string {
  return [
    parts.studyId,
    parts.rawColumn,
    parts.suggestedVariable,
    parts.suggesterVersion,
  ].join(KEY_SEPARATOR);
}

function normalizeFixture(
  fixture: RecordedFixtureFile
): RecordedSdtmSuggestionSet {
  const suggestions: readonly RecordedSdtmSuggestion[] = Object.freeze(
    fixture.suggestions.map((row) => {
      const expectedRawColumn = `${row.sourceDataset}.${row.sourceColumn}`;
      if (row.rawColumn !== expectedRawColumn) {
        throw new Error(
          `Recorded suggestion rawColumn mismatch: expected ${expectedRawColumn}, got ${row.rawColumn}`
        );
      }
      const expectedKey = buildRecordedSuggestionKey({
        studyId: row.studyId,
        rawColumn: row.rawColumn,
        suggestedVariable: row.suggestedVariable,
        suggesterVersion: row.suggesterVersion,
      });
      if (row.key !== expectedKey) {
        throw new Error(
          `Recorded suggestion key mismatch: expected ${expectedKey}, got ${row.key}`
        );
      }
      return Object.freeze({
        ...row,
        synthetic: true as const,
      });
    })
  );

  return Object.freeze({
    studyId: fixture.studyId,
    method: fixture.method,
    suggesterVersion: fixture.suggesterVersion,
    syntheticNotice: fixture.syntheticNotice,
    suggestions,
  });
}

const RECORDED_SUGGESTIONS: ReadonlyMap<string, RecordedSdtmSuggestionSet> =
  new Map([
    [
      demo301Fixture.studyId,
      normalizeFixture(demo301Fixture as RecordedFixtureFile),
    ],
  ]);

/**
 * Loads the recorded, synthetic SDTM mapping suggestions for a study.
 * Reads only committed static fixtures with no model or network call.
 */
export function loadRecordedSdtmSuggestions(
  studyId: string
): RecordedSdtmSuggestionSet | null {
  return RECORDED_SUGGESTIONS.get(studyId) ?? null;
}
