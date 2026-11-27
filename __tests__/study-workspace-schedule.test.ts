import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  STUDY_ENCOUNTER_TYPES,
  StudyDesignError,
  TAVR_DEVICE_USDM,
  TAVR_SAVR_USDM,
  addStudyActivity,
  addStudyEncounter,
  applyStudyEdit,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  exportValidatedStudyUsdm,
  importUsdmStudy,
  moveStudyActivity,
  moveStudyEncounter,
  projectStudySchedule,
  redoStudyEdit,
  removeStudyActivity,
  removeStudyEncounter,
  renameStudyActivity,
  renameStudyEncounter,
  toggleStudyScheduledActivity,
  undoStudyEdit,
  updateStudyEncounterTiming,
  type StudyEdit,
  type StudyWorkspace,
} from "@/lib/study-workspace";

let rctWorkspace: StudyWorkspace;
let deviceWorkspace: StudyWorkspace;

beforeAll(async () => {
  const rct = await importUsdmStudy({ document: TAVR_SAVR_USDM });
  const dev = await importUsdmStudy({ document: TAVR_DEVICE_USDM });
  if (rct.status !== "ok" || dev.status !== "ok") {
    throw new Error("Reference studies failed to import.");
  }
  rctWorkspace = rct.workspace;
  deviceWorkspace = dev.workspace;
});

function apply(ws: StudyWorkspace, edit: StudyEdit): StudyWorkspace {
  return applyStudyEdit(ws, emptyStudyEditHistory(), edit).workspace;
}

