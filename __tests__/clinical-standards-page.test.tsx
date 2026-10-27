/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import StandardsConformancePage, {
  metadata,
} from "@/app/clinical/standards/page";
import { standardsBillOfMaterials } from "@/lib/clinical-standards";

afterEach(cleanup);

describe("standards conformance page (#2992 step 6)", () => {
  it("says it is a demonstration and names no endorsement", async () => {
    render(await StandardsConformancePage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Standards conformance" })
    ).toBeTruthy();
    const note = screen.getByRole("note");
    expect(note.textContent).toContain(
      "A demonstration, not a validated or certified system."
    );
    expect(note.textContent).toContain("CDISC has not reviewed or endorsed");
    expect(String(metadata.title)).toContain("Conformance");
  });

  it("defines all six states, and shows unsupported and not evaluated layers", async () => {
    render(await StandardsConformancePage());
    for (const label of [
      "Pass",
      "Fail",
      "Not applicable",
      "Not evaluated",
      "Unsupported",
      "Execution error",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const adamig = screen
      .getByRole("heading", { name: "ADaMIG conformance rules" })
      .closest("li") as HTMLElement;
    expect(within(adamig).getByText("Unsupported")).toBeTruthy();
  });

  it("lists every pinned standard with its versions and checks", async () => {
    const { container } = render(await StandardsConformancePage());
    const bom = standardsBillOfMaterials();
    for (const entry of bom.standards) {
      const card = screen
        .getByRole("link", { name: entry.name })
        .closest("li") as HTMLElement;
      expect(card.textContent).toContain(entry.pinned);
      expect(card.textContent).toContain(entry.published);
      expect(card.textContent).toContain(entry.coverage);
      expect(within(card).getAllByRole("link")).toHaveLength(
        1 + entry.checks.length
      );
    }
    const repoLinks = [...container.querySelectorAll("a[href]")].filter((a) =>
      a.getAttribute("href")?.startsWith("https://github.com/")
    );
    expect(repoLinks.length).toBeGreaterThan(0);
  });

  it("has no WCAG 2.1 AA violations", async () => {
    const { container } = render(await StandardsConformancePage());
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
