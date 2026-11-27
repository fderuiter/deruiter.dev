import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  TAVR_SAVR_USDM,
  addStudyRandomizationPlan,
  applyStudyEdit,
  emptyStudyEditHistory,
  importUsdmStudy,
  serializeStudyWorkspace,
  type StudyWorkspace,
} from "@/lib/study-workspace";
import {
  STUDY_WORKSPACE_DRAFT_KEY,
  STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY,
  discardStudyWorkspaceDraft,
  dismissQuarantinedStudyWorkspaceDraft,
  listQuarantinedStudyWorkspaceDrafts,
  loadStudyWorkspaceDraft,
  saveStudyWorkspaceDraft,
} from "@/components/study-workspace/randomization-draft-storage";
import {
  STUDY_WORKSPACE_AUTOSAVE_MS,
  useStudyWorkspaceDraft,
} from "@/components/study-workspace/useStudyWorkspaceDraft";
import {
  MockStorage,
  QuotaExceededStorage,
  ToggleableMockStorage,
} from "./helpers/storage-mock";

/** Browser drafts of the study workspace and its plans (#4003). */

let base: StudyWorkspace;
let storage: Storage;
let ids: number;
const now = () => new Date("2026-11-22T12:00:00.000Z");
const makeId = () => `w${(ids += 1)}`;
const opts = () => ({ storage, now, makeId });

beforeAll(async () => {
  const result = await importUsdmStudy({ document: TAVR_SAVR_USDM });
  if (result.status !== "ok") throw new Error("fixture did not import");
  base = result.workspace;
});

beforeEach(() => {
  storage = new MockStorage();
  ids = 0;
});

function withPlan(workspace: StudyWorkspace): StudyWorkspace {
  return applyStudyEdit(
    workspace,
    emptyStudyEditHistory(),
    addStudyRandomizationPlan(workspace, {
      name: "Draft",
      arms: [
        { armId: "arm_rct_tavr", code: "T", allocationRatio: 2 },
        { armId: "arm_rct_savr", code: "S", allocationRatio: 1 },
      ],
      mechanics: { method: "BLOCK", seed: { value: "s", source: "custom" } },
    })
  ).workspace;
}

