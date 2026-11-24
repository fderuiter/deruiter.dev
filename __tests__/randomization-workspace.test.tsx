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

/** The Randomization work area under the design grid (#4006). */

async function opened() {
  const view = render(<StudyDesignGrid />);
  await screen.findByRole("table");
  return view;
}

const area = () =>
  screen.getByRole("region", { name: "Randomization work area" });
const inArea = () => within(area());
const stageButton = (title: string) =>
  within(inArea().getByRole("navigation", { name: "Randomization stages" }))
    .getAllByRole("button")
    .find((button) => button.textContent?.endsWith(title))!;

function commit(label: string, value: string) {
  const input = inArea().getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("randomization work area", () => {
  it("offers seven stages and starts on the use notice in exploration", async () => {
    await opened();
    const stages = within(
      inArea().getByRole("navigation", { name: "Randomization stages" })
    ).getAllByRole("button");
    expect(stages.map((b) => b.textContent)).toEqual([
      "1. Use notice",
      "2. Study metadata",
      "3. Arms and method",
      "4. Sites and factors",
      "5. Mechanics",
      "6. Caps",
      "7. Review",
    ]);
    expect(stages[0].getAttribute("aria-current")).toBe("step");
    expect(
      (
        inArea().getByRole("combobox", {
          name: "Working on",
        }) as HTMLSelectElement
      ).value
    ).toBe("exploration");
  });

  it("shows the Simple preset's arms and keeps edits across stages", async () => {
    await opened();
    fireEvent.click(stageButton("Arms and method"));
    expect(inArea().getByText("Reduced ratio 1:1")).toBeTruthy();
    commit("Treatment ratio", "2");
    expect(inArea().getByText("Reduced ratio 2:1")).toBeTruthy();
    fireEvent.click(inArea().getByRole("button", { name: "Next" }));
    fireEvent.click(inArea().getByRole("button", { name: "Back" }));
    expect(
      (inArea().getByLabelText("Treatment ratio") as HTMLInputElement).value
    ).toBe("2");
  });

  it("asks before a preset replaces edits, and replaces on confirmation", async () => {
    await opened();
    fireEvent.click(stageButton("Arms and method"));
    commit("Treatment ratio", "3");
    fireEvent.click(inArea().getByRole("button", { name: /^Complex preset/ }));
    const dialog = await screen.findByRole("dialog", {
      name: "Replace your edits?",
    });
    expect(within(dialog).getByText(/arms/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Replace" }));
    expect(inArea().getByText("Reduced ratio 1:1:1")).toBeTruthy();
    fireEvent.click(stageButton("Sites and factors"));
    expect(inArea().getByText("8 stratum intersections")).toBeTruthy();
  });

  it("shows the validator's exact findings in review until a seed is set", async () => {
    await opened();
    fireEvent.click(stageButton("Review"));
    expect(inArea().getByText(/^Not ready/)).toBeTruthy();
    expect(inArea().getByText("(seed)")).toBeTruthy();
    fireEvent.click(stageButton("Mechanics"));
    fireEvent.click(inArea().getByRole("button", { name: "Generate a seed" }));
    expect(
      inArea().getByText(/generated seed is kept with the plan/)
    ).toBeTruthy();
    fireEvent.click(stageButton("Review"));
    expect(inArea().getByText(/^Ready to run/)).toBeTruthy();
  });

  it("previews the subject ID mask without drawing IDs", async () => {
    await opened();
    fireEvent.click(stageButton("Mechanics"));
    expect(inArea().getByText("A-001")).toBeTruthy();
    commit("Subject ID mask", "{NOPE}");
    expect(
      inArea().getByLabelText("Subject ID mask").getAttribute("aria-invalid")
    ).toBe("true");
  });

  it("promotes an exploration only after the acknowledgment, as a study plan", async () => {
    await opened();
    fireEvent.click(stageButton("Review"));
    const promote = inArea().getByRole("button", {
      name: "Promote to a plan for this study",
    }) as HTMLButtonElement;
    expect(promote.disabled).toBe(true);
    fireEvent.click(stageButton("Use notice"));
    fireEvent.click(inArea().getByRole("checkbox"));
    fireEvent.click(stageButton("Review"));
    fireEvent.click(
      inArea().getByRole("button", { name: "Promote to a plan for this study" })
    );
    const select = inArea().getByRole("combobox", {
      name: "Working on",
    }) as HTMLSelectElement;
    expect(select.value).toBe("RandomizationPlan_1");
    // The seed is not carried over, so the plan is a draft until one is set.
    expect(inArea().getByText(/^Not ready/)).toBeTruthy();
    expect(inArea().queryByText(/Plan digest/)).toBeNull();
  });

  it("gates a stored plan behind the acknowledgment and reads metadata from the study", async () => {
    await opened();
    fireEvent.click(
      inArea().getByRole("button", { name: "Add a plan for this design" })
    );
    expect((stageButton("Study metadata") as HTMLButtonElement).disabled).toBe(
      true
    );
    fireEvent.click(inArea().getByRole("checkbox"));
    fireEvent.click(stageButton("Study metadata"));
    expect(inArea().queryByLabelText("Protocol ID")).toBeNull();
    fireEvent.click(stageButton("Arms and method"));
    expect(
      inArea().getByText(/Arms come from the selected design/)
    ).toBeTruthy();
  });

  it("has no axe violations on each stage", async () => {
    const { container } = await opened();
    for (const title of [
      "Use notice",
      "Study metadata",
      "Arms and method",
      "Sites and factors",
      "Mechanics",
      "Caps",
      "Review",
    ]) {
      fireEvent.click(stageButton(title));
      const results = await axe.run(container, {
        rules: { "color-contrast": { enabled: false } },
      });
      expect(results.violations.map((v) => `${title}: ${v.id}`)).toEqual([]);
    }
  });
});
