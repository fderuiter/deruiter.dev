// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canonicalUsdmJson,
  validateUsdmV4Document,
} from "@/lib/clinical-standards";
import {
  STUDY_ARM_TYPES,
  STUDY_EPOCH_TYPES,
  STUDY_PHASE_TYPES,
  StudyDesignError,
  TAVR_SAVR_USDM,
  addStudyArm,
  addStudyElement,
  addStudyEpoch,
  applyStudyEdit,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  exportValidatedStudyUsdm,
  importUsdmStudy,
  moveStudyArm,
  moveStudyElement,
  moveStudyEpoch,
  projectStudyDesignGrid,
  projectStudyMetadata,
  redoStudyEdit,
  removeStudyArm,
  removeStudyElement,
  removeStudyEpoch,
  renameStudyArm,
  renameStudyElement,
  renameStudyEpoch,
  undoStudyEdit,
  updateStudyMetadata,
  type StudyEdit,
  type StudyWorkspace,
} from "@/lib/study-workspace";

/** The arms-by-epochs grid and its operations (#3401, ADR 0074). */

const EXPERIMENTAL = "C174266";
const COMPARATOR = "C174267";
const SCREENING = "C202487";
const TREATMENT = "C101526";
const FOLLOW_UP = "C202578";

async function blank(): Promise<StudyWorkspace> {
  return (await createBlankStudyWorkspace({ name: "Grid study" })).workspace;
}

async function tavrSavr(): Promise<StudyWorkspace> {
  const result = await importUsdmStudy({ document: TAVR_SAVR_USDM });
  if (result.status !== "ok") throw new Error(result.status);
  return result.workspace;
}

/** Applies edits in turn, each made against the latest workspace. */
function run(
  start: StudyWorkspace,
  ...steps: ((workspace: StudyWorkspace) => StudyEdit)[]
) {
  let workspace = start;
  let history = emptyStudyEditHistory();
  for (const step of steps) {
    ({ workspace, history } = applyStudyEdit(
      workspace,
      history,
      step(workspace)
    ));
  }
  return { workspace, history };
}

/** A two-arm, three-epoch design built from a blank study. */
async function built(): Promise<StudyWorkspace> {
  return run(
    await blank(),
    (w) => addStudyArm(w, { name: "Device", typeCode: EXPERIMENTAL }),
    (w) => addStudyArm(w, { name: "Surgery", typeCode: COMPARATOR }),
    (w) => addStudyEpoch(w, { name: "Screening", typeCode: SCREENING }),
    (w) => addStudyEpoch(w, { name: "Procedure", typeCode: TREATMENT }),
    (w) => addStudyEpoch(w, { name: "Follow-up", typeCode: FOLLOW_UP })
  ).workspace;
}

interface LooseDesign {
  arms: { name: string }[];
  epochs: { previousId?: string | null; nextId?: string | null }[];
  studyCells: { armId: string; elementIds: string[] }[];
  elements?: unknown[];
  population: { armIds?: string[] };
}

/** The first design of the first version, as loose JSON. */
const designOf = (workspace: StudyWorkspace): LooseDesign =>
  (
    workspace.usdm as unknown as {
      study: { versions: { studyDesigns: LooseDesign[] }[] };
    }
  ).study.versions[0].studyDesigns[0];

const names = (items: readonly { name: string }[]) => items.map((i) => i.name);

