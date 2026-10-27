import { describe, it, expect } from "vitest";
import {
  parsePrecisionDate,
  formatPrecisionDate,
  isFutureDate,
  validatePrecisionDate,
  validateCdashVariableName,
  isCdiscNullFlavor,
  UniversalStudyProtocolSchema,
  diffUniversalCrfStudies,
  exportStudyToSas,
  exportStudyToR,
  serializeStudyToOdmXml,
  exportStudyToFhirQuestionnaire,
  generateAcrfHtml,
} from "@/lib/crf";
import { StudyProtocol } from "@/lib/crf/types";

describe("CRF Studio: Precision Dates & ISO 8601 Parsing", () => {
  it("parses full ISO 8601 date YYYY-MM-DD", () => {
    const parsed = parsePrecisionDate("2024-05-18");
    expect(parsed.isValid).toBe(true);
    expect(parsed.isPartial).toBe(false);
    expect(parsed.year).toBe(2024);
    expect(parsed.month).toBe(5);
    expect(parsed.day).toBe(18);
    expect(parsed.isoString).toBe("2024-05-18");
  });

  it("parses year and month partial date YYYY-MM and YYYY-MM-UNK", () => {
    const parsedDash = parsePrecisionDate("2023-11");
    expect(parsedDash.isValid).toBe(true);
    expect(parsedDash.isPartial).toBe(true);
    expect(parsedDash.year).toBe(2023);
    expect(parsedDash.month).toBe(11);
    expect(parsedDash.day).toBeNull();
    expect(parsedDash.isoString).toBe("2023-11-UNK");

    const parsedUnk = parsePrecisionDate("2023-11-UNK");
    expect(parsedUnk.isValid).toBe(true);
    expect(parsedUnk.isPartial).toBe(true);
    expect(parsedUnk.year).toBe(2023);
    expect(parsedUnk.month).toBe(11);
    expect(parsedUnk.day).toBeNull();
    expect(parsedUnk.isoString).toBe("2023-11-UNK");
  });

  it("parses year-only partial date YYYY and YYYY-UNK-UNK", () => {
    const parsedYear = parsePrecisionDate("1998");
    expect(parsedYear.isValid).toBe(true);
    expect(parsedYear.isPartial).toBe(true);
    expect(parsedYear.year).toBe(1998);
    expect(parsedYear.month).toBeNull();
    expect(parsedYear.day).toBeNull();
    expect(parsedYear.isoString).toBe("1998-UNK-UNK");

    const parsedFullUnk = parsePrecisionDate("1998-UNK-UNK");
    expect(parsedFullUnk.isValid).toBe(true);
    expect(parsedFullUnk.isPartial).toBe(true);
    expect(parsedFullUnk.year).toBe(1998);
    expect(parsedFullUnk.month).toBeNull();
    expect(parsedFullUnk.day).toBeNull();
    expect(parsedFullUnk.isoString).toBe("1998-UNK-UNK");
  });

  it("formats precision date segments into standard ISO string", () => {
    expect(formatPrecisionDate(2025, 4, 12)).toBe("2025-04-12");
    expect(formatPrecisionDate(2025, 4, "UNK")).toBe("2025-04-UNK");
    expect(formatPrecisionDate(2025, 4, null)).toBe("2025-04-UNK");
    expect(formatPrecisionDate(2025, "UNK", "UNK")).toBe("2025-UNK-UNK");
    expect(formatPrecisionDate(2025, null, null)).toBe("2025-UNK-UNK");
  });

  it("identifies CDISC null-flavor tokens", () => {
    expect(isCdiscNullFlavor("ND")).toBe(true);
    expect(isCdiscNullFlavor("NA")).toBe(true);
    expect(isCdiscNullFlavor("UNK")).toBe(true);
    expect(isCdiscNullFlavor("2024-01-01")).toBe(false);
    expect(isCdiscNullFlavor(null)).toBe(false);

    const parsedNf = parsePrecisionDate("ND");
    expect(parsedNf.isValid).toBe(true);
    expect(parsedNf.nullFlavor).toBe("ND");
    expect(parsedNf.isoString).toBe("ND");
  });

  it("correctly evaluates future date constraints against UTC reference", () => {
    const futureYear = new Date().getUTCFullYear() + 2;
    expect(isFutureDate(`${futureYear}-01-01`)).toBe(true);
    expect(isFutureDate("2000-01-01")).toBe(false);

    const validatedFuture = validatePrecisionDate(`${futureYear}-06-15`, {
      preventFutureDate: true,
    });
    expect(validatedFuture.isValid).toBe(false);
    expect(validatedFuture.error).toContain("Future dates are not permitted");

    const validatedPast = validatePrecisionDate("2020-06-15", {
      preventFutureDate: true,
    });
    expect(validatedPast.isValid).toBe(true);
  });

  it("enforces partial date constraints when allowPartial is false", () => {
    const disallowed = validatePrecisionDate("2023-05-UNK", {
      allowPartial: false,
    });
    expect(disallowed.isValid).toBe(false);
    expect(disallowed.error).toContain("Partial dates are not allowed");

    const allowed = validatePrecisionDate("2023-05-UNK", {
      allowPartial: true,
    });
    expect(allowed.isValid).toBe(true);
  });
});

