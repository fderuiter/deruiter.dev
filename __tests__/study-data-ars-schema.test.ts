// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ARS_REPORTING_EVENT_PATH,
  ARS_RESULT_LINEAGE_PATH,
  buildTlfOutputs,
  DEMO_301_STUDY,
  MESSY_DATA_SCENARIOS,
  runPipeline,
  writeArsJson,
  writeArsLineageJson,
  writeTlfFiles,
  type ArsReportingEvent,
} from "@/lib/study-data";
import {
  readArsSchemaBytes,
  validateArsReportingEvent,
} from "./helpers/ars-schema";

// #3025 (part of #2992): the reporting event file is checked against the
// official CDISC ARS 1.0 JSON schema, not just shaped like it.

const event = buildTlfOutputs(
  DEMO_301_STUDY,
  runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 })
).reportingEvent;
const ars = JSON.parse(writeArsJson(event)) as Record<string, unknown>;
const lineage = JSON.parse(writeArsLineageJson(event)) as {
  reportingEventId: string;
  notice: string;
  studyId: string;
  seed: number;
  nSubjects: number;
  standards: ArsReportingEvent["standards"];
  analysisPrecision: { analysisId: string; rawDecimals: number }[];
  results: {
    analysisId: string;
    resultIndex: number;
    resultId: string;
    operationId: string;
    rowReferences: ArsReportingEvent["analyses"][number]["results"][number]["rowReferences"];
  }[];
  rowSets: ArsReportingEvent["rowSets"];
};

/** Every `sponsorTermId` in a document, with the key that holds it. */
function sponsorTermRefs(value: unknown, key = ""): [string, string][] {
  if (Array.isArray(value))
    return value.flatMap((item) => sponsorTermRefs(item, key));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([name, inner]) =>
    name === "sponsorTermId" && typeof inner === "string"
      ? [[key, inner] as [string, string]]
      : sponsorTermRefs(inner, name)
  );
}

describe("the ARS reporting event against the ARS 1.0 schema (#3025)", () => {
  it("vendors the schema byte for byte", () => {
    expect(
      createHash("sha256").update(readArsSchemaBytes()).digest("hex")
    ).toBe("bf8dd98f3cf0abc4e88624600e3cf1962db0fd76f461a1d7e5c841bd788102e4");
  });

  it("writes a seed-301 reporting event the schema accepts", () => {
    expect(validateArsReportingEvent(ars)).toEqual([]);
  });

  it("rejects the in-memory model, whose lineage fields extend the ARS classes", () => {
    const errors = validateArsReportingEvent(JSON.parse(JSON.stringify(event)));
    expect(errors).toContain("/: must NOT have additional properties");
    expect(
      errors.some((error) => /^\/analyses\/\d+\/results\/\d+: /.test(error))
    ).toBe(true);
  });

  // Runs the full pipeline and reporting event once per messy-data scenario.
  it("stays valid across seeds and every messy-data scenario", () => {
    const runs = [
      ...[1, 302].map((seed) => ({ seed })),
      ...MESSY_DATA_SCENARIOS.map((scenario) => ({
        seed: 301,
        scenarios: [scenario.id],
      })),
    ];
    for (const options of runs) {
      const built = buildTlfOutputs(
        DEMO_301_STUDY,
        runPipeline(DEMO_301_STUDY, { ...options, nSubjects: 60 })
      ).reportingEvent;
      expect(
        validateArsReportingEvent(JSON.parse(writeArsJson(built))),
        JSON.stringify(options)
      ).toEqual([]);
    }
  }, 120_000);

  it("declares every sponsor term it uses, under the enumeration of the field, and no other", () => {
    const enumerationOf: Record<string, string> = {
      purpose: "AnalysisPurposeEnum",
      fileType: "OutputFileTypeEnum",
      reason: "AnalysisReasonEnum",
      referencedOperationRole: "OperationRoleEnum",
    };
    const declared = new Map(
      event.terminologyExtensions.flatMap((extension) =>
        extension.sponsorTerms.map(
          (term) => [term.id, extension.enumeration] as const
        )
      )
    );
    const used = sponsorTermRefs(ars);
    expect(used.length).toBeGreaterThan(0);
    for (const [field, id] of used) {
      expect(declared.get(id), `${field} ${id}`).toBe(enumerationOf[field]);
    }
    expect(new Set(used.map(([, id]) => id))).toEqual(new Set(declared.keys()));
  });

  it("uses an outcome measure purpose for every analysis that is not a baseline description", () => {
    for (const analysis of event.analyses) {
      const baseline =
        "sponsorTermId" in analysis.purpose &&
        analysis.purpose.sponsorTermId === "SponsorTerm_Purpose_BASELINE";
      expect(baseline, analysis.id).toBe(analysis.id.startsWith("An_14_1_1_"));
    }
  });

  it("keeps the synthetic-data notice in the ARS file", () => {
    expect(ars.description).toEqual(expect.stringContaining(event.notice));
  });
});

describe("the result lineage file (#3025)", () => {
  it("writes both files next to each other", () => {
    expect(
      writeTlfFiles({ reportingEvent: event, tables: [], figures: [] }).map(
        (file) => file.path
      )
    ).toEqual([ARS_REPORTING_EVENT_PATH, ARS_RESULT_LINEAGE_PATH]);
  });

  it("gives back the whole in-memory reporting event together with the ARS file", () => {
    const precision = new Map(
      lineage.analysisPrecision.map((entry) => [
        entry.analysisId,
        entry.rawDecimals,
      ])
    );
    const byResult = new Map(
      lineage.results.map((entry) => [
        `${entry.analysisId}#${entry.resultIndex}`,
        entry,
      ])
    );
    const {
      description: _description,
      analyses,
      ...rest
    } = ars as {
      description: string;
      analyses: {
        id: string;
        results: { operationId: string }[];
      }[];
    };
    const rebuilt = {
      ...rest,
      description: event.description,
      notice: lineage.notice,
      studyId: lineage.studyId,
      seed: lineage.seed,
      nSubjects: lineage.nSubjects,
      standards: lineage.standards,
      analyses: analyses.map((analysis) => ({
        ...analysis,
        ...(precision.has(analysis.id)
          ? { rawDecimals: precision.get(analysis.id) }
          : {}),
        results: analysis.results.map((result, index) => {
          const entry = byResult.get(`${analysis.id}#${index}`)!;
          expect(entry.operationId).toBe(result.operationId);
          return {
            ...result,
            id: entry.resultId,
            rowReferences: entry.rowReferences,
          };
        }),
      })),
      rowSets: lineage.rowSets,
    };
    expect(lineage.reportingEventId).toBe(event.id);
    expect(lineage.results).toHaveLength(
      event.analyses.reduce(
        (total, analysis) => total + analysis.results.length,
        0
      )
    );
    // Key order differs, so compare as values.
    expect(rebuilt).toEqual(JSON.parse(JSON.stringify(event)));
  });
});