describe("design grid projection", () => {
  it("gives every arm and epoch pair a cell or a finding", async () => {
    const grid = projectStudyDesignGrid(await tavrSavr());
    expect(names(grid.arms)).toEqual(["TAVR System", "Surgical AVR"]);
    expect(names(grid.epochs)).toEqual([
      "Screening Epoch",
      "Index Procedure Epoch",
      "Follow-Up Epoch",
    ]);
    expect(grid.findings).toEqual([]);
    for (const row of grid.rows) {
      expect(row.cells).toHaveLength(3);
      for (const cell of row.cells) {
        expect(cell.cellId).not.toBeNull();
        expect(cell.elements).toHaveLength(1);
      }
    }
    expect(grid.arms[0].type).toEqual({
      code: EXPERIMENTAL,
      decode: "Experimental Arm",
    });
  });

  it("reports a missing cell instead of inventing one", async () => {
    const grid = projectStudyDesignGrid(await built());
    expect(grid.findings).toHaveLength(6);
    expect(grid.findings.every((f) => f.kind === "missing-cell")).toBe(true);
    expect(grid.findings[0].message).toBe("Device has no cell in Screening.");
    expect(grid.rows[0].cells[0]).toMatchObject({ cellId: null, elements: [] });
  });

  it("orders epochs by their previous and next links", async () => {
    const workspace = await tavrSavr();
    const design = designOf(workspace);
    design.epochs.reverse();
    const grid = projectStudyDesignGrid(workspace);
    expect(names(grid.epochs)).toEqual([
      "Screening Epoch",
      "Index Procedure Epoch",
      "Follow-Up Epoch",
    ]);
  });

  it("reports a broken epoch chain and keeps file order", async () => {
    const workspace = await tavrSavr();
    const design = designOf(workspace);
    design.epochs[0].nextId = null;
    const grid = projectStudyDesignGrid(workspace);
    expect(grid.findings.map((f) => f.kind)).toEqual(["epoch-order"]);
    expect(grid.epochs[0].name).toBe("Screening Epoch");
  });

  it("reports cells and elements the design does not have", async () => {
    const workspace = await tavrSavr();
    const design = designOf(workspace);
    design.studyCells[0].elementIds.push("StudyElement_missing");
    design.studyCells[1].armId = "arm_gone";
    const kinds = projectStudyDesignGrid(workspace).findings.map((f) => f.kind);
    expect(kinds).toEqual(["orphan-cell", "unknown-element", "missing-cell"]);
  });
});

