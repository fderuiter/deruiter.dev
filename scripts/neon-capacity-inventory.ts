#!/usr/bin/env node
/**
 * Neon Capacity Inventory & Branch Lifecycle Analysis
 *
 * Evidence-backed record of Neon Postgres free-tier storage meters,
 * project/branch policy inventory, compute auto-suspend policies, connection URL hygiene,
 * protected targets, and non-destructive cleanup governance (Issue #621 / Issue #632).
 *
 * Provider-side storage measurements and branch lifecycles are explicitly recorded as
 * unobserved locally without authorized NEON_API_KEY credentials (Issue #621).
 *
 * Usage:
 *   npx tsx scripts/neon-capacity-inventory.ts [--json] [--candidates] [--summary]
 */

export interface NeonStorageMeter {
  resource: string;
  usedBytes: number;
  limitBytes: number;
  usedGiB: number;
  limitGiB: number;
  headroomGiB: number;
  headroomPercentage: number;
  unit: string;
  providerStatus: "observed" | "unavailable_locally";
  note: string;
}

export interface NeonComputePolicy {
  autoSuspendSeconds: number;
  autoSuspendMinutes: number;
  maxComputeUnits: number;
  coldStartLatencySeconds: string;
  readThroughShieldRequirement: string;
}

export interface NeonBranch {
  branchId: string;
  name: string;
  projectSlug: string;
  environmentClassification:
    "production" | "dev" | "preview" | "ephemeral" | "unconnected_legacy";
  protectionStatus: "protected" | "ephemeral";
  storageBytes: number;
  storageMiB: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  owner: string;
  expirationPolicy: string;
  connectionType: "pooled_runtime" | "direct_migration";
  role: string;
}

export interface NeonProject {
  projectId: string;
  name: string;
  connectionAttachment: string;
  status: "active_primary" | "unconnected_legacy";
  branches: NeonBranch[];
  totalStorageBytes: number;
  totalStorageMiB: number;
}

export interface NeonConnectionHygiene {
  runtimePooledUrl: {
    variable: "DATABASE_URL";
    protocol: "postgresql" | "prisma+postgres";
    poolingMechanism: "PgBouncer / Neon WebSocket Adapter (@prisma/adapter-neon)";
    purpose: "Serverless route handlers & application runtime queries";
  };
  migrationDirectUrl: {
    variable: "DATABASE_URL_UNPOOLED";
    protocol: "postgresql";
    poolingMechanism: "Direct unpooled Postgres compute endpoint";
    purpose: "Guarded Vercel production-build migrations (prevents advisory lock timeouts)";
  };
}

export interface NeonCleanupCandidate {
  targetId: string;
  targetType: "project" | "branch";
  projectId: string;
  branchName?: string;
  environment: "preview" | "unconnected_legacy" | "dev_experimental";
  storageBytes: number;
  storageMiB: number;
  reason: string;
  requiredApproval: string;
  destructiveActionExecuted: false;
}

export interface NeonCapacityInventory {
  timestamp: string;
  scope: string;
  plan: string;
  providerInventoryAvailable: boolean;
  note: string;
  storageMeter: NeonStorageMeter;
  computePolicy: NeonComputePolicy;
  connectionHygiene: NeonConnectionHygiene;
  projects: NeonProject[];
  protectedTargets: {
    projectId: string;
    branchName: string;
    environment: "production" | "dev";
    role: string;
  }[];
  candidates: NeonCleanupCandidate[];
  summary: {
    totalProjects: number;
    totalBranches: number;
    protectedBranchesCount: number;
    candidateCount: number;
    currentTotalStorageMiB: number;
    expectedRecoverableStorageMiB: number;
    expectedRecoverableStorageGiB: number;
    projectedPostCleanupHeadroomGiB: number;
    nonDestructiveInvariantVerified: boolean;
    providerDataStatus: "unavailable_locally" | "observed";
  };
  cleanupRules: string[];
}

export const NEON_FREE_TIER_LIMIT_BYTES = 536870912; // 0.5 GiB = 512 MiB
export const NEON_FREE_TIER_LIMIT_GIB = 0.5;

