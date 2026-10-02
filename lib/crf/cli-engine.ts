/**
 * CRF Studio CLI & Headless Command Engine
 * Implements Document-Driven CLI Output and Agent-DX Specification
 * Pure, decoupled command executor for both Node CLI and In-Studio Web Terminal
 */

import {
  StudyProtocol,
  CRFField,
  ClinicalDataType,
  EditCheckRule,
} from "./types";
import { StudyProtocolEngine, CDASH_DOMAIN_CATALOG } from "./study-engine";

export interface CliExecutionOptions {
  json?: boolean;
  dryRun?: boolean;
  color?: boolean;
}

export interface CliCommandResult {
  success: boolean;
  document: string;
  data?: unknown;
  updatedStudy?: StudyProtocol;
  error?: string;
  uiAction?: {
    type: "switch_mode" | "open_modal" | "load_preset" | "launch_wizard";
    payload?: string;
  };
}

// ANSI Color Formatter Helpers
export const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  brightCyan: "\x1b[96m",
  green: "\x1b[32m",
  brightGreen: "\x1b[92m",
  amber: "\x1b[33m",
  brightYellow: "\x1b[93m",
  red: "\x1b[31m",
  brightRed: "\x1b[91m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
};

/**
 * Strips ANSI codes for non-color output or test assertions
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Summary Info Document
 */
export function executeInfoCommand(
  study: StudyProtocol,
  options: CliExecutionOptions = {}
): CliCommandResult {
  const totalFields = study.forms.reduce(
    (acc, f) => acc + f.sections.reduce((sAcc, s) => sAcc + s.fields.length, 0),
    0
  );
  const totalRules = study.forms.reduce((acc, f) => acc + f.rules.length, 0);
  const valResult = StudyProtocolEngine.validateProtocol(study);

  if (options.json) {
    return {
      success: true,
      document: JSON.stringify(
        {
          protocolNumber: study.protocolNumber,
          studyName: study.studyName,
          phase: study.phase,
          sponsor: study.sponsor,
          therapeuticArea: study.therapeuticArea,
          formsCount: study.forms.length,
          fieldsCount: totalFields,
          visitsCount: study.visits.length,
          rulesCount: totalRules,
          isCompliant: valResult.isCompliant,
          diagnosticsCount: valResult.totalIssues,
        },
        null,
        2
      ),
      data: study,
    };
  }

  const lines: string[] = [];
  lines.push(
    `${ansi.bold}${ansi.underline}# STUDY PROTOCOL — ${study.protocolNumber}${ansi.reset}`
  );
  lines.push(`${ansi.dim}${study.studyName}${ansi.reset}`);
  lines.push(
    `*${study.phase} · ${study.therapeuticArea} · Sponsor: ${study.sponsor} · v${study.version}*`
  );
  lines.push("");

  lines.push(
    `${ansi.bold}${ansi.blue}### Clinical Forms · ${study.forms.length} domains${ansi.reset}`
  );
  if (study.forms.length === 0) {
    lines.push(
      `  ${ansi.dim}(No forms defined in study. Run 'crf add form <domain>' or 'crf wizard')${ansi.reset}`
    );
  } else {
    for (const form of study.forms) {
      const fldCount = form.sections.reduce(
        (acc, s) => acc + s.fields.length,
        0
      );
      const domainTag = `${ansi.cyan}[${form.domain.padEnd(6)}]${ansi.reset}`;
      const nameStr = form.name.padEnd(32);
      const metaStr = `${ansi.dim}${String(fldCount).padStart(2)} fields · ${String(form.rules.length).padStart(2)} rules${ansi.reset}`;
      lines.push(`  ${domainTag} ${nameStr}  ${metaStr}`);
    }
  }
  lines.push("");

  lines.push(
    `${ansi.bold}${ansi.blue}### Schedule of Activities (SoA) · ${study.visits.length} visits${ansi.reset}`
  );
  if (study.visits.length === 0) {
    lines.push(
      `  ${ansi.dim}(No visits scheduled. Run 'crf visit add <name> --day <d>')${ansi.reset}`
    );
  } else {
    for (const visit of study.visits) {
      const dayStr = `Day ${String(visit.targetDay).padStart(3)}`;
      const winStr =
        visit.windowBefore || visit.windowAfter
          ? ` (±${Math.max(visit.windowBefore, visit.windowAfter)}d)`
          : "";
      const nameStr = (visit.name + winStr).padEnd(24);
      const formsStr = `${ansi.dim}${visit.assignedFormIds.length} forms assigned${ansi.reset}`;
      lines.push(
        `  ${ansi.amber}${dayStr}${ansi.reset}  ${nameStr}  ${formsStr}`
      );
    }
  }
  lines.push("");

  lines.push(
    `${ansi.bold}${ansi.blue}### Conformance & Diagnostics${ansi.reset}`
  );
  if (valResult.totalIssues === 0) {
    lines.push(
      `  ${ansi.green}✔ All ${study.forms.length} forms pass CDISC CDASH 2.2 and AST logic checks cleanly.${ansi.reset}`
    );
  } else if (valResult.isCompliant) {
    lines.push(
      `  ${ansi.brightYellow}ℹ ${valResult.warnings.length} warnings flagged. Protocol is compliant. Run 'crf validate' for details.${ansi.reset}`
    );
  } else {
    lines.push(
      `  ${ansi.brightRed}✖ ${valResult.errors.length} errors, ${valResult.warnings.length} warnings found. Run 'crf validate' for remediation.${ansi.reset}`
    );
  }
  lines.push("");

  lines.push(`${ansi.bold}${ansi.blue}### Next Actions${ansi.reset}`);
  lines.push(
    `  ${ansi.green}crf wizard${ansi.reset}                         Launch interactive 5-stage authoring wizard`
  );
  lines.push(
    `  ${ansi.green}crf validate${ansi.reset}                       Verify CDISC 2.2 conformance and AST rules`
  );
  lines.push(
    `  ${ansi.green}crf list domains${ansi.reset}                   Browse standard CDASH & medical device domains`
  );
  lines.push(
    `  ${ansi.green}crf export --format odm${ansi.reset}            Compile to CDISC ODM-XML 1.3.2 metadata`
  );
  lines.push("");

  lines.push(`${ansi.dim}##### Metadata${ansi.reset}`);
  lines.push(
    `${ansi.dim}Study ID: ${study.id} · Codelists: ${study.codelists.length} · Last Modified: ${study.lastModified || "N/A"}${ansi.reset}`
  );

  return { success: true, document: lines.join("\n"), data: study };
}

