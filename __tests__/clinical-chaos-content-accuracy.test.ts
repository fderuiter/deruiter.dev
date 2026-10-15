// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  generateProceduralObservation,
  generateSDTMDataset,
  getProceduralFields,
  MOCK_OBSERVATION_TEMPLATES,
  type ClinicalObservation,
} from "@/lib/clinical-trial-chaos";
import { createSeededRandom } from "@/lib/game-utils";

// NCI Thesaurus codes for the SDTM test codes the game teaches (#2171).
const NCI_CODES: Record<string, string> = {
  Height: "C25347",
  Weight: "C25208",
  "Systolic BP": "C25298",
  "Diastolic BP": "C25299",
  "Heart Rate": "C49677",
  "Body Temp": "C25206",
  "Serum Creatinine": "C64547",
};

const corruptions = MOCK_OBSERVATION_TEMPLATES.flatMap((t) =>
  t.corruptions.map((c) => ({ template: t, corruption: c }))
);

describe("authored observation content (#2171)", () => {
  it("offers the corrected value exactly once among four distinct options", () => {
    for (const { corruption } of corruptions) {
      expect(corruption.options).toHaveLength(4);
      expect(new Set(corruption.options).size).toBe(4);
      expect(
        corruption.options.filter((o) => o === corruption.correctedValue)
      ).toHaveLength(1);
    }
  });

  it("never teaches imputing or normalising a value to the reference range", () => {
    for (const { corruption } of corruptions) {
      expect(corruption.explanation).not.toMatch(
        /reference range|\bcap\b|end of month/i
      );
    }
    const seriousness = corruptions.find(
      ({ template }) => template.testCode === "AESER"
    );
    expect(seriousness?.corruption.rawValue).not.toMatch(/maybe|unknown/i);
  });

  it("writes the white cell count in the same magnitude as its answer", () => {
    const wbc = corruptions.find(({ template }) => template.testCode === "WBC");
    const raw = Number(wbc!.corruption.rawValue.replace(/[^0-9.]/g, ""));
    expect(raw).toBe(6.2e9);
  });

  it("uses the right NCI code for each vital sign and lab", () => {
    for (const { template, corruption } of corruptions) {
      const code = NCI_CODES[template.field];
      if (code) expect(corruption.ctCode).toBe(code);
    }
    const random = createSeededRandom(7);
    for (const field of getProceduralFields()) {
      const obs = generateProceduralObservation({ field, random, id: "o" });
      const code = NCI_CODES[field];
      if (code) expect(obs?.ctCode).toBe(code);
    }
  });

  it("exports the SDTM short test code, not the NCI code, as TESTCD", () => {
    const observations: ClinicalObservation[] = corruptions.map(
      ({ template, corruption }, i) => ({
        id: `o-${i}`,
        field: template.field,
        rawValue: corruption.rawValue,
        correctedValue: corruption.correctedValue,
        currentValue: corruption.correctedValue,
        destination: template.destination,
        ctCode: corruption.ctCode,
        isResolved: true,
      })
    );
    const rows = generateSDTMDataset([
      {
        id: "s",
        subjectLabel: "SUBJ-1",
        studySite: "Site 014 (Boston General)",
        observations,
        status: "submitted",
        timeRemaining: 30,
        maxTime: 30,
        createdAt: 0,
      },
    ]);
    rows.forEach((row, i) => {
      expect(row.TESTCD).toBe(corruptions[i].template.testCode);
      expect(row.TESTCD).toMatch(/^[A-Z][A-Z0-9]{0,7}$/);
    });
  });
});
