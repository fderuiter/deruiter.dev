/**
 * @vitest-environment jsdom
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  validateUsdmV4Document,
  type UsdmV4Document,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4StudyVersion,
} from "@/lib/clinical-standards";
import {
  STUDY_DRAFT_CORRUPT_BACKUP_KEY,
  STUDY_DRAFT_STORAGE_KEY,
  exportStudyToUsdmObject,
  getOncologyPresetSync,
  importStudyFromUsdm,
  saveStudyDraft,
} from "@/lib/crf";
import { DEMO_301_USDM } from "@/lib/study-data/presets";
import {
  MAX_STUDY_IMPORT_BYTES,
  StudyWorkspaceConflictError,
  TAVR_SAVR_USDM,
  applyStudyEdit,
  createBlankStudyWorkspace,
  createMemoryStudyRepositoryStore,
  emptyStudyEditHistory,
  exportValidatedStudyUsdm,
  importStudyRepositoryFile,
  importUsdmStudy,
  openStudyRepositoryStore,
  reconcileUsdmStudyRevision,
  renameStudyArm,
  serializeStudyWorkspace,
  type BroadcastChannelLike,
  type StudyWorkspace,
} from "@/lib/study-workspace";
import {
  STUDY_WORKSPACE_DRAFT_KEY,
  STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY,
  saveStudyWorkspaceDraft,
} from "@/components/study-workspace/randomization-draft-storage";
import {
  createStudyRepositoryClient,
  getSharedStudyRepository,
} from "@/components/clinical/study-repository-client";
import { cloneDeep } from "@/lib/utils";

class MemoryBroadcastHub {
  private readonly channels = new Set<HubChannel>();

  create = (name: string): BroadcastChannelLike => {
    const channel = new HubChannel(name, this.channels);
    this.channels.add(channel);
    return channel;
  };
}

class HubChannel implements BroadcastChannelLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  private readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  private closed = false;

  constructor(
    private readonly name: string,
    private readonly peers: Set<HubChannel>
  ) {}

  addEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: (event: MessageEvent<unknown>) => void
  ): void {
    this.listeners.delete(listener);
  }

  postMessage(message: unknown): void {
    if (this.closed) return;
    for (const peer of this.peers) {
      if (peer !== this && !peer.closed && peer.name === this.name) {
        const event = new MessageEvent("message", { data: message });
        peer.onmessage?.(event);
        for (const listener of peer.listeners) {
          listener(event);
        }
      }
    }
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
    this.peers.delete(this);
  }
}

function namespaceUsdmSubtree<T>(subtree: T, prefix: string): T {
  const idMap = new Map<string, string>();
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.id === "string" && typeof rec.instanceType === "string") {
      idMap.set(rec.id, `${prefix}-${rec.id}`);
    }
    Object.values(rec).forEach(collect);
  };
  collect(subtree);

  const rewrite = (node: unknown, keyName?: string): unknown => {
    if (typeof node === "string") {
      if (
        keyName &&
        (keyName === "id" ||
          keyName.endsWith("Id") ||
          keyName.endsWith("Ids")) &&
        idMap.has(node)
      ) {
        return idMap.get(node)!;
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((item) => rewrite(item, keyName));
    }
    if (typeof node !== "object" || node === null) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = rewrite(v, k);
    }
    return out;
  };
  return rewrite(subtree) as T;
}

function firstArmOf(workspace: StudyWorkspace) {
  const arm = workspace.usdm.study.versions?.[0]?.studyDesigns?.[0]?.arms?.[0];
  if (!arm) throw new Error("Expected study workspace to contain at least one arm");
  return arm;
}

function buildMultiVersionMultiDesignUsdm(): UsdmV4Document {
  const base = cloneDeep(DEMO_301_USDM);
  const templateVersion = base.study.versions?.[0];
  if (!templateVersion) throw new Error("Expected DEMO_301_USDM to have a version");

  const v1 = namespaceUsdmSubtree(
    cloneDeep(templateVersion),
    "v1"
  ) as UsdmV4StudyVersion;
  v1.id = "sv-1";
  v1.versionIdentifier = "1.0";
  v1.extensionAttributes = [
    ...(v1.extensionAttributes ?? []),
    {
      id: "ext-sponsor-v1",
      url: "https://sponsor.example.org/usdm/amendment-reason",
      instanceType: "ExtensionAttribute",
      valueString: "Initial protocol release",
    },
  ];

  const v2 = namespaceUsdmSubtree(
    cloneDeep(templateVersion),
    "v2"
  ) as UsdmV4StudyVersion;
  v2.id = "sv-2";
  v2.versionIdentifier = "2.0";
  v2.extensionAttributes = [
    ...(v2.extensionAttributes ?? []),
    {
      id: "ext-sponsor-v2",
      url: "https://sponsor.example.org/usdm/amendment-reason",
      instanceType: "ExtensionAttribute",
      valueString: "Added substudy cohort",
    },
  ];

  const templateDesign = v2.studyDesigns?.[0];
  if (!templateDesign) throw new Error("Expected v2 to have a study design");

  const designMain = namespaceUsdmSubtree(
    cloneDeep(templateDesign),
    "main"
  ) as UsdmV4InterventionalStudyDesign;
  designMain.id = "sd-main";
  designMain.name = "Main Randomized Cohort";
  designMain.label = "Main Randomized Cohort";

  const designSub = cloneDeep(templateDesign) as UsdmV4InterventionalStudyDesign;
  designSub.id = "sd-substudy";
  designSub.name = "Biomarker Substudy";
  designSub.label = "Biomarker Substudy";
  designSub.extensionAttributes = [
    ...(designSub.extensionAttributes ?? []),
    {
      id: "ext-randomization-plan",
      url: "https://deruiter.dev/usdm/v1/randomization-plan",
      instanceType: "ExtensionAttribute",
      valueString: JSON.stringify({ method: "permuted-block", blockSize: 4 }),
    },
    {
      id: "ext-sponsor-design",
      url: "https://sponsor.example.org/usdm/design-owner",
      instanceType: "ExtensionAttribute",
      valueString: "Translational Medicine",
    },
  ];
  if (designSub.activities?.[0]) {
    designSub.activities[0].extensionAttributes = [
      ...(designSub.activities[0].extensionAttributes ?? []),
      {
        id: "ext-sponsor-activity",
        url: "https://sponsor.example.org/usdm/edc-oid",
        instanceType: "ExtensionAttribute",
        valueString: "SPONSOR_FORM_001",
      },
    ];
  }
  if (designSub.encounters?.[0]) {
    designSub.encounters[0].extensionAttributes = [
      ...(designSub.encounters[0].extensionAttributes ?? []),
      {
        id: "ext-sponsor-encounter",
        url: "https://sponsor.example.org/usdm/site-monitoring",
        instanceType: "ExtensionAttribute",
        valueString: "SDV-100",
      },
    ];
  }

  v2.studyDesigns = [designMain, designSub];
  base.study.name = "MULTI-204";
  base.study.extensionAttributes = [
    ...(base.study.extensionAttributes ?? []),
    {
      id: "ext-sponsor-study",
      url: "https://sponsor.example.org/usdm/program-code",
      instanceType: "ExtensionAttribute",
      valueString: "PRG-CARDIO-9",
    },
  ];
  base.study.versions = [v1, v2];
  return base;
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("shared browser USDM study repository", () => {
  it.each(["indexeddb", "memory"])(
    "blocks stale bound saves after deleting a study in %s",
    async (persistence) => {
      const indexedDB = new IDBFactory();
      if (persistence === "memory") {
        vi.spyOn(indexedDB, "open").mockImplementation(() => {
          throw new DOMException("Access denied", "SecurityError");
        });
      }
      const client = createStudyRepositoryClient({ indexedDB });
      try {
        const record = await client.createBlankStudy();
        expect(client.getSnapshot().persistence).toBe(persistence);
        const expectedRevisionId = record.workspace.revision.id;
        await client.deleteStudy(record.studyId);

        const missingConflict = {
          status: "conflict",
          expectedRevisionId,
          currentRevisionId: null,
          latestRecord: null,
        };
        await expect(
          client.saveWorkspace(record.studyId, record.workspace, {
            expectedRevisionId,
          })
        ).resolves.toEqual(missingConflict);
        await expect(
          client.reconcileAndSaveUsdm(record.studyId, record.workspace.usdm, {
            expectedRevisionId,
            note: "Autosave opened study",
            requireExisting: true,
          })
        ).resolves.toEqual(missingConflict);
        await expect(client.getRecord(record.studyId)).resolves.toBeNull();
      } finally {
        client.dispose();
      }
    }
  );

  it("persists seeded, imported, and edited studies in IndexedDB across fresh opens", async () => {
    const idb = new IDBFactory();
    const firstClient = createStudyRepositoryClient({ indexedDB: idb });
    const initialSnap = await firstClient.initialize();

    expect(initialSnap.persistence).toBe("indexeddb");
    expect(initialSnap.activeStudyId).toBeNull();
    expect(initialSnap.studies.map((item) => item.studyId)).toEqual(
      expect.arrayContaining(["DEMO-301", "tavr-savr", "tavr-device"])
    );

    const usdmJson = JSON.stringify(TAVR_SAVR_USDM);
    const imported = await firstClient.importFile({
      byteLength: new TextEncoder().encode(usdmJson).byteLength,
      fileName: "cardio-import.usdm.json",
      readText: async () => usdmJson,
    });
    expect(imported.status).toBe("ok");
    if (imported.status !== "ok") return;

    const firstArmId = firstArmOf(imported.record.workspace).id;
    const edited = applyStudyEdit(
      imported.record.workspace,
      emptyStudyEditHistory(),
      renameStudyArm(
        imported.record.workspace,
        firstArmId,
        "Transcatheter Valve"
      )
    );
    const saved = await firstClient.saveWorkspace(
      imported.record.studyId,
      edited.workspace,
      { expectedRevisionId: "R1" }
    );
    expect(saved.status).toBe("saved");
    firstClient.dispose();

    // Reopening against the same IDBFactory simulates a full browser reload.
    const reloadedClient = createStudyRepositoryClient({ indexedDB: idb });
    const reloadedSnap = await reloadedClient.initialize();
    expect(reloadedSnap.activeStudyId).toBe(imported.record.studyId);
    expect(reloadedSnap.activeRecord?.workspace.revision.id).toBe("R2");
    expect(
      reloadedSnap.activeRecord
        ? firstArmOf(reloadedSnap.activeRecord.workspace).name
        : null
    ).toBe("Transcatheter Valve");

    // Deleting a custom study removes it; deleting a reference study resets it to R1.
    await reloadedClient.deleteStudy(imported.record.studyId);
    expect(await reloadedClient.getRecord(imported.record.studyId)).toBeNull();
    expect(reloadedClient.getSnapshot().activeStudyId).toBe("DEMO-301");

    const tavrRecord = await reloadedClient.getRecord("tavr-savr");
    expect(tavrRecord).not.toBeNull();
    if (!tavrRecord) return;
    const tavrEdited = applyStudyEdit(
      tavrRecord.workspace,
      emptyStudyEditHistory(),
      renameStudyArm(
        tavrRecord.workspace,
        firstArmOf(tavrRecord.workspace).id,
        "Edited Reference Arm"
      )
    );
    await reloadedClient.saveWorkspace("tavr-savr", tavrEdited.workspace, {
      expectedRevisionId: "R1",
    });
    expect(
      (await reloadedClient.getRecord("tavr-savr"))?.workspace.revision.id
    ).toBe("R2");
    await reloadedClient.deleteStudy("tavr-savr");
    expect(
      (await reloadedClient.getRecord("tavr-savr"))?.workspace.revision.id
    ).toBe("R1");
    reloadedClient.dispose();
  });

  it("enforces the 25 MiB file import limit before reading text and round-trips .study.json", async () => {
    const readTextSpy = vi.fn(async () => "{}");
    const rejectedLarge = await importStudyRepositoryFile({
      byteLength: MAX_STUDY_IMPORT_BYTES + 1,
      fileName: "oversized.usdm.json",
      readText: readTextSpy,
    });
    expect(rejectedLarge).toEqual({
      status: "too-large",
      maxBytes: MAX_STUDY_IMPORT_BYTES,
      actualBytes: MAX_STUDY_IMPORT_BYTES + 1,
    });
    expect(readTextSpy).not.toHaveBeenCalled();

    const importedBase = await importUsdmStudy({ document: TAVR_SAVR_USDM });
    expect(importedBase.status).toBe("ok");
    if (importedBase.status !== "ok") return;

    const workspaceJson = serializeStudyWorkspace(importedBase.workspace);
    const reopened = await importStudyRepositoryFile({
      byteLength: new TextEncoder().encode(workspaceJson).byteLength,
      fileName: "tavr.study.json",
      readText: async () => workspaceJson,
    });
    expect(reopened.status).toBe("ok");
    if (reopened.status !== "ok") return;
    expect(reopened.format).toBe("workspace");
    expect(reopened.workspace.revision.sha256).toBe(
      importedBase.workspace.revision.sha256
    );
  });

  it("prompts for version and design selection on multi-version/multi-design USDM imports", async () => {
    const idb = new IDBFactory();
    const client = createStudyRepositoryClient({ indexedDB: idb });
    const multiDoc = buildMultiVersionMultiDesignUsdm();
    const raw = JSON.stringify(multiDoc);

    const firstStep = await client.importFile({
      byteLength: new TextEncoder().encode(raw).byteLength,
      fileName: "multi-204.usdm.json",
      readText: async () => raw,
    });
    expect(firstStep.status).toBe("needs-selection");
    if (firstStep.status !== "needs-selection") return;
    expect(firstStep.pending.choices).toHaveLength(2);
    expect(firstStep.pending.choices[1].designs.map((d) => d.id)).toEqual([
      "sd-main",
      "sd-substudy",
    ]);

    const confirmed = await client.confirmImportSelection(firstStep.pending, {
      studyVersionId: "sv-2",
      studyDesignId: "sd-substudy",
    });
    expect(confirmed.status).toBe("ok");
    if (confirmed.status !== "ok") return;
    expect(confirmed.record.workspace.selection).toEqual({
      studyVersionId: "sv-2",
      studyDesignId: "sd-substudy",
    });
    client.dispose();
  });

  it("preserves unselected versions, unselected designs, and non-CRF extensionAttributes across CRF round-trip and exports schema-valid USDM", async () => {
    const multiDoc = buildMultiVersionMultiDesignUsdm();
    const initialVersions = multiDoc.study.versions ?? [];
    const originalV1 = cloneDeep(initialVersions[0]);
    const originalMainDesign = cloneDeep(initialVersions[1]?.studyDesigns?.[0]);

    const opened = await importUsdmStudy(
      { document: multiDoc },
      { selection: { studyVersionId: "sv-2", studyDesignId: "sd-substudy" } }
    );
    expect(opened.status).toBe("ok");
    if (opened.status !== "ok") return;

    // Load the selected design into CRF Studio, author a new CDASH field, and export back to USDM v4.
    const crfProtocol = importStudyFromUsdm(opened.workspace.usdm, {
      selection: opened.workspace.selection,
    });
    expect(crfProtocol.forms.length).toBeGreaterThan(0);

    const editedProtocol = cloneDeep(crfProtocol);
    if (editedProtocol.forms[0].sections.length === 0) {
      editedProtocol.forms[0].sections.push({
        id: "sec_biomarker",
        title: "Biomarker Panel",
        fields: [],
      });
    }
    editedProtocol.forms[0].sections[0].fields.push({
      id: "fld_biomarker_titer",
      variableName: "LBTITER",
      label: "Neutralizing Antibody Titer",
      dataType: "number",
      required: true,
      columnSpan: 6,
      cdashMetadata: {
        domain: "LB",
        sdtmVariable: "LBORRES",
        cdashLabel: "Neutralizing Antibody Titer",
        core: "O",
        acrfAnnotation: "LB.LBORRES",
      },
    });

    const crfExportedUsdm = exportStudyToUsdmObject(editedProtocol);
    const reconciled = reconcileUsdmStudyRevision(
      opened.workspace,
      crfExportedUsdm,
      {
        expectedRevisionId: opened.workspace.revision.id,
        note: "Added biomarker titer field in CRF Studio",
      }
    );

    expect(reconciled.revision.id).toBe("R2");
    expect(reconciled.revision.parentId).toBe("R1");

    const reconciledVersions = reconciled.usdm.study.versions ?? [];
    // 1. Unselected version sv-1 and unselected design sd-main are completely untouched.
    expect(reconciledVersions[0]).toEqual(originalV1);
    expect(reconciledVersions[1]?.studyDesigns?.[0]).toEqual(
      originalMainDesign
    );

    // 2. Non-CRF extensionAttributes on study, version, design, activity, and encounter survive intact.
    expect(reconciled.usdm.study.extensionAttributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://sponsor.example.org/usdm/program-code",
          valueString: "PRG-CARDIO-9",
        }),
      ])
    );
    expect(reconciledVersions[1]?.extensionAttributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://sponsor.example.org/usdm/amendment-reason",
          valueString: "Added substudy cohort",
        }),
      ])
    );
    const updatedSubstudy = reconciledVersions[1]?.studyDesigns?.[1];
    expect(updatedSubstudy).toBeDefined();
    if (!updatedSubstudy) return;

    expect(updatedSubstudy.extensionAttributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://deruiter.dev/usdm/v1/randomization-plan",
        }),
        expect.objectContaining({
          url: "https://sponsor.example.org/usdm/design-owner",
          valueString: "Translational Medicine",
        }),
      ])
    );
    expect(updatedSubstudy.activities?.[0]?.extensionAttributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://sponsor.example.org/usdm/edc-oid",
          valueString: "SPONSOR_FORM_001",
        }),
      ])
    );
    expect(updatedSubstudy.encounters?.[0]?.extensionAttributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://sponsor.example.org/usdm/site-monitoring",
          valueString: "SDV-100",
        }),
      ])
    );

    // 3. Re-importing the reconciled workspace into CRF Studio retains the newly authored field.
    const reloadedProtocol = importStudyFromUsdm(reconciled.usdm, {
      selection: reconciled.selection,
    });
    const allVarNames = reloadedProtocol.forms.flatMap((form) =>
      form.sections.flatMap((sec) => sec.fields.map((f) => f.variableName))
    );
    expect(allVarNames).toContain("LBTITER");

    // 4. Canonical export passes USDM v4.0.0 OpenAPI schema validation AND re-imports without duplicate IDs.
    const exported = await exportValidatedStudyUsdm(reconciled);
    expect(exported.status).toBe("ok");
    if (exported.status !== "ok") return;
    const parsedExport = JSON.parse(exported.json) as unknown;
    const schemaIssues = await validateUsdmV4Document(parsedExport);
    expect(schemaIssues).toEqual([]);
    const reimported = await importUsdmStudy(
      { document: parsedExport },
      { selection: { studyVersionId: "sv-2", studyDesignId: "sd-substudy" } }
    );
    expect(reimported.status).toBe("ok");

    // 5. Idempotency when nothing changed.
    const secondExport = exportStudyToUsdmObject(reloadedProtocol);
    const unchanged = reconcileUsdmStudyRevision(reconciled, secondExport, {
      expectedRevisionId: reconciled.revision.id,
      note: "No-op save",
      skipIfUnchanged: true,
    });
    expect(unchanged).toBe(reconciled);

    // 6. Incomplete study missing required USDM v4 fields returns actionable schema diagnostics.
    const blank = await createBlankStudyWorkspace();
    const brokenUsdm = cloneDeep(blank.workspace.usdm);
    Reflect.deleteProperty(brokenUsdm.study, "name");
    const blankExport = await exportValidatedStudyUsdm({
      ...blank.workspace,
      usdm: brokenUsdm,
    });
    expect(blankExport.status).toBe("invalid");
    if (blankExport.status === "invalid") {
      expect(blankExport.issues.length).toBeGreaterThan(0);
    }
  });

  it("detects stale revision conflicts and broadcasts updates across tabs", async () => {
    const idb = new IDBFactory();
    const hub = new MemoryBroadcastHub();
    const tabA = createStudyRepositoryClient({
      indexedDB: idb,
      tabId: "tab-a",
      createChannel: hub.create,
    });
    const tabB = createStudyRepositoryClient({
      indexedDB: idb,
      tabId: "tab-b",
      createChannel: hub.create,
    });

    await tabA.initialize();
    await tabB.initialize();

    const baseRecord = await tabA.getRecord("tavr-savr");
    expect(baseRecord).not.toBeNull();
    if (!baseRecord) return;

    const armId = firstArmOf(baseRecord.workspace).id;
    const editA = applyStudyEdit(
      baseRecord.workspace,
      emptyStudyEditHistory(),
      renameStudyArm(baseRecord.workspace, armId, "Tab A Arm")
    );
    const savedA = await tabA.saveWorkspace("tavr-savr", editA.workspace, {
      expectedRevisionId: "R1",
    });
    expect(savedA.status).toBe("saved");

    await vi.waitFor(() => {
      expect(tabB.getSnapshot().lastRemoteEvent).toMatchObject({
        type: "study-saved",
        studyId: "tavr-savr",
        revisionId: "R2",
      });
    });
    // Tab A never echoes its own BroadcastChannel event.
    expect(tabA.getSnapshot().lastRemoteEvent).toBeNull();

    // Tab B attempting to save an edit based on stale R1 is blocked with a conflict.
    const editB = applyStudyEdit(
      baseRecord.workspace,
      emptyStudyEditHistory(),
      renameStudyArm(baseRecord.workspace, armId, "Stale Tab B Arm")
    );
    const conflictOutcome = await tabB.saveWorkspace(
      "tavr-savr",
      editB.workspace,
      { expectedRevisionId: "R1" }
    );
    expect(conflictOutcome.status).toBe("conflict");
    if (conflictOutcome.status === "conflict") {
      expect(conflictOutcome.expectedRevisionId).toBe("R1");
      expect(conflictOutcome.currentRevisionId).toBe("R2");
    }

    // Memory fallback store enforces the exact same StudyWorkspaceConflictError contract.
    const memStore = createMemoryStudyRepositoryStore();
    await memStore.put(baseRecord, { force: true });
    await memStore.put(
      { ...baseRecord, workspace: editA.workspace },
      { expectedRevisionId: "R1" }
    );
    await expect(
      memStore.put(
        { ...baseRecord, workspace: editB.workspace },
        { expectedRevisionId: "R1" }
      )
    ).rejects.toBeInstanceOf(StudyWorkspaceConflictError);

    tabA.dispose();
    tabB.dispose();
  });

  it("falls back cleanly to volatile memory when IndexedDB throws or is blocked", async () => {
    const blockedIdb: Pick<IDBFactory, "open"> = {
      open: () => {
        throw new DOMException("Access denied", "SecurityError");
      },
    };
    const opened = await openStudyRepositoryStore({
      indexedDB: blockedIdb as IDBFactory,
    });
    expect(opened.ok).toBe(false);

    const client = createStudyRepositoryClient({
      indexedDB: blockedIdb as IDBFactory,
    });
    const snap = await client.initialize();
    expect(snap.persistence).toBe("memory");
    expect(snap.studies.map((s) => s.studyId)).toContain("DEMO-301");

    const usdmExport = await client.exportCheckedUsdm("DEMO-301");
    expect(usdmExport?.status).toBe("ok");
    const wsExport = await client.exportWorkspaceSnapshot("DEMO-301");
    expect(wsExport?.fileName).toBe("DEMO-301.study.json");
    client.dispose();
  });

  it("migrates legacy Study Studio and CRF Studio drafts into IndexedDB while preserving quarantine keys", async () => {
    const importedTavr = await importUsdmStudy({ document: TAVR_SAVR_USDM });
    expect(importedTavr.status).toBe("ok");
    if (importedTavr.status !== "ok") return;

    const armId = firstArmOf(importedTavr.workspace).id;
    const editedTavr = applyStudyEdit(
      importedTavr.workspace,
      emptyStudyEditHistory(),
      renameStudyArm(importedTavr.workspace, armId, "Migrated TAVR Draft Arm")
    );
    saveStudyWorkspaceDraft({
      workspace: editedTavr.workspace,
      expectedWriteId: null,
      ui: { source: "tavr-savr" },
    });

    const crfDraftProtocol = cloneDeep(getOncologyPresetSync());
    crfDraftProtocol.protocolNumber = "LEGACY-CRF-77";
    crfDraftProtocol.title = "Legacy Migrated Oncology Draft";
    saveStudyDraft(crfDraftProtocol);

    // Pre-existing quarantined / corrupt payloads that MUST NOT be deleted.
    const quarantinePayload = JSON.stringify([
      {
        id: "q-1",
        quarantinedAt: "2026-01-01T00:00:00.000Z",
        problem: "not-json",
        raw: "{corrupt-workspace",
      },
    ]);
    const crfCorruptPayload = "{corrupt-crf-draft";
    window.localStorage.setItem(
      STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY,
      quarantinePayload
    );
    window.localStorage.setItem(
      STUDY_DRAFT_CORRUPT_BACKUP_KEY,
      crfCorruptPayload
    );

    const idb = new IDBFactory();
    const client = createStudyRepositoryClient({ indexedDB: idb });
    const snap = await client.initialize();

    // Primary legacy draft keys were migrated and removed.
    expect(window.localStorage.getItem(STUDY_WORKSPACE_DRAFT_KEY)).toBeNull();
    expect(window.localStorage.getItem(STUDY_DRAFT_STORAGE_KEY)).toBeNull();

    // Quarantined & corrupt keys remain untouched.
    expect(
      window.localStorage.getItem(STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY)
    ).toBe(quarantinePayload);
    expect(window.localStorage.getItem(STUDY_DRAFT_CORRUPT_BACKUP_KEY)).toBe(
      crfCorruptPayload
    );

    // Both migrated studies are present in IndexedDB.
    const migratedTavr = await client.getRecord("tavr-savr");
    expect(migratedTavr?.workspace.revision.id).toBe("R2");
    expect(migratedTavr ? firstArmOf(migratedTavr.workspace).name : null).toBe(
      "Migrated TAVR Draft Arm"
    );

    const migratedCrfSummary = snap.studies.find(
      (item) => item.protocolCode === "LEGACY-CRF-77"
    );
    expect(migratedCrfSummary?.kind).toBe("migrated");
    client.dispose();
  });

  it("enforces deterministic ordering, metadata isolation, and active-study cleanup in the memory store", async () => {
    const memStore = createMemoryStudyRepositoryStore();
    expect(memStore.persistence).toBe("memory");

    await memStore.seedIfMissing([
      {
        studyId: "tavr-savr",
        protocolCode: "TAVR-SAVR-001",
        usdm: TAVR_SAVR_USDM,
      },
    ]);
    // Idempotent second seed call skips existing records.
    await memStore.seedIfMissing([
      {
        studyId: "tavr-savr",
        protocolCode: "TAVR-SAVR-001",
        usdm: TAVR_SAVR_USDM,
      },
    ]);

    const refRecord = await memStore.get("tavr-savr");
    expect(refRecord).not.toBeNull();
    if (!refRecord) return;
    expect(await memStore.get("missing-study")).toBeNull();

    // Insert records across kinds, timestamps, and studyIds to verify deterministic sort order.
    await memStore.put(
      {
        ...refRecord,
        studyId: "authored-zeta",
        kind: "authored",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
      { force: true }
    );
    await memStore.put(
      {
        ...refRecord,
        studyId: "authored-alpha",
        kind: "authored",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
      { force: true }
    );
    await memStore.put(
      {
        ...refRecord,
        studyId: "authored-early",
        kind: "authored",
        createdAt: "2026-01-15T00:00:00.000Z",
      },
      { force: true }
    );
    await memStore.put(
      {
        ...refRecord,
        studyId: "imported-one",
        kind: "imported",
        createdAt: "2026-03-01T00:00:00.000Z",
      },
      { force: true }
    );
    await memStore.put(
      {
        ...refRecord,
        studyId: "migrated-one",
        kind: "migrated",
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      { force: true }
    );

    const listed = await memStore.list();
    expect(listed.map((r) => r.studyId)).toEqual([
      "tavr-savr",
      "migrated-one",
      "imported-one",
      "authored-early",
      "authored-alpha",
      "authored-zeta",
    ]);

    // Active study and arbitrary metadata round-trip with defensive cloning and null cleanup.
    expect(await memStore.getActiveStudyId()).toBeNull();
    await memStore.setActiveStudyId("authored-alpha");
    expect(await memStore.getActiveStudyId()).toBe("authored-alpha");

    // Removing a non-active study preserves activeStudyId; removing active study clears it.
    await memStore.remove("authored-zeta");
    expect(await memStore.getActiveStudyId()).toBe("authored-alpha");
    await memStore.remove("authored-alpha");
    expect(await memStore.getActiveStudyId()).toBeNull();

    await memStore.setActiveStudyId("imported-one");
    await memStore.setActiveStudyId(null);
    expect(await memStore.getActiveStudyId()).toBeNull();

    expect(await memStore.getMeta("customKey")).toBeUndefined();
    const metaPayload = { nested: ["a"] };
    await memStore.setMeta("customKey", metaPayload);
    metaPayload.nested.push("mutated");
    expect(await memStore.getMeta("customKey")).toEqual({ nested: ["a"] });
    await memStore.setMeta("customKey", null);
    expect(await memStore.getMeta("customKey")).toBeUndefined();
    await memStore.setMeta("customKey2", "val");
    await memStore.setMeta("customKey2", undefined);
    expect(await memStore.getMeta("customKey2")).toBeUndefined();

    memStore.close();
  });

  it("handles blank study creation, study deletion/reset, USDM reconciliation branches, schema-blocked exports, and IDB open failures", async () => {
    // Verify openStudyRepositoryStore handles onerror and onblocked gracefully.
    const errorIdb: Pick<IDBFactory, "open"> = {
      open: () => {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          req.onerror?.(new Event("error"));
        });
        return req;
      },
    };
    const blockedReqIdb: Pick<IDBFactory, "open"> = {
      open: () => {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => {
          req.onblocked?.(new Event("blocked") as IDBVersionChangeEvent);
        });
        return req;
      },
    };
    expect(
      (await openStudyRepositoryStore({ indexedDB: errorIdb as IDBFactory })).ok
    ).toBe(false);
    expect(
      (
        await openStudyRepositoryStore({
          indexedDB: blockedReqIdb as IDBFactory,
        })
      ).ok
    ).toBe(false);

    const idb = new IDBFactory();
    const client = createStudyRepositoryClient({ indexedDB: idb });
    await client.initialize();

    // Create two blank studies to exercise collision-free slug suffixing.
    const blank1 = await client.createBlankStudy();
    const blank2 = await client.createBlankStudy();
    expect(blank1.studyId).toBe("blank-study");
    expect(blank2.studyId).toBe("blank-study-2");
    expect(client.getSnapshot().activeStudyId).toBe("blank-study-2");

    // Deleting active authored study falls back to DEMO-301; deleting inactive authored study keeps activeStudyId.
    await client.deleteStudy("blank-study-2");
    expect(client.getSnapshot().activeStudyId).toBe("DEMO-301");
    await client.deleteStudy("blank-study");
    expect(client.getSnapshot().activeStudyId).toBe("DEMO-301");

    // Edit reference study DEMO-301 via reconcileAndSaveUsdm, test skipIfUnchanged + conflict + force, then reset via deleteStudy.
    const demoRecord = await client.getRecord("DEMO-301");
    expect(demoRecord).not.toBeNull();
    if (!demoRecord) return;

    const unchangedActive = await client.reconcileAndSaveUsdm(
      "DEMO-301",
      demoRecord.workspace.usdm,
      {
        expectedRevisionId: "R1",
        note: "No-op save",
        skipIfUnchanged: true,
      }
    );
    expect(unchangedActive.status).toBe("unchanged");

    await client.selectStudy("tavr-savr");
    const unchangedInactive = await client.reconcileAndSaveUsdm(
      "DEMO-301",
      demoRecord.workspace.usdm,
      {
        expectedRevisionId: "R1",
        note: "Switch active without USDM diff",
        skipIfUnchanged: true,
      }
    );
    expect(unchangedInactive.status).toBe("unchanged");
    expect(client.getSnapshot().activeStudyId).toBe("DEMO-301");

    const modifiedUsdm = cloneDeep(demoRecord.workspace.usdm);
    if (modifiedUsdm.study.versions?.[0]?.studyDesigns?.[0]?.arms?.[0]) {
      modifiedUsdm.study.versions[0].studyDesigns[0].arms[0].name =
        "Reconciled Arm R2";
    }
    const savedR2 = await client.reconcileAndSaveUsdm("DEMO-301", modifiedUsdm, {
      expectedRevisionId: "R1",
      note: "Rename arm via reconcile",
    });
    expect(savedR2.status).toBe("saved");

    const staleReconcile = await client.reconcileAndSaveUsdm(
      "DEMO-301",
      demoRecord.workspace.usdm,
      {
        expectedRevisionId: "R1",
        note: "Stale reconcile",
      }
    );
    expect(staleReconcile.status).toBe("conflict");

    const forcedReconcile = await client.reconcileAndSaveUsdm(
      "DEMO-301",
      demoRecord.workspace.usdm,
      {
        expectedRevisionId: "R1",
        note: "Forced reconcile",
        force: true,
      }
    );
    expect(forcedReconcile.status).toBe("saved");

    // Reconciling an uninitialized studyId initializes it automatically.
    const brandNew = await client.reconcileAndSaveUsdm(
      "new-reconciled-study",
      TAVR_SAVR_USDM,
      {
        expectedRevisionId: "R1",
        note: "Initialize on reconcile",
      }
    );
    expect(brandNew.status).toBe("saved");

    // Deleting a reference study resets it cleanly back to R1.
    await client.selectStudy("DEMO-301");
    await client.deleteStudy("DEMO-301");
    const resetDemo = await client.getRecord("DEMO-301");
    expect(resetDemo?.workspace.revision.id).toBe("R1");

    // Schema-invalid workspace returns status: "invalid" from exportCheckedUsdm.
    const brokenUsdm = cloneDeep(demoRecord.workspace.usdm);
    Reflect.deleteProperty(brokenUsdm.study, "name");
    const invalidWs: StudyWorkspace = {
      ...demoRecord.workspace,
      usdm: brokenUsdm,
    };
    await client.saveWorkspace("invalid-export-study", invalidWs, { force: true });
    const invalidExport = await client.exportCheckedUsdm("invalid-export-study");
    expect(invalidExport?.status).toBe("invalid");
    expect(await client.exportCheckedUsdm("nonexistent")).toBeNull();
    expect(await client.exportWorkspaceSnapshot("nonexistent")).toBeNull();

    client.dispose();

    // Verify getSharedStudyRepository singleton resets volatile state when sessionStorage/localStorage is cleared.
    const prevIdb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      window.localStorage.clear();
      const shared1 = getSharedStudyRepository();
      await shared1.initialize();
      const rec = await shared1.getRecord("tavr-savr");
      if (rec) {
        await shared1.saveWorkspace("tavr-savr", rec.workspace, {
          force: true,
          draftBackedKey: STUDY_WORKSPACE_DRAFT_KEY,
        });
      }
      window.localStorage.setItem(STUDY_WORKSPACE_DRAFT_KEY, "draft");
      window.localStorage.removeItem(STUDY_WORKSPACE_DRAFT_KEY);
      const shared2 = getSharedStudyRepository();
      expect(shared2).not.toBe(shared1);
      shared2.dispose();
    } finally {
      if (prevIdb) {
        Object.defineProperty(globalThis, "indexedDB", prevIdb);
      }
    }
  });
});
