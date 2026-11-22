// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  validateUsdmV4Document,
  type UsdmV4Document,
} from "@/lib/clinical-standards";
import {
  StudyPatchError,
  TAVR_SAVR_USDM,
  applyStudyEdit,
  applyStudyPatch,
  createBlankStudyWorkspace,
  createStudyEdit,
  emptyStudyEditHistory,
  exportValidatedStudyUsdm,
  importUsdmStudy,
  redoStudyEdit,
  undoStudyEdit,
  type StudyPatchOperation,
  type StudyWorkspace,
} from "@/lib/study-workspace";

/**
 * The blank workspace envelope, reversible edits and validating export
 * (#3399, ADR 0074).
 */

const DESIGN = "/study/versions/0/studyDesigns/0";

async function blank(): Promise<StudyWorkspace> {
  return (await createBlankStudyWorkspace({ name: "Blank study" })).workspace;
}

async function exported(workspace: StudyWorkspace): Promise<string> {
  const result = await exportValidatedStudyUsdm(workspace);
  if (result.status !== "ok") throw new Error(result.issues.join("\n"));
  return result.json;
}

const ADD_EPOCH: StudyPatchOperation = {
  op: "add",
  path: `${DESIGN}/epochs/-`,
  value: {
    id: "StudyEpoch_1",
    name: "Screening",
    type: {
      id: "Code_2",
      code: "C48262",
      codeSystem: "http://www.cdisc.org",
      codeSystemVersion: "2026-09-25",
      decode: "Screening",
      instanceType: "Code",
    },
    instanceType: "StudyEpoch",
  },
};

describe("blank study workspace", () => {
  it("exports a USDM v4 document that passes the schema", async () => {
    const result = await createBlankStudyWorkspace();
    expect(result.schemaIssues).toEqual([]);
    expect(await validateUsdmV4Document(result.workspace.usdm)).toEqual([]);
    expect(result.workspace.usdm.study.name).toBe("Untitled study");
    expect(result.workspace.revision).toMatchObject({
      id: "R1",
      parentId: null,
      note: "Started from a blank study.",
    });
  });

  it("lists every value it fills in only for the schema", async () => {
    const { placeholders } = await createBlankStudyWorkspace();
    expect(placeholders.map((p) => p.label)).toEqual([
      "Study version",
      "Design name",
      "Population",
      "Includes healthy subjects",
      "Intervention model",
    ]);
    expect(placeholders.at(-1)?.value).toBe("Parallel Study (C82639)");
  });

  it("is byte-identical across two runs", async () => {
    const first = await exported(await blank());
    const second = await exported(await blank());
    expect(second).toBe(first);
    expect((await blank()).revision.sha256).toBe(
      (await blank()).revision.sha256
    );
  });
});

describe("reversible study edits", () => {
  it("round-trips an edit through undo and redo", async () => {
    const start = await blank();
    const before = await exported(start);
    const edit = createStudyEdit(
      start,
      [
        ADD_EPOCH,
        { op: "replace", path: `${DESIGN}/name`, value: "Main design" },
      ],
      "Add a screening epoch"
    );

    const edited = applyStudyEdit(start, emptyStudyEditHistory(), edit);
    const after = await exported(edited.workspace);
    expect(after).not.toBe(before);
    expect(edited.workspace.revision).toMatchObject({
      id: "R2",
      parentId: "R1",
      note: "Add a screening epoch",
    });

    const undone = undoStudyEdit(edited.workspace, edited.history);
    expect(await exported(undone.workspace)).toBe(before);
    expect(undone.workspace.revision).toMatchObject({
      id: "R3",
      note: "Undo: Add a screening epoch",
    });
    expect(undone.history).toEqual({ undo: [], redo: [edit] });

    const redone = redoStudyEdit(undone.workspace, undone.history);
    expect(await exported(redone.workspace)).toBe(after);
    expect(redone.workspace.revision.id).toBe("R4");
    expect(redone.history).toEqual({ undo: [edit], redo: [] });
  });

  it("clears the redo stack when a new edit is made", async () => {
    const start = await blank();
    const first = applyStudyEdit(
      start,
      emptyStudyEditHistory(),
      createStudyEdit(start, [ADD_EPOCH], "Add epoch")
    );
    const undone = undoStudyEdit(first.workspace, first.history);
    const rename = createStudyEdit(
      undone.workspace,
      [{ op: "replace", path: "/study/name", value: "Renamed" }],
      "Rename"
    );
    const next = applyStudyEdit(undone.workspace, undone.history, rename);
    expect(next.history).toEqual({ undo: [rename], redo: [] });
  });

  it("restores removed and nested content exactly", async () => {
    const imported = await importUsdmStudy({ document: TAVR_SAVR_USDM });
    if (imported.status !== "ok") throw new Error(imported.status);
    const start = imported.workspace;
    const before = await exported(start);
    const edit = createStudyEdit(
      start,
      [
        { op: "remove", path: `${DESIGN}/arms/0` },
        { op: "add", path: "/study/label", value: "Edited" },
        { op: "replace", path: `${DESIGN}/rationale`, value: "Changed" },
      ],
      "Several changes"
    );
    const edited = applyStudyEdit(start, emptyStudyEditHistory(), edit);
    const undone = undoStudyEdit(edited.workspace, edited.history);
    expect(await exported(undone.workspace)).toBe(before);
  });

  it("does nothing when there is nothing to undo or redo", async () => {
    const start = await blank();
    const history = emptyStudyEditHistory();
    expect(undoStudyEdit(start, history)).toEqual({
      workspace: start,
      history,
    });
    expect(redoStudyEdit(start, history)).toEqual({
      workspace: start,
      history,
    });
  });

  it("leaves the input document unchanged", async () => {
    const start = await blank();
    const copy = structuredClone(start.usdm);
    applyStudyPatch(start.usdm, [ADD_EPOCH]);
    expect(start.usdm).toEqual(copy);
  });

  it("rejects a path the document does not have, with no partial change", async () => {
    const start = await blank();
    const copy = structuredClone(start.usdm);
    expect(() =>
      createStudyEdit(
        start,
        [ADD_EPOCH, { op: "remove", path: `${DESIGN}/arms/3` }],
        "Bad"
      )
    ).toThrow(StudyPatchError);
    expect(() =>
      applyStudyPatch(start.usdm, [{ op: "replace", path: "study", value: 1 }])
    ).toThrow(StudyPatchError);
    expect(start.usdm).toEqual(copy);
  });

  it("reports schema issues instead of exporting an invalid document", async () => {
    const start = await blank();
    const broken = applyStudyEdit(
      start,
      emptyStudyEditHistory(),
      createStudyEdit(start, [{ op: "remove", path: "/study/name" }], "Break")
    );
    const result = await exportValidatedStudyUsdm(broken.workspace);
    expect(result.status).toBe("invalid");
    expect((result as { issues: readonly string[] }).issues.join("\n")).toMatch(
      /study\.name/
    );
    const usdm: UsdmV4Document = broken.workspace.usdm;
    expect(usdm.study).not.toHaveProperty("name");
  });
});
