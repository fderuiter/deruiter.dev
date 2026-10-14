/**
 * Procedural observation generators (#2088).
 *
 * The authored corruption templates in `scenarios.ts` repeat: by the third
 * run a player has memorised that "180 m" is fixed by "180 cm". These
 * generators draw a plausible true value for a field from a range, apply one
 * kind of data-entry error to it, and derive the correct answer, the
 * distractors and the explanation from the true value and the error kind.
 * Each observation carries an AST rule that accepts only the correct value,
 * so `validateObservationChoice` grades it without a lookup table.
 *
 * Every function takes its random source as an argument, so tests and a
 * future daily seed can fix the draw. Values come from rules, never from
 * generated text.
 */

import { clamp } from "../game-utils";
import type { EditCheckRule } from "../crf/types";
import type {
  CDISCDomain,
  ClinicalObservation,
  ValidationErrorType,
} from "./types";

/** The kinds of data-entry error a generator can apply to a true value. */
export type ProceduralErrorKind =
  | "unit-error"
  | "decimal-shift"
  | "range-outlier"
  | "date-transposition"
  | "impossible-date";

/**
 * Share of flagged observations on a field with a generator that are
 * generated rather than drawn from the authored templates. The rest keep the
 * authored puzzles (imperial heights, negative values) in the rotation.
 */
export const PROCEDURAL_OBSERVATION_SHARE = 0.75;

/** A unit conversion from a non-standard unit into the SDTM standard unit. */
interface UnitConversion {
  unit: string;
  /** Decimal places the site would write in the non-standard unit. */
  decimals: number;
  toStandard: (value: number) => number;
  fromStandard: (value: number) => number;
  /** Plain-English formula for the explanation, e.g. "× 0.4536". */
  formula: string;
}

interface NumericSpec {
  type: "numeric";
  field: string;
  /** Lower-case noun used in explanations ("height"). */
  noun: string;
  destination: CDISCDomain;
  ctCode: string;
  unit: string;
  decimals: number;
  /** Plausible true values, in standard units. */
  min: number;
  max: number;
  /** A unit-error either relabels the number or records it in another unit. */
  mislabelUnit?: string;
  conversion?: UnitConversion;
  /** Factor of a stray-zero outlier (10 or 100); absent if no outlier is impossible. */
  outlierFactor?: number;
  /** Physiological upper limit quoted when explaining an outlier. */
  upperLimit: number;
  /** Physiological lower limit quoted when explaining a decimal shift. */
  lowerLimit: number;
}

interface DateSpec {
  type: "date";
  field: string;
  noun: string;
  destination: CDISCDomain;
  ctCode: string;
  minYear: number;
  maxYear: number;
}

type ObservationSpec = NumericSpec | DateSpec;

