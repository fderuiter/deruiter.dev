import { readFileSync } from "node:fs";
import path from "node:path";
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  STUDY_PRESETS,
  ONCOLOGY_RECIST_PRESET,
  diffUniversalCrfStudies,
  exportStudyToUsdm,
  exportStudyToUsdmObject,
  getUsdmDocumentVersion,
  getUsdmV4EncounterSchedule,
  importStudyFromUsdm,
  parseIsoDurationDays,
  studyDayDistance,
  addCalendarDaysToStudyDay,
  USDM_TIMING_AFTER,
  USDM_TIMING_BEFORE,
  USDM_V4_VERSION,
  type UsdmV4InterventionalStudyDesign,
} from "@/lib/crf";
import { loadUsdmV4Schema, validateUsdmV4 } from "../helpers/usdm-v4-schema";

const V3_FIXTURE = path.resolve(
  __dirname,
  "..",
  "fixtures",
  "usdm",
  "oncology-recist.usdm-v3.json"
);

describe("vendored USDM v4.0.0 schema fixture", () => {
  it("records its source, version and licence", () => {
    const schema = loadUsdmV4Schema();
    const source = schema["x-source"] as Record<string, string>;
    const license = schema["x-license"] as Record<string, string>;
    expect(source.repository).toBe("https://github.com/cdisc-org/DDF-RA");
    expect(source.ref).toBe("v4.0.0");
    expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(license.spdx).toBe("MIT");
    expect(license.text).toContain("Copyright (c) 2022 CDISC");
    expect(schema.$ref).toBe("#/$defs/Wrapper-Input");
  });

  it("rejects documents that break the published model", () => {
    const doc = exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET);
    expect(validateUsdmV4(doc)).toEqual([]);

    const noTitles = structuredClone(doc);
    Reflect.deleteProperty(noTitles.study.versions![0], "titles");
    expect(validateUsdmV4(noTitles).join("\n")).toContain("titles");

    const badStudyId = structuredClone(doc);
    badStudyId.study.id = "not-a-uuid";
    expect(validateUsdmV4(badStudyId).join("\n")).toContain("study.id");

    const badArmType = structuredClone(doc);
    const arm = badArmType.study.versions![0].studyDesigns![0].arms[0];
    Reflect.deleteProperty(arm.type, "codeSystem");
    expect(validateUsdmV4(badArmType).join("\n")).toContain(
      "study.versions.0.studyDesigns.0"
    );
  });
});

describe("CRF Studio USDM v4.0 export", () => {
  it.each(STUDY_PRESETS.map((p) => [p.id, p.study] as const))(
    "validates the %s export against the USDM v4.0.0 schema",
    (_id, study) => {
      const doc = exportStudyToUsdmObject(study);
      expect(doc.usdmVersion).toBe(USDM_V4_VERSION);
      expect(validateUsdmV4(doc)).toEqual([]);
    }
  );

  it("places the design on study version, arms, epochs, cells, encounters, activities and timeline", () => {
    const doc = exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET);
    const version = doc.study.versions![0];
    const design = version.studyDesigns![0];
    expect(doc.study.instanceType).toBe("Study");
    expect(version.studyIdentifiers[0].text).toBe("ONC-2026-003");
    expect(design.instanceType).toBe("InterventionalStudyDesign");
    expect(design.arms).toHaveLength(2);
    expect(design.epochs).toHaveLength(3);
    expect(design.studyCells.length).toBeGreaterThan(0);
    expect(design.encounters).toHaveLength(6);
    expect(design.activities).toHaveLength(6);
    expect(version.biomedicalConcepts!.length).toBeGreaterThanOrEqual(3);
    expect(design.scheduleTimelines).toHaveLength(1);

    const schedule = getUsdmV4EncounterSchedule(design);
    const c1d1 = schedule.find((s) => s.encounterId === "v_c1d1");
    const source = ONCOLOGY_RECIST_PRESET.visits.find(
      (v) => v.id === "v_c1d1"
    )!;
    expect(c1d1?.targetDay).toBe(source.targetDay);
    expect(c1d1?.epochId).toBe("e_trt");
    for (const visit of ONCOLOGY_RECIST_PRESET.visits.filter(
      (v) => v.visitType !== "Unscheduled"
    )) {
      const entry = schedule.find((s) => s.encounterId === visit.id);
      expect(entry?.targetDay).toBe(visit.targetDay);
      expect(entry?.windowBefore).toBe(Math.abs(visit.windowBefore || 0));
      expect(entry?.windowAfter).toBe(Math.abs(visit.windowAfter || 0));
    }
  });

  it.each(STUDY_PRESETS.map((p) => [p.id, p.study] as const))(
    "round-trips the %s preset through USDM v4 without drift",
    (_id, study) => {
      const json = exportStudyToUsdm(study);
      const reimported = importStudyFromUsdm(json);
      const json2 = exportStudyToUsdm(reimported);
      expect(json2).toBe(json);
      expect(
        diffUniversalCrfStudies(reimported, importStudyFromUsdm(json2))
          .hasChanges
      ).toBe(false);
    }
  );
});

