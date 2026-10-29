import { describe, expect, it } from "vitest";
import { usdmContentHash } from "@/lib/clinical-standards";
import { exportStudyToUsdmObject } from "@/lib/crf";
import { DEVICE_CARDIOVASCULAR_IMPLANT_PRESET } from "@/lib/crf/presets";
import { DEMO_301_USDM } from "@/lib/study-data/presets";
import {
  StudyWorkspaceConflictError,
  commitStudyRevision,
  exportStudyUsdm,
  importUsdmStudy,
  openStudyWorkspace,
  serializeStudyWorkspace,
  type StudyImportResult,
} from "@/lib/study-workspace";

const DEVICE_USDM = exportStudyToUsdmObject(
  DEVICE_CARDIOVASCULAR_IMPLANT_PRESET
);

function ok(result: StudyImportResult) {
  if (result.status !== "ok") {
    throw new Error(`expected ok, got ${JSON.stringify(result)}`);
  }
  return result;
}

/** DEMO-301 with a second study version and a second design in the first. */
function multiVersionStudy() {
  const doc = structuredClone(DEMO_301_USDM) as unknown as {
    study: { versions: Record<string, unknown>[] };
  };
  const [first] = doc.study.versions;
  const designs = first.studyDesigns as Record<string, unknown>[];
  designs.push({
    ...structuredClone(designs[0]),
    id: "Design_Extra",
    name: "Extra design",
  });
  // Give the copied design's children fresh ids so ids stay unique.
  const extra = designs[1];
  for (const key of Object.keys(extra)) {
    if (key !== "id" && key !== "name" && key !== "instanceType")
      delete extra[key];
  }
  extra.instanceType = "InterventionalStudyDesign";
  doc.study.versions.push({
    id: "Version_2",
    versionIdentifier: "2.0",
    instanceType: "StudyVersion",
    studyDesigns: [
      {
        id: "Design_V2",
        name: "Amended design",
        instanceType: "InterventionalStudyDesign",
      },
    ],
  });
  return doc;
}

describe("importUsdmStudy: both reference studies", () => {
  it.each([
    ["DEMO-301", DEMO_301_USDM],
    ["the TAVR device study", DEVICE_USDM],
  ])("imports %s at R1 with no schema issues", async (_label, usdm) => {
    const { workspace, report } = ok(await importUsdmStudy({ document: usdm }));
    expect(report.schemaIssues).toEqual([]);
    expect(workspace.revision).toEqual({
      id: "R1",
      parentId: null,
      note: "Imported.",
      sha256: usdmContentHash(usdm),
    });
    expect(workspace.source.sha256).toBe(usdmContentHash(usdm));
    expect(report.counts.arms).toBeGreaterThan(0);
    expect(report.counts.epochs).toBeGreaterThan(0);
    expect(report.counts.objectives).toBeGreaterThan(0);
    expect(report.counts.endpoints).toBeGreaterThan(0);
  });

  it.each([
    ["DEMO-301", DEMO_301_USDM],
    ["the TAVR device study", DEVICE_USDM],
  ])("exports %s exactly as imported (exact tier)", async (_label, usdm) => {
    const { workspace } = ok(await importUsdmStudy({ document: usdm }));
    expect(exportStudyUsdm(workspace)).toEqual(usdm);
    expect(usdmContentHash(exportStudyUsdm(workspace))).toBe(
      workspace.source.sha256
    );
  });

  it("reads the device study's single arm and its primary endpoint", async () => {
    const { report } = ok(await importUsdmStudy({ document: DEVICE_USDM }));
    expect(report.counts.arms).toBe(1);
    expect(report.counts.endpoints).toBe(2);
  });

  it("imports from file text and records the file name", async () => {
    const { workspace } = ok(
      await importUsdmStudy(
        { text: JSON.stringify(DEMO_301_USDM) },
        { fileName: "demo-301.usdm.json" }
      )
    );
    expect(workspace.source.fileName).toBe("demo-301.usdm.json");
  });
});

