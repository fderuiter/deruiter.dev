import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as downloadModule from "@/lib/download";
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

  it("allows updating setup, site coordinator, and team archetype in ScenarioBuilder and exporting scenario", () => {
    const downloadSpy = vi.spyOn(downloadModule, "downloadFile").mockReturnValue(true);
    const onChange = vi.fn();
    render(<ScenarioBuilder scenario={DEFAULT_SCENARIO} onChange={onChange} />);

    expect(screen.getByTestId("scenario-builder")).toBeTruthy();

    // Change protocol budget
    const budgetInput = screen.getByLabelText(/Protocol Budget \(\$\)/i);
    fireEvent.change(budgetInput, { target: { value: "300000" } });
    expect(onChange).toHaveBeenCalled();

    // Click Export Scenario .JSON button
    const exportBtn = screen.getByRole("button", {
      name: /Export \.scenario\.json/i,
    });
    fireEvent.click(exportBtn);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining("24-081-preset"),
      "24-081-preset.scenario.json",
      { mimeType: "application/json" }
    );
  });

  it("renders retrospective JSON and CSV export buttons in ReportView and triggers downloadFile", () => {
    const downloadSpy = vi.spyOn(downloadModule, "downloadFile").mockReturnValue(true);
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

    const jsonBtn = screen.getByRole("button", {
      name: /Download Retrospective JSON/i,
    });
    fireEvent.click(jsonBtn);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining("24-081"),
      "study-24-081-retrospective.json",
      { mimeType: "application/json" }
    );

    const decisionsBtn = screen.getByRole("button", {
      name: /Export Decisions CSV/i,
    });
    fireEvent.click(decisionsBtn);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining("Day,Event ID,Option ID,Label,Documented,Attention Spent"),
      "study-24-081-decisions.csv",
      { mimeType: "text/csv" }
    );

    const metersBtn = screen.getByRole("button", {
      name: /Export Meter Trajectory CSV/i,
    });
    fireEvent.click(metersBtn);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining("Day,Integrity,Compliance,Timeline,Budget,Client,Team"),
      "study-24-081-meters.csv",
      { mimeType: "text/csv" }
    );

    const findingsBtn = screen.getByRole("button", {
      name: /Export Findings CSV/i,
    });
    fireEvent.click(findingsBtn);
    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining("Event ID,Day,Question,Documented,Answer,Outcome"),
      "study-24-081-findings.csv",
      { mimeType: "text/csv" }
    );
  });
});
