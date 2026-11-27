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
import StudyStudioPage, { metadata } from "@/app/study-studio/page";
import {
  STUDY_WORKSPACE_DRAFT_KEY,
  STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY,
} from "@/components/study-workspace/randomization-draft-storage";
import { getNavGroupForHref } from "@/lib/navigation";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";

afterEach(() => {
  cleanup();
  localStorage.removeItem(STUDY_WORKSPACE_DRAFT_KEY);
  localStorage.removeItem(STUDY_WORKSPACE_DRAFT_QUARANTINE_KEY);
});

async function renderStudio() {
  const view = render(<StudyStudioPage />);
  await screen.findByText("Revision R1");
  return view;
}

function selectStudioTab(name: RegExp) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

/** The Clinical Study Studio interactive tabbed workspace (ADR 0074). */
describe("Clinical Study Studio page", () => {
  it("renders the heading, accessible tablist in build order, and keyboard roving focus", async () => {
    await renderStudio();
    expect(
      screen.getByRole("heading", { level: 1, name: "Clinical Study Studio" })
    ).toBeTruthy();
    expect(String(metadata.title)).toContain("Clinical Study Studio");

    const tablist = screen.getByRole("tablist", { name: "Study work areas" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.getAttribute("id"))).toEqual([
      "study-tab-design",
      "study-tab-schedule",
      "study-tab-narrative",
      "study-tab-analysis",
      "study-tab-randomization",
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("heading", { level: 2, name: "Schedule" })
    ).toBeTruthy();

    fireEvent.keyDown(tabs[1], { key: "End" });
    expect(tabs[4].getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("heading", { level: 2, name: "Randomization" })
    ).toBeTruthy();

    fireEvent.keyDown(tabs[4], { key: "Home" });
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("heading", { level: 2, name: "Design" })
    ).toBeTruthy();

    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(tabs[4].getAttribute("aria-selected")).toBe("true");
  });

  it("is registered once and sits in the Clinical menu", () => {
    expect(
      PUBLIC_ROUTE_REGISTRY.filter((r) => r.path === "/study-studio")
    ).toHaveLength(1);
    expect(getNavGroupForHref("/study-studio")?.id).toBe("clinical");
  });

  it("displays DEV-2026-VALVE-RCT counts across Schedule, Narrative, and Analysis intent", async () => {
    await renderStudio();

    selectStudioTab(/02.*Schedule/i);
    expect(screen.getByText("7 encounters")).toBeTruthy();
    expect(screen.getByText("10 activities")).toBeTruthy();
    expect(screen.getByText("37 scheduled links")).toBeTruthy();

    const soaTable = screen.getByRole("table");
    const visitHeaders = within(soaTable).getAllByRole("columnheader").slice(1);
    expect(visitHeaders).toHaveLength(7);
    expect(visitHeaders[0].textContent).toContain("Screening");
    expect(visitHeaders[6].textContent).toContain(
      "Unscheduled Event / Repeat Visit"
    );

    selectStudioTab(/03.*Narrative/i);
    expect(screen.getByText("4 objectives")).toBeTruthy();
    expect(screen.getByText("7 endpoints")).toBeTruthy();
    expect(screen.getByText("7 criteria")).toBeTruthy();

    selectStudioTab(/04.*Analysis intent/i);
    expect(screen.getByText("1 estimand")).toBeTruthy();
    expect(screen.getByText("3 analysis populations")).toBeTruthy();
    expect(screen.getByText("7 catalog endpoints")).toBeTruthy();
  });

  it("preserves revision history, undo, and redo when editing across Schedule, Narrative, Analysis intent, and Randomization", async () => {
    await renderStudio();

    // 1. Toggle a scheduled cell on Schedule -> R2
    selectStudioTab(/02.*Schedule/i);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Subject Demographics & IDE Consent at Index Procedure \(Day 0\): not scheduled/,
      })
    );
    expect(screen.getByText("38 scheduled links")).toBeTruthy();
    expect(screen.getByText("Revision R2")).toBeTruthy();

    // 2. Add an eligibility criterion on Narrative -> R3
    selectStudioTab(/03.*Narrative/i);
    const critGroup = screen.getByRole("group", {
      name: "Add an eligibility criterion",
    });
    fireEvent.change(
      within(critGroup).getByRole("textbox", { name: "New criterion name" }),
      { target: { value: "Left Ventricular Function" } }
    );
    fireEvent.change(
      within(critGroup).getByRole("textbox", { name: "Criterion identifier" }),
      { target: { value: "INC-05" } }
    );
    fireEvent.change(
      within(critGroup).getByRole("textbox", { name: "New criterion text" }),
      { target: { value: "LVEF >= 20% by transthoracic echocardiography." } }
    );
    fireEvent.click(
      within(critGroup).getByRole("button", { name: "Add criterion" })
    );
    expect(screen.getByText("8 criteria")).toBeTruthy();
    expect(screen.getByText("Revision R3")).toBeTruthy();

    // 3. Add an analysis population on Analysis intent -> R4
    selectStudioTab(/04.*Analysis intent/i);
    const popGroup = screen.getByRole("group", {
      name: "Add an analysis population",
    });
    fireEvent.change(
      within(popGroup).getByRole("textbox", { name: "New population name" }),
      { target: { value: "Valve Implanted Set" } }
    );
    fireEvent.change(
      within(popGroup).getByRole("textbox", { name: "Population definition" }),
      { target: { value: "All participants receiving an implanted valve." } }
    );
    fireEvent.click(
      within(popGroup).getByRole("button", { name: "Add analysis population" })
    );
    expect(screen.getByText("4 analysis populations")).toBeTruthy();
    expect(screen.getByText("Revision R4")).toBeTruthy();

    // 4. Visit Randomization and return to Schedule without losing undo history
    selectStudioTab(/05.*Randomization/i);
    expect(screen.getByText("Revision R4")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled")
    ).toBe(false);

    selectStudioTab(/02.*Schedule/i);
    expect(screen.getByText("38 scheduled links")).toBeTruthy();

    // Undo 3 edits back to initial schedule state -> R5, R6, R7
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Revision R7")).toBeTruthy();
    expect(screen.getByText("37 scheduled links")).toBeTruthy();

    // Redo schedule toggle -> R8
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByText("Revision R8")).toBeTruthy();
    expect(screen.getByText("38 scheduled links")).toBeTruthy();
  });

  it("alerts immediately with both visit names and overlapping day count when visit windows collide", async () => {
    await renderStudio();
    selectStudioTab(/02.*Schedule/i);

    fireEvent.click(
      screen.getByRole("button", { name: /30-Day Follow-up.*Day 30/i })
    );
    const inspector = screen.getByRole("region", {
      name: "Edit visit 30-Day Follow-up",
    });
    fireEvent.change(
      within(inspector).getByRole("spinbutton", {
        name: "Window before (days)",
      }),
      { target: { value: "28" } }
    );
    fireEvent.click(
      within(inspector).getByRole("button", { name: "Save timing" })
    );

    const conflictSection = screen.getByRole("region", {
      name: /Visit window overlaps/,
    });
    expect(conflictSection.textContent).toContain(
      "Pre-Discharge Assessment (Day 1 - 3)"
    );
    expect(conflictSection.textContent).toContain("30-Day Follow-up");
    expect(conflictSection.textContent).toContain("3 day(s)");
  });

  it("surfaces explicit findings on Blank study instead of inventing defaults", async () => {
    await renderStudio();
    fireEvent.change(screen.getByRole("combobox", { name: "Study" }), {
      target: { value: "blank" },
    });
    await screen.findByText(/no arms or epochs yet/);

    selectStudioTab(/02.*Schedule/i);
    expect(
      screen.getByText("The selected study design has no schedule timeline.")
    ).toBeTruthy();
  });

  it("has no axe violations across all five tabs", async () => {
    const { container } = await renderStudio();
    for (const tabPattern of [
      /01.*Design/i,
      /02.*Schedule/i,
      /03.*Narrative/i,
      /04.*Analysis intent/i,
      /05.*Randomization/i,
    ]) {
      selectStudioTab(tabPattern);
      const results = await axe.run(container, {
        rules: { region: { enabled: false } },
      });
      expect(results.violations).toEqual([]);
    }
  }, 20_000);
});
