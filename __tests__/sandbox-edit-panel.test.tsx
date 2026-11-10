import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DEMO_301_STUDY } from "@/lib/study-data";
import { evaluateVisitWindowConflicts } from "@/lib/clinical-standards/visit-window-conflicts";
import { SandboxEditPanel } from "@/components/study-data/SandboxEditPanel";

const design = DEMO_301_STUDY.design;
const week2 = design.visits.find((visit) => visit.id === "enc_week2")!;
const week4 = design.visits.find((visit) => visit.id === "enc_week4")!;
// The longest late window that still ends before Week 4's target day.
const max = week4.targetDay - week2.targetDay - 1;

const severities = (windowAfter: number) =>
  (
    evaluateVisitWindowConflicts(
      design.visits.map((visit) =>
        visit.id === week2.id ? { ...visit, windowAfter } : visit
      )
    ).conflictsByVisitId[week2.id] ?? []
  ).map((conflict) => conflict.severity);

const renderPanel = (disabled = false) => {
  const onRerun = vi.fn();
  render(
    <SandboxEditPanel design={design} disabled={disabled} onRerun={onRerun} />
  );
  const input = screen.getByLabelText(
    /Days allowed after Week 2/i
  ) as HTMLInputElement;
  const button = screen.getByRole("button", {
    name: "Rerun with this window",
  }) as HTMLButtonElement;
  return { onRerun, input, button };
};

afterEach(cleanup);

describe("SandboxEditPanel (#3161)", () => {
  it("takes its allowed range from the schedule window check CRF Studio uses", () => {
    expect(severities(week2.windowAfter)).toEqual([]);
    expect(severities(max)).toEqual(["warning"]);
    expect(severities(max + 1)).toEqual(["error"]);
    const { input } = renderPanel();
    expect(input.id).not.toBe("");
    expect(input.getAttribute("min")).toBe("0");
    expect(input.getAttribute("max")).toBe(String(max));
    expect(input.value).toBe(String(week2.windowAfter));
  });

  it.each([String(max + 1), "-1", "2.5", ""])(
    "refuses %j with a sentence that names the allowed range",
    (value) => {
      const { input, button, onRerun } = renderPanel();
      fireEvent.change(input, { target: { value } });
      expect(button.disabled).toBe(true);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByRole("alert").textContent).toContain(
        `Enter a whole number of days from 0 to ${max}`
      );
      fireEvent.submit(button.closest("form")!);
      expect(onRerun).not.toHaveBeenCalled();
    }
  );

  it("reruns once with only the Week 2 late window changed", () => {
    const { input, button, onRerun } = renderPanel();
    fireEvent.change(input, { target: { value: "5" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onRerun).toHaveBeenCalledTimes(1);
    const edited = onRerun.mock.calls[0][0] as typeof design;
    expect(edited.visits).toEqual(
      design.visits.map((visit) =>
        visit.id === week2.id ? { ...visit, windowAfter: 5 } : visit
      )
    );
  });

  it("allows a window that overlaps Week 4's early window, with the check's warning", () => {
    const { input, button, onRerun } = renderPanel();
    fireEvent.change(input, {
      target: { value: String(week2.windowAfter + 10) },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/overlaps WEEK 4 early window/)).toBeTruthy();
    fireEvent.click(button);
    expect(onRerun).toHaveBeenCalledTimes(1);
  });

  it("keeps the button disabled while a run is in progress", () => {
    const { button } = renderPanel(true);
    expect(button.disabled).toBe(true);
  });

  it("renders nothing for a study without the Week 2 visit", () => {
    const { container } = render(
      <SandboxEditPanel
        design={{
          ...design,
          visits: design.visits.filter((visit) => visit.id !== week2.id),
        }}
        disabled={false}
        onRerun={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});