/**
 * Four-Tier Conformance Validation Command
 */
export function executeValidateCommand(
  study: StudyProtocol,
  options: CliExecutionOptions = {}
): CliCommandResult {
  const result = StudyProtocolEngine.validateProtocol(study);

  if (options.json) {
    return {
      success: result.isCompliant,
      document: JSON.stringify(result, null, 2),
      data: result,
    };
  }

  const lines: string[] = [];
  lines.push(
    `${ansi.bold}${ansi.underline}# VALIDATION REPORT — ${study.protocolNumber}${ansi.reset}`
  );
  lines.push(
    `*CDISC CDASH 2.2 · AST Logic Integrity · Schedule of Activities (SoA)*\n`
  );

  if (result.issues.length === 0) {
    lines.push(
      `${ansi.bold}${ansi.brightGreen}✔ 100% CDISC & AST Conformance Verified${ansi.reset}`
    );
    lines.push(
      `All ${study.forms.length} forms, ${study.visits.length} visits, and rule graphs comply with regulatory standards.\n`
    );
  } else {
    lines.push(
      `${ansi.bold}${ansi.blue}### Diagnostics Found · ${result.issues.length} items${ansi.reset}`
    );
    for (const issue of result.issues) {
      const tag =
        issue.severity === "error"
          ? `${ansi.brightRed}[ERROR]${ansi.reset}`
          : `${ansi.brightYellow}[WARN] ${ansi.reset}`;
      const domainStr = `${ansi.cyan}${issue.form}${ansi.reset}`;
      const fieldStr = issue.field ? ` · ${issue.field}` : "";
      lines.push(`  ${tag} ${domainStr}${fieldStr}: ${issue.message}`);
    }
    lines.push("");
  }

  lines.push(`${ansi.dim}##### Metadata${ansi.reset}`);
  lines.push(
    `${ansi.dim}Audited ${study.forms.length} forms against FDA/PMDA CDASH Technical Conformance rules.${ansi.reset}`
  );

  return {
    success: result.isCompliant,
    document: lines.join("\n"),
    data: result,
  };
}

/**
 * Add Form / Inject CDASH Domain
 */
