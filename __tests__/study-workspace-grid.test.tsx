/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RANDOMIZATION_RESOURCE_LIMITS } from "@/lib/randomization";
import { TAVR_SAVR_USDM } from "@/lib/study-workspace";

const downloads = vi.hoisted(() => [] as { content: string; name: string }[]);
vi.mock("@/lib/download", () => ({
  downloadFile: (content: string, name: string) => {
    downloads.push({ content, name });
  },
}));
import { StudyDesignGrid } from "@/components/study-workspace/StudyDesignGrid";
import {
  STUDY_WORKSPACE_DRAFT_KEY,
  STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY,
  loadStudyWorkspaceDraft,
} from "@/components/study-workspace/randomization-draft-storage";

afterEach(() => {
  cleanup();
  downloads.length = 0;
  // Unmounting flushes the draft; each test starts with none.
  localStorage.removeItem(STUDY_WORKSPACE_DRAFT_KEY);
  localStorage.removeItem(STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY);
});

/** The design view's arms-by-epochs grid (#3401, ADR 0074). */

async function opened() {
  const view = render(<StudyDesignGrid />);
  await screen.findByRole("table");
  return view;
}

const table = () => screen.getByRole("table");
const cellButtons = () =>
  within(table())
    .getAllByRole("button")
    .filter((button) => button.closest("td"));

function renameFirstArm(name: string) {
  fireEvent.click(
    within(within(table()).getAllByRole("rowheader")[0]).getByRole("button")
  );
  const panel = screen.getByRole("region", { name: /^Edit arm / });
  fireEvent.change(within(panel).getByRole("textbox", { name: "Arm name" }), {
    target: { value: name },
  });
  fireEvent.click(within(panel).getByRole("button", { name: "Rename" }));
}

