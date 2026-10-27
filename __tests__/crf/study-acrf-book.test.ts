// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateAcrfHtml,
  generateStudyAcrfBookHtml,
  generateSdtmMappingMatrix,
} from "@/lib/crf";
import {
  ONCOLOGY_RECIST_PRESET,
  CLINICAL_INSTRUMENTS_PRESET,
  STUDY_PRESETS,
} from "@/lib/crf/presets";

describe("Annotated CRF (aCRF) Submission Suite & Clinical Presets", () => {
  it("should generate a valid single-form aCRF HTML document", () => {
    const form = ONCOLOGY_RECIST_PRESET.forms[0];
    const html = generateAcrfHtml(form, ONCOLOGY_RECIST_PRESET);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("SUBMISSION aCRF");
    expect(html).toContain(form.name);
    expect(html).toContain("DM.BRTHYR");
  });

  it("should generate a complete multi-page Study aCRF Book with Table of Contents", () => {
    const html = generateStudyAcrfBookHtml(ONCOLOGY_RECIST_PRESET);

    expect(html).toContain(
      "REGULATORY SUBMISSION ANNOTATED CASE REPORT FORM BOOK (aCRF)"
    );
    expect(html).toContain("Table of Contents &amp; SDTM Domain Index");
    expect(html).toContain(ONCOLOGY_RECIST_PRESET.protocolNumber);

    // Verify all forms are included in book
    ONCOLOGY_RECIST_PRESET.forms.forEach((f) => {
      expect(html).toContain(f.name);
    });
  });

  it("should extract a complete SDTM mapping matrix with proper origin tags", () => {
    const matrix = generateSdtmMappingMatrix(ONCOLOGY_RECIST_PRESET);
    expect(matrix.length).toBeGreaterThan(5);

    const crfField = matrix.find((m) => m.origin === "CRF");
    expect(crfField).toBeDefined();

    // Check for derived fields if any
    const derivedField = matrix.find((m) => m.origin === "Derived");
    if (derivedField) {
      expect(derivedField.dataType).toBe("calculated");
    }
  });

  it("should properly load CLINICAL_INSTRUMENTS_PRESET with PHQ-9, ECG QTc, and SAE forms", () => {
    expect(CLINICAL_INSTRUMENTS_PRESET.forms.length).toBe(3);
    const phq9 = CLINICAL_INSTRUMENTS_PRESET.forms.find(
      (f) => f.id === "form_phq9"
    );
    const ecg = CLINICAL_INSTRUMENTS_PRESET.forms.find(
      (f) => f.id === "form_ecg_cardio"
    );
    const sae = CLINICAL_INSTRUMENTS_PRESET.forms.find(
      (f) => f.id === "form_sae_expedited"
    );

    expect(phq9).toBeDefined();
    expect(ecg).toBeDefined();
    expect(sae).toBeDefined();

    // Verify preset is registered in catalog
    const registered = STUDY_PRESETS.find(
      (p) => p.id === "clinical_instruments"
    );
    expect(registered).toBeDefined();
  });
});
