import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { getOncologyPresetSync } from "@/lib/crf/presets";

// #1199: the viewer derived a fresh branding object on every render and listed
// it as an effect dependency, so each regeneration scheduled another one and the
// tab never went idle. Counting regenerations proves the effect settles.
const generateSdtmMappingMatrix = vi.fn(() => []);

vi.mock("@/lib/crf/export-acrf", () => ({
  generateSdtmMappingMatrix: () => generateSdtmMappingMatrix(),
  generateStudyAcrfBookHtml: () => "<p>book</p>",
  generateAcrfHtml: () => "<p>form</p>",
}));

import { AcrfOverlayViewer } from "@/components/crf/Modes/AcrfOverlayViewer";

afterEach(() => {
  cleanup();
  generateSdtmMappingMatrix.mockClear();
});

describe("AcrfOverlayViewer (#1199)", () => {
  it("regenerates the annotations once per study, not on every render", async () => {
    const study = getOncologyPresetSync();
    render(
      <AcrfOverlayViewer study={study} activeFormId={study.forms[0].id} />
    );

    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    expect(generateSdtmMappingMatrix.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
