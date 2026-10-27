import React from "react";
import type { FormCatalogEntry } from "@/lib/crf/form-catalog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  ALL_SLASH_COMMANDS,
  type CRFField,
  type CRFForm,
  type StudyBaseline,
  type StudyProtocol,
  getOncologyPresetSync,
} from "@/lib/crf";
import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";
import { resetStubs, stubArgs, stubProps } from "./studio-stubs";

/**
 * How CRF Studio's container wires its panels together (#2530). The study
 * edits themselves are covered by the hook tests; here every panel is a stub
 * whose callbacks are pressed as buttons, so each case checks only what the
 * container does with them.
 */

vi.mock("next/dynamic", async () => {
  const { stubComponent } = await import("./studio-stubs");
  const names = [
    "AcrfOverlayViewer",
    "ExportImportModal",
    "ExportDocumentModal",
    "ReviewPackageModal",
    "BrandingConfigModal",
    "DiagnosticsDrawer",
    "SpotlightTourOverlay",
    "VisitMatrixEditor",
    "RuleGraphStudio",
    "LiveEdcSimulator",
    "WorkflowWizardModal",
  ];
  return {
    default: (loader: () => unknown) => {
      const source = loader.toString();
      return stubComponent(
        names.find((name) => source.includes(name)) ?? "Unknown"
      );
    },
  };
});

vi.mock("@/components/crf/StudioHeader", async () => ({
  StudioHeader: (await import("./studio-stubs")).stubComponent("StudioHeader"),
}));
vi.mock("@/components/crf/LeftSidebar/StudySpine", async () => ({
  StudySpine: (await import("./studio-stubs")).stubComponent("StudySpine"),
}));
vi.mock("@/components/crf/LeftSidebar/WidgetPalette", async () => ({
  WidgetPalette: (await import("./studio-stubs")).stubComponent(
    "WidgetPalette"
  ),
}));
vi.mock("@/components/crf/FormCatalogModal", async () => ({
  FormCatalogModal: (await import("./studio-stubs")).stubComponent(
    "FormCatalogModal"
  ),
}));
vi.mock("@/components/crf/CenterCanvas/FormCanvas", async () => ({
  FormCanvas: (await import("./studio-stubs")).stubComponent("FormCanvas"),
}));
vi.mock("@/components/crf/RightInspector/InspectorPanel", async () => ({
  InspectorPanel: (await import("./studio-stubs")).stubComponent(
    "InspectorPanel"
  ),
}));
vi.mock("@/components/crf/Modes/ActiveFormGrid", async () => ({
  ActiveFormGrid: (await import("./studio-stubs")).stubComponent(
    "ActiveFormGrid"
  ),
}));
vi.mock("@/components/crf/Terminal/StudioTerminal", async () => ({
  StudioTerminal: (await import("./studio-stubs")).stubComponent(
    "StudioTerminal"
  ),
}));
vi.mock("@/components/crf/Modes/FormTestDock", async () => ({
  FormTestDock: (await import("./studio-stubs")).stubComponent("FormTestDock"),
}));
vi.mock("@/components/crf/Modes/ScenarioImpactPanel", async () => ({
  ScenarioImpactPanel: (await import("./studio-stubs")).stubComponent(
    "ScenarioImpactPanel"
  ),
}));
vi.mock("@/components/crf/SlashPaletteModal", async () => ({
  SlashPaletteModal: (await import("./studio-stubs")).stubComponent(
    "SlashPaletteModal"
  ),
}));
vi.mock("@/components/crf/StudyOmnibar", async () => ({
  StudyOmnibar: (await import("./studio-stubs")).stubComponent("StudyOmnibar"),
}));
vi.mock("@/components/crf/BaselineManagerModal", async () => ({
  BaselineManagerModal: (await import("./studio-stubs")).stubComponent(
    "BaselineManagerModal"
  ),
}));
vi.mock("@/components/crf/BaselineCompareModal", async () => ({
  BaselineCompareModal: (await import("./studio-stubs")).stubComponent(
    "BaselineCompareModal"
  ),
}));
vi.mock("@/components/crf/LibraryUpgradeModal", async () => ({
  LibraryUpgradeModal: (await import("./studio-stubs")).stubComponent(
    "LibraryUpgradeModal"
  ),
}));

