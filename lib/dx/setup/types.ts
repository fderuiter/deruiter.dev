/**
 * Shared contracts for the fresh-clone setup framework (#1031).
 *
 * The shell entrypoint (`scripts/setup.sh`) owns the stages that must run
 * before Node.js dependencies exist; everything after that is orchestrated
 * by `runSetupWorkflow` in `lib/dx/setup.ts`. Both sides report stages with
 * the same vocabulary so one machine-readable summary covers the whole run.
 */

/** Every stage the setup run can report, in execution order. */
export const SETUP_STAGE_IDS = [
  "platform",
  "toolchain",
  "dependencies",
  "lockfile",
  "environment",
  "integrations",
  "database",
  "verification",
] as const;

/** Identifier of one setup stage. */
export type SetupStageId = (typeof SETUP_STAGE_IDS)[number];

/**
 * Outcome of a stage.
 *
 * - `completed`: the stage did everything it set out to do.
 * - `skipped`: a flag or the user chose not to run it.
 * - `failed`: it ran and something went wrong.
 * - `manual`: it needs a person to finish it (a missing secret, a refused
 *   production target, a dashboard step).
 * - `cancelled`: the user pressed Ctrl-C while it ran.
 */
export type SetupStageStatus =
  "completed" | "skipped" | "failed" | "manual" | "cancelled";

/** One line of the stage summary. Never carries a credential value. */
export interface SetupStageRecord {
  id: SetupStageId;
  status: SetupStageStatus;
  detail: string;
}

/** Environment profiles offered by the environment stage. */
export const SETUP_PROFILE_IDS = [
  "local-minimal",
  "hosted-development",
  "deployment",
] as const;

/** Identifier of one environment profile. */
export type SetupProfileId = (typeof SETUP_PROFILE_IDS)[number];

/**
 * What kind of value an environment key holds.
 *
 * - `secret`: a credential the user supplies.
 * - `public`: safe to ship to the browser (`NEXT_PUBLIC_*`).
 * - `generated`: setup can create it locally (for example `CRON_SECRET`).
 * - `derived`: a provider integration fills it in from another value.
 * - `optional`: plain configuration with a working default.
 * - `runtime-managed`: set by a tool or platform at run time; never edited.
 */
export type EnvKeyKind =
  | "secret"
  | "public"
  | "generated"
  | "derived"
  | "optional"
  | "runtime-managed";

/** Classification of one environment key. */
export interface EnvKeyClassification {
  kind: EnvKeyKind;
  /** True when the value must be redacted everywhere and read with hidden input. */
  secret: boolean;
}

/**
 * The strongest claim a verification check can make, from weakest to
 * strongest: `configured` (a value is present), `schema-valid` (it has the
 * right shape), `live-verified` (a read-only call to the provider succeeded).
 * Commands report `passed`. `not-checked` means nobody asked for the check.
 */
export type VerificationStatus =
  | "not-checked"
  | "configured"
  | "schema-valid"
  | "live-verified"
  | "passed"
  | "failed";

/** Result of one verification check. */
export interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationStatus;
  detail: string;
}

/** Outcome of a single database step. */
export type DatabaseStepStatus =
  | "not-attempted"
  | "succeeded"
  | "skipped"
  | "failed"
  | "needs-manual-recovery";

/** Record of one database step and how to recover it if it did not finish. */
export interface DatabaseStepRecord {
  status: DatabaseStepStatus;
  detail: string;
  /** Command a person runs to finish or repair the step by hand. */
  recovery?: string;
}

/** Captures what the environment stage established, separately per concern. */
export interface EnvironmentStatus {
  /** `.env.local` did not exist and was created from `.env.example` this run. */
  templateCreated: boolean;
  /** Every present value passes the `lib/env.ts` schema. */
  schemaValid: boolean;
  /** Key names and messages only; never values. */
  schemaErrors: string[];
  /** Every key the profile requires has a real (non-placeholder) value. */
  requiredReady: boolean;
  missingRequired: string[];
  /** Every optional key the profile lists has a real value. */
  optionalReady: boolean;
  missingOptional: string[];
  /** Keys the user chose to leave unset this run. */
  userSkipped: string[];
  /** Keys written to `.env.local` this run (names only). */
  written: string[];
  /** Keys whose existing value was kept rather than replaced. */
  kept: string[];
  /** Backup made before a destructive replacement, relative to the workspace. */
  backupPath?: string;
}

/** Database stage record. */
export interface DatabaseStatus {
  /** Redacted identity such as `localhost:5432/portfolio_dev`, or null. */
  target: string | null;
  /** Whether the target looked like production, and why. */
  productionTarget: boolean;
  productionReasons: string[];
  generate: DatabaseStepRecord;
  schema: DatabaseStepRecord;
  seed: DatabaseStepRecord;
}

/** Full result of a setup run. Safe to print as JSON. */
export interface SetupResult {
  success: boolean;
  profile: SetupProfileId;
  dryRun: boolean;
  stages: SetupStageRecord[];
  environment: EnvironmentStatus | null;
  integrations: IntegrationOutcome[];
  database: DatabaseStatus | null;
  verification: VerificationCheck[];
  summary: {
    completed: SetupStageId[];
    skipped: SetupStageId[];
    failed: SetupStageId[];
    manual: SetupStageId[];
  };
  errors: string[];
}

/** What the integrations stage did for one provider adapter. */
export interface IntegrationOutcome {
  provider: string;
  status: "configured" | "skipped" | "degraded" | "manual";
  /** Key names written to `.env.local`; never values. */
  written: string[];
  /** Destinations the user explicitly published to, e.g. `vercel:preview`. */
  published: string[];
  detail: string;
}
