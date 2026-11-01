import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import {
  STUDY_DATA_HANDOFF_KEY,
  STUDY_DATA_HANDOFF_PATH,
  storeStudyHandoff,
} from "@/components/study-data/handoff-storage";
import {
  toDefinitionCounts,
  toScheduleDesign,
} from "@/components/study-data/schedule-design";
import { StudyDataWorkbench } from "@/components/study-data/StudyDataWorkbench";
import { CNS_NEURO_PRESET, exportStudyToUsdmObject } from "@/lib/crf";
import { DEMO_301_STUDY, SUBJECT_COUNT_LIMITS } from "@/lib/study-data";

const RUN_TIMEOUT = { timeout: 30_000 };

class MockStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

let storage: MockStorage;

beforeEach(() => {
  storage = new MockStorage();
  vi.spyOn(window, "sessionStorage", "get").mockReturnValue(storage);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

function renderWorkbench() {
  return render(
    <StudyDataWorkbench
      design={toScheduleDesign(DEMO_301_STUDY)}
      definitionCounts={toDefinitionCounts(DEMO_301_STUDY)}
      limits={SUBJECT_COUNT_LIMITS}
      defaults={{ seed: 301, nSubjects: 30 }}
    />
  );
}

function openWithHandoff() {
  window.history.replaceState(null, "", STUDY_DATA_HANDOFF_PATH);
}

describe("/study-data with a study handed over from CRF Studio", () => {
  it("shows what it will tabulate and waits for the visitor before running", async () => {
    expect(storeStudyHandoff(exportStudyToUsdmObject(CNS_NEURO_PRESET))).toBe(
      null
    );
    openWithHandoff();
    renderWorkbench();

    const panel = await screen.findByRole(
      "region",
      { name: /Study from CRF Studio: NEURO-2026-401/ },
      RUN_TIMEOUT
    );
    expect(storage.getItem(STUDY_DATA_HANDOFF_KEY)).toBeNull();
    expect(panel.textContent).toMatch(/Tabulated\s*DM, EX, VS, AE/);
    expect(panel.textContent).toMatch(/Not tabulated\s*CM, QS/);
    expect(panel.textContent).toMatch(
      // QS is generated (#3418), but not the MMSE: its concepts carry no
      // test the generator models.
      /Mini-Mental State Examination \(MMSE\) \(QS\) is not tabulated: none of its tests is one the generator models/
    );
    // The preset names its arms, so nothing is assumed about them.
    expect(panel.textContent).not.toMatch(/one arm, Study treatment/);
    // The way back to change the study, which CRF Studio keeps as a draft.
    expect(
      within(panel)
        .getByRole("link", { name: "Change this study in CRF Studio" })
        .getAttribute("href")
    ).toBe("/crf");
    expect(
      screen.getByText(/Study NEURO-2026-401 is ready\. Run the pipeline/)
    ).toBeTruthy();
    expect(screen.queryByText(/^Run 1:/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Study definition" }));
    expect(screen.getAllByText(/NEURO-2026-401/).length).toBeGreaterThanOrEqual(
      2
    );

    fireEvent.click(screen.getByRole("button", { name: "Run pipeline" }));
    await waitFor(
      () =>
        expect(screen.getByText(/^Run 1: 30 subjects, seed 301/)).toBeTruthy(),
      RUN_TIMEOUT
    );
    fireEvent.click(screen.getByRole("tab", { name: "Datasets" }));
    expect(
      screen.getAllByRole("region", { name: /Study from CRF Studio/ })
    ).toHaveLength(1);
  });

  it("switches back to DEMO-301 when the visitor asks", async () => {
    storeStudyHandoff(exportStudyToUsdmObject(CNS_NEURO_PRESET));
    openWithHandoff();
    renderWorkbench();
    const panel = await screen.findByRole(
      "region",
      { name: /Study from CRF Studio/ },
      RUN_TIMEOUT
    );
    fireEvent.click(
      within(panel).getByRole("button", {
        name: "Use the DEMO-301 study instead",
      })
    );
    expect(
      screen.queryByRole("region", { name: /Study from CRF Studio/ })
    ).toBeNull();
    expect(screen.getByText(/Showing DEMO-301\./)).toBeTruthy();
    await waitFor(
      () =>
        expect(screen.getByText(/^Run 1: 30 subjects, seed 301/)).toBeTruthy(),
      RUN_TIMEOUT
    );
  });

  it("runs DEMO-301 with a notice when no study was handed over", async () => {
    openWithHandoff();
    renderWorkbench();
    expect(
      await screen.findByText(
        /No study was handed over from CRF Studio.*press Run Pipeline/
      )
    ).toBeTruthy();
    await waitFor(
      () =>
        expect(screen.getByText(/^Run 1: 30 subjects, seed 301/)).toBeTruthy(),
      RUN_TIMEOUT
    );
  });

  it("runs DEMO-301 with a notice when the handed-over study fails the USDM schema", async () => {
    storeStudyHandoff({ usdmVersion: "4.0.0" });
    openWithHandoff();
    renderWorkbench();
    expect(
      await screen.findByText(
        /fails the USDM v4\.0\.0 schema .*so the page runs DEMO-301/,
        undefined,
        RUN_TIMEOUT
      )
    ).toBeTruthy();
    await waitFor(
      () =>
        expect(screen.getByText(/^Run 1: 30 subjects, seed 301/)).toBeTruthy(),
      RUN_TIMEOUT
    );
  });

  it("ignores stored studies when the page is opened without the CRF source", async () => {
    storeStudyHandoff(exportStudyToUsdmObject(CNS_NEURO_PRESET));
    renderWorkbench();
    await waitFor(
      () =>
        expect(screen.getByText(/^Run 1: 30 subjects, seed 301/)).toBeTruthy(),
      RUN_TIMEOUT
    );
    expect(
      screen.queryByRole("region", { name: /Study from CRF Studio/ })
    ).toBeNull();
    expect(storage.getItem(STUDY_DATA_HANDOFF_KEY)).not.toBeNull();
  });
});

describe("CRF Studio USDM export handoff", () => {
  // jsdom cannot navigate; stop the link's default action after the
  // component's own click handler has run.
  const stopNavigation = (event: Event) => event.preventDefault();
  beforeEach(() => document.addEventListener("click", stopNavigation));
  afterEach(() => document.removeEventListener("click", stopNavigation));

  it("stores the export and links to /study-data in the same tab", async () => {
    render(
      <ExportImportModal
        study={CNS_NEURO_PRESET}
        onImportStudy={() => undefined}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /USDM/ }));
    });
    const link = await screen.findByRole("link", {
      name: "Run the pipeline on this study",
    });
    expect(link.getAttribute("href")).toBe(STUDY_DATA_HANDOFF_PATH);
    expect(link.getAttribute("target")).toBeNull();
    await waitFor(() => expect(link.getAttribute("aria-disabled")).toBeNull());
    fireEvent.click(link);
    const stored = JSON.parse(storage.getItem(STUDY_DATA_HANDOFF_KEY)!);
    expect(stored.source).toBe("crf-studio");
    expect(stored.usdm).toEqual(
      JSON.parse(JSON.stringify(exportStudyToUsdmObject(CNS_NEURO_PRESET)))
    );
  });

  it("explains when the tab cannot hold the study", async () => {
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    render(
      <ExportImportModal
        study={CNS_NEURO_PRESET}
        onImportStudy={() => undefined}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: /USDM/ }));
    });
    const link = await screen.findByRole("link", {
      name: "Run the pipeline on this study",
    });
    await waitFor(() => expect(link.getAttribute("aria-disabled")).toBeNull());
    fireEvent.click(link);
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /too large to hand over/
    );
  });
});