const props = (name: string) => stubProps[name] ?? {};
const study = () => props("StudioHeader").study as StudyProtocol;
const canvasForm = () => props("FormCanvas").form as CRFForm;
const hashParams = () => new URLSearchParams(window.location.hash.slice(1));

/** Presses a stub's callback button, optionally queuing its arguments. */
function press(label: string, args?: unknown[], index = 0) {
  if (args) stubArgs[label] = args;
  fireEvent.click(screen.getAllByRole("button", { name: label })[index]);
}

function newField(variableName: string) {
  return fromPartial<CRFField>({
    id: `f_new_${variableName}`,
    variableName,
    label: variableName,
    dataType: "text",
    columnSpan: 6,
    required: false,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/crf");
  resetStubs();
  render(<CRFStudioContainer />);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CRF Studio header", () => {
  it("opens and closes each panel it offers", () => {
    const panels: [string, string, string][] = [
      ["onOpenDiagnostics", "DiagnosticsDrawer", "isOpen"],
      ["onOpenFormCatalog", "FormCatalogModal", "isOpen"],
      ["onOpenWizard", "WorkflowWizardModal", "isOpen"],
      ["onOpenBaselines", "BaselineManagerModal", "isOpen"],
      ["onOpenCompareBaseline", "BaselineCompareModal", "isOpen"],
      ["onOpenLibraryUpgrades", "LibraryUpgradeModal", "isOpen"],
    ];
    for (const [opener, panel, flag] of panels) {
      expect(props(panel)[flag]).toBe(false);
      press(`StudioHeader.${opener}`);
      expect(props(panel)[flag]).toBe(true);
      press(`${panel}.onClose`);
      expect(props(panel)[flag]).toBe(false);
    }
  });

  it("mounts the branding and export-document modals only while open", () => {
    expect(screen.queryByTestId("stub-BrandingConfigModal")).toBeNull();
    press("StudioHeader.onOpenBranding");
    expect(screen.getByTestId("stub-BrandingConfigModal")).toBeTruthy();
    press("BrandingConfigModal.onSave", [{ primaryColor: "#123456" }]);
    expect(study().branding).toEqual({ primaryColor: "#123456" });
    press("BrandingConfigModal.onClose");
    expect(screen.queryByTestId("stub-BrandingConfigModal")).toBeNull();

    press("StudioHeader.onOpenExportDocument");
    press("ExportDocumentModal.onOpenBranding");
    expect(screen.queryByTestId("stub-ExportDocumentModal")).toBeNull();
    expect(screen.getByTestId("stub-BrandingConfigModal")).toBeTruthy();
    press("StudioHeader.onOpenExportDocument");
    press("ExportDocumentModal.onClose");
    expect(screen.queryByTestId("stub-ExportDocumentModal")).toBeNull();
  });

  it("toggles the sidebars, terminal and test dock", () => {
    expect(
      screen.getByRole("complementary", { name: "Study navigator" })
    ).toBeTruthy();
    press("StudioHeader.onToggleLeftSidebar");
    expect(
      screen.queryByRole("complementary", { name: "Study navigator" })
    ).toBeNull();
    press("StudioHeader.onToggleRightInspector");
    expect(
      screen.queryByRole("complementary", { name: "Field inspector" })
    ).toBeNull();

    press("StudioHeader.onToggleTerminal");
    expect(props("StudioTerminal").isOpen).toBe(true);
    press("StudioTerminal.onClose");
    expect(props("StudioTerminal").isOpen).toBe(false);

    expect(screen.queryByTestId("stub-ScenarioImpactPanel")).toBeNull();
    press("StudioHeader.onToggleTestDock");
    expect(props("FormTestDock").isOpen).toBe(true);
    expect(screen.getByTestId("stub-ScenarioImpactPanel")).toBeTruthy();
    press("FormTestDock.onChangeValues", [{ AGE: 40 }]);
    expect(props("FormTestDock").values).toEqual({ AGE: 40 });
    press("FormTestDock.onClose");
    expect(props("FormTestDock").isOpen).toBe(false);
  });

  it("undoes and redoes an edit", () => {
    expect(props("StudioHeader").canUndo).toBe(false);
    press("StudySpine.onAddForm");
    expect(props("StudioHeader").canUndo).toBe(true);
    press("StudioHeader.onUndo");
    expect(props("StudioHeader").canRedo).toBe(true);
    press("StudioHeader.onRedo");
    expect(props("StudioHeader").canRedo).toBe(false);
  });

  it("switches the theme on the studio container only", () => {
    const root = document.querySelector("[data-studio-theme]")!;
    expect(root.getAttribute("data-studio-theme")).toBe("dark");
    press("StudioHeader.onToggleTheme");
    expect(root.getAttribute("data-studio-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-studio-theme")).toBe(
      null
    );
  });

  it("starts the tour from the designer with both panes showing", () => {
    press("StudioHeader.onChangeMode", ["matrix"]);
    press("StudioHeader.onToggleLeftSidebar");
    press("StudioHeader.onStartSpotlightTour");
    expect(props("SpotlightTourOverlay").isOpen).toBe(true);
    expect(props("StudioHeader").activeMode).toBe("designer");
    expect(props("StudioHeader").isLeftSidebarOpen).toBe(true);
    press("SpotlightTourOverlay.onClose");
    expect(props("SpotlightTourOverlay").isOpen).toBe(false);
  });

  it("copies the view link", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await act(async () => press("StudioHeader.onCopyShareLink"));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("asks before a preset replaces unsaved work", () => {
    press("StudySpine.onAddForm");
    press("StudioHeader.onSelectPreset", ["custom_blank"]);
    expect(
      screen.getByRole("dialog", { name: /Unsaved Changes/ })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("dialog", { name: /Unsaved Changes/ })
    ).toBeNull();

    press("StudioHeader.onSelectPreset", ["custom_blank"]);
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel study replacement" })
    );
    expect(
      screen.queryByRole("dialog", { name: /Unsaved Changes/ })
    ).toBeNull();

    press("StudioHeader.onSelectPreset", ["custom_blank"]);
    fireEvent.click(screen.getByRole("dialog", { name: /Unsaved Changes/ }));
    expect(
      screen.queryByRole("dialog", { name: /Unsaved Changes/ })
    ).toBeNull();

    const before = study();
    press("StudioHeader.onSelectPreset", ["custom_blank"]);
    fireEvent.click(screen.getByRole("button", { name: "Discard & Replace" }));
    expect(study()).not.toBe(before);
    expect(
      screen.queryByRole("dialog", { name: /Unsaved Changes/ })
    ).toBeNull();
  });

  it("snapshots the draft when asked before replacing it", () => {
    press("StudySpine.onAddForm");
    press("StudioHeader.onSelectPreset", ["custom_blank"]);
    const before = study();
    fireEvent.click(
      screen.getByRole("button", { name: "Save Snapshot & Replace" })
    );
    expect(study()).not.toBe(before);
  });
});

describe("CRF Studio designer", () => {
  it("opens a form from the navigator", () => {
    press("StudySpine.onSelectForm", ["form_vs_onc"]);
    expect(canvasForm().id).toBe("form_vs_onc");
    expect(hashParams().get("form")).toBe("form_vs_onc");
  });

  it("selects a visit and switches the sidebar tab", () => {
    press("StudySpine.onSelectVisit", ["v_eos"]);
    expect(props("StudySpine").activeVisitId).toBe("v_eos");
    press("StudySpine.onChangeTab", ["forms"]);
    expect(props("StudySpine").activeTab).toBe("forms");
  });

  it("opens the form catalog from the navigator", () => {
    press("StudySpine.onOpenFormCatalog");
    expect(props("FormCatalogModal").isOpen).toBe(true);
  });

  // #2927 item 11: one catalog, one add path for forms and blocks.
  const catalogEntry = (id: string) =>
    (props("FormCatalogModal").entries as FormCatalogEntry[]).find(
      (entry) => entry.id === id
    );

  it("adds a catalog form to the visit it was dropped on", () => {
    const before = study().forms.length;
    press("StudySpine.onAddCatalogEntry", ["cdash:DS", "v_eos"]);
    expect(study().forms).toHaveLength(before + 1);
    const added = study().forms[before];
    expect(added.domain).toBe("DS");
    expect(
      study().visits.find((v) => v.id === "v_eos")?.assignedFormIds
    ).toContain(added.id);
  });

  it("inserts a catalog block's fields into the open form", () => {
    press("StudySpine.onSelectForm", ["form_vs_onc"]);
    const fieldCount = () =>
      canvasForm().sections.reduce(
        (sum, section) => sum + section.fields.length,
        0
      );
    const before = fieldCount();
    press("FormCatalogModal.onAdd", [catalogEntry("block:ecg")]);
    expect(fieldCount()).toBe(before + 6);
  });

  it("copies a form from an example study with fresh ids", () => {
    const before = study().forms.length;
    press("FormCatalogModal.onAdd", [catalogEntry("preset:form_phq9")]);
    expect(study().forms).toHaveLength(before + 1);
    const added = study().forms[before];
    expect(added.name).toBe("PHQ-9 Depression Inventory");
    expect(added.id).not.toBe("form_phq9");
  });

  it("adds a palette field to the section the canvas asked for", () => {
    press("StudySpine.onSelectForm", ["form_vs_onc"]);
    const section = canvasForm().sections[0].id;
    press("FormCanvas.onOpenPalette", [section], 1);
    expect(props("StudySpine").activeTab).toBe("palette");

    press("StudySpine.onAddField", [newField("NEWVAR")]);
    expect(canvasForm().sections[0].fields.at(-1)?.variableName).toBe("NEWVAR");
    expect(props("FormCanvas").selectedFieldId).toBe("f_new_NEWVAR");

    press("FormCanvas.onOpenPalette", [], 1);
    expect(props("StudySpine").activeTab).toBe("palette");
  });

  it("switches the canvas viewport and mode", () => {
    press("FormCanvas.onChangeViewport", ["mobile"], 1);
    expect(props("FormCanvas").viewport).toBe("mobile");
    press("FormCanvas.onSwitchMode", ["rules"]);
    expect(screen.getByTestId("stub-RuleGraphStudio")).toBeTruthy();
  });

  it("opens the slash palette after the selected field and inserts there", () => {
    press("StudySpine.onSelectForm", ["form_vs_onc"]);
    press("FormCanvas.onSelectField", ["f_height"], 1);
    press("FormCanvas.onOpenSlashPalette", [], 1);
    expect(props("SlashPaletteModal")).toMatchObject({
      isOpen: true,
      targetSectionTitle: canvasForm().sections[0].title,
      targetIndex: 2,
    });

    const atomic = ALL_SLASH_COMMANDS.find((c) => c.action === "insert_field");
    press("SlashPaletteModal.onSelectCommand", [atomic]);
    const fields = canvasForm().sections[0].fields;
    expect(fields[2].id).toBe(props("FormCanvas").selectedFieldId);

    press("SlashPaletteModal.onClose");
    expect(props("SlashPaletteModal").isOpen).toBe(false);
  });

  it("shows the inspector on phones when a field is picked", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    press("StudySpine.onSelectForm", ["form_vs_onc"]);
    press("FormCanvas.onSelectField", ["f_pulse"], 1);
    expect(screen.getAllByTestId("stub-InspectorPanel")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /PULSE/ })).toBeTruthy();
  });

  it("closes the inspector and clears the selection", () => {
    press("FormCanvas.onSelectField", ["f_x"], 1);
    press("InspectorPanel.onClose");
    expect(props("FormCanvas").selectedFieldId).toBeNull();
  });

  it("duplicates and renames the inspected field", () => {
    press("StudySpine.onSelectForm", ["form_vs_onc"]);
    press("FormCanvas.onSelectField", ["f_pulse"], 1);
    press("InspectorPanel.onRenameEverywhere", ["HR"]);
    expect(
      canvasForm().sections[0].fields.find((f) => f.id === "f_pulse")
        ?.variableName
    ).toBe("HR");

    press("InspectorPanel.onDuplicateField", ["f_pulse"]);
    expect(props("FormCanvas").selectedFieldId).not.toBe("f_pulse");
    press("InspectorPanel.onDuplicateForm", ["form_vs_onc"]);
    expect(canvasForm().id).not.toBe("form_vs_onc");
  });

  it("offers no rename without a selected field", () => {
    expect(props("InspectorPanel").onRenameEverywhere).toBeUndefined();
  });

  it("confirms deleting a referenced field before pruning its rules", () => {
    press("StudySpine.onSelectForm", ["form_vs_onc"]);
    const section = canvasForm().sections[0].id;
    const dialog = () =>
      screen.queryByRole("dialog", { name: /Blast Radius Preview/ });

    press("FormCanvas.onDeleteField", [section, "f_height"], 1);
    expect(dialog()?.textContent).toContain("HEIGHT");
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel (Keep Field)" })
    );
    expect(dialog()).toBeNull();

    press("FormCanvas.onDeleteField", [section, "f_height"], 1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(dialog()).toBeNull();

    press("FormCanvas.onDeleteField", [section, "f_height"], 1);
    fireEvent.click(dialog()!);
    expect(dialog()).toBeNull();

    press("FormCanvas.onDeleteField", [section, "f_height"], 1);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete & Cascade Prune" })
    );
    expect(dialog()).toBeNull();
    expect(
      canvasForm().sections[0].fields.some((f) => f.id === "f_height")
    ).toBe(false);
  });

  it("names the section in a section deletion warning", () => {
    press("StudySpine.onSelectForm", ["form_recist_onc"]);
    const section = canvasForm().sections[1];
    press("FormCanvas.onDeleteSection", [section.id], 1);
    expect(
      screen.getByRole("dialog", { name: /Blast Radius Preview/ }).textContent
    ).toContain(section.title);
  });
});

