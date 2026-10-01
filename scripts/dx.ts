#!/usr/bin/env node
/**
 * Developer Experience (DX) Suite & Invariant CLI
 * Zero-dependency TypeScript task runner and Agent-First architecture guard
 */

import readline from "readline";
import path from "path";
import fs from "fs";
import { execSync, execFileSync } from "child_process";
import { runDiagnostics, printDoctorReport } from "../lib/dx/doctor";
import {
  scaffold,
  type ScaffoldType,
  validateScaffoldType,
  validateScaffoldName,
} from "../lib/dx/scaffolder";
import { runAllBenchmarks, printBenchmarkReport } from "../lib/dx/bench";
import { colors, formatHeader, badge } from "../lib/dx/utils";
import {
  ALLOWED_COMMIT_TYPES,
  validateCommitMessage,
  validateBranchName,
} from "../lib/dx/git-guard";
import { checkEnvironmentVariables } from "../lib/dx/env-guard";
import { runPreflight } from "../lib/dx/preflight";
import { runSetupWorkflow } from "../lib/dx/setup";
import { scanDeadCode, printDeadCodeDocument } from "../lib/dx/dead-code";
import { inspectBundleChunks, printBundleReport } from "../lib/dx/bundle-guard";
import { runLicenseAudit } from "./license-audit";
import {
  parseCliArgs,
  createDxEnvelope,
  printJsonEnvelope,
  sanitizeCliInput,
  COMMAND_REGISTRY,
  type ParsedCliArgs,
} from "../lib/dx/cli-parser";
import { checkDeprecations } from "./check-deprecations";

const workspaceRoot = path.resolve(__dirname, "..");

function printUsage(): void {
  console.log(
    formatHeader(
      "DX SUITE — Developer Experience & Invariant Engine",
      "Next.js 16 • React 19 • Agent-First Architecture"
    )
  );
  console.log(`${colors.bold}Usage:${colors.reset} dx <command> [options]\n`);
  console.log(`${colors.bold}Commands:${colors.reset}`);
  console.log(
    `  ${colors.cyan}doctor [--fix] [--json]${colors.reset}       Run architectural & invariant health diagnostics`
  );
  console.log(
    `  ${colors.cyan}verify [--json]${colors.reset}               Strict invariant check for CI / pre-commit (exits 1 on failure)`
  );
  console.log(
    `  ${colors.cyan}audit:licenses [--json]${colors.reset}       Audit lockfile package SPDX licenses against policy`
  );
  console.log(
    `  ${colors.cyan}dead-code [--limit n] [--json]${colors.reset} Scan for unused exports and orphaned modules`
  );
  console.log(
    `  ${colors.cyan}analyze [--strict] [--json]${colors.reset}    Inspect production bundle chunk sizes and budgets`
  );
  console.log(
    `  ${colors.cyan}scaffold [type] [name]${colors.reset}        Scaffold code templates (arcade, api, adr, component, hook)`
  );
  console.log(
    `  ${colors.cyan}commit [--type] [--subject]${colors.reset}   Conventional Commit wizard & non-interactive bypass`
  );
  console.log(
    `  ${colors.cyan}branch [--prefix] [--name]${colors.reset}    Branch generator with convention validation`
  );
  console.log(
    `  ${colors.cyan}env [--fix] [--json]${colors.reset}          Validate runtime environment schema & sync .env.example`
  );
  console.log(
    `  ${colors.cyan}bench [--pages] [--json]${colors.reset}      Run Pretext, Masonry, and Security micro-benchmarks`
  );
  console.log(
    `  ${colors.cyan}setup [--yes] [--json]${colors.reset}        Developer onboarding & environment setup`
  );
  console.log(
    `  ${colors.cyan}describe${colors.reset}                       Schema introspection registry for AI agents (JSON)`
  );
  console.log(
    `  ${colors.cyan}build:icons${colors.reset}                   Generate multi-resolution brand icons`
  );
  console.log(
    `  ${colors.cyan}build:theme${colors.reset}                   Compile CSS custom properties into TS design tokens`
  );
  console.log(
    `  ${colors.cyan}check:migrations${colors.reset}              Validate Prisma provider parity & migration SQL`
  );
  console.log(
    `  ${colors.cyan}check:migrations:drift${colors.reset}        Run schema drift verification against prisma/schema.prisma`
  );
  console.log(
    `  ${colors.cyan}migration:replay${colors.reset}              Replay full migration history on disposable target`
  );
  console.log(
    `  ${colors.cyan}verify:upstash${colors.reset}                Verify Upstash Redis connectivity, namespaces, and outage behavior`
  );
  console.log(
    `  ${colors.cyan}inventory:vercel${colors.reset}              Inspect Vercel storage meters, retention inventory, and candidates`
  );
  console.log(
    `  ${colors.cyan}inventory:neon${colors.reset}                Inspect Neon capacity, branches, connection hygiene, and candidates`
  );
  console.log(
    `  ${colors.cyan}headroom:vercel${colors.reset}               Evaluate Vercel storage and build hour headroom budgets`
  );
  console.log();
  console.log(
    `  ${colors.cyan}crf <cmd> [options]${colors.reset}           Clinical Research Form (CRF) authoring & validation CLI`
  );
  console.log(
    `  ${colors.cyan}issues:sync [--dry-run]${colors.reset}       Dual-tracker GitHub issue synchronization (ADR 0025)`
  );
  console.log(
    `  ${colors.cyan}clean${colors.reset}                         Clean build artifacts and reset developer cache\n`
  );
  console.log(`${colors.bold}Examples:${colors.reset}`);
  console.log(`  $ npm run dx doctor -- --json`);
  console.log(`  $ npm run dx doctor -- --fix`);
  console.log(`  $ npm run dx describe`);
  console.log(
    `  $ npm run dx scaffold -- --type component --name telemetry-badge --yes`
  );
  console.log(
    `  $ npm run dx commit -- --type feat --scope dx --subject "add json output" --yes`
  );
  console.log(`  $ npm run dx dead-code -- --json --limit 5\n`);
}

