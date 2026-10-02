// @vitest-environment node
import { describe, it, expect } from "vitest";
import { generateStudyDocx } from "@/lib/crf/export-docx";
import { generateStudyPdf } from "@/lib/crf/export-pdf";
import { STUDY_PRESETS } from "@/lib/crf/presets";
import { StudyProtocol, CRFForm, StudyBranding } from "@/lib/crf/types";
import { scaffoldCdashDomain } from "@/lib/crf/cdisc-cdash-library";

describe("CRF Studio - Exhaustive Clinical Stress & Edge-Case Test Suite", () => {
  // Test all catalog presets in both Word and PDF
  describe("Preset Catalog Stress Matrix (Word & PDF)", () => {
    STUDY_PRESETS.forEach((preset) => {
      it(`should export preset "${preset.name}" to Word (.docx) in blank and annotated modes`, async () => {
        const blankDocx = await generateStudyDocx(preset.study, {
          mode: "blank",
          scope: "all",
          includeTableOfContents: true,
          includeSdtmAppendix: true,
        });
        expect(blankDocx).toBeInstanceOf(Blob);
        expect(blankDocx.size).toBeGreaterThan(500);

        const aCrfDocx = await generateStudyDocx(preset.study, {
          mode: "annotated",
          scope: "all",
          includeTableOfContents: true,
          includeSdtmAppendix: true,
        });
        expect(aCrfDocx).toBeInstanceOf(Blob);
        expect(aCrfDocx.size).toBeGreaterThan(500);
      });

      it(`should export preset "${preset.name}" to PDF (.pdf) in blank and annotated modes`, async () => {
        const blankPdf = await generateStudyPdf(preset.study, {
          mode: "blank",
          scope: "all",
          includeTableOfContents: true,
          includeSdtmAppendix: true,
        });
        expect(blankPdf).toBeInstanceOf(Blob);
        expect(blankPdf.size).toBeGreaterThan(500);

        const aCrfPdf = await generateStudyPdf(preset.study, {
          mode: "annotated",
          scope: "all",
          includeTableOfContents: true,
          includeSdtmAppendix: true,
        });
        expect(aCrfPdf).toBeInstanceOf(Blob);
        expect(aCrfPdf.size).toBeGreaterThan(500);
      });
    });
  });

  // Test fault tolerance against corrupted or malformed logo data
  describe("Corrupted Logo & Image Resilience", () => {
    it("should handle invalid / corrupt base64 logo strings gracefully in Word (.docx) export", async () => {
      const corruptBranding: StudyBranding = {
        organizationName: "Fault Tolerance Test Lab",
        primaryColor: "#0284c7",
        accentColor: "#0ea5e9",
        logoBase64:
          "data:image/png;base64,CORRUPTED_GARBAGE_NOT_A_PNG_HEADER_!@#$%",
      };

      const preset = STUDY_PRESETS[0];
      const docx = await generateStudyDocx(preset.study, {
        mode: "annotated",
        scope: "all",
        branding: corruptBranding,
      });

      expect(docx).toBeInstanceOf(Blob);
      expect(docx.size).toBeGreaterThan(1000);
    });

    it("should handle invalid / corrupt base64 logo strings gracefully in PDF export", async () => {
      const corruptBranding: StudyBranding = {
        organizationName: "Fault Tolerance Test Lab",
        primaryColor: "#0284c7",
        accentColor: "#0ea5e9",
        logoBase64:
          "data:image/png;base64,CORRUPTED_GARBAGE_NOT_A_PNG_HEADER_!@#$%",
      };

      const preset = STUDY_PRESETS[0];
      const pdf = await generateStudyPdf(preset.study, {
        mode: "annotated",
        scope: "all",
        branding: corruptBranding,
      });

      expect(pdf).toBeInstanceOf(Blob);
      expect(pdf.size).toBeGreaterThan(1000);
    });
  });

  // Test repeating log tables and multi-column clinical forms
  describe("Repeating Log Tables & Complex Calculations", () => {
    it("should render repeating log matrices (AE and ConMeds) with custom columns", async () => {
      const aeForm = scaffoldCdashDomain("AE");
      const cmForm = scaffoldCdashDomain("CM");

      const logStudy: StudyProtocol = {
        id: "study_repeating_log",
        protocolNumber: "LOG-2026-99",
        studyName: "Safety and Concomitant Medication Log Protocol",
        phase: "Phase II",
        sponsor: "Safety Monitoring Corp",
        therapeuticArea: "Safety",
        version: "1.0",
        lastModified: "2026-08-15",
        visits: [],
        codelists: [],
        forms: [aeForm, cmForm],
      };

      const docx = await generateStudyDocx(logStudy, {
        mode: "annotated",
        scope: "all",
        includeSdtmAppendix: true,
      });
      expect(docx.size).toBeGreaterThan(1000);

      const pdf = await generateStudyPdf(logStudy, {
        mode: "annotated",
        scope: "all",
        includeSdtmAppendix: true,
      });
      expect(pdf.size).toBeGreaterThan(1000);
    });
  });

  // Extreme scale benchmark: 25 forms with hundreds of variables
  describe("Extreme Scale & Performance Benchmark", () => {
    it("should generate a 25-form protocol with 200+ variables in Word and PDF rapidly", async () => {
      const syntheticForms: CRFForm[] = [];
      const domains: Array<"DM" | "VS" | "AE" | "CM" | "LB" | "RECIST"> = [
        "DM",
        "VS",
        "AE",
        "CM",
        "LB",
        "RECIST",
      ];

      for (let i = 0; i < 25; i++) {
        const baseDomain = domains[i % domains.length];
        const base = scaffoldCdashDomain(baseDomain);
        syntheticForms.push({
          ...base,
          id: `synth_form_${i}`,
          name: `Synthetic Form ${i + 1} (${baseDomain})`,
        });
      }

      const largeStudy: StudyProtocol = {
        id: "study_scale_bench",
        protocolNumber: "SCALE-2026-MAX",
        studyName:
          "Large Scale Multi-Center Registry Protocol (25 Observation Forms)",
        phase: "Phase III",
        sponsor: "MegaPharma International",
        therapeuticArea: "Multi-Disciplinary",
        version: "4.0",
        lastModified: "2026-08-15",
        visits: [],
        codelists: [],
        forms: syntheticForms,
      };

      const startTime = performance.now();
      const largeDocx = await generateStudyDocx(largeStudy, {
        mode: "annotated",
        scope: "all",
        includeTableOfContents: true,
        includeSdtmAppendix: true,
      });
      const docxDuration = performance.now() - startTime;

      expect(largeDocx).toBeInstanceOf(Blob);
      expect(largeDocx.size).toBeGreaterThan(5000);
      expect(docxDuration).toBeLessThan(3000); // Must complete in under 3 seconds

      const pdfStartTime = performance.now();
      const largePdf = await generateStudyPdf(largeStudy, {
        mode: "annotated",
        scope: "all",
        includeTableOfContents: true,
        includeSdtmAppendix: true,
      });
      const pdfDuration = performance.now() - pdfStartTime;

      expect(largePdf).toBeInstanceOf(Blob);
      expect(largePdf.size).toBeGreaterThan(5000);
      expect(pdfDuration).toBeLessThan(3000); // Must complete in under 3 seconds
    });
  });
});