describe("CRF Studio on phones", () => {
  it("moves between the forms, canvas and inspector views", () => {
    const nav = screen.getByRole("navigation", {
      name: "Mobile View Navigation",
    });
    fireEvent.click(nav.querySelectorAll("button")[0]);
    expect(screen.getAllByTestId("stub-StudySpine")).toHaveLength(2);

    press("StudySpine.onSelectForm", ["form_vs_onc"], 1);
    expect(screen.getAllByTestId("stub-FormCanvas")).toHaveLength(2);
    expect(canvasForm().id).toBe("form_vs_onc");

    fireEvent.click(nav.querySelectorAll("button")[0]);
    press("StudySpine.onAddField", [newField("PHONEVAR")], 1);
    expect(screen.getAllByTestId("stub-FormCanvas")).toHaveLength(2);

    fireEvent.click(nav.querySelectorAll("button")[2]);
    expect(screen.getAllByTestId("stub-InspectorPanel")).toHaveLength(2);
    press("InspectorPanel.onClose");
    expect(screen.getAllByTestId("stub-FormCanvas")).toHaveLength(2);

    fireEvent.click(nav.querySelectorAll("button")[1]);
    expect(screen.getAllByTestId("stub-FormCanvas")).toHaveLength(2);
  });

  it("adds a field from the slide-up palette", () => {
    press("FormCanvas.onOpenPalette", []);
    expect(
      screen.getByRole("dialog", { name: "Add Clinical Widget" })
    ).toBeTruthy();
    press("WidgetPalette.onAddField", [newField("SHEETVAR")]);
    expect(
      screen.queryByRole("dialog", { name: "Add Clinical Widget" })
    ).toBeNull();

    press("FormCanvas.onOpenPalette", []);
    fireEvent.click(
      screen.getByRole("button", { name: "Close Widget Palette" })
    );
    expect(
      screen.queryByRole("dialog", { name: "Add Clinical Widget" })
    ).toBeNull();
  });
});