describe("design grid operations", () => {
  it("builds a design that passes the USDM v4 schema", async () => {
    let workspace = await built();
    const grid = projectStudyDesignGrid(workspace);
    for (const row of grid.rows) {
      for (const cell of row.cells) {
        ({ workspace } = run(workspace, (w) =>
          addStudyElement(w, {
            armId: cell.armId,
            epochId: cell.epochId,
            name: `${row.arm.name} ${cell.epochId}`,
          })
        ));
      }
    }
    expect(projectStudyDesignGrid(workspace).findings).toEqual([]);
    expect(await validateUsdmV4Document(workspace.usdm)).toEqual([]);
    const epochs = projectStudyDesignGrid(workspace).epochs;
    const raw = designOf(workspace).epochs;
    expect(raw.map((e) => [e.previousId, e.nextId])).toEqual([
      [null, epochs[1].id],
      [epochs[0].id, epochs[2].id],
      [epochs[1].id, null],
    ]);
  });

  it("gives new objects ids no other object has", async () => {
    const workspace = await tavrSavr();
    const edit = addStudyArm(workspace, {
      name: "Third",
      typeCode: EXPERIMENTAL,
    });
    const arm = edit.forward[0] as {
      value: { id: string; type: { id: string } };
    };
    expect(arm.value.id).toBe("StudyArm_1");
    expect(canonicalUsdmJson(workspace.usdm)).not.toContain(
      `"${arm.value.type.id}"`
    );
  });

  it("undoes every kind of edit exactly", async () => {
    const start = run(await built(), (w) =>
      addStudyElement(w, {
        armId: projectStudyDesignGrid(w).arms[0].id,
        epochId: projectStudyDesignGrid(w).epochs[0].id,
        name: "Heart team review",
      })
    ).workspace;
    const grid = projectStudyDesignGrid(start);
    const [device, surgery] = grid.arms;
    const [screening, procedure] = grid.epochs;
    const element = grid.rows[0].cells[0].elements[0];
    const edits: ((w: StudyWorkspace) => StudyEdit)[] = [
      (w) => renameStudyArm(w, device.id, "TAVR"),
      (w) => moveStudyArm(w, surgery.id, 0),
      (w) => removeStudyArm(w, device.id),
      (w) => renameStudyEpoch(w, screening.id, "Pre-procedure"),
      (w) => moveStudyEpoch(w, screening.id, 2),
      (w) => removeStudyEpoch(w, procedure.id),
      (w) => renameStudyElement(w, element.id, "Heart team"),
      (w) =>
        moveStudyElement(w, {
          elementId: element.id,
          from: { armId: device.id, epochId: screening.id },
          to: { armId: surgery.id, epochId: procedure.id },
        }),
      (w) =>
        removeStudyElement(w, {
          elementId: element.id,
          armId: device.id,
          epochId: screening.id,
        }),
    ];
    const before = canonicalUsdmJson(start.usdm);
    for (const make of edits) {
      const edited = run(start, make);
      expect(canonicalUsdmJson(edited.workspace.usdm)).not.toBe(before);
      const undone = undoStudyEdit(edited.workspace, edited.history);
      expect(canonicalUsdmJson(undone.workspace.usdm)).toBe(before);
    }
  });

  it("moves an arm and an epoch to the asked position", async () => {
    const start = await built();
    const grid = projectStudyDesignGrid(start);
    const moved = run(
      start,
      (w) => moveStudyArm(w, grid.arms[1].id, 0),
      (w) => moveStudyEpoch(w, grid.epochs[2].id, 0)
    ).workspace;
    const after = projectStudyDesignGrid(moved);
    expect(names(after.arms)).toEqual(["Surgery", "Device"]);
    expect(names(after.epochs)).toEqual([
      "Follow-up",
      "Screening",
      "Procedure",
    ]);
  });

  it("moves an element to another cell, creating that cell", async () => {
    const start = await built();
    const grid = projectStudyDesignGrid(start);
    const [a, b] = grid.arms;
    const [e1, e2] = grid.epochs;
    const { workspace } = run(
      start,
      (w) => addStudyElement(w, { armId: a.id, epochId: e1.id, name: "First" }),
      (w) => addStudyElement(w, { armId: a.id, epochId: e1.id, name: "Second" })
    );
    const [first, second] =
      projectStudyDesignGrid(workspace).rows[0].cells[0].elements;
    const reordered = run(workspace, (w) =>
      moveStudyElement(w, {
        elementId: second.id,
        from: { armId: a.id, epochId: e1.id },
        to: { armId: a.id, epochId: e1.id },
        index: 0,
      })
    ).workspace;
    expect(
      names(projectStudyDesignGrid(reordered).rows[0].cells[0].elements)
    ).toEqual(["Second", "First"]);
    const moved = run(workspace, (w) =>
      moveStudyElement(w, {
        elementId: first.id,
        from: { armId: a.id, epochId: e1.id },
        to: { armId: b.id, epochId: e2.id },
      })
    ).workspace;
    const after = projectStudyDesignGrid(moved);
    expect(names(after.rows[0].cells[0].elements)).toEqual(["Second"]);
    expect(names(after.rows[1].cells[1].elements)).toEqual(["First"]);
  });

  it("removes an arm with its cells and the elements only they used", async () => {
    const start = await built();
    const grid = projectStudyDesignGrid(start);
    const { workspace } = run(start, (w) =>
      addStudyElement(w, {
        armId: grid.arms[0].id,
        epochId: grid.epochs[0].id,
        name: "Only here",
      })
    );
    const removed = run(workspace, (w) =>
      removeStudyArm(w, grid.arms[0].id)
    ).workspace;
    const design = designOf(removed);
    expect(design.studyCells).toEqual([]);
    expect(design.elements).toEqual([]);
    expect(names(design.arms)).toEqual(["Surgery"]);
  });

  it("refuses to remove an arm another part of the study names", async () => {
    const workspace = await tavrSavr();
    const design = designOf(workspace);
    design.population.armIds = ["arm_rct_tavr"];
    expect(() => removeStudyArm(workspace, "arm_rct_tavr")).toThrow(
      /still referenced/
    );
  });

  it("rejects unknown ids, empty names and uncited terms", async () => {
    const workspace = await built();
    expect(() => renameStudyArm(workspace, "nope", "X")).toThrow(
      StudyDesignError
    );
    expect(() =>
      addStudyArm(workspace, { name: "  ", typeCode: EXPERIMENTAL })
    ).toThrow(StudyDesignError);
    expect(() =>
      addStudyEpoch(workspace, { name: "Run", typeCode: "C99999" })
    ).toThrow(/not an epoch type term/);
  });

  it("offers only codes the CT package defines", () => {
    expect(STUDY_ARM_TYPES.map((t) => t.code)).toContain(EXPERIMENTAL);
    expect(STUDY_EPOCH_TYPES.map((t) => t.code)).toEqual(
      expect.arrayContaining([SCREENING, TREATMENT, FOLLOW_UP])
    );
    expect(STUDY_PHASE_TYPES.map((t) => t.code)).toEqual([
      "C15600",
      "C15693",
      "C15601",
      "C15602",
      "C15603",
    ]);
  });

  it("updates study metadata with undo, redo, and valid USDM v4 export on reference and blank studies", async () => {
    const start = await tavrSavr();
    expect(projectStudyMetadata(start)).toEqual({
      protocolId: "DEV-2026-VALVE-RCT",
      studyName: "DEV-2026-VALVE-RCT",
      phase: { code: "C15602", decode: "Phase III Trial" },
    });
    const beforeJson = canonicalUsdmJson(start.usdm);

    const edited = run(start, (w) =>
      updateStudyMetadata(w, {
        protocolId: "VALVE-2027-P2",
        studyName: "Next-Gen Valve Study",
        phaseCode: "C15601",
      })
    );
    expect(projectStudyMetadata(edited.workspace)).toEqual({
      protocolId: "VALVE-2027-P2",
      studyName: "Next-Gen Valve Study",
      phase: { code: "C15601", decode: "Phase II Trial" },
    });
    const exportedRef = await exportValidatedStudyUsdm(edited.workspace);
    expect(exportedRef.status).toBe("ok");

    const undone = undoStudyEdit(edited.workspace, edited.history);
    expect(canonicalUsdmJson(undone.workspace.usdm)).toBe(beforeJson);
    const redone = redoStudyEdit(undone.workspace, undone.history);
    expect(projectStudyMetadata(redone.workspace).protocolId).toBe(
      "VALVE-2027-P2"
    );

    const blankStart = await blank();
    expect(projectStudyMetadata(blankStart)).toEqual({
      protocolId: "",
      studyName: "Grid study",
      phase: null,
    });
    const blankEdited = run(blankStart, (w) =>
      updateStudyMetadata(w, {
        protocolId: "BLANK-001",
        studyName: "Authored Blank Trial",
        phaseCode: "C15600",
      })
    );
    expect(projectStudyMetadata(blankEdited.workspace)).toEqual({
      protocolId: "BLANK-001",
      studyName: "Authored Blank Trial",
      phase: { code: "C15600", decode: "Phase I Trial" },
    });
    const exportedBlank = await exportValidatedStudyUsdm(blankEdited.workspace);
    expect(exportedBlank.status).toBe("ok");

    const cleared = run(blankEdited.workspace, (w) =>
      updateStudyMetadata(w, { protocolId: "", phaseCode: null })
    );
    expect(projectStudyMetadata(cleared.workspace)).toEqual({
      protocolId: "",
      studyName: "Authored Blank Trial",
      phase: null,
    });
    expect((await exportValidatedStudyUsdm(cleared.workspace)).status).toBe(
      "ok"
    );

    expect(() => updateStudyMetadata(blankStart, { studyName: "   " })).toThrow(
      StudyDesignError
    );
    expect(() =>
      updateStudyMetadata(blankStart, { phaseCode: "C99999" })
    ).toThrow(/not a study phase term|not an study phase term/);
  });
});
