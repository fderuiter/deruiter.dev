/**
 * @vitest-environment jsdom
 */
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { StudyAnalysisPanel } from "@/components/study-workspace/StudyAnalysisPanel";
import type { StudyApplyFn } from "@/components/study-workspace/StudyDesignGrid";
import { StudyNarrativePanel } from "@/components/study-workspace/StudyNarrativePanel";
import { StudySchedulePanel } from "@/components/study-workspace/StudySchedulePanel";
import {
  StudyDesignError,
  TAVR_SAVR_USDM,
  applyStudyEdit,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  importUsdmStudy,
  type StudyWorkspace,
} from "@/lib/study-workspace";

afterEach(cleanup);

let rctWorkspace: StudyWorkspace;
let blankWorkspace: StudyWorkspace;

beforeAll(async () => {
  const rct = await importUsdmStudy({ document: TAVR_SAVR_USDM });
  if (rct.status !== "ok") {
    throw new Error("Reference RCT study failed to import.");
  }
  rctWorkspace = rct.workspace;
  blankWorkspace = (await createBlankStudyWorkspace()).workspace;
});

function PanelHarness({
  initial,
  panel,
}: {
  readonly initial: StudyWorkspace;
  readonly panel: "schedule" | "narrative" | "analysis";
}) {
  const [workspace, setWorkspace] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const apply: StudyApplyFn = (build) => {
    try {
      const next = applyStudyEdit(
        workspace,
        emptyStudyEditHistory(),
        build(workspace)
      );
      setWorkspace(next.workspace);
      setError(null);
      return true;
    } catch (caught) {
      setError(
        caught instanceof StudyDesignError
          ? caught.message
          : "Unexpected edit error."
      );
      return false;
    }
  };

  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {panel === "schedule" && (
        <StudySchedulePanel workspace={workspace} apply={apply} />
      )}
      {panel === "narrative" && (
        <StudyNarrativePanel workspace={workspace} apply={apply} />
      )}
      {panel === "analysis" && (
        <StudyAnalysisPanel workspace={workspace} apply={apply} />
      )}
    </div>
  );
}