describe("importUsdmStudy: choosing a version and design", () => {
  it("asks for a choice instead of taking the first version", async () => {
    const result = await importUsdmStudy({ document: multiVersionStudy() });
    expect(result.status).toBe("needs-selection");
    if (result.status !== "needs-selection") return;
    expect(result.choices.map((choice) => choice.versionIdentifier)).toEqual([
      DEMO_301_USDM.study.versions?.[0].versionIdentifier,
      "2.0",
    ]);
    expect(result.choices[0].designs.map((design) => design.name)).toContain(
      "Extra design"
    );
  });

  it("opens the chosen version and design and preserves the rest", async () => {
    const { workspace, report } = ok(
      await importUsdmStudy(
        { document: multiVersionStudy() },
        {
          selection: {
            studyVersionId: "Version_2",
            studyDesignId: "Design_V2",
          },
        }
      )
    );
    expect(workspace.selection).toEqual({
      studyVersionId: "Version_2",
      studyDesignId: "Design_V2",
    });
    expect(report.preserved).toContainEqual({
      path: "study.versions.0",
      reason: "other-study-version",
      label: DEMO_301_USDM.study.versions?.[0].versionIdentifier,
    });
  });

  it("rejects a selection that does not exist", async () => {
    const result = await importUsdmStudy(
      { document: multiVersionStudy() },
      { selection: { studyVersionId: "Version_2", studyDesignId: "Nope" } }
    );
    expect(result).toMatchObject({
      status: "rejected",
      problems: [{ code: "unknown-selection" }],
    });
  });
});

describe("importUsdmStudy: what it refuses and what it reports", () => {
  it.each([
    ["text that is not JSON", { text: "{" }, "not-json"],
    [
      "USDM v3",
      { document: { usdmVersion: "3.0.0", study: {} } },
      "not-usdm-v4",
    ],
    [
      "a document with no study",
      { document: { usdmVersion: "4.0.0" } },
      "not-usdm-v4",
    ],
    [
      "a study with no version",
      { document: { usdmVersion: "4.0.0", study: { versions: [] } } },
      "no-study-version",
    ],
    [
      "a study with no design",
      {
        document: {
          usdmVersion: "4.0.0",
          study: { versions: [{ id: "V", instanceType: "StudyVersion" }] },
        },
      },
      "no-study-design",
    ],
  ] as const)("rejects %s", async (_label, input, code) => {
    expect(await importUsdmStudy(input)).toMatchObject({
      status: "rejected",
      problems: [{ code }],
    });
  });

  it("rejects duplicate ids and names them", async () => {
    const doc = structuredClone(DEMO_301_USDM) as unknown as {
      study: { versions: { studyDesigns: { arms: { id: string }[] }[] }[] };
    };
    const arms = doc.study.versions[0].studyDesigns[0].arms;
    arms[1].id = arms[0].id;
    const result = await importUsdmStudy({ document: doc });
    expect(result.status).toBe("rejected");
    expect(
      result.status === "rejected" && result.problems[0].message
    ).toContain(arms[0].id);
  });

  it("lists schema issues but still opens the study", async () => {
    const doc = structuredClone(DEMO_301_USDM) as unknown as {
      study: { name: unknown };
    };
    doc.study.name = 42;
    const { report } = ok(await importUsdmStudy({ document: doc }));
    expect(
      report.schemaIssues.some((issue) => issue.startsWith("study.name"))
    ).toBe(true);
  });

  it("lists objects with extension attributes as preserved", async () => {
    const { report } = ok(await importUsdmStudy({ document: DEVICE_USDM }));
    const extensions = report.preserved.filter(
      (item) => item.reason === "extension-attributes"
    );
    expect(extensions.length).toBeGreaterThan(0);
  });

  it("never lets edits to the working copy reach the original", async () => {
    const { workspace } = ok(
      await importUsdmStudy({ document: DEMO_301_USDM })
    );
    workspace.usdm.study.name = "Changed";
    expect(workspace.source.original).toEqual(DEMO_301_USDM);
    expect(DEMO_301_USDM.study.name).not.toBe("Changed");
  });
});

