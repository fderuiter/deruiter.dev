#!/usr/bin/env node
/**
 * Clinical Research Form (CRF) CLI & TUI Guided Authoring Suite
 * Zero-dependency TypeScript command-line tool for CDISC 2.2 / Universal CRF Protocols
 *
 * Usage:
 *   npx tsx scripts/crf.ts <command> [options]
 *   npm run crf <command> [options]
 */

import fs from "fs";
import readline from "readline";
import { getOncologyPresetSync } from "../lib/crf/presets";
import { StudyProtocol } from "../lib/crf/types";
import {
  CrfInputError,
  DEFAULT_FILE,
  loadProtocol,
  saveProtocol,
} from "./crf-input";
import {
  executeInfoCommand,
  executeValidateCommand,
  executeAddFormCommand,
  executeAddFieldCommand,
  executeRemoveFormCommand,
  executeRemoveFieldCommand,
  executeVisitCommand,
  executeRuleCommand,
  executeListCommand,
  executePresetCommand,
  executeExportCommand,
  executeDiffCommand,
  ansi,
  CliExecutionOptions,
  StudyProtocolEngine,
  exportUniversalCrfJson,
} from "../lib/crf";

function saveProtocolToFile(filePath: string, study: StudyProtocol): void {
  const serialized = exportUniversalCrfJson(study);
  fs.writeFileSync(filePath, serialized, "utf-8");
}

function printHelp(): void {
  console.log(
    `${ansi.bold}${ansi.underline}# CRF STUDIO CLI — Clinical Data Management Suite${ansi.reset}\n`
  );
  console.log(
    `${ansi.bold}Usage:${ansi.reset} crf <command> [file] [options]\n`
  );
  console.log(`${ansi.bold}Commands:${ansi.reset}`);
  console.log(
    `  ${ansi.cyan}info [file]${ansi.reset}                                Display study overview, CDASH domains & SoA visits`
  );
  console.log(
    `  ${ansi.cyan}validate [file]${ansi.reset}                            Audit CDISC CDASH 2.2, AST logic & SoA matrix`
  );
  console.log(
    `  ${ansi.cyan}wizard${ansi.reset}                                     Launch interactive 5-stage TUI authoring wizard`
  );
  console.log(
    `  ${ansi.cyan}list <domains|presets|forms|visits>${ansi.reset}       Inspect domain catalog, presets, or schedule`
  );
  console.log(
    `  ${ansi.cyan}preset <list|load <id>> [file]${ansi.reset}             Browse or load clinical study presets`
  );
  console.log(
    `  ${ansi.cyan}init [name] [--preset <id>]${ansi.reset}                Scaffold new study protocol file (study.crf.json)`
  );
  console.log(
    `  ${ansi.cyan}add form <domain> [file] [--name <s>]${ansi.reset}     Inject standard CDASH domain (e.g. DM, VS, AE, LB)`
  );
  console.log(
    `  ${ansi.cyan}add field <form> [file] --var <n> --type <t>${ansi.reset} Add clinical variable with unit and validation`
  );
  console.log(
    `  ${ansi.cyan}rm form <domain> [file]${ansi.reset}                    Remove domain form and prune SoA assignments`
  );
  console.log(
    `  ${ansi.cyan}rm field <form> <var> [file]${ansi.reset}               Remove clinical variable and prune AST rules`
  );
  console.log(
    `  ${ansi.cyan}visit <add|rm|assign|unassign> <args...> [file]${ansi.reset} Configure Schedule of Activities (SoA) visits`
  );
  console.log(
    `  ${ansi.cyan}rule <add|list> [args...] [file]${ansi.reset}           Add or list dynamic AST edit checks and formulas`
  );
  console.log(
    `  ${ansi.cyan}export [file] --format <odm|json|yaml|fhir|sas|r>${ansi.reset} Compile to regulatory metadata standards`
  );
  console.log(
    `  ${ansi.cyan}diff <file1> <file2>${ansi.reset}                       Compare semantic structural changes between protocols`
  );
  console.log(
    `  ${ansi.cyan}help${ansi.reset}                                       Show this help menu\n`
  );
  console.log(`${ansi.bold}Flags:${ansi.reset}`);
  console.log(
    `  ${ansi.dim}--json${ansi.reset}                                     Output structured machine-readable JSON`
  );
  console.log(
    `  ${ansi.dim}--dry-run${ansi.reset}                                  Verify execution without writing changes to disk`
  );
  console.log(
    `  ${ansi.dim}--out <path>${ansi.reset}                               Write export output to specific file path\n`
  );
  console.log(`${ansi.bold}Examples:${ansi.reset}`);
  console.log(`  $ npm run crf wizard`);
  console.log(`  $ npm run crf info`);
  console.log(`  $ npm run crf list domains`);
  console.log(`  $ npm run crf preset load device_cardiovascular_implant`);
  console.log(`  $ npm run crf add form VS`);
  console.log(
    `  $ npm run crf add field VS --var SYSBP --type number --unit mmHg --required`
  );
  console.log(`  $ npm run crf visit add "Cycle 1 Day 1" --day 28 --win 3`);
  console.log(`  $ npm run crf visit assign "Cycle 1 Day 1" VS AE`);
  console.log(`  $ npm run crf visit unassign "Cycle 1 Day 1" AE`);
  console.log(`  $ npm run crf export --format odm --out study-metadata.xml\n`);
}

