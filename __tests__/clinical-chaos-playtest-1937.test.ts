// @vitest-environment node
// Clinical Trial Chaos playtest fixes (#1937): correct SDTM and regulatory
// copy, a real choice at Sign, dialogs that slow rather than stop the
// clocks, a report coloured by its verdict, and no scroll under the navbar.
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  DIALOG_CLOCK_RATE,
  MOCK_OBSERVATION_TEMPLATES,
  getShiftClockRate,
  getShiftTickSeconds,
  getSignatureReasonError,
  verify21CFRSubmission,
  type ClinicalSubject,
} from "@/lib/clinical-trial-chaos";
import { getReportTone } from "@/components/clinical-trial-chaos/floor-scene";

const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
// The component and, since #3438, the session hook it renders from.
const readChaos = () =>
  read("components/ClinicalTrialChaos.tsx") +
  read("components/clinical-trial-chaos/useClinicalChaosSession.ts");

function subject(isSAE: boolean): ClinicalSubject {
  return fromPartial<ClinicalSubject>({
    id: "s1",
    subjectLabel: "SUBJ-1",
    isSAE,
    observations: [fromPartial({ destination: "AE", isResolved: true })],
  });
}

describe("SDTM copy (#1937)", () => {
  it("files height and weight under Vital Signs, not Demographics", () => {
    for (const field of ["Height", "Weight"]) {
      const template = MOCK_OBSERVATION_TEMPLATES.find(
        (t) => t.field === field
      );
      expect(template?.destination).toBe("VS");
    }
  });

  it("offers only one correct height for 180 m", () => {
    const height = MOCK_OBSERVATION_TEMPLATES.find((t) => t.field === "Height");
    const corruption = height?.corruptions.find((c) => c.rawValue === "180 m");
    expect(corruption?.options).not.toContain("1.80 m");
    expect(corruption?.options).not.toContain("1800 mm");
    expect(corruption?.options).not.toContain("70.8 in");
  });
});

describe("Regulatory copy (#1937)", () => {
  const sources = [
    "components/ClinicalTrialChaos.tsx",
    "components/clinical-trial-chaos/useClinicalChaosSession.ts",
    "lib/clinical-trial-chaos/engine.ts",
    "lib/clinical-trial-chaos/sponsor.ts",
    "lib/clinical-trial-chaos/types.ts",
    "lib/game-manuals.ts",
  ].map(read);

  it("cites 21 CFR 312.42 for a clinical hold, never 312.44", () => {
    for (const source of sources) expect(source).not.toContain("312.44");
  });

  it("cites ICH E6(R3), which superseded E6(R2)", () => {
    for (const source of sources) expect(source).not.toContain("E6(R2)");
  });

  it("never calls an inspection classification an approval", () => {
    for (const source of sources) {
      expect(source).not.toMatch(/NAI \([^)]*Approved/);
      expect(source).not.toContain("APPROVED FOR NDA");
    }
  });
});

describe("Sign is a real choice (#1937)", () => {
  it("requires Urgent Safety Expedited for an SAE and only for an SAE", () => {
    expect(getSignatureReasonError(subject(true), "Intent to Submit")).toMatch(
      /Urgent Safety Expedited/
    );
    expect(
      getSignatureReasonError(subject(false), "Urgent Safety Expedited")
    ).toMatch(/only for serious adverse events/);
    expect(
      getSignatureReasonError(subject(true), "Urgent Safety Expedited")
    ).toBeNull();
    expect(getSignatureReasonError(subject(false), "Author Verification")).toBe(
      null
    );
  });

  it("rejects a mismatched reason with a warning and a suspicion cost", () => {
    const result = verify21CFRSubmission(
      subject(true),
      "Intent to Submit",
      "AE"
    );
    expect(result.success).toBe(false);
    expect(result.reasonMismatch).toBe(true);
    expect(result.level).toBe("WARN");
    expect(result.suspicionDelta).toBeGreaterThan(0);
    expect(
      verify21CFRSubmission(subject(true), "Urgent Safety Expedited", "AE")
        .success
    ).toBe(true);
  });

  it("opens the signature dialog on the routine reason, not the answer", () => {
    expect(readChaos()).not.toMatch(/selectedReason: activeSubject\.isSAE/);
  });
});

describe("Dialogs slow the clocks (#1937)", () => {
  it("stops for pause, manual and calibration and slows for a dialog", () => {
    expect(getShiftClockRate({})).toBe(1);
    expect(getShiftClockRate({ userPaused: true })).toBe(0);
    expect(getShiftClockRate({ manualOpen: true })).toBe(0);
    expect(getShiftClockRate({ calibrating: true, dialogOpen: true })).toBe(0);
    expect(getShiftClockRate({ dialogOpen: true })).toBe(DIALOG_CLOCK_RATE);
  });

  it("scales a frame's seconds by the clock rate", () => {
    expect(getShiftTickSeconds(80, false, DIALOG_CLOCK_RATE)).toBeCloseTo(0.02);
    expect(getShiftTickSeconds(80, false)).toBeCloseTo(0.08);
  });
});

describe("BIMO report colour (#1937)", () => {
  it("colours the score by verdict, so a failing report never reads green", () => {
    expect(getReportTone("NAI (No Action Indicated)").score).toMatch(/emerald/);
    expect(getReportTone("VAI (Voluntary Action Indicated)").score).toMatch(
      /amber/
    );
    const oai = getReportTone(
      "OAI (Official Action Indicated - Form 483 Issued)"
    );
    expect(oai.score).toMatch(/rose/);
    expect(oai.frame).not.toMatch(/emerald/);
  });
});

describe("Cabinet layout (#1937)", () => {
  it("leaves cabinet alignment to PlayCabinet on Start", () => {
    expect(readChaos()).toContain('board.closest("[data-arcade-cabinet]")');
  });

  it("keeps small labels at zinc-400 or brighter", () => {
    expect(readChaos()).not.toContain("text-zinc-500");
  });
});