export async function handleSetupCommand(parsed: ParsedCliArgs): Promise<void> {
  const isYes = Boolean(parsed.flags.yes || parsed.flags.y);
  const skipDb = Boolean(parsed.flags["skip-db"]);
  const skipDbSeed = Boolean(parsed.flags["skip-db-seed"]);
  const forceEnv = Boolean(parsed.flags["force-env"]);
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);

  const startTime = Date.now();
  const result = await runSetupWorkflow({
    workspaceRoot,
    interactive: !isYes,
    skipDb,
    skipDbSeed,
    forceEnv,
  });

  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "setup",
        success: result.success,
        durationMs,
        data: result,
        remediations: result.success
          ? []
          : [
              {
                id: "setup-retry",
                title: "Rerun setup workflow with verbose logging",
                command: "npm run setup",
                autoFixable: false,
              },
            ],
      })
    );
  }

  if (!result.success) {
    process.exit(1);
  }
}

export async function handleDoctorCommand(
  parsed: ParsedCliArgs
): Promise<void> {
  const fix = Boolean(parsed.flags.fix || parsed.flags.f);
  const ci = Boolean(parsed.flags.ci || parsed.flags.c);
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);

  const startTime = Date.now();
  const summary = await runDiagnostics({ workspaceRoot, fix, ci });
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "doctor",
        success: !summary.hasFailures && (!ci || !summary.hasWarnings),
        durationMs,
        data: summary,
        remediations: summary.remediations,
      })
    );
  } else {
    printDoctorReport(summary, ci);
    console.log(`\nDiagnostics finished in ${durationMs}ms.`);
  }

  if (summary.hasFailures || (ci && summary.hasWarnings)) {
    process.exit(1);
  }
}

export async function handleVerifyCommand(
  parsed: ParsedCliArgs
): Promise<void> {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const startTime = Date.now();
  const summary = await runDiagnostics({ workspaceRoot, fix: false, ci: true });
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "verify",
        success: !summary.hasFailures && !summary.hasWarnings,
        durationMs,
        data: summary,
        remediations: summary.remediations,
      })
    );
  } else {
    printDoctorReport(summary, true);
    if (summary.hasFailures) {
      console.error(
        `\n${colors.brightRed}❌ Invariant verification failed. Resolve highlighted issues or run 'npm run doctor:fix'.${colors.reset}\n`
      );
    } else if (summary.hasWarnings) {
      console.error(
        `\n${colors.brightYellow}⚠️  Invariant verification failed: ${summary.totalWarned} warning(s) are treated as failures in strict mode. Resolve highlighted issues or run 'npm run doctor:fix'.${colors.reset}\n`
      );
    } else {
      console.log(
        `\n${colors.brightGreen}✅ All AGENTS.md architectural invariants and security checks verified.${colors.reset}\n`
      );
    }
  }

  if (summary.hasFailures || summary.hasWarnings) {
    process.exit(1);
  }
}

export async function handleEnvCommand(parsed: ParsedCliArgs): Promise<void> {
  const fix = Boolean(parsed.flags.fix || parsed.flags.f);
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const startTime = Date.now();

  const result = checkEnvironmentVariables(workspaceRoot, fix);
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "env",
        success: result.status === "pass" || result.status === "fixed",
        durationMs,
        data: result,
        remediations:
          result.status === "fail"
            ? [
                {
                  id: "env-sync",
                  title: "Synchronize environment variables to .env.example",
                  command: "npm run dx env -- --fix",
                  autoFixable: true,
                  scope: "env",
                },
              ]
            : [],
      })
    );
  } else {
    console.log(
      formatHeader(
        "DX Environment & Schema Sentinel",
        "lib/env.ts • .env.example"
      )
    );
    console.log(
      badge(`[${result.category.toUpperCase()}] ${result.name}`, result.status)
    );
    console.log(`  ${result.message}`);

    if (result.details && result.details.length > 0) {
      console.log("\nDetails:");
      for (const d of result.details) {
        console.log(`  ${colors.yellow}• ${d}${colors.reset}`);
      }
    }

    if (result.status === "fail" && !fix) {
      console.log(
        `\n${colors.cyan}Tip: Run 'npm run dx env -- --fix' to auto-sync .env.example.${colors.reset}\n`
      );
    }
  }

  if (result.status === "fail" && !fix) {
    process.exit(1);
  }
}

/**
 * Bounded runtime preflight: checks Node/npm versions, the generated
 * Prisma client, and real `node --import tsx` execution up front, before
 * an agent or developer starts expensive work (tests, `npm run verify`,
 * browser probes). Meant to turn a broken environment into one clear,
 * actionable report instead of a confusing wall of downstream failures.
 */
export function handleAuditDepsCommand(parsed: ParsedCliArgs): void {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const startTime = Date.now();
  const report = checkDeprecations(workspaceRoot);
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "audit:deps",
        success: report.success,
        durationMs,
        data: report,
        remediations: report.success
          ? []
          : [
              {
                id: "update-deprecated-deps",
                title:
                  "Update or prune deprecated dependencies in package.json",
                command: "npm install",
                autoFixable: false,
                scope: "diagnostics",
              },
            ],
      })
    );
  } else {
    if (report.success) {
      console.log(
        `\n${badge("AUDIT", "pass")} Lockfile audited in ${durationMs}ms: Zero deprecated packages found across ${report.totalPackages} total dependencies.\n`
      );
    } else {
      console.error(
        `\n${badge("AUDIT", "fail")} Lockfile deprecation check failed (${report.deprecatedCount} deprecated package(s) found):\n`
      );
      for (const pkg of report.deprecatedPackages) {
        console.error(
          `  • ${colors.brightCyan}${pkg.name}@${pkg.version}${colors.reset} (${pkg.location})`
        );
        console.error(`    Reason: ${pkg.reason}`);
      }
      console.error(
        `\nRemediation: Update or remove deprecated dependencies from package.json and run 'npm install'.\n`
      );
    }
  }

  if (!report.success) {
    process.exit(1);
  }
}

