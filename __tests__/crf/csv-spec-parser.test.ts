import { describe, it, expect } from "vitest";
import { importStudyFromCsvSpec } from "@/lib/crf/csv-spec-parser";

describe("CRF Studio - CSV Study Specification Parser", () => {
  it("parses structured CSV study specifications into valid StudyProtocol", () => {
    const csvContent = `Domain,Form,Variable (CDASH),Label,Data Type,Core,aCRF Overlay Tag
DM,Demographics,BRTHYR,Year of Birth,integer,HR,DM.BRTHYR
DM,Demographics,SEX,Sex,single_select,R,DM.SEX
VS,Vital Signs,SYSBP,Systolic Blood Pressure,number,R,VS.SYSBP
VS,Vital Signs,DIABP,Diastolic Blood Pressure,number,R,VS.DIABP`;

    const parsed = importStudyFromCsvSpec(csvContent);

    expect(parsed.protocolNumber).toContain("CSV-SPEC-");
    expect(parsed.forms.length).toBe(2);

    const dmForm = parsed.forms.find((f) => f.domain === "DM");
    expect(dmForm).toBeDefined();
    expect(dmForm?.name).toBe("Demographics");
    expect(dmForm?.sections[0].fields.length).toBe(2);

    const brthyr = dmForm?.sections[0].fields[0];
    expect(brthyr?.variableName).toBe("BRTHYR");
    expect(brthyr?.dataType).toBe("integer");
    expect(brthyr?.cdashMetadata?.core).toBe("HR");

    const vsForm = parsed.forms.find((f) => f.domain === "VS");
    expect(vsForm).toBeDefined();
    expect(vsForm?.sections[0].fields.length).toBe(2);

    expect(parsed.visits.length).toBeGreaterThan(0);
    expect(parsed.provenance?.sourceFormat).toBe("CSV Study Specification");
  });

  it("handles quoted CSV values with embedded commas", () => {
    const csvContent = `Domain,Form,Variable,Label,Type,Core
AE,"Adverse Events, Serious & Non-Serious",AETERM,"Reported Term for Adverse Event, verbatim",text,R`;

    const parsed = importStudyFromCsvSpec(csvContent);
    expect(parsed.forms.length).toBe(1);
    expect(parsed.forms[0].name).toBe("Adverse Events, Serious & Non-Serious");
    expect(parsed.forms[0].sections[0].fields[0].label).toBe(
      "Reported Term for Adverse Event, verbatim"
    );
  });

  it("throws actionable errors for empty or malformed CSV content", () => {
    expect(() => importStudyFromCsvSpec("")).toThrow("Empty file content");
    expect(() => importStudyFromCsvSpec("Domain,Form,Variable")).toThrow(
      "Insufficient rows"
    );
  });
});