describe("version-aware USDM reader", () => {
  it("detects v3 and v4 documents", () => {
    const v3 = JSON.parse(readFileSync(V3_FIXTURE, "utf8"));
    expect(getUsdmDocumentVersion(v3)).toBe("3");
    expect(
      getUsdmDocumentVersion(exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET))
    ).toBe("4");
    expect(getUsdmDocumentVersion(null)).toBe("3");
    expect(getUsdmDocumentVersion({ usdmVersion: "4.0.0" })).toBe("4");
  });

  it("imports a USDM 3.0.0 export from before the upgrade to the same study as the v4 export", () => {
    // The fixture is `exportStudyToUsdm(ONCOLOGY_RECIST_PRESET)` as written by
    // the 3.0.0 adapter on main before the v4 upgrade (#2584).
    const v3 = readFileSync(V3_FIXTURE, "utf8");
    expect(JSON.parse(v3).schemaVersion).toBe("3.0.0");
    const fromV3 = importStudyFromUsdm(v3);
    const fromV4 = importStudyFromUsdm(
      exportStudyToUsdm(ONCOLOGY_RECIST_PRESET)
    );
    expect(diffUniversalCrfStudies(fromV3, fromV4).hasChanges).toBe(false);
  });

  it("reads a foreign USDM v4 document from native properties alone", () => {
    const doc = exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET);
    const stripped = JSON.parse(
      JSON.stringify(doc, (key, value) =>
        key === "extensionAttributes"
          ? (value as { url: string }[]).filter((e) =>
              e.url.endsWith("/sdtm-domain")
            )
          : value
      )
    );
    expect(validateUsdmV4(stripped)).toEqual([]);
    const study = importStudyFromUsdm(stripped);
    expect(study.protocolNumber).toBe("ONC-2026-003");
    expect(study.arms?.map((a) => a.id)).toEqual(
      ONCOLOGY_RECIST_PRESET.arms?.map((a) => a.id)
    );
    expect(study.visits.map((v) => [v.id, v.targetDay])).toEqual(
      ONCOLOGY_RECIST_PRESET.visits.map((v) => [v.id, v.targetDay])
    );
    expect(study.forms.map((f) => f.domain)).toEqual(
      ONCOLOGY_RECIST_PRESET.forms.map((f) => f.domain)
    );
  });
});

describe("USDM v4 timing helpers", () => {
  it("parses ISO 8601 durations into days", () => {
    expect(parseIsoDurationDays("P14D")).toBe(14);
    expect(parseIsoDurationDays("P2W")).toBe(14);
    expect(parseIsoDurationDays("-P3D")).toBe(-3);
    expect(parseIsoDurationDays("PT36H")).toBe(2);
    expect(parseIsoDurationDays("P")).toBeNull();
    expect(parseIsoDurationDays("14 days")).toBeNull();
    expect(parseIsoDurationDays(undefined)).toBeNull();
  });

  it("codes Before as C201357 and After as C201356 (Timing Type, C201264)", () => {
    expect(USDM_TIMING_BEFORE).toBe("C201357");
    expect(USDM_TIMING_AFTER).toBe("C201356");
    const doc = exportStudyToUsdmObject(ONCOLOGY_RECIST_PRESET);
    const timings =
      doc.study.versions?.[0]?.studyDesigns?.[0]?.scheduleTimelines?.[0]
        ?.timings ?? [];
    const byDecode = new Map(
      timings.map((timing) => [timing.type?.decode, timing.type?.code])
    );
    expect(byDecode.get("Before")).toBe("C201357");
    expect(byDecode.get("After")).toBe("C201356");
  });

  it("reads a timing's direction from its decode first, then its code", () => {
    const design = (
      before: { code: string; decode: string },
      after: { code: string; decode: string }
    ) =>
      fromPartial<Pick<UsdmV4InterventionalStudyDesign, "scheduleTimelines">>({
        scheduleTimelines: [
          {
            mainTimeline: true,
            instances: ["scr", "base", "wk2"].map((id) => ({
              id,
              encounterId: `enc_${id}`,
              instanceType: "ScheduledActivityInstance",
            })),
            timings: [
              {
                type: { code: "C201358", decode: "Fixed Reference" },
                value: "P0D",
                relativeFromScheduledInstanceId: "base",
                relativeToScheduledInstanceId: null,
              },
              {
                type: before,
                value: "P14D",
                relativeFromScheduledInstanceId: "scr",
                relativeToScheduledInstanceId: "base",
              },
              {
                type: after,
                value: "P14D",
                relativeFromScheduledInstanceId: "wk2",
                relativeToScheduledInstanceId: "base",
              },
            ],
          },
        ],
      });
    const days = (d: ReturnType<typeof design>) =>
      getUsdmV4EncounterSchedule(d).map((visit) => visit.targetDay);
    // Codes alone, as another USDM producer may send them.
    expect(
      days(
        design({ code: "C201357", decode: "" }, { code: "C201356", decode: "" })
      )
    ).toEqual([-14, 1, 15]);
    // CRF Studio's earlier exports: codes swapped, decodes right.
    expect(
      days(
        design(
          { code: "C201356", decode: "Before" },
          { code: "C201357", decode: "After" }
        )
      )
    ).toEqual([-14, 1, 15]);
  });

  it("has no study day zero", () => {
    expect(studyDayDistance(1, -1)).toBe(-1);
    expect(studyDayDistance(-14, 1)).toBe(14);
    expect(studyDayDistance(1, 85)).toBe(84);
    expect(addCalendarDaysToStudyDay(1, -1)).toBe(-1);
    expect(addCalendarDaysToStudyDay(-1, 1)).toBe(1);
    expect(addCalendarDaysToStudyDay(1, 84)).toBe(85);
  });
});