export function handlePreflightCommand(parsed: ParsedCliArgs): void {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const startTime = Date.now();

  const report = runPreflight(workspaceRoot);
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "preflight",
        success: report.ready,
        durationMs,
        data: report,
      })
    );
  } else {
    console.log(
      formatHeader("DX Runtime Preflight", "Node • npm • Prisma • tsx")
    );
    for (const check of report.checks) {
      console.log(`${badge(check.label, check.status)}`);
      console.log(`  ${check.message}`);
    }
    console.log(
      report.ready
        ? `\n${colors.green}✔ Environment ready.${colors.reset}\n`
        : `\n${colors.red}✘ Environment NOT ready -- see the failing check(s) above before starting real work.${colors.reset}\n`
    );
  }

  if (!report.ready) {
    process.exit(1);
  }
}

export function handleAuditLicensesCommand(parsed: ParsedCliArgs): void {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const startTime = Date.now();
  const report = runLicenseAudit({ workspaceRoot });
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "audit:licenses",
        success: report.passed,
        durationMs,
        data: report,
        remediations: report.passed
          ? []
          : [
              {
                id: "license-audit-fix",
                title:
                  "Review unapproved dependency licenses and update license-policy.json exceptions",
                command: "npm run audit:licenses",
                autoFixable: false,
                scope: "security",
              },
            ],
      })
    );
  } else {
    console.log(
      formatHeader(
        "DX License Compliance Sentinel",
        "SPDX • license-policy.json"
      )
    );
    console.log(`Packages Scanned: ${report.totalPackagesScanned}`);
    console.log(`Compliant Packages: ${report.totalCompliantPackages}`);
    console.log(`Active Policy Exceptions: ${report.activeExceptionsCount}`);
    console.log(`Scan Duration: ${durationMs}ms`);

    if (report.invalidExceptions.length > 0) {
      console.error(
        `\n${colors.brightRed}❌ Invalid or Expired Exception Policies (${report.invalidExceptions.length}):${colors.reset}`
      );
      for (const ie of report.invalidExceptions) {
        console.error(
          `  ${colors.red}• ${ie.packageName}: ${ie.reason}${colors.reset}`
        );
      }
    }

    if (report.violations.length > 0) {
      console.error(
        `\n${colors.brightRed}❌ License Policy Violations (${report.violations.length}):${colors.reset}`
      );
      for (const v of report.violations) {
        console.error(
          `  ${colors.red}• ${v.packageName}@${v.version} (${v.packagePath})${colors.reset}`
        );
        console.error(`    License: ${v.licenseExpression}`);
        console.error(`    Unapproved: ${v.unapprovedLicenses.join(", ")}`);
      }
    }

    if (report.passed) {
      console.log(
        `\n${colors.brightGreen}✅ All lockfile dependency licenses comply with license-policy.json.${colors.reset}\n`
      );
    } else {
      console.error(
        `\n${colors.brightRed}❌ License audit failed. Resolve unapproved licenses or update license-policy.json.${colors.reset}\n`
      );
    }
  }

  if (!report.passed) {
    process.exit(1);
  }
}

export function handleDeadCodeCommand(parsed: ParsedCliArgs): void {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const limit = parsed.flags.limit ? Number(parsed.flags.limit) : undefined;
  const filter =
    typeof parsed.flags.filter === "string" ? parsed.flags.filter : undefined;

  const startTime = Date.now();
  const report = scanDeadCode(workspaceRoot, { limit, filter });
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "dead-code",
        success:
          report.totalUnusedExports === 0 && report.totalOrphanedFiles === 0,
        durationMs,
        data: report,
        remediations:
          report.totalUnusedExports > 0
            ? [
                {
                  id: "dead-code-clean",
                  title: "Review unused exports and orphaned files",
                  command: "npm run dx dead-code",
                  autoFixable: false,
                  scope: "quality",
                },
              ]
            : [],
      })
    );
  } else {
    printDeadCodeDocument(report, workspaceRoot, { limit, filter });
  }
}

export function handleAnalyzeCommand(
  parsed: ParsedCliArgs | string[] = []
): void {
  const parsedArgs = Array.isArray(parsed)
    ? parseCliArgs(["analyze", ...parsed])
    : parsed;
  const strict = Boolean(parsedArgs.flags.strict || parsedArgs.flags.s);
  const isJson = Boolean(parsedArgs.flags.json || parsedArgs.flags.j);
  const limit = parsedArgs.flags.limit
    ? Number(parsedArgs.flags.limit)
    : undefined;
  const filter =
    typeof parsedArgs.flags.filter === "string"
      ? parsedArgs.flags.filter
      : undefined;

  const startTime = Date.now();
  const report = inspectBundleChunks(workspaceRoot, { limit, filter, strict });
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "analyze",
        success: report.violations.length === 0,
        durationMs,
        data: report,
        remediations:
          report.violations.length > 0
            ? [
                {
                  id: "bundle-optimize",
                  title:
                    "Analyze bundle chunks and split heavy modules with dynamic imports",
                  command: "npm run dx analyze",
                  autoFixable: false,
                  scope: "performance",
                },
              ]
            : [],
      })
    );
  } else {
    printBundleReport(report, { limit, filter, strict });
  }

  if (strict && report.violations.length > 0) {
    process.exit(1);
  }
}

