// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  type StudyProtocol,
  assignFormsToVisit,
  executeVisitCommand,
  unassignFormsFromVisit,
} from "@/lib/crf";
import {
  DEVICE_CARDIOVASCULAR_IMPLANT_PRESET,
  getOncologyPresetSync,
} from "@/lib/crf/presets";
import {
  assignFormToVisit,
  unassignFormFromVisit,
} from "@/components/crf/study-edit-ops";

/**
 * Binding a form to a visit is one operation with two front ends (epic
 * #3071, step 3): the studio's schedule grid and `crf visit assign`. Each
 * case runs both and compares the resulting schedules.
 */
const STUDIES: [string, StudyProtocol][] = [
  ["oncology example", getOncologyPresetSync()],
  ["TAVR device study", DEVICE_CARDIOVASCULAR_IMPLANT_PRESET],
];

/** A visit and a form that is not yet bound to it, plus one that is. */
function pick(study: StudyProtocol) {
  const visit =
    study.visits.find((v) =>
      study.forms.some((f) => !v.assignedFormIds.includes(f.id))
    ) ?? study.visits[0];
  const unbound = study.forms.find(
    (f) => !visit.assignedFormIds.includes(f.id)
  );
  if (!unbound) throw new Error("fixture needs a visit missing a form");
  return { visit, unbound };
}

function cli(
  study: StudyProtocol,
  action: "assign" | "unassign",
  args: string[]
) {
  const result = executeVisitCommand(study, action, args);
  expect(result.success, result.document).toBe(true);
  return result.updatedStudy as StudyProtocol;
}

describe.each(STUDIES)("binding forms on the %s", (_label, study) => {
  const { visit, unbound } = pick(study);

  it("binds a form identically in the studio and the CLI", () => {
    const fromStudio = assignFormToVisit(study, visit.id, unbound.id);
    const fromCli = cli(study, "assign", [visit.id, unbound.id]);
    expect(fromCli.visits).toEqual(fromStudio.visits);
    expect(
      fromStudio.visits.find((v) => v.id === visit.id)?.assignedFormIds
    ).toContain(unbound.id);
  });

  it("unbinds a form identically in the studio and the CLI", () => {
    const bound = assignFormToVisit(study, visit.id, unbound.id);
    const fromStudio = unassignFormFromVisit(bound, visit.id, unbound.id);
    const fromCli = cli(bound, "unassign", [visit.id, unbound.id]);
    expect(fromCli.visits).toEqual(fromStudio.visits);
    expect(fromStudio.visits).toEqual(study.visits);
  });

  it("accepts a visit name and a CDASH domain on the command line", () => {
    const byName = cli(study, "assign", [visit.name, unbound.domain]);
    expect(byName.visits).toEqual(
      assignFormToVisit(study, visit.id, unbound.id).visits
    );
  });

  it("leaves a form already bound where it is", () => {
    const once = assignFormToVisit(study, visit.id, unbound.id);
    expect(assignFormToVisit(once, visit.id, unbound.id).visits).toEqual(
      once.visits
    );
  });
});

describe("refusals", () => {
  const study = getOncologyPresetSync();
  const { visit, unbound } = pick(study);

  it("refuses an unknown form instead of binding the rest", () => {
    const result = assignFormsToVisit(study, visit.id, [
      unbound.id,
      "NOT_A_FORM",
    ]);
    expect(result).toEqual({
      ok: false,
      error: "Form 'NOT_A_FORM' not found in protocol.",
    });
    const fromCli = executeVisitCommand(study, "assign", [
      visit.id,
      unbound.id,
      "NOT_A_FORM",
    ]);
    expect(fromCli.success).toBe(false);
    expect(fromCli.error).toMatch(/NOT_A_FORM/);
  });

  it("refuses an unknown visit", () => {
    expect(
      unassignFormsFromVisit(study, "no-such-visit", [unbound.id])
    ).toEqual({
      ok: false,
      error: "Visit 'no-such-visit' not found in protocol.",
    });
  });

  it("leaves the studio's study unchanged when the operation is refused", () => {
    expect(assignFormToVisit(study, "no-such-visit", unbound.id)).toBe(study);
  });

  it("does not stamp lastModified; the caller does", () => {
    const result = assignFormsToVisit(study, visit.id, [unbound.id]);
    expect(result.ok && result.study.lastModified).toBe(study.lastModified);
  });
});
