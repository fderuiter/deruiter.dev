// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { ScenarioImpactPanel } from "@/components/crf/Modes/ScenarioImpactPanel";
import {
  assessScenarioFreshness,
  buildScopedKey,
  DEFAULT_TEST_SCOPE,
  type StudyProtocol,
} from "@/lib/crf";
import {
  amend,
  buildStudy,
  fieldOf,
  ranStudy,
} from "./scenario-impact-fixtures";

/**
 * #679 — the saved-test impact panel an author actually touches: stale
 * results with reasons, navigation to the amended object or the affected
 * scenario, and rerunning a selection of affected tests.
 */

afterEach(() => {
  cleanup();
});

function renderPanel(study: StudyProtocol, overrides = {}) {
  const onUpdateStudy = vi.fn();
  const onNavigate = vi.fn();
  const utils = render(
    <ScenarioImpactPanel
      study={study}
      form={study.forms[0] ?? null}
      values={{}}
      scope={DEFAULT_TEST_SCOPE}
      activeVisitId="v_screen"
      onUpdateStudy={onUpdateStudy}
      onNavigate={onNavigate}
      {...overrides}
    />
  );
  return { ...utils, onUpdateStudy, onNavigate };
}

function row(scenarioName: string): HTMLElement {
  const label = screen.getByText(scenarioName, { selector: "label" });
  const item = label.closest("li");
  if (!item) throw new Error("scenario row missing");
  return item;
}

