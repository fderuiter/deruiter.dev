// @vitest-environment node
import { describe, it, expect } from "vitest";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";
import { scanText } from "@/lib/security-scan";
import fs from "fs";
import path from "path";

describe("InBody QR Data Decoder & Analyzer Case Study Integration", () => {
  it("includes inbody-qr-decoder in static FALLBACK_CASE_STUDIES array", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "inbody-qr-decoder"
    );
    expect(study).toBeDefined();
    expect(study?.title).toContain("InBody QR Decoder");
    expect(study?.primary_language).toBe("Python");
    expect(study?.published).toBe(true);
  });

  it("contains complete tags and metadata for inbody-qr-decoder", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "inbody-qr-decoder"
    );
    expect(study).toBeDefined();
    const tags = study?.tags.split(",").map((t) => t.trim());
    expect(tags).toContain("Python");
    expect(tags).toContain("Reverse Engineering");
    expect(tags).toContain("Biomedical Data");
    expect(tags).toContain("Monorepo Architecture");
    expect(tags).toContain("Data Parsing");
    expect(tags).toContain("QR Decoder");
  });

  it("contains essential architectural narratives and code snippets", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "inbody-qr-decoder"
    );
    expect(study).toBeDefined();
    expect(study?.architectural_narrative).toContain("decode_digits");
    expect(study?.architectural_narrative).toContain(
      "Differential Mutation Oracle"
    );
    expect(study?.architectural_narrative).toContain("meas_blob");
    expect(study?.architectural_narrative).toContain("Skeletal Muscle Index");
  });

  it("passes security and credential regex scanner without violations", () => {
    const study = FALLBACK_CASE_STUDIES.find(
      (s) => s.slug === "inbody-qr-decoder"
    );
    expect(study).toBeDefined();

    const editorialMatches = scanText(study!.editorial_content);
    const narrativeMatches = scanText(study!.architectural_narrative);

    expect(editorialMatches).toEqual([]);
    expect(narrativeMatches).toEqual([]);
  });

  it("verifies docs/CASE_STUDY.md file exists and contains all required blueprint sections", () => {
    const filePath = path.resolve(process.cwd(), "docs/CASE_STUDY.md");
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("InBody QR Data Decoder & Analyzer");
    expect(content).toContain("Executive Summary & Value Proposition");
    expect(content).toContain("Differential Mutation Oracle");
    expect(content).toContain("mapping.py::_test_slice");
    expect(content).toContain("data.py::decode_digits");
    expect(content).toContain("flowchart TD");
    expect(content).toContain("reverse-engineering");
  });
});