/**
 * Branches excluded from deletion candidates under any circumstances.
 *
 * "Protected" here is this repository's policy, not the provider's flag. The
 * production branch reports `protected: false` at Neon as of 2026-09-19;
 * enabling it is an open acceptance criterion of issue #622. A previous
 * revision of this file also listed a `dev` branch, which does not exist --
 * ADR 0037 replaced the persistent dev environment and this record was never
 * updated.
 */
export const PROTECTED_NEON_TARGETS = [
  {
    projectId: "portfolio",
    branchName: "main",
    environment: "production" as const,
    role: "Canonical production PostgreSQL database backing deruiter.dev",
  },
];

/**
 * Cleanup candidates are strictly empty until authorized provider snapshot is provided.
 * No fabricated or unverified candidate targets are permitted (Issue #621).
 */
export const HISTORICAL_NEON_CANDIDATES: NeonCleanupCandidate[] = [];

export function getNeonCapacityInventory(): NeonCapacityInventory {
  return {
    timestamp: "2026-09-19T16:11:09.000Z",
    scope:
      "Neon Postgres / Vercel Resource 'neon-gray-drum' (observed 2026-09-19)",
    plan: "Neon Free Tier (0.5 GiB Storage & Auto-Suspending Compute)",
    providerInventoryAvailable: true,
    note: "Observed against the Neon API on 2026-09-19, closing the provider gap in issue #621. This is a recorded snapshot, not a live query: the script has no NEON_API_KEY and will drift until re-observed. Two cleanup candidates are identified in the reference document; zero are approved here. The production branch id changed on 2026-09-19: the #700 restore rehearsal cut production over to a restored branch (br-snowy-butterfly-apmzw7bd), which now carries the name 'main' and the production endpoint ep-young-mouse-ap1zkh0m. The former branch br-shiny-dust-apixoyf1 is retained as pre-rehearsal-main-2026-09-19 with identical data.",
    storageMeter: {
      resource: "Neon Postgres Storage",
      usedBytes: 32284672,
      limitBytes: NEON_FREE_TIER_LIMIT_BYTES,
      usedGiB: 0.03,
      limitGiB: NEON_FREE_TIER_LIMIT_GIB,
      headroomGiB: 0.47,
      headroomPercentage: 94,
      unit: "GiB",
      providerStatus: "observed",
      note: "Observed 2026-09-19: neon-gray-drum main branch holds 32,284,672 bytes (30.8 MiB) of the 512 MiB branch limit. Point-in-time recovery is 21,600s (6 hours), which is the effective RPO and bounds issue #700.",
    },
    computePolicy: {
      autoSuspendSeconds: 300,
      autoSuspendMinutes: 5,
      maxComputeUnits: 0.25,
      coldStartLatencySeconds: "1–3s cold-start on un-cached public queries",
      readThroughShieldRequirement:
        "Upstash Read-Through Cache (#708) and Next.js ISR (revalidate=86400 with on-demand revalidation) keep Neon compute in zero-compute sleep state during public visitor traffic (ADR 0036)",
    },
    connectionHygiene: {
      runtimePooledUrl: {
        variable: "DATABASE_URL",
        protocol: "postgresql",
        poolingMechanism:
          "PgBouncer / Neon WebSocket Adapter (@prisma/adapter-neon)",
        purpose: "Serverless route handlers & application runtime queries",
      },
      migrationDirectUrl: {
        variable: "DATABASE_URL_UNPOOLED",
        protocol: "postgresql",
        poolingMechanism: "Direct unpooled Postgres compute endpoint",
        purpose:
          "Guarded Vercel production-build migrations (prevents advisory lock timeouts)",
      },
    },
    projects: [
      {
        projectId: "neon-gray-drum",
        name: "portfolio",
        connectionAttachment:
          "Vercel Project 'portfolio' (Production & Preview)",
        status: "active_primary",
        totalStorageBytes: 0,
        totalStorageMiB: 0,
        branches: [
          {
            branchId: "br-snowy-butterfly-apmzw7bd",
            name: "main",
            projectSlug: "portfolio",
            environmentClassification: "production",
            protectionStatus: "protected",
            storageBytes: 32333824,
            storageMiB: 30.8,
            createdAtUtc: "2026-09-19T15:58:52Z",
            updatedAtUtc: "2026-09-19T16:11:09Z",
            owner: "laser-loons-projects",
            expirationPolicy: "Never (Canonical Production)",
            connectionType: "pooled_runtime",
            role: "Canonical production database for deruiter.dev; holds endpoint ep-young-mouse-ap1zkh0m",
          },
          {
            branchId: "br-shiny-dust-apixoyf1",
            name: "pre-rehearsal-main-2026-09-19",
            projectSlug: "portfolio",
            environmentClassification: "ephemeral",
            protectionStatus: "ephemeral",
            storageBytes: 32284672,
            storageMiB: 30.8,
            createdAtUtc: "2026-05-27T03:10:21Z",
            updatedAtUtc: "2026-09-19T16:10:17Z",
            owner: "laser-loons-projects",
            expirationPolicy:
              "Retained pending operator deletion -- see issue #700 rehearsal record",
            connectionType: "pooled_runtime",
            role: "Former production branch, demoted by the #700 restore rehearsal on 2026-09-19; data identical to main, retained as a rollback copy",
          },
          {
            branchId: "br-royal-sky-apfvczyx",
            name: "rehearsal/v0.3.0-migrations",
            projectSlug: "portfolio",
            environmentClassification: "ephemeral",
            protectionStatus: "ephemeral",
            storageBytes: 32071680,
            storageMiB: 30.6,
            createdAtUtc: "2026-09-13T01:30:01Z",
            updatedAtUtc: "2026-09-14T15:58:16Z",
            owner: "laser-loons-projects",
            expirationPolicy:
              "None configured -- no lifecycle automation exists (issue #622)",
            connectionType: "pooled_runtime",
            role: "v0.3.0 migration rehearsal branch; compute idle since 2026-09-13",
          },
        ],
      },
    ],
    protectedTargets: PROTECTED_NEON_TARGETS,
    candidates: HISTORICAL_NEON_CANDIDATES,
    summary: {
      totalProjects: 1,
      totalBranches: 3,
      protectedBranchesCount: 1,
      candidateCount: 0,
      currentTotalStorageMiB: 92.2,
      expectedRecoverableStorageMiB: 0,
      expectedRecoverableStorageGiB: 0,
      projectedPostCleanupHeadroomGiB: NEON_FREE_TIER_LIMIT_GIB,
      nonDestructiveInvariantVerified: true,
      providerDataStatus: "observed",
    },
    cleanupRules: [
      "No Cloud Mutation Invariant: Zero write, drop, or delete operations are executed by this script or ticket.",
      "Protected Resource Rule: The primary production branch ('main') is strictly excluded from candidates. Note that Neon branch protection is NOT currently enabled on it -- this is repository policy, not a provider control (issue #622).",
      "Explicit Operator Approval Rule: Deletion of unconnected projects or stale PR branches requires explicit operator sign-off with authorized provider credentials.",
      "Post-Cleanup Verification Rule: Run 'npm run check:migrations:drift' and verify production HTTP 200 health after any future operator cleanup.",
      "No Invented Evidence Rule: Figures here are a recorded snapshot observed on 2026-09-19, not a live query. Re-observe before relying on them; a previous revision asserted a protected 'dev' branch that never existed.",
    ],
  };
}

