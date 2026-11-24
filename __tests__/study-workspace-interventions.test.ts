// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { validateUsdmV4Document } from "@/lib/clinical-standards";
import {
  STUDY_EPOCH_TYPES,
  STUDY_INTERVENTION_ROLES,
  STUDY_INTERVENTION_TYPES,
  StudyDesignError,
  TAVR_SAVR_USDM,
  addStudyIntervention,
  applyStudyEdit,
  assignStudyIntervention,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  importUsdmStudy,
  projectStudyInterventions,
  removeStudyIntervention,
  unassignStudyIntervention,
  undoStudyEdit,
  updateStudyIntervention,
  type StudyEdit,
  type StudyWorkspace,
} from "@/lib/study-workspace";

/** Study interventions of the selected design (#3406). */

let reference: StudyWorkspace;

beforeAll(async () => {
  const result = await importUsdmStudy({ document: TAVR_SAVR_USDM });
  if (result.status !== "ok") throw new Error("fixture did not import");
  reference = result.workspace;
});

const apply = (workspace: StudyWorkspace, edit: StudyEdit) =>
  applyStudyEdit(workspace, emptyStudyEditHistory(), edit).workspace;

describe("study interventions", () => {
  it("lists the reference study's interventions with coded role, type and elements", () => {
    const views = projectStudyInterventions(reference);
    expect(views.map((view) => view.id)).toEqual([
      "int_rct_tavr",
      "int_rct_savr",
    ]);
    expect(views[0]).toMatchObject({
      name: "Vascular Dynamics TAVR System",
      role: { code: "C41161", decode: "Experimental Intervention" },
      type: { code: "C16830", decode: "Medical Device" },
      listed: true,
    });
    expect(views[0].elementIds).toHaveLength(1);
  });

  it("offers each term of its codelist from the pinned CT subset", () => {
    const subset = JSON.parse(
      readFileSync(
        path.resolve(import.meta.dirname, "fixtures/cdisc-ct/ct-subset.json"),
        "utf8"
      )
    ) as {
      concepts: Record<string, { memberOf: Record<string, string> }>;
    };
    const membersOf = (codelist: string) =>
      Object.entries(subset.concepts)
        .filter(([, concept]) => codelist in concept.memberOf)
        .map(([code]) => code)
        .sort();
    const codes = (terms: readonly { code: string }[]) =>
      terms.map((term) => term.code).sort();
    // Study Intervention Role, Intervention Type and Epoch (#4095).
    expect(codes(STUDY_INTERVENTION_ROLES)).toEqual(membersOf("C207417"));
    expect(codes(STUDY_INTERVENTION_TYPES)).toEqual(membersOf("C99078"));
    expect(codes(STUDY_EPOCH_TYPES)).toEqual(membersOf("C99079"));
    expect(() =>
      addStudyIntervention(reference, {
        name: "Unknown type",
        roleCode: "C41161",
        typeCode: "C99999999",
      })
    ).toThrow(StudyDesignError);
    expect(() =>
      addStudyIntervention(reference, {
        name: "  ",
        roleCode: "C41161",
        typeCode: "C16830",
      })
    ).toThrow(/needs a name/);
  });

  it("adds an intervention to a blank study, gives it in an element and keeps the document valid", async () => {
    const blank = (await createBlankStudyWorkspace()).workspace;
    const added = apply(
      blank,
      addStudyIntervention(blank, {
        name: "Sham procedure",
        description: "Groin puncture without valve deployment.",
        roleCode: "C753",
        typeCode: "C98769",
      })
    );
    const [view] = projectStudyInterventions(added);
    expect(view).toMatchObject({
      name: "Sham procedure",
      description: "Groin puncture without valve deployment.",
      role: { code: "C753" },
      type: { code: "C98769" },
      listed: true,
      elementIds: [],
    });
    expect(await validateUsdmV4Document(added.usdm)).toEqual(
      await validateUsdmV4Document(blank.usdm)
    );
  });

  it("assigns, unassigns and refuses duplicates and unknown ids", () => {
    const [tavr, savr] = projectStudyInterventions(reference);
    const element = tavr.elementIds[0];
    expect(() => assignStudyIntervention(reference, element, tavr.id)).toThrow(
      /already given/
    );
    const both = apply(
      reference,
      assignStudyIntervention(reference, element, savr.id)
    );
    expect([...projectStudyInterventions(both)[1].elementIds].sort()).toEqual(
      [...savr.elementIds, element].sort()
    );
    const back = apply(both, unassignStudyIntervention(both, element, savr.id));
    expect(projectStudyInterventions(back)[1].elementIds).toEqual(
      savr.elementIds
    );
    expect(() => unassignStudyIntervention(back, element, savr.id)).toThrow(
      /not given/
    );
    expect(() => assignStudyIntervention(reference, "nope", tavr.id)).toThrow(
      /no element/
    );
    expect(() => assignStudyIntervention(reference, element, "nope")).toThrow(
      /no intervention/
    );
  });

  it("edits name, description and codes, keeping the code ids", () => {
    const edit = updateStudyIntervention(reference, "int_rct_savr", {
      name: "Surgical valve",
      description: "",
      roleCode: "C68609",
      typeCode: "C98769",
    });
    const edited = apply(reference, edit);
    const view = projectStudyInterventions(edited)[1];
    expect(view).toMatchObject({
      name: "Surgical valve",
      description: "",
      role: { code: "C68609", decode: "Active Comparator" },
      type: { code: "C98769", decode: "Procedure" },
    });
    expect(edit.forward.some((op) => op.path.endsWith("/role"))).toBe(true);
    expect(() =>
      updateStudyIntervention(reference, "int_rct_savr", {})
    ).toThrow(/changes nothing/);
  });

  it("refuses a removal that would leave a reference behind, and undoes a removal", () => {
    const [tavr] = projectStudyInterventions(reference);
    // An element, an activity's procedure and an estimand name it.
    expect(() => removeStudyIntervention(reference, tavr.id)).toThrow(
      /still referenced/
    );
    const added = apply(
      reference,
      addStudyIntervention(reference, {
        name: "Embolic protection",
        roleCode: "C41161",
        typeCode: "C16830",
      })
    );
    const id = projectStudyInterventions(added)[2].id;
    const given = apply(
      added,
      assignStudyIntervention(added, tavr.elementIds[0], id)
    );
    expect(() => removeStudyIntervention(given, id)).toThrow(
      /still referenced/
    );
    const off = apply(
      given,
      unassignStudyIntervention(given, tavr.elementIds[0], id)
    );
    const removed = applyStudyEdit(
      off,
      emptyStudyEditHistory(),
      removeStudyIntervention(off, id)
    );
    expect(
      projectStudyInterventions(removed.workspace).map((v) => v.id)
    ).toEqual(["int_rct_tavr", "int_rct_savr"]);
    const undone = undoStudyEdit(removed.workspace, removed.history);
    expect(
      projectStudyInterventions(undone.workspace).map((v) => v.id)
    ).toEqual(["int_rct_tavr", "int_rct_savr", id]);
  });
});