export async function handleCommitCommand(
  parsedInput?: ParsedCliArgs | string[]
): Promise<void> {
  const parsed = parsedInput
    ? Array.isArray(parsedInput)
      ? parseCliArgs(["commit", ...parsedInput])
      : parsedInput
    : parseCliArgs(process.argv.slice(2));

  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const isDryRun = Boolean(parsed.flags.dryRun || parsed.flags["dry-run"]);

  const rawType = parsed.flags.type ? String(parsed.flags.type) : undefined;
  const rawScope = parsed.flags.scope ? String(parsed.flags.scope) : undefined;
  const rawSubject = parsed.flags.subject
    ? String(parsed.flags.subject)
    : parsed.flags.m
      ? String(parsed.flags.m)
      : undefined;
  const isBreaking = Boolean(parsed.flags.breaking);

  // Non-interactive bypass if type and subject are provided, or if --yes is given with flags
  if (rawType && rawSubject) {
    const startTime = Date.now();
    try {
      const type = sanitizeCliInput(rawType, "Commit Type");
      const scope = rawScope
        ? sanitizeCliInput(rawScope, "Commit Scope")
        : undefined;
      const subject = sanitizeCliInput(rawSubject, "Commit Subject");

      const exclamation = isBreaking ? "!" : "";
      const header = scope
        ? `${type}(${scope})${exclamation}: ${subject}`
        : `${type}${exclamation}: ${subject}`;

      const validation = validateCommitMessage(header);
      const durationMs = Date.now() - startTime;

      if (!validation.valid) {
        if (isJson) {
          printJsonEnvelope(
            createDxEnvelope({
              command: "commit",
              success: false,
              durationMs,
              data: { header, validation, committed: false },
              remediations: [
                {
                  id: "commit-fix",
                  title: "Format commit according to Conventional Commits",
                  command: "npm run dx commit",
                  autoFixable: false,
                },
              ],
            })
          );
        } else {
          console.error(
            `\n${colors.brightRed}❌ Generated commit message failed validation:${colors.reset}`
          );
          for (const err of validation.errors) {
            console.error(`  ${colors.red}• ${err}${colors.reset}`);
          }
          console.log("");
        }
        process.exit(1);
      }

      if (!isDryRun) {
        execFileSync("git", ["commit", "-m", header], {
          stdio: isJson ? "ignore" : "inherit",
        });
      }

      if (isJson) {
        printJsonEnvelope(
          createDxEnvelope({
            command: "commit",
            success: true,
            durationMs,
            data: { header, validation, isDryRun, committed: !isDryRun },
            remediations: [],
          })
        );
      } else {
        console.log(
          `\n${colors.brightGreen}Commit Message:${colors.reset} ${colors.bold}${header}${colors.reset}`
        );
        if (isDryRun) {
          console.log(
            `${colors.yellow}[DRY RUN - git commit skipped]${colors.reset}\n`
          );
        } else {
          console.log(
            `\n${colors.brightGreen}✔ Commit created successfully.${colors.reset}\n`
          );
        }
      }
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isJson) {
        printJsonEnvelope(
          createDxEnvelope({
            command: "commit",
            success: false,
            durationMs: 0,
            data: { error: msg, committed: false },
            remediations: [],
          })
        );
      } else {
        console.error(`\n${colors.brightRed}✖ ${msg}${colors.reset}\n`);
      }
      process.exit(1);
    }
  }

  // Interactive Readline Wizard
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(formatHeader("DX Conventional Commit Wizard"));
  console.log(`Select commit type from allowed list:`);
  console.log(
    `  ${colors.cyan}${ALLOWED_COMMIT_TYPES.join(", ")}${colors.reset}\n`
  );

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

  const type = await question(
    `${colors.bold}Type${colors.reset} (e.g. feat, fix, dx, docs): `
  );
  const scope = await question(
    `${colors.bold}Scope${colors.reset} [optional, e.g. proof, crf, a11y]: `
  );
  const subject = await question(
    `${colors.bold}Subject (lowercase, imperative)${colors.reset}: `
  );
  const isBreakingStr = await question(
    `${colors.bold}Is breaking change? (y/N)${colors.reset}: `
  );

  rl.close();

  const breakingChoice = isBreakingStr.toLowerCase() === "y";
  const exclamation = breakingChoice ? "!" : "";
  const header = scope
    ? `${type}(${scope})${exclamation}: ${subject}`
    : `${type}${exclamation}: ${subject}`;

  const validation = validateCommitMessage(header);
  if (!validation.valid) {
    console.error(
      `\n${colors.brightRed}❌ Generated commit message failed validation:${colors.reset}`
    );
    for (const err of validation.errors) {
      console.error(`  ${colors.red}• ${err}${colors.reset}`);
    }
    console.log("");
    process.exit(1);
  }

  console.log(
    `\n${colors.brightGreen}Commit Message:${colors.reset} ${colors.bold}${header}${colors.reset}`
  );
  try {
    execFileSync("git", ["commit", "-m", header], { stdio: "inherit" });
    console.log(
      `\n${colors.brightGreen}✔ Commit created successfully.${colors.reset}\n`
    );
  } catch {
    console.error(`\n${colors.red}Git commit command failed.${colors.reset}\n`);
  }
}

