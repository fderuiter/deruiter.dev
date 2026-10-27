// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
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
  StudyProtocolEngine,
} from "@/lib/crf";
import { getOncologyPresetSync } from "@/lib/crf/presets";
import type { StudyProtocol, StudyVisit } from "@/lib/crf/types";

function blankStudy(): StudyProtocol {
  return StudyProtocolEngine.createInitialStudy({
    protocolNumber: "BR-001",
    studyName: "Branch Coverage Study",
  });
}

/** A study whose single VS form is assigned to the Screening visit. */
function assignedVsStudy(): StudyProtocol {
  const { study } = StudyProtocolEngine.addForm(blankStudy(), "VS");
  const vs = study.forms[0];
  return {
    ...study,
    visits: study.visits.map((v) =>
      v.id === "v_screening" ? { ...v, assignedFormIds: [vs.id] } : v
    ),
  };
}

describe("cli-engine — info command edge paths", () => {
  it("guides the user when a study has no forms and no visits", () => {
    const study: StudyProtocol = { ...blankStudy(), visits: [] };
    const res = executeInfoCommand(study);
    const plain = stripAnsi(res.document);
    expect(res.success).toBe(true);
    expect(plain).toContain("(No forms defined in study.");
    expect(plain).toContain("(No visits scheduled.");
    expect(plain).toContain(
      "✔ All 0 forms pass the implemented CDASHIG 2.2 subset"
    );
  });

  it("omits the visit window suffix when both windows are zero", () => {
    const res = executeInfoCommand(blankStudy());
    const plain = stripAnsi(res.document);
    expect(plain).toMatch(/Day {3}0 {2}Screening {15}/);
    expect(plain).toContain("Day 1 Baseline (±1d)");
  });

  it("reports a compliant protocol that only carries warnings", () => {
    // An unassigned form produces a SOA-ORPHAN warning but no errors.
    const { study } = StudyProtocolEngine.addForm(blankStudy(), "VS");
    const val = StudyProtocolEngine.validateProtocol(study);
    expect(val.isCompliant).toBe(true);
    expect(val.warnings.length).toBeGreaterThan(0);

    const plain = stripAnsi(executeInfoCommand(study).document);
    expect(plain).toContain(
      `ℹ ${val.warnings.length} warnings flagged, no errors.`
    );
  });

  it("reports errors for a non-compliant protocol", () => {
    const base = assignedVsStudy();
    const added = StudyProtocolEngine.addField(base, "VS", {
      variableName: "TOOLONGVARIABLE",
      dataType: "text",
    });
    const plain = stripAnsi(executeInfoCommand(added.study).document);
    expect(plain).toMatch(/✖ \d+ errors, \d+ warnings found\./);
  });

  it("falls back to N/A when lastModified is missing", () => {
    const study: StudyProtocol = { ...blankStudy(), lastModified: "" };
    const plain = stripAnsi(executeInfoCommand(study).document);
    expect(plain).toContain("Last Modified: N/A");
  });
});

describe("cli-engine — validate command edge paths", () => {
  it("prints a clean conformance banner when there are no issues", () => {
    const res = executeValidateCommand(assignedVsStudy());
    const plain = stripAnsi(res.document);
    expect(res.success).toBe(true);
    expect(plain).toContain("✔ No findings from the implemented checks");
    expect(plain).toContain("All 1 forms, 2 visits");
  });

  it("tags warnings without a field qualifier", () => {
    // VS is not a log form, so leaving it unassigned raises SOA-ORPHAN.
    const { study } = StudyProtocolEngine.addForm(blankStudy(), "VS");
    const res = executeValidateCommand(study);
    const plain = stripAnsi(res.document);
    expect(res.success).toBe(true);
    expect(plain).toContain("[WARN]  VS: Form");
  });

  it("returns JSON with success mirroring compliance", () => {
    const bad: StudyProtocol = {
      ...blankStudy(),
      visits: [
        {
          ...blankStudy().visits[0],
          assignedFormIds: ["form_missing"],
        },
      ],
    };
    const res = executeValidateCommand(bad, { json: true });
    expect(res.success).toBe(false);
    const parsed = JSON.parse(res.document) as { isCompliant: boolean };
    expect(parsed.isCompliant).toBe(false);
  });
});

