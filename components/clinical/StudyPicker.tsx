"use client";

import { useId, useSyncExternalStore } from "react";
import {
  CLINICAL_STUDIES,
  DEMO_STUDY_ID,
  readSelectedStudy,
  subscribeSelectedStudy,
  writeSelectedStudy,
  type ClinicalStudyId,
} from "@/lib/clinical-study-context";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const getServerSnapshot = (): ClinicalStudyId => DEMO_STUDY_ID;

/**
 * Picks the study the clinical pages show (#3157). The choice is kept for the
 * tab, so `/clinical` and `/study-data` agree. The only study is DEMO-301, so
 * the select has one option; the summary line comes from constants, with no
 * fetch.
 */
export function StudyPicker({
  className = "",
}: {
  readonly className?: string;
}) {
  const id = useId();
  const selected = useSyncExternalStore(
    subscribeSelectedStudy,
    readSelectedStudy,
    getServerSnapshot
  );
  const study = CLINICAL_STUDIES[selected];
  const studies = Object.values(CLINICAL_STUDIES);

  return (
    <section
      aria-label="Study picker"
      data-testid="study-picker"
      className={`min-w-0 max-w-3xl border border-white/[0.08] bg-[#13151a] p-4 sm:p-5 ${className}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400"
        >
          Study
        </label>
        <select
          id={id}
          value={selected}
          onChange={(event) => {
            const next = event.target.value;
            if (next in CLINICAL_STUDIES) {
              writeSelectedStudy(next as ClinicalStudyId);
            }
          }}
          className="min-w-0 border border-white/[0.12] bg-[#0d0e11] px-3 py-2 font-mono text-sm text-[#f4f4f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {studies.map((option) => (
            <option key={option.id} value={option.id}>
              {option.id}
            </option>
          ))}
        </select>
        <span className="border border-amber-500/40 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-amber-300">
          Synthetic data
        </span>
      </div>
      <p
        data-testid="study-picker-summary"
        className="mt-3 min-w-0 break-words text-sm leading-relaxed text-slate-300"
      >
        <span className="text-[#f4f4f6]">{study.title}.</span>{" "}
        <span className="font-mono text-xs text-slate-400">
          {plural(study.forms, "form")} · {plural(study.datasets, "dataset")} ·{" "}
          {plural(study.tlfs, "TLF")}
        </span>
      </p>
    </section>
  );
}