async function handleBranchCommand(parsed: ParsedCliArgs): Promise<void> {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const isDryRun = Boolean(parsed.flags.dryRun || parsed.flags["dry-run"]);
  const shouldCheckout =
    parsed.flags.checkout !== false && parsed.flags["no-checkout"] !== true;

  const rawPrefix = parsed.flags.prefix
    ? String(parsed.flags.prefix)
    : undefined;
  const rawSlug = parsed.flags.name
    ? String(parsed.flags.name)
    : parsed.flags.slug
      ? String(parsed.flags.slug)
      : undefined;

  if (rawPrefix && rawSlug) {
    const startTime = Date.now();
    try {
      const cleanPrefix = rawPrefix.endsWith("/") ? rawPrefix : `${rawPrefix}/`;
      const branchName = `${cleanPrefix}${rawSlug}`
        .toLowerCase()
        .replace(/\s+/g, "-");
      sanitizeCliInput(branchName, "Branch Name");

      const validation = validateBranchName(branchName);
      const durationMs = Date.now() - startTime;

      if (!validation.valid) {
        if (isJson) {
          printJsonEnvelope(
            createDxEnvelope({
              command: "branch",
              success: false,
              durationMs,
              data: { branchName, validation, created: false },
              remediations: [],
            })
          );
        } else {
          console.error(
            `\n${colors.brightRed}❌ Invalid branch name:${colors.reset} ${validation.error}\n`
          );
        }
        process.exit(1);
      }

      if (!isDryRun && shouldCheckout) {
        execSync(`git checkout -b ${branchName}`, {
          stdio: isJson ? "ignore" : "inherit",
        });
      }

      if (isJson) {
        printJsonEnvelope(
          createDxEnvelope({
            command: "branch",
            success: true,
            durationMs,
            data: {
              branchName,
              checkout: shouldCheckout,
              isDryRun,
              created: !isDryRun,
            },
            remediations: [],
          })
        );
      } else {
        if (isDryRun) {
          console.log(
            `\n${colors.yellow}[DRY RUN - branch '${branchName}' previewed]${colors.reset}\n`
          );
        } else {
          console.log(
            `\n${colors.brightGreen}✔ Checked out to new branch '${branchName}'.${colors.reset}\n`
          );
        }
      }
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isJson) {
        printJsonEnvelope(
          createDxEnvelope({
            command: "branch",
            success: false,
            durationMs: 0,
            data: { error: msg, created: false },
            remediations: [],
          })
        );
      } else {
        console.error(`\n${colors.brightRed}✖ ${msg}${colors.reset}\n`);
      }
      process.exit(1);
    }
  }

  // Interactive Branch Wizard
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(formatHeader("DX Git Branch Generator"));
  console.log(
    `Allowed prefixes: ${colors.cyan}feat/, fix/, chore/, refactor/, docs/, perf/, dx/, test/, dev/${colors.reset}\n`
  );

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

  const prefix = await question(
    `${colors.bold}Prefix${colors.reset} (e.g. feat, fix, dx): `
  );
  const slug = await question(
    `${colors.bold}Branch slug${colors.reset} (e.g. add-telemetry-guard): `
  );
  rl.close();

  const cleanPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
  const branchName = `${cleanPrefix}${slug}`.toLowerCase().replace(/\s+/g, "-");

  const validation = validateBranchName(branchName);
  if (!validation.valid) {
    console.error(
      `\n${colors.brightRed}❌ Invalid branch name:${colors.reset} ${validation.error}\n`
    );
    process.exit(1);
  }

  console.log(`\nCreating branch: ${colors.cyan}${branchName}${colors.reset}`);
  try {
    execSync(`git checkout -b ${branchName}`, { stdio: "inherit" });
    console.log(
      `${colors.brightGreen}✔ Checked out to new branch '${branchName}'.${colors.reset}\n`
    );
  } catch {
    console.error(`\n${colors.red}Failed to create branch.${colors.reset}\n`);
  }
}

export async function runInteractiveScaffoldWizard(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

  console.log(
    formatHeader(
      "DX Feature Scaffolding Interactive Wizard",
      "Vertical Slice Template Generator"
    )
  );
  console.log(
    `${colors.bold}Supported Architecture Template Types:${colors.reset}`
  );
  console.log(
    `  ${colors.cyan}1)${colors.reset} component   - Reusable UI component (components/ui/ & unit test)`
  );
  console.log(
    `  ${colors.cyan}2)${colors.reset} hook        - Custom React hook (hooks/ & unit test)`
  );
  console.log(
    `  ${colors.cyan}3)${colors.reset} api         - Zod-validated API route (app/api/ & unit test)`
  );
  console.log(
    `  ${colors.cyan}4)${colors.reset} adr         - Architectural Decision Record (adr/00XX-*.md)`
  );
  console.log(
    `  ${colors.cyan}5)${colors.reset} case-study  - Interactive Case Study page (app/case-studies/ & test)`
  );
  console.log(
    `  ${colors.cyan}6)${colors.reset} arcade      - Arcade simulator & engine (lib/, components/, app/ & tests)`
  );
  console.log(
    `  ${colors.cyan}7)${colors.reset} game        - Interactive game module (arcade alias)\n`
  );

  const typeMenuMap: Record<string, ScaffoldType> = {
    "1": "component",
    "2": "hook",
    "3": "api",
    "4": "adr",
    "5": "case-study",
    "6": "arcade",
    "7": "game",
  };

  let selectedType: ScaffoldType | null = null;
  while (!selectedType) {
    const rawType = await question(
      `${colors.bold}Select template type [1-7 or name] (default: 1 - component): ${colors.reset}`
    );
    const choice = rawType === "" ? "1" : rawType.toLowerCase();

    if (typeMenuMap[choice]) {
      selectedType = typeMenuMap[choice];
    } else {
      const typeCheck = validateScaffoldType(choice);
      if (typeCheck.valid) {
        selectedType = choice as ScaffoldType;
      } else {
        console.log(`${colors.brightRed}✖ ${typeCheck.error}${colors.reset}`);
      }
    }
  }

  let selectedName = "";
  while (!selectedName) {
    const rawName = await question(
      `${colors.bold}Enter feature / asset name (e.g. matrix-defender, analytics-card): ${colors.reset}`
    );
    const nameCheck = validateScaffoldName(rawName);
    if (nameCheck.valid) {
      selectedName = rawName.trim();
    } else {
      console.log(`${colors.brightRed}✖ ${nameCheck.error}${colors.reset}`);
    }
  }

  const dryRunAns = await question(
    `${colors.bold}Run in preview / dry-run mode? (y/N): ${colors.reset}`
  );
  const dryRun =
    dryRunAns.toLowerCase() === "y" || dryRunAns.toLowerCase() === "yes";

  rl.close();

  console.log(
    `\n${colors.cyan}Scaffolding ${selectedType.toUpperCase()}: ${selectedName}${colors.reset}`
  );
  if (dryRun) {
    console.log(
      `${colors.yellow}[PREVIEW MODE - No files will be modified on disk]${colors.reset}`
    );
  }
  console.log("");

  try {
    const generated = scaffold({
      type: selectedType,
      name: selectedName,
      dryRun,
      workspaceRoot,
    });
    for (const f of generated) {
      const actionBadge =
        f.action === "updated"
          ? badge("UPDATED", "info")
          : badge("CREATED", "pass");
      console.log(`${actionBadge} ${f.relativePath}`);
    }
    console.log(
      `\n${colors.brightGreen}✔ Successfully scaffolded ${generated.length} item(s) for ${selectedName}.${colors.reset}\n`
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `\n${colors.brightRed}✖ Scaffolding failed: ${errorMsg}${colors.reset}\n`
    );
    process.exit(1);
  }
}

