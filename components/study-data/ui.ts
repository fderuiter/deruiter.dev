/**
 * Shared class names for the /study-data page, in the site's architectural
 * palette: graphite surfaces, hairline borders, amber for focus and
 * emphasis, emerald and amber for status (AGENTS.md invariant 20).
 */

/** A bordered panel on the graphite surface. */
export const PANEL =
  "section-isolate min-w-0 border border-white/[0.08] bg-[#13151a]";

/** Mono eyebrow above a heading. */
export const EYEBROW =
  "font-mono text-xs uppercase tracking-[0.18em] text-amber-400";

/** Section heading. */
export const HEADING = "text-2xl font-semibold tracking-[-0.035em] sm:text-3xl";

/** Visible focus ring used on every interactive element. */
export const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

/** Focus ring inside a grid, drawn inside the cell so it is never clipped. */
export const CELL_FOCUS =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-400";

/** Primary action. */
export const BUTTON_PRIMARY = `inline-flex min-h-12 items-center justify-center gap-2 border border-amber-500/60 bg-amber-500/10 px-4 font-mono text-xs uppercase tracking-[0.12em] text-amber-200 transition-colors hover:bg-amber-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

/** Secondary action. */
export const BUTTON_SECONDARY = `inline-flex min-h-12 items-center justify-center gap-2 border border-white/[0.12] bg-[#0d0e11] px-4 text-sm text-slate-200 transition-colors hover:border-amber-500/50 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`;

/** Form field. */
export const FIELD = `min-h-12 w-full min-w-0 border border-zinc-700 bg-[#0d0e11] px-3 font-mono text-sm tabular-nums text-white ${FOCUS}`;

/** Scroll container for a wide table. */
export const TABLE_SCROLL =
  "min-w-0 max-w-full overflow-auto border border-white/[0.08] bg-[#0d0e11]";

/** Grid cell padding and type. */
export const CELL =
  "whitespace-nowrap px-3 py-2 text-left font-mono text-xs tabular-nums";

/** Selected grid cell. */
export const SELECTED = "bg-amber-500/15 text-amber-100";
