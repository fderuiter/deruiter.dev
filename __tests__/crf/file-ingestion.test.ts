import { describe, it, expect } from "vitest";
import { detectAndParseStudyFile } from "@/lib/crf/file-ingestion";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { exportStudyToUsdm } from "@/lib/crf/usdm-adapter";
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
});