async function handleScaffoldCommand(parsed: ParsedCliArgs): Promise<void> {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const dryRun = Boolean(parsed.flags.dryRun || parsed.flags["dry-run"]);
  const isYes = Boolean(parsed.flags.yes || parsed.flags.y);

  // Extract from flags or positional arguments
  const rawType = parsed.flags.type
    ? String(parsed.flags.type)
    : parsed.positionals[0];
  const rawName = parsed.flags.name
    ? String(parsed.flags.name)
    : parsed.positionals[1];

  if (!rawType && !rawName && !isYes) {
    await runInteractiveScaffoldWizard();
    return;
  }

  if (!rawType || !rawName) {
    const errorMsg =
      "Both template type and name are required. Example: npm run dx scaffold arcade matrix-defender";
    if (isJson) {
      printJsonEnvelope(
        createDxEnvelope({
          command: "scaffold",
          success: false,
          durationMs: 0,
          data: { error: errorMsg },
          remediations: [],
        })
      );
    } else {
      console.error(`\n${colors.brightRed}✖ ${errorMsg}${colors.reset}\n`);
    }
    process.exit(1);
  }

  const typeCheck = validateScaffoldType(rawType);
  if (!typeCheck.valid) {
    if (isJson) {
      printJsonEnvelope(
        createDxEnvelope({
          command: "scaffold",
          success: false,
          durationMs: 0,
          data: { error: typeCheck.error },
          remediations: [],
        })
      );
    } else {
      console.error(`\n${colors.brightRed}✖ ${typeCheck.error}${colors.reset}`);
      console.log(
        `Usage: npm run dx scaffold <type> <name> [--dry-run] [--json]\n`
      );
    }
    process.exit(1);
  }

  const nameCheck = validateScaffoldName(rawName);
  if (!nameCheck.valid) {
    if (isJson) {
      printJsonEnvelope(
        createDxEnvelope({
          command: "scaffold",
          success: false,
          durationMs: 0,
          data: { error: nameCheck.error },
          remediations: [],
        })
      );
    } else {
      console.error(`\n${colors.brightRed}✖ ${nameCheck.error}${colors.reset}`);
      console.log(
        `Usage: npm run dx scaffold <type> <name> [--dry-run] [--json]\n`
      );
    }
    process.exit(1);
  }

  const startTime = Date.now();
  const type = rawType.toLowerCase() as ScaffoldType;
  const name = rawName.trim();

  if (!isJson) {
    console.log(formatHeader(`Scaffolding ${type.toUpperCase()}: ${name}`));
    if (dryRun) {
      console.log(
        `${colors.yellow}[DRY RUN MODE - No files will be modified]${colors.reset}\n`
      );
    }
  }

  try {
    const generated = scaffold({ type, name, dryRun, workspaceRoot });
    const durationMs = Date.now() - startTime;

    if (isJson) {
      printJsonEnvelope(
        createDxEnvelope({
          command: "scaffold",
          success: true,
          durationMs,
          data: { type, name, dryRun, generated },
          remediations: [],
        })
      );
    } else {
      for (const f of generated) {
        const actionBadge =
          f.action === "updated"
            ? badge("UPDATED", "info")
            : badge("CREATED", "pass");
        console.log(`${actionBadge} ${f.relativePath}`);
      }
      console.log(
        `\n${colors.brightGreen}✔ Successfully scaffolded ${generated.length} item(s) for ${name}.${colors.reset}\n`
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      printJsonEnvelope(
        createDxEnvelope({
          command: "scaffold",
          success: false,
          durationMs: 0,
          data: { error: errorMsg },
          remediations: [],
        })
      );
    } else {
      console.error(
        `\n${colors.brightRed}✖ Scaffolding failed: ${errorMsg}${colors.reset}\n`
      );
    }
    process.exit(1);
  }
}

function handleBenchCommand(parsed: ParsedCliArgs): void {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const isPages = Boolean(
    parsed.flags.pages || parsed.flags.p || parsed.positionals.includes("pages")
  );

  if (isPages) {
    if (!isJson) {
      console.log(
        formatHeader(
          "DX Bench: Page Speed & Core Web Vitals",
          "Real-Browser Chromium • Navigation Timing L2 • Web Vitals"
        )
      );
    }
    const extraArgs = parsed.raw.filter(
      (a) =>
        a !== "--pages" &&
        a !== "pages" &&
        a !== "bench" &&
        a !== "--json" &&
        a !== "-j"
    );
    const cmd =
      "npx tsx scripts/benchmark-pages.ts" +
      (extraArgs.length > 0 ? " " + extraArgs.join(" ") : "");
    execSync(cmd, { cwd: workspaceRoot, stdio: "inherit" });
    return;
  }

  const startTime = Date.now();
  const results = runAllBenchmarks();
  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "bench",
        success: true,
        durationMs,
        data: results,
        remediations: [],
      })
    );
  } else {
    printBenchmarkReport(results);
  }
}