describe("StudySchedulePanel", () => {
  it("adds, inspects, renames, reorders, retimes, clears timing, and removes visits and activities", () => {
    render(<PanelHarness initial={rctWorkspace} panel="schedule" />);

    // Add a visit and an activity
    const addVisitGroup = screen.getByRole("group", { name: "Add a visit" });
    fireEvent.change(
      within(addVisitGroup).getByRole("textbox", { name: "New visit name" }),
      { target: { value: "90-Day Phone Check" } }
    );
    fireEvent.change(
      within(addVisitGroup).getByRole("combobox", { name: "Encounter type" }),
      { target: { value: "C25716" } }
    );
    fireEvent.change(
      within(addVisitGroup).getByRole("spinbutton", {
        name: "Study day (optional)",
      }),
      { target: { value: "90" } }
    );
    fireEvent.change(
      within(addVisitGroup).getByRole("spinbutton", { name: "Window before" }),
      { target: { value: "5" } }
    );
    fireEvent.change(
      within(addVisitGroup).getByRole("spinbutton", { name: "Window after" }),
      { target: { value: "5" } }
    );
    fireEvent.click(
      within(addVisitGroup).getByRole("button", { name: "Add visit" })
    );
    expect(screen.getByText("8 encounters")).toBeTruthy();

    const addActivityGroup = screen.getByRole("group", {
      name: "Add an activity",
    });
    fireEvent.change(
      within(addActivityGroup).getByRole("textbox", {
        name: "New activity name",
      }),
      { target: { value: "NT-proBNP Biomarker" } }
    );
    fireEvent.click(
      within(addActivityGroup).getByRole("button", { name: "Add activity" })
    );
    expect(screen.getByText("11 activities")).toBeTruthy();

    // Inspect the newly added visit: rename, move, clear timing, re-save timing, remove
    fireEvent.click(
      screen.getByRole("button", { name: /^90-Day Phone Check Day 90/i })
    );
    let visitInspector = screen.getByRole("region", {
      name: "Edit visit 90-Day Phone Check",
    });
    fireEvent.change(
      within(visitInspector).getByRole("textbox", { name: "Visit name" }),
      { target: { value: "Day 90 Telehealth" } }
    );
    fireEvent.click(
      within(visitInspector).getByRole("button", { name: "Rename visit" })
    );
    visitInspector = screen.getByRole("region", {
      name: "Edit visit Day 90 Telehealth",
    });

    fireEvent.click(
      within(visitInspector).getByRole("button", { name: "Move earlier" })
    );
    fireEvent.click(
      within(visitInspector).getByRole("button", { name: "Move later" })
    );
    fireEvent.click(
      within(visitInspector).getByRole("button", { name: "Clear timing" })
    );
    expect(
      (
        within(visitInspector).getByRole("spinbutton", {
          name: "Planned study day (no Day 0)",
        }) as HTMLInputElement
      ).value
    ).toBe("");

    fireEvent.change(
      within(visitInspector).getByRole("spinbutton", {
        name: "Planned study day (no Day 0)",
      }),
      { target: { value: "95" } }
    );
    fireEvent.change(
      within(visitInspector).getByRole("spinbutton", {
        name: "Window before (days)",
      }),
      { target: { value: "3" } }
    );
    fireEvent.change(
      within(visitInspector).getByRole("spinbutton", {
        name: "Window after (days)",
      }),
      { target: { value: "4" } }
    );
    fireEvent.click(
      within(visitInspector).getByRole("button", { name: "Save timing" })
    );
    fireEvent.click(
      within(visitInspector).getByRole("button", { name: "Remove visit" })
    );
    expect(screen.getByText("7 encounters")).toBeTruthy();

    // Inspect the newly added activity: rename, move up/down, remove
    fireEvent.click(
      screen.getByRole("button", { name: /^NT-proBNP Biomarker$/ })
    );
    let actInspector = screen.getByRole("region", {
      name: "Edit activity NT-proBNP Biomarker",
    });
    fireEvent.change(
      within(actInspector).getByRole("textbox", { name: "Activity name" }),
      { target: { value: "Troponin & NT-proBNP" } }
    );
    fireEvent.click(
      within(actInspector).getByRole("button", { name: "Rename activity" })
    );
    actInspector = screen.getByRole("region", {
      name: "Edit activity Troponin & NT-proBNP",
    });
    fireEvent.click(
      within(actInspector).getByRole("button", { name: "Move up" })
    );
    fireEvent.click(
      within(actInspector).getByRole("button", { name: "Move down" })
    );
    fireEvent.click(
      within(actInspector).getByRole("button", { name: "Remove activity" })
    );
    expect(screen.getByText("10 activities")).toBeTruthy();
  });

  it("renders empty states on a blank study and adds a Day 1 anchor visit before activities", () => {
    render(<PanelHarness initial={blankWorkspace} panel="schedule" />);
    expect(
      screen.getByText(/no visits or clinical activities yet/i)
    ).toBeTruthy();

    const addVisitGroup = screen.getByRole("group", { name: "Add a visit" });
    fireEvent.change(
      within(addVisitGroup).getByRole("textbox", { name: "New visit name" }),
      { target: { value: "Baseline Day 1" } }
    );
    fireEvent.change(
      within(addVisitGroup).getByRole("spinbutton", {
        name: "Study day (optional)",
      }),
      { target: { value: "1" } }
    );
    fireEvent.click(
      within(addVisitGroup).getByRole("button", { name: "Add visit" })
    );
    expect(screen.getByText(/No clinical activities yet/i)).toBeTruthy();
    expect(
      screen.getByText(
        "Timeline, Fixed Reference anchor timing, and scheduled visits are complete."
      )
    ).toBeTruthy();
  });
});

