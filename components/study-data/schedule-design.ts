/**
 * Projects a study definition onto what the page shows before and between
 * runs: the schedule view's design and the stage rail's definition counts.
 * The server page uses it for DEMO-301 and the pipeline worker for a study
 * handed over from CRF Studio.
 */
import type { StudyDefinition } from "@/lib/study-data";
import type { ScheduleDesign } from "./ScheduleViewer";
import type { DefinitionCounts } from "./StageRail";

/** The parts of a study definition the schedule view shows. */
export function toScheduleDesign(definition: StudyDefinition): ScheduleDesign {
  const { design } = definition;
  return {
    studyId: definition.studyId,
    title: definition.title,
    phase: design.phase,
    blinding: design.blinding,
    arms: design.arms.map((arm) => ({ id: arm.id, name: arm.name })),
    visits: design.visits.map((visit) => ({
      id: visit.id,
      name: visit.name,
      visitNum: visit.visitNum,
      targetDay: visit.targetDay,
      windowBefore: visit.windowBefore,
      windowAfter: visit.windowAfter,
    })),
    activities: design.activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      domain: activity.domain,
      tests: activity.assessments.map((assessment) => assessment.testCode),
    })),
    schedule: design.schedule.map((cell) => ({
      visitId: cell.visitId,
      activityId: cell.activityId,
    })),
  };
}

/** The study definition counts on the stage rail. */
export function toDefinitionCounts(
  definition: StudyDefinition
): DefinitionCounts {
  const { design } = definition;
  return {
    arms: design.arms.length,
    visits: design.visits.length,
    activities: design.activities.length,
    scheduled: design.schedule.length,
  };
}
