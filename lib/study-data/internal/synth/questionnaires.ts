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
});