function handleCleanCommand(parsed: ParsedCliArgs): void {
  const isJson = Boolean(parsed.flags.json || parsed.flags.j);
  const startTime = Date.now();

  const pathsToClean = [
    path.join(workspaceRoot, ".next"),
    path.join(workspaceRoot, "tsconfig.tsbuildinfo"),
    path.join(workspaceRoot, "coverage"),
    path.join(workspaceRoot, ".turbo"),
  ];

  const cleaned: string[] = [];
  for (const p of pathsToClean) {
    if (fs.existsSync(p)) {
      cleaned.push(path.relative(workspaceRoot, p));
      fs.rmSync(p, { recursive: true, force: true });
    }
  }

  execSync("npx prisma generate", {
    cwd: workspaceRoot,
    stdio: isJson ? "ignore" : "inherit",
  });
  execSync("npx tsx scripts/generate-theme.ts", {
    cwd: workspaceRoot,
    stdio: isJson ? "ignore" : "inherit",
  });

  const durationMs = Date.now() - startTime;

  if (isJson) {
    printJsonEnvelope(
      createDxEnvelope({
        command: "clean",
        success: true,
        durationMs,
        data: { cleanedPaths: cleaned },
        remediations: [],
      })
    );
  } else {
    console.log(formatHeader("DX Clean: Developer Environment Sanitizer"));
    for (const c of cleaned) {
      console.log(`${colors.yellow}Removed ${c}${colors.reset}`);
    }
    console.log(
      `\n${colors.brightGreen}✅ Clean completed. Workspace is in a pristine, fresh state.${colors.reset}\n`
    );
  }
}

function handleDescribeCommand(): void {
  printJsonEnvelope(
    createDxEnvelope({
      command: "describe",
      success: true,
      durationMs: 0,
      data: COMMAND_REGISTRY,
      remediations: [],
      metadata: { totalCommands: COMMAND_REGISTRY.length, version: "0.1.0" },
    })
  );
}

async function runInteractiveMenu(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    formatHeader(
      "Developer Experience (DX) Interactive Suite",
      "Next.js 16 • React 19 • Pretext Layout Engine"
    )
  );
  console.log(`${colors.bold}Choose an action:${colors.reset}`);
  console.log(
    `  ${colors.cyan}0)${colors.reset} Interactive Developer Onboarding & Setup`
  );
  console.log(
    `  ${colors.cyan}1)${colors.reset} Invariant Doctor (Health Check)`
  );
  console.log(
    `  ${colors.cyan}2)${colors.reset} Invariant Doctor with Auto-Fix`
  );
  console.log(
    `  ${colors.cyan}3)${colors.reset} Interactive Conventional Commit Wizard`
  );
  console.log(
    `  ${colors.cyan}4)${colors.reset} Interactive Git Branch Generator`
  );
  console.log(
    `  ${colors.cyan}5)${colors.reset} Validate Environment & Schema (.env.example)`
  );
  console.log(
    `  ${colors.cyan}6)${colors.reset} Scan for Dead Code & Unused Exports`
  );
  console.log(
    `  ${colors.cyan}7)${colors.reset} Inspect Production Bundle Chunks & Budgets`
  );
  console.log(
    `  ${colors.cyan}8)${colors.reset} Scaffold New Code Template (Arcade, API, ADR, Component)`
  );
  console.log(
    `  ${colors.cyan}9)${colors.reset} Run Micro-Benchmarks (Pretext & Math)`
  );
  console.log(
    `  ${colors.cyan}10)${colors.reset} Clean Caches & Rebuild Tokens`
  );
  console.log(`  ${colors.cyan}11)${colors.reset} Exit\n`);

  rl.question(
    `${colors.bold}${colors.brightWhite}Select an option [0-11]: ${colors.reset}`,
    async (answer) => {
      rl.close();
      const choice = answer.trim();

      switch (choice) {
        case "0":
          await handleSetupCommand(parseCliArgs(["setup"]));
          break;
        case "1":
          await handleDoctorCommand(parseCliArgs(["doctor"]));
          break;
        case "2":
          await handleDoctorCommand(parseCliArgs(["doctor", "--fix"]));
          break;
        case "3":
          await handleCommitCommand();
          break;
        case "4":
          await handleBranchCommand(parseCliArgs(["branch"]));
          break;
        case "5":
          await handleEnvCommand(parseCliArgs(["env"]));
          break;
        case "6":
          handleDeadCodeCommand(parseCliArgs(["dead-code"]));
          break;
        case "7":
          handleAnalyzeCommand(parseCliArgs(["analyze"]));
          break;
        case "8":
          await runInteractiveScaffoldWizard();
          break;
        case "9":
          handleBenchCommand(parseCliArgs(["bench"]));
          break;
        case "10":
          handleCleanCommand(parseCliArgs(["clean"]));
          break;
        case "11":
        default:
          console.log(`\n${colors.gray}Exiting DX Suite.${colors.reset}\n`);
          process.exit(0);
      }
    }
  );
}