export function executeAddFormCommand(
  study: StudyProtocol,
  domain: string,
  customName?: string,
  options: CliExecutionOptions = {}
): CliCommandResult {
  const { study: updatedStudy, form: newForm } = StudyProtocolEngine.addForm(
    study,
    domain,
    customName
  );

  if (options.json) {
    return {
      success: true,
      document: JSON.stringify(newForm, null, 2),
      data: newForm,
      updatedStudy: options.dryRun ? study : updatedStudy,
    };
  }

  const lines: string[] = [];
  lines.push(
    `${ansi.bold}${ansi.underline}# ADD FORM — ${newForm.domain}${ansi.reset}`
  );
  lines.push(
    `Created form "${newForm.name}" with ${newForm.sections.flatMap((s) => s.fields).length} CDASH variables.`
  );
  if (options.dryRun) {
    lines.push(`${ansi.amber}*Dry-run mode: study not modified.*${ansi.reset}`);
  } else {
    lines.push(
      `${ansi.brightGreen}✔ Successfully added to protocol ${study.protocolNumber}.${ansi.reset}`
    );
  }

  return {
    success: true,
    document: lines.join("\n"),
    data: newForm,
    updatedStudy: options.dryRun ? study : updatedStudy,
  };
}

/**
 * Remove Form
 */
export function executeRemoveFormCommand(
  study: StudyProtocol,
  domainOrFormId: string,
  options: CliExecutionOptions = {}
): CliCommandResult {
  const { study: updatedStudy, removedForm } = StudyProtocolEngine.removeForm(
    study,
    domainOrFormId
  );

  if (!removedForm) {
    return {
      success: false,
      document: `${ansi.brightRed}Error: Form '${domainOrFormId}' not found in protocol.${ansi.reset}`,
      error: `Form '${domainOrFormId}' not found.`,
    };
  }

  if (options.json) {
    return {
      success: true,
      document: JSON.stringify(
        { removedFormId: removedForm.id, domain: removedForm.domain },
        null,
        2
      ),
      data: removedForm,
      updatedStudy: options.dryRun ? study : updatedStudy,
    };
  }

  const lines: string[] = [];
  lines.push(
    `${ansi.bold}${ansi.underline}# REMOVE FORM — ${removedForm.domain}${ansi.reset}`
  );
  lines.push(
    `Removed form "${removedForm.name}" (${removedForm.id}) and pruned Schedule of Activities assignments.`
  );
  if (options.dryRun) {
    lines.push(`${ansi.amber}*Dry-run mode: study not modified.*${ansi.reset}`);
  } else {
    lines.push(
      `${ansi.brightGreen}✔ Successfully removed form ${removedForm.domain}.${ansi.reset}`
    );
  }

  return {
    success: true,
    document: lines.join("\n"),
    data: removedForm,
    updatedStudy: options.dryRun ? study : updatedStudy,
  };
}

/**
 * Add Field to Form
 */
export function executeAddFieldCommand(
  study: StudyProtocol,
  domainOrFormId: string,
  fieldData: Partial<CRFField> & {
    variableName: string;
    dataType: ClinicalDataType;
  },
  options: CliExecutionOptions = {}
): CliCommandResult {
  const res = StudyProtocolEngine.addField(study, domainOrFormId, fieldData);

  if (!res.field || !res.form) {
    return {
      success: false,
      document: `${ansi.brightRed}Error: ${res.error || "Failed to add field."}${ansi.reset}`,
      error: res.error,
    };
  }

  if (options.json) {
    return {
      success: true,
      document: JSON.stringify(res.field, null, 2),
      data: res.field,
      updatedStudy: options.dryRun ? study : res.study,
    };
  }

  const lines: string[] = [];
  lines.push(
    `${ansi.bold}${ansi.underline}# ADD FIELD — ${res.field.variableName}${ansi.reset}`
  );
  lines.push(
    `Added variable "${res.field.label}" (${res.field.dataType}) to domain ${res.form.domain}.`
  );
  if (res.field.unit) lines.push(`  • Unit: ${res.field.unit}`);
  if (res.field.required) lines.push(`  • Required: Mandatory (Core: HR/R)`);
  if (options.dryRun) {
    lines.push(`${ansi.amber}*Dry-run mode: study not modified.*${ansi.reset}`);
  } else {
    lines.push(
      `${ansi.brightGreen}✔ Successfully added to form ${res.form.domain}.${ansi.reset}`
    );
  }

  return {
    success: true,
    document: lines.join("\n"),
    data: res.field,
    updatedStudy: options.dryRun ? study : res.study,
  };
}

/**
 * Remove Field from Form
 */
