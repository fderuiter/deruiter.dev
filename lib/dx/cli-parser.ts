/**
 * Zero-Dependency CLI Argument Parser & Agent DX Protocol Engine
 * Standardizes machine-readable output, non-interactive bypasses, and schema introspection.
 */

export interface RemediationAction {
  id: string;
  title: string;
  command: string;
  autoFixable: boolean;
  scope?: string;
}

export interface DxEnvelope<T = unknown> {
  success: boolean;
  command: string;
  timestamp: string;
  durationMs: number;
  data: T;
  remediations: RemediationAction[];
  metadata?: Record<string, unknown>;
}

export interface ParsedCliArgs {
  command?: string;
  flags: Record<string, string | boolean | string[]>;
  positionals: string[];
  raw: string[];
}

export interface CommandOptionDescriptor {
  name: string;
  alias?: string;
  type: "boolean" | "string" | "number";
  description: string;
  default?: unknown;
  required?: boolean;
}

export interface CommandDescriptor {
  name: string;
  aliases?: string[];
  summary: string;
  description: string;
  category:
    "diagnostics" | "workflow" | "scaffolding" | "performance" | "system";
  isMutating: boolean;
  options: CommandOptionDescriptor[];
  examples: string[];
}

/**
 * Common Flag Aliases
 */
const FLAG_ALIASES: Record<string, string> = {
  j: "json",
  y: "yes",
  h: "help",
  f: "fix",
  s: "strict",
  p: "pages",
  c: "ci",
  m: "message",
};

/**
 * Axis 5: Input Hardening & Sanitization
 * Rejects control characters, path traversals, and malformed command sequences in identifiers.
 */
export function sanitizeCliInput(value: string, fieldName = "Input"): string {
  const trimmed = value.trim();

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new Error(`${fieldName} contains invalid control characters.`);
  }

  // Check for path traversal attempts when passed as names/slugs
  if (trimmed.includes("../") || trimmed.includes("..\\") || trimmed === "..") {
    throw new Error(
      `${fieldName} cannot contain directory traversal sequences ('..').`
    );
  }

  return trimmed;
}

/**
 * Robust Zero-Dependency CLI Argument Tokenizer
 */
export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const flags: Record<string, string | boolean | string[]> = {};
  const positionals: string[] = [];
  const raw = [...argv];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      // Positional remainder
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith("--")) {
      const keyRaw = arg.slice(2);
      if (keyRaw.includes("=")) {
        const [k, ...rest] = keyRaw.split("=");
        const v = rest.join("=");
        flags[k] = v;
      } else {
        const nextArg = argv[i + 1];
        if (nextArg !== undefined && !nextArg.startsWith("-")) {
          flags[keyRaw] = nextArg;
          i++;
        } else {
          flags[keyRaw] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length > 1) {
      // Short flag or flag cluster
      const shortFlags = arg.slice(1);
      if (shortFlags.length === 1) {
        const resolvedKey = FLAG_ALIASES[shortFlags] || shortFlags;
        const nextArg = argv[i + 1];
        if (nextArg !== undefined && !nextArg.startsWith("-")) {
          flags[resolvedKey] = nextArg;
          i++;
        } else {
          flags[resolvedKey] = true;
        }
      } else {
        // Clustered flags e.g. -yj
        for (const ch of shortFlags) {
          const resolvedKey = FLAG_ALIASES[ch] || ch;
          flags[resolvedKey] = true;
        }
      }
    } else {
      positionals.push(arg);
    }

    i++;
  }

  // Determine top-level command
  let command: string | undefined;
  if (positionals.length > 0) {
    command = positionals[0];
    positionals.shift();
  }

  return {
    command,
    flags,
    positionals,
    raw,
  };
}

/**
 * Creates a standardized DX JSON Envelope
 */
