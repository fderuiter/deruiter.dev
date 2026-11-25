/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import ClinicalAiGovernancePage, {
  metadata,
} from "@/app/clinical/ai-governance/page";
import { AI_GOVERNANCE_PAGE_COPY } from "@/lib/clinical-ai-governance";
import { findClinicalClaims } from "@/lib/clinical-platform";

afterEach(cleanup);

describe("clinical AI governance route shell (#3548)", () => {
  it("renders the title, synthetic non-advice banner, guidance statuses and four section headings", () => {
    render(<ClinicalAiGovernancePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "AI governance in clinical data work",
      })
    ).toBeTruthy();

    const note = screen.getByRole("note");
    expect(note.textContent).toContain("synthetic");
    expect(note.textContent).toContain(
      "not regulatory, legal or compliance advice"
    );
    expect(note.textContent).toContain("not a validated system");

    expect(String(metadata.title)).toContain("AI Governance");

    for (const section of AI_GOVERNANCE_PAGE_COPY.sections) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.heading })
      ).toBeTruthy();
    }

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toContain("FDA-2024-D-4689");
    expect(bodyText).toContain(
      "Draft guidance (January 2025, docket FDA-2024-D-4689)"
    );
    expect(bodyText).toContain("2025 consultation draft");
    expect(bodyText).toContain("Industry guide (July 2025)");
  });

  it("makes no compliance or validation claims in its copy", () => {
    const allCopy = [
      AI_GOVERNANCE_PAGE_COPY.eyebrow,
      AI_GOVERNANCE_PAGE_COPY.title,
      AI_GOVERNANCE_PAGE_COPY.intro,
      AI_GOVERNANCE_PAGE_COPY.banner,
      AI_GOVERNANCE_PAGE_COPY.referencesHeading,
      AI_GOVERNANCE_PAGE_COPY.referencesIntro,
      ...AI_GOVERNANCE_PAGE_COPY.references.flatMap((r) => [
        r.title,
        r.status,
        r.summary,
      ]),
      ...AI_GOVERNANCE_PAGE_COPY.sections.flatMap((s) => [
        s.heading,
        s.summary,
      ]),
    ].join("\n");

    expect(findClinicalClaims(allCopy)).toEqual([]);
  });

  it("has no WCAG 2.1 AA violations", async () => {
    const { container } = render(<ClinicalAiGovernancePage />);
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
