import type { FinalReport, StudyState } from "@/lib/study-director";

export interface Verdict {
  /** 0 to 11: grade, sponsor, margin and schedule together. */
  score: number;
  headline: string;
  line: string;
  tone: "good" | "mixed" | "bad";
}

const GRADE_POINTS = { A: 4, B: 3, C: 2, D: 1, F: 0 } as const;

/** One headline for the whole study, in the game's voice. */
export function verdictFor(report: FinalReport): Verdict {
  const { sponsor, company, regulatory } = report.evaluations;
  const score =
    GRADE_POINTS[regulatory.grade] +
    (sponsor.stars - 1) +
    (company.marginPct >= 10 ? 2 : company.marginPct >= 0 ? 1 : 0) +
    (company.timelineVarianceDays <= 0 ? 1 : 0);
  if (score >= 9) {
    return {
      score,
      headline: "Everything actually was fine.",
      line: "On file, on budget and on the sponsor's good side. Frame this one.",
      tone: "good",
    };
  }
  if (score >= 6) {
    return {
      score,
      headline: "Fine, with footnotes.",
      line: "The study landed. A few things will need explaining.",
      tone: "mixed",
    };
  }
  if (score >= 3) {
    return {
      score,
      headline: "Define “fine”.",
      line: "It closed out, but the file and the budget tell a harder story.",
      tone: "mixed",
    };
  }
  return {
    score,
    headline: "Everything is not fine.",
    line: "The dashboard was green. The study was not.",
    tone: "bad",
  };
}

export type MarkKind = "documented" | "undocumented" | "lapsed" | "audit";

export interface TimelineMark {
  day: number;
  kind: MarkKind;
  label: string;
}

/** Every call the Study Director made, or failed to make, by day. */
export function decisionMarks(state: StudyState): TimelineMark[] {
  return state.log.map((entry) => ({
    day: entry.day,
    kind:
      entry.optionId === "audit"
        ? "audit"
        : entry.optionId === "ignored"
          ? "lapsed"
          : entry.documented
            ? "documented"
            : "undocumented",
    label: entry.label,
  }));
}

/** Counts of each kind of mark, for the legend. */
export function markCounts(marks: TimelineMark[]): Record<MarkKind, number> {
  const counts: Record<MarkKind, number> = {
    documented: 0,
    undocumented: 0,
    lapsed: 0,
    audit: 0,
  };
  for (const mark of marks) counts[mark.kind] += 1;
  return counts;
}
