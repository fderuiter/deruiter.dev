// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  scaffoldCdashDomain,
  CDASH_STANDARD_VARIABLES,
  STANDARD_CODELISTS,
} from "@/lib/crf/cdisc-cdash-library";

describe("CDASH Expanded Domain Library (13 Standard Domains)", () => {
  const domains = [
    "DM",
    "VS",
    "AE",
    "CM",
    "LB",
    "RECIST",
    "DI",
    "DU",
    "DE",
    "DA",
    "EX",
    "MH",
    "DS",
  ] as const;

  it.each(domains)(
    "scaffolds domain '%s' with valid sections and fields",
    (domainCode) => {
      const form = scaffoldCdashDomain(domainCode);
      expect(form.id).toBeDefined();
      expect(form.name).toBeTruthy();
      expect(form.sections.length).toBeGreaterThan(0);

      const fields = form.sections.flatMap((s) => s.fields);
      expect(fields.length).toBeGreaterThan(0);

      fields.forEach((f) => {
        expect(f.id).toBeDefined();
        expect(f.variableName).toBeTruthy();
        expect(f.variableName.length).toBeLessThanOrEqual(8);
        expect(f.label).toBeTruthy();
      });

      // Verify domain catalog in CDASH_STANDARD_VARIABLES
      if (domainCode !== "RECIST") {
        expect(CDASH_STANDARD_VARIABLES[domainCode]).toBeDefined();
        expect(CDASH_STANDARD_VARIABLES[domainCode].length).toBeGreaterThan(0);
      }
    }
  );

  it("provides standard Drug Accountability (DA) variables & compliance formula", () => {
    const form = scaffoldCdashDomain("DA");
    expect(form.domain).toBe("DA");
    const fields = form.sections.flatMap((s) => s.fields);
    const varNames = fields.map((f) => f.variableName);

    expect(varNames).toContain("DATEST");
    expect(varNames).toContain("DASPNO");
    expect(varNames).toContain("DARETNO");
    expect(varNames).toContain("DAUSEDN");
    expect(varNames).toContain("DACOMPL");
    expect(varNames).toContain("DARECON");

    expect(form.rules.length).toBeGreaterThan(0);
    const complRule = form.rules.find((r) => r.targetFieldId === "f_da_compl");
    expect(complRule).toBeDefined();
  });

  it("provides standard Treatment Exposure (EX) variables with dosing and route", () => {
    const form = scaffoldCdashDomain("EX");
    expect(form.domain).toBe("EX");
    const fields = form.sections.flatMap((s) => s.fields);
    const varNames = fields.map((f) => f.variableName);

    expect(varNames).toContain("EXTRT");
    expect(varNames).toContain("EXDOSE");
    expect(varNames).toContain("EXDOSU");
    expect(varNames).toContain("EXROUTE");
    expect(varNames).toContain("EXSTDTC");
  });

  it("provides standard Medical History (MH) variables", () => {
    const form = scaffoldCdashDomain("MH");
    expect(form.domain).toBe("MH");
    expect(form.isLogForm).toBe(true);
    const fields = form.sections.flatMap((s) => s.fields);
    const varNames = fields.map((f) => f.variableName);

    expect(varNames).toContain("MHTERM");
    expect(varNames).toContain("MHCAT");
    expect(varNames).toContain("MHSTDTC");
    expect(varNames).toContain("MHONGO");
  });

  it("provides standard Subject Disposition (DS) variables", () => {
    const form = scaffoldCdashDomain("DS");
    expect(form.domain).toBe("DS");
    const fields = form.sections.flatMap((s) => s.fields);
    const varNames = fields.map((f) => f.variableName);

    expect(varNames).toContain("DSCAT");
    expect(varNames).toContain("DSDECOD");
    expect(varNames).toContain("DSSTDTC");
  });

  it("includes NCI standard codelists for new domains", () => {
    const codelistIds = STANDARD_CODELISTS.map((c) => c.id);
    expect(codelistIds).toContain("CL_DEDEF");
    expect(codelistIds).toContain("CL_DEREL");
    expect(codelistIds).toContain("CL_DEACT");
    expect(codelistIds).toContain("CL_DISTAT");
    expect(codelistIds).toContain("CL_DUPROC");
    expect(codelistIds).toContain("CL_DSCONT");
    expect(codelistIds).toContain("CL_DARECON");
    expect(codelistIds).toContain("CL_DOSU");
    expect(codelistIds).toContain("CL_MHCAT");
  });
});