const SPECS: readonly ObservationSpec[] = [
  {
    type: "numeric",
    field: "Height",
    noun: "height",
    destination: "VS",
    ctCode: "C25473",
    unit: "cm",
    decimals: 0,
    min: 150,
    max: 195,
    mislabelUnit: "m",
    outlierFactor: 10,
    upperLimit: 272,
    lowerLimit: 45,
  },
  {
    type: "numeric",
    field: "Weight",
    noun: "weight",
    destination: "VS",
    ctCode: "C25208",
    unit: "kg",
    decimals: 1,
    min: 50,
    max: 110,
    conversion: {
      unit: "lb",
      decimals: 0,
      toStandard: (lb) => lb * 0.453592,
      fromStandard: (kg) => kg / 0.453592,
      formula: "× 0.4536",
    },
    outlierFactor: 10,
    upperLimit: 300,
    lowerLimit: 20,
  },
  {
    type: "numeric",
    field: "Systolic BP",
    noun: "systolic pressure",
    destination: "VS",
    ctCode: "C25298",
    unit: "mmHg",
    decimals: 0,
    min: 100,
    max: 150,
    conversion: {
      unit: "kPa",
      decimals: 1,
      toStandard: (kpa) => kpa * 7.50062,
      fromStandard: (mmHg) => mmHg / 7.50062,
      formula: "× 7.5006",
    },
    outlierFactor: 10,
    upperLimit: 300,
    lowerLimit: 50,
  },
  {
    type: "numeric",
    field: "Heart Rate",
    noun: "heart rate",
    destination: "VS",
    ctCode: "C49673",
    unit: "bpm",
    decimals: 0,
    min: 55,
    max: 95,
    outlierFactor: 10,
    upperLimit: 300,
    lowerLimit: 20,
  },
  {
    type: "numeric",
    field: "Body Temp",
    noun: "body temperature",
    destination: "VS",
    ctCode: "C25206",
    unit: "°C",
    decimals: 1,
    min: 36.1,
    max: 37.8,
    conversion: {
      unit: "°F",
      decimals: 1,
      toStandard: (f) => ((f - 32) * 5) / 9,
      fromStandard: (c) => (c * 9) / 5 + 32,
      formula: "(°F − 32) × 5/9",
    },
    outlierFactor: 10,
    upperLimit: 45,
    lowerLimit: 25,
  },
  {
    type: "numeric",
    field: "Serum Creatinine",
    noun: "serum creatinine",
    destination: "LB",
    ctCode: "C25347",
    unit: "mg/dL",
    decimals: 1,
    min: 0.6,
    max: 1.3,
    conversion: {
      unit: "µmol/L",
      decimals: 0,
      toStandard: (umol) => umol / 88.42,
      fromStandard: (mg) => mg * 88.42,
      formula: "÷ 88.42",
    },
    // A 10x creatinine (9 mg/dL) is renal failure, not a typo, so the stray
    // keystroke is 100x.
    outlierFactor: 100,
    upperLimit: 25,
    lowerLimit: 0.2,
  },
  {
    type: "numeric",
    field: "Fasting Glucose",
    noun: "fasting glucose",
    destination: "LB",
    ctCode: "C105585",
    unit: "mg/dL",
    decimals: 0,
    min: 70,
    max: 99,
    conversion: {
      unit: "mmol/L",
      decimals: 1,
      toStandard: (mmol) => mmol * 18.016,
      fromStandard: (mg) => mg / 18.016,
      formula: "× 18.016",
    },
    // 10x fasting glucose (700+ mg/dL) can be a real crisis value, so no outlier.
    upperLimit: 1000,
    lowerLimit: 20,
  },
  {
    type: "date",
    field: "Date of Birth",
    noun: "date of birth",
    destination: "DM",
    ctCode: "ISO8601",
    minYear: 1950,
    maxYear: 2005,
  },
  {
    type: "date",
    field: "AE Start Date",
    noun: "adverse event start date",
    destination: "AE",
    ctCode: "ISO8601",
    minYear: 2025,
    maxYear: 2026,
  },
];

const SPEC_BY_FIELD = new Map(SPECS.map((spec) => [spec.field, spec]));

function kindsFor(spec: ObservationSpec): ProceduralErrorKind[] {
  if (spec.type === "date") return ["date-transposition", "impossible-date"];
  const kinds: ProceduralErrorKind[] = ["decimal-shift"];
  if (spec.mislabelUnit || spec.conversion) kinds.unshift("unit-error");
  if (spec.outlierFactor) kinds.push("range-outlier");
  return kinds;
}

/** Fields a generator can produce observations for. */
export function getProceduralFields(): string[] {
  return SPECS.map((spec) => spec.field);
}

/** The error kinds the generator for `field` can apply; empty when it has none. */
export function getProceduralErrorKinds(field: string): ProceduralErrorKind[] {
  const spec = SPEC_BY_FIELD.get(field);
  return spec ? kindsFor(spec) : [];
}

/** Whether `field` has a procedural generator. */
export function hasProceduralGenerator(field: string): boolean {
  return SPEC_BY_FIELD.has(field);
}

// ----------------------------------------------------------------------------
// Draw and formatting helpers
// ----------------------------------------------------------------------------

/** An integer in [min, max], inclusive. */
function drawInt(random: () => number, min: number, max: number): number {
  const r = clamp(random(), 0, 0.999999999);
  return min + Math.floor(r * (max - min + 1));
}

/** Fisher-Yates shuffle of a copy, driven by `random`. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = drawInt(random, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Formats an integer count of 10^-decimals units, so 725 with 1 decimal is
 * "72.5" and with -1 decimals is "7250". Integer arithmetic keeps decimal
 * shifts exact.
 */
function formatScaled(scaled: number, decimals: number): string {
  if (decimals <= 0) return String(scaled * 10 ** -decimals);
  const digits = String(Math.abs(scaled)).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals);
  return `${scaled < 0 ? "-" : ""}${whole}.${frac}`;
}

function withUnit(value: string, unit: string): string {
  return `${value} ${unit}`;
}

/** The digits of a scaled value reversed, keeping its decimal places. */
function reversedDigits(scaled: number): number {
  return Number(String(scaled).split("").reverse().join(""));
}