export function executeRemoveFieldCommand(
  study: StudyProtocol,
  domainOrFormId: string,
  variableNameOrId: string,
  options: CliExecutionOptions = {}
): CliCommandResult {
  const res = StudyProtocolEngine.removeField(
    study,
    domainOrFormId,
    variableNameOrId
  );

  if (!res.removedField || !res.form) {
    return {
      success: false,
      document: `${ansi.brightRed}Error: ${res.error || "Failed to remove field."}${ansi.reset}`,
      error: res.error,
    };
  }

  if (options.json) {
    return {
      success: true,
      document: JSON.stringify(
        {
          removedFieldId: res.removedField.id,
          variableName: res.removedField.variableName,
        },
        null,
        2
      ),
      data: res.removedField,
      updatedStudy: options.dryRun ? study : res.study,
    };
  }

  const lines: string[] = [];
  lines.push(
    `${ansi.bold}${ansi.underline}# REMOVE FIELD — ${res.removedField.variableName}${ansi.reset}`
  );
  lines.push(
    `Removed variable "${res.removedField.label}" from form ${res.form.domain} and pruned AST rule dependencies.`
  );
  if (options.dryRun) {
    lines.push(`${ansi.amber}*Dry-run mode: study not modified.*${ansi.reset}`);
  } else {
    lines.push(
      `${ansi.brightGreen}✔ Successfully removed field ${res.removedField.variableName}.${ansi.reset}`
    );
  }

  return {
    success: true,
    document: lines.join("\n"),
    data: res.removedField,
    updatedStudy: options.dryRun ? study : res.study,
  };
}

/**
 * Add / Remove / Assign Visits
 */
export function executeVisitCommand(
  study: StudyProtocol,
  action: "add" | "rm" | "assign",
  args: string[],
  options: CliExecutionOptions = {}
): CliCommandResult {
  if (action === "add") {
    const name = args[0] || "New Study Visit";
    const dayIdx = args.indexOf("--day");
    const targetDay =
      dayIdx !== -1 && args[dayIdx + 1]
        ? parseInt(args[dayIdx + 1], 10) || 0
        : 0;
    const winIdx = args.indexOf("--win");
    const win =
      winIdx !== -1 && args[winIdx + 1]
        ? parseInt(args[winIdx + 1], 10) || 0
        : 0;

    const { study: updatedStudy, visit } = StudyProtocolEngine.addVisit(study, {
      name,
      targetDay,
      windowBefore: win,
      windowAfter: win,
    });

    if (options.json) {
      return {
        success: true,
        document: JSON.stringify(visit, null, 2),
        data: visit,
        updatedStudy: options.dryRun ? study : updatedStudy,
      };
    }

    return {
      success: true,
      document: `${ansi.bold}${ansi.green}✔ Added visit "${visit.name}" (Day ${visit.targetDay} ±${win}d) to Schedule of Activities.${ansi.reset}`,
      data: visit,
      updatedStudy: options.dryRun ? study : updatedStudy,
    };
  }

  if (action === "rm") {
    const target = args[0];
    if (!target) {
      return {
        success: false,
        document: `${ansi.brightRed}Usage: crf visit rm <visitNameOrId>${ansi.reset}`,
        error: "Missing visit argument.",
      };
    }
    const { study: updatedStudy, removedVisit } =
      StudyProtocolEngine.removeVisit(study, target);
    if (!removedVisit) {
      return {
        success: false,
        document: `${ansi.brightRed}Error: Visit '${target}' not found.${ansi.reset}`,
        error: "Visit not found.",
      };
    }
    return {
      success: true,
      document: `${ansi.bold}${ansi.green}✔ Removed visit "${removedVisit.name}" from protocol schedule.${ansi.reset}`,
      data: removedVisit,
      updatedStudy: options.dryRun ? study : updatedStudy,
    };
  }

  if (action === "assign") {
    const visitNameOrId = args[0];
    const forms = args.slice(1);
    if (!visitNameOrId || forms.length === 0) {
      return {
        success: false,
        document: `${ansi.brightRed}Usage: crf visit assign <visit> <forms...>${ansi.reset}`,
        error: "Missing arguments.",
      };
    }
    const res = StudyProtocolEngine.assignVisitForms(
      study,
      visitNameOrId,
      forms
    );
    if (!res.visit) {
      return {
        success: false,
        document: `${ansi.brightRed}Error: ${res.error || "Failed to assign forms."}${ansi.reset}`,
        error: res.error,
      };
    }
    return {
      success: true,
      document: `${ansi.bold}${ansi.green}✔ Assigned ${forms.join(", ")} to visit "${res.visit.name}".${ansi.reset}`,
      data: res.visit,
      updatedStudy: options.dryRun ? study : res.study,
    };
  }

  return {
    success: false,
    document: `${ansi.brightRed}Unknown visit action '${action}'.${ansi.reset}`,
    error: `Invalid action '${action}'`,
  };
}

/**
 * Rule Command (Add / List)
 */