describe("CRF Studio modes", () => {
  it("renders each mode's panel", () => {
    const panels: [string, string][] = [
      ["grid", "ActiveFormGrid"],
      ["matrix", "VisitMatrixEditor"],
      ["rules", "RuleGraphStudio"],
      ["edc", "LiveEdcSimulator"],
      ["acrf", "AcrfOverlayViewer"],
      ["export", "ExportImportModal"],
    ];
    for (const [mode, panel] of panels) {
      press("StudioHeader.onChangeMode", [mode]);
      expect(screen.getByTestId(`stub-${panel}`)).toBeTruthy();
      expect(screen.queryByTestId("stub-FormCanvas")).toBeNull();
    }
  });

  it("wires the form grid to the palette, renames and study edits", () => {
    press("StudioHeader.onChangeMode", ["grid"]);
    press("ActiveFormGrid.onAddField", ["sec_x"]);
    expect(hashParams().get("tab")).toBe("palette");
    press("StudioHeader.onChangeMode", ["grid"]);
    press("ActiveFormGrid.onAddField", []);
    press("StudioHeader.onChangeMode", ["grid"]);

    press("ActiveFormGrid.onRenameEverywhere", [
      study().forms[0].sections[0].fields[0].id,
      "RENAMED",
    ]);
    expect(study().forms[0].sections[0].fields[0].variableName).toBe("RENAMED");

    press("InspectorPanel.onClose");
    expect(props("ActiveFormGrid").selectedFieldId).toBeNull();
  });

  it("records simulator state and visit schedule changes", () => {
    press("StudioHeader.onChangeMode", ["edc"]);
    const state = { records: [] };
    press("LiveEdcSimulator.onUpdateSimulationState", [state]);
    expect(study().simulationState).toBe(state);

    press("StudioHeader.onChangeMode", ["matrix"]);
    press("VisitMatrixEditor.onUpdateVisits", [study().visits.slice(0, 1)]);
    expect(study().visits).toHaveLength(1);
  });

  it("opens export panels from the aCRF and export modes", () => {
    press("StudioHeader.onChangeMode", ["acrf"]);
    press("AcrfOverlayViewer.onOpenExportModal");
    expect(screen.getByTestId("stub-ExportDocumentModal")).toBeTruthy();
    press("AcrfOverlayViewer.onOpenBranding");
    expect(screen.getByTestId("stub-BrandingConfigModal")).toBeTruthy();

    press("StudioHeader.onChangeMode", ["export"]);
    press("ExportImportModal.onOpenReviewPackage");
    expect(screen.getByTestId("stub-ReviewPackageModal")).toBeTruthy();
    expect(
      (props("ReviewPackageModal").isScenarioStale as (s: unknown) => unknown)(
        fromPartial({
          id: "t",
          formId: "form_dm_onc",
          scope: { subjectId: "S1", visitId: "v_screen" },
          inputs: {},
          expectations: [],
        })
      )
    ).toBeUndefined();
    press("ReviewPackageModal.onClose");
    expect(screen.queryByTestId("stub-ReviewPackageModal")).toBeNull();
    press("ExportImportModal.onOpenExportDocument");
    press("ExportImportModal.onOpenBranding");
  });

  it("loads an imported study straight away while the draft is clean", () => {
    press("StudioHeader.onChangeMode", ["export"]);
    const imported = getOncologyPresetSync();
    press("ExportImportModal.onImportStudy", [imported]);
    expect(study()).toBe(imported);
  });
});

