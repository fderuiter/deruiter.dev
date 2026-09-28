#!/usr/bin/env node
/**
 * Stryker Mutation Testing Gateway Runner
 * Executes Stryker mutation testing with scope flag support (--scope=core|full|staged).
 */

import { execFileSync, execSync } from "child_process";
import path from "path";

const workspaceRoot = path.resolve(__dirname, "..");
const strykerCli = path.resolve(
  workspaceRoot,
  "node_modules/@stryker-mutator/core/bin/stryker.js"
);

export type MutationScope = "core" | "full" | "staged";

export const CORE_TARGETS = [
  "lib/proof-utils.ts",
  "lib/trial-and-error/**",
  "!lib/trial-and-error/index.ts",
  "!lib/trial-and-error/types.ts",
  "lib/security.ts",
  "lib/error-sanitization.ts",
  "lib/masonry.ts",
  "lib/pretext-block-parser.ts",
  "lib/content-sanitizer.ts",
];

export const FULL_TARGETS = [
  ...CORE_TARGETS,
  "lib/garmin-engine.ts",
  "lib/working-with-duck-engine.ts",
  "lib/crf/**",
  "!lib/crf/index.ts",
  "!lib/crf/types.ts",
  "lib/dungeon/**",
  "!lib/dungeon/index.ts",
  "!lib/dungeon/types.ts",
  "lib/laser-loon/**",
  "!lib/laser-loon/index.ts",
  "!lib/laser-loon/types.ts",
  "lib/quasi-perfect/**",
  "!lib/quasi-perfect/index.ts",
  "!lib/quasi-perfect/types.ts",
  "lib/retro-labyrinth/**",
  "!lib/retro-labyrinth/index.ts",
  "!lib/retro-labyrinth/types.ts",
  "lib/neuro/**",
  "!lib/neuro/index.ts",
  "!lib/neuro/types.ts",
  "lib/patrol/**",
  "!lib/patrol/index.ts",
  "!lib/patrol/types.ts",
  "lib/clinical-trial-chaos/**",
  "!lib/clinical-trial-chaos/index.ts",
  "!lib/clinical-trial-chaos/types.ts",
  "lib/term-compiler.ts",
  "lib/search-utils.ts",
  "lib/accessibility-utils.ts",
];

export function parseScope(
  args: string[] = process.argv.slice(2)
): MutationScope {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--scope=")) {
      const scope = arg.split("=")[1].toLowerCase();
      if (scope === "core" || scope === "full" || scope === "staged") {
        return scope as MutationScope;
      }
    } else if (arg === "--scope" && i + 1 < args.length) {
      const scope = args[i + 1].toLowerCase();
      if (scope === "core" || scope === "full" || scope === "staged") {
        return scope as MutationScope;
      }
    }
  }
  return "core";
}

export function getStagedTargets(): string[] {
  try {
    const gitOutput =
      execSync("git diff --cached --name-only -- lib/", {
        cwd: workspaceRoot,
        encoding: "utf8",
      }) +
      "\n" +
      execSync("git diff HEAD --name-only -- lib/", {
        cwd: workspaceRoot,
        encoding: "utf8",
      });

    const stagedFiles = Array.from(
      new Set(
        gitOutput
          .split("\n")
          .map((f) => f.trim())
          .filter(
            (f) =>
              f.startsWith("lib/") &&
              (f.endsWith(".ts") || f.endsWith(".tsx")) &&
              !f.endsWith("/index.ts") &&
              !f.endsWith("/types.ts") &&
              !f.endsWith("-types.ts") &&
              !f.endsWith(".d.ts")
          )
      )
    );

    if (stagedFiles.length > 0) {
      return stagedFiles;
    }
  } catch (_e) {
    // Ignore git errors
  }
  console.log(
    "ℹ️ No staged domain files found in lib/. Defaulting to core scope."
  );
  return CORE_TARGETS;
}

export function resolveTargetsForScope(scope: MutationScope): string[] {
  switch (scope) {
    case "full":
      return FULL_TARGETS;
    case "staged":
      return getStagedTargets();
    case "core":
    default:
      return CORE_TARGETS;
  }
}

export function runMutationGate(argsOverride?: string[]): void {
  const scope = parseScope(argsOverride);
  const targets = resolveTargetsForScope(scope);

  console.log(
    `\n🧬 Executing Stryker Mutation Testing Gate (Scope: ${scope})...`
  );
  console.log(`🎯 Targets: ${targets.join(", ")}\n`);

  const strykerArgs = ["run"];
  for (const target of targets) {
    strykerArgs.push("--mutate", target);
  }

  try {
    execFileSync(process.execPath, [strykerCli, ...strykerArgs], {
      cwd: workspaceRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        VITE_CONFIG_NATIVE_IGNORE_WARNING: "1",
      },
    });
    console.log(
      `\n✅ Stryker Mutation Testing Gate passed (Scope: ${scope}).\n`
    );
  } catch (_error) {
    console.error(
      `\n❌ Stryker mutation testing failed or fell below threshold (Scope: ${scope}).`
    );
    process.exit(1);
  }
}

if (require.main === module) {
  runMutationGate();
}