export function executeRuleCommand(
  study: StudyProtocol,
  action: "add" | "list",
  args: string[],
  options: CliExecutionOptions = {}
): CliCommandResult {
  if (action === "list") {
    const domain = args[0];
    const forms = domain
      ? study.forms.filter(
          (f) => f.domain.toUpperCase() === domain.toUpperCase()
        )
      : study.forms;
    const rulesList = forms.flatMap((f) =>
      f.rules.map((r) => ({ form: f.domain, ...r }))
    );

    if (options.json) {
      return {
        success: true,
        document: JSON.stringify(rulesList, null, 2),
        data: rulesList,
      };
    }

    const lines: string[] = [];
    lines.push(
      `${ansi.bold}${ansi.underline}# AST EDIT CHECKS & FORMULAS — ${study.protocolNumber}${ansi.reset}`
    );
    if (rulesList.length === 0) {
      lines.push(
        `  ${ansi.dim}(No rules configured. Run 'crf rule add <form> --expr <formula>')${ansi.reset}`
      );
    } else {
      for (const r of rulesList) {
        lines.push(
          `  ${ansi.cyan}[${r.form}]${ansi.reset} ${ansi.bold}${r.name}${ansi.reset} (${r.actionType}):`
        );
        if (r.formulaExpression)
          lines.push(
            `    • Formula: ${ansi.green}${r.formulaExpression}${ansi.reset}`
          );
        if (r.queryMessage)
          lines.push(`    • Message: ${r.queryMessage} [${r.querySeverity}]`);
      }
    }
    return { success: true, document: lines.join("\n"), data: rulesList };
  }

  if (action === "add") {
    const formDomain = args[0] || "VS";
    const exprIdx = args.indexOf("--expr");
    const formulaExpression =
      exprIdx !== -1 && args[exprIdx + 1] ? args[exprIdx + 1] : undefined;
    const msgIdx = args.indexOf("--msg");
    const queryMessage =
      msgIdx !== -1 && args[msgIdx + 1] ? args[msgIdx + 1] : undefined;
    const targetIdx = args.indexOf("--target");
    const targetFieldIdOrVar =
      targetIdx !== -1 && args[targetIdx + 1] ? args[targetIdx + 1] : "SYSBP";
    const actionIdx = args.indexOf("--action");
    const actionType = (
      actionIdx !== -1 && args[actionIdx + 1]
        ? args[actionIdx + 1]
        : "raise_query"
    ) as EditCheckRule["actionType"];

    const res = StudyProtocolEngine.addRule(study, formDomain, {
      name: queryMessage || `Rule for ${targetFieldIdOrVar}`,
      targetFieldIdOrVar,
      actionType,
      formulaExpression,
      queryMessage,
    });

    if (!res.rule) {
      return {
        success: false,
        document: `${ansi.brightRed}Error: ${res.error || "Failed to add rule."}${ansi.reset}`,
        error: res.error,
      };
    }

    return {
      success: true,
      document: `${ansi.bold}${ansi.green}✔ Added AST rule "${res.rule.name}" to form ${formDomain}.${ansi.reset}`,
      data: res.rule,
      updatedStudy: options.dryRun ? study : res.study,
    };
  }

  return {
    success: false,
    document: `${ansi.brightRed}Unknown rule action.${ansi.reset}`,
    error: "Invalid action",
  };
}

/**
 * List Catalogs Command (domains, presets, forms, visits)
 */
export function executeListCommand(
  study: StudyProtocol,
  category: "domains" | "presets" | "forms" | "visits",
  options: CliExecutionOptions = {}
): CliCommandResult {
  if (category === "domains") {
    const domains = CDASH_DOMAIN_CATALOG;
    if (options.json) {
      return {
        success: true,
        document: JSON.stringify(domains, null, 2),
        data: domains,
      };
    }
    const lines: string[] = [];
    lines.push(
      `${ansi.bold}${ansi.underline}# SUPPORTED CDASH & MEDICAL DEVICE DOMAINS${ansi.reset}\n`
    );
    for (const d of domains) {
      const codeStr = `${ansi.cyan}[${d.code.padEnd(6)}]${ansi.reset}`;
      const nameStr = `${ansi.bold}${d.label.padEnd(38)}${ansi.reset}`;
      const countStr = `${ansi.dim}${d.variableCount} vars · ${d.category}${ansi.reset}`;
      lines.push(`  ${codeStr} ${nameStr} ${countStr}`);
      lines.push(`    ${ansi.dim}${d.description}${ansi.reset}`);
      lines.push(
        `    ${ansi.dim}Sample Variables: ${d.sampleVariables.join(", ")}${ansi.reset}\n`
      );
    }
    return { success: true, document: lines.join("\n"), data: domains };
  }

  if (category === "presets") {
    const presets = StudyProtocolEngine.listPresets();
    if (options.json) {
      return {
        success: true,
        document: JSON.stringify(presets, null, 2),
        data: presets,
      };
    }
    const lines: string[] = [];
    lines.push(
      `${ansi.bold}${ansi.underline}# CLINICAL TRIAL PROTOCOL PRESETS${ansi.reset}\n`
    );
    for (const p of presets) {
      const idStr = `${ansi.cyan}${p.id.padEnd(30)}${ansi.reset}`;
      const nameStr = `${ansi.bold}${p.name}${ansi.reset}`;
      const metaStr = `${ansi.dim}${p.phase} · ${p.formsCount} forms · ${p.visitsCount} visits${ansi.reset}`;
      lines.push(`  ${idStr} ${nameStr}`);
      lines.push(`    ${metaStr}\n`);
    }
    lines.push(`${ansi.dim}To load: crf preset load <id>${ansi.reset}`);
    return { success: true, document: lines.join("\n"), data: presets };
  }

  if (category === "forms") {
    return executeInfoCommand(study, options);
  }

  if (category === "visits") {
    return executeInfoCommand(study, options);
  }

  return {
    success: false,
    document: `${ansi.brightRed}Unknown list category '${category}'. Valid: domains, presets, forms, visits${ansi.reset}`,
    error: "Invalid category",
  };
}

