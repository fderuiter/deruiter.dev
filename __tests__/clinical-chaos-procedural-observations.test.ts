// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  MOCK_OBSERVATION_TEMPLATES,
  PROCEDURAL_OBSERVATION_SHARE,
  SEEDED_SCENARIOS,
  generateClinicalSubject,
  generateProceduralObservation,
  generateSDTMDataset,
  getObservationChoices,
  getProceduralErrorKinds,
  getProceduralFields,
  hasProceduralGenerator,
  validateObservationChoice,
  type ClinicalObservation,
  type ProceduralErrorKind,
} from "@/lib/clinical-trial-chaos";
import { createSeededRandom } from "@/lib/game-utils";

// #2088: the fix quiz repeated, because every flagged value came from a fixed
// list of authored corruptions. Generators now draw a true value and derive
// the raw entry, answer, distractors and explanation from it.

const generate = (
  field: string,
  kind: ProceduralErrorKind,
  seed: number
): ClinicalObservation => {
  const obs = generateProceduralObservation({
    field,
    kind,
    random: createSeededRandom(seed),
    id: `obs-${seed}`,
  });
  if (!obs) throw new Error(`no generator for ${field}/${kind}`);
  return obs;
};

const CASES = getProceduralFields().flatMap((field) =>
  getProceduralErrorKinds(field).map((kind) => [field, kind] as const)
);

const NUMERIC = /^\d+(\.\d+)? \S+$/;
const DATE = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})$/;

describe("procedural observation generators (#2088)", () => {
  it("covers the VS, LB, DM and AE domains and every error kind", () => {
    const domains = new Set(
      CASES.map(([field, kind]) => generate(field, kind, 1).destination)
    );
    expect([...domains].sort()).toEqual(["AE", "DM", "LB", "VS"]);
    const kinds = new Set(CASES.map(([, kind]) => kind));
    expect([...kinds].sort()).toEqual([
      "date-transposition",
      "decimal-shift",
      "impossible-date",
      "range-outlier",
      "unit-error",
    ]);
  });

  it.each(CASES)(
    "%s / %s: one correct choice, three plausible distractors, over 200 seeds",
    (field, kind) => {
      for (let seed = 1; seed <= 200; seed++) {
        const obs = generate(field, kind, seed);
        const choices = getObservationChoices(obs);
        expect(choices).toHaveLength(4);
        const accepted = choices.filter(
          (c) => validateObservationChoice(obs, c).isValid
        );
        expect(accepted, `${obs.rawValue}: ${choices.join(" | ")}`).toEqual([
          obs.correctedValue,
        ]);
        expect(obs.rawValue).not.toBe(obs.correctedValue);
        const distractors = choices.filter((c) => c !== obs.correctedValue);
        for (const d of distractors) {
          expect(d.toLowerCase()).not.toBe(obs.correctedValue?.toLowerCase());
          expect(d).toMatch(obs.field.includes("Date") ? DATE : NUMERIC);
          if (NUMERIC.test(d)) expect(parseFloat(d)).toBeGreaterThan(0);
        }
      }
    }
  );

  it("shows different values and options for the same error kind under different seeds", () => {
    for (const [field, kind] of CASES) {
      const a = generate(field, kind, 11);
      const runs = [12, 13, 14, 15].map((seed) => generate(field, kind, seed));
      expect(
        runs.some(
          (b) =>
            b.rawValue !== a.rawValue &&
            b.options?.join("|") !== a.options?.join("|")
        ),
        `${field}/${kind}`
      ).toBe(true);
    }
  });

  it("repeats exactly for the same seed", () => {
    for (const [field, kind] of CASES) {
      expect(generate(field, kind, 77)).toEqual(generate(field, kind, 77));
    }
  });

  it("builds the explanation from the error kind and the true value", () => {
    const unit = generate("Height", "unit-error", 3);
    expect(unit.explanation).toBe(
      `${unit.rawValue} is a unit error; SDTM records height in cm, so the reading is ${unit.correctedValue}.`
    );
    expect(unit.rawValue).toBe(unit.correctedValue?.replace(" cm", " m"));
    expect(unit.astRule?.queryMessage).toBe(unit.explanation);

    const shift = generate("Weight", "decimal-shift", 3);
    expect(parseFloat(shift.rawValue) * 10).toBeCloseTo(
      parseFloat(shift.correctedValue ?? ""),
      6
    );
    expect(shift.errorType).toBe("decimal-shift");

    const outlier = generate("Serum Creatinine", "range-outlier", 3);
    expect(parseFloat(outlier.rawValue)).toBeCloseTo(
      parseFloat(outlier.correctedValue ?? "") * 100,
      6
    );
    expect(outlier.explanation).toContain("2 stray zeros");
  });

  it("derives a converted answer from the value the site wrote", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const obs = generate("Weight", "unit-error", seed);
      const lb = parseFloat(obs.rawValue);
      expect(obs.rawValue.endsWith(" lb")).toBe(true);
      expect(obs.correctedValue).toBe(`${(lb * 0.453592).toFixed(1)} kg`);
      const glucose = generate("Fasting Glucose", "unit-error", seed);
      const mmol = parseFloat(glucose.rawValue);
      expect(glucose.correctedValue).toBe(`${Math.round(mmol * 18.016)} mg/dL`);
    }
  });

  it("reads US dates and swapped ISO dates back to one ISO 8601 answer", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const us = generate("Date of Birth", "date-transposition", seed);
      const [mm, dd, yyyy] = us.rawValue.split("/");
      expect(us.correctedValue).toBe(`${yyyy}-${mm}-${dd}`);
      expect(Number(dd)).toBeGreaterThan(12);

      const swapped = generate("AE Start Date", "impossible-date", seed);
      const [y, badMonth, day] = swapped.rawValue.split("-");
      expect(Number(badMonth)).toBeGreaterThan(12);
      expect(swapped.correctedValue).toBe(`${y}-${day}-${badMonth}`);
      expect(Number(y)).toBeGreaterThanOrEqual(2025);
    }
  });

  it("returns null for a field or kind no generator expresses", () => {
    const random = createSeededRandom(1);
    expect(hasProceduralGenerator("Adverse Event Term")).toBe(false);
    expect(getProceduralErrorKinds("Adverse Event Term")).toEqual([]);
    expect(
      generateProceduralObservation({
        field: "Adverse Event Term",
        random,
        id: "x",
      })
    ).toBeNull();
    expect(
      generateProceduralObservation({
        field: "Heart Rate",
        kind: "unit-error",
        random,
        id: "x",
      })
    ).toBeNull();
    expect(
      generateProceduralObservation({
        field: "Height",
        kind: "impossible-date",
        random,
        id: "x",
      })
    ).toBeNull();
  });

  it("draws a kind when none is requested and files numeric results in SDTM", () => {
    const obs = generateProceduralObservation({
      field: "Systolic BP",
      random: createSeededRandom(5),
      id: "obs-5",
    });
    expect(obs?.astRule?.id).toBe("ast_rule_obs-5");
    expect(["unit-error", "decimal-shift", "range-outlier"]).toContain(
      obs?.errorType
    );
    const [row] = generateSDTMDataset([
      {
        id: "s",
        subjectLabel: "SUBJ-9",
        studySite: "Site 014 (Boston General)",
        observations: [{ ...obs!, currentValue: obs!.correctedValue! }],
        status: "queued",
        timeRemaining: 30,
        maxTime: 30,
        createdAt: 0,
      },
    ]);
    expect(row.STRESU).toBe("mmHg");
    expect(row.TESTCD).toBe("C25298");
  });
});

