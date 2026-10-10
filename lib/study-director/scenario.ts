import { z } from "zod";
import { STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM } from "./presets";
import { applyDifficulty, createStudy } from "./internal/model";
import { beginStudy } from "./internal/events";
import type { Difficulty, StudyState } from "./types";

export const SponsorArchetypeSchema = z.enum(["firstTimeBiotech", "bigPharma"]);
export const ProtocolMaturitySchema = z.enum([
  "solid",
  "questionable",
  "shaky",
]);
export const RegulatoryRiskSchema = z.enum(["low", "moderate", "high"]);
export const CoordinatorArchetypeSchema = z.enum([
  "terrified",
  "invisible",
  "steady",
  "overconfident",
  "newcomer",
]);
export const TeamRoleSchema = z.enum([
  "biostatistician",
  "dataManager",
  "regulatory",
  "monitor",
  "medicalWriter",
  "programmer",
]);
export const MemberArchetypeSchema = z.enum([
  "optimisticStatistician",
  "veteranDataManager",
  "veteranMonitor",
  "steadyProfessional",
  "overloadedStar",
]);

export const StudySetupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  design: z.string().min(1),
  sponsor: z.object({
    name: z.string().min(1),
    archetype: SponsorArchetypeSchema,
  }),
  clinicalPhase: z.string().min(1),
  subjects: z.number().int().positive(),
  durationDays: z.number().int().positive(),
  budget: z.number().positive(),
  protocolMaturity: ProtocolMaturitySchema,
  regulatoryRisk: RegulatoryRiskSchema,
  complexity: z.number().int().min(1).max(5),
});

export const SiteStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  coordinator: CoordinatorArchetypeSchema,
  burden: z.number().min(0).max(100),
  enrolled: z.number().min(0),
  openQueries: z.number().min(0),
  deviations: z.number().min(0),
  unsignedSource: z.number().min(0),
  eligibilityConcerns: z.number().min(0),
  trainingCurrent: z.boolean(),
  lastAuditedDay: z.number().nullable(),
});

export const TeamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: TeamRoleSchema,
  archetype: MemberArchetypeSchema,
  skill: z.number().min(1).max(5),
  speed: z.number().min(1).max(5),
  reliability: z.number().min(1).max(5),
  workload: z.number().min(0).max(100),
});

export const StudyScenarioSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  setup: StudySetupSchema,
  sites: z.array(SiteStateSchema).min(1),
  team: z.array(TeamMemberSchema).min(1),
});

export type StudyScenario = z.infer<typeof StudyScenarioSchema>;

/**
 * Fallback preset scenario default.
 */
export const DEFAULT_SCENARIO: StudyScenario = {
  version: 1,
  id: "24-081-preset",
  name: "Study 24-081 Standard Protocol",
  description: "Standard randomized PK study scenario preset",
  setup: STUDY_24_081,
  sites: STUDY_24_081_SITES,
  team: STUDY_24_081_TEAM,
};

/**
 * Validates arbitrary input data against the StudyScenario schema.
 */
export function validateScenario(
  data: unknown
): { success: true; data: StudyScenario } | { success: false; error: string } {
  const result = StudyScenarioSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: `Invalid scenario schema: ${issues}` };
}

/**
 * Parses and validates a JSON string into a StudyScenario.
 */
export function parseScenarioJson(
  jsonString: string
): { success: true; data: StudyScenario } | { success: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    return validateScenario(parsed);
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Exports a StudyScenario as formatted scenario JSON text.
 */
export function exportScenarioJson(scenario: StudyScenario): string {
  return JSON.stringify(scenario, null, 2);
}

/**
 * Creates a StudyScenario using default STUDY_24_081 preset values with optional overrides.
 */
export function createScenarioFromPreset(
  overrides?: Partial<StudyScenario>
): StudyScenario {
  return {
    ...DEFAULT_SCENARIO,
    ...overrides,
    setup: {
      ...DEFAULT_SCENARIO.setup,
      ...overrides?.setup,
    },
    sites: overrides?.sites ?? DEFAULT_SCENARIO.sites,
    team: overrides?.team ?? DEFAULT_SCENARIO.team,
  };
}

/**
 * Creates a new StudyState initialized from a validated StudyScenario.
 */
export function createStudyFromScenario(
  scenario: StudyScenario,
  seed?: string,
  difficulty: Difficulty = "standard"
): StudyState {
  const valid = validateScenario(scenario);
  const targetScenario = valid.success ? valid.data : DEFAULT_SCENARIO;
  const runSeed =
    seed ??
    `sd-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

  return beginStudy(
    applyDifficulty(
      createStudy(
        runSeed,
        targetScenario.setup,
        targetScenario.sites,
        targetScenario.team
      ),
      difficulty
    )
  );
}
