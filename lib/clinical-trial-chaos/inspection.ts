/**
 * The FDA inspection as the campaign finale (#2089).
 *
 * After the last campaign phase locks, the auditor pulls a handful of the
 * run's locked CRFs and asks one timed question about each: which value was
 * corrected and why, where the signature is, or which station the record
 * went to. Every sponsor skeleton taken during the run adds one harder
 * question about that shortcut. The answers feed the BIMO report through
 * `buildInspectionReport`.
 *
 * Questions are templates filled from the run's own records, never generated
 * text. Every function is pure and takes its random source as an argument,
 * so the same records, seed and answers always give the same round.
 */

import { clamp } from "../game-utils";
import { fnv1a } from "../utils/prng";
import { ALL_STATIONS } from "./scenarios";
import {
  SPONSOR_REQUESTS,
  SkeletonDisposition,
  SponsorSkeleton,
} from "./sponsor";
import type {
  BIMOFinding,
  BIMOInspectionReport,
  CDISCDomain,
  ClinicalSubject,
  InspectionInterviewSummary,
  SignatureReason,
  ValidationErrorType,
} from "./types";

// --- Tuning -----------------------------------------------------------------

/** Fewest locked CRFs the auditor pulls. */
export const INSPECTION_MIN_RECORDS = 4;
/** Most locked CRFs the auditor pulls. */
export const INSPECTION_MAX_RECORDS = 6;
/** Seconds to answer a question about a locked CRF. */
export const INSPECTION_RECORD_SECONDS = 15;
/** Seconds to answer a question about a sponsor skeleton. */
export const INSPECTION_SKELETON_SECONDS = 25;
/** Seconds one "More time" press adds to the current question. */
export const INSPECTION_EXTENSION_SECONDS = 15;
/** Score each record question answered wrong or not at all costs. */
export const INSPECTION_MISS_PENALTY = 4;
/**
 * Missed record questions at which the inspector records the audit trail as
 * incomplete: one extra Major finding.
 */
export const INSPECTION_INCOMPLETE_TRAIL_MISSES = 3;

// --- Records ----------------------------------------------------------------

/** How a locked CRF was signed. */
export interface InspectionSignature {
  /**
   * `routine`: quick dispatch, logged without an e-signature dialog.
   * `signed`: the signature dialog. `fast-track`: the Fast-Track lifeline.
   */
  method: "routine" | "signed" | "fast-track";
  reason: SignatureReason;
  /** Signatures applied: 2 under a double-signature audit. */
  signatures: number;
}

/** One value the player corrected on a CRF. */
export interface InspectionCorrection {
  field: string;
  from: string;
  to: string;
  errorType?: ValidationErrorType;
}

/** What the audit trail holds about one locked CRF. */
export interface InspectionRecord {
  subjectId: string;
  subjectLabel: string;
  station: CDISCDomain;
  signature: InspectionSignature;
  corrections: InspectionCorrection[];
}

/**
 * The audit-trail record of a CRF at the moment it locks.
 *
 * @param subject - The CRF as it was locked.
 * @param station - The station it was routed to.
 * @param signature - How it was signed.
 * @returns The record the inspection can ask about.
 */
export function createInspectionRecord(
  subject: ClinicalSubject,
  station: CDISCDomain,
  signature: InspectionSignature
): InspectionRecord {
  return {
    subjectId: subject.id,
    subjectLabel: subject.subjectLabel,
    station,
    signature,
    corrections: subject.observations
      .filter(
        (obs) =>
          obs.correctedValue !== undefined &&
          obs.isResolved &&
          obs.currentValue !== obs.rawValue
      )
      .map((obs) => ({
        field: obs.field,
        from: obs.rawValue,
        to: obs.currentValue,
        errorType: obs.errorType,
      })),
  };
}

// --- Random source ----------------------------------------------------------

/**
 * The seed for a run's inspection, hashed from the run's own locked records,
 * so the same run always draws the same questions. Pass it to
 * `createSeededRandom` from `lib/game-utils`.
 *
 * @param records - The run's locked CRFs.
 * @returns A 32-bit seed.
 */
