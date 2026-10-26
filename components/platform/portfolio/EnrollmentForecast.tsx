"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { clamp } from "@/lib/game-utils";
import {
  PORTFOLIO_FORECAST_ASSUMPTIONS,
  PORTFOLIO_WHAT_IF_LIMITS,
  type EnrollmentForecastPoint,
  type EnrollmentWhatIf,
  type PortfolioForecast,
} from "@/lib/clinical-platform";
import { plural } from "./MilestoneSwimlane";

/** Asks the page's worker for a study's forecast with sites added. */
export type RunWhatIf = (
  studyId: string,
  whatIf: EnrollmentWhatIf
) => Promise<PortfolioForecast>;

/**
 * The baseline and the what-if, in the first two colours and dashes of the
 * report charts' categorical palette, so the lines read apart without
 * colour too.
 */
const BASELINE = { colour: "#3987e5", dash: "" };
const WHAT_IF = { colour: "#d95926", dash: "8 4" };

const DEFAULT_WIDTH = 720;
const MIN_WIDTH = 280;
const MAX_WIDTH = 896;
const LEFT = 44;
const TOP = 16;
const RIGHT_PAD = 16;
const SHARE_TICKS = [0, 0.5, 1] as const;

const share = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});
const whole = new Intl.NumberFormat("en-US");

function dayNumber(iso: string): number {
  return (
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    ) / 86_400_000
  );
}

/** Whole days from one ISO 8601 date to another. */
function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