describe("draft storage", () => {
  it("is empty with no draft and round-trips a workspace with plans and view state", () => {
    expect(loadStudyWorkspaceDraft(opts())).toEqual({ status: "empty" });
    const workspace = withPlan(base);
    const saved = saveStudyWorkspaceDraft(
      { workspace, ui: { step: 3 }, expectedWriteId: null },
      opts()
    );
    expect(saved).toEqual({
      status: "saved",
      savedAt: "2026-11-22T12:00:00.000Z",
      writeId: "w1",
    });
    const loaded = loadStudyWorkspaceDraft(opts());
    expect(loaded.status).toBe("recovered");
    if (loaded.status !== "recovered") return;
    expect(loaded.migrated).toBe(false);
    expect(loaded.record.ui).toEqual({ step: 3 });
    expect(loaded.record.writeId).toBe("w1");
    expect(loaded.record.workspace).toEqual(workspace);
    expect(loaded.record.workspace.randomizationPlans[0].name).toBe("Draft");
  });

  it("reports a conflict when another writer saved, and overwrites only when forced", () => {
    saveStudyWorkspaceDraft({ workspace: base, expectedWriteId: null }, opts());
    const mine = withPlan(base);
    const refused = saveStudyWorkspaceDraft(
      { workspace: mine, expectedWriteId: null },
      opts()
    );
    expect(refused.status).toBe("conflict");
    if (refused.status === "conflict") {
      expect(refused.stored.workspace.revision.id).toBe("R1");
    }
    const forced = saveStudyWorkspaceDraft(
      { workspace: mine, expectedWriteId: null, force: true },
      opts()
    );
    expect(forced.status).toBe("saved");
    const loaded = loadStudyWorkspaceDraft(opts());
    expect(
      loaded.status === "recovered" && loaded.record.workspace.revision.id
    ).toBe("R2");
    // The writer that holds the stored id saves without conflict.
    expect(
      saveStudyWorkspaceDraft(
        { workspace: mine, expectedWriteId: "w2" },
        opts()
      ).status
    ).toBe("saved");
  });

  it("quarantines bad JSON with its original bytes, and the next load is empty", () => {
    storage.setItem(STUDY_WORKSPACE_DRAFT_KEY, "{not json");
    const loaded = loadStudyWorkspaceDraft(opts());
    expect(loaded).toMatchObject({
      status: "quarantined",
      moved: true,
      entry: { problem: "not-json", raw: "{not json" },
    });
    expect(storage.getItem(STUDY_WORKSPACE_DRAFT_KEY)).toBeNull();
    expect(loadStudyWorkspaceDraft(opts())).toEqual({ status: "empty" });
    expect(
      listQuarantinedStudyWorkspaceDrafts(opts()).map((e) => e.raw)
    ).toEqual(["{not json"]);
  });

  it("isolates an unsupported record version and a hand-edited workspace", () => {
    const future = JSON.stringify({ recordVersion: 9, workspace: {} });
    storage.setItem(STUDY_WORKSPACE_DRAFT_KEY, future);
    expect(loadStudyWorkspaceDraft(opts())).toMatchObject({
      status: "quarantined",
      entry: { problem: "unsupported-record-version", raw: future },
    });

    saveStudyWorkspaceDraft(
      { workspace: withPlan(base), expectedWriteId: null },
      opts()
    );
    const record = JSON.parse(storage.getItem(STUDY_WORKSPACE_DRAFT_KEY)!);
    record.workspace.randomizationPlans[0].arms[0].allocationRatio = 5;
    const edited = JSON.stringify(record);
    storage.setItem(STUDY_WORKSPACE_DRAFT_KEY, edited);
    expect(loadStudyWorkspaceDraft(opts())).toMatchObject({
      status: "quarantined",
      entry: { problem: "revision-hash-mismatch", raw: edited },
    });
    // Both stay in quarantine, oldest first.
    const entries = listQuarantinedStudyWorkspaceDrafts(opts());
    expect(entries.map((e) => e.problem)).toEqual([
      "unsupported-record-version",
      "revision-hash-mismatch",
    ]);
    expect(dismissQuarantinedStudyWorkspaceDraft(entries[0].id, opts())).toBe(
      true
    );
    expect(listQuarantinedStudyWorkspaceDrafts(opts())).toHaveLength(1);
    dismissQuarantinedStudyWorkspaceDraft(entries[1].id, opts());
    expect(storage.getItem(STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY)).toBeNull();
  });

  it("migrates a bare workspace file and a version 1 workspace", () => {
    storage.setItem(STUDY_WORKSPACE_DRAFT_KEY, serializeStudyWorkspace(base));
    const bare = loadStudyWorkspaceDraft(opts());
    expect(bare).toMatchObject({ status: "recovered", migrated: true });
    if (bare.status === "recovered") {
      expect(bare.record.ui).toEqual({});
      expect(bare.record.workspace).toEqual(base);
    }

    const { analyses: _a, randomizationPlans: _p, ...rest } = base;
    const { payloadSha256: _h, ...revision } = base.revision;
    const v1 = { ...rest, workspaceVersion: 1, revision };
    storage.setItem(
      STUDY_WORKSPACE_DRAFT_KEY,
      JSON.stringify({
        recordVersion: 1,
        savedAt: "2026-11-01T00:00:00.000Z",
        writeId: "old",
        workspace: v1,
        ui: {},
      })
    );
    const migrated = loadStudyWorkspaceDraft(opts());
    expect(migrated).toMatchObject({ status: "recovered", migrated: true });
    if (migrated.status === "recovered") {
      expect(migrated.record.workspace.workspaceVersion).toBe(2);
      expect(migrated.record.workspace.randomizationPlans).toEqual([]);
      expect(migrated.record.writeId).toBe("old");
    }
  });

  it("moves an unreadable stored draft aside before saving over it", () => {
    storage.setItem(STUDY_WORKSPACE_DRAFT_KEY, "garbage");
    const saved = saveStudyWorkspaceDraft(
      { workspace: base, expectedWriteId: null },
      opts()
    );
    expect(saved.status).toBe("saved");
    expect(listQuarantinedStudyWorkspaceDrafts(opts())[0].raw).toBe("garbage");
  });

  it("reports quota and denied storage without throwing", () => {
    expect(
      saveStudyWorkspaceDraft(
        { workspace: base, expectedWriteId: null },
        { storage: new QuotaExceededStorage(), now, makeId }
      )
    ).toMatchObject({ status: "error", reason: "quota" });
    const denied = {
      storage: new ToggleableMockStorage({
        initialEntries: { [STUDY_WORKSPACE_DRAFT_KEY]: "{bad" },
        denyReads: true,
        denyWrites: true,
      }),
      now,
      makeId,
    };
    expect(loadStudyWorkspaceDraft(denied)).toEqual({ status: "unavailable" });
    expect(
      saveStudyWorkspaceDraft(
        { workspace: base, expectedWriteId: null },
        denied
      )
    ).toEqual({ status: "unavailable" });
  });

  it("leaves the original in place when quarantine cannot be written", () => {
    const full = new QuotaExceededStorage({
      [STUDY_WORKSPACE_DRAFT_KEY]: "{bad",
    });
    expect(
      loadStudyWorkspaceDraft({ storage: full, now, makeId })
    ).toMatchObject({ status: "quarantined", moved: false });
    expect(full.getItem(STUDY_WORKSPACE_DRAFT_KEY)).toBe("{bad");
  });

  it("discards the current draft on dismissal", () => {
    saveStudyWorkspaceDraft({ workspace: base, expectedWriteId: null }, opts());
    expect(discardStudyWorkspaceDraft(opts())).toBe(true);
    expect(loadStudyWorkspaceDraft(opts())).toEqual({ status: "empty" });
  });
});

