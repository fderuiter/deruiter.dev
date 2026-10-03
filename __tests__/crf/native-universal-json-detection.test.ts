import { describe, it, expect } from "vitest";
import {
  detectAndParseStudyFile,
  exportStudyToUsdm,
  exportUniversalCrfJson,
} from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";

// Reproduction for #1785: the studio's own Universal CRF JSON export carries a
// top-level `$schema`, which detection treated as proof of a USDM graph.
describe("detectAndParseStudyFile native Universal CRF JSON (#1785)", () => {
  it("labels the studio's own JSON export as Universal CRF JSON", () => {
    const json = exportUniversalCrfJson(ONCOLOGY_RECIST_PRESET);
    const result = detectAndParseStudyFile(json, "study.json", json.length);

    expect(result.format).toBe("json_universal");
    expect(result.formatLabel).toBe("Universal CRF JSON");
    expect(result.study.protocolNumber).toBe(
      ONCOLOGY_RECIST_PRESET.protocolNumber
    );
  });

  it("recognises a native export served from another host", () => {
    const payload = JSON.parse(exportUniversalCrfJson(ONCOLOGY_RECIST_PRESET));
    payload.$schema =
      "http://localhost:3000/schemas/crf/v1/universal-crf.schema.json";
    const json = JSON.stringify(payload);

    expect(detectAndParseStudyFile(json, "study.json").format).toBe(
      "json_universal"
    );
  });

  it("still labels USDM graphs as USDM", () => {
    const usdm = exportStudyToUsdm(ONCOLOGY_RECIST_PRESET);
    const result = detectAndParseStudyFile(usdm, "study.json", usdm.length);

    expect(result.format).toBe("json_usdm");
    expect(result.formatLabel).toBe("CDISC USDM JSON Graph");
  });

  it("still treats an unknown $schema as USDM", () => {
    const usdm = JSON.parse(exportStudyToUsdm(ONCOLOGY_RECIST_PRESET));
    usdm.$schema = "https://example.org/other.schema.json";
    const result = detectAndParseStudyFile(JSON.stringify(usdm), "x.json");

    expect(result.format).toBe("json_usdm");
  });
});
