// @vitest-environment node
import { describe, it, expect } from "vitest";
import { StudyProtocolEngine } from "@/lib/crf/study-engine";
import { getOncologyPresetSync } from "@/lib/crf/presets";

describe("StudyProtocolEngine - Pure Business Logic Engine", () => {
  const sampleStudy = getOncologyPresetSync();

  it("creates initial study with compliant default visits", () => {
    const study = StudyProtocolEngine.createInitialStudy({
      protocolNumber: "TEST-2026-001",
      studyName: "Test Oncology Protocol",
      phase: "Phase II",
      sponsor: "Acme Bio",
    });

    expect(study.protocolNumber).toBe("TEST-2026-001");
    expect(study.visits.length).toBe(2);
    expect(study.visits[0].name).toBe("Screening");
    expect(study.forms).toEqual([]);
  });

  it("adds standard CDASH domains and custom domains", () => {
    const base = StudyProtocolEngine.createInitialStudy();
    const { study: s1, form: vsForm } = StudyProtocolEngine.addForm(base, "VS");

    expect(s1.forms.length).toBe(1);
    expect(vsForm.domain).toBe("VS");
    expect(vsForm.sections.flatMap((s) => s.fields).length).toBeGreaterThan(3);

    const { study: s2, form: customForm } = StudyProtocolEngine.addForm(
      s1,
      "CUSTOM_TEST",
      "Custom Lab Assessment"
    );
    expect(s2.forms.length).toBe(2);
    expect(customForm.domain).toBe("CUSTOM_TEST");
    expect(customForm.name).toBe("Custom Lab Assessment");
  });

  it("removes form and automatically prunes visit form assignments", () => {
    const { study: s1, form: vsForm } = StudyProtocolEngine.addForm(
      sampleStudy,
      "VS"
    );
    const { study: s2 } = StudyProtocolEngine.assignVisitForms(
      s1,
      s1.visits[0].id,
      [vsForm.id]
    );
    expect(s2.visits[0].assignedFormIds).toContain(vsForm.id);

    const { study: s3, removedForm } = StudyProtocolEngine.removeForm(
      s2,
      vsForm.id
    );
    expect(removedForm?.id).toBe(vsForm.id);
    expect(s3.forms.some((f) => f.id === vsForm.id)).toBe(false);
    expect(s3.visits[0].assignedFormIds).not.toContain(vsForm.id);
  });

  it("adds fields with CDASH metadata enrichment and duplicate detection", () => {
    const { study: s1 } = StudyProtocolEngine.addForm(sampleStudy, "VS");
    const {
      study: s2,
      field,
      error,
    } = StudyProtocolEngine.addField(s1, "VS", {
      variableName: "TEMPC",
      label: "Body Temperature (Celsius)",
      dataType: "number",
      unit: "C",
      required: true,
    });

    expect(error).toBeUndefined();
    expect(field?.variableName).toBe("TEMPC");
    expect(field?.unit).toBe("C");

    // Duplicate check
    const dupRes = StudyProtocolEngine.addField(s2, "VS", {
      variableName: "TEMPC",
      dataType: "number",
    });
    expect(dupRes.error).toContain("already exists");
  });

  it("removes field and automatically prunes AST rules referencing it", () => {
    const base = StudyProtocolEngine.createInitialStudy();
    const { study: s1 } = StudyProtocolEngine.addForm(base, "VS");
    const { study: s2, field } = StudyProtocolEngine.addField(s1, "VS", {
      variableName: "OXSAT",
      dataType: "integer",
    });

    expect(field).toBeDefined();

    const { study: s3, rule } = StudyProtocolEngine.addRule(s2, "VS", {
      name: "Oxygen Saturation Check",
      targetFieldIdOrVar: field!.id,
      actionType: "raise_query",
      queryMessage: "O2 sat out of range",
      triggerFieldIdsOrVars: [field!.id],
    });

    const formWithRule = s3.forms.find((f) => f.domain === "VS");
    expect(formWithRule?.rules.some((r) => r.id === rule?.id)).toBe(true);

    const { study: s4, removedField } = StudyProtocolEngine.removeField(
      s3,
      "VS",
      field!.id
    );
    expect(removedField?.id).toBe(field!.id);
    const formAfterRemoval = s4.forms.find((f) => f.domain === "VS");
    expect(formAfterRemoval?.rules.some((r) => r.id === rule?.id)).toBe(false);
  });

  it("manages Schedule of Activities visits cleanly", () => {
    const base = StudyProtocolEngine.createInitialStudy();
    const { study: s1, visit: v1 } = StudyProtocolEngine.addVisit(base, {
      name: "Cycle 2 Day 1",
      targetDay: 56,
      windowBefore: 3,
      windowAfter: 3,
    });

    expect(s1.visits.some((v) => v.id === v1.id)).toBe(true);
    expect(s1.visits[s1.visits.length - 1].targetDay).toBe(56);

    const { study: s2, removedVisit } = StudyProtocolEngine.removeVisit(
      s1,
      v1.id
    );
    expect(removedVisit?.id).toBe(v1.id);
    expect(s2.visits.some((v) => v.id === v1.id)).toBe(false);
  });

  it("lists and loads study presets", () => {
    const presets = StudyProtocolEngine.listPresets();
    expect(presets.length).toBeGreaterThan(2);
    expect(presets.some((p) => p.id === "device_cardiovascular_implant")).toBe(
      true
    );

    const { study, presetInfo } = StudyProtocolEngine.loadPreset(
      "device_cardiovascular_implant"
    );
    expect(presetInfo.id).toBe("device_cardiovascular_implant");
    expect(study.forms.some((f) => f.domain === "DI")).toBe(true);
  });

  it("lists all 13 standard CDASH and medical device domains", () => {
    const domains = StudyProtocolEngine.listDomains();
    expect(domains.length).toBe(13);
    const codes = domains.map((d) => d.code);
    expect(codes).toContain("DM");
    expect(codes).toContain("VS");
    expect(codes).toContain("AE");
    expect(codes).toContain("DI");
    expect(codes).toContain("RECIST");
  });

  it("validates protocol compliance and captures 4 tiers of diagnostics", () => {
    const validRes = StudyProtocolEngine.validateProtocol(sampleStudy);
    expect(validRes.errors.length).toBe(0);

    const invalidStudy = JSON.parse(JSON.stringify(sampleStudy));
    invalidStudy.forms[0].sections[0].fields.push({
      id: "f_err",
      variableName: "WAYTOOLONGVARNAME", // > 8 chars
      label: "Invalid",
      dataType: "text",
      columnSpan: 6,
      required: false,
    });

    const invalidRes = StudyProtocolEngine.validateProtocol(invalidStudy);
    expect(invalidRes.isCompliant).toBe(false);
    expect(invalidRes.errors.some((e) => e.rule === "CDASH-VAR-LEN")).toBe(
      true
    );
  });

  it("exports to all 6 clinical metadata standards", () => {
    const formats: Array<"json" | "yaml" | "odm" | "fhir" | "sas" | "r"> = [
      "json",
      "yaml",
      "odm",
      "fhir",
      "sas",
      "r",
    ];

    for (const fmt of formats) {
      const res = StudyProtocolEngine.exportProtocol(sampleStudy, fmt);
      expect(res.success).toBe(true);
      expect(res.output.length).toBeGreaterThan(20);
    }
  });
});