describe("CRF Studio: CDASH / SAS Variable Naming Validation", () => {
  it("validates compliant CDASH variable names", () => {
    expect(validateCdashVariableName("BRTHYR").isValid).toBe(true);
    expect(validateCdashVariableName("SYSBP").isValid).toBe(true);
    expect(validateCdashVariableName("AETERM").isValid).toBe(true);
    expect(validateCdashVariableName("AE_SEV").isValid).toBe(true);
    expect(validateCdashVariableName("V1").isValid).toBe(true);
  });

  it("rejects non-compliant variable names", () => {
    // Starts with number
    const startNum = validateCdashVariableName("1VAR");
    expect(startNum.isValid).toBe(false);
    expect(startNum.error).toContain("must start with a letter");

    // Longer than 8 chars
    const tooLong = validateCdashVariableName("TOOLONGVARNAME");
    expect(tooLong.isValid).toBe(false);
    expect(tooLong.error).toContain("exceeds CDASH/SAS 8-character limit");

    // Disallowed characters
    const hyphen = validateCdashVariableName("AE-TERM");
    expect(hyphen.isValid).toBe(false);
    expect(hyphen.error).toContain(
      "uppercase letters, digits, and underscores"
    );

    // Empty
    const empty = validateCdashVariableName("");
    expect(empty.isValid).toBe(false);
  });
});

describe("CRF Studio: Universal Schema & Diff Engine", () => {
  const baseStudy: StudyProtocol = {
    id: "study_test_1",
    protocolNumber: "PROTO-454",
    studyName: "Precision Date & Null Flavor Protocol",
    phase: "Phase III",
    sponsor: "BioPharma Therapeutics",
    therapeuticArea: "Oncology",
    version: "1.0.0",
    lastModified: "2026-08-19T00:00:00Z",
    forms: [
      {
        id: "form_vs",
        name: "Vital Signs",
        domain: "VS",
        description: "Baseline Vital Signs",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: "sec_1",
            title: "Vital Measurements",
            fields: [
              {
                id: "fld_vstdat",
                variableName: "VSDAT",
                label: "Vital Signs Assessment Date",
                dataType: "precision_date",
                columnSpan: 6,
                required: true,
                allowPartial: true,
                preventFutureDate: true,
                allowNullFlavor: true,
                requirementTier: "hard_stop",
                requiresSdv: true,
                isBlinded: false,
              },
            ],
          },
        ],
      },
    ],
    codelists: [],
    visits: [
      {
        id: "vis_scr",
        oid: "SE.SCRN",
        name: "Screening",
        visitType: "Scheduled",
        targetDay: 0,
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: ["form_vs"],
      },
    ],
  };

  it("validates precision date and governance attributes against Universal Zod schema", () => {
    const result = UniversalStudyProtocolSchema.safeParse(baseStudy);
    expect(result.success).toBe(true);
  });

  it("detects diff in requirement tiers, partial dates, and governance flags", () => {
    const modifiedStudy: StudyProtocol = {
      ...baseStudy,
      forms: [
        {
          ...baseStudy.forms[0],
          sections: [
            {
              ...baseStudy.forms[0].sections[0],
              fields: [
                {
                  ...baseStudy.forms[0].sections[0].fields[0],
                  requirementTier: "auto_query",
                  isBlinded: true,
                },
              ],
            },
          ],
        },
      ],
    };

    const diff = diffUniversalCrfStudies(baseStudy, modifiedStudy);
    expect(diff.hasChanges).toBe(true);
    expect(diff.modifiedForms.length).toBe(1);
    expect(diff.modifiedForms[0].formId).toBe("form_vs");
    expect(diff.modifiedForms[0].modifiedFields).toContain("VSDAT");
  });
});

