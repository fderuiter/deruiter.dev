import { AMENDMENT_NOTICE, STUDY_ID, WAVE_VS_TOTALS } from "../presets";
import type { SiteId, WaveIndex } from "../types";

/** Schedule source mode for the Trial Data Pipeline Simulator. */
export type ProtocolDriftScheduleSource = "workspace" | "pd-101";

/** One planned study visit mapped into Protocol Drift wave scheduling. */
export interface UsdmProtocolDriftVisit {
  readonly id: string;
  readonly name: string;
  readonly targetDay: number;
  readonly activityCount: number;
}

/** One site submission wave derived from the active USDM visit schedule. */
export interface UsdmProtocolDriftWave {
  readonly wave: WaveIndex;
  readonly label: string;
  readonly releaseDay: number;
  readonly siteIds: readonly SiteId[];
  readonly encounterIds: readonly string[];
  readonly encounterNames: readonly string[];
  readonly scheduledAssessmentCount: number;
  readonly expectedCumulativeVsRecords: number;
}

/** Active USDM schedule adapted for Protocol Drift alongside classic PD-101. */
export interface AdaptedProtocolDriftSchedule {
  readonly source: ProtocolDriftScheduleSource;
  readonly studyId: string;
  readonly studyTitle: string;
  readonly armNames: readonly string[];
  readonly amendmentDay: number;
  readonly visits: readonly UsdmProtocolDriftVisit[];
  readonly waves: readonly UsdmProtocolDriftWave[];
}

interface LooseRecord {
  readonly [key: string]: unknown;
}

function asRecord(value: unknown): LooseRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function asArray(value: unknown): readonly LooseRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter((item): item is LooseRecord => item !== null);
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function inferPlannedDay(encounter: LooseRecord, index: number): number {
  const label =
    asText(encounter.label) ??
    asText(encounter.name) ??
    asText(encounter.description) ??
    "";
  const lower = label.toLowerCase();
  if (lower.includes("screen")) return -14;
  if (
    lower.includes("baseline") ||
    lower.includes("random") ||
    lower.includes("implant") ||
    lower.includes("procedure")
  ) {
    return 1;
  }
  const dayMatch = /\bday\s*(-?\d+)\b/i.exec(label);
  if (dayMatch) return Number(dayMatch[1]);
  const weekMatch = /\bweek\s*(\d+)\b/i.exec(label);
  if (weekMatch) return Number(weekMatch[1]) * 7;
  const monthMatch = /\bmonth\s*(\d+)\b/i.exec(label);
  if (monthMatch) return Number(monthMatch[1]) * 30;
  const yearMatch = /\byear\s*(\d+)\b/i.exec(label);
  if (yearMatch) return Number(yearMatch[1]) * 365;
  const cycleMatch = /\bcycle\s*(\d+)\b/i.exec(label);
  if (cycleMatch) return (Number(cycleMatch[1]) - 1) * 21 + 1;
  return index === 0 ? 1 : index * 14;
}

function classicPd101Schedule(): AdaptedProtocolDriftSchedule {
  const visits: readonly UsdmProtocolDriftVisit[] = [
    {
      id: "pd101_v1",
      name: "Baseline (Day 1)",
      targetDay: 1,
      activityCount: 2,
    },
    {
      id: "pd101_v2",
      name: "Week 2 Check (Day 14)",
      targetDay: 14,
      activityCount: 2,
    },
    {
      id: "pd101_v3",
      name: "Post-Amendment Follow-Up (Day 24)",
      targetDay: 24,
      activityCount: 3,
    },
  ];
  return {
    source: "pd-101",
    studyId: STUDY_ID,
    studyTitle: "Phase II Orthostatic Vital Signs Study (Classic PD-101)",
    armNames: ["Active Regimen", "Placebo"],
    amendmentDay: AMENDMENT_NOTICE.day,
    visits,
    waves: [
      {
        wave: 1,
        label: "Wave 1: Initial Baseline Cohort",
        releaseDay: 1,
        siteIds: ["SITE-A"],
        encounterIds: ["pd101_v1"],
        encounterNames: ["Baseline (Day 1)"],
        scheduledAssessmentCount: 2,
        expectedCumulativeVsRecords: WAVE_VS_TOTALS[1],
      },
      {
        wave: 2,
        label: "Wave 2: Multi-Site Mid-Study Cohort",
        releaseDay: 14,
        siteIds: ["SITE-A", "SITE-B"],
        encounterIds: ["pd101_v2"],
        encounterNames: ["Week 2 Check (Day 14)"],
        scheduledAssessmentCount: 2,
        expectedCumulativeVsRecords: WAVE_VS_TOTALS[2],
      },
      {
        wave: 3,
        label: "Wave 3: Post-Amendment Global Cohort",
        releaseDay: 24,
        siteIds: ["SITE-A", "SITE-B", "SITE-C"],
        encounterIds: ["pd101_v3"],
        encounterNames: ["Post-Amendment Follow-Up (Day 24)"],
        scheduledAssessmentCount: 3,
        expectedCumulativeVsRecords: WAVE_VS_TOTALS[3],
      },
    ],
  };
}