/**
 * 5-Stage Interactive TUI Wizard for Terminal
 */
async function runInteractiveWizard(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (promptText: string): Promise<string> => {
    return new Promise((resolve) => rl.question(promptText, resolve));
  };

  console.log(
    `\n${ansi.bold}${ansi.brightCyan}╔════════════════════════════════════════════════════════════════════╗${ansi.reset}`
  );
  console.log(
    `${ansi.bold}${ansi.brightCyan}║       CRF STUDIO: 5-Stage Guided Clinical TUI Authoring Wizard     ║${ansi.reset}`
  );
  console.log(
    `${ansi.bold}${ansi.brightCyan}║       CDISC CDASH 2.2 · AST Logic Integrity · SoA Visit Matrix     ║${ansi.reset}`
  );
  console.log(
    `${ansi.bold}${ansi.brightCyan}╚════════════════════════════════════════════════════════════════════╝${ansi.reset}\n`
  );

  // Stage 1: Protocol Profile & Preset Archetype
  console.log(
    `${ansi.bold}${ansi.underline}Stage 1 of 5: Protocol Profile & Archetype Selection${ansi.reset}`
  );
  console.log(`Starting archetypes:`);
  console.log(
    `  1. ${ansi.cyan}Oncology RECIST 1.1${ansi.reset} (Solid tumors, RECIST tracking, CTCAE AEs)`
  );
  console.log(
    `  2. ${ansi.cyan}Class III Medical Device${ansi.reset} (Implantable device, UDI, DI/DU/DE)`
  );
  console.log(
    `  3. ${ansi.cyan}CNS / Neuro Psychiatric${ansi.reset} (HAM-D, PANSS scales, cognitive testing)`
  );
  console.log(
    `  4. ${ansi.cyan}PK / PD Dose Escalation${ansi.reset} (Intensive PK sampling, bioanalysis)`
  );
  console.log(
    `  5. ${ansi.cyan}Custom / Blank Protocol${ansi.reset} (Author from clean slate)\n`
  );

  const archetypeChoice =
    (await question(`Select archetype [1-5, default 1]: `)).trim() || "1";

  let study: StudyProtocol;
  if (archetypeChoice === "1") {
    study = StudyProtocolEngine.loadPreset("oncology_recist").study;
  } else if (archetypeChoice === "2") {
    study = StudyProtocolEngine.loadPreset(
      "device_cardiovascular_implant"
    ).study;
  } else if (archetypeChoice === "3") {
    study = StudyProtocolEngine.loadPreset("cns_neuro").study;
  } else if (archetypeChoice === "4") {
    study = StudyProtocolEngine.loadPreset("pk_dose_escalation").study;
  } else {
    study = StudyProtocolEngine.createInitialStudy();
  }

  const protocolNumPrompt = `Protocol Number [${study.protocolNumber}]: `;
  const protocolNumber =
    (await question(protocolNumPrompt)).trim() || study.protocolNumber;
  const studyNamePrompt = `Study Title [${study.studyName}]: `;
  const studyName = (await question(studyNamePrompt)).trim() || study.studyName;
  const sponsorPrompt = `Sponsor [${study.sponsor}]: `;
  const sponsor = (await question(sponsorPrompt)).trim() || study.sponsor;

  study = {
    ...study,
    protocolNumber,
    studyName,
    sponsor,
    lastModified: new Date().toISOString(),
  };

  // Stage 2: CDASH 2.2 Domain Selection
  console.log(
    `\n${ansi.bold}${ansi.underline}Stage 2 of 5: CDASH 2.2 Clinical Domains${ansi.reset}`
  );
  console.log(
    `Current domains: ${study.forms.map((f) => ansi.cyan + f.domain + ansi.reset).join(", ") || "None"}`
  );
  console.log(
    `Available domains to add: DM, VS, AE, CM, LB, RECIST, DI, DU, DE, DA, EX, MH, DS`
  );
  const domainAnswer = (
    await question(
      `Inject additional domains (comma-separated, or Enter to keep current): `
    )
  ).trim();

  if (domainAnswer) {
    const toAdd = domainAnswer
      .split(",")
      .map((d) => d.trim().toUpperCase())
      .filter(Boolean);
    for (const d of toAdd) {
      if (!study.forms.some((f) => f.domain.toUpperCase() === d)) {
        const res = StudyProtocolEngine.addForm(study, d);
        study = res.study;
        console.log(
          `  ${ansi.green}✔ Added domain ${d} (${res.form.name})${ansi.reset}`
        );
      }
    }
  }

  // Stage 3: Schedule of Activities (SoA) Matrix
  console.log(
    `\n${ansi.bold}${ansi.underline}Stage 3 of 5: Schedule of Activities (SoA) Visit Planning${ansi.reset}`
  );
  console.log(`Current visits:`);
  for (const v of study.visits) {
    console.log(
      `  • Day ${String(v.targetDay).padStart(3)}: ${ansi.bold}${v.name}${ansi.reset} (${v.assignedFormIds.length} forms assigned)`
    );
  }

  const addVisitAnswer = (
    await question(
      `Add a new study visit? (e.g. "Cycle 2 Day 1, 56, 3" or Enter to skip): `
    )
  ).trim();
  if (addVisitAnswer) {
    const [vName, vDay, vWin] = addVisitAnswer.split(",").map((s) => s.trim());
    if (vName) {
      const res = StudyProtocolEngine.addVisit(study, {
        name: vName,
        targetDay: parseInt(vDay, 10) || 0,
        windowBefore: parseInt(vWin, 10) || 0,
        windowAfter: parseInt(vWin, 10) || 0,
      });
      study = res.study;
      console.log(
        `  ${ansi.green}✔ Added visit "${res.visit.name}" at Day ${res.visit.targetDay}.${ansi.reset}`
      );
    }
  }

  // Assign any unassigned forms to all scheduled visits
  const unassigned = study.forms.filter(
    (f) =>
      !f.isLogForm &&
      !study.visits.some((v) => v.assignedFormIds.includes(f.id))
  );
  if (unassigned.length > 0 && study.visits.length > 0) {
    const firstVisit = study.visits[0];
    const res = StudyProtocolEngine.assignVisitForms(
      study,
      firstVisit.id,
      unassigned.map((f) => f.id)
    );
    if (res.study) {
      study = res.study;
      console.log(
        `  ${ansi.dim}Auto-assigned ${unassigned.length} baseline forms to visit "${firstVisit.name}" to prevent SoA orphans.${ansi.reset}`
      );
    }
  }

  // Stage 4: Clinical Calculation Presets & Edit Checks
  console.log(
    `\n${ansi.bold}${ansi.underline}Stage 4 of 5: AST Clinical Formulas & Edit Checks${ansi.reset}`
  );
  console.log(`Standard Formula Presets:`);
  console.log(
    `  • ${ansi.cyan}BMI${ansi.reset}: Body Mass Index = weight / ((height/100)^2)`
  );
  console.log(
    `  • ${ansi.cyan}MAP${ansi.reset}: Mean Arterial Pressure = (2*DIABP + SYSBP) / 3`
  );
  console.log(
    `  • ${ansi.cyan}Compliance${ansi.reset}: Drug Accountability = ((DISP - RET) / DISP) * 100`
  );
  const formulaAnswer = (
    await question(`Inject standard calculation rules? (Y/n) [Y]: `)
  )
    .trim()
    .toLowerCase();

  if (formulaAnswer !== "n") {
    if (study.forms.some((f) => f.domain === "VS")) {
      const res = StudyProtocolEngine.addRule(study, "VS", {
        name: "Derived BMI Calculation",
        targetFieldIdOrVar: "BMI",
        actionType: "set_value",
        formulaExpression:
          "round(WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100)), 1)",
        triggerFieldIdsOrVars: ["WEIGHT", "HEIGHT"],
      });
      if (res.study) study = res.study;
      console.log(
        `  ${ansi.green}✔ Injected BMI AST calculation rule into Vital Signs (VS).${ansi.reset}`
      );
    }
  }

  // Stage 5: 4-Tier Conformance Audit & Save
  console.log(
    `\n${ansi.bold}${ansi.underline}Stage 5 of 5: Conformance Audit & Save Protocol${ansi.reset}`
  );
  const valResult = executeValidateCommand(study);
  console.log(valResult.document);

  const outFile =
    (await question(`Save Universal CRF JSON to [${DEFAULT_FILE}]: `)).trim() ||
    DEFAULT_FILE;
  saveProtocolToFile(outFile, study);

  console.log(
    `\n${ansi.bold}${ansi.brightGreen}✔ Successfully authored ${outFile}!${ansi.reset}`
  );
  console.log(
    `${ansi.dim}Summary: ${study.forms.length} CDASH domains, ${study.visits.length} visits, ${study.forms.reduce((a, f) => a + f.rules.length, 0)} rules.${ansi.reset}`
  );
  console.log(
    `\nTo inspect: ${ansi.cyan}npm run crf info ${outFile}${ansi.reset}`
  );
  console.log(
    `To export ODM: ${ansi.cyan}npm run crf export ${outFile} --format odm${ansi.reset}\n`
  );

  rl.close();
}