/**
 * Preset Command (list / load)
 */
export function executePresetCommand(
  study: StudyProtocol,
  action: "list" | "load",
  presetId?: string,
  options: CliExecutionOptions = {}
): CliCommandResult {
  if (action === "list" || !action) {
    return executeListCommand(study, "presets", options);
  }

  if (action === "load") {
    if (!presetId) {
      return {
        success: false,
        document: `${ansi.brightRed}Usage: crf preset load <presetId>${ansi.reset}`,
        error: "Missing presetId",
      };
    }
    const { study: loadedStudy, presetInfo } =
      StudyProtocolEngine.loadPreset(presetId);
    return {
      success: true,
      document: `${ansi.bold}${ansi.green}✔ Loaded preset "${presetInfo.name}" (${loadedStudy.protocolNumber}) with ${loadedStudy.forms.length} forms and ${loadedStudy.visits.length} visits.${ansi.reset}`,
      data: presetInfo,
      updatedStudy: options.dryRun ? study : loadedStudy,
      uiAction: { type: "load_preset", payload: presetId },
    };
  }

  return {
    success: false,
    document: `${ansi.brightRed}Unknown preset action.${ansi.reset}`,
    error: "Invalid action",
  };
}

/**
 * Multi-Format Export Command
 */
export function executeExportCommand(
  study: StudyProtocol,
  format: "json" | "yaml" | "odm" | "fhir" | "sas" | "r" | "usdm",
  _options: CliExecutionOptions = {}
): CliCommandResult {
  const res = StudyProtocolEngine.exportProtocol(study, format);
  if (!res.success) {
    return {
      success: false,
      document: `${ansi.brightRed}Export failed: ${res.error || "Unknown error"}${ansi.reset}`,
      error: res.error,
    };
  }
  return {
    success: true,
    document: res.output,
    data: { format, sizeBytes: res.sizeBytes },
  };
}

/**
 * Protocol Semantic Diff
 */
export function executeDiffCommand(
  studyA: StudyProtocol,
  studyB: StudyProtocol,
  options: CliExecutionOptions = {}
): CliCommandResult {
  const diffSummary = StudyProtocolEngine.diffProtocols(studyA, studyB);

  if (options.json) {
    return {
      success: true,
      document: JSON.stringify(diffSummary, null, 2),
      data: diffSummary,
    };
  }

  const lines: string[] = [];
  lines.push(
    `${ansi.bold}${ansi.underline}# PROTOCOL DIFF — ${studyB.protocolNumber}${ansi.reset}`
  );

  if (!diffSummary.hasChanges) {
    lines.push(
      `${ansi.green}✔ No structural changes between protocols.${ansi.reset}`
    );
  } else {
    if (diffSummary.addedForms.length > 0) {
      lines.push(`${ansi.bold}${ansi.green}### Added Forms${ansi.reset}`);
      diffSummary.addedForms.forEach((f) => lines.push(`  + ${f}`));
    }
    if (diffSummary.removedForms.length > 0) {
      lines.push(`${ansi.bold}${ansi.red}### Removed Forms${ansi.reset}`);
      diffSummary.removedForms.forEach((f) => lines.push(`  - ${f}`));
    }
    if (diffSummary.modifiedForms.length > 0) {
      lines.push(`${ansi.bold}${ansi.amber}### Modified Forms${ansi.reset}`);
      for (const mf of diffSummary.modifiedForms) {
        lines.push(`  ${ansi.cyan}${mf.domain}${ansi.reset}:`);
        mf.addedFields.forEach((fld) => lines.push(`    + field: ${fld}`));
        mf.removedFields.forEach((fld) => lines.push(`    - field: ${fld}`));
        mf.modifiedFields.forEach((fld) => lines.push(`    ~ field: ${fld}`));
      }
    }
  }

  return {
    success: true,
    document: lines.join("\n"),
    data: diffSummary,
  };
}