describe("CRF Studio side panels", () => {
  it("jumps from diagnostics to a form in the designer", () => {
    press("StudioHeader.onChangeMode", ["rules"]);
    press("DiagnosticsDrawer.onSelectForm", ["form_lb_onc"]);
    expect(canvasForm().id).toBe("form_lb_onc");
    press("DiagnosticsDrawer.onUpdateStudy", [
      { ...study(), studyName: "Fixed" },
    ]);
    expect(study().studyName).toBe("Fixed");
  });

  it("opens modals from the terminal and applies its edits", () => {
    for (const [modal, panel] of [
      ["wizard", "WorkflowWizardModal"],
      ["diagnostics", "DiagnosticsDrawer"],
    ]) {
      press("StudioTerminal.onOpenModal", [modal]);
      expect(props(panel).isOpen).toBe(true);
    }
    press("StudioTerminal.onOpenModal", ["branding"]);
    expect(screen.getByTestId("stub-BrandingConfigModal")).toBeTruthy();
    press("StudioTerminal.onOpenModal", ["export"]);
    expect(screen.getByTestId("stub-ExportDocumentModal")).toBeTruthy();
    press("StudioTerminal.onOpenModal", ["unknown"]);

    press("WorkflowWizardModal.onClose");
    press("StudioTerminal.onOpenWizard");
    expect(props("WorkflowWizardModal").isOpen).toBe(true);
    press("StudioTerminal.onSwitchMode", ["matrix"]);
    expect(screen.getByTestId("stub-VisitMatrixEditor")).toBeTruthy();

    const without = {
      ...study(),
      forms: study().forms.filter((f) => f.id !== "form_dm_onc"),
    };
    press("StudioTerminal.onUpdateStudy", [without]);
    expect(props("StudioTerminal").study).toBe(without);
  });

  it("applies a wizard protocol and loads a preset from it", () => {
    const protocol = getOncologyPresetSync();
    press("WorkflowWizardModal.onApplyStudy", [protocol]);
    expect(study()).toBe(protocol);
    press("WorkflowWizardModal.onSwitchMode", ["edc"]);
    expect(screen.getByTestId("stub-LiveEdcSimulator")).toBeTruthy();
    press("WorkflowWizardModal.onLoadPreset", ["unknown"]);
    press("WorkflowWizardModal.onStartSpotlightTour");
    expect(props("SpotlightTourOverlay").isOpen).toBe(true);
  });

  it("restores a baseline and navigates from a comparison", () => {
    press("StudySpine.onAddForm");
    const restored = getOncologyPresetSync();
    press("BaselineManagerModal.onRestoreBaselineAsDraft", [
      restored,
      fromPartial<StudyBaseline>({ versionTag: "v2" }),
    ]);
    expect(study()).toBe(restored);
    expect(props("StudioHeader").canUndo).toBe(false);

    press("StudioHeader.onOpenCompareBaseline");
    press("BaselineCompareModal.onSelectBaseline", ["b1"]);
    expect(hashParams().get("compare")).toBe("b1");
    press("BaselineCompareModal.onNavigate", [
      {
        mode: "designer",
        formId: "form_vs_onc",
        visitId: "v_eos",
        fieldId: "f_pulse",
      },
    ]);
    expect(canvasForm().id).toBe("form_vs_onc");
    expect(props("FormCanvas").selectedFieldId).toBe("f_pulse");
    press("BaselineCompareModal.onNavigate", [{ mode: "matrix" }]);
    expect(screen.getByTestId("stub-VisitMatrixEditor")).toBeTruthy();

    press("BaselineCompareModal.onClose");
    expect(props("BaselineCompareModal").isOpen).toBe(false);
    expect(hashParams().get("compare")).toBeNull();
  });

  it("applies and undoes a library upgrade", () => {
    const upgraded = { ...study(), studyName: "Upgraded" };
    press("LibraryUpgradeModal.onApplyUpgrade", [upgraded]);
    expect(study()).toBe(upgraded);
    press("LibraryUpgradeModal.onUndoUpgrade");
    expect(study().studyName).not.toBe("Upgraded");
  });

  it("navigates from the saved-test impact panel", () => {
    press("StudioHeader.onToggleTestDock");
    press("ScenarioImpactPanel.onNavigate", [
      { mode: "designer", formId: "form_lb_onc" },
    ]);
    expect(canvasForm().id).toBe("form_lb_onc");
  });
});