const ALL_VALUED_OPTIONS = new Set([
  "--preset",
  "--name",
  "--var",
  "--type",
  "--unit",
  "--label",
  "--tier",
  "--span",
  "--calc",
  "--day",
  "--win",
  "--expr",
  "--msg",
  "--target",
  "--action",
  "--format",
  "--out",
]);

function hasStandaloneGlobalFlag(
  argv: readonly string[],
  ...flags: string[]
): boolean {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (ALL_VALUED_OPTIONS.has(token)) {
      i++;
      continue;
    }
    if (flags.includes(token)) {
      return true;
    }
  }
  return false;
}

function emitCliFailure(
  errorMessage: string,
  ansiMessage: string,
  isJson: boolean
): never {
  if (isJson) {
    console.log(
      JSON.stringify(
        {
          success: false,
          error: errorMessage,
        },
        null,
        2
      )
    );
  } else {
    console.error(ansiMessage);
  }
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isJson = hasStandaloneGlobalFlag(args, "--json");
  const isDryRun = hasStandaloneGlobalFlag(args, "--dry-run");

  if (
    args.length === 0 ||
    hasStandaloneGlobalFlag(args, "--help", "-h") ||
    args[0] === "help"
  ) {
    if (isJson) {
      console.log(
        JSON.stringify(
          {
            success: true,
            commands: [
              "info",
              "validate",
              "wizard",
              "list",
              "preset",
              "init",
              "add form",
              "add field",
              "rm form",
              "rm field",
              "visit",
              "rule",
              "export",
              "diff",
              "help",
            ],
          },
          null,
          2
        )
      );
      return;
    }
    printHelp();
    return;
  }

  const options: CliExecutionOptions = {
    json: isJson,
    dryRun: isDryRun,
  };

  const command = args[0];

  // 1. Wizard
  if (command === "wizard") {
    if (options.json) {
      emitCliFailure(
        "Interactive wizard cannot run in --json mode. Use non-interactive commands such as 'crf init' or 'crf add'.",
        `${ansi.brightRed}Interactive wizard cannot run in --json mode.${ansi.reset}`,
        true
      );
    }
    await runInteractiveWizard();
    return;
  }

  // 2. List
  if (command === "list") {
    const positional = args.slice(1).filter((a) => !a.startsWith("--"));
    const category = (positional[0] || "domains") as
      "domains" | "presets" | "forms" | "visits";
    const fileArg = positional[1];
    const { study } = loadProtocol(fileArg);
    const result = executeListCommand(study, category, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  // 3. Preset
  if (command === "preset") {
    const positional = args.slice(1).filter((a) => !a.startsWith("--"));
    const sub = (positional[0] || "list") as "list" | "load";
    const presetId = positional[1];
    const fileArg = positional[2];
    const loaded = loadProtocol(fileArg, { allowMissing: sub === "load" });

    const result = executePresetCommand(loaded.study, sub, presetId, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy, { replaces: true });
    }
    return;
  }

  // 4. Init
  if (command === "init") {
    const presetIdx = args.indexOf("--preset");
    const presetId = presetIdx !== -1 ? args[presetIdx + 1] : undefined;
    const { study } = presetId
      ? StudyProtocolEngine.loadPreset(presetId)
      : { study: getOncologyPresetSync() };
    const targetFile =
      args[1] && !args[1].startsWith("--") ? args[1] : DEFAULT_FILE;

    if (!options.dryRun) {
      saveProtocolToFile(targetFile, study);
    }
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            file: targetFile,
            protocolNumber: study.protocolNumber,
            dryRun: Boolean(options.dryRun),
          },
          null,
          2
        )
      );
    } else {
      console.log(
        `${ansi.bold}${ansi.brightGreen}✔ Initialized Universal CRF protocol at ${targetFile}${ansi.reset}`
      );
    }
    return;
  }

  // 5. Info
  if (command === "info") {
    const fileArg = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
    const { study } = loadProtocol(fileArg);
    const result = executeInfoCommand(study, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  // 6. Validate / Lint
  if (command === "validate" || command === "lint") {
    const fileArg = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
    const { study } = loadProtocol(fileArg);
    const result = executeValidateCommand(study, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  // 7. Add Form
  if (command === "add" && args[1] === "form") {
    const domain = args[2] && !args[2].startsWith("--") ? args[2] : "CUSTOM";
    const nameIdx = args.indexOf("--name");
    const customName =
      nameIdx !== -1 && args[nameIdx + 1]
        ? args
            .slice(nameIdx + 1)
            .filter((a) => !a.startsWith("--"))
            .join(" ")
        : undefined;
    const fileArg = args.find(
      (a, i) => i > 2 && !a.startsWith("--") && args[i - 1] !== "--name"
    );
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;

    const result = executeAddFormCommand(study, domain, customName, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 8. Add Field
  if (command === "add" && args[1] === "field") {
    const hasDomain = args[2] !== undefined && !args[2].startsWith("--");
    const formDomain = hasDomain ? args[2] : "DM";
    // Scan options left-to-right so values such as "--required" or "--sdv"
    // passed to --label or --calc stay option values (#3812).
    const fieldTokens = args.slice(hasDomain ? 3 : 2);
    let varName = "TESTVAR";
    let dataType: Parameters<typeof executeAddFieldCommand>[2]["dataType"] =
      "text";
    let req = false;
    let unit: string | undefined;
    let label: string | undefined;
    let tier: "optional" | "hard_stop" | "auto_query" | undefined;
    let columnSpan: number | undefined;
    let calculationFormula: string | undefined;
    let allowPartial = false;
    let preventFutureDate = false;
    let allowNullFlavor = false;
    let requiresSdv = false;
    let isBlinded = false;
    let fileArg: string | undefined;

    for (let i = 0; i < fieldTokens.length; i++) {
      const token = fieldTokens[i];
      if (token === "--var") {
        if (i + 1 < fieldTokens.length) varName = fieldTokens[++i] || "TESTVAR";
      } else if (token === "--type") {
        if (i + 1 < fieldTokens.length) {
          dataType = (fieldTokens[++i] || "text") as Parameters<
            typeof executeAddFieldCommand
          >[2]["dataType"];
        }
      } else if (token === "--unit") {
        if (i + 1 < fieldTokens.length) unit = fieldTokens[++i];
      } else if (token === "--label") {
        if (i + 1 < fieldTokens.length) label = fieldTokens[++i];
      } else if (token === "--tier") {
        if (i + 1 < fieldTokens.length) {
          tier = fieldTokens[++i] as "optional" | "hard_stop" | "auto_query";
        }
      } else if (token === "--span") {
        if (i + 1 < fieldTokens.length) {
          const parsedSpan = Number(fieldTokens[++i]);
          if (
            Number.isInteger(parsedSpan) &&
            parsedSpan >= 1 &&
            parsedSpan <= 12
          ) {
            columnSpan = parsedSpan;
          }
        }
      } else if (token === "--calc") {
        if (i + 1 < fieldTokens.length) calculationFormula = fieldTokens[++i];
      } else if (token === "--required") {
        req = true;
      } else if (token === "--allow-partial" || token === "--partial") {
        allowPartial = true;
      } else if (token === "--prevent-future-date" || token === "--no-future") {
        preventFutureDate = true;
      } else if (token === "--null-flavor" || token === "--null-flavors") {
        allowNullFlavor = true;
      } else if (token === "--sdv") {
        requiresSdv = true;
      } else if (token === "--blinded") {
        isBlinded = true;
      } else if (token === "--json" || token === "--dry-run") {
        // Handled globally
      } else if (!token.startsWith("--") && !fileArg) {
        fileArg = token;
      }
    }

    const loaded = loadProtocol(fileArg);
    const { study } = loaded;

    const result = executeAddFieldCommand(
      study,
      formDomain,
      {
        variableName: varName,
        dataType,
        required: req,
        unit,
        label,
        columnSpan,
        calculationFormula,
        requirementTier: tier,
        allowPartial: allowPartial || undefined,
        preventFutureDate: preventFutureDate || undefined,
        allowNullFlavor: allowNullFlavor || undefined,
        requiresSdv: requiresSdv || undefined,
        isBlinded: isBlinded || undefined,
      },
      options
    );
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 9. Remove (rm) Form / Field
  if ((command === "rm" || command === "remove") && args[1] === "form") {
    const domain = args[2] && !args[2].startsWith("--") ? args[2] : undefined;
    if (!domain) {
      emitCliFailure(
        "Missing domain",
        `${ansi.brightRed}Usage: crf rm form <domain>${ansi.reset}`,
        Boolean(options.json)
      );
    }
    const fileArg =
      args[3] && !args[3].startsWith("--") ? args[3] : DEFAULT_FILE;
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;
    const result = executeRemoveFormCommand(study, domain, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  if ((command === "rm" || command === "remove") && args[1] === "field") {
    const formDomain =
      args[2] && !args[2].startsWith("--") ? args[2] : undefined;
    const varName = args[3] && !args[3].startsWith("--") ? args[3] : undefined;
    if (!formDomain || !varName) {
      emitCliFailure(
        "Missing arguments",
        `${ansi.brightRed}Usage: crf rm field <form> <var>${ansi.reset}`,
        Boolean(options.json)
      );
    }
    const fileArg =
      args[4] && !args[4].startsWith("--") ? args[4] : DEFAULT_FILE;
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;
    const result = executeRemoveFieldCommand(
      study,
      formDomain,
      varName,
      options
    );
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 10. Visit
  if (command === "visit") {
    const sub = (args[1] && !args[1].startsWith("--") ? args[1] : undefined) as
      "add" | "rm" | "assign" | "unassign";
    const subIdx = args[1] && !args[1].startsWith("--") ? 2 : 1;
    const fileArg = args.find(
      (a, i) =>
        i >= subIdx &&
        !a.startsWith("--") &&
        args[i - 1] !== "--day" &&
        args[i - 1] !== "--win" &&
        a.endsWith(".json")
    );
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;
    const visitArgs = args.slice(subIdx).filter((a, idx) => {
      const prev = idx > 0 ? args[subIdx + idx - 1] : "";
      if (prev !== "--day" && prev !== "--win") {
        if (a === "--json" || a === "--dry-run" || a === fileArg) return false;
      }
      return true;
    });
    const result = executeVisitCommand(study, sub, visitArgs, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 11. Rule
  if (command === "rule") {
    const hasSub = args[1] !== undefined && !args[1].startsWith("--");
    const sub = (hasSub ? args[1] : "list") as "add" | "list";
    const subIdx = hasSub ? 2 : 1;
    const fileArg = args.find(
      (a, i) =>
        i >= subIdx &&
        !a.startsWith("--") &&
        args[i - 1] !== "--expr" &&
        args[i - 1] !== "--msg" &&
        args[i - 1] !== "--target" &&
        args[i - 1] !== "--action" &&
        a.endsWith(".json")
    );
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;
    const ruleValued = new Set(["--expr", "--msg", "--target", "--action"]);
    const ruleArgs = args.slice(subIdx).filter((a, idx) => {
      const prev = idx > 0 ? args[subIdx + idx - 1] : "";
      if (!ruleValued.has(prev)) {
        if (a === "--json" || a === "--dry-run" || a === fileArg) return false;
      }
      return true;
    });
    const result = executeRuleCommand(study, sub, ruleArgs, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 12. Export
  if (command === "export") {
    const fmtIdx = args.indexOf("--format");
    const fmt = (
      fmtIdx !== -1 && args[fmtIdx + 1] ? args[fmtIdx + 1] : "json"
    ) as Parameters<typeof executeExportCommand>[1];
    const outIdx = args.indexOf("--out");
    const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

    const fileArg = args.find(
      (a, i) =>
        i > 0 &&
        !a.startsWith("--") &&
        args[i - 1] !== "--format" &&
        args[i - 1] !== "--out"
    );
    const { study } = loadProtocol(fileArg);

    if (outPath) {
      const rawResult = executeExportCommand(study, fmt, {
        ...options,
        json: false,
      });
      if (!rawResult.success) {
        const errResult = executeExportCommand(study, fmt, options);
        if (options.json) {
          console.log(errResult.document);
        } else {
          console.error(errResult.document);
        }
        process.exit(1);
      }
      if (!options.dryRun) {
        fs.writeFileSync(outPath, rawResult.document, "utf-8");
      }
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: true,
              format: fmt,
              outPath,
              dryRun: Boolean(options.dryRun),
              ...(rawResult.data as Record<string, unknown>),
            },
            null,
            2
          )
        );
      } else {
        console.log(
          `${ansi.bold}${ansi.brightGreen}✔ Exported ${fmt.toUpperCase()} metadata to ${outPath}${ansi.reset}`
        );
      }
      return;
    }

    const result = executeExportCommand(study, fmt, options);
    if (!result.success) {
      if (options.json) {
        console.log(result.document);
      } else {
        console.error(result.document);
      }
      process.exit(1);
    }
    console.log(result.document);
    return;
  }

  // 13. Diff
  if (command === "diff") {
    const positional = args.slice(1).filter((a) => !a.startsWith("--"));
    const fileA = positional[0];
    const fileB = positional[1];
    if (!fileA || !fileB) {
      emitCliFailure(
        "Usage: crf diff <file1> <file2>",
        `${ansi.brightRed}Usage: crf diff <file1> <file2>${ansi.reset}`,
        Boolean(options.json)
      );
    }

    const studyA = loadProtocol(fileA).study;
    const studyB = loadProtocol(fileB).study;

    const result = executeDiffCommand(studyA, studyB, options);
    console.log(result.document);
    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  const unknownTarget =
    (command === "add" || command === "rm" || command === "remove") &&
    args[1] &&
    !args[1].startsWith("--")
      ? `${command} ${args[1]}`
      : command;
  emitCliFailure(
    `Unknown command: ${unknownTarget}`,
    `${ansi.brightRed}Unknown command '${unknownTarget}'. Run 'crf help' for available commands.${ansi.reset}`,
    Boolean(options.json)
  );
}

main().catch((err) => {
  const isJson = hasStandaloneGlobalFlag(process.argv.slice(2), "--json");
  if (isJson) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify(
        {
          success: false,
          error: message,
        },
        null,
        2
      )
    );
    process.exit(1);
  }
  if (err instanceof CrfInputError) {
    console.error(`${ansi.brightRed}${err.message}${ansi.reset}`);
  } else {
    console.error(`${ansi.brightRed}Fatal error:${ansi.reset}`, err);
  }
  process.exit(1);
});
