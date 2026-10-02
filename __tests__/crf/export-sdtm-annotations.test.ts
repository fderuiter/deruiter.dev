// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { generateSdtmMappingMatrix } from "@/lib/crf/export-acrf";
import { exportStudyToSas } from "@/lib/crf/export-sas";
import { exportStudyToR } from "@/lib/crf/export-r";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { exportFormToFhirQuestionnaire } from "@/lib/crf/fhir-questionnaire";
import { resolveBaseUrl } from "@/lib/domain";

/**
 * Reproduction for #1203: exports annotated fields with the CDASH collection
 * name (`ICDAT`) instead of the SDTM target the builder canvas shows, and
 * pointed readers of downloaded files at a relative `/schedule`.
 */

const study = ONCOLOGY_RECIST_PRESET;
const SCHEDULE = `${resolveBaseUrl()}/schedule`;

const icdat = study.forms
  .flatMap((f) => f.sections.flatMap((s) => s.fields))
  .find((f) => f.variableName === "ICDAT");

describe("[#1203] exports annotate SDTM targets and use absolute links", () => {
  it("uses the aCRF annotation, not the CDASH name, in the mapping matrix", () => {
    expect(icdat?.cdashMetadata?.acrfAnnotation).toContain("DS.DSSTDTC");
    const row = generateSdtmMappingMatrix(study).find(
      (r) => r.variableName === "ICDAT"
    );
    expect(row?.sdtmTarget).toBe(icdat?.cdashMetadata?.acrfAnnotation);
  });

  it("never picks sdtmVariable as the annotation in the PDF or DOCX writers", () => {
    for (const file of ["export-pdf.ts", "export-docx.ts", "export-acrf.ts"]) {
      const src = fs.readFileSync(
        path.resolve(process.cwd(), "lib/crf", file),
        "utf8"
      );
      expect(src, file).not.toMatch(/cdashMetadata\?\.sdtmVariable\s*\|\|/);
      expect(src, file).toContain("sdtmTargetFor(");
    }
  });

  it("links downloaded files to the absolute schedule URL", () => {
    const outputs = {
      sas: exportStudyToSas(study),
      r: exportStudyToR(study),
      odm: exportStudyToCdiscOdmXml(study),
      fhir: JSON.stringify(
        exportFormToFhirQuestionnaire(study.forms[0], study)
      ),
    };
    for (const [name, text] of Object.entries(outputs)) {
      expect(SCHEDULE).toMatch(/^https?:\/\//);
      expect(text, name).toContain(SCHEDULE);
      expect(text, name).not.toMatch(/Consultation: \/schedule/);
    }
  });
});
