import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
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

  it("synchronizes IndexedDB state across tabs and notifies subscribed listeners", async () => {
    const indexedDB = new IDBFactory();
    const createChannel = createTestHub();
    const tabA = createBrowserStudyWorkspaceStore({
      seeds: SEEDS,
      indexedDB,
      dbName: "study-repo-sync",
      channelName: "study-repo-ch",
      tabId: "tab-a",
      createChannel,
      now: () => "2026-11-27T12:00:00.000Z",
    });
    const tabB = createBrowserStudyWorkspaceStore({
      seeds: SEEDS,
      indexedDB,
      dbName: "study-repo-sync",
      channelName: "study-repo-ch",
      tabId: "tab-b",
      createChannel,
      now: () => "2026-11-27T12:00:05.000Z",
    });

    expect(tabA.getSnapshot().isHydrated).toBe(false);
    const [snapA1, snapA2] = await Promise.all([
      tabA.initialize(),
      tabA.initialize(),
    ]);
    expect(snapA1).toBe(snapA2);
    expect(snapA1.persistence).toBe("indexeddb");

    const listenerB = vi.fn();
    const unsubscribeB = tabB.subscribe(listenerB);
    await tabB.initialize();
    const initialCalls = listenerB.mock.calls.length;

    expect(await tabA.selectStudy("DOES-NOT-EXIST")).toBeNull();

    const neuroUsdm = exportStudyToUsdmObject(CNS_NEURO_PRESET);
    await tabA.activateOrImportUsdm("NEURO-2026-401.usdm.json", neuroUsdm);

    await vi.waitFor(() => {
      expect(tabB.getSnapshot().remoteEventSeq).toBeGreaterThan(0);
    });
    expect(tabB.getSnapshot().lastRemoteEvent?.studyId).toBe("NEURO-2026-401");
    expect(listenerB.mock.calls.length).toBeGreaterThan(initialCalls);

    const selected = await tabA.selectStudy("DEMO-301");
    expect(selected?.studyId).toBe("DEMO-301");
    await vi.waitFor(() => {
      expect(tabB.getSnapshot().lastRemoteEvent?.type).toBe(
        "active-study-changed"
      );
    });

    unsubscribeB();
    const callsAfterUnsubscribe = listenerB.mock.calls.length;
    await tabA.selectStudy("NEURO-2026-401");
    expect(listenerB.mock.calls.length).toBe(callsAfterUnsubscribe);

    tabA.dispose();
    tabB.dispose();
  });

  it("handles saveWorkspace conflicts, pinActive, reconcileUsdm modes, repeated branches, and deletion", async () => {
    const store = createBrowserStudyWorkspaceStore({ seeds: SEEDS });
    await store.initialize();

    const demo = (await store.getRecord("DEMO-301"))!;

    // Direct saveWorkspace without pinning active study
    const neuroUsdm = exportStudyToUsdmObject(CNS_NEURO_PRESET);
    const missingConflict = await store.reconcileUsdm(
      "MISSING-999",
      neuroUsdm,
      {
        expectedRevisionId: "rev-missing",
        note: "Require existing check",
        requireExisting: true,
      }
    );
    expect(missingConflict.status).toBe("conflict");
    if (missingConflict.status === "conflict") {
      expect(missingConflict.currentRevisionId).toBeNull();
      expect(missingConflict.latestRecord).toBeNull();
    }

    // reconcileUsdm auto-imports when study is missing and requireExisting is false
    const autoImported = await store.reconcileUsdm("AUTO-101", neuroUsdm, {
      expectedRevisionId: "rev-initial",
      note: "Auto-import study",
    });
    expect(autoImported.status).toBe("saved");
    expect(store.getSnapshot().activeStudyId).toBe("AUTO-101");

    // saveWorkspace with pinActive: false keeps AUTO-101 active, then stale expectedRevisionId triggers conflict
    const unpinnedSave = await store.saveWorkspace(
      "UNPINNED-202",
      demo.workspace,
      { pinActive: false }
    );
    expect(unpinnedSave.status).toBe("saved");
    expect(store.getSnapshot().activeStudyId).toBe("AUTO-101");

    const saveConflict = await store.saveWorkspace(
      "UNPINNED-202",
      demo.workspace,
      { expectedRevisionId: "stale-revision-id" }
    );
    expect(saveConflict.status).toBe("conflict");
    if (saveConflict.status === "conflict") {
      expect(saveConflict.expectedRevisionId).toBe("stale-revision-id");
      expect(saveConflict.latestRecord?.studyId).toBe("UNPINNED-202");
    }

    // reconcileUsdm with skipIfUnchanged activates inactive study and returns unchanged
    const unchangedInactive = await store.reconcileUsdm(
      "DEMO-301",
      DEMO_301_USDM,
      {
        expectedRevisionId: demo.workspace.revision.id,
        note: "No-op reconcile",
        skipIfUnchanged: true,
      }
    );
    expect(unchangedInactive.status).toBe("unchanged");
    expect(store.getSnapshot().activeStudyId).toBe("DEMO-301");

    // Calling skipIfUnchanged again when already active stays unchanged
    const unchangedActive = await store.reconcileUsdm(
      "DEMO-301",
      DEMO_301_USDM,
      {
        expectedRevisionId: demo.workspace.revision.id,
        note: "No-op reconcile while active",
        skipIfUnchanged: true,
      }
    );
    expect(unchangedActive.status).toBe("unchanged");

    // Force reconcile overrides stale expectedRevisionId, and activateOrImportUsdm reconciles existing
    const forcedEdit = structuredClone(DEMO_301_USDM);
    forcedEdit.study.label = "Forced Revision";
    const forcedOutcome = await store.reconcileUsdm("DEMO-301", forcedEdit, {
      expectedRevisionId: "outdated-rev",
      note: "Forced update",
      force: true,
    });
    expect(forcedOutcome.status).toBe("saved");

    const reactivated = await store.activateOrImportUsdm(
      "DEMO-301",
      forcedEdit
    );
    expect(reactivated.studyId).toBe("DEMO-301");

    // Empty/punctuation slug falls back to "study"
    const fallbackSlug = await store.activateOrImportUsdm(
      "  /// .study.json  ",
      neuroUsdm
    );
    expect(fallbackSlug.studyId).toBe("study");

    // Repeated conflict branches increment suffix (-branch, -branch-2, -branch-3)
    const b1 = await store.branchConflict("DEMO-301", demo.workspace);
    const b2 = await store.branchConflict("DEMO-301", demo.workspace);
    const b3 = await store.branchConflict("DEMO-301", demo.workspace);
    expect(b1.studyId).toBe("DEMO-301-branch");
    expect(b2.studyId).toBe("DEMO-301-branch-2");
    expect(b3.studyId).toBe("DEMO-301-branch-3");

    // Delete active authored study falls back to DEMO-301; delete inactive study keeps active; delete seeded study re-seeds
    await store.deleteStudy("DEMO-301-branch-3", "DEMO-301");
    expect(store.getSnapshot().activeStudyId).toBe("DEMO-301");
    expect(await store.getRecord("DEMO-301-branch-3")).toBeNull();

    await store.deleteStudy("UNPINNED-202");
    expect(store.getSnapshot().activeStudyId).toBe("DEMO-301");

    await store.deleteStudy("DEMO-301");
    expect(store.getSnapshot().activeStudyId).toBe("DEMO-301");
    const reseeded = await store.getRecord("DEMO-301");
    expect(reseeded?.workspace.usdm.study.label).toBe(
      DEMO_301_USDM.study.label
    );

    store.dispose();
  });
});