describe("study design grid", () => {
  it("renders a labelled cell for every arm and epoch pair", async () => {
    await opened();
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toEqual([
      "Screening EpochScreening",
      "Index Procedure EpochTreatment",
      "Follow-Up EpochFollow-Up",
    ]);
    expect(within(table()).getAllByRole("rowheader")).toHaveLength(2);
    expect(cellButtons()).toHaveLength(6);
    expect(
      screen.getByRole("button", {
        name: "TAVR System, Index Procedure Epoch: TAVR System - Index Procedure Epoch",
      })
    ).toBeTruthy();
    expect(
      screen.getByText("Every arm and epoch pair has a cell.")
    ).toBeTruthy();
  });

  it("shows a finding where a blank study's design has no cell", async () => {
    await opened();
    fireEvent.change(screen.getByRole("combobox", { name: "Study" }), {
      target: { value: "blank" },
    });
    await screen.findByText(/no arms or epochs yet/);
    fireEvent.change(screen.getByRole("textbox", { name: "Arm name" }), {
      target: { value: "Device" },
    });
    fireEvent.click(
      within(screen.getByRole("group", { name: "Add an arm" })).getByRole(
        "button",
        { name: "Add" }
      )
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Epoch name" }), {
      target: { value: "Screening" },
    });
    fireEvent.click(
      within(screen.getByRole("group", { name: "Add an epoch" })).getByRole(
        "button",
        { name: "Add" }
      )
    );
    expect(
      screen.getByRole("button", { name: "Device, Screening: no cell" })
    ).toBeTruthy();
    expect(screen.getByText("Device has no cell in Screening.")).toBeTruthy();
  });

  it("renames an arm from the inspector and undoes it", async () => {
    await opened();
    fireEvent.click(
      within(within(table()).getAllByRole("rowheader")[0]).getByRole("button")
    );
    const panel = screen.getByRole("region", { name: "Edit arm TAVR System" });
    fireEvent.change(within(panel).getByRole("textbox", { name: "Arm name" }), {
      target: { value: "TAVR" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Rename" }));
    expect(within(table()).getAllByRole("rowheader")[0].textContent).toContain(
      "TAVR"
    );
    expect(screen.getByText("Revision R2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(within(table()).getAllByRole("rowheader")[0].textContent).toContain(
      "TAVR System"
    );
    expect(screen.getByText("Revision R3")).toBeTruthy();
  });

  it("moves an element to another cell with the keyboard action", async () => {
    await opened();
    fireEvent.click(
      screen.getByRole("button", {
        name: "TAVR System, Screening Epoch: TAVR System - Screening Epoch",
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit element TAVR System - Screening Epoch",
      })
    );
    const panel = screen.getByRole("region", {
      name: "Edit element TAVR System - Screening Epoch",
    });
    fireEvent.change(
      within(panel).getByRole("combobox", { name: "Move to cell" }),
      { target: { value: "0" } }
    );
    fireEvent.click(within(panel).getByRole("button", { name: "Move" }));
    expect(
      screen.getByRole("button", {
        name: "TAVR System, Screening Epoch: no elements",
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /^TAVR System, Index Procedure Epoch: TAVR System - Index Procedure Epoch, TAVR System - Screening Epoch$/,
      })
    ).toBeTruthy();
  });

  it("shows why an epoch the schedule uses cannot be removed", async () => {
    await opened();
    fireEvent.click(
      within(within(table()).getAllByRole("columnheader")[1]).getByRole(
        "button"
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove epoch" }));
    // The reference schedule places activities in this epoch, so the
    // removal is refused and the grid says why.
    expect(screen.getByRole("alert").textContent).toMatch(/still referenced/);
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(3);
  });

  it("has no axe violations", async () => {
    const { container } = await opened();
    const results = await axe.run(container, {
      rules: { region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("saves an edit as a draft and offers it back after a reload", async () => {
    const first = await opened();
    renameFirstArm("TAVR arm");
    expect(
      await screen.findByText(
        "Draft saved in this browser.",
        {},
        { timeout: 3000 }
      )
    ).toBeTruthy();
    first.unmount();

    await opened();
    expect(
      screen.getByRole("heading", { name: "A saved draft is in this browser" })
    ).toBeTruthy();
    // The reference study stays open until the person chooses.
    expect(screen.getByText("Revision R1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
    expect(screen.getByText("Revision R2")).toBeTruthy();
    expect(within(table()).getAllByRole("rowheader")[0].textContent).toContain(
      "TAVR arm"
    );
  });

  it("discards an offered draft only when asked", async () => {
    const first = await opened();
    renameFirstArm("Renamed");
    first.unmount();
    expect(loadStudyWorkspaceDraft().status).toBe("recovered");

    await opened();
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(loadStudyWorkspaceDraft().status).toBe("empty");
  });

  it("sets an unreadable draft aside and offers its text for download", async () => {
    localStorage.setItem(STUDY_WORKSPACE_DRAFT_KEY, "{broken");
    await opened();
    expect(
      await screen.findByRole("button", { name: "Download unreadable draft" })
    ).toBeTruthy();
    expect(screen.getByText("not-json")).toBeTruthy();
    expect(localStorage.getItem(STUDY_WORKSPACE_DRAFT_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(
      screen.queryByRole("button", { name: "Download unreadable draft" })
    ).toBeNull();
  });

  it("edits Protocol ID, Study name, and Phase in Inspector and propagates to MetadataStage and CSV headers with Undo and Redo", async () => {
    await opened();
    const inspector = screen.getByRole("region", { name: "Study metadata" });
    fireEvent.change(
      within(inspector).getByRole("textbox", { name: "Protocol ID" }),
      { target: { value: "VALVE-2028-P2" } }
    );
    fireEvent.change(
      within(inspector).getByRole("textbox", { name: "Study name" }),
      { target: { value: "Transcatheter Valve Phase II" } }
    );
    fireEvent.change(
      within(inspector).getByRole("combobox", { name: "Phase" }),
      { target: { value: "C15601" } }
    );
    fireEvent.click(
      within(inspector).getByRole("button", { name: "Save metadata" })
    );
    expect(screen.getByText("Revision R2")).toBeTruthy();

    // Check MetadataStage in RandomizationWorkspace for a stored plan.
    const randArea = within(
      screen.getByRole("region", { name: "Randomization work area" })
    );
    fireEvent.click(
      randArea.getByRole("button", { name: "Add a plan for this design" })
    );
    fireEvent.click(randArea.getByRole("checkbox"));
    const stageNav = within(
      randArea.getByRole("navigation", { name: "Randomization stages" })
    );
    fireEvent.click(
      stageNav
        .getAllByRole("button")
        .find((b) => b.textContent?.endsWith("Study metadata"))!
    );
    expect(randArea.getByText("VALVE-2028-P2")).toBeTruthy();
    expect(randArea.getByText("Transcatheter Valve Phase II")).toBeTruthy();
    expect(randArea.getByText("Phase II Trial")).toBeTruthy();

    // Undo metadata edit (after undoing plan state + plan creation) or test Undo/Redo directly:
    fireEvent.click(screen.getByRole("button", { name: "Undo" })); // undo notice ack
    fireEvent.click(screen.getByRole("button", { name: "Undo" })); // undo add plan
    fireEvent.click(screen.getByRole("button", { name: "Undo" })); // undo metadata edit
    const undoneInspector = screen.getByRole("region", {
      name: "Study metadata",
    });
    expect(
      (
        within(undoneInspector).getByRole("textbox", {
          name: "Protocol ID",
        }) as HTMLInputElement
      ).value
    ).toBe("DEV-2026-VALVE-RCT");

    // Redo metadata edit and export CSV to confirm header propagation.
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(
      (
        within(
          screen.getByRole("region", { name: "Study metadata" })
        ).getByRole("textbox", { name: "Protocol ID" }) as HTMLInputElement
      ).value
    ).toBe("VALVE-2028-P2");

    fireEvent.click(stageNav.getAllByRole("button")[0]);
    fireEvent.click(randArea.getByRole("checkbox"));
    fireEvent.click(
      stageNav
        .getAllByRole("button")
        .find((b) => b.textContent?.endsWith("Review"))!
    );
    fireEvent.click(
      randArea.getByRole("button", { name: "Promote to a plan for this study" })
    );
    fireEvent.click(
      stageNav
        .getAllByRole("button")
        .find((b) => b.textContent?.endsWith("Mechanics"))!
    );
    const seedInput = randArea.getByLabelText("Seed");
    fireEvent.change(seedInput, { target: { value: "MetaCsvSeed1" } });
    fireEvent.blur(seedInput);
    fireEvent.click(
      stageNav
        .getAllByRole("button")
        .find((b) => b.textContent?.endsWith("Review"))!
    );
    const runRegion = within(
      screen.getByRole("region", { name: "Run and results", hidden: true })
    );
    fireEvent.click(runRegion.getByRole("button", { name: "Run" }));
    await runRegion.findByRole("table");
    fireEvent.click(runRegion.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].content).toContain("# Protocol ID: VALVE-2028-P2");
    expect(downloads[0].content).toContain(
      "# Study name: Transcatheter Valve Phase II"
    );
    expect(downloads[0].content).toContain("# Phase: Phase II Trial");
  });

  it("imports multi-design USDM via ModalContainer while preserving unselected content, saves and reopens .study.json, enforces the 8 MiB limit, and shows schema issues inline", async () => {
    await opened();
    const fileInput = screen.getByLabelText(
      "Import study file"
    ) as HTMLInputElement;

    // 1. Oversized file (> 8 MiB) is rejected before reading or parsing.
    const oversized = new File(["{}"], "too-large.usdm.json", {
      type: "application/json",
    });
    Object.defineProperty(oversized, "size", {
      value: RANDOMIZATION_RESOURCE_LIMITS.maxImportBytes + 1,
    });
    const readSpy = vi.spyOn(oversized, "text");
    fireEvent.change(fileInput, { target: { files: [oversized] } });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/8 MiB/);
    expect(readSpy).not.toHaveBeenCalled();

    // 2. Save workspace -> downloads .study.json -> re-import via Import file.
    fireEvent.click(screen.getByRole("button", { name: "Save workspace" }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0].name).toMatch(/\.study\.json$/);
    const savedWorkspaceJson = downloads[0].content;
    downloads.length = 0;

    const wsFile = new File([savedWorkspaceJson], "reopened.study.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [wsFile] } });
    await waitFor(() =>
      expect(
        (screen.getByRole("combobox", { name: "Study" }) as HTMLSelectElement)
          .value
      ).not.toBe("tavr-savr")
    );

    // 3. Multi-version & multi-design USDM with extensionAttributes opens ModalContainer and preserves unselected items on Export USDM.
    const baseStudy = structuredClone(TAVR_SAVR_USDM.study);
    const baseVersion = baseStudy.versions![0];
    const baseDesign = baseVersion.studyDesigns![0];
    const secondDesign = {
      id: "design_cohort_b",
      name: "Registry Cohort Design",
      rationale: "Parallel registry cohort",
      arms: [],
      epochs: [],
      studyCells: [],
      eligibilityCriteria: [],
      population: {
        id: "pop_reg_1",
        name: "Registry population",
        includesHealthySubjects: false,
        instanceType: "StudyDesignPopulation" as const,
      },
      model: {
        id: "model_reg_1",
        code: "C82639",
        codeSystem: "http://www.cdisc.org",
        codeSystemVersion: "2026-09-25",
        decode: "Parallel Study",
        instanceType: "Code" as const,
      },
      instanceType: "InterventionalStudyDesign" as const,
    };
    const secondVersion = {
      id: "study_version_2",
      versionIdentifier: "2",
      rationale: "Preserved version 2",
      studyIdentifiers: [],
      titles: [],
      studyDesigns: [
        {
          ...structuredClone(secondDesign),
          id: "design_v2_only",
          name: "Version 2 Design",
          population: {
            ...structuredClone(secondDesign.population),
            id: "pop_v2_1",
          },
          model: {
            ...structuredClone(secondDesign.model),
            id: "model_v2_1",
          },
        },
      ],
      instanceType: "StudyVersion" as const,
    };
    const multiDoc = {
      ...structuredClone(TAVR_SAVR_USDM),
      study: {
        ...baseStudy,
        extensionAttributes: [
          {
            id: "ext_preserved_root",
            url: "https://example.org/ext/preserved",
            valueString: "keep-me",
            instanceType: "ExtensionAttribute" as const,
          },
        ],
        versions: [
          {
            ...baseVersion,
            studyDesigns: [baseDesign, secondDesign],
          },
          secondVersion,
        ],
      },
    };

    const multiFile = new File(
      [JSON.stringify(multiDoc)],
      "multi-design.usdm.json",
      { type: "application/json" }
    );
    fireEvent.change(fileInput, { target: { files: [multiFile] } });

    const modal = await screen.findByRole("dialog", {
      name: "Choose study version and design",
    });
    fireEvent.change(
      within(modal).getByRole("combobox", { name: "Study design" }),
      { target: { value: "design_cohort_b" } }
    );
    fireEvent.click(
      within(modal).getByRole("button", { name: "Open selected design" })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Choose study version and design",
        })
      ).toBeNull()
    );

    fireEvent.click(screen.getByRole("button", { name: "Export USDM" }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].name).toMatch(/\.usdm\.json$/);
    const exportedUsdm = JSON.parse(downloads[0].content) as {
      study: {
        extensionAttributes: unknown[];
        versions: Array<{ studyDesigns: unknown[] }>;
      };
    };
    expect(exportedUsdm.study.extensionAttributes).toEqual([
      expect.objectContaining({
        id: "ext_preserved_root",
        valueString: "keep-me",
      }),
    ]);
    expect(exportedUsdm.study.versions).toHaveLength(2);
    expect(exportedUsdm.study.versions[0].studyDesigns).toHaveLength(2);
    downloads.length = 0;

    // 4. Schema-invalid USDM imports cleanly (per ADR 0074) and surfaces validation issues inline on Export USDM.
    const invalidDoc = {
      ...structuredClone(TAVR_SAVR_USDM),
      study: {
        ...structuredClone(TAVR_SAVR_USDM.study),
        id: "not-a-valid-uuid",
      },
    };
    const invalidFile = new File(
      [JSON.stringify(invalidDoc)],
      "invalid-schema.usdm.json",
      { type: "application/json" }
    );
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    await waitFor(() =>
      expect(
        (screen.getByRole("combobox", { name: "Study" }) as HTMLSelectElement)
          .value
      ).toContain("dev-2026-valve-rct")
    );
    fireEvent.click(screen.getByRole("button", { name: "Export USDM" }));
    const issueAlert = await screen.findByRole("alert");
    expect(issueAlert.textContent).toContain(
      "USDM v4 schema validation issues prevented export"
    );
    expect(downloads).toHaveLength(0);
  });
});
