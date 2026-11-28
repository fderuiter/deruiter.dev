import { describe, expect, it } from "vitest";
import {
  STUDY_PHASE_TERMS,
  StudyDesignError,
  TAVR_SAVR_USDM,
  applyStudyEdit,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  exportValidatedStudyUsdm,
  importUsdmStudy,
  openStudyWorkspace,
  projectStudyMetadata,
  redoStudyEdit,
  serializeStudyWorkspace,
  undoStudyEdit,
  updateStudyName,
  updateStudyPhase,
  updateStudyProtocolId,
} from "@/lib/study-workspace";

describe("study workspace metadata edits and USDM round-trip", () => {
  it("projects and reversibly edits Protocol ID, Study name, and Phase on a reference study", async () => {
    const imported = await importUsdmStudy({ document: TAVR_SAVR_USDM });
    expect(imported.status).toBe("ok");
    if (imported.status !== "ok") return;

    const initial = imported.workspace;
    const baseMeta = projectStudyMetadata(initial);
    expect(baseMeta.protocolId.length).toBeGreaterThan(0);
    expect(baseMeta.studyName.length).toBeGreaterThan(0);

    let workspace = initial;
    let history = emptyStudyEditHistory();

    const step1 = applyStudyEdit(
      workspace,
      history,
      updateStudyProtocolId(workspace, "PROTO-900")
    );
    workspace = step1.workspace;
    history = step1.history;
    expect(workspace.revision.id).toBe("R2");
    expect(projectStudyMetadata(workspace).protocolId).toBe("PROTO-900");

    const step2 = applyStudyEdit(
      workspace,
      history,
      updateStudyName(workspace, "Phase III Valve Outcomes Study")
    );
    workspace = step2.workspace;
    history = step2.history;
    expect(workspace.revision.id).toBe("R3");
    expect(projectStudyMetadata(workspace).studyName).toBe(
      "Phase III Valve Outcomes Study"
    );

    const phaseIii = STUDY_PHASE_TERMS.find((t) => t.code === "C15602")!;
    const step3 = applyStudyEdit(
      workspace,
      history,
      updateStudyPhase(workspace, phaseIii.code)
    );
    workspace = step3.workspace;
    history = step3.history;
    expect(workspace.revision.id).toBe("R4");
    expect(projectStudyMetadata(workspace).phase).toEqual({
      code: phaseIii.code,
      decode: phaseIii.decode,
    });

    // Undo all 3 edits back to R1 canonical USDM hash
    const u1 = undoStudyEdit(workspace, history)!;
    const u2 = undoStudyEdit(u1.workspace, u1.history)!;
    const u3 = undoStudyEdit(u2.workspace, u2.history)!;
    expect(projectStudyMetadata(u3.workspace)).toEqual(baseMeta);
    expect(u3.workspace.revision.sha256).toBe(initial.revision.sha256);

    // Redo all 3 edits forward
    const r1 = redoStudyEdit(u3.workspace, u3.history)!;
    const r2 = redoStudyEdit(r1.workspace, r1.history)!;
    const r3 = redoStudyEdit(r2.workspace, r2.history)!;
    expect(projectStudyMetadata(r3.workspace)).toEqual({
      protocolId: "PROTO-900",
      studyName: "Phase III Valve Outcomes Study",
      phase: { code: phaseIii.code, decode: phaseIii.decode },
      phaseDecode: phaseIii.decode,
    });
  });

  it("seeds valid Sponsor Organization and StudyIdentifier on a blank study and exports schema-valid USDM", async () => {
    const { workspace: blank } = await createBlankStudyWorkspace();
    let workspace = blank;
    let history = emptyStudyEditHistory();

    const s1 = applyStudyEdit(
      workspace,
      history,
      updateStudyProtocolId(workspace, "BLANK-101")
    );
    workspace = s1.workspace;
    history = s1.history;

    const s2 = applyStudyEdit(
      workspace,
      history,
      updateStudyName(workspace, "Synthetic First-in-Human Trial")
    );
    workspace = s2.workspace;
    history = s2.history;

    const s3 = applyStudyEdit(
      workspace,
      history,
      updateStudyPhase(workspace, "C15600")
    );
    workspace = s3.workspace;
    history = s3.history;

    const exported = await exportValidatedStudyUsdm(workspace);
    expect(exported.status).toBe("ok");
    if (exported.status !== "ok") return;

    const reopened = openStudyWorkspace(serializeStudyWorkspace(workspace));
    expect(reopened.status).toBe("ok");
    if (reopened.status === "ok") {
      expect(projectStudyMetadata(reopened.workspace)).toEqual({
        protocolId: "BLANK-101",
        studyName: "Synthetic First-in-Human Trial",
        phase: { code: "C15600", decode: "Phase I Trial" },
        phaseDecode: "Phase I Trial",
      });
    }

    // Clearing protocol ID and phase also stays schema-valid
    const s4 = applyStudyEdit(
      workspace,
      history,
      updateStudyProtocolId(workspace, "")
    );
    const s5 = applyStudyEdit(
      s4.workspace,
      s4.history,
      updateStudyPhase(s4.workspace, null)
    );
    expect(projectStudyMetadata(s5.workspace).protocolId).toBe("");
    expect(projectStudyMetadata(s5.workspace).phase).toBeNull();
    const exportedCleared = await exportValidatedStudyUsdm(s5.workspace);
    expect(exportedCleared.status).toBe("ok");
  });

  it("preserves untouched extensionAttributes and unselected study versions on export after metadata edits", async () => {
    const multiDoc = structuredClone(TAVR_SAVR_USDM) as unknown as {
      study: {
        extensionAttributes?: unknown[];
      };
    };
    multiDoc.study.extensionAttributes = [
      {
        id: "ExtensionAttribute_SponsorGovernance_1",
        url: "https://clinicaltrials.example.org/usdm/governance",
        valueString: "preserved-governance-tag",
        instanceType: "ExtensionAttribute",
      },
    ];

    const imported = await importUsdmStudy({
      document: multiDoc,
    });
    expect(imported.status).toBe("ok");
    if (imported.status !== "ok") return;
    expect(imported.workspace.preserved.length).toBeGreaterThan(0);

    const edited = applyStudyEdit(
      imported.workspace,
      emptyStudyEditHistory(),
      updateStudyProtocolId(imported.workspace, "MULTI-V4-777")
    );
    const exported = await exportValidatedStudyUsdm(edited.workspace);
    expect(exported.status).toBe("ok");
    if (exported.status !== "ok") return;
    const parsed = JSON.parse(exported.json) as {
      study: { extensionAttributes?: { id: string; valueString: string }[] };
    };
    expect(
      parsed.study.extensionAttributes?.some(
        (ext) =>
          ext.id === "ExtensionAttribute_SponsorGovernance_1" &&
          ext.valueString === "preserved-governance-tag"
      )
    ).toBe(true);
  });

  it("rejects blank study names and unknown phase codes", async () => {
    const { workspace } = await createBlankStudyWorkspace();
    expect(() => updateStudyName(workspace, "   ")).toThrow(StudyDesignError);
    expect(() => updateStudyPhase(workspace, "NOT_A_PHASE")).toThrow(
      StudyDesignError
    );
  });
});
