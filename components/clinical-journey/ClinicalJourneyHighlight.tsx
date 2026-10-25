import Link from "next/link";
import { CLINICAL_JOURNEY } from "@/lib/clinical-journey";

interface ClinicalJourneyHighlightProps {
  /** The heading level that fits the page outline around the card. */
  readonly headingLevel: 2 | 3;
}

/**
 * The entry to the clinical data journey from the homepage and the case
 * study index: the steps in order, and a way to start at the first.
 */
export function ClinicalJourneyHighlight({
  headingLevel,
}: ClinicalJourneyHighlightProps) {
  const first = CLINICAL_JOURNEY[0]!;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      aria-labelledby="clinical-journey-title"
      className="@container section-isolate min-w-0 w-full mb-6 sm:mb-8 p-5 sm:p-7 bg-[#13151a]/90 border border-white/10 rounded-2xl"
    >
      <p className="inline-flex px-2 py-0.5 mb-2.5 rounded text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 uppercase">
        Clinical data / one study, end to end
      </p>
      <Heading
        id="clinical-journey-title"
        className="text-base sm:text-lg font-bold text-white mb-1.5"
      >
        Follow one study from form to portfolio.
      </Heading>
      <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-2xl">
        Collect the data, see what a protocol change does to it, tabulate and
        analyse it, then govern it across a portfolio. The study, its subjects
        and the sponsor&apos;s vendors are fictional; the case studies of my own
        projects are real code.
      </p>
      <ol className="mt-4 grid min-w-0 gap-2 @lg:grid-cols-5">
        {CLINICAL_JOURNEY.map((step, index) => (
          <li key={step.id} className="min-w-0">
            <Link
              href={step.href}
              className="flex h-full min-h-11 flex-col border border-white/[0.08] bg-[#0d0e11] px-3 py-2 text-xs text-slate-300 hover:border-amber-500/40 hover:text-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              <span className="font-mono tabular-nums text-amber-400">
                {String(index + 1).padStart(2, "0")} / {step.stage}
              </span>
              <span className="mt-1 break-words font-semibold text-slate-100">
                {step.title}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href={first.href}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center px-5 py-2.5 bg-amber-400 text-black font-mono text-xs font-bold rounded-xl hover:bg-amber-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13151a]"
      >
        Start the journey at {first.title}
      </Link>
    </section>
  );
}