function partitionVisits(
  visits: readonly UsdmProtocolDriftVisit[]
): readonly [
  readonly UsdmProtocolDriftVisit[],
  readonly UsdmProtocolDriftVisit[],
  readonly UsdmProtocolDriftVisit[],
] {
  if (visits.length === 0) {
    const fallback: UsdmProtocolDriftVisit = {
      id: "enc_1",
      name: "Baseline",
      targetDay: 1,
      activityCount: 1,
    };
    return [[fallback], [fallback], [fallback]];
  }
  if (visits.length === 1) {
    return [visits, visits, visits];
  }
  if (visits.length === 2) {
    return [[visits[0]], [visits[0], visits[1]], [visits[1]]];
  }
  const cutOne = Math.max(1, Math.ceil(visits.length / 3));
  const cutTwo = Math.max(cutOne + 1, Math.ceil((visits.length * 2) / 3));
  return [
    visits.slice(0, cutOne),
    visits.slice(cutOne, cutTwo),
    visits.slice(cutTwo),
  ];
}

/**
 * Maps an active USDM v4 study schedule into Protocol Drift submission waves,
 * while keeping the classic PD-101 study available as an explicit preset.
 */
export function adaptUsdmScheduleToProtocolDrift(
  usdm: unknown,
  options: { readonly source?: ProtocolDriftScheduleSource } = {}
): AdaptedProtocolDriftSchedule {
  if (options.source === "pd-101") {
    return classicPd101Schedule();
  }
  const root = asRecord(usdm);
  const study = asRecord(root?.study);
  const version = asArray(study?.versions)[0];
  const design = asArray(version?.studyDesigns)[0];
  if (!version || !design) {
    return classicPd101Schedule();
  }

  const identifiers = asArray(version.studyIdentifiers);
  const studyId =
    asText(identifiers[0]?.text) ?? asText(study?.name) ?? STUDY_ID;
  const titles = asArray(version.titles);
  const studyTitle =
    asText(titles[0]?.text) ??
    asText(study?.label) ??
    asText(study?.description) ??
    studyId;
  const armNames = asArray(design.arms)
    .map((arm) => asText(arm.label) ?? asText(arm.name))
    .filter((name): name is string => name !== null);

  const timelines = asArray(design.scheduleTimelines);
  const instances = timelines.flatMap((tl) => asArray(tl.instances));
  const countByEncounter = new Map<string, number>();
  for (const instance of instances) {
    const encId = asText(instance.encounterId);
    if (!encId) continue;
    const actIds = Array.isArray(instance.activityIds)
      ? instance.activityIds.length
      : 1;
    countByEncounter.set(
      encId,
      (countByEncounter.get(encId) ?? 0) + Math.max(1, actIds)
    );
  }

  const rawEncounters = asArray(design.encounters);
  const fallbackActivityCount = Math.max(1, asArray(design.activities).length);
  const visits: UsdmProtocolDriftVisit[] = rawEncounters
    .map((enc, idx) => {
      const id = asText(enc.id) ?? `enc_${idx + 1}`;
      const name = asText(enc.label) ?? asText(enc.name) ?? `Visit ${idx + 1}`;
      return {
        id,
        name,
        targetDay: inferPlannedDay(enc, idx),
        activityCount: countByEncounter.get(id) ?? fallbackActivityCount,
      };
    })
    .sort((a, b) => a.targetDay - b.targetDay);

  const [w1, w2, w3] = partitionVisits(visits);
  const day1 = Math.max(1, w1[w1.length - 1]?.targetDay ?? 1);
  const day2 = Math.max(day1 + 7, w2[w2.length - 1]?.targetDay ?? day1 + 14);
  const day3 = Math.max(day2 + 7, w3[w3.length - 1]?.targetDay ?? day2 + 14);
  const amendmentDay = Math.max(day1 + 3, day3 - 4);

  const sumAssessments = (bucket: readonly UsdmProtocolDriftVisit[]) =>
    bucket.reduce((acc, item) => acc + Math.max(1, item.activityCount), 0);

  const c1 = sumAssessments(w1) * 6;
  const c2 = c1 + sumAssessments(w2) * 6;
  const c3 = c2 + sumAssessments(w3) * 6;

  return {
    source: "workspace",
    studyId,
    studyTitle,
    armNames: armNames.length > 0 ? armNames : ["Study Treatment"],
    amendmentDay,
    visits,
    waves: [
      {
        wave: 1,
        label: "Wave 1: Early Schedule Submissions",
        releaseDay: day1,
        siteIds: ["SITE-A"],
        encounterIds: w1.map((v) => v.id),
        encounterNames: w1.map((v) => v.name),
        scheduledAssessmentCount: sumAssessments(w1),
        expectedCumulativeVsRecords: c1,
      },
      {
        wave: 2,
        label: "Wave 2: Mid-Schedule Multi-Site Submissions",
        releaseDay: day2,
        siteIds: ["SITE-A", "SITE-B"],
        encounterIds: w2.map((v) => v.id),
        encounterNames: w2.map((v) => v.name),
        scheduledAssessmentCount: sumAssessments(w2),
        expectedCumulativeVsRecords: c2,
      },
      {
        wave: 3,
        label: "Wave 3: Late-Schedule & Amendment Submissions",
        releaseDay: day3,
        siteIds: ["SITE-A", "SITE-B", "SITE-C"],
        encounterIds: w3.map((v) => v.id),
        encounterNames: w3.map((v) => v.name),
        scheduledAssessmentCount: sumAssessments(w3),
        expectedCumulativeVsRecords: c3,
      },
    ],
  };
}
