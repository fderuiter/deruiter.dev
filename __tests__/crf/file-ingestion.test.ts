import { describe, it, expect } from "vitest";
import {
  detectAndParseStudyFile,
  exportFormToFhirQuestionnaire,
  exportStudyToCdiscOdmXml,
  exportStudyToFhirQuestionnaire,
  exportStudyToUsdm,
} from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

describe("CRF Studio - File Ingestion & Format Signature Detection", () => {
  it("detects and parses CDISC ODM-XML files", () => {
    const xml = exportStudyToCdiscOdmXml(ONCOLOGY_RECIST_PRESET);
    const result = detectAndParseStudyFile(xml, "study.xml", xml.length);

    expect(result.format).toBe("xml_odm");
    expect(result.formatLabel).toBe("CDISC ODM-XML v1.3.2/v2.0");
    expect(result.study.protocolNumber).toBe(
      ONCOLOGY_RECIST_PRESET.protocolNumber
    );
  });

  it("detects and parses USDM JSON graph files", () => {
    const usdmJson = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);
    const result = detectAndParseStudyFile(
      usdmJson,
      "study.usdm.json",
      usdmJson.length
    );

    expect(result.format).toBe("json_usdm");
    expect(result.formatLabel).toBe("CDISC USDM JSON Graph");
    expect(result.study.protocolNumber).toBe(
      ONCOLOGY_RECIST_PRESET.protocolNumber
    );
  });

  it("detects and parses CSV study specification sheets", () => {
    const csv = `Domain,Form,Variable,Label,Type,Core\nDM,Demographics,AGE,Age,integer,R`;
    const result = detectAndParseStudyFile(csv, "study-spec.csv", csv.length);

    expect(result.format).toBe("csv_spec");
    expect(result.formatLabel).toBe("CSV Study Specification");
    expect(result.study.forms.length).toBe(1);
  });

  it("detects and parses REDCap CSV data dictionary files with appropriate label", () => {
    const redcapCsv = `"Variable / Field Name","Form Name","Section Header","Field Type","Field Label","Choices, Calculations, OR Slider Labels","Field Note","Text Validation Type OR Show Slider Number","Text Validation Min","Text Validation Max","Identifier?","Branching Logic (Show field only if...)","Required?","Custom Alignment","Question Number (surveys only)","Matrix Group Name","Matrix Ranking?","Field Annotation"
"record_id","demographics","Subject Info","text","Record ID",,,,,,,,"y",,,,
"gender","demographics",,"radio","Gender","1, Male | 2, Female",,,,,,,,"y",,,,`;
    const result = detectAndParseStudyFile(
      redcapCsv,
      "redcap_dictionary.csv",
      redcapCsv.length
    );

    expect(result.format).toBe("csv_redcap");
    expect(result.formatLabel).toBe("REDCap CSV Data Dictionary");
    expect(result.study.forms.length).toBe(1);
    expect(result.study.forms[0].name).toBe("Demographics");
  });

  it("enforces maximum 50MB file size constraint", () => {
    const oversizeBytes = 51 * 1024 * 1024;
    expect(() =>
      detectAndParseStudyFile("{}", "big.json", oversizeBytes)
    ).toThrow("exceeds maximum supported limit of 50MB");
  });

  it("throws actionable errors for corrupt JSON or unsupported file content", () => {
    expect(() =>
      detectAndParseStudyFile("{ invalid json ", "corrupt.json", 100)
    ).toThrow("JSON Protocol Parsing Error");

    expect(() =>
      detectAndParseStudyFile(
        "random noise content without signatures",
        "unknown.bin",
        50
      )
    ).toThrow("Unsupported file format");
  });

  it("detects and parses single HL7 FHIR R4 Questionnaire JSON files", () => {
    const dmForm = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "DM")!;
    const fhirJson = JSON.stringify(
      exportFormToFhirQuestionnaire(dmForm, ONCOLOGY_RECIST_PRESET)
    );
    const result = detectAndParseStudyFile(
      fhirJson,
      "fhir-questionnaire-dm.json",
      fhirJson.length
    );

    expect(result.format).toBe("json_fhir");
    expect(result.formatLabel).toBe("HL7 FHIR R4 Questionnaire");
    expect(result.study.protocolNumber).toBe(
      ONCOLOGY_RECIST_PRESET.protocolNumber
    );
    expect(result.study.forms).toHaveLength(1);
    expect(result.study.forms[0].domain).toBe("DM");
  });

  it("detects and parses HL7 FHIR R4 Bundle collection files", () => {
    const bundleJson = JSON.stringify(
      exportStudyToFhirQuestionnaire(ONCOLOGY_RECIST_PRESET)
    );
    const result = detectAndParseStudyFile(
      bundleJson,
      "fhir-bundle.json",
      bundleJson.length
    );

    expect(result.format).toBe("json_fhir");
    expect(result.formatLabel).toBe("HL7 FHIR R4 Questionnaire");
    expect(result.study.forms).toHaveLength(
      ONCOLOGY_RECIST_PRESET.forms.length
    );
    expect(result.study.visits[0].assignedFormIds).toHaveLength(
      ONCOLOGY_RECIST_PRESET.forms.length
    );
  });

  it("rejects unsupported FHIR resourceType payloads and empty FHIR Bundles with a clear FHIR parsing error", () => {
    expect(() =>
      detectAndParseStudyFile(
        JSON.stringify({ resourceType: "Patient", id: "pat-001" }),
        "patient.json"
      )
    ).toThrow(/HL7 FHIR R4 Parsing Error.*Patient/);

    expect(() =>
      detectAndParseStudyFile(
        JSON.stringify({
          resourceType: "Bundle",
          type: "collection",
          entry: [],
        }),
        "empty-bundle.json"
      )
    ).toThrow(/HL7 FHIR R4 Parsing Error.*no Questionnaire resources/i);
  });
});