describe("CRF Studio: Multi-Format Exporters Compilation", () => {
  const exportStudy: StudyProtocol = {
    id: "study_export_test",
    protocolNumber: "PROTO-EXP-01",
    studyName: "Exporter Test Protocol",
    phase: "Phase II",
    sponsor: "BioPharma Therapeutics",
    therapeuticArea: "Cardiology",
    version: "1.0.0",
    lastModified: "2026-08-19T00:00:00Z",
    forms: [
      {
        id: "form_ae",
        name: "Adverse Events",
        domain: "AE",
        description: "Adverse Events Log",
        version: "1.0",
        rules: [],
        sections: [
          {
            id: "sec_ae",
            title: "AE Event Details",
            fields: [
              {
                id: "fld_aestdat",
                variableName: "AESTDAT",
                label: "AE Start Date (Precision)",
                dataType: "precision_date",
                columnSpan: 6,
                required: true,
                allowPartial: true,
                preventFutureDate: true,
                allowNullFlavor: true,
                requirementTier: "hard_stop",
              },
            ],
          },
        ],
      },
    ],
    codelists: [],
    visits: [
      {
        id: "vis_1",
        oid: "SE.V1",
        name: "Day 1",
        visitType: "Scheduled",
        targetDay: 1,
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: ["form_ae"],
      },
    ],
  };

  it("exports precision_date fields cleanly to SAS dataset definitions", () => {
    const sasOutput = exportStudyToSas(exportStudy);
    expect(sasOutput).toContain("AESTDAT    LENGTH=$10");
    expect(sasOutput).toContain("FORMAT=$10. INFORMAT=$10.");
    expect(sasOutput).toContain("AESTDAT $;");
  });

  it("exports precision_date fields cleanly to R data frame script", () => {
    const rOutput = exportStudyToR(exportStudy);
    expect(rOutput).toContain("AESTDAT");
    expect(rOutput).toContain("as.Date");
    expect(rOutput).toContain("AE");
  });

  it("serializes precision_date to ODM-XML with partialDate ItemDef", () => {
    const odmXml = serializeStudyToOdmXml(exportStudy);
    expect(odmXml).toContain('DataType="partialDate"');
    expect(odmXml).toContain('OID="IT.AESTDAT"');
  });

  it("maps precision_date to FHIR Questionnaire Item with type date", () => {
    const fhirBundle = exportStudyToFhirQuestionnaire(exportStudy);
    expect((fhirBundle as Record<string, unknown>).resourceType).toBe("Bundle");
    const jsonStr = JSON.stringify(fhirBundle);
    expect(jsonStr).toContain('"type":"date"');
    expect(jsonStr).toContain('"linkId":"AESTDAT"');
  });

  it("renders precision_date mock in HTML aCRF generation", () => {
    const acrfHtml = generateAcrfHtml(exportStudy.forms[0], exportStudy);
    expect(acrfHtml).toContain("[ YYYY - MM - DD ]");
    expect(acrfHtml).toContain("[ND] [NA] [UNK]");
  });
});