describe("cli-engine — form and field commands", () => {
  it("add form in JSON dry-run returns the new form but keeps the study", () => {
    const study = blankStudy();
    const res = executeAddFormCommand(study, "DM", undefined, {
      json: true,
      dryRun: true,
    });
    expect(res.updatedStudy).toBe(study);
    expect(JSON.parse(res.document).domain).toBe("DM");
  });

  it("add form in JSON mode applies the change when not a dry run", () => {
    const study = blankStudy();
    const res = executeAddFormCommand(study, "DM", "Demo", { json: true });
    expect(res.updatedStudy?.forms).toHaveLength(1);
    expect(res.updatedStudy?.forms[0].name).toBe("Demo");
  });

  it("remove form fails for an unknown domain", () => {
    const res = executeRemoveFormCommand(blankStudy(), "ZZ");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Form 'ZZ' not found.");
    expect(res.updatedStudy).toBeUndefined();
  });

  it("remove form JSON output names the removed form id and domain", () => {
    const study = assignedVsStudy();
    const res = executeRemoveFormCommand(study, "VS", { json: true });
    const parsed = JSON.parse(res.document);
    expect(parsed).toEqual({
      removedFormId: study.forms[0].id,
      domain: "VS",
    });
    expect(res.updatedStudy?.forms).toHaveLength(0);
  });

  it("remove form JSON dry-run leaves the study untouched", () => {
    const study = assignedVsStudy();
    const res = executeRemoveFormCommand(study, "VS", {
      json: true,
      dryRun: true,
    });
    expect(res.updatedStudy).toBe(study);
  });

  it("remove form text dry-run announces dry-run mode", () => {
    const study = assignedVsStudy();
    const res = executeRemoveFormCommand(study, "VS", { dryRun: true });
    expect(stripAnsi(res.document)).toContain(
      "*Dry-run mode: study not modified.*"
    );
    expect(res.updatedStudy).toBe(study);
  });

  it("add field fails with the engine error for an unknown form", () => {
    const res = executeAddFieldCommand(blankStudy(), "ZZ", {
      variableName: "X",
      dataType: "text",
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Form 'ZZ' not found in protocol.");
    expect(stripAnsi(res.document)).toContain(
      "Error: Form 'ZZ' not found in protocol."
    );
  });

  it("add field JSON mode honours dry-run and real runs", () => {
    const study = assignedVsStudy();
    const field = {
      variableName: "NEWVAR",
      dataType: "text" as const,
      label: "New Var",
    };
    const dry = executeAddFieldCommand(study, "VS", field, {
      json: true,
      dryRun: true,
    });
    expect(dry.updatedStudy).toBe(study);
    expect(JSON.parse(dry.document).variableName).toBe("NEWVAR");

    const real = executeAddFieldCommand(study, "VS", field, { json: true });
    expect(real.updatedStudy).not.toBe(study);
    expect(
      StudyProtocolEngine.getField(real.updatedStudy!, "VS", "NEWVAR")
    ).toBeDefined();
  });

  it("add field text output omits unit/required lines when absent", () => {
    const res = executeAddFieldCommand(assignedVsStudy(), "VS", {
      variableName: "PLAIN",
      dataType: "text",
      required: false,
    });
    const plain = stripAnsi(res.document);
    expect(plain).not.toContain("• Unit:");
    expect(plain).not.toContain("• Required:");
    expect(plain).toContain("✔ Successfully added to form VS.");
  });

  it("add field text dry-run announces dry-run mode", () => {
    const study = assignedVsStudy();
    const res = executeAddFieldCommand(
      study,
      "VS",
      { variableName: "DRY", dataType: "text" },
      { dryRun: true }
    );
    expect(stripAnsi(res.document)).toContain("*Dry-run mode");
    expect(res.updatedStudy).toBe(study);
  });

  it("remove field fails for an unknown variable", () => {
    const res = executeRemoveFieldCommand(assignedVsStudy(), "VS", "NOPE");
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
    expect(stripAnsi(res.document)).toContain(`Error: ${res.error}`);
  });

  it("remove field falls back to a generic message without engine error", () => {
    const res = executeRemoveFieldCommand(assignedVsStudy(), "ZZ", "NOPE");
    expect(res.success).toBe(false);
    expect(stripAnsi(res.document)).toMatch(/^Error: /);
  });

  it("remove field JSON output and dry-run variants", () => {
    const study = assignedVsStudy();
    const variable = study.forms[0].sections[0].fields[0];

    const json = executeRemoveFieldCommand(study, "VS", variable.variableName, {
      json: true,
    });
    expect(JSON.parse(json.document)).toEqual({
      removedFieldId: variable.id,
      variableName: variable.variableName,
    });
    expect(json.updatedStudy).not.toBe(study);

    const jsonDry = executeRemoveFieldCommand(
      study,
      "VS",
      variable.variableName,
      { json: true, dryRun: true }
    );
    expect(jsonDry.updatedStudy).toBe(study);

    const textDry = executeRemoveFieldCommand(
      study,
      "VS",
      variable.variableName,
      { dryRun: true }
    );
    expect(stripAnsi(textDry.document)).toContain("*Dry-run mode");
    expect(textDry.updatedStudy).toBe(study);
  });
});

describe("cli-engine — visit command", () => {
  it("defaults the visit name, day and window when arguments are missing", () => {
    const res = executeVisitCommand(blankStudy(), "add", []);
    const visit = res.data as StudyVisit;
    expect(visit.name).toBe("New Study Visit");
    expect(visit.targetDay).toBe(0);
    expect(visit.windowBefore).toBe(0);
    expect(stripAnsi(res.document)).toContain("(Day 0 ±0d)");
  });

  it("treats non-numeric --day and --win values as zero", () => {
    const res = executeVisitCommand(blankStudy(), "add", [
      "Week2",
      "--day",
      "abc",
      "--win",
      "xyz",
    ]);
    const visit = res.data as StudyVisit;
    expect(visit.targetDay).toBe(0);
    expect(visit.windowAfter).toBe(0);
  });

  it("treats a trailing --day/--win flag without value as zero", () => {
    const res = executeVisitCommand(blankStudy(), "add", ["Week3", "--day"]);
    expect((res.data as StudyVisit).targetDay).toBe(0);
    const res2 = executeVisitCommand(blankStudy(), "add", ["Week3", "--win"]);
    expect((res2.data as StudyVisit).windowBefore).toBe(0);
  });

  it("add visit JSON mode supports dry-run", () => {
    const study = blankStudy();
    const res = executeVisitCommand(
      study,
      "add",
      ["Week4", "--day", "28", "--win", "3"],
      { json: true, dryRun: true }
    );
    expect(res.updatedStudy).toBe(study);
    const parsed = JSON.parse(res.document) as StudyVisit;
    expect(parsed.targetDay).toBe(28);
    expect(parsed.windowBefore).toBe(3);

    const real = executeVisitCommand(study, "add", ["Week4"], { json: true });
    expect(real.updatedStudy?.visits).toHaveLength(3);
  });

  it("add visit text dry-run keeps the original study", () => {
    const study = blankStudy();
    const res = executeVisitCommand(study, "add", ["Week5"], { dryRun: true });
    expect(res.updatedStudy).toBe(study);
  });

  it("rm requires a target and reports missing visits", () => {
    const missingArg = executeVisitCommand(blankStudy(), "rm", []);
    expect(missingArg.success).toBe(false);
    expect(missingArg.error).toBe("Missing visit argument.");

    const notFound = executeVisitCommand(blankStudy(), "rm", ["Nope"]);
    expect(notFound.success).toBe(false);
    expect(notFound.error).toBe("Visit not found.");
  });

  it("rm in dry-run mode returns the original study", () => {
    const study = blankStudy();
    const res = executeVisitCommand(study, "rm", ["Screening"], {
      dryRun: true,
    });
    expect(res.success).toBe(true);
    expect(res.updatedStudy).toBe(study);
  });

  it("assign validates its arguments and the target visit", () => {
    const noForms = executeVisitCommand(blankStudy(), "assign", ["Screening"]);
    expect(noForms.success).toBe(false);
    expect(noForms.error).toBe("Missing arguments.");

    const noVisit = executeVisitCommand(blankStudy(), "assign", []);
    expect(noVisit.error).toBe("Missing arguments.");

    const badVisit = executeVisitCommand(blankStudy(), "assign", [
      "Nope",
      "VS",
    ]);
    expect(badVisit.success).toBe(false);
    expect(badVisit.error).toBe("Visit 'Nope' not found in protocol.");
  });

  it("assign in dry-run mode returns the original study", () => {
    const { study } = StudyProtocolEngine.addForm(blankStudy(), "VS");
    const res = executeVisitCommand(study, "assign", ["Screening", "VS"], {
      dryRun: true,
    });
    expect(res.success).toBe(true);
    expect(res.updatedStudy).toBe(study);
    expect((res.data as StudyVisit).assignedFormIds).toContain(
      study.forms[0].id
    );
  });

  it("rejects unknown visit actions", () => {
    const res = executeVisitCommand(blankStudy(), fromAny("bogus"), []);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid action 'bogus'");
  });
});

describe("cli-engine — rule command", () => {
  it("lists rules filtered by domain (case-insensitive) as JSON", () => {
    const base = assignedVsStudy();
    const withRule = StudyProtocolEngine.addRule(base, "VS", {
      name: "SBP check",
      targetFieldIdOrVar: "SYSBP",
      actionType: "raise_query",
    }).study;

    const res = executeRuleCommand(withRule, "list", ["vs"], { json: true });
    const rules = JSON.parse(res.document) as Array<{
      form: string;
      name: string;
    }>;
    expect(rules).toHaveLength(withRule.forms[0].rules.length);
    expect(rules.every((r) => r.form === "VS")).toBe(true);
    expect(rules.map((r) => r.name)).toContain("SBP check");

    const none = executeRuleCommand(withRule, "list", ["AE"], { json: true });
    expect(JSON.parse(none.document)).toEqual([]);
  });

  it("explains how to add rules when none exist", () => {
    const res = executeRuleCommand(blankStudy(), "list", []);
    expect(stripAnsi(res.document)).toContain("(No rules configured.");
  });

  it("omits formula and message lines for bare rules", () => {
    // An unknown domain scaffolds an empty custom form with no template rules.
    const base = StudyProtocolEngine.addForm(blankStudy(), "ZZ").study;
    const withRule = StudyProtocolEngine.addRule(base, "ZZ", {
      name: "Bare",
      targetFieldIdOrVar: "ZZVAR",
      actionType: "hide_field",
    }).study;
    const plain = stripAnsi(executeRuleCommand(withRule, "list", []).document);
    expect(plain).toContain("[ZZ] Bare (hide_field):");
    expect(plain).not.toContain("• Formula:");
    expect(plain).not.toContain("• Message:");
  });

  it("add uses defaults for form, target, action and name", () => {
    const study = assignedVsStudy();
    const res = executeRuleCommand(study, "add", []);
    expect(res.success).toBe(true);
    const rule = res.data as {
      name: string;
      actionType: string;
      formulaExpression?: string;
    };
    expect(rule.name).toBe("Rule for SYSBP");
    expect(rule.actionType).toBe("raise_query");
    expect(rule.formulaExpression).toBeUndefined();
  });

  it("add ignores flags supplied without values", () => {
    const res = executeRuleCommand(assignedVsStudy(), "add", [
      "VS",
      "--target",
      "--expr",
    ]);
    const rule = res.data as { formulaExpression?: string };
    expect(res.success).toBe(true);
    // "--expr" is consumed as the --target value; --expr itself has no value.
    expect(rule.formulaExpression).toBeUndefined();
  });

  it("add honours an explicit --action and dry-run", () => {
    const study = assignedVsStudy();
    const res = executeRuleCommand(
      study,
      "add",
      ["VS", "--action", "hide_field", "--msg", "Hidden"],
      { dryRun: true }
    );
    const rule = res.data as { actionType: string; name: string };
    expect(rule.actionType).toBe("hide_field");
    expect(rule.name).toBe("Hidden");
    expect(res.updatedStudy).toBe(study);
  });

  it("add fails for an unknown form", () => {
    const res = executeRuleCommand(blankStudy(), "add", ["ZZ"]);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Form 'ZZ' not found.");
  });

  it("rejects unknown rule actions", () => {
    const res = executeRuleCommand(blankStudy(), fromAny("drop"), []);
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid action");
  });
});

describe("cli-engine — list and preset commands", () => {
  it("returns domains and presets as JSON", () => {
    const domains = executeListCommand(blankStudy(), "domains", {
      json: true,
    });
    expect(Array.isArray(JSON.parse(domains.document))).toBe(true);

    const presets = executeListCommand(blankStudy(), "presets", {
      json: true,
    });
    const parsed = JSON.parse(presets.document) as Array<{ id: string }>;
    expect(parsed.length).toBeGreaterThan(0);
  });

  it("routes forms and visits categories to the info document", () => {
    const study = assignedVsStudy();
    for (const category of ["forms", "visits"] as const) {
      const res = executeListCommand(study, category);
      expect(stripAnsi(res.document)).toContain("# STUDY PROTOCOL — BR-001");
    }
  });

  it("rejects unknown list categories", () => {
    const res = executeListCommand(blankStudy(), fromAny("arms"));
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid category");
  });

  it("preset list is the default when the action is empty", () => {
    const res = executePresetCommand(blankStudy(), fromAny(""));
    expect(stripAnsi(res.document)).toContain(
      "# CLINICAL TRIAL PROTOCOL PRESETS"
    );
  });

  it("preset load requires an id and honours dry-run", () => {
    const missing = executePresetCommand(blankStudy(), "load");
    expect(missing.success).toBe(false);
    expect(missing.error).toBe("Missing presetId");

    const study = blankStudy();
    const dry = executePresetCommand(study, "load", "oncology_recist", {
      dryRun: true,
    });
    expect(dry.success).toBe(true);
    expect(dry.updatedStudy).toBe(study);
    expect(dry.uiAction).toEqual({
      type: "load_preset",
      payload: "oncology_recist",
    });
  });

  it("rejects unknown preset actions", () => {
    const res = executePresetCommand(blankStudy(), fromAny("save"));
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid action");
  });
});

describe("cli-engine — export and diff", () => {
  it("surfaces export failures for unsupported formats", () => {
    const res = executeExportCommand(blankStudy(), fromAny("pdf"));
    expect(res.success).toBe(false);
    expect(res.error).toBe("Unsupported format 'pdf'");
    expect(stripAnsi(res.document)).toBe(
      "Export failed: Unsupported format 'pdf'"
    );
  });

  it("reports sizeBytes for the usdm format", () => {
    const res = executeExportCommand(getOncologyPresetSync(), "usdm");
    expect(res.success).toBe(true);
    expect((res.data as { sizeBytes: number }).sizeBytes).toBe(
      res.document.length
    );
  });

  it("renders a no-change diff and a JSON diff", () => {
    const study = assignedVsStudy();
    const same = executeDiffCommand(study, study);
    expect(stripAnsi(same.document)).toContain(
      "✔ No structural changes between protocols."
    );

    const json = executeDiffCommand(study, study, { json: true });
    expect(JSON.parse(json.document).hasChanges).toBe(false);
  });

  it("renders removed forms and modified fields", () => {
    const a = assignedVsStudy();
    const withAe = StudyProtocolEngine.addForm(a, "AE").study;
    const modified = StudyProtocolEngine.addField(a, "VS", {
      variableName: "EXTRA",
      dataType: "text",
    }).study;

    const removed = stripAnsi(executeDiffCommand(withAe, a).document);
    expect(removed).toContain("### Removed Forms");
    expect(removed).not.toContain("### Added Forms");

    const added = stripAnsi(executeDiffCommand(a, withAe).document);
    expect(added).toContain("### Added Forms");
    expect(added).not.toContain("### Removed Forms");

    const mod = stripAnsi(executeDiffCommand(a, modified).document);
    expect(mod).toContain("### Modified Forms");
    expect(mod).toContain("+ field:");
  });
});

describe("cli-engine — executeCliString dispatcher", () => {
  const study = assignedVsStudy();

  it("treats empty input and 'crf help' as help", () => {
    for (const input of ["", "   ", "help", "crf help"]) {
      const res = executeCliString(study, input);
      expect(stripAnsi(res.document)).toContain("# CRF STUDIO CLI COMMANDS");
    }
  });

  it("dispatches lint as validate and works without the crf prefix", () => {
    const res = executeCliString(study, "lint");
    expect(stripAnsi(res.document)).toContain("# VALIDATION REPORT");
  });

  it("defaults list to domains and preset to list", () => {
    expect(stripAnsi(executeCliString(study, "crf list").document)).toContain(
      "# SUPPORTED CDASH & MEDICAL DEVICE DOMAINS"
    );
    expect(stripAnsi(executeCliString(study, "crf preset").document)).toContain(
      "# CLINICAL TRIAL PROTOCOL PRESETS"
    );
  });

  it("add form defaults to CUSTOM and joins multi-word --name values", () => {
    const res = executeCliString(study, "crf add form");
    expect((res.data as { domain: string }).domain).toBe("CUSTOM");

    const named = executeCliString(
      study,
      "crf add form CM --name Concomitant Meds Log"
    );
    expect((named.data as { name: string }).name).toBe("Concomitant Meds Log");

    const danglingName = executeCliString(study, "crf add form CM --name");
    expect((danglingName.data as { name: string }).name).not.toBe("--name");
  });

  it("add field falls back to the first form, TESTVAR and text type", () => {
    const res = executeCliString(study, "crf add field");
    expect(res.success).toBe(true);
    const field = res.data as {
      variableName: string;
      dataType: string;
      required?: boolean;
    };
    expect(field.variableName).toBe("TESTVAR");
    expect(field.dataType).toBe("text");
    expect(field.required).toBe(false);
  });

  it("add field falls back to DM when the study has no forms", () => {
    const res = executeCliString(blankStudy(), "crf add field");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Form 'DM' not found in protocol.");
  });

  it("add field parses --label and --required flags", () => {
    const res = executeCliString(
      study,
      "crf add field VS --var LEGLEN --type number --unit cm --label Leg --required"
    );
    const field = res.data as {
      label: string;
      unit?: string;
      required?: boolean;
    };
    expect(field.label).toBe("Leg");
    expect(field.unit).toBe("cm");
    expect(field.required).toBe(true);
    expect(stripAnsi(res.document)).toContain("• Required: Mandatory");
  });

  it("add field ignores dangling value flags", () => {
    const res = executeCliString(study, "crf add field VS --var");
    expect((res.data as { variableName: string }).variableName).toBe("TESTVAR");
    const typed = executeCliString(study, "crf add field VS --unit --type");
    expect((typed.data as { dataType: string }).dataType).toBe("text");
    const label = executeCliString(study, "crf add field VS --label");
    expect(res.success && label.success).toBe(true);
  });

  it("an unknown add sub-command falls through to unknown command", () => {
    const res = executeCliString(study, "crf add widget");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Unknown command: crf add widget");
  });

  it("rm form/field validate their arguments", () => {
    expect(executeCliString(study, "crf rm form").error).toBe("Missing domain");
    expect(executeCliString(study, "crf rm field").error).toBe(
      "Missing arguments"
    );
    expect(executeCliString(study, "crf rm field VS").error).toBe(
      "Missing arguments"
    );
  });

  it("remove is an alias for rm and dispatches form and field removal", () => {
    const formRes = executeCliString(study, "crf remove form VS");
    expect(formRes.success).toBe(true);
    expect(formRes.updatedStudy?.forms).toHaveLength(0);

    const variable = study.forms[0].sections[0].fields[0].variableName;
    const fieldRes = executeCliString(study, `crf rm field VS ${variable}`);
    expect(fieldRes.success).toBe(true);
  });

  it("an unknown rm sub-command falls through to unknown command", () => {
    const res = executeCliString(study, "crf rm visit");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Unknown command: crf rm visit");
  });

  it("dispatches visit sub-commands with their remaining arguments", () => {
    const res = executeCliString(study, "crf visit add Week9 --day 63");
    expect(res.success).toBe(true);
    expect((res.data as StudyVisit).targetDay).toBe(63);

    const bare = executeCliString(study, "crf visit");
    expect(bare.success).toBe(false);
    expect(bare.error).toBe("Invalid action 'undefined'");
  });

  it("rule defaults to list", () => {
    const res = executeCliString(study, "crf rule");
    expect(stripAnsi(res.document)).toContain("# AST EDIT CHECKS & FORMULAS");
  });

  it("export defaults to json and ignores a dangling --format", () => {
    const res = executeCliString(study, "crf export");
    expect((res.data as { format: string }).format).toBe("json");
    const dangling = executeCliString(study, "crf export --format");
    expect((dangling.data as { format: string }).format).toBe("json");
  });

  it("diff points the user at the file-based CLI", () => {
    const res = executeCliString(study, "crf diff");
    expect(res.success).toBe(true);
    expect(stripAnsi(res.document)).toContain("crf diff <studyA.json>");
  });

  it("mode and open reject unknown targets", () => {
    const mode = executeCliString(study, "mode cinema");
    expect(mode.success).toBe(false);
    expect(mode.error).toBe("Invalid mode");
    expect(mode.uiAction).toBeUndefined();

    const open = executeCliString(study, "crf open settings");
    expect(open.success).toBe(false);
    expect(open.error).toBe("Invalid target");

    const ok = executeCliString(study, "open branding");
    expect(ok.uiAction).toEqual({ type: "open_modal", payload: "branding" });
  });

  it("rejects unknown commands with the raw input echoed", () => {
    const res = executeCliString(study, "frobnicate now");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Unknown command: frobnicate now");
  });
});
