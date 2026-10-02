import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_SCENARIO,
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  createStudy,
  finalizeStudy,
} from "@/lib/study-director";
import { BriefingView } from "@/components/study-director/BriefingView";
import { ScenarioBuilder } from "@/components/study-director/ScenarioBuilder";
import { ReportView } from "@/components/study-director/ReportView";

describe("Study Director Scenario UI & Retrospective Export UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders scenario controls in BriefingView and toggles ScenarioBuilder", () => {
    const onScenarioChange = vi.fn();
    render(
      <BriefingView
        setup={STUDY_24_081}
        sites={STUDY_24_081_SITES}
        team={STUDY_24_081_TEAM}
        scenario={DEFAULT_SCENARIO}
        onScenarioChange={onScenarioChange}
        actions={<button>Start</button>}
      />
    );

    expect(screen.getByText(/Active Scenario:/i)).toBeTruthy();
    const toggleBtn = screen.getByRole("button", {
      name: /Customize \/ Import Scenario/i,
    });
    expect(toggleBtn).toBeTruthy();

    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("scenario-builder")).toBeTruthy();
  });

  it("allows updating setup, site coordinator, and team archetype in ScenarioBuilder", () => {
    const onChange = vi.fn();
    render(<ScenarioBuilder scenario={DEFAULT_SCENARIO} onChange={onChange} />);

    expect(screen.getByTestId("scenario-builder")).toBeTruthy();

    // Change protocol budget
    const budgetInput = screen.getByLabelText(/Protocol Budget \(\$\)/i);
    fireEvent.change(budgetInput, { target: { value: "300000" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("renders retrospective JSON and CSV export buttons in ReportView", () => {
    let state = createStudy(
      "test-ui-export",
      STUDY_24_081,
      STUDY_24_081_SITES,
      STUDY_24_081_TEAM
    );
    state = { ...state, day: 77, status: "complete" };
    const report = finalizeStudy(state);

    render(<ReportView report={report} onRestart={() => {}} />);

    expect(screen.getByText(/Export Retrospective & Audit Data/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Download Retrospective JSON/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Export Decisions CSV/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Export Meter Trajectory CSV/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Export Findings CSV/i })
    ).toBeTruthy();
  });
});
