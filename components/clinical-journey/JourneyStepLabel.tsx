import { CLINICAL_JOURNEY } from "@/lib/clinical-journey";

interface JourneyStepLabelProps {
  /** The page's own path, which places it in the journey. */
  readonly path: string;
  /** Plain label shown when the path is not a step on the main path. */
  readonly fallback: string;
  readonly className?: string;
}

/**
 * The small label above a clinical page heading. A journey step reads
 * "Step N of M: stage", with N and M taken from the journey map so the page
 * and the journey menu always agree (#3143). Any other page shows its plain
 * fallback label, with no number.
 */
export function JourneyStepLabel({
  path,
  fallback,
  className = "",
}: JourneyStepLabelProps) {
  const index = CLINICAL_JOURNEY.findIndex((step) => step.href === path);
  const text =
    index === -1
      ? fallback
      : `Step ${index + 1} of ${CLINICAL_JOURNEY.length}: ${CLINICAL_JOURNEY[index].stage}`;
  return (
    <p
      className={`font-mono text-xs uppercase tracking-[0.2em] text-amber-400 ${className}`.trim()}
    >
      {text}
    </p>
  );
}
