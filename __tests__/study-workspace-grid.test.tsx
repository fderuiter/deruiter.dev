/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { StudyDesignGrid } from "@/components/study-workspace/StudyDesignGrid";

afterEach(cleanup);

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
});
