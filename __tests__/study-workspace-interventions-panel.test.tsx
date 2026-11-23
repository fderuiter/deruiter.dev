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

/** The interventions panel under the design grid (#3406). */

async function opened() {
  const view = render(<StudyDesignGrid />);
  await screen.findByRole("table");
  return view;
}

const panel = () => screen.getByRole("region", { name: "Interventions" });
const card = (name: string) =>
  within(panel()).getByRole("article", { name: `Intervention ${name}` });

describe("interventions panel", () => {
  it("shows each intervention's coded role, type and the elements that give it", async () => {
    await opened();
    const tavr = card("Vascular Dynamics TAVR System");
    expect(
      within(tavr).getByText("Experimental Intervention (C41161)")
    ).toBeTruthy();
    expect(within(tavr).getByText("Medical Device (C16830)")).toBeTruthy();
    expect(within(tavr).getAllByRole("listitem")).toHaveLength(1);
  });

  it("offers only CT terms for role and type", async () => {
    await opened();
    const form = within(panel()).getByRole("group", {
      name: "Add an intervention",
    });
    const options = (label: string) =>
      within(within(form).getByRole("combobox", { name: label }))
        .getAllByRole("option")
        .map((option) => option.getAttribute("value"));
    expect(options("Role")).toEqual(["C41161", "C68609", "C753", "C18020"]);
    expect(options("Type")).toEqual(["C16830", "C98769"]);
  });

  it("adds an intervention, gives it in an element and undoes the change", async () => {
    await opened();
    const form = within(panel()).getByRole("group", {
      name: "Add an intervention",
    });
    fireEvent.change(
      within(form).getByRole("textbox", { name: "Intervention name" }),
      { target: { value: "Embolic protection" } }
    );
    fireEvent.change(within(form).getByRole("combobox", { name: "Type" }), {
      target: { value: "C98769" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Add" }));
    const added = card("Embolic protection");
    expect(within(added).getByText("Procedure (C98769)")).toBeTruthy();
    expect(within(added).getByText("No element gives it yet.")).toBeTruthy();

    fireEvent.click(within(added).getByRole("button", { name: "Give" }));
    expect(
      within(card("Embolic protection")).queryByText("No element gives it yet.")
    ).toBeNull();
    expect(screen.getByText("Revision R3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(
      within(card("Embolic protection")).getByText("No element gives it yet.")
    ).toBeTruthy();
  });

  it("edits an intervention's role", async () => {
    await opened();
    const savr = card("Surgical aortic valve replacement");
    fireEvent.click(within(savr).getByRole("button", { name: "Edit" }));
    const form = within(savr).getByRole("group", {
      name: "Edit Surgical aortic valve replacement",
    });
    fireEvent.change(within(form).getByRole("combobox", { name: "Role" }), {
      target: { value: "C753" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(
      within(card("Surgical aortic valve replacement")).getByText(
        "Placebo (C753)"
      )
    ).toBeTruthy();
  });

  it("says why an intervention other parts of the study name cannot be deleted", async () => {
    await opened();
    fireEvent.click(
      within(card("Vascular Dynamics TAVR System")).getByRole("button", {
        name: "Delete intervention",
      })
    );
    expect(screen.getByRole("alert").textContent).toMatch(/still referenced/);
  });

  it("has no axe violations", async () => {
    const { container } = await opened();
    const results = await axe.run(container, {
      rules: { region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