function pickDistractors(
  correct: string,
  primary: readonly string[],
  fallback: readonly string[],
  random: () => number
): string[] {
  const seen = new Set([correct.trim().toLowerCase()]);
  const unique = (pool: readonly string[]) =>
    pool.filter((option) => {
      const key = option.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const chosen = shuffle(unique(primary), random).slice(0, 3);
  if (chosen.length < 3) {
    chosen.push(...unique(fallback).slice(0, 3 - chosen.length));
  }
  return chosen;
}

interface Draft {
  rawValue: string;
  correctedValue: string;
  errorType: ValidationErrorType;
  hint: string;
  explanation: string;
  distractors: string[];
}

function draftNumeric(
  spec: NumericSpec,
  kind: ProceduralErrorKind,
  random: () => number
): Draft {
  const d = spec.decimals;
  const scale = 10 ** d;
  const trueScaled = drawInt(
    random,
    Math.round(spec.min * scale),
    Math.round(spec.max * scale)
  );
  let correctScaled = trueScaled;
  const fmt = (scaled: number, decimals = d) =>
    withUnit(formatScaled(scaled, decimals), spec.unit);

  // Shapes of the true value a hurried reader might pick instead.
  const tenthOf = (scaled: number) => fmt(scaled, d + 1);
  const tenTimes = (scaled: number) => fmt(scaled, d - 1);
  const fallback = (scaled: number) => [
    fmt(scaled, d + 2),
    fmt(scaled, d - 2),
    fmt(scaled + scale),
  ];

  if (kind === "unit-error" && spec.conversion) {
    const conv = spec.conversion;
    const altScale = 10 ** conv.decimals;
    const altScaled = Math.round(
      conv.fromStandard(trueScaled / scale) * altScale
    );
    const altValue = altScaled / altScale;
    // The answer is derived from what the site wrote, not the hidden draw.
    correctScaled = Math.round(conv.toStandard(altValue) * scale);
    const rawValue = withUnit(
      formatScaled(altScaled, conv.decimals),
      conv.unit
    );
    const correctedValue = fmt(correctScaled);
    // Converting the wrong way is a common slip; offer it only when it
    // still reads as a measurement rather than as zero or a huge number.
    const backwards = Math.round(conv.fromStandard(altValue) * scale);
    const backwardsPlausible =
      backwards / scale >= spec.lowerLimit / 10 &&
      backwards / scale < spec.upperLimit * 10;
    return {
      rawValue,
      correctedValue,
      errorType: "unit-error",
      hint: `Unit error: recorded in ${conv.unit}, SDTM expects ${spec.unit}`,
      explanation: `${rawValue} is a unit error; SDTM records ${spec.noun} in ${spec.unit}. Converting ${conv.unit} to ${spec.unit} (${conv.formula}) gives ${correctedValue}.`,
      distractors: pickDistractors(
        correctedValue,
        [
          withUnit(formatScaled(altScaled, conv.decimals), spec.unit),
          ...(backwardsPlausible ? [fmt(backwards)] : []),
          withUnit(formatScaled(correctScaled, d), conv.unit),
          tenTimes(correctScaled),
        ],
        fallback(correctScaled),
        random
      ),
    };
  }

  const correctedValue = fmt(correctScaled);
  const nearMiss = fmt(reversedDigits(correctScaled));

  if (kind === "unit-error" && spec.mislabelUnit) {
    const rawValue = withUnit(
      formatScaled(correctScaled, d),
      spec.mislabelUnit
    );
    return {
      rawValue,
      correctedValue,
      errorType: "unit-error",
      hint: `Unit error: ${spec.mislabelUnit} recorded, SDTM expects ${spec.unit}`,
      explanation: `${rawValue} is a unit error; SDTM records ${spec.noun} in ${spec.unit}, so the reading is ${correctedValue}.`,
      distractors: pickDistractors(
        correctedValue,
        [
          tenthOf(correctScaled),
          tenTimes(correctScaled),
          withUnit(formatScaled(correctScaled, d), "in"),
          rawValue,
        ],
        fallback(correctScaled),
        random
      ),
    };
  }

  if (kind === "range-outlier" && spec.outlierFactor) {
    const zeros = Math.round(Math.log10(spec.outlierFactor));
    const rawValue = fmt(correctScaled, d - zeros);
    const label = zeros === 1 ? "a stray zero" : `${zeros} stray zeros`;
    return {
      rawValue,
      correctedValue,
      errorType: "range-outlier",
      hint: `Out of range: above the ${spec.upperLimit} ${spec.unit} physiological limit`,
      explanation: `${rawValue} is out of range; no ${spec.noun} exceeds ${spec.upperLimit} ${spec.unit}. Removing ${label} gives ${correctedValue}.`,
      distractors: pickDistractors(
        correctedValue,
        [rawValue, tenTimes(correctScaled), tenthOf(correctScaled), nearMiss],
        fallback(correctScaled),
        random
      ),
    };
  }

  // decimal-shift: the decimal point slipped one place left.
  const rawValue = tenthOf(correctScaled);
  return {
    rawValue,
    correctedValue,
    errorType: "decimal-shift",
    hint: `Decimal shift: below the ${spec.lowerLimit} ${spec.unit} physiological limit`,
    explanation: `${rawValue} is a decimal shift; no ${spec.noun} is below ${spec.lowerLimit} ${spec.unit}. Moving the decimal point one place right gives ${correctedValue}.`,
    distractors: pickDistractors(
      correctedValue,
      [rawValue, tenTimes(correctScaled), nearMiss],
      fallback(correctScaled),
      random
    ),
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function draftDate(
  spec: DateSpec,
  kind: ProceduralErrorKind,
  random: () => number
): Draft {
  const year = drawInt(random, spec.minYear, spec.maxYear);
  const month = drawInt(random, 1, 12);
  // Days 13 to 28 exist in every month and can never be read as a month, so
  // each raw entry has exactly one ISO reading.
  const day = drawInt(random, 13, 28);
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const swappedIso = `${year}-${pad2(day)}-${pad2(month)}`;
  const us = `${pad2(month)}/${pad2(day)}/${year}`;
  const european = `${pad2(day)}-${pad2(month)}-${year}`;

  if (kind === "impossible-date") {
    return {
      rawValue: swappedIso,
      correctedValue: iso,
      errorType: "invalid-date",
      hint: `Impossible date: month ${day} does not exist (ISO 8601 YYYY-MM-DD)`,
      explanation: `${swappedIso} is an impossible date; there is no month ${day}, so day and month were swapped. ISO 8601 YYYY-MM-DD gives ${iso}.`,
      distractors: pickDistractors(
        iso,
        [swappedIso, us, european],
        [`${year + 1}-${pad2(month)}-${pad2(day)}`],
        random
      ),
    };
  }

  return {
    rawValue: us,
    correctedValue: iso,
    errorType: "invalid-date",
    hint: "US MM/DD/YYYY entry (ISO 8601 YYYY-MM-DD required)",
    explanation: `${us} is a date transposition; it is month ${month}, day ${day} in US order. SDTM records the ${spec.noun} as ISO 8601 YYYY-MM-DD: ${iso}.`,
    distractors: pickDistractors(
      iso,
      [swappedIso, european, us],
      [`${year + 1}-${pad2(month)}-${pad2(day)}`],
      random
    ),
  };
}

/** What to generate, and where the result is filed. */
export interface ProceduralObservationRequest {
  /** Field name; see {@link getProceduralFields}. */
  field: string;
  /** Random source returning values in [0, 1). */
  random: () => number;
  /** Observation id. */
  id: string;
  /** Rule id; defaults to `ast_rule_<id>`. */
  ruleId?: string;
  /** Error kind to apply; drawn from the field's kinds when omitted. */
  kind?: ProceduralErrorKind;
}

/**
 * Generates a flagged observation for `field`: a plausible true value with
 * one data-entry error applied. The options hold the correct value and three
 * distractors derived from the same true value, and the AST rule accepts
 * only the correct value. Returns `null` when the field has no generator or
 * the requested kind does not apply to it.
 */
export function generateProceduralObservation(
  request: ProceduralObservationRequest
): ClinicalObservation | null {
  const spec = SPEC_BY_FIELD.get(request.field);
  if (!spec) return null;
  const kinds = kindsFor(spec);
  const kind =
    request.kind ?? kinds[drawInt(request.random, 0, kinds.length - 1)];
  if (!kinds.includes(kind)) return null;

  const draft =
    spec.type === "numeric"
      ? draftNumeric(spec, kind, request.random)
      : draftDate(spec, kind, request.random);

  const options = shuffle(
    [draft.correctedValue, ...draft.distractors],
    request.random
  );

  const astRule: EditCheckRule = {
    id: request.ruleId ?? `ast_rule_${request.id}`,
    name: `CDISC Standard ${spec.field} Rule`,
    description: draft.explanation,
    triggerFieldIds: [spec.field],
    actionType: "raise_query",
    targetFieldId: spec.field,
    conditions: [
      { fieldId: spec.field, operator: "eq", value: draft.correctedValue },
    ],
    logicalOperator: "AND",
    queryMessage: draft.explanation,
  };

  return {
    id: request.id,
    field: spec.field,
    rawValue: draft.rawValue,
    correctedValue: draft.correctedValue,
    currentValue: draft.rawValue,
    destination: spec.destination,
    errorType: draft.errorType,
    hint: draft.hint,
    explanation: draft.explanation,
    ctCode: spec.ctCode,
    options,
    isResolved: false,
    astRule,
  };
}
