import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MESSY_DATA_SCENARIOS, type Finding } from "@/lib/study-data";
import { InjectedIssuePanel } from "@/components/study-data/InjectedIssuePanel";
import type { InjectedIssue } from "@/components/study-data/protocol";

afterEach(cleanup);

const base = MESSY_DATA_SCENARIOS[0];

function issue(
  findings: readonly string[],
  overrides: Partial<Omit<InjectedIssue, "scenario">> = {}
): InjectedIssue {
  return {
    scenario: {
      ...base,
      expected: { ...base.expected, findings },
    },
    subject: "DEMO-301-0004",
    caught: [],
    missed: [],
    ...overrides,
  };
}

const ROW_FINDING: Finding = {
  ruleId: "SD0002",
  severity: "error",
  layer: "sdtm",
  dataset: "DM",
  variable: "AGE",
  row: 3,
  message: "AGE is missing.",
};

const DATASET_FINDING: Finding = {
  ruleId: "SD0003",
  severity: "notice",
  layer: "sdtm",
  dataset: "DM",
  message: "A dataset-level notice.",
};

describe("InjectedIssuePanel", () => {
  it("says nothing changed when no subject was eligible", () => {
    render(
      <InjectedIssuePanel
        injected={issue(["SD0002"], { subject: null })}
        onShowRow={vi.fn()}
      />
    );
    expect(
      screen.getByText(/No subject in this run was eligible/)
    ).toBeTruthy();
  });

  it("explains a scenario that declares no finding", () => {
    render(<InjectedIssuePanel injected={issue([])} onShowRow={vi.fn()} />);
    expect(
      screen.getByText(/The gate raises no finding for this one/)
    ).toBeTruthy();
  });

  it("says when the gate missed the change", () => {
    render(
      <InjectedIssuePanel injected={issue(["SD0002"])} onShowRow={vi.fn()} />
    );
    expect(screen.getByText(/The gate did not catch it/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show row" })).toBeNull();
  });

  it("lists caught findings, names missed rules and opens a row", () => {
    const onShowRow = vi.fn();
    render(
      <InjectedIssuePanel
        injected={issue(["SD0002", "SD0003", "SD0009"], {
          caught: [ROW_FINDING, DATASET_FINDING],
          missed: ["SD0009"],
        })}
        onShowRow={onShowRow}
      />
    );
    expect(screen.getByText(/The gate caught it: 2 findings/)).toBeTruthy();
    expect(screen.getByText("DM.AGE, row 4")).toBeTruthy();
    expect(
      screen.getByText(/SD0009 raised nothing on this subject/)
    ).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Show row" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onShowRow).toHaveBeenCalledWith("sdtm", "DM", 3);
  });

  it("uses the singular for one caught finding", () => {
    render(
      <InjectedIssuePanel
        injected={issue(["SD0002"], { caught: [ROW_FINDING] })}
        onShowRow={vi.fn()}
      />
    );
    expect(screen.getByText(/The gate caught it: 1 finding from/)).toBeTruthy();
  });
});