describe("study workspace schedule view and operations", () => {
  it("projects reference schedules ordered by study day with exact link counts", () => {
    const rct = projectStudySchedule(rctWorkspace);
    expect(rct.visits).toHaveLength(7);
    expect(rct.activities).toHaveLength(10);
    expect(rct.scheduledLinkCount).toBe(37);
    expect(rct.visits.map((v) => v.targetDay)).toEqual([
      -1,
      1,
      3,
      30,
      180,
      365,
      null,
    ]);
    expect(rct.anchorEncounterId).toBe("v_rct_implant");
    expect(rct.visits.at(-1)?.isUnscheduled).toBe(true);
    expect(rct.findings).toEqual([]);

    const dev = projectStudySchedule(deviceWorkspace);
    expect(dev.visits).toHaveLength(7);
    expect(dev.activities).toHaveLength(8);
    expect(dev.scheduledLinkCount).toBe(23);
    expect(dev.findings.map((f) => f.kind)).toEqual(["activity-order"]);
  });

  it("matches the Encounter Type codelist in the pinned CT subset", () => {
    const subset = JSON.parse(
      readFileSync(
        path.resolve(import.meta.dirname, "fixtures/cdisc-ct/ct-subset.json"),
        "utf8"
      )
    ) as {
      concepts: Record<string, { memberOf: Record<string, string> }>;
    };
    const members = Object.entries(subset.concepts)
      .filter(([, concept]) => "C188728" in concept.memberOf)
      .map(([code]) => code)
      .sort();
    expect(STUDY_ENCOUNTER_TYPES.map((t) => t.code).sort()).toEqual(members);
  });

  it("toggles scheduled activities with undo and redo revision increments", async () => {
    const edit = toggleStudyScheduledActivity(
      rctWorkspace,
      "v_rct_30d",
      "form_dm_rct"
    );
    const step1 = applyStudyEdit(rctWorkspace, emptyStudyEditHistory(), edit);
    expect(step1.workspace.revision.id).toBe("R2");
    expect(projectStudySchedule(step1.workspace).scheduledLinkCount).toBe(38);

    const undone = undoStudyEdit(step1.workspace, step1.history);
    expect(undone.workspace.revision.id).toBe("R3");
    expect(projectStudySchedule(undone.workspace).scheduledLinkCount).toBe(37);

    const redone = redoStudyEdit(undone.workspace, undone.history);
    expect(redone.workspace.revision.id).toBe("R4");
    expect(projectStudySchedule(redone.workspace).scheduledLinkCount).toBe(38);

    const exported = await exportValidatedStudyUsdm(redone.workspace);
    expect(exported.status).toBe("ok");
  });

  it("detects visit window overlaps naming both visits and overlapping day count", async () => {
    const edited = apply(
      rctWorkspace,
      updateStudyEncounterTiming(rctWorkspace, "v_rct_30d", {
        targetDay: 30,
        windowBefore: 28,
        windowAfter: 7,
      })
    );
    const projected = projectStudySchedule(edited);
    expect(projected.windowConflicts.hasConflicts).toBe(true);
    const conflict = projected.windowConflicts.conflicts.find(
      (c) => c.visitIdA === "v_rct_disch" && c.visitIdB === "v_rct_30d"
    );
    expect(conflict).toBeDefined();
    expect(conflict?.overlapDays).toBe(3);
    expect(conflict?.message).toContain("Pre-Discharge Assessment");
    expect(conflict?.message).toContain("30-Day Follow-up");
    expect(conflict?.message).toContain("3 day(s)");

    const exported = await exportValidatedStudyUsdm(edited);
    expect(exported.status).toBe("ok");
  });

  it("builds a complete valid schedule from a blank study and supports rename, move, and remove", async () => {
    let ws = (await createBlankStudyWorkspace()).workspace;
    // Blank study reports missing-timeline instead of inventing one.
    expect(projectStudySchedule(ws).findings.map((f) => f.kind)).toEqual([
      "missing-timeline",
    ]);

    // Adding an untimed visit first surfaces missing-anchor-timing.
    ws = apply(ws, addStudyEncounter(ws, { name: "Unscheduled Safety Visit" }));
    expect(
      projectStudySchedule(ws).findings.some(
        (f) => f.kind === "missing-anchor-timing"
      )
    ).toBe(true);

    // Setting a relative day before a Day 1 anchor exists is refused clearly.
    expect(() =>
      addStudyEncounter(ws, { name: "Screening", targetDay: -7 })
    ).toThrow(StudyDesignError);

    // Add Day 1 anchor visit, then Screening at Day -7 and Week 4 at Day 28.
    ws = apply(
      ws,
      addStudyEncounter(ws, {
        name: "Baseline / Day 1",
        targetDay: 1,
        windowBefore: 0,
        windowAfter: 0,
      })
    );
    ws = apply(
      ws,
      addStudyEncounter(ws, {
        name: "Screening",
        targetDay: -7,
        windowBefore: 7,
        windowAfter: 3,
      })
    );
    ws = apply(
      ws,
      addStudyEncounter(ws, {
        name: "Week 4 Follow-up",
        targetDay: 28,
        windowBefore: 3,
        windowAfter: 3,
      })
    );

    // Add two activities, schedule them, rename, and reorder.
    ws = apply(ws, addStudyActivity(ws, { name: "Informed Consent" }));
    ws = apply(ws, addStudyActivity(ws, { name: "Vital Signs" }));

    let sched = projectStudySchedule(ws);
    expect(sched.visits.map((v) => v.name)).toEqual([
      "Screening",
      "Baseline / Day 1",
      "Week 4 Follow-up",
      "Unscheduled Safety Visit",
    ]);

    const consentId = sched.activities[0].id;
    const vitalsId = sched.activities[1].id;
    const screenId = sched.visits[0].id;
    const anchorId = sched.visits[1].id;

    ws = apply(ws, toggleStudyScheduledActivity(ws, screenId, consentId));
    ws = apply(ws, toggleStudyScheduledActivity(ws, anchorId, vitalsId));
    ws = apply(ws, renameStudyEncounter(ws, screenId, "Screening Visit"));
    ws = apply(ws, renameStudyActivity(ws, vitalsId, "Resting Vital Signs"));
    ws = apply(ws, moveStudyActivity(ws, vitalsId, 0));
    ws = apply(ws, moveStudyEncounter(ws, screenId, 0));

    // Refuses Day 0 per SDTM study day convention.
    expect(() =>
      updateStudyEncounterTiming(ws, screenId, { targetDay: 0 })
    ).toThrow(/Day 0/);

    // Refuses removing the anchor while other visits depend on it.
    expect(() => removeStudyEncounter(ws, anchorId)).toThrow(/depend on/);

    // Clear timing on non-anchor visit, remove it, and remove an activity.
    ws = apply(
      ws,
      updateStudyEncounterTiming(ws, screenId, { targetDay: null })
    );
    ws = apply(ws, removeStudyEncounter(ws, screenId));
    ws = apply(ws, removeStudyActivity(ws, consentId));

    sched = projectStudySchedule(ws);
    expect(sched.activities.map((a) => a.name)).toEqual([
      "Resting Vital Signs",
    ]);
    expect(sched.scheduledLinkCount).toBe(1);

    const exported = await exportValidatedStudyUsdm(ws);
    expect(exported).toMatchObject({ status: "ok" });
  });

  it("surfaces explicit findings for broken chains, unscheduled encounters, and unknown refs", () => {
    const broken = structuredClone(rctWorkspace);
    const design = broken.usdm.study.versions![0].studyDesigns![0];
    // Break previousId/nextId chains and add dangling timeline references.
    design.encounters![0].previousId = "non_existent";
    design.activities![0].previousId = "non_existent";
    design.encounters!.push({
      id: "enc_orphan",
      name: "Day 90 Visit",
      type: design.encounters![0].type,
      instanceType: "Encounter",
    });
    design.scheduleTimelines![0].instances!.push({
      id: "sai_ghost",
      name: "Ghost instance",
      encounterId: "missing_enc",
      activityIds: ["missing_act"],
      instanceType: "ScheduledActivityInstance",
    });

    const sched = projectStudySchedule(broken);
    const kinds = sched.findings.map((f) => f.kind);
    expect(kinds).toContain("encounter-order");
    expect(kinds).toContain("activity-order");
    expect(kinds).toContain("unscheduled-encounter");
    expect(kinds).toContain("unknown-encounter");
    expect(kinds).toContain("unknown-activity");
  });
});