describe("revisions and saved files", () => {
  it("commits R2 from R1 and leaves R1 untouched", async () => {
    const { workspace: r1 } = ok(
      await importUsdmStudy({ document: DEVICE_USDM })
    );
    const edited = exportStudyUsdm(r1);
    edited.study.description = "Edited";
    const r2 = commitStudyRevision(r1, edited, {
      expectedRevisionId: "R1",
      note: "Describe the study.",
    });
    expect(r2.revision).toEqual({
      id: "R2",
      parentId: "R1",
      note: "Describe the study.",
      sha256: usdmContentHash(edited),
    });
    expect(r1.usdm.study.description).not.toBe("Edited");
    expect(r2.source).toBe(r1.source);
  });

  it("refuses an edit made on a revision that is no longer current", async () => {
    const { workspace: r1 } = ok(
      await importUsdmStudy({ document: DEVICE_USDM })
    );
    const r2 = commitStudyRevision(r1, r1.usdm, {
      expectedRevisionId: "R1",
      note: "No-op",
    });
    expect(() =>
      commitStudyRevision(r2, r2.usdm, {
        expectedRevisionId: "R1",
        note: "Stale",
      })
    ).toThrow(StudyWorkspaceConflictError);
  });

  it("saves and reopens a workspace exactly", async () => {
    const { workspace } = ok(
      await importUsdmStudy({ document: DEMO_301_USDM })
    );
    expect(openStudyWorkspace(serializeStudyWorkspace(workspace))).toEqual({
      status: "ok",
      workspace,
    });
  });

  it.each([
    ["text that is not JSON", "{", "not-json"],
    ["JSON that is not a workspace", "{}", "not-a-workspace"],
  ])("refuses %s", (_label, text, problem) => {
    expect(openStudyWorkspace(text)).toEqual({ status: "invalid", problem });
  });

  it("refuses a file whose study was edited outside the studio", async () => {
    const { workspace } = ok(
      await importUsdmStudy({ document: DEMO_301_USDM })
    );
    const saved = JSON.parse(serializeStudyWorkspace(workspace));
    saved.usdm.study.name = "Hand-edited";
    expect(openStudyWorkspace(JSON.stringify(saved))).toEqual({
      status: "invalid",
      problem: "revision-hash-mismatch",
    });
  });

  describe("a hash-valid file with a malformed nested workspace (#3619)", () => {
    // Saved files are edited as loose JSON to build malformed variants.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Saved = Record<string, any>;

    /**
     * A saved workspace with one part replaced, its revision hash recomputed
     * so the hash check alone would let it through.
     */
    async function rehashed(edit: (saved: Saved) => void): Promise<string> {
      const { workspace } = ok(
        await importUsdmStudy({ document: DEMO_301_USDM })
      );
      const saved = JSON.parse(serializeStudyWorkspace(workspace));
      edit(saved);
      if (saved.revision && typeof saved.revision === "object") {
        saved.revision.sha256 = usdmContentHash(saved.usdm);
      }
      return JSON.stringify(saved);
    }

    it.each<[string, (saved: Saved) => void]>([
      ["an empty USDM document", (s) => (s.usdm = {})],
      ["a USDM document with no study", (s) => delete s.usdm.study],
      ["a study with no name", (s) => delete s.usdm.study.name],
      ["a study with no versions", (s) => (s.usdm.study.versions = [])],
      ["a non-v4 USDM document", (s) => (s.usdm.usdmVersion = "3.0.0")],
      [
        "a selection naming a missing study version",
        (s) => (s.selection.studyVersionId = "Missing_Version"),
      ],
      [
        "a selection naming a missing design",
        (s) => (s.selection.studyDesignId = "Missing_Design"),
      ],
      [
        "a selection with no design id",
        (s) => delete s.selection.studyDesignId,
      ],
      ["a revision with no id", (s) => delete s.revision.id],
      ["a revision with a numeric note", (s) => (s.revision.note = 7)],
      ["a source with no sha256", (s) => delete s.source.sha256],
      ["locks with no USDM version", (s) => delete s.locks.USDM],
      [
        "a preserved item with an unknown reason",
        (s) => s.preserved.push({ path: "study", reason: "other", label: "x" }),
      ],
      ["a preserved item that is not an object", (s) => s.preserved.push(1)],
    ])("refuses %s", async (_label, edit) => {
      expect(openStudyWorkspace(await rehashed(edit))).toEqual({
        status: "invalid",
        problem: "not-a-workspace",
      });
    });

    it("opens a workspace whose selection is not the first design", async () => {
      const result = ok(
        await importUsdmStudy(
          { document: multiVersionStudy() },
          {
            selection: {
              studyVersionId: multiVersionStudy().study.versions[0]
                .id as string,
              studyDesignId: "Design_Extra",
            },
          }
        )
      );
      expect(
        openStudyWorkspace(serializeStudyWorkspace(result.workspace))
      ).toEqual({ status: "ok", workspace: result.workspace });
    });
  });

  it("refuses another workspace file version", async () => {
    const { workspace } = ok(
      await importUsdmStudy({ document: DEMO_301_USDM })
    );
    const saved = { ...workspace, workspaceVersion: 2 };
    expect(openStudyWorkspace(JSON.stringify(saved))).toEqual({
      status: "invalid",
      problem: "unsupported-version",
    });
  });
});
