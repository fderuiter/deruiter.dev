// @vitest-environment node
import { describe, it, expect } from "vitest";
import { exportFormToFhirQuestionnaire } from "@/lib/crf/fhir-questionnaire";
import { generateAcrfHtml } from "@/lib/crf/export-acrf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("CRF Studio - FHIR Questionnaire & aCRF Generator", () => {
  it("converts a CRF form into a valid FHIR R4 Questionnaire Resource", () => {
    const dmForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "DM")!;
    const fhir = exportFormToFhirQuestionnaire(
      dmForm,
      ONCOLOGY_RECIST_PRESET
    ) as {
      resourceType: string;
      status: string;
      item: Array<{
        linkId: string;
        type: string;
        item: Array<{ linkId: string; type: string }>;
      }>;
    };

    expect(fhir.resourceType).toBe("Questionnaire");
    expect(fhir.status).toBe("active");
    expect(fhir.item.length).toBeGreaterThan(0);
    expect(fhir.item[0].type).toBe("group");
  });

  it("generates publication-ready Annotated CRF (aCRF) HTML", () => {
    const vsForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "VS")!;
    const html = generateAcrfHtml(vsForm, ONCOLOGY_RECIST_PRESET);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Annotated CRF");
    expect(html).toContain(ONCOLOGY_RECIST_PRESET.protocolNumber);
    expect(html).toContain("VS.VSSTRESN [VSTESTCD=HEIGHT]");
  });
});