describe("StudyNarrativePanel", () => {
  it("adds, edits, cancels, reorders, and removes objectives, nested endpoints, and criteria", () => {
    render(<PanelHarness initial={rctWorkspace} panel="narrative" />);

    // Add a new objective
    const addObjGroup = screen.getByRole("group", { name: "Add an objective" });
    fireEvent.change(
      within(addObjGroup).getByRole("textbox", { name: "New objective name" }),
      { target: { value: "Exploratory Hemodynamic Objective" } }
    );
    fireEvent.change(
      within(addObjGroup).getByRole("combobox", { name: "Objective level" }),
      { target: { value: "C163559" } }
    );
    fireEvent.change(
      within(addObjGroup).getByRole("textbox", { name: "Objective text" }),
      { target: { value: "Characterize prosthetic valve leaflet motion." } }
    );
    fireEvent.click(
      within(addObjGroup).getByRole("button", { name: "Add objective" })
    );
    expect(screen.getByText("5 objectives")).toBeTruthy();

    const objCard = screen.getByRole("article", {
      name: "Objective Exploratory Hemodynamic Objective",
    });

    // Open editor, cancel, then open and save
    fireEvent.click(
      within(objCard).getByRole("button", {
        name: "Edit Exploratory Hemodynamic Objective",
      })
    );
    fireEvent.click(within(objCard).getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      within(objCard).getByRole("button", {
        name: "Edit Exploratory Hemodynamic Objective",
      })
    );
    fireEvent.change(
      within(objCard).getByRole("textbox", { name: "Objective name" }),
      { target: { value: "Exploratory CT Leaflet Objective" } }
    );
    fireEvent.change(
      within(objCard).getByRole("combobox", { name: "Objective level" }),
      { target: { value: "C85827" } }
    );
    fireEvent.change(
      within(objCard).getByRole("textbox", { name: "Objective text" }),
      {
        target: { value: "Assess hypoattenuated leaflet thickening on 4D-CT." },
      }
    );
    fireEvent.click(
      within(objCard).getByRole("button", { name: "Save objective" })
    );

    const renamedObjCard = screen.getByRole("article", {
      name: "Objective Exploratory CT Leaflet Objective",
    });

    // Reorder objective up and down
    fireEvent.click(
      within(renamedObjCard).getByRole("button", {
        name: "Move objective Exploratory CT Leaflet Objective up",
      })
    );
    fireEvent.click(
      within(
        screen.getByRole("article", {
          name: "Objective Exploratory CT Leaflet Objective",
        })
      ).getByRole("button", {
        name: "Move objective Exploratory CT Leaflet Objective down",
      })
    );

    // Add two nested endpoints to the new objective, edit, reorder, and remove
    const latestObjCard = () =>
      screen.getByRole("article", {
        name: "Objective Exploratory CT Leaflet Objective",
      });
    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Add endpoint to Exploratory CT Leaflet Objective",
      })
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", {
        name: "New endpoint name",
      }),
      { target: { value: "30-Day HALT Incidence" } }
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("combobox", { name: "Endpoint level" }),
      { target: { value: "C170559" } }
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", { name: "Purpose" }),
      { target: { value: "Imaging safety" } }
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", { name: "Endpoint text" }),
      { target: { value: "Proportion with HALT >= grade 2 at Day 30." } }
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", { name: "Add endpoint" })
    );

    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Add endpoint to Exploratory CT Leaflet Objective",
      })
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", {
        name: "New endpoint name",
      }),
      { target: { value: "Reduced Leaflet Motion" } }
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", { name: "Endpoint text" }),
      { target: { value: "Reduced leaflet motion >50% at Day 30." } }
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", { name: "Add endpoint" })
    );
    expect(screen.getByText("9 endpoints")).toBeTruthy();

    // Edit, cancel, save, reorder, and remove endpoint
    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Edit endpoint Reduced Leaflet Motion",
      })
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", { name: "Cancel" })
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Edit endpoint Reduced Leaflet Motion",
      })
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", { name: "Endpoint name" }),
      { target: { value: "Day 30 RLM" } }
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("combobox", { name: "Endpoint level" }),
      { target: { value: "C139173" } }
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", { name: "Purpose" }),
      { target: { value: "Secondary imaging" } }
    );
    fireEvent.change(
      within(latestObjCard()).getByRole("textbox", { name: "Endpoint text" }),
      { target: { value: "RLM grade >= 3 on cardiac CT." } }
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", { name: "Save endpoint" })
    );

    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Move endpoint Day 30 RLM up",
      })
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Move endpoint Day 30 RLM down",
      })
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Remove endpoint Day 30 RLM",
      })
    );
    fireEvent.click(
      within(latestObjCard()).getByRole("button", {
        name: "Remove objective Exploratory CT Leaflet Objective",
      })
    );
    expect(screen.getByText("4 objectives")).toBeTruthy();

    // Edit, reorder, and remove an eligibility criterion
    const firstCritName = "Inclusion 1";
    const critArticles = screen
      .getAllByRole("article")
      .filter((el) => el.getAttribute("aria-label")?.startsWith("Criterion "));
    expect(critArticles.length).toBe(7);
    const critLabel =
      critArticles[1].getAttribute("aria-label")?.replace(/^Criterion /, "") ??
      firstCritName;

    fireEvent.click(
      within(critArticles[1]).getByRole("button", {
        name: `Edit criterion ${critLabel}`,
      })
    );
    fireEvent.click(
      within(critArticles[1]).getByRole("button", { name: "Cancel" })
    );
    fireEvent.click(
      within(critArticles[1]).getByRole("button", {
        name: `Edit criterion ${critLabel}`,
      })
    );
    fireEvent.change(
      within(critArticles[1]).getByRole("textbox", { name: "Criterion name" }),
      { target: { value: "Edited Criterion" } }
    );
    fireEvent.change(
      within(critArticles[1]).getByRole("textbox", { name: "Identifier" }),
      { target: { value: "02-REV" } }
    );
    fireEvent.change(
      within(critArticles[1]).getByRole("combobox", { name: "Category" }),
      { target: { value: "C25370" } }
    );
    fireEvent.change(
      within(critArticles[1]).getByRole("textbox", { name: "Criterion text" }),
      { target: { value: "Updated structured exclusion text." } }
    );
    fireEvent.click(
      within(critArticles[1]).getByRole("button", { name: "Save criterion" })
    );

    const editedCrit = screen.getByRole("article", {
      name: "Criterion Edited Criterion",
    });
    fireEvent.click(
      within(editedCrit).getByRole("button", {
        name: "Move criterion Edited Criterion up",
      })
    );
    fireEvent.click(
      within(
        screen.getByRole("article", { name: "Criterion Edited Criterion" })
      ).getByRole("button", {
        name: "Move criterion Edited Criterion down",
      })
    );
    fireEvent.click(
      within(
        screen.getByRole("article", { name: "Criterion Edited Criterion" })
      ).getByRole("button", {
        name: "Remove criterion Edited Criterion",
      })
    );
    expect(screen.getByText("6 criteria")).toBeTruthy();
  });

  it("renders empty states on a blank study and missing-item warnings on broken narrative records", () => {
    const { unmount } = render(
      <PanelHarness initial={blankWorkspace} panel="narrative" />
    );
    expect(screen.getByText(/no objectives yet/i)).toBeTruthy();
    expect(screen.getByText(/no eligibility criteria yet/i)).toBeTruthy();
    unmount();

    const broken = structuredClone(rctWorkspace);
    const version = broken.usdm.study.versions![0];
    const design = version.studyDesigns![0];
    version.eligibilityCriterionItems!.shift();
    version.eligibilityCriterionItems![0].text = "";
    Reflect.set(design.eligibilityCriteria[0], "category", null);
    design.eligibilityCriteria[0].identifier = "";
    Reflect.set(design.objectives![0], "level", null);
    design.objectives![0].text = "";
    Reflect.set(design.objectives![0].endpoints![0], "level", null);
    design.objectives![0].endpoints![0].purpose = "";
    design.objectives![0].endpoints![0].text = "";

    render(<PanelHarness initial={broken} panel="narrative" />);
    expect(screen.getByText(/Missing criterion text item/i)).toBeTruthy();
    expect(screen.getByText(/Missing category/i)).toBeTruthy();
    expect(screen.getByText(/Missing coded level/i)).toBeTruthy();
    expect(screen.getByText(/Missing level/i)).toBeTruthy();
    expect(screen.getByText(/Missing purpose/i)).toBeTruthy();
    expect(screen.getByText(/Criterion text item is empty/i)).toBeTruthy();
    expect(
      screen.getByText(/No structured objective text recorded/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/No structured endpoint text recorded/i)
    ).toBeTruthy();
  });
});

