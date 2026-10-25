import type {
  CsmResult,
  KriStatus,
  OperationsKri,
  OperationsRisk,
  OperationsScope,
  QtlStatus,
  RiskSignalLogEntry,
} from "@/lib/clinical-platform";

const ISSUES_URL = "https://github.com/fderuiter/deruiter.dev/issues";

/** Each status has its own shape and word, so none is told by color alone. */
const KRI_STATUS: Readonly<
  Record<KriStatus, { label: string; glyph: string; cell: string }>
> = {
  red: {
    label: "Red",
    glyph: "▲",
    cell: "bg-red-500/15 text-red-200",
  },
  amber: {
    label: "Amber",
    glyph: "◆",
    cell: "bg-amber-500/10 text-amber-200",
  },
  green: {
    label: "Green",
    glyph: "●",
    cell: "text-emerald-300",
  },
  "insufficient-data": {
    label: "Too little data",
    glyph: "○",
    cell: "text-slate-400",
  },
};

const KRI_ORDER: readonly KriStatus[] = [
  "red",
  "amber",
  "green",
  "insufficient-data",
];

const QTL_STATUS: Readonly<
  Record<QtlStatus, { label: string; glyph: string; text: string }>
> = {
  breached: { label: "Breached", glyph: "▲", text: "text-red-200" },
  warning: { label: "Warning", glyph: "◆", text: "text-amber-200" },
  within: { label: "Within limits", glyph: "●", text: "text-emerald-300" },
  "no-data": { label: "No data", glyph: "○", text: "text-slate-400" },
};

const SECTION = "min-w-0 border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6";
/** A scrollable, focusable table region; callers add its margin. */
const REGION =
  "overflow-auto border border-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";
const TH = "px-3 py-2 font-medium text-slate-300";
const LINK =
  "text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

/** A p- or q-value, in scientific notation once it is below 0.001. */
function probability(value: number): string {
  return value < 0.001 ? value.toExponential(1) : value.toFixed(3);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-xl font-semibold tracking-[-0.02em]">
      {children}
    </h2>
  );
}