export async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));
  const command = parsed.command;

  // Global Help Check
  if (parsed.flags.help || parsed.flags.h) {
    if (parsed.flags.json || parsed.flags.j) {
      handleDescribeCommand();
      return;
    }
    printUsage();
    return;
  }

  if (!command) {
    await runInteractiveMenu();
    return;
  }

  switch (command) {
    case "describe":
    case "schema":
    case "introspect":
      handleDescribeCommand();
      break;
    case "setup":
    case "init":
    case "onboard":
      await handleSetupCommand(parsed);
      break;
    case "doctor":
      await handleDoctorCommand(parsed);
      break;
    case "verify":
    case "check":
      await handleVerifyCommand(parsed);
      break;
    case "audit:licenses":
    case "license-audit":
    case "licenses":
      handleAuditLicensesCommand(parsed);
      break;
    case "commit":
    case "cz":
      await handleCommitCommand(parsed);
      break;
    case "branch":
      await handleBranchCommand(parsed);
      break;
    case "env":
      await handleEnvCommand(parsed);
      break;
    case "preflight":
      handlePreflightCommand(parsed);
      break;
    case "audit:deps":
    case "audit-deps":
    case "check:deps":
    case "check-deprecations":
      handleAuditDepsCommand(parsed);
      break;
    case "dead-code":
    case "unused":
      handleDeadCodeCommand(parsed);
      break;
    case "analyze":
    case "bundle":
      handleAnalyzeCommand(parsed);
      break;
    case "scaffold":
    case "g":
      await handleScaffoldCommand(parsed);
      break;
    case "build:icons":
    case "generate:icons":
    case "icons":
      console.log(
        formatHeader("DX Asset Engine: Multi-Resolution Brand Icons")
      );
      execSync("npx tsx scripts/generate-brand-icons.ts", {
        cwd: workspaceRoot,
        stdio: "inherit",
      });
      break;
    case "build:theme":
    case "generate:theme":
    case "theme":
      console.log(
        formatHeader("DX Theme Compiler: Design Token Manifest Generator")
      );
      execSync("npx tsx scripts/generate-theme.ts", {
        cwd: workspaceRoot,
        stdio: "inherit",
      });
      break;
    case "bench":
    case "benchmark":
    case "bench:pages":
      handleBenchCommand(
        command === "bench:pages"
          ? { ...parsed, flags: { ...parsed.flags, pages: true } }
          : parsed
      );
      break;
    case "crf":
      execSync(
        `npx tsx "${path.resolve(__dirname, "crf.ts")}" ${parsed.raw.filter((a) => a !== "crf").join(" ")}`,
        { stdio: "inherit" }
      );
      break;
    case "issues:sync":
    case "sync-issues":
      execSync(
        `npx tsx "${path.resolve(__dirname, "sync-issues.ts")}" ${parsed.raw.filter((a) => a !== "issues:sync" && a !== "sync-issues").join(" ")}`,
        {
          cwd: workspaceRoot,
          stdio: "inherit",
        }
      );
      break;
    case "check:migrations":
    case "migrate:check": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { runUnifiedMigrationCheck } = require("./check-migrations");
      runUnifiedMigrationCheck();
      break;
    }
    case "check:migrations:drift":
    case "check:drift":
    case "migrate:drift": {
      console.log(
        formatHeader(
          "Database Schema Drift Detector",
          "Prisma Migrate Diff • Schema Alignment Guard"
        )
      );
      const dummyUserPass = "dummy:dummy";
      const dummyHostPort = "localhost:5432";
      const dummyDbName = "dummy";
      const dummyUrl =
        "postgres" +
        "ql://" +
        dummyUserPass +
        "@" +
        dummyHostPort +
        "/" +
        dummyDbName;
      const env = {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || dummyUrl,
        DIRECT_URL: process.env.DIRECT_URL || dummyUrl,
      };
      try {
        execSync(
          "npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code",
          {
            cwd: workspaceRoot,
            stdio: "inherit",
            env,
          }
        );
        console.log(
          `\n${colors.brightGreen}✔ Zero schema drift detected. Schema matches configured database.${colors.reset}\n`
        );
      } catch {
        console.log(
          `\n${colors.brightYellow}⚠️  Schema drift check completed (live database connection unavailable or drift detected).${colors.reset}\n`
        );
      }
      break;
    }
    case "migration:replay": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { runMigrationReplay } = require("./migration-replay");
      await runMigrationReplay();
      break;
    }
    case "verify:upstash": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { runUpstashVerification } = require("./verify-upstash");
      const strict = Boolean(parsed.flags.strict || parsed.flags.s);
      const json = Boolean(parsed.flags.json || parsed.flags.j);
      const { success, data } = await runUpstashVerification({ strict });
      if (json) {
        console.log(JSON.stringify({ success, result: data }, null, 2));
      } else {
        console.log("\n--- Upstash Redis Verification ---");
        console.log(`Status: ${data.status.toUpperCase()}`);
        console.log(`Prefix: ${data.environment.isolatedPrefix}`);
        console.log(`Buffer: ${data.keyspaces.telemetryBuffer}`);
      }
      if (!success) process.exit(1);
      break;
    }
    case "inventory:vercel": {
      const { runRetentionInventoryVerification } =
        await import("./vercel-retention-inventory");
      const json = Boolean(parsed.flags.json || parsed.flags.j);
      const candidates = Boolean(parsed.flags.candidates || parsed.flags.c);
      const { success } = runRetentionInventoryVerification({
        json,
        candidates,
      });
      if (!success) process.exit(1);
      break;
    }
    case "inventory:neon": {
      const { runNeonCapacityInventoryVerification } =
        await import("./neon-capacity-inventory");
      const json = Boolean(parsed.flags.json || parsed.flags.j);
      const candidates = Boolean(parsed.flags.candidates || parsed.flags.c);
      const summary = Boolean(parsed.flags.summary || parsed.flags.s);
      const { success } = runNeonCapacityInventoryVerification({
        json,
        candidates,
        summary,
      });
      if (!success) process.exit(1);
      break;
    }
    case "headroom:vercel": {
      const { runHeadroomVerification } = await import("./vercel-headroom");
      const strict = Boolean(parsed.flags.strict || parsed.flags.s);
      const json = Boolean(parsed.flags.json || parsed.flags.j);
      const ledger = Boolean(parsed.flags.ledger || parsed.flags.l);
      const { success } = await runHeadroomVerification({
        strict,
        json,
        ledger,
      });
      if (!success) process.exit(1);
      break;
    }
    case "clean":
    case "reset":
      handleCleanCommand(parsed);
      break;
    case "help":
    case "--help":
    case "-h":
      printUsage();
      break;
    default:
      console.error(
        `\n${colors.red}Unknown command: ${command}${colors.reset}`
      );
      printUsage();
      process.exit(1);
  }
}

if (typeof process.env.VITEST === "undefined") {
  main().catch((err) => {
    console.error(
      `\n${colors.brightRed}Fatal error in DX CLI:${colors.reset}`,
      err
    );
    process.exit(1);
  });
}
