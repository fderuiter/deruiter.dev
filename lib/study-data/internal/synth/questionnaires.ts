/**
 * The questionnaire scores the synthetic generator models (#3418), by their
 * QS test short name. The handoff tabulates a QS concept only when its test
 * is here, and the generator draws each score from its entry. VSFS is a
 * fictional instrument, scored 0 to 100 with higher better.
 */
export interface QuestionnaireScore {
  /** `QSTEST`. */
  readonly testName: string;
  /** `QSCAT`: the questionnaire the score belongs to. */
  readonly category: string;
  /** The score's range. */
  readonly min: number;
  readonly max: number;
  /** A subject's baseline is drawn from `baseline` plus or minus `spread`. */
  readonly baseline: number;
  readonly spread: number;
  /** The mean improvement once recovered from the procedure. */
  readonly gain: number;
  /** Days after which the full gain is reached. */
  readonly recoveryDays: number;
  /** Visit-to-visit noise, plus or minus. */
  readonly noise: number;
}

export const QUESTIONNAIRE_SCORES: Readonly<
  Record<string, QuestionnaireScore>
> = Object.freeze({
  VSFSOS: {
    testName: "VSFS Overall Summary Score",
    category: "VSFS",
    min: 0,
    max: 100,
    baseline: 52,
    spread: 14,
    gain: 20,
    recoveryDays: 30,
    noise: 6,
  },
  "PHQ-9": {
    testName: "PHQ-9 Total Score",
    category: "PHQ-9",
    min: 0,
    max: 27,
    baseline: 15,
    spread: 5,
    gain: -6,
    recoveryDays: 28,
    noise: 2,
  },
  PHQ01TS: {
    testName: "PHQ-9 Total Score",
    category: "PHQ-9",
    min: 0,
    max: 27,
    baseline: 15,
    spread: 5,
    gain: -6,
    recoveryDays: 28,
    noise: 2,
  },
  PHQ0101: {
    testName: "PHQ-9 Little Interest or Pleasure",
    category: "PHQ-9",
    min: 0,
    max: 3,
    baseline: 2,
    spread: 1,
    gain: -1,
    recoveryDays: 28,
    noise: 1,
  },
  PHQ0102: {
    testName: "PHQ-9 Feeling Down or Hopeless",
    category: "PHQ-9",
    min: 0,
    max: 3,
    baseline: 2,
    spread: 1,
    gain: -1,
    recoveryDays: 28,
    noise: 1,
  },
  PHQ0103: {
    testName: "PHQ-9 Trouble Sleeping",
    category: "PHQ-9",
    min: 0,
    max: 3,
    baseline: 2,
    spread: 1,
    gain: -1,
    recoveryDays: 28,
    noise: 1,
  },
  PHQ0104: {
    testName: "PHQ-9 Feeling Tired or Little Energy",
    category: "PHQ-9",
    min: 0,
    max: 3,
    baseline: 2,
    spread: 1,
    gain: -1,
    recoveryDays: 28,
    noise: 1,
  },
  MMSE: {
    testName: "MMSE Total Score",
    category: "MMSE",
    min: 0,
    max: 30,
    baseline: 22,
    spread: 4,
    gain: 2,
    recoveryDays: 90,
    noise: 1,
  },
  MMSETS: {
    testName: "MMSE Total Score",
    category: "MMSE",
    min: 0,
    max: 30,
    baseline: 22,
    spread: 4,
    gain: 2,
    recoveryDays: 90,
    noise: 1,
  },
  MMSEORNT: {
    testName: "MMSE Orientation",
    category: "MMSE",
    min: 0,
    max: 10,
    baseline: 7,
    spread: 2,
    gain: 1,
    recoveryDays: 90,
    noise: 1,
  },
  MMSEREG: {
    testName: "MMSE Registration",
    category: "MMSE",
    min: 0,
    max: 3,
    baseline: 2,
    spread: 1,
    gain: 0,
    recoveryDays: 90,
    noise: 1,
  },
  MMSEATTN: {
    testName: "MMSE Attention and Calculation",
    category: "MMSE",
    min: 0,
    max: 5,
    baseline: 3,
    spread: 1,
    gain: 1,
    recoveryDays: 90,
    noise: 1,
  },
  MMSEREC: {
    testName: "MMSE Delayed Recall",
    category: "MMSE",
    min: 0,
    max: 3,
    baseline: 2,
    spread: 1,
    gain: 0,
    recoveryDays: 90,
    noise: 1,
  },
  MMSELANG: {
    testName: "MMSE Language and Praxis",
    category: "MMSE",
    min: 0,
    max: 9,
    baseline: 7,
    spread: 1,
    gain: 0,
    recoveryDays: 90,
    noise: 1,
  },
});