function Overview({ risk }: { risk: OperationsRisk }) {
  const cells = risk.kris.flatMap((kri) => kri.cells);
  const count = (status: KriStatus) =>
    cells.filter((cell) => cell.status === status).length;
  const qtls = risk.qtls.filter(
    (qtl) => qtl.status === "breached" || qtl.status === "warning"
  ).length;
  const flagged = new Set(
    risk.csm.results.filter((r) => r.flagged).map((r) => r.siteId)
  ).size;
  const raised = new Set(risk.log.map((entry) => entry.signalId)).size;
  const facts: [string, number, string][] = [
    ["Sites assessed", risk.sites.length, "activated sites in scope"],
    ["Red KRIs", count("red"), "site and indicator pairs"],
    ["Amber KRIs", count("amber"), "site and indicator pairs"],
    ["QTLs past a limit", qtls, `of ${risk.qtls.length}, study level`],
    ["Sites that stand out", flagged, "in central monitoring"],
    ["Signals raised", raised, "at the data cut"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px border border-white/[0.08] bg-white/[0.08] @3xl:grid-cols-3 @5xl:grid-cols-6">
      {facts.map(([term, value, unit]) => (
        <div key={term} className="min-w-0 bg-[#0d0e11] p-3">
          <dt className="text-xs text-slate-400">{term}</dt>
          <dd className="mt-1">
            <span className="font-mono text-2xl font-semibold tabular-nums tracking-[-0.02em] text-[#f4f4f6]">
              {value.toLocaleString("en-US")}
            </span>
            <span className="block text-[11px] text-slate-400">{unit}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Qtls({ risk, narrowed }: { risk: OperationsRisk; narrowed: boolean }) {
  return (
    <section aria-labelledby="risk-qtls" className={SECTION}>
      <Heading id="risk-qtls">Quality tolerance limits</Heading>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Study-level limits from {risk.studyId}&apos;s quality plan. Past the
        secondary limit the study team reviews the parameter; past the tolerance
        limit it carries out the response planned in advance.
        {narrowed &&
          " A limit applies to the whole study, so these are not narrowed to the scope."}
      </p>
      <div
        className={`${REGION} mt-4`}
        tabIndex={0}
        role="region"
        aria-label="Quality tolerance limits"
      >
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            {`${risk.studyId} quality tolerance limits, with their values, limits and status`}
          </caption>
          <thead className="bg-[#13151a]">
            <tr>
              <th scope="col" className={TH}>
                Parameter
              </th>
              <th scope="col" className={TH}>
                Value
              </th>
              <th scope="col" className={TH}>
                Secondary limit
              </th>
              <th scope="col" className={TH}>
                Tolerance limit
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {risk.qtls.map((qtl) => {
              const status = QTL_STATUS[qtl.status];
              return (
                <tr key={qtl.id} className="border-t border-white/[0.06]">
                  <th
                    scope="row"
                    className="min-w-48 px-3 py-1.5 font-normal text-slate-100"
                  >
                    {qtl.name}
                  </th>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200">
                    {qtl.value}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200">
                    {qtl.secondaryLimit}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200">
                    {qtl.limit}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-1.5 font-mono ${status.text}`}
                  >
                    <span aria-hidden="true">{status.glyph} </span>
                    {status.label}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="mt-2 border border-white/[0.08] bg-[#13151a]">
        <summary className="cursor-pointer px-3 py-2 text-xs text-slate-300 marker:text-slate-500">
          Why each limit, and the planned response
        </summary>
        <dl className="space-y-3 border-t border-white/[0.08] px-3 py-3 text-xs leading-relaxed">
          {risk.qtls.map((qtl) => (
            <div key={qtl.id} className="min-w-0 break-words">
              <dt className="font-medium text-slate-100">{qtl.name}</dt>
              <dd className="mt-1 text-slate-300">{qtl.rationale}</dd>
              <dd className="mt-1 text-slate-300">
                <span className="text-slate-400">Planned response: </span>
                {qtl.response}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

function Legend() {
  return (
    <ul
      aria-label="KRI status key"
      className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300"
    >
      {KRI_ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={KRI_STATUS[status].cell}>
            {KRI_STATUS[status].glyph}
          </span>
          {KRI_STATUS[status].label}
        </li>
      ))}
    </ul>
  );
}

function KriCell({ kri, siteId }: { kri: OperationsKri; siteId: string }) {
  const cell = kri.cells.find((c) => c.siteId === siteId);
  if (cell === undefined) {
    return <td className="px-3 py-1.5 text-slate-500">Not assessed</td>;
  }
  const status = KRI_STATUS[cell.status];
  return (
    <td className={`whitespace-nowrap px-3 py-1.5 ${status.cell}`}>
      <span className="block font-mono text-slate-100">{cell.text}</span>
      <span className="block text-[11px]">
        <span aria-hidden="true">{status.glyph} </span>
        {status.label}
      </span>
    </td>
  );
}

function Kris({
  risk,
  siteHref,
}: {
  risk: OperationsRisk;
  siteHref: (scope: OperationsScope) => string;
}) {
  return (
    <section aria-labelledby="risk-kris" className={SECTION}>
      <Heading id="risk-kris">Key risk indicators by site</Heading>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Each indicator is a governed registry metric evaluated per site, with
        the thresholds at which it turns amber and red. A site with too few
        subjects or visits for the indicator to mean anything is not rated.
      </p>
      <Legend />
      {risk.sites.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">
          No site in scope has been activated, so there is nothing to assess.
        </p>
      ) : (
        <div
          className={`${REGION} mt-4 max-h-[36rem]`}
          tabIndex={0}
          role="region"
          aria-label="Key risk indicators by site"
        >
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              {`Key risk indicators for ${plural(risk.sites.length, "site")}, one row per site, with each value and its status`}
            </caption>
            <thead className="sticky top-0 z-10 bg-[#13151a]">
              <tr>
                <th scope="col" className={`${TH} sticky left-0 bg-[#13151a]`}>
                  Site
                </th>
                {risk.kris.map((kri) => (
                  <th
                    key={kri.id}
                    scope="col"
                    className={`${TH} min-w-28 align-bottom`}
                  >
                    {kri.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risk.sites.map((site) => (
                <tr key={site.id} className="border-t border-white/[0.06]">
                  <th
                    scope="row"
                    className="sticky left-0 whitespace-nowrap bg-[#0d0e11] px-3 py-1.5 font-mono font-normal"
                  >
                    <a href={siteHref(site.scope)} className={LINK}>
                      {site.id}
                    </a>
                  </th>
                  {risk.kris.map((kri) => (
                    <KriCell key={kri.id} kri={kri} siteId={site.id} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="mt-2 border border-white/[0.08] bg-[#13151a]">
        <summary className="cursor-pointer px-3 py-2 text-xs text-slate-300 marker:text-slate-500">
          Thresholds, and why
        </summary>
        <dl className="space-y-3 border-t border-white/[0.08] px-3 py-3 text-xs leading-relaxed">
          {risk.kris.map((kri) => (
            <div key={kri.id} className="min-w-0 break-words">
              <dt className="font-medium text-slate-100">
                {kri.name}{" "}
                <span className="font-mono font-normal text-slate-400">
                  ({kri.metricId})
                </span>
              </dt>
              <dd className="mt-1 text-slate-200">
                {kri.thresholds} Rated once a site has at least {kri.minimum}.
              </dd>
              <dd className="mt-1 text-slate-300">{kri.reason}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

function testName(risk: OperationsRisk, testId: string): string {
  return risk.csm.tests.find((t) => t.id === testId)?.name ?? testId;
}

function Flagged({
  risk,
  flagged,
}: {
  risk: OperationsRisk;
  flagged: readonly CsmResult[];
}) {
  if (flagged.length === 0) {
    return (
      <p className="mt-4 border-l-2 border-emerald-500 pl-3 text-sm text-slate-200">
        No site in scope stands out from its peers at a false discovery rate of{" "}
        {risk.csm.fdr}.
      </p>
    );
  }
  return (
    <ul className="mt-4 space-y-2">
      {flagged.map((result) => (
        <li
          key={`${result.siteId}-${result.testId}`}
          className="min-w-0 border-l-2 border-red-400 bg-[#13151a] px-3 py-2 text-xs leading-relaxed"
        >
          <p className="break-words">
            <span className="font-mono text-amber-300">{result.siteId}</span>
            <span className="text-slate-400"> · </span>
            <span className="font-medium text-slate-100">
              {testName(risk, result.testId)}
            </span>
          </p>
          <p className="mt-1 break-words text-slate-300">{result.detail}</p>
          <p className="mt-1 font-mono text-slate-400">
            p = {probability(result.pValue)}, q = {probability(result.qValue)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Csm({ risk }: { risk: OperationsRisk }) {
  const { csm } = risk;
  const flagged = csm.results.filter((r) => r.flagged);
  const result = (siteId: string, testId: string) =>
    csm.results.find((r) => r.siteId === siteId && r.testId === testId);
  return (
    <section aria-labelledby="risk-csm" className={SECTION}>
      <Heading id="risk-csm">Central statistical monitoring</Heading>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Each test compares a site with the study&apos;s other sites. The
        p-values are adjusted across every test at every site of the study
        (Benjamini-Hochberg), and a site stands out when its adjusted q-value is
        at most {csm.fdr}. {plural(csm.sites.length, "site")} in scope had
        enough data to test.
      </p>
      <Flagged risk={risk} flagged={flagged} />
      {csm.excluded.length > 0 && (
        <div className="mt-4 text-xs text-slate-300">
          <p className="font-medium text-slate-200">Not tested</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {csm.excluded.map((e) => (
              <li
                key={`${e.siteId ?? "all"}-${e.testId ?? "all"}`}
                className="break-words"
              >
                {e.siteId !== null && (
                  <span className="font-mono text-slate-200">{e.siteId}: </span>
                )}
                {e.testId !== null && (
                  <span className="text-slate-200">
                    {testName(risk, e.testId)}:{" "}
                  </span>
                )}
                {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {csm.sites.length > 0 && (
        <details className="mt-4 border border-white/[0.08] bg-[#13151a]">
          <summary className="cursor-pointer px-3 py-2 text-xs text-slate-300 marker:text-slate-500">
            Every test at every site
          </summary>
          <div
            className={`${REGION} m-3 max-h-[32rem]`}
            tabIndex={0}
            role="region"
            aria-label="Central monitoring q-values by site"
          >
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                Adjusted q-values of every central monitoring test at every site
                tested, with the ones that stand out marked
              </caption>
              <thead className="sticky top-0 z-10 bg-[#13151a]">
                <tr>
                  <th
                    scope="col"
                    className={`${TH} sticky left-0 bg-[#13151a]`}
                  >
                    Site
                  </th>
                  {csm.tests.map((test) => (
                    <th key={test.id} scope="col" className={`${TH} min-w-28`}>
                      {test.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csm.sites.map((siteId) => (
                  <tr key={siteId} className="border-t border-white/[0.06]">
                    <th
                      scope="row"
                      className="sticky left-0 whitespace-nowrap bg-[#0d0e11] px-3 py-1.5 font-mono font-normal text-slate-100"
                    >
                      {siteId}
                    </th>
                    {csm.tests.map((test) => {
                      const r = result(siteId, test.id);
                      return (
                        <td
                          key={test.id}
                          className={`whitespace-nowrap px-3 py-1.5 font-mono ${
                            r?.flagged
                              ? "bg-red-500/15 text-red-200"
                              : "text-slate-300"
                          }`}
                        >
                          {r === undefined ? (
                            "Not tested"
                          ) : (
                            <>
                              {r.flagged && <span aria-hidden="true">▲ </span>}
                              {probability(r.qValue)}
                              {r.flagged && (
                                <span className="sr-only"> (stands out)</span>
                              )}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <details className="mt-2 border border-white/[0.08] bg-[#13151a]">
        <summary className="cursor-pointer px-3 py-2 text-xs text-slate-300 marker:text-slate-500">
          What each test asks, and how
        </summary>
        <dl className="space-y-3 border-t border-white/[0.08] px-3 py-3 text-xs leading-relaxed">
          {csm.tests.map((test) => (
            <div key={test.id} className="min-w-0 break-words">
              <dt className="font-medium text-slate-100">{test.name}</dt>
              <dd className="mt-1 text-slate-200">{test.question}</dd>
              <dd className="mt-1 text-slate-300">{test.method}</dd>
              <dd className="mt-1 break-all font-mono text-slate-400">
                Reads {test.reads.join(", ")}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

const EVENT_LABEL: Readonly<Record<RiskSignalLogEntry["event"], string>> = {
  raised: "Raised",
  assessed: "Assessed",
  actioned: "Actioned",
  closed: "Closed",
};

function SignalLog({ risk }: { risk: OperationsRisk }) {
  return (
    <section aria-labelledby="risk-signals" className={SECTION}>
      <Heading id="risk-signals">Risk signal log</Heading>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Red KRIs, QTL warnings and breaches, and sites that stand out are raised
        as signals in an append-only log, where each is assessed, actioned and
        closed in turn. This synthetic portfolio is one data cut, so every
        signal is newly raised.
      </p>
      {risk.log.length === 0 ? (
        <p className="mt-4 border-l-2 border-emerald-500 pl-3 text-sm text-slate-200">
          No signals in scope at the data cut.
        </p>
      ) : (
        <div
          className={`${REGION} mt-4`}
          tabIndex={0}
          role="region"
          aria-label="Risk signal log"
        >
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">
              {`${plural(risk.log.length, "entry", "entries")} of the ${risk.studyId} risk signal log, in order`}
            </caption>
            <thead className="bg-[#13151a]">
              <tr>
                <th scope="col" className={TH}>
                  #
                </th>
                <th scope="col" className={TH}>
                  Signal
                </th>
                <th scope="col" className={TH}>
                  Event
                </th>
                <th scope="col" className={TH}>
                  On
                </th>
                <th scope="col" className={TH}>
                  By
                </th>
                <th scope="col" className={TH}>
                  What was found
                </th>
              </tr>
            </thead>
            <tbody>
              {risk.log.map((entry) => (
                <tr
                  key={entry.sequence}
                  className="border-t border-white/[0.06] align-top"
                >
                  <td className="px-3 py-1.5 font-mono text-slate-400">
                    {entry.sequence}
                  </td>
                  <th
                    scope="row"
                    className="whitespace-nowrap px-3 py-1.5 font-mono font-normal text-slate-100"
                  >
                    {entry.signalId}
                  </th>
                  <td className="px-3 py-1.5 text-slate-200">
                    {EVENT_LABEL[entry.event]}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-200">
                    {entry.on}
                  </td>
                  <td className="min-w-32 px-3 py-1.5 text-slate-300">
                    {entry.by}
                  </td>
                  <td className="min-w-72 px-3 py-1.5 leading-relaxed text-slate-200">
                    {entry.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Plan({ risk }: { risk: OperationsRisk }) {
  return (
    <section aria-labelledby="risk-plan" className={SECTION}>
      <Heading id="risk-plan">Critical-to-quality factors</Heading>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        What {risk.studyId}&apos;s quality plan (version {risk.planVersion},
        effective{" "}
        <time dateTime={risk.planEffectiveOn}>{risk.planEffectiveOn}</time>)
        protects under ICH E8(R1), and the indicators and limits that watch each
        factor. The plan is synthetic, for a fictional study.
      </p>
      <ul className="mt-4 grid gap-3 @3xl:grid-cols-2">
        {risk.factors.map((factor) => (
          <li
            key={factor.id}
            className="min-w-0 break-words border border-white/[0.08] bg-[#13151a] p-3 text-xs leading-relaxed"
          >
            <p className="text-sm font-medium text-slate-100">{factor.name}</p>
            <p className="mt-1 text-slate-300">{factor.risk}</p>
            {factor.kris.length > 0 && (
              <p className="mt-2 text-slate-300">
                <span className="text-slate-400">KRIs: </span>
                {factor.kris.join(", ")}
              </p>
            )}
            {factor.qtls.length > 0 && (
              <p className="mt-1 text-slate-300">
                <span className="text-slate-400">QTLs: </span>
                {factor.qtls.join(", ")}
              </p>
            )}
            {factor.gap !== null && (
              <p className="mt-2 border-l-2 border-dashed border-white/[0.2] pl-2 text-slate-300">
                Not watched yet. {factor.gap.reason}{" "}
                <a href={`${ISSUES_URL}/${factor.gap.issue}`} className={LINK}>
                  Planned in #{factor.gap.issue}
                </a>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The Risk tab of the operations dashboard (#2631): an overview, the
 * study's quality tolerance limits, every key risk indicator at every site
 * in scope, central statistical monitoring with its false discovery
 * control, the risk signal log and the quality plan behind them. Every
 * status carries a shape and a word as well as a color, and every grid is a
 * table.
 *
 * @param risk - The Risk tab's content, from `operationsDashboard`.
 * @param narrowed - Whether the dashboard is drilled below the study, so
 *   the study-level limits say they are not narrowed.
 * @param siteHref - The address of a scope, for the links that drill the
 *   dashboard into a site.
 */
export function RbqmRiskView({
  risk,
  narrowed,
  siteHref,
}: {
  risk: OperationsRisk;
  narrowed: boolean;
  siteHref: (scope: OperationsScope) => string;
}) {
  return (
    <div className="@container space-y-6">
      <Overview risk={risk} />
      <Qtls risk={risk} narrowed={narrowed} />
      <Kris risk={risk} siteHref={siteHref} />
      <Csm risk={risk} />
      <SignalLog risk={risk} />
      <Plan risk={risk} />
    </div>
  );
}
