// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  executeInfoCommand,
  executeValidateCommand,
  executeAddFormCommand,
  executeRemoveFormCommand,
  executeAddFieldCommand,
  executeRemoveFieldCommand,
  executeVisitCommand,
  executeRuleCommand,
  executeListCommand,
  executePresetCommand,
  executeExportCommand,
  executeDiffCommand,
  executeCliString,
  stripAnsi,
} from "@/lib/crf/cli-engine";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import { StudyProtocol } from "@/lib/crf/types";

describe("CRF CLI & Headless Command Engine", () => {
  const sampleStudy = getOncologyPresetSync();

  it("generates document-driven study summary with narrative headings and CTAs", () => {
    const res = executeInfoCommand(sampleStudy);
    expect(res.success).toBe(true);

    const plain = stripAnsi(res.document);
    expect(plain).toContain(`# STUDY PROTOCOL — ${sampleStudy.protocolNumber}`);
    expect(plain).toContain("### Clinical Forms");
    expect(plain).toContain("### Schedule of Activities (SoA)");
    expect(plain).toContain("### Next Actions");
    expect(plain).toContain("##### Metadata");
  });

  it("returns machine-readable JSON when --json flag is provided", () => {
    const res = executeInfoCommand(sampleStudy, { json: true });
    expect(res.success).toBe(true);
    const parsed = JSON.parse(res.document);
    expect(parsed.protocolNumber).toBe(sampleStudy.protocolNumber);
    expect(parsed.formsCount).toBe(sampleStudy.forms.length);
  });

  it("audits CDASH 2.2 conformance and flags variable length violations", () => {
    const invalidStudy: StudyProtocol = JSON.parse(JSON.stringify(sampleStudy));
    invalidStudy.forms[0].sections[0].fields.push({
      id: "f_too_long",
      variableName: "LONGVARIABLENAME", // > 8 chars
      label: "Invalid length variable",
      dataType: "text",
      columnSpan: 6,
      required: false,
    });

    const res = executeValidateCommand(invalidStudy);
    expect(res.success).toBe(false);
    const plain = stripAnsi(res.document);
    expect(plain).toContain("LONGVARIABLENAME");
    expect(plain).toContain("exceeds CDISC 8-character limit");
  });

  it("scaffolds CDASH domain forms and respects --dry-run", () => {
    const res = executeAddFormCommand(
      sampleStudy,
      "PE",
      "Physical Examination",
      { dryRun: true }
    );
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.updatedStudy?.forms.length).toBe(sampleStudy.forms.length); // Dry run: study unchanged

    const realRes = executeAddFormCommand(
      sampleStudy,
      "PE",
      "Physical Examination"
    );
    expect(realRes.updatedStudy?.forms.length).toBe(
      sampleStudy.forms.length + 1
    );
  });

  it("removes form and updates study", () => {
    const res = executeRemoveFormCommand(sampleStudy, "VS");
    expect(res.success).toBe(true);
    expect(res.updatedStudy?.forms.some((f) => f.domain === "VS")).toBe(false);
  });

  it("adds fields with clinical units and validations", () => {
    const res = executeAddFieldCommand(sampleStudy, "VS", {
      variableName: "TEMPC",
      label: "Body Temperature",
      dataType: "number",
      unit: "C",
      required: true,
    });

    expect(res.success).toBe(true);
    const plain = stripAnsi(res.document);
    expect(plain).toContain("# ADD FIELD — TEMPC");
    expect(res.updatedStudy).toBeDefined();

    const vsForm = res.updatedStudy?.forms.find((f) => f.domain === "VS");
    const tempField = vsForm?.sections
      .flatMap((s) => s.fields)
      .find((f) => f.variableName === "TEMPC");
    expect(tempField).toBeDefined();
    expect(tempField?.unit).toBe("C");
    expect(tempField?.required).toBe(true);
  });

  it("removes fields from form", () => {
    const res = executeRemoveFieldCommand(sampleStudy, "VS", "SYSBP");
    expect(res.success).toBe(true);
    const vsForm = res.updatedStudy?.forms.find((f) => f.domain === "VS");
    expect(
      vsForm?.sections
        .flatMap((s) => s.fields)
        .some((f) => f.variableName === "SYSBP")
    ).toBe(false);
  });

  it("manages visits through executeVisitCommand", () => {
    const addRes = executeVisitCommand(sampleStudy, "add", [
      "Cycle 4 Day 1",
      "--day",
      "84",
      "--win",
      "3",
    ]);
    expect(addRes.success).toBe(true);
    expect(
      addRes.updatedStudy?.visits.some((v) => v.name === "Cycle 4 Day 1")
    ).toBe(true);

    const assignRes = executeVisitCommand(addRes.updatedStudy!, "assign", [
      "Cycle 4 Day 1",
      "DM",
      "VS",
    ]);
    expect(assignRes.success).toBe(true);

    const rmRes = executeVisitCommand(assignRes.updatedStudy!, "rm", [
      "Cycle 4 Day 1",
    ]);
    expect(rmRes.success).toBe(true);
    expect(
      rmRes.updatedStudy?.visits.some((v) => v.name === "Cycle 4 Day 1")
    ).toBe(false);
  });

  it("manages rules through executeRuleCommand", () => {
    const addRuleRes = executeRuleCommand(sampleStudy, "add", [
      "VS",
      "--expr",
      "round(WEIGHT/2, 1)",
      "--msg",
      "Weight check",
      "--target",
      "WEIGHT",
    ]);
    expect(addRuleRes.success).toBe(true);

    const listRes = executeRuleCommand(addRuleRes.updatedStudy!, "list", [
      "VS",
    ]);
    expect(listRes.success).toBe(true);
    expect(stripAnsi(listRes.document)).toContain("Weight check");
  });

  it("lists catalogs for domains and presets", () => {
    const domainsRes = executeListCommand(sampleStudy, "domains");
    expect(domainsRes.success).toBe(true);
    expect(stripAnsi(domainsRes.document)).toContain("SUPPORTED CDASH");

    const presetsRes = executeListCommand(sampleStudy, "presets");
    expect(presetsRes.success).toBe(true);
    expect(stripAnsi(presetsRes.document)).toContain(
      "CLINICAL TRIAL PROTOCOL PRESETS"
    );
  });

  it("loads presets through executePresetCommand", () => {
    const loadRes = executePresetCommand(
      sampleStudy,
      "load",
      "device_cardiovascular_implant"
    );
    expect(loadRes.success).toBe(true);
    expect(loadRes.updatedStudy?.forms.some((f) => f.domain === "DI")).toBe(
      true
    );
    expect(loadRes.uiAction?.type).toBe("load_preset");
  });

  it("exports to multiple regulatory formats (ODM-XML, FHIR, SAS, R, JSON, YAML)", () => {
    const formats: Array<"json" | "yaml" | "odm" | "fhir" | "sas" | "r"> = [
      "json",
      "yaml",
      "odm",
      "fhir",
      "sas",
      "r",
    ];
    for (const fmt of formats) {
      const res = executeExportCommand(sampleStudy, fmt);
      expect(res.success).toBe(true);
      expect(res.document.length).toBeGreaterThan(10);
    }
  });

  it("runs diff between two protocols", () => {
    const modifiedStudy: StudyProtocol = JSON.parse(
      JSON.stringify(sampleStudy)
    );
    modifiedStudy.forms = modifiedStudy.forms.filter((f) => f.domain !== "VS");

    const res = executeDiffCommand(sampleStudy, modifiedStudy);
    expect(res.success).toBe(true);
    expect(stripAnsi(res.document)).toContain("Removed Forms");
  });

  it("dispatches raw CLI string input correctly across all command verbs", () => {
    // 1. Help
    const helpRes = executeCliString(sampleStudy, "help");
    expect(helpRes.success).toBe(true);
    expect(stripAnsi(helpRes.document)).toContain("CRF STUDIO CLI COMMANDS");

    // 2. Info
    const infoRes = executeCliString(sampleStudy, "crf info");
    expect(infoRes.success).toBe(true);
    expect(stripAnsi(infoRes.document)).toContain("STUDY PROTOCOL");

    // 3. Wizard
    const wizRes = executeCliString(sampleStudy, "crf wizard");
    expect(wizRes.success).toBe(true);
    expect(wizRes.uiAction?.type).toBe("launch_wizard");

    // 4. List
    const listRes = executeCliString(sampleStudy, "crf list domains");
    expect(listRes.success).toBe(true);

    // 5. Add Field
    const addRes = executeCliString(
      sampleStudy,
      "crf add field VS --var TEMPC --type number --unit C"
    );
    expect(addRes.success).toBe(true);
    expect(stripAnsi(addRes.document)).toContain("ADD FIELD — TEMPC");

    // 6. UI Mode switch
    const modeRes = executeCliString(sampleStudy, "mode matrix");
    expect(modeRes.success).toBe(true);
    expect(modeRes.uiAction?.payload).toBe("matrix");

    // 7. UI Open modal
    const openRes = executeCliString(sampleStudy, "open wizard");
    expect(openRes.success).toBe(true);
    expect(openRes.uiAction?.payload).toBe("wizard");
  });
});