export function getInspectionSeed(
  records: readonly InspectionRecord[]
): number {
  return fnv1a(
    `inspection:${records
      .map((r) => `${r.subjectLabel}>${r.station}`)
      .join(",")}`
  );
}

function pickIndex(random: () => number, length: number): number {
  return clamp(Math.floor(random() * length), 0, length - 1);
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = pickIndex(random, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- Questions --------------------------------------------------------------

/** What an inspection question asks about. */
export type InspectionQuestionKind =
  "correction" | "signature" | "station" | "skeleton";

/**
 * What picking an option means: `correct` for a record question answered from
 * the audit trail, `wrong` otherwise; skeleton questions use the dispositions.
 */
export type InspectionOptionOutcome = "correct" | "wrong" | SkeletonDisposition;

export interface InspectionOption {
  id: string;
  label: string;
  outcome: InspectionOptionOutcome;
}

export interface InspectionQuestion {
  id: string;
  kind: InspectionQuestionKind;
  /** The CRF asked about; absent for a skeleton question. */
  subjectLabel?: string;
  /** Index into the run's skeletons, for a skeleton question. */
  skeletonIndex?: number;
  prompt: string;
  /** Exhibit shown with the question: the record line or the email. */
  exhibit: string;
  options: InspectionOption[];
  /** What the record actually shows, said after the answer. */
  answerNote: string;
  timeLimitSeconds: number;
}

/** The option picked for a question, or `null` when the timer ran out. */
export interface InspectionAnswer {
  questionId: string;
  optionId: string | null;
  outcome: InspectionOptionOutcome | "unanswered";
}

export interface InspectionRound {
  questions: InspectionQuestion[];
  answers: InspectionAnswer[];
  /** Index of the question being asked; equals `questions.length` when done. */
  current: number;
  /** Seconds left on the current question. */
  timeRemaining: number;
  /** False when the player turned the timer off (WCAG 2.2.1). */
  timerEnabled: boolean;
  /** True after an answer, until the player moves on. */
  awaitingNext: boolean;
}

const ERROR_REASONS: Readonly<Record<ValidationErrorType, string>> = {
  "unit-error": "it was entered in the wrong unit",
  "missing-digit": "a digit was missing",
  "decimal-shift": "the decimal point was shifted",
  "invalid-date": "the date was impossible",
  "negative-value": "a negative value is impossible there",
  "range-outlier": "it was outside the plausible range",
  "casing-mismatch": "it was not in controlled terminology",
  "unapproved-conmed": "the medication name was not WHO-Drug coded",
  "dose-calculation-error": "the dose was miscalculated",
  "disposition-date-mismatch": "the disposition date did not match",
};
const DEFAULT_REASON = "it failed its edit check";

function reasonFor(correction: InspectionCorrection): string {
  return correction.errorType
    ? ERROR_REASONS[correction.errorType]
    : DEFAULT_REASON;
}

function describeCorrection(c: InspectionCorrection, reason: string): string {
  return `${c.field}: ${c.from} → ${c.to}, because ${reason}`;
}

const SIGNATURE_REASONS: readonly SignatureReason[] = [
  "Intent to Submit",
  "Author Verification",
  "Protocol Compliance Review",
  "Urgent Safety Expedited",
];

function describeSignature(sig: InspectionSignature): string {
  if (sig.method === "routine") {
    return "A routine dispatch line in the audit trail: no e-signature was required";
  }
  if (sig.method === "fast-track") {
    return `The Fast-Track lifeline sign-off, reason "${sig.reason}"`;
  }
  if (sig.signatures > 1) {
    return `An author signature and a reviewer countersignature, reason "${sig.reason}"`;
  }
  return `An electronic signature in the signing dialog, reason "${sig.reason}"`;
}

function signatureVariants(): InspectionSignature[] {
  const variants: InspectionSignature[] = [
    { method: "routine", reason: "Intent to Submit", signatures: 0 },
  ];
  for (const reason of SIGNATURE_REASONS) {
    variants.push({ method: "signed", reason, signatures: 1 });
    variants.push({ method: "signed", reason, signatures: 2 });
  }
  variants.push({
    method: "fast-track",
    reason: "Intent to Submit",
    signatures: 1,
  });
  variants.push({
    method: "fast-track",
    reason: "Urgent Safety Expedited",
    signatures: 1,
  });
  return variants;
}

const STATION_NAMES: ReadonlyMap<CDISCDomain, string> = new Map(
  ALL_STATIONS.map((s) => [s.id, s.name])
);

function describeStation(domain: CDISCDomain): string {
  return `${domain} · ${STATION_NAMES.get(domain) ?? domain}`;
}

function withIds(
  questionId: string,
  options: Omit<InspectionOption, "id">[],
  random: () => number
): InspectionOption[] {
  return shuffle(options, random).map((opt, idx) => ({
    ...opt,
    id: `${questionId}-opt-${idx + 1}`,
  }));
}

function correctionQuestion(
  id: string,
  record: InspectionRecord,
  others: readonly InspectionRecord[],
  random: () => number
): InspectionQuestion {
  const asked =
    record.corrections[pickIndex(random, record.corrections.length)];
  const reason = reasonFor(asked);
  const answer = describeCorrection(asked, reason);
  const ownLabels = new Set(
    record.corrections.map((c) => `${c.field}|${c.from}|${c.to}`)
  );

  const wrongReasons = [...Object.values(ERROR_REASONS), DEFAULT_REASON].filter(
    (r) => r !== reason
  );
  const wrongReason = wrongReasons[pickIndex(random, wrongReasons.length)];

  const foreign = others
    .flatMap((r) => r.corrections)
    .filter((c) => !ownLabels.has(`${c.field}|${c.from}|${c.to}`));
  const foreignPick =
    foreign.length > 0 ? foreign[pickIndex(random, foreign.length)] : null;
  const decoy = foreignPick
    ? describeCorrection(foreignPick, reasonFor(foreignPick))
    : describeCorrection(
        { field: asked.field, from: asked.to, to: asked.from },
        reason
      );

  const options: Omit<InspectionOption, "id">[] = [
    { label: answer, outcome: "correct" },
    { label: describeCorrection(asked, wrongReason), outcome: "wrong" },
    {
      label: "Nothing on this CRF was corrected",
      outcome: "wrong",
    },
  ];
  if (decoy !== answer) options.push({ label: decoy, outcome: "wrong" });

  return {
    id,
    kind: "correction",
    subjectLabel: record.subjectLabel,
    prompt: `Which value on ${record.subjectLabel} was corrected, and why?`,
    exhibit: `${record.subjectLabel} · locked at ${describeStation(record.station)}`,
    options: withIds(id, options, random),
    answerNote: `The audit trail shows ${answer}.`,
    timeLimitSeconds: INSPECTION_RECORD_SECONDS,
  };
}

function signatureQuestion(
  id: string,
  record: InspectionRecord,
  random: () => number
): InspectionQuestion {
  const answer = describeSignature(record.signature);
  const pool = shuffle(
    signatureVariants()
      .map(describeSignature)
      .filter(
        (label, idx, all) => label !== answer && all.indexOf(label) === idx
      ),
    random
  ).slice(0, 2);
  const changed = record.corrections.length > 0;
  return {
    id,
    kind: "signature",
    subjectLabel: record.subjectLabel,
    prompt: changed
      ? `Where is the signature for the changes on ${record.subjectLabel}?`
      : `Where is the signature that locked ${record.subjectLabel}?`,
    exhibit: `${record.subjectLabel} · locked at ${describeStation(record.station)}`,
    options: withIds(
      id,
      [
        { label: answer, outcome: "correct" },
        ...pool.map((label) => ({ label, outcome: "wrong" as const })),
        { label: "There is no signature for this record", outcome: "wrong" },
      ],
      random
    ),
    answerNote: `The audit trail shows ${answer.charAt(0).toLowerCase()}${answer.slice(1)}.`,
    timeLimitSeconds: INSPECTION_RECORD_SECONDS,
  };
}

function stationQuestion(
  id: string,
  record: InspectionRecord,
  random: () => number
): InspectionQuestion {
  const others = shuffle(
    ALL_STATIONS.map((s) => s.id).filter((d) => d !== record.station),
    random
  ).slice(0, 3);
  return {
    id,
    kind: "station",
    subjectLabel: record.subjectLabel,
    prompt: `Which station did ${record.subjectLabel} go to?`,
    exhibit: `${record.subjectLabel} · CRF locked this campaign`,
    options: withIds(
      id,
      [
        { label: describeStation(record.station), outcome: "correct" },
        ...others.map((d) => ({
          label: describeStation(d),
          outcome: "wrong" as const,
        })),
      ],
      random
    ),
    answerNote: `${record.subjectLabel} was locked at ${describeStation(record.station)}.`,
    timeLimitSeconds: INSPECTION_RECORD_SECONDS,
  };
}

const SKELETON_REGULATIONS: readonly string[] = Array.from(
  new Set(
    SPONSOR_REQUESTS.flatMap((req) =>
      req.choices.flatMap((c) =>
        c.effects.skeleton ? [c.effects.skeleton.regulation] : []
      )
    )
  )
);

function skeletonQuestion(
  id: string,
  skeleton: SponsorSkeleton,
  skeletonIndex: number,
  random: () => number
): InspectionQuestion {
  const otherRegs = SKELETON_REGULATIONS.filter(
    (r) => r !== skeleton.regulation
  );
  const wrongReg =
    otherRegs.length > 0
      ? otherRegs[pickIndex(random, otherRegs.length)]
      : "ICH GCP E6(R3) § 4.2 - Adequate resources";
  return {
    id,
    kind: "skeleton",
    skeletonIndex,
    prompt:
      "The inspector found this in the sponsor correspondence. What do you tell them?",
    exhibit: skeleton.description,
    options: withIds(
      id,
      [
        {
          label: `It happened. We disclose it as a breach of ${skeleton.regulation} and open a CAPA.`,
          outcome: "disclosed",
        },
        {
          label: `It happened. We disclose it as a breach of ${wrongReg}.`,
          outcome: "misidentified",
        },
        {
          label: "The sponsor asked for it, so it is their finding, not ours.",
          outcome: "evasive",
        },
        {
          label: "We have no record of that.",
          outcome: "evasive",
        },
      ],
      random
    ),
    answerNote: `The requirement it breached is ${skeleton.regulation}.`,
    timeLimitSeconds: INSPECTION_SKELETON_SECONDS,
  };
}

/**
 * Starts the campaign-finale inspection. The auditor pulls 4-6 of the run's
 * locked CRFs (fewer only when fewer locked) and asks one question about each,
 * then one harder question per sponsor skeleton.
 *
 * @param records - The run's locked CRFs.
 * @param skeletons - Sponsor skeletons taken during the run.
 * @param random - Random source in [0, 1); pass a seeded one.
 * @returns A fresh round on its first question.
 */
export function createInspectionRound(
  records: readonly InspectionRecord[],
  skeletons: readonly SponsorSkeleton[],
  random: () => number
): InspectionRound {
  const target =
    INSPECTION_MIN_RECORDS +
    pickIndex(random, INSPECTION_MAX_RECORDS - INSPECTION_MIN_RECORDS + 1);
  const pulled = shuffle(records, random).slice(0, target);

  const questions: InspectionQuestion[] = pulled.map((record, idx) => {
    const id = `insp-${idx + 1}`;
    const kinds: InspectionQuestionKind[] =
      record.corrections.length > 0
        ? ["correction", "signature", "station"]
        : ["signature", "station"];
    const kind = kinds[pickIndex(random, kinds.length)];
    if (kind === "correction") {
      return correctionQuestion(
        id,
        record,
        records.filter((r) => r.subjectId !== record.subjectId),
        random
      );
    }
    return kind === "signature"
      ? signatureQuestion(id, record, random)
      : stationQuestion(id, record, random);
  });
  skeletons.forEach((skeleton, idx) => {
    questions.push(
      skeletonQuestion(`insp-skeleton-${idx + 1}`, skeleton, idx, random)
    );
  });

  return {
    questions,
    answers: [],
    current: 0,
    timeRemaining: questions[0]?.timeLimitSeconds ?? 0,
    timerEnabled: true,
    awaitingNext: false,
  };
}

/**
 * The question being asked, or `null` once the round is over.
 */
export function getCurrentInspectionQuestion(
  round: InspectionRound
): InspectionQuestion | null {
  return round.questions[round.current] ?? null;
}

/** True once every question has been answered and the player moved on. */
export function isInspectionComplete(round: InspectionRound): boolean {
  return round.current >= round.questions.length;
}

/**
 * Answers the current question. `null` records a timeout. Ignored while the
 * previous answer is still showing or the round is over.
 *
 * @param round - The round.
 * @param optionId - The picked option, or `null` when the timer ran out.
 * @returns The round with the answer recorded, awaiting the next question.
 */
export function answerInspectionQuestion(
  round: InspectionRound,
  optionId: string | null
): InspectionRound {
  const question = getCurrentInspectionQuestion(round);
  if (!question || round.awaitingNext) return round;
  const option =
    optionId === null
      ? undefined
      : question.options.find((o) => o.id === optionId);
  if (optionId !== null && !option) return round;
  return {
    ...round,
    answers: [
      ...round.answers,
      {
        questionId: question.id,
        optionId: option?.id ?? null,
        outcome: option?.outcome ?? "unanswered",
      },
    ],
    awaitingNext: true,
  };
}

/**
 * Moves on from an answered question to the next one.
 */
export function advanceInspection(round: InspectionRound): InspectionRound {
  if (!round.awaitingNext) return round;
  const current = round.current + 1;
  return {
    ...round,
    current,
    timeRemaining: round.questions[current]?.timeLimitSeconds ?? 0,
    awaitingNext: false,
  };
}

/**
 * Runs the current question's timer down; at zero the question is answered
 * as a timeout. A turned-off timer and an answered question do not run.
 *
 * @param round - The round.
 * @param seconds - Seconds elapsed.
 * @returns The round after the tick.
 */
export function tickInspectionTimer(
  round: InspectionRound,
  seconds: number
): InspectionRound {
  if (
    !round.timerEnabled ||
    round.awaitingNext ||
    isInspectionComplete(round) ||
    seconds <= 0
  ) {
    return round;
  }
  const timeRemaining = Math.max(0, round.timeRemaining - seconds);
  const ticked = { ...round, timeRemaining };
  return timeRemaining === 0 ? answerInspectionQuestion(ticked, null) : ticked;
}

/** Adds `INSPECTION_EXTENSION_SECONDS` to the current question (WCAG 2.2.1). */
export function extendInspectionTimer(round: InspectionRound): InspectionRound {
  if (round.awaitingNext || isInspectionComplete(round)) return round;
  return {
    ...round,
    timeRemaining: round.timeRemaining + INSPECTION_EXTENSION_SECONDS,
  };
}

/** Turns the question timer on or off (WCAG 2.2.1). */
export function setInspectionTimerEnabled(
  round: InspectionRound,
  enabled: boolean
): InspectionRound {
  return { ...round, timerEnabled: enabled };
}

/**
 * The answer given to a question, if any.
 */
export function getInspectionAnswer(
  round: InspectionRound,
  questionId: string
): InspectionAnswer | undefined {
  return round.answers.find((a) => a.questionId === questionId);
}

/**
 * How each skeleton question was answered, by skeleton index. Skeletons the
 * round never reached count as unanswered.
 *
 * @param round - The round.
 * @param skeletonCount - Skeletons taken during the run.
 * @returns One disposition per skeleton.
 */
export function getSkeletonDispositions(
  round: InspectionRound,
  skeletonCount: number
): SkeletonDisposition[] {
  const out: SkeletonDisposition[] = Array.from(
    { length: skeletonCount },
    () => "unanswered"
  );
  for (const q of round.questions) {
    if (q.kind !== "skeleton" || q.skeletonIndex === undefined) continue;
    const answer = getInspectionAnswer(round, q.id);
    if (
      answer &&
      answer.outcome !== "correct" &&
      answer.outcome !== "wrong" &&
      q.skeletonIndex < skeletonCount
    ) {
      out[q.skeletonIndex] = answer.outcome;
    }
  }
  return out;
}

/**
 * Tallies the round for the report.
 */
export function summarizeInspection(
  round: InspectionRound
): InspectionInterviewSummary {
  const record = round.questions.filter((q) => q.kind !== "skeleton");
  const skeleton = round.questions.filter((q) => q.kind === "skeleton");
  const recordCorrect = record.filter(
    (q) => getInspectionAnswer(round, q.id)?.outcome === "correct"
  ).length;
  const skeletonsDisclosed = skeleton.filter(
    (q) => getInspectionAnswer(round, q.id)?.outcome === "disclosed"
  ).length;
  return {
    recordQuestions: record.length,
    recordCorrect,
    skeletonQuestions: skeleton.length,
    skeletonsDisclosed,
    clean:
      recordCorrect === record.length && skeletonsDisclosed === skeleton.length,
  };
}

const MISS_REGULATIONS: Readonly<
  Record<Exclude<InspectionQuestionKind, "skeleton">, string>
> = {
  correction: "21 CFR § 11.10(e) - Audit trail of operator actions",
  signature: "21 CFR § 11.50 - Signature manifestations",
  station: "21 CFR § 312.62 - Investigator record keeping",
};

const MISS_DESCRIPTIONS: Readonly<
  Record<Exclude<InspectionQuestionKind, "skeleton">, string>
> = {
  correction: "could not say which value was corrected, or why",
  signature: "could not show the signature for the record",
  station: "could not say where the record was filed",
};

/**
 * Adds the record questions of the inspection interview to a report: each
 * miss is a Minor finding, and `INSPECTION_INCOMPLETE_TRAIL_MISSES` misses
 * add a Major "audit trail incomplete" finding. Skeleton questions are applied by
 * `applySponsorSkeletonsToReport`.
 *
 * @param report - The report, sponsor skeletons already applied.
 * @param round - The finished round.
 * @returns The report with the interview applied.
 */
export function applyInspectionToReport(
  report: BIMOInspectionReport,
  round: InspectionRound
): BIMOInspectionReport {
  const summary = summarizeInspection(round);
  const findings: BIMOFinding[] = [];
  round.questions.forEach((q) => {
    if (q.kind === "skeleton") return;
    if (getInspectionAnswer(round, q.id)?.outcome === "correct") return;
    findings.push({
      id: `FND-INSP-${findings.length + 1}`,
      category: q.kind === "signature" ? "21 CFR Part 11" : "Data Integrity",
      severity: "Minor",
      description: `Inspection interview: the site ${MISS_DESCRIPTIONS[q.kind]} on ${q.subjectLabel}.`,
      regulation: MISS_REGULATIONS[q.kind],
    });
  });
  const misses = findings.length;
  if (misses >= INSPECTION_INCOMPLETE_TRAIL_MISSES) {
    findings.push({
      id: "FND-INSP-TRAIL",
      category: "21 CFR Part 11",
      severity: "Major",
      description: `Audit trail incomplete: the site could not answer for ${misses} of ${summary.recordQuestions} sampled records from its own audit trail.`,
      regulation: "21 CFR § 11.10(e) - Audit trail of operator actions",
    });
  }

  let verdict = report.verdict;
  if (findings.some((f) => f.severity === "Critical")) {
    verdict = "OAI (Official Action Indicated - Form 483 Issued)";
  } else if (findings.length > 0 && verdict === "NAI (No Action Indicated)") {
    verdict = "VAI (Voluntary Action Indicated)";
  }

  return {
    ...report,
    overallScore: Math.max(
      0,
      report.overallScore - misses * INSPECTION_MISS_PENALTY
    ),
    verdict,
    summary: `${report.summary} In the closing interview the site answered ${summary.recordCorrect} of ${summary.recordQuestions} record questions from its audit trail.`,
    findings: [...report.findings, ...findings],
    inspection: summary,
  };
}