describe("CRF Studio omnibar", () => {
  const run = (action: unknown) => press("StudyOmnibar.onRunAction", [action]);

  it("opens without a stale slash target", () => {
    press("FormCanvas.onOpenSlashPalette", [], 1);
    press("StudyOmnibar.onOpen");
    expect(props("StudyOmnibar").isOpen).toBe(true);
    expect(props("SlashPaletteModal").isOpen).toBe(false);
    press("StudyOmnibar.onClose");
    expect(props("StudyOmnibar").isOpen).toBe(false);
  });

  it("opens forms, fields and visits in the designer", () => {
    press("StudioHeader.onChangeMode", ["rules"]);
    run({ kind: "open_form", formId: "form_vs_onc" });
    expect(canvasForm().id).toBe("form_vs_onc");

    run({ kind: "open_field", formId: "form_lb_onc", fieldId: "f_lb_alt" });
    expect(canvasForm().id).toBe("form_lb_onc");
    expect(props("FormCanvas").selectedFieldId).toBe("f_lb_alt");
    run({ kind: "open_field", formId: "form_lb_onc", fieldId: "f_lb_ast" });
    expect(props("FormCanvas").selectedFieldId).toBe("f_lb_ast");

    press("StudioHeader.onToggleLeftSidebar");
    run({ kind: "open_visit", visitId: "v_c3d1" });
    expect(props("StudySpine")).toMatchObject({
      activeVisitId: "v_c3d1",
      activeTab: "spine",
    });
  });

  it("inserts, switches modes and opens export panels", () => {
    const atomic = ALL_SLASH_COMMANDS.find((c) => c.action === "insert_field");
    run({ kind: "insert", command: atomic });
    expect(props("FormCanvas").selectedFieldId).not.toBeNull();

    run({ kind: "switch_mode", mode: "acrf" });
    expect(screen.getByTestId("stub-AcrfOverlayViewer")).toBeTruthy();
    run({ kind: "open_export_document" });
    expect(screen.getByTestId("stub-ExportDocumentModal")).toBeTruthy();
    run({ kind: "open_review_package" });
    expect(screen.getByTestId("stub-ReviewPackageModal")).toBeTruthy();
  });
});

