// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  OFFICES,
  DEFAULT_OFFICE_ID,
  getOfficeById,
  applyOfficeSpawnInterval,
  applyOfficeErrorChance,
  applyOfficeAmendmentInterval,
  applyOfficeScore,
  applyOfficeCharge,
  applyOfficeToSubject,
  applyOfficeToAuditor,
  pickOfficeAmbientEvent,
  createInitialAuditorState,
  generateClinicalSubject,
} from "../lib/clinical-trial-chaos";

const baseline = getOfficeById(DEFAULT_OFFICE_ID);
const glassTower = getOfficeById("pharma-glass-tower");
const basement = getOfficeById("academic-basement");

describe("Clinical Trial Chaos - Office selection", () => {
  it("declares unique office ids with sites and ambient events", () => {
    const ids = OFFICES.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const office of OFFICES) {
      expect(office.sites.length).toBeGreaterThan(0);
      expect(office.ambientEvents.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the default office for unknown ids", () => {
    expect(getOfficeById("moon-base").id).toBe(DEFAULT_OFFICE_ID);
    expect(getOfficeById(null).id).toBe(DEFAULT_OFFICE_ID);
  });

  it("leaves the baseline untouched for the default office", () => {
    expect(applyOfficeSpawnInterval(6.5, baseline)).toBe(6.5);
    expect(applyOfficeErrorChance(0.45, baseline)).toBe(0.45);
    expect(applyOfficeAmendmentInterval(40, baseline)).toBe(40);
    expect(applyOfficeScore(1000, baseline)).toBe(1000);
    expect(applyOfficeCharge(2, baseline)).toBe(2);
  });

  it("clamps error chance and interval floors", () => {
    expect(applyOfficeErrorChance(0.9, basement)).toBe(0.95);
    expect(applyOfficeErrorChance(-1, baseline)).toBe(0.05);
    expect(applyOfficeSpawnInterval(0.1, glassTower)).toBe(1);
    expect(applyOfficeAmendmentInterval(1, baseline)).toBe(5);
  });

  it("scales submission score by the office multiplier", () => {
    expect(applyOfficeScore(1000, glassTower)).toBe(1500);
  });

  it("stamps subjects with an office site and rescales the countdown", () => {
    const subject = generateClinicalSubject(0.5, false, 5000, ["DM", "VS"]);
    const stamped = applyOfficeToSubject(subject, basement, 1);
    expect(basement.sites).toContain(stamped.studySite);
    expect(stamped.maxTime).toBe(
      Math.round(subject.maxTime * basement.modifiers.subjectTimeMultiplier)
    );
    expect(stamped.timeRemaining).toBe(stamped.maxTime);
    expect(stamped.observations).toBe(subject.observations);
  });

  it("applies starting suspicion and decay to a fresh auditor", () => {
    const auditor = applyOfficeToAuditor(
      createInitialAuditorState(),
      glassTower
    );
    expect(auditor.suspicion).toBe(glassTower.modifiers.startingSuspicion);
    expect(auditor.suspicionDecayRate).toBeCloseTo(
      createInitialAuditorState().suspicionDecayRate *
        glassTower.modifiers.suspicionDecayMultiplier
    );
  });

  it("picks ambient events within bounds for any rand output", () => {
    expect(pickOfficeAmbientEvent(basement, () => 0)).toBe(
      basement.ambientEvents[0]
    );
    expect(pickOfficeAmbientEvent(basement, () => 0.9999)).toBe(
      basement.ambientEvents[basement.ambientEvents.length - 1]
    );
    expect(pickOfficeAmbientEvent(basement, () => 1)).toBe(
      basement.ambientEvents[basement.ambientEvents.length - 1]
    );
  });
});

describe("Clinical Trial Chaos - subject labels", () => {
  it("never reuses a seeded subject label for generated subjects", async () => {
    const { SEEDED_SCENARIOS } = await import("../lib/clinical-trial-chaos");
    const seeded = new Set(SEEDED_SCENARIOS.map((s) => s.subjectLabel));
    for (let i = 0; i < 5; i++) {
      expect(seeded.has(generateClinicalSubject().subjectLabel)).toBe(false);
    }
  });
});
