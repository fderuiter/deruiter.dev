import fs from "fs";
import path from "path";
import { redactSecrets, validateEnvironmentSchema } from "./environment";
import type { SetupPrompter } from "./prompts";
import { PROVIDER_ADAPTERS } from "./providers/catalog";
import type { CommandRunner } from "./providers/publish";
import type { ProbeFetch, ProviderAdapter } from "./providers/types";
import type { VerificationCheck } from "./types";

/** Verification levels, cheapest first. */
export const VERIFICATION_LEVELS = [
  "static",
  "env",
  "prisma",
  "db",
  "providers",
  "doctor",
  "quality",
] as const;

/** One verification level. */
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

const LEVEL_LABELS: Record<VerificationLevel, string> = {
  static: "Toolchain and lockfile",
  env: "Environment schema",
  prisma: "Prisma schema (npx prisma validate)",
  db: "Database migrations status (npx prisma migrate status)",
  providers: "Provider credentials (read-only probes)",
  doctor: "Architecture doctor (npm run doctor)",
  quality: "Full quality gate (npm run quality)",
};

/**
 * Parses `--verify`. A bare flag means every level; a comma list picks
 * levels; unknown names are returned so the caller can reject them.
 */
export function parseVerifyFlag(value: string | boolean | undefined): {
  levels: VerificationLevel[];
  unknown: string[];
} {
  if (value === undefined || value === false)
    return { levels: [], unknown: [] };
  if (value === true || value === "all") {
    return { levels: [...VERIFICATION_LEVELS], unknown: [] };
  }
  const requested = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const unknown = requested.filter(
    (part) => !(VERIFICATION_LEVELS as readonly string[]).includes(part)
  );
  const levels = VERIFICATION_LEVELS.filter((level) =>
    requested.includes(level)
  );
  return { levels, unknown };
}

/** Inputs to {@link runVerification}. */
export interface VerificationOptions {
  root: string;
  /** Levels the flags asked for. Interactive runs may add more by asking. */
  requested: readonly VerificationLevel[];
  values: Readonly<Record<string, string>>;
  prompter: SetupPrompter;
  run: CommandRunner;
  fetch: ProbeFetch;
  dryRun: boolean;
  adapters?: readonly ProviderAdapter[];
  probeTimeoutMs?: number;
  log: (line: string) => void;
}

function check(
  level: VerificationLevel,
  status: VerificationCheck["status"],
  detail: string,
  id: string = level
): VerificationCheck {
  return { id, label: LEVEL_LABELS[level], status, detail };
}

function lastLine(text: string): string {
  const lines = text.trim().split("\n").filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

async function runLevel(
  level: VerificationLevel,
  options: VerificationOptions
): Promise<VerificationCheck[]> {
  const { root, run, values } = options;
  const quiet = async (command: string, args: string[]) => {
    const result = await run(command, args, { cwd: root });
    return {
      ok: result.code === 0,
      detail: redactSecrets(lastLine(result.stderr || result.stdout), values),
    };
  };

  switch (level) {
    case "static": {
      const lockfile = fs.existsSync(path.join(root, "package-lock.json"));
      const npm = await run("npm", ["--version"], { cwd: root });
      const ok = lockfile && npm.code === 0;
      return [
        check(
          level,
          ok ? "passed" : "failed",
          ok
            ? `npm ${npm.stdout.trim()}, package-lock.json present.`
            : "npm or package-lock.json is missing."
        ),
      ];
    }
    case "env": {
      const schema = validateEnvironmentSchema(values);
      return [
        check(
          level,
          schema.valid ? "schema-valid" : "failed",
          schema.valid
            ? "Every present value matches lib/env.ts. Shape only: no provider was contacted."
            : schema.errors.join(" ")
        ),
      ];
    }
    case "prisma": {
      const result = await quiet("npx", ["prisma", "validate"]);
      return [check(level, result.ok ? "passed" : "failed", result.detail)];
    }
    case "db": {
      const result = await quiet("npx", ["prisma", "migrate", "status"]);
      return [
        check(
          level,
          result.ok ? "live-verified" : "failed",
          result.ok
            ? "Connected; every committed migration is applied."
            : `Not reachable or migrations pending: ${result.detail}`
        ),
      ];
    }
    case "providers": {
      const checks: VerificationCheck[] = [];
      for (const adapter of options.adapters ?? PROVIDER_ADAPTERS) {
        const offline = adapter.validate(values);
        let result = offline;
        if (
          offline.status === "schema-valid" ||
          offline.status === "configured"
        ) {
          if (adapter.probe) {
            result = await adapter.probe({
              values,
              fetch: options.fetch,
              timeoutMs: options.probeTimeoutMs ?? 8000,
            });
          }
        }
        checks.push({
          id: `providers:${adapter.id}`,
          label: adapter.name,
          status: result.status,
          detail: result.detail,
        });
      }
      return checks;
    }
    case "doctor": {
      const result = await quiet("npm", ["run", "doctor"]);
      return [check(level, result.ok ? "passed" : "failed", result.detail)];
    }
    case "quality": {
      const result = await quiet("npm", ["run", "quality"]);
      return [check(level, result.ok ? "passed" : "failed", result.detail)];
    }
  }
}

/**
 * Runs verification from cheapest to most expensive. Non-interactive runs
 * execute exactly the requested levels. Interactive runs execute those,
 * then offer each remaining level in order and stop at the first "no".
 * Levels that did not run are reported as `not-checked`, so a summary never
 * implies a check that nobody performed.
 */
export async function runVerification(
  options: VerificationOptions
): Promise<VerificationCheck[]> {
  const results: VerificationCheck[] = [];
  let offering = options.prompter.interactive;

  for (const level of VERIFICATION_LEVELS) {
    let wanted = options.requested.includes(level);
    if (!wanted && offering) {
      wanted = await options.prompter.confirm(
        `Run the next check: ${LEVEL_LABELS[level]}?`,
        false
      );
      if (!wanted) offering = false;
    }
    if (!wanted) {
      results.push(check(level, "not-checked", "Not requested."));
      continue;
    }
    if (options.dryRun) {
      results.push(
        check(level, "not-checked", "Dry run: would run this check.")
      );
      continue;
    }
    options.log(`Checking: ${LEVEL_LABELS[level]}`);
    results.push(...(await runLevel(level, options)));
  }
  return results;
}
