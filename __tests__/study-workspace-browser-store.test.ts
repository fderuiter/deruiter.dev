import { describe, expect, it } from "vitest";
import { CNS_NEURO_PRESET, exportStudyToUsdmObject } from "@/lib/crf";
import { DEMO_301_STUDY, DEMO_301_USDM } from "@/lib/study-data/presets";
import {
  StudyWorkspaceConflictError,
  branchStudyWorkspace,
  createBrowserStudyWorkspaceStore,
  type BroadcastChannelLike,
  type StudyRepositorySeed,
} from "@/lib/study-workspace";

function createTestHub() {
  const listenersByTab = new Map<string, Set<(data: unknown) => void>>();
  return (name: string): BroadcastChannelLike => {
    const id = `${name}:${Math.random().toString(36).slice(2)}`;
    const set = new Set<(data: unknown) => void>();
    listenersByTab.set(id, set);
    return {
      postMessage(data: unknown) {
        for (const [otherId, listeners] of listenersByTab) {
          if (otherId === id) continue;
          for (const cb of listeners) {
            cb(data);
          }
        }
      },
      addEventListener(_type, listener) {
        const wrapped = (data: unknown) =>
          listener(new MessageEvent("message", { data }));
        set.add(wrapped);
      },
      removeEventListener() {
        set.clear();
      },
      close() {
        listenersByTab.delete(id);
      },
    };
  };
}

const SEEDS: readonly StudyRepositorySeed[] = [
  {
    studyId: "DEMO-301",
    title: DEMO_301_STUDY.title,
    protocolCode: "DEMO-301",
    usdm: DEMO_301_USDM,
  },
];

describe("shared browser USDM workspace store and lossless conflict branching", () => {
  it("seeds preset studies without mutating DEMO-301 when switching presets", async () => {
    const store = createBrowserStudyWorkspaceStore({ seeds: SEEDS });
    await store.initialize();

    const initialDemo = await store.getRecord("DEMO-301");
    expect(initialDemo).not.toBeNull();

    const neuroUsdm = exportStudyToUsdmObject(CNS_NEURO_PRESET);
    const saved = await store.activateOrImportUsdm("NEURO-2026-401", neuroUsdm);
    expect(saved.studyId).toBe("NEURO-2026-401");
    expect(store.getSnapshot().activeStudyId).toBe("NEURO-2026-401");

    const unchangedDemo = await store.getRecord("DEMO-301");
    expect(unchangedDemo?.workspace.revision.sha256).toBe(
      initialDemo?.workspace.revision.sha256
    );
    store.dispose();
  });

  it("detects stale revision conflicts and branches losslessly to a new study ID", async () => {
    const createChannel = createTestHub();
    const store = createBrowserStudyWorkspaceStore({
      seeds: SEEDS,
      createChannel,
    });
    await store.initialize();

    const base = (await store.getRecord("DEMO-301"))!;
    const editA = structuredClone(DEMO_301_USDM);
    editA.study.label = "Tab A Protocol Revision";
    const committedA = await store.reconcileUsdm("DEMO-301", editA, {
      expectedRevisionId: base.workspace.revision.id,
      note: "Tab A edit",
    });
    expect(committedA.status).toBe("saved");

    const editB = structuredClone(DEMO_301_USDM);
    editB.study.label = "Tab B Concurrent Revision";
    const conflictOutcome = await store.reconcileUsdm("DEMO-301", editB, {
      expectedRevisionId: base.workspace.revision.id,
      note: "Tab B edit",
    });
    expect(conflictOutcome.status).toBe("conflict");
    if (conflictOutcome.status === "conflict") {
      expect(conflictOutcome.error).toBeInstanceOf(StudyWorkspaceConflictError);
    }

    const localEditedWorkspace = {
      ...base.workspace,
      usdm: editB,
    };
    const branched = await store.branchConflict(
      "DEMO-301",
      localEditedWorkspace,
      { note: "Saved Tab B conflict branch" }
    );
    expect(branched.studyId).toMatch(/^DEMO-301-branch/i);
    expect(
      (await store.getRecord("DEMO-301"))?.workspace.usdm.study.label
    ).toBe("Tab A Protocol Revision");
    expect(
      (await store.getRecord(branched.studyId))?.workspace.usdm.study.label
    ).toBe("Tab B Concurrent Revision");

    const directBranch = branchStudyWorkspace(base.workspace, {
      protocolCode: "DEMO-301-BRANCH-MANUAL",
    });
    expect(directBranch.usdm.study.name).toBe("DEMO-301-BRANCH-MANUAL");
    expect(directBranch.revision.parentId).toBe(base.workspace.revision.id);
    store.dispose();
  });
});