export function createDxEnvelope<T = unknown>(options: {
  command: string;
  success: boolean;
  durationMs: number;
  data: T;
  remediations?: RemediationAction[];
  metadata?: Record<string, unknown>;
}): DxEnvelope<T> {
  return {
    success: options.success,
    command: options.command,
    timestamp: new Date().toISOString(),
    durationMs: options.durationMs,
    data: options.data,
    remediations: options.remediations || [],
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

/**
 * Emits pure formatted JSON to stdout with no ANSI codes
 */
export function printJsonEnvelope<T>(envelope: DxEnvelope<T>): void {
  process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
}

/**
 * Schema Introspection Registry (Score 3 on Agent DX CLI Scale)
 */
export const COMMAND_REGISTRY: CommandDescriptor[] = [
  {
    name: "doctor",
    summary: "Run architectural & invariant health diagnostics",
    description:
      "Executes 24 automated invariant audits across route indexing, navbar hierarchy, layout resilience, security, docs parity, hydration safety, and database migrations.",
    category: "diagnostics",
    isMutating: false,
    options: [
      {
        name: "fix",
        alias: "f",
        type: "boolean",
        description: "Automatically remediate all fixable invariant failures",
        default: false,
      },
      {
        name: "ci",
        alias: "c",
        type: "boolean",
        description:
          "Run in strict CI mode (exits with code 1 on warning or failure)",
        default: false,
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description:
          "Emit structured JSON envelope with machine-readable remediations",
        default: false,
      },
    ],
    examples: [
      "npm run dx doctor",
      "npm run dx doctor -- --fix",
      "npm run dx doctor -- --json",
    ],
  },
  {
    name: "verify",
    aliases: ["check"],
    summary: "Strict invariant check for CI / pre-commit",
    description:
      "Runs all architectural invariants in strict headless mode, failing fast if any checks violate AGENTS.md requirements.",
    category: "diagnostics",
    isMutating: false,
    options: [
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON envelope",
        default: false,
      },
    ],
    examples: ["npm run dx verify", "npm run dx verify -- --json"],
  },
  {
    name: "audit:licenses",
    aliases: ["license-audit", "licenses"],
    summary: "Audit lockfile package SPDX licenses against license-policy.json",
    description:
      "Parses package-lock.json directly to evaluate SPDX license compliance against license-policy.json and active exception bounds.",
    category: "diagnostics",
    isMutating: false,
    options: [
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON envelope",
        default: false,
      },
    ],
    examples: [
      "npm run dx audit:licenses",
      "npm run dx audit:licenses -- --json",
    ],
  },
  {
    name: "dead-code",
    aliases: ["unused"],
    summary: "Scan for unused exports and orphaned modules",
    description:
      "Performs AST static analysis across the workspace to locate unreferenced exports, unlinked files, and dead code.",
    category: "diagnostics",
    isMutating: false,
    options: [
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON envelope",
        default: false,
      },
      {
        name: "limit",
        type: "number",
        description:
          "Limit number of reported unused exports (Context Window Discipline)",
        default: 50,
      },
      {
        name: "filter",
        type: "string",
        description: "Filter exports or files by substring/pattern",
        default: "",
      },
    ],
    examples: [
      "npm run dx dead-code",
      "npm run dx dead-code -- --json --limit 5",
    ],
  },
  {
    name: "analyze",
    aliases: ["bundle"],
    summary: "Inspect production bundle chunk sizes and performance budgets",
    description:
      "Analyzes .next/static/chunks to assert gzip and raw byte budgets against maximum chunk and initial shared thresholds.",
    category: "performance",
    isMutating: false,
    options: [
      {
        name: "strict",
        alias: "s",
        type: "boolean",
        description: "Exit with code 1 if any chunk exceeds defined budget",
        default: false,
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON envelope",
        default: false,
      },
      {
        name: "limit",
        type: "number",
        description: "Limit chunk list output",
        default: 15,
      },
      {
        name: "filter",
        type: "string",
        description: "Filter chunk names by substring",
        default: "",
      },
    ],
    examples: ["npm run dx analyze", "npm run dx analyze -- --strict --json"],
  },
  {
    name: "scaffold",
    aliases: ["g"],
    summary: "Scaffold standardized vertical slice templates",
    description:
      "Generates synchronized component, hook, API route, ADR, case study, or arcade game boilerplates with companion tests.",
    category: "scaffolding",
    isMutating: true,
    options: [
      {
        name: "type",
        type: "string",
        description:
          "Template type: arcade, game, api, adr, case-study, component, hook",
        required: true,
      },
      {
        name: "name",
        type: "string",
        description: "Feature or asset kebab-case identifier",
        required: true,
      },
      {
        name: "dry-run",
        type: "boolean",
        description:
          "Preview generated file paths and actions without writing to disk",
        default: false,
      },
      {
        name: "yes",
        alias: "y",
        type: "boolean",
        description: "Bypass interactive confirmation prompt",
        default: false,
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON output of generated files",
        default: false,
      },
    ],
    examples: [
      "npm run dx scaffold arcade matrix-defender",
      "npm run dx scaffold --type component --name telemetry-badge --yes",
      "npm run dx scaffold --type api --name sync-telemetry --dry-run --json",
    ],
  },
  {
    name: "commit",
    aliases: ["cz"],
    summary: "Conventional Commit generator & validator",
    description:
      "Generates or validates commit messages adhering strictly to the Conventional Commits specification.",
    category: "workflow",
    isMutating: true,
    options: [
      {
        name: "type",
        type: "string",
        description:
          "Commit type (feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, dx)",
      },
      {
        name: "scope",
        type: "string",
        description: "Commit scope (e.g. proof, crf, a11y, dx)",
      },
      {
        name: "subject",
        type: "string",
        description: "Commit message subject in lowercase imperative mood",
      },
      {
        name: "breaking",
        type: "boolean",
        description: "Flag commit as containing breaking changes (!)",
        default: false,
      },
      {
        name: "body",
        type: "string",
        description: "Extended commit body text",
      },
      {
        name: "dry-run",
        type: "boolean",
        description: "Validate and format commit without running git commit",
        default: false,
      },
      {
        name: "yes",
        alias: "y",
        type: "boolean",
        description: "Bypass interactive prompt when required flags are set",
        default: false,
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit validation and generated commit JSON",
        default: false,
      },
    ],
    examples: [
      "npm run dx commit",
      'npm run dx commit -- --type feat --scope dx --subject "add machine readable json flag" --yes',
    ],
  },
  {
    name: "branch",
    summary: "Interactive git branch generator with convention validation",
    description:
      "Creates and checks out new branches matching team conventions (feat/*, fix/*, chore/*, refactor/*, docs/*, perf/*, dx/*).",
    category: "workflow",
    isMutating: true,
    options: [
      {
        name: "prefix",
        type: "string",
        description: "Branch category prefix (feat, fix, dx, chore, etc.)",
      },
      {
        name: "name",
        alias: "slug",
        type: "string",
        description: "Branch slug name (e.g. agent-dx-upgrades)",
      },
      {
        name: "checkout",
        type: "boolean",
        description: "Immediately check out to newly created branch",
        default: true,
      },
      {
        name: "dry-run",
        type: "boolean",
        description: "Preview branch creation without modifying git state",
        default: false,
      },
      {
        name: "yes",
        alias: "y",
        type: "boolean",
        description: "Bypass interactive prompts",
        default: false,
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON",
        default: false,
      },
    ],
    examples: [
      "npm run dx branch",
      "npm run dx branch -- --prefix feat --name telemetry-filter --yes",
    ],
  },
  {
    name: "env",
    summary: "Validate runtime environment schema & sync .env.example",
    description:
      "Asserts 100% parity between lib/env.ts schema and .env.example configuration template.",
    category: "system",
    isMutating: false,
    options: [
      {
        name: "fix",
        alias: "f",
        type: "boolean",
        description: "Automatically synchronize missing keys into .env.example",
        default: false,
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON envelope",
        default: false,
      },
    ],
    examples: [
      "npm run dx env",
      "npm run dx env -- --fix",
      "npm run dx env -- --json",
    ],
  },
  {
    name: "bench",
    aliases: ["benchmark"],
    summary: "Run micro-benchmarks & real-browser Core Web Vitals",
    description:
      "Benchmarks Pretext layout engine, Greedy Masonry scheduling, security scanner, AST formula evaluator, and Garmin allocator.",
    category: "performance",
    isMutating: false,
    options: [
      {
        name: "pages",
        alias: "p",
        type: "boolean",
        description:
          "Run real-browser Chromium navigation and Core Web Vitals benchmarks",
        default: false,
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured benchmark results as JSON",
        default: false,
      },
    ],
    examples: [
      "npm run dx bench",
      "npm run dx bench -- --json",
      "npm run dx bench -- --pages",
    ],
  },
  {
    name: "setup",
    aliases: ["init", "onboard"],
    summary:
      "Fresh-clone setup: profiles, integrations, database, verification",
    description:
      "Creates .env.local for an environment profile, configures optional integrations, applies the database schema behind a production guard, and runs requested verification. ./scripts/setup.sh runs the toolchain and dependency stages first.",
    category: "system",
    isMutating: true,
    options: [
      {
        name: "profile",
        type: "string",
        description:
          "Environment profile: local-minimal (default), hosted-development or deployment",
        default: "",
      },
      {
        name: "yes",
        alias: "y",
        type: "boolean",
        description:
          "Run without prompts and accept each question's safe default (never publishes or touches a hosted database)",
        default: false,
      },
      {
        name: "non-interactive",
        type: "boolean",
        description: "Run without prompts and decline every optional step",
        default: false,
      },
      {
        name: "dry-run",
        type: "boolean",
        description:
          "Show what would change without writing files or running mutating commands",
        default: false,
      },
      {
        name: "resume",
        type: "boolean",
        description:
          "Skip stages that completed in an earlier run (.setup-state.json)",
        default: false,
      },
      {
        name: "skip-db",
        type: "boolean",
        description: "Skip Prisma generation, schema and seed",
        default: false,
      },
      {
        name: "skip-db-seed",
        type: "boolean",
        description: "Skip loading sample data",
        default: false,
      },
      {
        name: "skip-integrations",
        type: "boolean",
        description: "Leave every optional integration in its degraded mode",
        default: false,
      },
      {
        name: "integrations",
        type: "string",
        description: "Comma-separated adapters to configure, e.g. clerk,resend",
        default: "",
      },
      {
        name: "apply-schema",
        type: "boolean",
        description: "Apply the schema without asking (non-interactive opt-in)",
        default: false,
      },
      {
        name: "seed",
        type: "boolean",
        description: "Load sample data without asking (non-interactive opt-in)",
        default: false,
      },
      {
        name: "allow-production-db",
        type: "string",
        description:
          "Exact host allowed despite production markers; still asks you to type it",
        default: "",
      },
      {
        name: "force-env",
        type: "boolean",
        description: "Back up .env.local, then replace it with the template",
        default: false,
      },
      {
        name: "verify",
        type: "string",
        description:
          "Comma-separated checks: static, env, prisma, db, providers, doctor, quality (bare flag = all)",
        default: "",
      },
      {
        name: "publish",
        type: "string",
        description:
          "Offer to publish integration values to github or vercel (always asks first)",
        default: "",
      },
      {
        name: "publish-env",
        type: "string",
        description:
          "Vercel environment or GitHub Actions environment for --publish",
        default: "",
      },
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit the structured JSON summary on stdout",
        default: false,
      },
    ],
    examples: [
      "./scripts/setup.sh",
      "./scripts/setup.sh --non-interactive --skip-db --json",
      "npm run setup -- --profile hosted-development --integrations clerk",
      "npm run setup -- --verify static,env,prisma",
    ],
  },
  {
    name: "describe",
    summary: "Schema introspection for AI agents & CLI tools",
    description:
      "Returns the complete machine-readable command registry, argument types, and options schema as JSON.",
    category: "system",
    isMutating: false,
    options: [],
    examples: ["npm run dx describe", "npm run dx -- --help --json"],
  },
  {
    name: "clean",
    aliases: ["reset"],
    summary: "Clean build artifacts and reset developer cache",
    description:
      "Removes .next, tsconfig.tsbuildinfo, coverage, and .turbo directories, then regenerates Prisma and design tokens.",
    category: "system",
    isMutating: true,
    options: [
      {
        name: "json",
        alias: "j",
        type: "boolean",
        description: "Emit structured JSON envelope",
        default: false,
      },
    ],
    examples: ["npm run dx clean"],
  },
  {
    name: "check:migrations",
    aliases: ["migrate:check"],
    summary: "Validate Prisma migration SQL integrity & destructive DDL",
    description:
      "Inspects prisma/migrations to prevent destructive column drops and unindexed foreign keys.",
    category: "system",
    isMutating: false,
    options: [],
    examples: ["npm run dx check:migrations"],
  },
];
