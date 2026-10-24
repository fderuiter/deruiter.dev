import type { ReportTier } from "@/lib/clinical-platform";

/**
 * Label, mark and meaning of each report tier. The mark and the word carry
 * the tier, so it never rests on colour alone.
 */
export const REPORT_TIERS: Readonly<
  Record<
    ReportTier,
    {
      readonly label: string;
      readonly mark: string;
      readonly meaning: string;
      readonly className: string;
    }
  >
> = {
  certified: {
    label: "Certified",
    mark: "✓",
    meaning:
      "Governed metrics only, with the owner's sign-off on this version.",
    className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  },
  managed: {
    label: "Managed",
    mark: "■",
    meaning: "Owned and maintained by a named team.",
    className: "border-slate-400/40 bg-slate-400/10 text-slate-200",
  },
  exploratory: {
    label: "Exploratory",
    mark: "◇",
    meaning: "Self-service; may use draft metrics.",
    className: "border-amber-500/50 bg-amber-500/10 text-amber-300",
  },
};

/** A report's tier as a badge: its mark and its name, with the meaning as a tooltip. */
export function ReportTierBadge({ tier }: { tier: ReportTier }) {
  const t = REPORT_TIERS[tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${t.className}`}
      title={t.meaning}
    >
      <span aria-hidden="true">{t.mark}</span>
      {t.label}
    </span>
  );
}