describe("[#679] Saved test impact panel", () => {
  it("shows current results as current", () => {
    renderPanel(ranStudy());
    expect(screen.getByTestId("scenario-impact-counts").textContent).toContain(
      "2 current"
    );
    expect(
      within(row("BMI derives from height and weight")).getByText(
        "Current · passing"
      )
    ).toBeTruthy();
  });

  it("formula change: marks the result stale with a reason and no pass badge", () => {
    const study = amend(ranStudy(), (draft) => {
      fieldOf(draft, "bmi").calculationFormula = "WEIGHT";
    });
    renderPanel(study);

    const bmiRow = row("BMI derives from height and weight");
    expect(bmiRow.getAttribute("data-freshness")).toBe("stale");
    expect(within(bmiRow).getByText("Stale")).toBeTruthy();
    expect(within(bmiRow).queryByText(/passing/)).toBeNull();
    expect(
      within(bmiRow).getByText("The calculation formula of field BMI changed.")
    ).toBeTruthy();
    expect(
      within(bmiRow).getByText(/is not current verification/)
    ).toBeTruthy();

    // The unrelated scenario stays current.
    expect(
      within(row("Male subject hides pregnancy test")).getByText(
        "Current · passing"
      )
    ).toBeTruthy();
  });

  it("navigates from a stale reason to the changed field", () => {
    const study = amend(ranStudy(), (draft) => {
      fieldOf(draft, "bmi").calculationFormula = "WEIGHT";
    });
    const { onNavigate } = renderPanel(study);
    fireEvent.click(
      within(row("BMI derives from height and weight")).getByRole("button", {
        name: "Go to field BMI",
      })
    );
    expect(onNavigate).toHaveBeenCalledWith({
      mode: "designer",
      formId: "form_vs",
      fieldId: "bmi",
    });
  });

  it("rule change: the amended-object list navigates to the rules workspace", () => {
    const study = amend(ranStudy(), (draft) => {
      draft.forms[0].rules[0].conditions[0].value = "MALE";
    });
    const { onNavigate } = renderPanel(study);
    const objects = screen.getByRole("list", { name: "Amended objects" });
    fireEvent.click(
      within(objects).getByRole("button", {
        name: "Go to rule Hide pregnancy test for male subjects",
      })
    );
    expect(onNavigate).toHaveBeenCalledWith({
      mode: "rules",
      formId: "form_vs",
    });
  });

  it("codelist change: navigates to a field that uses the codelist", () => {
    const study = amend(ranStudy(), (draft) => {
      draft.codelists[0].options[1].code = "W";
    });
    const { onNavigate } = renderPanel(study);
    const objects = screen.getByRole("list", { name: "Amended objects" });
    expect(within(objects).getByText(/codes changed/)).toBeTruthy();
    fireEvent.click(
      within(objects).getByRole("button", { name: "Go to codelist Sex" })
    );
    expect(onNavigate).toHaveBeenCalledWith({
      mode: "designer",
      formId: "form_vs",
      fieldId: "sex",
    });
  });

  it("visit change: navigates to the schedule and to each affected scenario", () => {
    const study = amend(ranStudy(), (draft) => {
      draft.visits[0].windowAfter = 10;
    });
    const { onNavigate } = renderPanel(study);
    const objects = screen.getByRole("list", { name: "Amended objects" });
    fireEvent.click(
      within(objects).getByRole("button", { name: "Go to visit Screening" })
    );
    expect(onNavigate).toHaveBeenCalledWith({
      mode: "matrix",
      visitId: "v_screen",
    });

    // The impact list also navigates to the affected scenario itself.
    fireEvent.click(
      within(objects).getByRole("button", {
        name: "Male subject hides pregnancy test",
      })
    );
    expect(document.activeElement).toBe(
      row("Male subject hides pregnancy test")
    );
  });

  it("nonsemantic edit: relabelling leaves every result current", () => {
    const study = amend(ranStudy(), (draft) => {
      fieldOf(draft, "bmi").label = "Body mass index";
      draft.forms[0].rules[0].name = "Pregnancy test hidden for males";
      draft.codelists[0].options[0].label = "Man";
      draft.visits[0].name = "Screening visit";
    });
    renderPanel(study);
    expect(screen.queryByRole("list", { name: "Amended objects" })).toBeNull();
    expect(screen.getByTestId("scenario-impact-counts").textContent).toContain(
      "0 stale"
    );
  });

  it("selects affected tests and reruns only those", () => {
    const study = amend(ranStudy(), (draft) => {
      fieldOf(draft, "bmi").calculationFormula =
        "round(WEIGHT / ((HEIGHT / 100) * (HEIGHT / 100)))";
    });
    const { onUpdateStudy } = renderPanel(study);

    const rerun = screen.getByRole("button", { name: /Rerun selected \(0\)/ });
    expect((rerun as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Select affected (1)" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Rerun selected \(1\)/ })
    );

    expect(onUpdateStudy).toHaveBeenCalledTimes(1);
    const next = onUpdateStudy.mock.calls[0][0] as StudyProtocol;
    const bmi = next.testScenarios!.find((s) => s.id === "scn_bmi")!;
    expect(assessScenarioFreshness(bmi, next).standing).toBe("passing");
    expect(screen.getByRole("status").textContent).toBe(
      "Reran 1 saved test: 1 passing, 0 failing."
    );
  });

  it("lets an author pick individual tests to rerun", () => {
    const study = amend(ranStudy(), (draft) => {
      draft.visits[0].targetDay = 2;
    });
    const { onUpdateStudy } = renderPanel(study);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Male subject hides pregnancy test",
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Rerun selected \(1\)/ })
    );
    const next = onUpdateStudy.mock.calls[0][0] as StudyProtocol;
    const assessOf = (id: string) =>
      assessScenarioFreshness(
        next.testScenarios!.find((s) => s.id === id)!,
        next
      ).freshness;
    expect(assessOf("scn_preg")).toBe("current");
    expect(assessOf("scn_bmi")).toBe("stale");
  });

  it("saves the current dock run as a current test", () => {
    const study = buildStudy();
    const values = {
      [buildScopedKey(DEFAULT_TEST_SCOPE, "height")]: 180,
      [buildScopedKey(DEFAULT_TEST_SCOPE, "weight")]: 81,
    };
    const { onUpdateStudy } = renderPanel(study, { values });
    expect(screen.getByText(/No saved tests yet/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Save current dock run as a test"), {
      target: { value: "Adult BMI" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save test" }));

    const next = onUpdateStudy.mock.calls[0][0] as StudyProtocol;
    const saved = next.testScenarios![0];
    expect(saved.name).toBe("Adult BMI");
    expect(saved.inputs).toEqual({ height: 180, weight: 81 });
    // Recorded at the selected visit, which collects the form.
    expect(saved.scope.visitId).toBe("v_screen");
    expect(assessScenarioFreshness(saved, next).freshness).toBe("current");
  });

  it("collapses with an accessible toggle", () => {
    renderPanel(ranStudy());
    const toggle = screen.getByRole("button", { name: "Collapse" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(
      screen
        .getByRole("button", { name: "Expand" })
        .getAttribute("aria-expanded")
    ).toBe("false");
    expect(screen.queryByRole("list", { name: "Saved tests" })).toBeNull();
  });

  it("is mounted with the test dock and wired to studio navigation", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/crf/CRFStudioContainer.tsx"),
      "utf8"
    );
    const mount = source.slice(source.indexOf("<ScenarioImpactPanel"));
    expect(source).toContain(
      "{isTestDockOpen && (\n        <ScenarioImpactPanel"
    );
    expect(mount).toContain("onUpdateStudy={updateStudyWithHistory}");
    expect(mount).toContain("onNavigate={handleNavigateFromCompare}");
  });
});
