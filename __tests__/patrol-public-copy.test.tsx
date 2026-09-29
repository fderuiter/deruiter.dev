import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { PatrolShiftContainer } from "@/components/patrol/PatrolShiftContainer";
import { MedicalDisclaimerBanner } from "@/components/patrol/MedicalDisclaimerBanner";

describe("Patrol Shift — visitor-facing copy (#1343)", () => {
  it("shows no issue numbers, milestone codes, or self-certifying chips", () => {
    const { container } = render(
      <>
        <MedicalDisclaimerBanner forceShow />
        <PatrolShiftContainer />
      </>
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/#\d{3,}/);
    expect(text).not.toMatch(/\bIssues?\b/);
    expect(text).not.toMatch(/\bM\d{1,2}\b/);
    expect(text).not.toMatch(/Milestone|Roadmap|Vertical Slice/i);
    expect(text).not.toMatch(/WCAG|Non-Blocking Operational/i);
  });

  it("describes the modes in plain words and keeps the medical disclaimer", () => {
    const { container } = render(
      <>
        <MedicalDisclaimerBanner forceShow />
        <PatrolShiftContainer />
      </>
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Outdoor Emergency Care");
    expect(text).toContain("Toboggan Handling");
    expect(text).toContain("Sweep & Hill Safety");
    expect(text).toContain("dial 911 immediately");
  });
});