/** The date a week of a curve falls on: both curves step weekly from the data cut. */
function weekOn(dataCut: string, week: number): string {
  return new Date((dayNumber(dataCut) + week * 7) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Weeks on the longer of the baseline and what-if curves. */
function weekCount(
  baseline: PortfolioForecast,
  whatIf: PortfolioForecast | null
): number {
  return Math.max(
    baseline.forecast.curve.length,
    whatIf?.forecast.curve.length ?? 0
  );
}

/** The first day of each month after `from` up to `to`, ISO 8601. */
function monthStarts(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  for (;;) {
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    if (start > to) return months;
    months.push(start);
  }
}

/** A share of runs at a week of the curve, or past the end of a curve. */
function shareAt(
  curve: readonly EnrollmentForecastPoint[],
  week: number
): string {
  if (week < curve.length) return share.format(curve[week].completed);
  // The curve stops once 99% of runs are complete, so later weeks are at least that.
  return `${share.format(curve[curve.length - 1].completed)} or more`;
}

/** What a what-if adds, in words. */
function whatIfText(whatIf: EnrollmentWhatIf, countryName: string): string {
  return `${plural(whatIf.sites, "site")} in ${countryName} from day ${whatIf.activationDelayDays}`;
}

/** The weekly readout for the keyboard, the pointer and screen readers. */
function readoutText(
  baseline: PortfolioForecast,
  whatIf: PortfolioForecast | null,
  week: number
): string {
  const date = weekOn(baseline.forecast.dataCut, week);
  const base = `${date}: ${shareAt(baseline.forecast.curve, week)} of runs complete`;
  return whatIf === null
    ? `${base}.`
    : `${base}; with the what-if, ${shareAt(whatIf.forecast.curve, week)}.`;
}

function ForecastCurve({
  baseline,
  whatIf,
  label,
}: {
  baseline: PortfolioForecast;
  whatIf: PortfolioForecast | null;
  label: string;
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const onResize = useCallback((entry: ResizeObserverEntry) => {
    setWidth(clamp(Math.floor(entry.contentRect.width), MIN_WIDTH, MAX_WIDTH));
  }, []);
  const containerRef = useResizeObserver<HTMLDivElement>(onResize);
  const [active, setActive] = useState<number | null>(null);
  const [announced, setAnnounced] = useState("");

  const { dataCut, plannedLastSubjectIn } = baseline.forecast;
  const weeks = weekCount(baseline, whatIf);
  const last = weekOn(dataCut, weeks - 1);
  const end = plannedLastSubjectIn > last ? plannedLastSubjectIn : last;
  const span = Math.max(1, daysBetween(dataCut, end));
  const height = Math.round(clamp(width * 0.4, 200, 280));
  const right = width - RIGHT_PAD;
  const bottom = height - 28;
  const x = (iso: string) =>
    LEFT + (daysBetween(dataCut, iso) / span) * (right - LEFT);
  const y = (value: number) => bottom - value * (bottom - TOP);
  const path = (curve: readonly EnrollmentForecastPoint[]) =>
    curve
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(point.on).toFixed(1)} ${y(point.completed).toFixed(1)}`
      )
      .join(" ");
  // A month label wherever about 64 px are free for it.
  const months = monthStarts(dataCut, end);
  // The plot is at least MIN_WIDTH - LEFT - RIGHT_PAD wide, never 0.
  const every = Math.max(1, Math.ceil((months.length * 64) / (right - LEFT)));
  const planShown = !baseline.planPassed;
  const activeX = active === null ? 0 : x(weekOn(dataCut, active));

  const move = (week: number) => {
    const next = clamp(week, 0, weeks - 1);
    setActive(next);
    setAnnounced(readoutText(baseline, whatIf, next));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = active ?? -1;
    const steps: Record<string, number> = {
      ArrowRight: at + 1,
      ArrowLeft: at < 0 ? 0 : at - 1,
      PageDown: at + 4,
      PageUp: at < 0 ? 0 : at - 4,
      Home: 0,
      End: weeks - 1,
    };
    if (event.key === "Escape") {
      setActive(null);
      return;
    }
    if (!(event.key in steps)) return;
    event.preventDefault();
    move(steps[event.key]);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const at = ((event.clientX - box.left) / box.width) * width;
    const day = ((at - LEFT) / (right - LEFT)) * span;
    setActive(clamp(Math.round(day / 7), 0, weeks - 1));
  };

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={`${label}. Use the arrow keys to read each week.`}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      className="relative min-w-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <li className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden="true" focusable="false">
            <line
              x1="0"
              x2="24"
              y1="4"
              y2="4"
              stroke={BASELINE.colour}
              strokeWidth="2"
            />
          </svg>
          Baseline
        </li>
        {whatIf !== null && (
          <li className="flex items-center gap-2">
            <svg width="24" height="8" aria-hidden="true" focusable="false">
              <line
                x1="0"
                x2="24"
                y1="4"
                y2="4"
                stroke={WHAT_IF.colour}
                strokeWidth="2"
                strokeDasharray={WHAT_IF.dash}
              />
            </svg>
            With the what-if
          </li>
        )}
        {planShown && (
          <li className="flex items-center gap-2">
            <svg width="24" height="8" aria-hidden="true" focusable="false">
              <line
                x1="12"
                x2="12"
                y1="0"
                y2="8"
                stroke="#e2e8f0"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
            </svg>
            Planned last subject in
          </li>
        )}
      </ul>
      <div
        ref={containerRef}
        className="w-full min-w-0 max-w-4xl"
        aria-hidden="true"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full touch-pan-y"
          focusable="false"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setActive(null)}
        >
          {SHARE_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={LEFT}
                x2={right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={LEFT - 8}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize="11"
                fill="#94a3b8"
                className="tabular-nums"
              >
                {share.format(tick)}
              </text>
            </g>
          ))}
          {months.map((month, index) =>
            index % every === 0 ? (
              <g key={month}>
                <line
                  x1={x(month)}
                  x2={x(month)}
                  y1={bottom}
                  y2={bottom + 4}
                  stroke="#64748b"
                />
                <text
                  x={x(month)}
                  y={bottom + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#94a3b8"
                  className="tabular-nums"
                >
                  {month.slice(0, 7)}
                </text>
              </g>
            ) : null
          )}
          <line x1={LEFT} x2={right} y1={bottom} y2={bottom} stroke="#64748b" />
          {planShown && (
            <line
              x1={x(plannedLastSubjectIn)}
              x2={x(plannedLastSubjectIn)}
              y1={TOP}
              y2={bottom}
              stroke="#e2e8f0"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
          )}
          {active !== null && (
            <line
              x1={activeX}
              x2={activeX}
              y1={TOP}
              y2={bottom}
              stroke="#94a3b8"
            />
          )}
          <path
            d={path(baseline.forecast.curve)}
            fill="none"
            stroke={BASELINE.colour}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {whatIf !== null && (
            <path
              d={path(whatIf.forecast.curve)}
              fill="none"
              stroke={WHAT_IF.colour}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray={WHAT_IF.dash}
            />
          )}
        </svg>
      </div>
      {active !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-6 z-10 max-w-[16rem] border border-white/[0.12] bg-[#13151a] px-3 py-2 text-xs text-slate-200 shadow-lg"
          style={
            activeX > width / 2
              ? { right: `${((width - activeX) / width) * 100 + 2}%` }
              : { left: `${(activeX / width) * 100 + 2}%` }
          }
        >
          {readoutText(baseline, whatIf, active)}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announced}
      </p>
    </div>
  );
}

/** The curve as a table: one row per week, baseline and what-if side by side. */
function CurveTable({
  baseline,
  whatIf,
}: {
  baseline: PortfolioForecast;
  whatIf: PortfolioForecast | null;
}) {
  const weeks = Array.from(
    { length: weekCount(baseline, whatIf) },
    (_, week) => week
  );
  return (
    <details className="mt-4 border border-white/[0.08] bg-[#13151a]">
      <summary className="cursor-pointer px-4 py-3 text-sm text-slate-200">
        Weekly completion as a table
      </summary>
      <div
        className="max-h-80 overflow-auto border-t border-white/[0.08]"
        tabIndex={0}
        role="region"
        aria-label={`Weekly completion of ${baseline.studyId}`}
      >
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            {`Share of simulated runs that have enrolled ${baseline.studyId}'s last subject, by week from the data cut`}
          </caption>
          <thead className="sticky top-0 bg-[#13151a]">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium text-slate-300">
                Week of
              </th>
              <th
                scope="col"
                className="px-3 py-2 text-right font-medium text-slate-300"
              >
                Baseline
              </th>
              {whatIf !== null && (
                <th
                  scope="col"
                  className="px-3 py-2 text-right font-medium text-slate-300"
                >
                  With the what-if
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week} className="border-t border-white/[0.06]">
                <th
                  scope="row"
                  className="px-3 py-1.5 text-left font-mono font-normal tabular-nums text-slate-100"
                >
                  {weekOn(baseline.forecast.dataCut, week)}
                </th>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-100">
                  {shareAt(baseline.forecast.curve, week)}
                </td>
                {whatIf !== null && (
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-100">
                    {shareAt(whatIf.forecast.curve, week)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Figures({
  forecast,
  heading,
}: {
  forecast: PortfolioForecast;
  heading: string;
}) {
  const { quantiles, plannedLastSubjectIn } = forecast.forecast;
  const figures = [
    [
      `Chance of last subject in by ${plannedLastSubjectIn}`,
      forecast.probabilityText,
    ],
    ["Median completion (P50)", quantiles.p50],
    ["P10 to P90", `${quantiles.p10} to ${quantiles.p90}`],
  ] as const;
  return (
    <div className="min-w-0">
      <h4 className="text-sm font-medium text-slate-200">{heading}</h4>
      <dl className="mt-2 grid grid-cols-1 gap-3 @lg:grid-cols-3">
        {figures.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 border border-white/[0.08] bg-[#13151a] p-4"
          >
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-1 break-words font-mono text-lg tabular-nums text-[#f4f4f6]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The plan in one sentence: how many runs meet it, or that it has passed. */
function planText(forecast: PortfolioForecast): string {
  const { enrolled, target, plannedLastSubjectIn, runs } = forecast.forecast;
  const progress = `${whole.format(enrolled)} of ${whole.format(target)} subjects are enrolled.`;
  if (forecast.planPassed) {
    return `${progress} The planned last subject in, ${plannedLastSubjectIn}, passed before the data cut, so no run can meet it; the dates show when the last subject is now likely in.`;
  }
  return `${progress} ${whole.format(forecast.runsByPlan)} of ${whole.format(runs)} simulated runs enroll the last subject by the planned ${plannedLastSubjectIn}.`;
}

/** What the what-if changes, in one sentence. */
function compareText(
  baseline: PortfolioForecast,
  whatIf: PortfolioForecast
): string {
  const asked = whatIf.forecast.whatIf!;
  const country =
    whatIf.countries.find((c) => c.code === asked.countryCode)?.name ??
    asked.countryCode;
  const from = baseline.forecast.quantiles.p50;
  const to = whatIf.forecast.quantiles.p50;
  const moved = daysBetween(to, from);
  const median =
    moved === 0
      ? `the median stays at ${to}`
      : `the median moves from ${from} to ${to}, ${plural(Math.abs(moved), "day")} ${moved > 0 ? "earlier" : "later"}`;
  const plan = baseline.planPassed
    ? ""
    : `, and the chance of meeting the plan goes from ${baseline.probabilityText} to ${whatIf.probabilityText}`;
  return `With ${whatIfText(asked, country)}, ${median}${plan}.`;
}

interface Draft {
  readonly countryCode: string;
  readonly sites: string;
  readonly activationDelayDays: string;
}

type Field = "sites" | "activationDelayDays";

/** Checks a draft against the engine's bounds; returns the what-if or the problems. */
function checkDraft(
  draft: Draft
): { whatIf: EnrollmentWhatIf } | { errors: Partial<Record<Field, string>> } {
  const errors: Partial<Record<Field, string>> = {};
  const read = (field: Field, noun: string) => {
    const { min, max } = PORTFOLIO_WHAT_IF_LIMITS[field];
    const text = draft[field].trim();
    const value = Number(text);
    if (text === "" || !Number.isInteger(value) || value < min || value > max) {
      errors[field] = `Enter a whole number of ${noun} from ${min} to ${max}.`;
    }
    return value;
  };
  const sites = read("sites", "sites");
  const activationDelayDays = read("activationDelayDays", "days");
  if (Object.keys(errors).length > 0) return { errors };
  return {
    whatIf: { countryCode: draft.countryCode, sites, activationDelayDays },
  };
}

/** The country a what-if starts in: where the study has the most sites. */
function defaultCountry(forecast: PortfolioForecast): string {
  const best = forecast.countries.reduce(
    (top, c) => (c.sites > top.sites ? c : top),
    forecast.countries[0]
  );
  return best?.code ?? "";
}

type Run =
  | { readonly state: "idle" }
  | { readonly state: "running" }
  | { readonly state: "done"; readonly result: PortfolioForecast }
  | { readonly state: "failed"; readonly error: string };

function ForecastCard({
  forecast,
  onWhatIf,
}: {
  forecast: PortfolioForecast;
  onWhatIf?: RunWhatIf;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => ({
    countryCode: defaultCountry(forecast),
    sites: "5",
    activationDelayDays: "90",
  }));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [run, setRun] = useState<Run>({ state: "idle" });
  // Each request takes the next number; only the latest may land.
  const latest = useRef(0);
  const whatIf = run.state === "done" ? run.result : null;
  const { runs, seed, studyId } = forecast.forecast;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onWhatIf === undefined) return;
    const checked = checkDraft(draft);
    if ("errors" in checked) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    const request = ++latest.current;
    setRun({ state: "running" });
    onWhatIf(studyId, checked.whatIf).then(
      (result) => {
        if (request === latest.current) setRun({ state: "done", result });
      },
      (failure: unknown) => {
        if (request === latest.current) {
          setRun({
            state: "failed",
            error: failure instanceof Error ? failure.message : String(failure),
          });
        }
      }
    );
  };
  const onClear = () => {
    latest.current += 1;
    setRun({ state: "idle" });
  };
  const edit = (name: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }));
  const label = `Share of simulated runs that have enrolled ${studyId}'s last subject, by week, from the data cut`;

  return (
    <article
      aria-labelledby={`${id}-title`}
      className="@container min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6"
    >
      <h3 id={`${id}-title`} className="text-lg font-semibold">
        <span className="font-mono">{studyId}</span>{" "}
        <span className="font-normal text-slate-300">{forecast.title}</span>
      </h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
        {planText(forecast)}
      </p>
      <div className="mt-4 space-y-4">
        <Figures forecast={forecast} heading="Baseline" />
        {whatIf !== null && (
          <Figures
            forecast={whatIf}
            heading={`With ${whatIfText(
              whatIf.forecast.whatIf!,
              whatIf.countries.find(
                (c) => c.code === whatIf.forecast.whatIf!.countryCode
              )?.name ?? whatIf.forecast.whatIf!.countryCode
            )}`}
          />
        )}
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
        {whatIf === null
          ? "Add sites below to see how much sooner the last subject could be in."
          : compareText(forecast, whatIf)}
      </p>
      <div className="mt-4">
        <ForecastCurve baseline={forecast} whatIf={whatIf} label={label} />
      </div>
      <CurveTable baseline={forecast} whatIf={whatIf} />

      {onWhatIf !== undefined && (
        <form
          noValidate
          onSubmit={onSubmit}
          aria-labelledby={`${id}-what-if`}
          className="mt-6 border border-white/[0.08] bg-[#13151a] p-4"
        >
          <h4
            id={`${id}-what-if`}
            className="text-sm font-medium text-slate-200"
          >
            What if {studyId} opened more sites?
          </h4>
          <div className="mt-3 grid grid-cols-1 gap-3 @md:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-300">
              Country
              <select
                value={draft.countryCode}
                onChange={(event) => edit("countryCode", event.target.value)}
                className="min-h-11 min-w-0 border border-white/[0.12] bg-[#0d0e11] px-2 text-sm text-slate-100"
              >
                {forecast.countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {`${country.name} (${
                      country.sites === 0
                        ? "no sites in this study"
                        : `${plural(country.sites, "site")} recruiting`
                    })`}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["sites", "Sites to add"],
                ["activationDelayDays", "Days until they recruit"],
              ] as const
            ).map(([name, text]) => {
              const { min, max } = PORTFOLIO_WHAT_IF_LIMITS[name];
              const error = errors[name];
              return (
                <label
                  key={name}
                  className="flex min-w-0 flex-col gap-1 text-xs text-slate-300"
                >
                  {`${text} (${min} to ${max})`}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    step={1}
                    value={draft[name]}
                    onChange={(event) => edit(name, event.target.value)}
                    aria-invalid={error !== undefined}
                    aria-describedby={
                      error === undefined ? undefined : `${id}-${name}-error`
                    }
                    className="min-h-11 min-w-0 border border-white/[0.12] bg-[#0d0e11] px-2 font-mono text-sm tabular-nums text-slate-100"
                  />
                  {error !== undefined && (
                    <span id={`${id}-${name}-error`} className="text-red-200">
                      {error}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="min-h-11 border border-amber-500/60 bg-amber-500/10 px-4 text-sm text-amber-100 hover:bg-amber-500/20 active:scale-[0.98]"
            >
              Run the what-if
            </button>
            {run.state !== "idle" && (
              <button
                type="button"
                onClick={onClear}
                className="min-h-11 border border-white/[0.12] px-4 text-sm text-slate-200 hover:bg-white/[0.04] active:scale-[0.98]"
              >
                Back to the baseline
              </button>
            )}
            <p role="status" className="text-xs text-slate-400">
              {run.state === "running"
                ? `Running ${whole.format(runs)} simulations in the background.`
                : run.state === "done"
                  ? "What-if applied."
                  : ""}
            </p>
          </div>
          {run.state === "failed" && (
            <p
              role="alert"
              className="mt-3 border-l-2 border-red-500 pl-3 text-sm text-red-200"
            >
              The what-if could not be run: {run.error}
            </p>
          )}
        </form>
      )}

      <div className="mt-6">
        <h4 className="text-sm font-medium text-slate-200">Assumptions</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-300">
          {PORTFOLIO_FORECAST_ASSUMPTIONS.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
          <li>
            {`${whole.format(runs)} simulated runs from seed ${seed}, so the same inputs always give the same forecast.`}
          </li>
        </ul>
      </div>
    </article>
  );
}

/**
 * The enrollment forecast of every study still enrolling, each with a
 * what-if that adds sites. A what-if is computed by `onWhatIf`, which the
 * page answers from its Web Worker; without it the baseline is shown alone.
 *
 * @param forecasts - The dashboard's baseline forecasts.
 * @param onWhatIf - Runs a what-if for a study.
 */
export function EnrollmentForecastSection({
  forecasts,
  onWhatIf,
}: {
  forecasts: readonly PortfolioForecast[];
  onWhatIf?: RunWhatIf;
}) {
  return (
    <section aria-labelledby="portfolio-forecast" className="min-w-0">
      <h2
        id="portfolio-forecast"
        className="text-xl font-semibold tracking-[-0.02em]"
      >
        When the last subject is in
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
        A Monte Carlo forecast for each study still enrolling. Every recruiting
        site&apos;s rate is estimated from its own enrollment, shrunk towards
        the study&apos;s sites as a whole, and recruitment is simulated until
        the target is met. P10, P50 and P90 are the dates by which 10%, half and
        90% of the runs have enrolled the last subject.
      </p>
      {forecasts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">
          No study is enrolling at the data cut.
        </p>
      ) : (
        <div className="mt-5 space-y-6">
          {forecasts.map((forecast) => (
            <ForecastCard
              key={forecast.studyId}
              forecast={forecast}
              onWhatIf={onWhatIf}
            />
          ))}
        </div>
      )}
    </section>
  );
}
