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
  parseUniversalCrf,
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length === 0 ||
    args.includes("--help") ||
    args.includes("-h") ||
    args[0] === "help"
  ) {
    printHelp();
    return;
  }

  const options: CliExecutionOptions = {
    json: args.includes("--json"),
    dryRun: args.includes("--dry-run"),
  };

  const command = args[0];

  // 1. Wizard
  if (command === "wizard") {
    await runInteractiveWizard();
    return;
  }

  // 2. List
  if (command === "list") {
    const category = (args[1] || "domains") as
      "domains" | "presets" | "forms" | "visits";
    const fileArg = args[2] && !args[2].startsWith("--") ? args[2] : undefined;
    const { study } = loadProtocol(fileArg);
    const result = executeListCommand(study, category, options);
    console.log(result.document);
    return;
  }

  // 3. Preset
  if (command === "preset") {
    const sub = (args[1] || "list") as "list" | "load";
    const presetId = args[2] && !args[2].startsWith("--") ? args[2] : undefined;
    const fileArg = args[3] && !args[3].startsWith("--") ? args[3] : undefined;
    const loaded = loadProtocol(fileArg, { allowMissing: sub === "load" });

    const result = executePresetCommand(loaded.study, sub, presetId, options);
    console.log(result.document);
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
    console.log(
      `${ansi.bold}${ansi.brightGreen}✔ Initialized Universal CRF protocol at ${targetFile}${ansi.reset}`
    );
    return;
  }

  // 5. Info
  if (command === "info") {
    const fileArg = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
    const { study } = loadProtocol(fileArg);
    const result = executeInfoCommand(study, options);
    console.log(result.document);
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
    const domain = args[2] || "CUSTOM";
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
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 8. Add Field
  if (command === "add" && args[1] === "field") {
    const formDomain = args[2] || "DM";
    const varIdx = args.indexOf("--var");
    const varName =
      varIdx !== -1 && args[varIdx + 1] ? args[varIdx + 1] : "TESTVAR";
    const typeIdx = args.indexOf("--type");
    const dataType = (
      typeIdx !== -1 && args[typeIdx + 1] ? args[typeIdx + 1] : "text"
    ) as Parameters<typeof executeAddFieldCommand>[2]["dataType"];
    const req = args.includes("--required");
    const unitIdx = args.indexOf("--unit");
    const unit =
      unitIdx !== -1 && args[unitIdx + 1] ? args[unitIdx + 1] : undefined;
    const labelIdx = args.indexOf("--label");
    const label =
      labelIdx !== -1 && args[labelIdx + 1] ? args[labelIdx + 1] : undefined;

    const tierIdx = args.indexOf("--tier");
    const tier =
      tierIdx !== -1 && args[tierIdx + 1]
        ? (args[tierIdx + 1] as "optional" | "hard_stop" | "auto_query")
        : undefined;
    const allowPartial =
      args.includes("--allow-partial") || args.includes("--partial");
    const preventFutureDate =
      args.includes("--prevent-future-date") || args.includes("--no-future");
    const allowNullFlavor =
      args.includes("--null-flavor") || args.includes("--null-flavors");
    const requiresSdv = args.includes("--sdv");
    const isBlinded = args.includes("--blinded");

    const fileArg = args.find(
      (a, i) =>
        i > 2 &&
        !a.startsWith("--") &&
        args[i - 1] !== "--var" &&
        args[i - 1] !== "--type" &&
        args[i - 1] !== "--unit" &&
        args[i - 1] !== "--label" &&
        args[i - 1] !== "--tier"
    );
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
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 9. Remove (rm) Form / Field
  if ((command === "rm" || command === "remove") && args[1] === "form") {
    const domain = args[2];
    const fileArg =
      args[3] && !args[3].startsWith("--") ? args[3] : DEFAULT_FILE;
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;
    const result = executeRemoveFormCommand(study, domain, options);
    console.log(result.document);
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  if ((command === "rm" || command === "remove") && args[1] === "field") {
    const formDomain = args[2];
    const varName = args[3];
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
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 10. Visit
  if (command === "visit") {
    const sub = args[1] as "add" | "rm" | "assign" | "unassign";
    const fileArg = args.find(
      (a, i) =>
        i > 1 &&
        !a.startsWith("--") &&
        args[i - 1] !== "--day" &&
        args[i - 1] !== "--win" &&
        a.endsWith(".json")
    );
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;
    const visitArgs = args.slice(2).filter((a) => a !== fileArg);
    const result = executeVisitCommand(study, sub, visitArgs, options);
    console.log(result.document);
    if (result.updatedStudy && !options.dryRun) {
      saveProtocol(loaded, result.updatedStudy);
    }
    return;
  }

  // 11. Rule
  if (command === "rule") {
    const sub = (args[1] || "list") as "add" | "list";
    const fileArg = args.find(
      (a, i) =>
        i > 1 &&
        !a.startsWith("--") &&
        args[i - 1] !== "--expr" &&
        args[i - 1] !== "--msg" &&
        a.endsWith(".json")
    );
    const loaded = loadProtocol(fileArg);
    const { study } = loaded;
    const ruleArgs = args.slice(2).filter((a) => a !== fileArg);
    const result = executeRuleCommand(study, sub, ruleArgs, options);
    console.log(result.document);
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

    const result = executeExportCommand(study, fmt, options);
    if (!result.success) {
      console.error(result.document);
      process.exit(1);
    }

    if (outPath && !options.dryRun) {
      fs.writeFileSync(outPath, result.document, "utf-8");
      console.log(
        `${ansi.bold}${ansi.brightGreen}✔ Exported ${fmt.toUpperCase()} metadata to ${outPath}${ansi.reset}`
      );
    } else {
      console.log(result.document);
    }
    return;
  }

  // 13. Diff
  if (command === "diff") {
    const fileA = args[1];
    const fileB = args[2];
    if (!fileA || !fileB) {
      console.error(
        `${ansi.brightRed}Usage: crf diff <file1> <file2>${ansi.reset}`
      );
      process.exit(1);
    }

    const studyA = parseUniversalCrf(fs.readFileSync(fileA, "utf-8"));
    const studyB = parseUniversalCrf(fs.readFileSync(fileB, "utf-8"));

    const result = executeDiffCommand(studyA, studyB, options);
    console.log(result.document);
    return;
  }

  printHelp();
}

main().catch((err) => {
  if (err instanceof CrfInputError) {
    console.error(`${ansi.brightRed}${err.message}${ansi.reset}`);
  } else {
    console.error(`${ansi.brightRed}Fatal error:${ansi.reset}`, err);
  }
  process.exit(1);
});