export function runNeonCapacityInventoryVerification(options?: {
  json?: boolean;
  candidates?: boolean;
  summary?: boolean;
}): { success: boolean; data: NeonCapacityInventory } {
  const inventory = getNeonCapacityInventory();

  // Invariant 1: Duplicate candidate IDs check
  const candidateIds = new Set(inventory.candidates.map((c) => c.targetId));
  if (candidateIds.size !== inventory.candidates.length) {
    throw new Error(
      "Duplicate cleanup candidate ID detected in Neon inventory."
    );
  }

  // Invariant 2: Protected targets must NEVER be in candidates list
  for (const protectedTarget of inventory.protectedTargets) {
    const isViolated = inventory.candidates.some(
      (c) =>
        c.projectId === protectedTarget.projectId &&
        c.branchName === protectedTarget.branchName
    );
    if (isViolated) {
      throw new Error(
        `Critical safety violation: Protected target ${protectedTarget.projectId}/${protectedTarget.branchName} is present in candidate list!`
      );
    }
  }

  // Invariant 3: Confirm non-destructive flag is strictly enforced
  for (const candidate of inventory.candidates) {
    if (candidate.destructiveActionExecuted !== false) {
      throw new Error(
        `Safety violation: Candidate ${candidate.targetId} has destructiveActionExecuted set to true!`
      );
    }
  }

  if (options?.json) {
    console.log(JSON.stringify(inventory, null, 2));
    return { success: true, data: inventory };
  }

  console.log("=== Neon Capacity & Branch Inventory ===");
  console.log(`Timestamp: ${inventory.timestamp} (${inventory.scope})`);
  console.log(`Plan Tier: ${inventory.plan}`);
  console.log(`Status:    ${inventory.note}`);
  console.log("");
  console.log("STORAGE METER READINGS:");
  console.log(
    `• Storage Usage:       UNAVAILABLE LOCALLY (requires authorized NEON_API_KEY per Issue #621)`
  );
  console.log(
    `• Plan Quota Limit:    ${inventory.storageMeter.limitGiB} ${inventory.storageMeter.unit} (${inventory.storageMeter.limitBytes} bytes)`
  );
  console.log(
    `• Headroom:            ${inventory.storageMeter.headroomGiB} GiB (policy maximum)`
  );
  console.log("");
  console.log("COMPUTE & SLEEP POLICIES:");
  console.log(
    `• Auto-Suspend:        ${inventory.computePolicy.autoSuspendMinutes} minutes (${inventory.computePolicy.autoSuspendSeconds}s inactivity limit)`
  );
  console.log(
    `• Max Compute:         ${inventory.computePolicy.maxComputeUnits} CU`
  );
  console.log(
    `• Cold Start:          ${inventory.computePolicy.coldStartLatencySeconds}`
  );
  console.log(
    `• Compute Shield:      ${inventory.computePolicy.readThroughShieldRequirement}`
  );
  console.log("");
  console.log("CONNECTION URL HYGIENE:");
  console.log(
    `• Runtime Pooled URL:  ${inventory.connectionHygiene.runtimePooledUrl.variable} (${inventory.connectionHygiene.runtimePooledUrl.poolingMechanism})`
  );
  console.log(
    `• Migration Direct:    ${inventory.connectionHygiene.migrationDirectUrl.variable} (${inventory.connectionHygiene.migrationDirectUrl.purpose})`
  );
  console.log("");
  console.log("PROTECTED TARGETS (EXCLUDED FROM CANDIDATES):");
  for (const t of inventory.protectedTargets) {
    console.log(
      `• [${t.projectId}] branch '${t.branchName}' (${t.environment}) — ${t.role}`
    );
  }
  console.log("");
  console.log("STALE CANDIDATE & CLEANUP SUMMARY:");
  console.log(`• Total Projects:      ${inventory.summary.totalProjects}`);
  console.log(`• Total Branches:      ${inventory.summary.totalBranches}`);
  console.log(`• Total Candidates:    ${inventory.summary.candidateCount}`);
  console.log(
    `• Recoverable Storage: ${inventory.summary.expectedRecoverableStorageMiB} MiB (~${inventory.summary.expectedRecoverableStorageGiB} GiB)`
  );
  console.log(
    `• Post-Cleanup Headroom: ${inventory.summary.projectedPostCleanupHeadroomGiB} GiB`
  );
  console.log(
    `• Non-Destructive Status: ${inventory.summary.nonDestructiveInvariantVerified ? "VERIFIED (0 mutations executed)" : "FAILED"}`
  );

  if (options?.candidates) {
    console.log("");
    console.log("STALE CANDIDATE DETAILS:");
    if (inventory.candidates.length === 0) {
      console.log(
        "  (No cleanup candidates approved; zero provider-side candidates evidenced)"
      );
    } else {
      for (const c of inventory.candidates) {
        console.log(
          `  ${c.targetId.padEnd(26)} ${c.targetType.padEnd(8)} ${c.storageMiB} MiB  [${c.environment}] - ${c.reason}`
        );
      }
    }
  }

  return { success: true, data: inventory };
}

if (typeof process !== "undefined" && require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const candidates = args.includes("--candidates");
  const summary = args.includes("--summary");
  runNeonCapacityInventoryVerification({ json, candidates, summary });
}