describe("useStudyWorkspaceDraft", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const UI = { step: 1 };

  function setup(initial: StudyWorkspace, baseWriteId: string | null = null) {
    const options = { storage, now, makeId, baseWriteId };
    return renderHook(
      ({ workspace, ui }) => useStudyWorkspaceDraft(workspace, ui, options),
      {
        initialProps: { workspace: initial, ui: UI as Record<string, unknown> },
      }
    );
  }

  it("does not write the starting workspace, then saves an edit after 750 ms idle", () => {
    const { result, rerender } = setup(base);
    expect(result.current.status).toBe("idle");
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(storage.getItem(STUDY_WORKSPACE_DRAFT_KEY)).toBeNull();

    const edited = withPlan(base);
    rerender({ workspace: edited, ui: UI });
    expect(result.current.status).toBe("saving");
    expect(result.current.hasUnsavedChanges).toBe(true);
    act(() => vi.advanceTimersByTime(STUDY_WORKSPACE_AUTOSAVE_MS - 1));
    expect(storage.getItem(STUDY_WORKSPACE_DRAFT_KEY)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBe("saved");
    expect(result.current.hasUnsavedChanges).toBe(false);
    const loaded = loadStudyWorkspaceDraft(opts());
    expect(
      loaded.status === "recovered" && loaded.record.workspace.revision.id
    ).toBe("R2");
  });

  it("keeps saving later edits after a save, and saves view-state changes", () => {
    const { result, rerender } = setup(base);
    const first = withPlan(base);
    rerender({ workspace: first, ui: UI });
    act(() => vi.advanceTimersByTime(STUDY_WORKSPACE_AUTOSAVE_MS));
    const ui = { step: 2 };
    rerender({ workspace: first, ui });
    act(() => vi.advanceTimersByTime(STUDY_WORKSPACE_AUTOSAVE_MS));
    expect(result.current.status).toBe("saved");
    const loaded = loadStudyWorkspaceDraft(opts());
    expect(loaded.status === "recovered" && loaded.record.ui).toEqual({
      step: 2,
    });
  });

  it("flushes at once when the tab is hidden and on unmount", () => {
    const { rerender, unmount } = setup(base);
    rerender({ workspace: withPlan(base), ui: UI });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    expect(storage.getItem(STUDY_WORKSPACE_DRAFT_KEY)).not.toBeNull();

    storage = new MockStorage();
    const second = setup(base);
    second.rerender({ workspace: withPlan(base), ui: UI });
    second.unmount();
    unmount();
    expect(storage.getItem(STUDY_WORKSPACE_DRAFT_KEY)).not.toBeNull();
  });

  it("stops on another tab's draft until the person keeps theirs", () => {
    const { result, rerender } = setup(base);
    saveStudyWorkspaceDraft(
      { workspace: base, ui: {}, expectedWriteId: null },
      opts()
    );
    const mine = withPlan(base);
    rerender({ workspace: mine, ui: UI });
    act(() => vi.advanceTimersByTime(STUDY_WORKSPACE_AUTOSAVE_MS));
    expect(result.current.status).toBe("conflict");
    expect(result.current.conflict?.workspace.revision.id).toBe("R1");
    act(() => result.current.keepMine());
    expect(result.current.status).toBe("saved");
    const loaded = loadStudyWorkspaceDraft(opts());
    expect(
      loaded.status === "recovered" && loaded.record.workspace.revision.id
    ).toBe("R2");
  });

  it("reports full storage and keeps the in-memory workspace", () => {
    storage = new QuotaExceededStorage();
    const { result, rerender } = setup(base);
    const edited = withPlan(base);
    rerender({ workspace: edited, ui: UI });
    act(() => vi.advanceTimersByTime(STUDY_WORKSPACE_AUTOSAVE_MS));
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).toMatch(/storage is full/);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});