describe("StudyAnalysisPanel", () => {
  it("adds, edits, cancels, reorders, and removes estimands, intercurrent events, and analysis populations", () => {
    render(<PanelHarness initial={rctWorkspace} panel="analysis" />);

    // Add a supplementary estimand with an intervention checked
    const addEstGroup = screen.getByRole("group", { name: "Add an estimand" });
    fireEvent.change(
      within(addEstGroup).getByRole("textbox", { name: "New estimand name" }),
      { target: { value: "Supplementary Safety Estimand" } }
    );
    const checkboxes = within(addEstGroup).getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.change(
      within(addEstGroup).getByRole("textbox", {
        name: "Population-level summary",
      }),
      { target: { value: "30-day event rate difference (95% CI)." } }
    );
    fireEvent.click(
      within(addEstGroup).getByRole("button", { name: "Add estimand" })
    );
    expect(screen.getByText("2 estimands")).toBeTruthy();

    const estCard = () =>
      screen.getByRole("article", {
        name: /Estimand Supplementary Safety Estimand/,
      });

    // Edit estimand: cancel then save
    fireEvent.click(
      within(estCard()).getByRole("button", {
        name: "Edit estimand Supplementary Safety Estimand",
      })
    );
    fireEvent.click(within(estCard()).getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      within(estCard()).getByRole("button", {
        name: "Edit estimand Supplementary Safety Estimand",
      })
    );
    fireEvent.change(
      within(estCard()).getByRole("textbox", { name: "Estimand name" }),
      { target: { value: "Secondary Valve Safety Estimand" } }
    );
    fireEvent.change(
      within(estCard()).getByRole("textbox", {
        name: "Description (optional)",
      }),
      { target: { value: "As-treated 30-day safety estimand." } }
    );
    const editCheckboxes = within(estCard()).getAllByRole("checkbox");
    fireEvent.click(editCheckboxes[1]);
    fireEvent.click(
      within(estCard()).getByRole("button", { name: "Save estimand" })
    );

    const renamedEstCard = () =>
      screen.getByRole("article", {
        name: "Estimand Secondary Valve Safety Estimand",
      });

    // Add two intercurrent events, edit, reorder, and remove
    for (const evName of ["Emergency conversion", "Device explant"]) {
      fireEvent.click(
        within(renamedEstCard()).getByRole("button", {
          name: "Add intercurrent event to Secondary Valve Safety Estimand",
        })
      );
      fireEvent.change(
        within(renamedEstCard()).getByRole("textbox", {
          name: "New event name",
        }),
        { target: { value: evName } }
      );
      fireEvent.change(
        within(renamedEstCard()).getByRole("combobox", {
          name: "ICH E9(R1) strategy",
        }),
        { target: { value: "While on treatment" } }
      );
      fireEvent.change(
        within(renamedEstCard()).getByRole("textbox", {
          name: "Event description",
        }),
        { target: { value: `${evName} within 30 days.` } }
      );
      fireEvent.click(
        within(renamedEstCard()).getByRole("button", {
          name: "Add intercurrent event",
        })
      );
    }

    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Edit event Device explant",
      })
    );
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", { name: "Cancel" })
    );
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Edit event Device explant",
      })
    );
    fireEvent.change(
      within(renamedEstCard()).getByRole("textbox", { name: "Event name" }),
      { target: { value: "Surgical valve explant" } }
    );
    fireEvent.change(
      within(renamedEstCard()).getByRole("combobox", {
        name: "ICH E9(R1) strategy",
      }),
      { target: { value: "Composite variable" } }
    );
    fireEvent.change(
      within(renamedEstCard()).getByRole("textbox", {
        name: "Event description",
      }),
      { target: { value: "Valve explant folded into composite endpoint." } }
    );
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", { name: "Save event" })
    );

    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Move event Surgical valve explant up",
      })
    );
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Move event Surgical valve explant down",
      })
    );
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Remove event Surgical valve explant",
      })
    );

    // Reorder estimands and remove supplementary estimand
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Move estimand Secondary Valve Safety Estimand up",
      })
    );
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Move estimand Secondary Valve Safety Estimand down",
      })
    );
    fireEvent.click(
      within(renamedEstCard()).getByRole("button", {
        name: "Remove estimand Secondary Valve Safety Estimand",
      })
    );
    expect(screen.getByText("1 estimand")).toBeTruthy();

    // Edit and remove an unreferenced analysis population
    const popArticles = screen
      .getAllByRole("article")
      .filter((el) =>
        el.getAttribute("aria-label")?.startsWith("Analysis population ")
      );
    const popName =
      popArticles[2]
        .getAttribute("aria-label")
        ?.replace(/^Analysis population /, "") ?? "";
    fireEvent.click(
      within(popArticles[2]).getByRole("button", {
        name: `Edit population ${popName}`,
      })
    );
    fireEvent.click(
      within(popArticles[2]).getByRole("button", { name: "Cancel" })
    );
    fireEvent.click(
      within(popArticles[2]).getByRole("button", {
        name: `Edit population ${popName}`,
      })
    );
    fireEvent.change(
      within(popArticles[2]).getByRole("textbox", { name: "Population name" }),
      { target: { value: "Per-Protocol Cohort" } }
    );
    fireEvent.change(
      within(popArticles[2]).getByRole("textbox", { name: "Short label" }),
      { target: { value: "PP" } }
    );
    fireEvent.change(
      within(popArticles[2]).getByRole("textbox", {
        name: "Population definition",
      }),
      {
        target: {
          value: "Participants completing per-protocol valve implant.",
        },
      }
    );
    fireEvent.click(
      within(popArticles[2]).getByRole("button", { name: "Save population" })
    );

    const editedPop = screen.getByRole("article", {
      name: "Analysis population Per-Protocol Cohort",
    });
    fireEvent.click(
      within(editedPop).getByRole("button", {
        name: "Remove population Per-Protocol Cohort",
      })
    );
    expect(screen.getByText("2 analysis populations")).toBeTruthy();
  });

  it("renders empty states on a blank study and missing-link warnings on broken estimands", () => {
    const { unmount } = render(
      <PanelHarness initial={blankWorkspace} panel="analysis" />
    );
    expect(screen.getByText(/no estimands yet/i)).toBeTruthy();
    expect(
      screen.getByText(/defines no analysis populations yet/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/Define at least one endpoint in Narrative/i)
    ).toBeTruthy();
    unmount();

    const broken = structuredClone(rctWorkspace);
    const design = broken.usdm.study.versions![0].studyDesigns![0];
    design.estimands![0].variableOfInterestId = "missing_ep";
    design.estimands![0].analysisPopulationId = "missing_pop";
    design.estimands![0].interventionIds = ["unknown_int"];
    design.estimands![0].populationSummary = "";
    design.estimands![0].intercurrentEvents[0].strategy = "";
    design.estimands![0].intercurrentEvents[0].text = "";
    design.estimands![0].intercurrentEvents[1].strategy = "Custom strategy";

    render(<PanelHarness initial={broken} panel="analysis" />);
    expect(screen.getByText(/Missing endpoint link/i)).toBeTruthy();
    expect(screen.getByText(/Missing population link/i)).toBeTruthy();
    expect(screen.getByText(/Unknown \(unknown_int\)/i)).toBeTruthy();
    expect(
      screen.getByText(/Missing population-level summary measure/i)
    ).toBeTruthy();
    expect(screen.getByText("Missing strategy")).toBeTruthy();
    expect(
      screen.getByText(/No intercurrent event description recorded/i)
    ).toBeTruthy();
    // Open editor on custom strategy event to exercise non-standard strategy option list
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit event / })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
  });
});