/**
 * Dispatcher executing raw CLI argument string or parsed args
 */
export function executeCliString(
  study: StudyProtocol,
  input: string,
  options: CliExecutionOptions = {}
): CliCommandResult {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (
    parts.length === 0 ||
    parts[0] === "help" ||
    (parts[0] === "crf" && parts[1] === "help")
  ) {
    const helpDoc = [
      `${ansi.bold}${ansi.underline}# CRF STUDIO CLI COMMANDS${ansi.reset}`,
      "",
      `  ${ansi.cyan}crf info${ansi.reset}                             Display study metadata, form summary & SoA matrix`,
      `  ${ansi.cyan}crf validate${ansi.reset}                         Audit CDISC CDASH 2.2 conformance and AST rule graphs`,
      `  ${ansi.cyan}crf wizard${ansi.reset}                           Launch interactive 5-stage guided authoring session`,
      `  ${ansi.cyan}crf list <domains|presets|forms|visits>${ansi.reset}   Inspect domain catalog, presets, or schedule`,
      `  ${ansi.cyan}crf preset <list|load <id>>${ansi.reset}            Browse or load clinical study presets`,
      `  ${ansi.cyan}crf add form <domain> [--name <s>]${ansi.reset}     Scaffold standard CDASH domain (e.g. DM, VS, AE, CM, LB)`,
      `  ${ansi.cyan}crf add field <form> --var <n> --type <t>${ansi.reset} Add clinical variable with unit and type`,
      `  ${ansi.cyan}crf rm form <domain>${ansi.reset}                   Remove domain form and prune SoA assignments`,
      `  ${ansi.cyan}crf rm field <form> <var>${ansi.reset}               Remove clinical variable and prune AST rules`,
      `  ${ansi.cyan}crf visit <add|rm|assign> <args...>${ansi.reset}     Configure Schedule of Activities (SoA) visits`,
      `  ${ansi.cyan}crf rule <add|list> [args...]${ansi.reset}           Add or list dynamic AST edit checks and formulas`,
      `  ${ansi.cyan}crf export --format <odm|json|yaml|fhir|sas|r>${ansi.reset} Export to standardized clinical formats`,
      `  ${ansi.cyan}crf diff <studyA> <studyB>${ansi.reset}           Compare semantic diff between two protocols`,
      "",
      `  ${ansi.dim}Studio UI Controls:${ansi.reset}`,
      `    ${ansi.dim}mode <designer|matrix|rules|edc|acrf|export>  Switch active workspace mode${ansi.reset}`,
      `    ${ansi.dim}open <wizard|branding|diagnostics|export>     Open corresponding studio drawer / modal${ansi.reset}`,
    ].join("\n");

    return { success: true, document: helpDoc };
  }

  const cmd = parts[0] === "crf" ? parts[1] : parts[0];
  const rest = parts[0] === "crf" ? parts.slice(2) : parts.slice(1);

  // 1. Info
  if (cmd === "info") {
    return executeInfoCommand(study, options);
  }

  // 2. Validate / Lint
  if (cmd === "validate" || cmd === "lint") {
    return executeValidateCommand(study, options);
  }

  // 3. Wizard
  if (cmd === "wizard") {
    return {
      success: true,
      document: `${ansi.bold}${ansi.brightCyan}★ CRF Studio 5-Stage Interactive Guided Authoring Wizard Launched.${ansi.reset}\n${ansi.dim}Opening interactive study configurator...${ansi.reset}`,
      uiAction: { type: "launch_wizard" },
    };
  }

  // 4. List
  if (cmd === "list") {
    const category = (rest[0] || "domains") as
      "domains" | "presets" | "forms" | "visits";
    return executeListCommand(study, category, options);
  }

  // 5. Preset
  if (cmd === "preset") {
    const sub = (rest[0] || "list") as "list" | "load";
    const presetId = rest[1];
    return executePresetCommand(study, sub, presetId, options);
  }

  // 6. Add
  if (cmd === "add") {
    const sub = rest[0];
    if (sub === "form") {
      const domain = rest[1] || "CUSTOM";
      const nameIdx = rest.indexOf("--name");
      const customName =
        nameIdx !== -1 && rest[nameIdx + 1]
          ? rest.slice(nameIdx + 1).join(" ")
          : undefined;
      return executeAddFormCommand(study, domain, customName, options);
    }
    if (sub === "field") {
      const formDomain = rest[1] || study.forms[0]?.domain || "DM";
      const varIndex = rest.indexOf("--var");
      const varName =
        varIndex !== -1 && rest[varIndex + 1] ? rest[varIndex + 1] : "TESTVAR";
      const typeIndex = rest.indexOf("--type");
      const dataType = (
        typeIndex !== -1 && rest[typeIndex + 1] ? rest[typeIndex + 1] : "text"
      ) as ClinicalDataType;
      const req = rest.includes("--required");
      const unitIdx = rest.indexOf("--unit");
      const unit =
        unitIdx !== -1 && rest[unitIdx + 1] ? rest[unitIdx + 1] : undefined;
      const labelIdx = rest.indexOf("--label");
      const label =
        labelIdx !== -1 && rest[labelIdx + 1] ? rest[labelIdx + 1] : undefined;

      return executeAddFieldCommand(
        study,
        formDomain,
        { variableName: varName, dataType, required: req, unit, label },
        options
      );
    }
  }

  // 7. Remove (rm)
  if (cmd === "rm" || cmd === "remove") {
    const sub = rest[0];
    if (sub === "form") {
      const domain = rest[1];
      if (!domain)
        return {
          success: false,
          document: `${ansi.brightRed}Usage: crf rm form <domain>${ansi.reset}`,
          error: "Missing domain",
        };
      return executeRemoveFormCommand(study, domain, options);
    }
    if (sub === "field") {
      const formDomain = rest[1];
      const varName = rest[2];
      if (!formDomain || !varName)
        return {
          success: false,
          document: `${ansi.brightRed}Usage: crf rm field <form> <var>${ansi.reset}`,
          error: "Missing arguments",
        };
      return executeRemoveFieldCommand(study, formDomain, varName, options);
    }
  }

  // 8. Visit
  if (cmd === "visit") {
    const sub = rest[0] as "add" | "rm" | "assign";
    return executeVisitCommand(study, sub, rest.slice(1), options);
  }

  // 9. Rule
  if (cmd === "rule") {
    const sub = (rest[0] || "list") as "add" | "list";
    return executeRuleCommand(study, sub, rest.slice(1), options);
  }

  // 10. Export
  if (cmd === "export") {
    const formatIdx = rest.indexOf("--format");
    const fmt = (
      formatIdx !== -1 && rest[formatIdx + 1] ? rest[formatIdx + 1] : "json"
    ) as "json" | "yaml" | "odm" | "fhir" | "sas" | "r";
    return executeExportCommand(study, fmt, options);
  }

  // 11. Diff (CLI format simulation)
  if (cmd === "diff") {
    return {
      success: true,
      document: `${ansi.dim}To run full AST protocol diff, pass protocol files: 'crf diff <studyA.json> <studyB.json>' or run in Node CLI.${ansi.reset}`,
    };
  }

  // 12. Studio UI Controls (mode, open)
  if (cmd === "mode") {
    const targetMode = rest[0];
    if (
      ["designer", "matrix", "rules", "edc", "acrf", "export"].includes(
        targetMode
      )
    ) {
      return {
        success: true,
        document: `${ansi.bold}${ansi.green}✔ Switched workspace to '${targetMode}' mode.${ansi.reset}`,
        uiAction: { type: "switch_mode", payload: targetMode },
      };
    }
    return {
      success: false,
      document: `${ansi.brightRed}Invalid mode '${targetMode}'. Available: designer, matrix, rules, edc, acrf, export${ansi.reset}`,
      error: "Invalid mode",
    };
  }

  if (cmd === "open") {
    const modalTarget = rest[0];
    if (["wizard", "branding", "diagnostics", "export"].includes(modalTarget)) {
      return {
        success: true,
        document: `${ansi.bold}${ansi.green}✔ Opening ${modalTarget} modal...${ansi.reset}`,
        uiAction: { type: "open_modal", payload: modalTarget },
      };
    }
    return {
      success: false,
      document: `${ansi.brightRed}Invalid open target '${modalTarget}'. Available: wizard, branding, diagnostics, export${ansi.reset}`,
      error: "Invalid target",
    };
  }

  return {
    success: false,
    document: `${ansi.brightRed}Unknown command '${input}'. Type 'help' for available commands.${ansi.reset}`,
    error: `Unknown command: ${input}`,
  };
}
