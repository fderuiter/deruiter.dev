// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  generateClinicalSubjectFromProtocol,
  getObservationChoices,
  getStationsForPhase,
  validateObservationChoice,
  type CDISCDomain,
  type ClinicalObservation,
} from "@/lib/clinical-trial-chaos";
import {
  STUDY_PRESETS,
  type EditCheckRule,
  type StudyProtocol,
} from "@/lib/crf";

// #1150: with a CRF Studio protocol loaded, generated observations were
// answer-keyed to authored edit checks (cross-field, threshold or query
// conditions) that no offered choice could satisfy, and forms whose domain
// had no station produced packets with nowhere to route.

const STATION_SETS: [string, CDISCDomain[]][] = [
  ["phase 1", getStationsForPhase(1, "campaign").map((s) => s.id)],
  ["phase 2", getStationsForPhase(2, "campaign").map((s) => s.id)],
  ["endless", getStationsForPhase(1, "endless").map((s) => s.id)],
];

describe("Clinical Trial Chaos protocol observations (#1150)", () => {
  for (const preset of STUDY_PRESETS) {
    for (const [label, domains] of STATION_SETS) {
      it(`${preset.id} (${label}): every flagged field has exactly one accepted choice and a live station`, () => {
        for (let i = 0; i < 5; i++) {
          const subject = generateClinicalSubjectFromProtocol(
            preset.study,
            1,
            false,
            9000 + i,
            domains
          );
          expect(subject.observations.length).toBeGreaterThan(0);
          for (const obs of subject.observations) {
            expect(domains).toContain(obs.destination);
            expect(obs.isResolved).toBe(false);
            const choices = getObservationChoices(obs);
            const accepted = choices.filter(
              (c) => validateObservationChoice(obs, c, preset.study).isValid
            );
            expect(
              accepted,
              `${obs.field}: ${choices.join(" | ")}`
            ).toHaveLength(1);
            expect(accepted[0]).toBe(obs.correctedValue);
          }
        }
      });
    }
  }

  it("rejects the raw entry with field-specific feedback, then accepts a retry", () => {
    const study = STUDY_PRESETS[0].study;
    const obs = generateClinicalSubjectFromProtocol(study, 1, false, 9100)
      .observations[0];
    const rejected = validateObservationChoice(obs, obs.rawValue, study);
    expect(rejected.isValid).toBe(false);
    expect(rejected.observation.isResolved).toBe(false);
    expect(rejected.explanation).toContain(obs.field);

    const accepted = validateObservationChoice(
      rejected.observation,
      obs.correctedValue!,
      study
    );
    expect(accepted.isValid).toBe(true);
    expect(accepted.observation.isResolved).toBe(true);
    expect(accepted.observation.currentValue).toBe(obs.correctedValue);
  });

  const bmiRule: EditCheckRule = {
    id: "bmi",
    name: "Automated BMI Derivation",
    description: "BMI from height and weight",
    triggerFieldIds: ["f_height", "f_weight"],
    actionType: "set_value",
    targetFieldId: "f_bmi",
    conditions: [
      { fieldId: "f_height", operator: "gt", value: 0 },
      { fieldId: "f_weight", operator: "gt", value: 0 },
    ],
    logicalOperator: "AND",
  };
  const heightObs: ClinicalObservation = {
    id: "obs-h",
    field: "Height",
    fieldId: "f_height",
    rawValue: "180 m",
    correctedValue: "180 cm",
    currentValue: "180 m",
    destination: "DM",
    isResolved: false,
  };

  it("ignores an authored protocol rule that also reads other fields", () => {
    const protocol = fromPartial<StudyProtocol>({
      forms: [],
      rules: [bmiRule],
    });
    expect(
      validateObservationChoice(heightObs, "180 cm", protocol).isValid
    ).toBe(true);
    expect(
      validateObservationChoice(heightObs, "1.80 m", protocol).isValid
    ).toBe(false);
  });

  it("prefers the observation's own rule over a matching protocol rule", () => {
    const ownRule: EditCheckRule = {
      ...bmiRule,
      id: "own",
      name: "Height rule",
      triggerFieldIds: ["f_height"],
      targetFieldId: "f_height",
      conditions: [{ fieldId: "f_height", operator: "eq", value: "180 cm" }],
    };
    const protocol = fromPartial<StudyProtocol>({
      forms: [],
      rules: [
        {
          ...ownRule,
          id: "p",
          conditions: [{ fieldId: "f_height", operator: "eq", value: "999" }],
        },
      ],
    });
    const obs = { ...heightObs, astRule: ownRule };
    expect(validateObservationChoice(obs, "180 cm", protocol).isValid).toBe(
      true
    );
  });

  it("offers fallback choices when the option list is empty", () => {
    expect(
      [...getObservationChoices({ ...heightObs, options: [] })].sort()
    ).toEqual(["180 cm", "180 m"]);
    expect(
      getObservationChoices({
        ...heightObs,
        correctedValue: undefined,
        options: undefined,
      })
    ).toEqual(["180 m"]);
  });

  // #1305: every option list put the correct value first, so pressing 1
  // always won.
  describe("choice order (#1305)", () => {
    const study = STUDY_PRESETS[0].study;
    const domains = getStationsForPhase(2, "campaign").map((s) => s.id);
    const observations = Array.from({ length: 40 }, (_, i) =>
      generateClinicalSubjectFromProtocol(study, 1, false, 5000 + i, domains)
    ).flatMap((subject) => subject.observations);

    it("does not always put the correct value first", () => {
      const withChoice = observations.filter(
        (obs) => getObservationChoices(obs).length > 1
      );
      expect(withChoice.length).toBeGreaterThan(20);
      const firstIsCorrect = withChoice.filter(
        (obs) => getObservationChoices(obs)[0] === obs.correctedValue
      ).length;
      // A fair shuffle puts it first about 1/n of the time; allow slack.
      expect(firstIsCorrect / withChoice.length).toBeLessThan(0.7);
    });

    it("keeps one observation's order stable between calls", () => {
      for (const obs of observations.slice(0, 10)) {
        expect(getObservationChoices({ ...obs })).toEqual(
          getObservationChoices(obs)
        );
      }
    });

    it("still offers every option exactly once", () => {
      for (const obs of observations) {
        const choices = getObservationChoices(obs);
        expect(new Set(choices).size).toBe(choices.length);
        if (obs.correctedValue) expect(choices).toContain(obs.correctedValue);
      }
    });
  });
});