describe("CRF Studio shortcuts", () => {
  const key = (init: KeyboardEventInit) =>
    fireEvent.keyDown(document.body, init);

  it("runs the studio shortcuts from outside the studio", () => {
    key({ key: "/" });
    expect(props("SlashPaletteModal").isOpen).toBe(true);
    key({ key: "Escape" });
    expect(props("SlashPaletteModal").isOpen).toBe(false);

    press("StudySpine.onAddForm");
    key({ key: "z", ctrlKey: true });
    expect(props("StudioHeader").canRedo).toBe(true);
    key({ key: "z", ctrlKey: true, shiftKey: true });
    expect(props("StudioHeader").canRedo).toBe(false);

    key({ key: "b", ctrlKey: true });
    expect(props("StudioHeader").isLeftSidebarOpen).toBe(false);
    key({ key: "i", ctrlKey: true });
    expect(props("StudioHeader").isRightInspectorOpen).toBe(false);
    key({ key: "j", ctrlKey: true });
    expect(props("StudioTerminal").isOpen).toBe(true);
    key({ key: "\\", ctrlKey: true });
    expect(props("FormTestDock").isOpen).toBe(true);
    key({ key: "F1" });
    expect(props("WorkflowWizardModal").isOpen).toBe(true);
    key({ key: "4" });
    expect(screen.getByTestId("stub-VisitMatrixEditor")).toBeTruthy();
  });

  it("clears the selection on Escape", () => {
    press("FormCanvas.onSelectField", ["f_x"], 1);
    key({ key: "Escape" });
    expect(props("FormCanvas").selectedFieldId).toBeNull();
  });
});
