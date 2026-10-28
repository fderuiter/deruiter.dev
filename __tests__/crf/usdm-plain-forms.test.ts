// @vitest-environment node
import { describe, expect, it } from "vitest";
import { exportStudyToUsdmObject, importStudyFromUsdm } from "@/lib/crf";
import { DEVICE_CARDIOVASCULAR_IMPLANT_PRESET } from "@/lib/crf/presets";
import { DEMO_301_USDM } from "@/lib/study-data/presets";
import { TAVR_DEVICE_USDM, TAVR_SAVR_USDM } from "@/lib/study-workspace";

/**
 * A USDM file written without CRF Studio's extensions still opens with form
 * items (epic #3071, step 4): each activity becomes a form whose items are
 * the biomedical concepts it collects.
 */
type StudyFile = Parameters<typeof importStudyFromUsdm>[0];

const items = (usdm: StudyFile, formId: string) =>
  importStudyFromUsdm(usdm)
    .forms.find((form) => form.id === formId)
    ?.sections.flatMap((section) => section.fields) ?? [];

describe("opening a plain USDM study in CRF Studio", () => {
  it("gives DEMO-301's vital signs form one item per test, with units", () => {
    const vitals = items(DEMO_301_USDM, "act_vs");
    expect(vitals.map((field) => field.variableName)).toEqual(
      expect.arrayContaining(["SYSBP", "DIABP", "PULSE", "WEIGHT"])
    );
    const systolic = vitals.find((field) => field.variableName === "SYSBP");
    expect(systolic).toMatchObject({
      conceptId: "bc_sysbp",
      dataType: "number",
      unit: "mmHg",
    });
  });

  it("covers every DEMO-301 activity that names biomedical concepts", () => {
    const study = importStudyFromUsdm(DEMO_301_USDM);
    const design = (DEMO_301_USDM.study.versions ?? [])[0].studyDesigns?.[0];
    for (const activity of design?.activities ?? []) {
      const form = study.forms.find(
        (candidate) => candidate.id === activity.id
      );
      const fields = form?.sections.flatMap((section) => section.fields) ?? [];
      expect(fields.map((field) => field.conceptId)).toEqual(
        activity.biomedicalConceptIds ?? []
      );
    }
  });

  it("leaves a form described only by a surrogate without items", () => {
    expect(items(DEMO_301_USDM, "act_dm")).toEqual([]);
  });

  it("reads the CDASH variable from a concept's synonym and infers dates", () => {
    const adverse = items(TAVR_DEVICE_USDM, "form_ae_dev");
    expect(
      adverse.find((field) => field.conceptId === "bc_ae_aeterm")
    ).toMatchObject({ variableName: "AETERM", dataType: "text" });
    expect(
      adverse.find((field) => field.conceptId === "bc_ae_aestdtc")?.dataType
    ).toBe("date");
  });

  it("opens both device studies with the same vital signs items", () => {
    const names = (usdm: StudyFile, formId: string) =>
      items(usdm, formId).map((field) => field.variableName);
    expect(names(TAVR_DEVICE_USDM, "form_vs_dev")).toEqual(
      names(TAVR_SAVR_USDM, "form_vs_rct")
    );
    expect(names(TAVR_DEVICE_USDM, "form_vs_dev").length).toBeGreaterThan(0);
  });

  it("still opens a CRF Studio export with its own form layout", () => {
    const exported = exportStudyToUsdmObject(
      DEVICE_CARDIOVASCULAR_IMPLANT_PRESET
    );
    const reopened = importStudyFromUsdm(exported);
    const layout = (
      sections: { id: string; fields: { id: string }[] }[] = []
    ) =>
      sections.map((section) => [section.id, section.fields.map((f) => f.id)]);
    expect(
      layout(reopened.forms.find((form) => form.id === "form_vs_dev")?.sections)
    ).toEqual(
      layout(
        DEVICE_CARDIOVASCULAR_IMPLANT_PRESET.forms.find(
          (form) => form.id === "form_vs_dev"
        )?.sections
      )
    );
  });
});
