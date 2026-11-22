/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import StudyStudioPage, { metadata } from "@/app/study-studio/page";
import { getNavGroupForHref } from "@/lib/navigation";
import { PUBLIC_ROUTE_REGISTRY } from "@/lib/public-routes";

afterEach(cleanup);

/** The Clinical Study Studio route shell (#3400, ADR 0074). */
describe("Clinical Study Studio page", () => {
  it("shows the heading and the five work areas, in build order", () => {
    render(<StudyStudioPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Clinical Study Studio" })
    ).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    ).toEqual([
      "Design",
      "Schedule",
      "Narrative",
      "Analysis intent",
      "Randomization",
    ]);
    expect(screen.getByText("In development")).toBeTruthy();
    expect(String(metadata.title)).toContain("Clinical Study Studio");
  });

  it("is registered once and sits in the Clinical menu", () => {
    expect(
      PUBLIC_ROUTE_REGISTRY.filter((r) => r.path === "/study-studio")
    ).toHaveLength(1);
    expect(getNavGroupForHref("/study-studio")?.id).toBe("clinical");
  });

  it("has no axe violations", async () => {
    const { container } = render(<StudyStudioPage />);
    const results = await axe.run(container, {
      rules: { region: { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
