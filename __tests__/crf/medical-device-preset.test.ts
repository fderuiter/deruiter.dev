// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  DEVICE_CARDIOVASCULAR_IMPLANT_PRESET,
  STUDY_PRESETS,
} from "@/lib/crf/presets";
import { validateStudyCompliance } from "@/lib/crf/cdisc-conformance-linter";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { generateStudyPdf } from "@/lib/crf/export-pdf";
import { generateStudyDocx } from "@/lib/crf/export-docx";

describe("Medical Device IDE Clinical Study Preset (ISO 14155 / FDA 21 CFR 812)", () => {
  it("registers in STUDY_PRESETS catalog correctly", () => {
    const catalogItem = STUDY_PRESETS.find(
      (p) => p.id === "device_cardiovascular_implant"
    );
    expect(catalogItem).toBeDefined();
    expect(catalogItem?.therapeuticArea).toContain("Medical Device");
    expect(catalogItem?.study.protocolNumber).toBe("DEV-2026-VALVE");
  });

  it("contains all core device study forms (DI, DU, DE, DM, VS, CM, AE)", () => {
    const forms = DEVICE_CARDIOVASCULAR_IMPLANT_PRESET.forms;
    const domainCodes = forms.map((f) => f.domain);

    expect(domainCodes).toContain("DI"); // Device Identifier
    expect(domainCodes).toContain("DU"); // Device In-Use
    expect(domainCodes).toContain("DE"); // Device Events / Deficiencies
    expect(domainCodes).toContain("DM"); // Demographics
    expect(domainCodes).toContain("VS"); // Hemodynamics / Vitals
    expect(domainCodes).toContain("CM"); // ConMeds
    expect(domainCodes).toContain("AE"); // Adverse Events
  });

  it("includes Device Identifier (DI) fields with UDI, lot, model, and expiration", () => {
    const diForm = DEVICE_CARDIOVASCULAR_IMPLANT_PRESET.forms.find(
      (f) => f.domain === "DI"
    );
    expect(diForm).toBeDefined();
    const fields = diForm!.sections.flatMap((s) => s.fields);
    const varNames = fields.map((f) => f.variableName);

    expect(varNames).toContain("DITERM");
    expect(varNames).toContain("DIBRN");
    expect(varNames).toContain("DIMODN");
    expect(varNames).toContain("DILOTN");
    expect(varNames).toContain("DIUDI");
    expect(varNames).toContain("DIEXPDTC");
    expect(varNames).toContain("DISTAT");
  });

  it("passes CDISC conformance linting without fatal variable errors", () => {
    const violations = validateStudyCompliance(
      DEVICE_CARDIOVASCULAR_IMPLANT_PRESET
    );
    const fatalErrors = violations.filter((v) => v.severity === "error");
    expect(fatalErrors).toHaveLength(0);
  });

  it("exports valid CDISC ODM-XML with Device Event and Device In-Use ItemDefs and CodeLists", () => {
    const xml = exportStudyToCdiscOdmXml(DEVICE_CARDIOVASCULAR_IMPLANT_PRESET);
    expect(xml).toContain("<ProtocolName>DEV-2026-VALVE</ProtocolName>");
    expect(xml).toContain('ItemDef OID="IT.DIUDI"');
    expect(xml).toContain('ItemDef OID="IT.DEDEFIC"');
    expect(xml).toContain('CodeList OID="CL_DEDEF"');
    expect(xml).toContain('CodeList OID="CL_DUPROC"');
    expect(xml).toContain('CodeList OID="CL_DISTAT"');
  });

  it("exports blank PDF and Word documents without exceptions", async () => {
    const pdfBlob = await generateStudyPdf(
      DEVICE_CARDIOVASCULAR_IMPLANT_PRESET,
      {
        mode: "blank",
        scope: "all",
      }
    );
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.size).toBeGreaterThan(0);

    const docxBlob = await generateStudyDocx(
      DEVICE_CARDIOVASCULAR_IMPLANT_PRESET,
      {
        mode: "blank",
        scope: "all",
        includeTableOfContents: true,
      }
    );
    expect(docxBlob).toBeInstanceOf(Blob);
    expect(docxBlob.size).toBeGreaterThan(0);
  });
});