describe("generateClinicalSubject with an injected random source (#2088)", () => {
  const domains = ["DM", "VS", "AE", "LB"] as const;

  it("repeats a subject for the same seed and varies it across seeds", () => {
    const strip = (seed: number) =>
      generateClinicalSubject(
        1,
        false,
        4100,
        [...domains],
        createSeededRandom(seed)
      ).observations;
    expect(strip(8)).toEqual(strip(8));
    const values = new Set(
      [1, 2, 3, 4, 5, 6].map((seed) =>
        strip(seed)
          .map((o) => o.rawValue)
          .join("|")
      )
    );
    expect(values.size).toBeGreaterThan(3);
  });

  it("generates most flagged generator fields and keeps every one solvable", () => {
    let generated = 0;
    let authored = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const subject = generateClinicalSubject(
        1,
        seed % 5 === 0,
        5000 + seed,
        [...domains],
        createSeededRandom(seed)
      );
      for (const obs of subject.observations) {
        const choices = getObservationChoices(obs);
        const accepted = choices.filter(
          (c) => validateObservationChoice(obs, c).isValid
        );
        expect(accepted, `${obs.field}: ${choices.join(" | ")}`).toHaveLength(
          1
        );
        if (!hasProceduralGenerator(obs.field)) continue;
        const template = MOCK_OBSERVATION_TEMPLATES.find(
          (t) => t.field === obs.field
        );
        const isAuthored = template?.corruptions.some(
          (c) => c.rawValue === obs.rawValue
        );
        if (isAuthored) authored++;
        else generated++;
      }
    }
    const share = generated / (generated + authored);
    expect(authored).toBeGreaterThan(0);
    expect(share).toBeGreaterThan(PROCEDURAL_OBSERVATION_SHARE - 0.1);
    expect(share).toBeLessThan(PROCEDURAL_OBSERVATION_SHARE + 0.15);
  });

  it("only ever generates fields that have a template, so each has a station", () => {
    for (const field of getProceduralFields()) {
      expect(
        MOCK_OBSERVATION_TEMPLATES.some((t) => t.field === field),
        field
      ).toBe(true);
    }
  });

  it("leaves the seeded scenarios SUBJ-1001 to 1003 unchanged", () => {
    expect(SEEDED_SCENARIOS.map((s) => s.subjectLabel)).toEqual([
      "SUBJ-1001",
      "SUBJ-1002",
      "SUBJ-1003",
    ]);
    const height = SEEDED_SCENARIOS[0].observations.find(
      (o) => o.field === "Height"
    );
    expect(height?.rawValue).toBe("180 m");
    expect(height?.correctedValue).toBe("180 cm");
  });
});
