"use client";

import { useSyncExternalStore } from "react";
import {
  cashFlow,
  decisionMemo,
  planRoadmap,
  scoreVendors,
  sensitivity,
  tornado,
  type StrategyCashFlow,
  type StrategyScenario,
} from "@/lib/clinical-platform";
import { SYNTHETIC_DATA_NOTICE } from "@/lib/clinical-platform/presets";

const criteria = [
  ["fit", "Functional fit", "Capability"],
  ["cdisc", "CDISC support", "Capability"],
  ["part11", "Part 11 and validation package", "Assurance"],
  ["hosting", "Hosting and data residency", "Assurance"],
  ["integration", "Integration and APIs", "Architecture"],
  ["security", "SOC 2 / ISO 27001 evidence", "Assurance"],
  ["viability", "Vendor viability", "Continuity"],
  ["exit", "Exit and data portability", "Continuity"],
  ["cost", "Cost", "Economics"],
] as const;

const defaults = {
  category: "EDC",
  scenario: {
    criteria: criteria.map(([id, label, group]) => ({
      id,
      label,
      group,
      weight: 1,
    })),
    vendors: [
      {
        id: "a",
        name: "Fictional Cedar",
        ratings: {
          fit: 4,
          cdisc: 4,
          part11: 3,
          hosting: 4,
          integration: 4,
          security: 3,
          viability: 3,
          exit: 4,
          cost: 3,
        },
      },
      {
        id: "b",
        name: "Fictional Granite",
        ratings: {
          fit: 3,
          cdisc: 3,
          part11: 4,
          hosting: 3,
          integration: 3,
          security: 4,
          viability: 4,
          exit: 3,
          cost: 4,
        },
      },
      {
        id: "c",
        name: "Fictional Willow",
        ratings: {
          fit: 5,
          cdisc: 3,
          part11: 2,
          hosting: 3,
          integration: 5,
          security: 3,
          viability: 2,
          exit: 5,
          cost: 2,
        },
      },
    ],
  } as StrategyScenario,
  build: {
    implementation: 700,
    validation: 250,
    annualLicense: 0,
    annualRun: 210,
    annualBenefit: 480,
    decommissionSavings: 80,
    discountRate: 8,
  } as StrategyCashFlow,
  buy: {
    implementation: 300,
    validation: 170,
    annualLicense: 160,
    annualRun: 90,
    annualBenefit: 480,
    decommissionSavings: 80,
    discountRate: 8,
  } as StrategyCashFlow,
  requirementsUnique: false,
  exitAcceptable: true,
  capacity: 4,
  maturity: [2, 2, 3, 2, 1, 2],
  target: [4, 4, 4, 4, 3, 4],
};
type State = typeof defaults;
const hashKey = "strategy=";
const eventName = "strategy-hash-change";
function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(eventName, callback);
  };
}
function snapshot() {
  return window.location.hash;
}
function serverSnapshot() {
  return "";
}
function readState(hash: string): State {
  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const raw = params.get(hashKey.slice(0, -1));
    if (!raw || raw.length > 12000) return defaults;
    const parsed = JSON.parse(raw) as Partial<State>;
    if (
      !parsed.scenario ||
      !Array.isArray(parsed.scenario.criteria) ||
      !Array.isArray(parsed.scenario.vendors)
    )
      return defaults;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
function saveState(state: State) {
  const params = new URLSearchParams();
  params.set("strategy", JSON.stringify(state));
  history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}#${params}`
  );
  window.dispatchEvent(new Event(eventName));
}
const fieldClass =
  "min-w-0 w-full rounded-sm border border-zinc-700 bg-[#0d0e11] px-2 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-amber-400";
const sectionClass =
  "section-isolate min-w-0 border-t border-white/[0.08] py-10";
const buttonClass =
  "border border-amber-500/60 bg-amber-500/10 px-4 py-2 font-mono text-xs uppercase text-amber-200 hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-[0.98]";
const money = (value: number) => `${Math.round(value).toLocaleString()}k`;
const roadmap = [
  {
    id: "contracts",
    label: "Versioned data contracts",
    capability: "Governance",
    effort: 2,
    dependsOn: [],
  },
  {
    id: "metrics",
    label: "Certified metric registry",
    capability: "Analytics",
    effort: 2,
    dependsOn: ["contracts"],
  },
  {
    id: "reports",
    label: "Self-service report catalog",
    capability: "Reporting",
    effort: 2,
    dependsOn: ["metrics"],
  },
  {
    id: "migration",
    label: "Legacy reconciliation",
    capability: "Modernization",
    effort: 3,
    dependsOn: ["contracts"],
  },
  {
    id: "evidence",
    label: "Validation evidence package",
    capability: "Assurance",
    effort: 2,
    dependsOn: ["contracts", "metrics"],
  },
];
const maturityNames = [
  "Governance",
  "Data quality",
  "Architecture",
  "Metadata",
  "Analytics",
  "Security",
];

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StrategyStudio() {
  const hash = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const state = readState(hash);
  const update = (next: State) => saveState(next);
  const scores = scoreVendors(state.scenario);
  const variations = sensitivity(state.scenario);
  const build = cashFlow(state.build),
    buy = cashFlow(state.buy);
  const recommended =
    state.requirementsUnique || !state.exitAcceptable
      ? "Build"
      : build.npv > buy.npv
        ? "Build"
        : "Buy";
  const planned = planRoadmap(roadmap, state.capacity);
  const memo = {
    context: `Synthetic ${state.category} platform decision over five years. All amounts are illustrative thousands of currency units.`,
    options: `Build: TCO ${money(build.totalCost)}, NPV ${money(build.npv)}, ROI ${build.roi === null ? "undefined" : `${build.roi.toFixed(1)}%`}. Buy: TCO ${money(buy.totalCost)}, NPV ${money(buy.npv)}, ROI ${buy.roi === null ? "undefined" : `${buy.roi.toFixed(1)}%`}.`,
    criteria: state.scenario.criteria
      .map((item) => `${item.label} (${item.weight})`)
      .join(", "),
    recommendation: `${recommended} under the selected decision gates and financial assumptions. Highest fictional vendor score: ${scores[0]?.score === null ? "unranked (zero weights)" : `${scores[0]?.name} (${scores[0]?.score?.toFixed(2)}/5)`}.`,
    risks:
      "Verify requirements, assurance evidence, costs, vendor claims and exit terms before any real procurement. Sensitivity changes one weight at a time; estimates are not forecasts.",
  };
  return (
    <div className="space-y-2">
      <section className={sectionClass} aria-labelledby="score-heading">
        <h2
          id="score-heading"
          className="text-2xl font-semibold tracking-[-0.035em]"
        >
          01 / Fictional vendor matrix
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Rate each invented option from 0 to 5. Weights are relative; zero
          weights are excluded. A zero total produces no ranking. Ratings are
          illustrative, not evidence of any vendor capability.
        </p>
        <label className="mt-5 block max-w-xs text-sm" htmlFor="category">
          Platform category
        </label>
        <select
          id="category"
          className={`${fieldClass} mt-2 max-w-xs`}
          value={state.category}
          onChange={(event) =>
            update({ ...state, category: event.target.value })
          }
        >
          {[
            "EDC",
            "Statistical computing",
            "Metadata repository",
            "Clinical data hub",
          ].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left text-sm">
            <caption className="mb-3 text-left text-slate-300">
              {SYNTHETIC_DATA_NOTICE} Scores from 0 to 5; weight from 0 to 10.
            </caption>
            <thead>
              <tr className="border-b border-zinc-700 text-slate-300">
                <th scope="col" className="p-2">
                  Criterion
                </th>
                <th scope="col" className="p-2">
                  Weight
                </th>
                {state.scenario.vendors.map((vendor) => (
                  <th scope="col" className="p-2" key={vendor.id}>
                    {vendor.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.scenario.criteria.map((criterion, index) => (
                <tr key={criterion.id} className="border-b border-zinc-800">
                  <th scope="row" className="min-w-0 p-2 font-normal">
                    <span className="block text-xs text-amber-400">
                      {criterion.group}
                    </span>
                    {criterion.label}
                  </th>
                  <td className="p-2">
                    <input
                      aria-label={`${criterion.label} weight`}
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      className={`${fieldClass} w-20`}
                      value={criterion.weight}
                      onChange={(event) =>
                        update({
                          ...state,
                          scenario: {
                            ...state.scenario,
                            criteria: state.scenario.criteria.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    weight: Number(event.target.value),
                                  }
                                : item
                            ),
                          },
                        })
                      }
                    />
                  </td>
                  {state.scenario.vendors.map((vendor) => (
                    <td key={vendor.id} className="p-2">
                      <input
                        aria-label={`${vendor.name} ${criterion.label} rating`}
                        type="number"
                        min="0"
                        max="5"
                        step="1"
                        className={`${fieldClass} w-20`}
                        value={vendor.ratings[criterion.id] ?? 0}
                        onChange={(event) =>
                          update({
                            ...state,
                            scenario: {
                              ...state.scenario,
                              vendors: state.scenario.vendors.map((item) =>
                                item.id === vendor.id
                                  ? {
                                      ...item,
                                      ratings: {
                                        ...item.ratings,
                                        [criterion.id]: Number(
                                          event.target.value
                                        ),
                                      },
                                    }
                                  : item
                              ),
                            },
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ol
          className="mt-5 grid gap-2 sm:grid-cols-3"
          aria-label="Ranked fictional options"
        >
          {scores.map((vendor) => (
            <li
              key={vendor.id}
              className="min-w-0 border border-zinc-800 bg-[#13151a] p-3"
            >
              <span className="font-semibold">{vendor.name}</span>
              <span className="block font-mono text-amber-300">
                {vendor.score === null
                  ? "Unranked"
                  : `${vendor.score.toFixed(2)} / 5`}
              </span>
            </li>
          ))}
        </ol>
        <h3 className="mt-7 text-lg font-semibold">Weight sensitivity ±25%</h3>
        <p className="text-sm text-slate-300">
          Each row changes one criterion weight while holding the others fixed.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {SYNTHETIC_DATA_NOTICE} Winner after each weight change
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-2">
                  Change
                </th>
                <th scope="col" className="p-2">
                  Winner
                </th>
                <th scope="col" className="p-2">
                  Changed?
                </th>
              </tr>
            </thead>
            <tbody>
              {variations.map((row) => (
                <tr key={row.label} className="border-t border-zinc-800">
                  <th scope="row" className="p-2 font-normal">
                    {row.label}
                  </th>
                  <td className="p-2">{row.winner ?? "Unranked"}</td>
                  <td className="p-2">{row.changed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={sectionClass} aria-labelledby="finance-heading">
        <h2
          id="finance-heading"
          className="text-2xl font-semibold tracking-[-0.035em]"
        >
          02 / Build versus buy
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Decision gates take priority, then the higher five-year NPV wins.
          Positive amounts are costs or benefits in synthetic thousands. Annual
          net cash flow may be negative.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={state.requirementsUnique}
              onChange={(e) =>
                update({ ...state, requirementsUnique: e.target.checked })
              }
            />{" "}
            Requirements require a bespoke build
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={state.exitAcceptable}
              onChange={(e) =>
                update({ ...state, exitAcceptable: e.target.checked })
              }
            />{" "}
            Buy option has an acceptable exit path
          </label>
        </div>
        <p className="mt-4 border-l-2 border-amber-500 pl-3 font-mono text-sm text-amber-200">
          Decision tree: {recommended}.{" "}
          {state.requirementsUnique
            ? "Bespoke requirements gate."
            : !state.exitAcceptable
              ? "Exit path gate."
              : "Higher NPV under these assumptions."}
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {(["build", "buy"] as const).map((option) => {
            const result = option === "build" ? build : buy;
            return (
              <div
                key={option}
                className="min-w-0 border border-zinc-800 bg-[#13151a] p-4"
              >
                <h3 className="text-lg font-semibold capitalize">{option}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      "implementation",
                      "validation",
                      "annualLicense",
                      "annualRun",
                      "annualBenefit",
                      "decommissionSavings",
                      "discountRate",
                    ] as const
                  ).map((key) => (
                    <label
                      key={key}
                      className="min-w-0 text-xs capitalize text-slate-300"
                    >
                      {key.replace(/([A-Z])/g, " $1")}{" "}
                      {key === "discountRate" ? "(%)" : "(k)"}
                      <input
                        className={`${fieldClass} mt-1`}
                        type="number"
                        step="10"
                        value={state[option][key]}
                        onChange={(e) =>
                          update({
                            ...state,
                            [option]: {
                              ...state[option],
                              [key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-zinc-700 pt-4 text-sm">
                  <div>
                    <dt>TCO</dt>
                    <dd className="font-mono text-amber-300">
                      {money(result.totalCost)}
                    </dd>
                  </div>
                  <div>
                    <dt>NPV</dt>
                    <dd className="font-mono text-amber-300">
                      {money(result.npv)}
                    </dd>
                  </div>
                  <div>
                    <dt>ROI</dt>
                    <dd className="font-mono text-amber-300">
                      {result.roi === null
                        ? "Undefined"
                        : `${result.roi.toFixed(1)}%`}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <caption className="text-left text-slate-300">
                      {SYNTHETIC_DATA_NOTICE} Five-year cash flow, {option} (k)
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Year</th>
                        <th scope="col">Net</th>
                        <th scope="col">Discounted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.annual.map((row) => (
                        <tr key={row.year}>
                          <th scope="row" className="py-1">
                            {row.year}
                          </th>
                          <td>{money(row.net)}</td>
                          <td>{money(row.discounted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
        <h3 className="mt-7 text-lg font-semibold">
          NPV drivers / 20% assumption change
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(["build", "buy"] as const).map((option) => (
            <div key={option} className="min-w-0">
              <h4 className="mb-2 capitalize">{option}</h4>
              {tornado(state[option]).map((driver) => (
                <div key={driver.label} className="mb-2">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="capitalize">{driver.label}</span>
                    <span className="font-mono">
                      {driver.impact >= 0 ? "+" : ""}
                      {money(driver.impact)}
                    </span>
                  </div>
                  <div aria-hidden="true" className="mt-1 h-2 bg-zinc-800">
                    <div
                      className={`h-full ${driver.impact >= 0 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{
                        width: `${Math.min(100, (Math.abs(driver.impact) / (Math.abs(tornado(state[option])[0]?.impact ?? 0) || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section className={sectionClass} aria-labelledby="roadmap-heading">
        <h2
          id="roadmap-heading"
          className="text-2xl font-semibold tracking-[-0.035em]"
        >
          03 / Dependency-aware roadmap
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Seeded from the platform plan. Dependencies must be scheduled first;
          capacity is an effort-unit budget in each horizon.
        </p>
        <label className="mt-4 block max-w-xs text-sm">
          Capacity per horizon
          <input
            className={`${fieldClass} mt-2`}
            type="number"
            min="0"
            max="12"
            value={state.capacity}
            onChange={(e) =>
              update({
                ...state,
                capacity: Math.max(0, Number(e.target.value)),
              })
            }
          />
        </label>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {planned.horizons.map((column) => (
            <div
              key={column.horizon}
              className="min-w-0 border border-zinc-800 bg-[#13151a] p-4"
            >
              <h3 className="font-mono text-amber-300">
                {column.horizon} / {column.used} units
              </h3>
              <ul className="mt-3 space-y-3">
                {column.items.map((item) => (
                  <li
                    key={item.id}
                    className="border-l-2 border-emerald-500 pl-3"
                  >
                    <strong>{item.label}</strong>
                    <span className="block text-xs text-slate-300">
                      Moves {item.capability} · {item.effort} units · after{" "}
                      {item.dependsOn.join(", ") || "none"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {planned.blocked.length > 0 && (
          <p className="mt-4 text-amber-200">
            Unscheduled at this capacity:{" "}
            {planned.blocked.map((item) => item.label).join(", ")}.
          </p>
        )}
      </section>
      <section className={sectionClass} aria-labelledby="maturity-heading">
        <h2
          id="maturity-heading"
          className="text-2xl font-semibold tracking-[-0.035em]"
        >
          04 / Maturity self-assessment
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Illustrative DAMA-DMBOK-aligned knowledge areas and analytics
          capability. Score current and target from 0 to 5; these are
          self-reported, not audited.
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            {maturityNames.map((name, i) => (
              <div
                key={name}
                className="grid min-w-0 grid-cols-[1fr_5rem_5rem] items-center gap-2 text-sm"
              >
                <span>{name}</span>
                {(["maturity", "target"] as const).map((key) => (
                  <label key={key} className="text-xs text-slate-300">
                    {key === "maturity" ? "Current" : "Target"}
                    <input
                      aria-label={`${name} ${key}`}
                      className={`${fieldClass} mt-1`}
                      type="number"
                      min="0"
                      max="5"
                      value={state[key][i]}
                      onChange={(e) =>
                        update({
                          ...state,
                          [key]: state[key].map((value, index) =>
                            index === i
                              ? Math.min(
                                  5,
                                  Number(e.target.value) < 0
                                    ? 0
                                    : Number(e.target.value)
                                )
                              : value
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
          <div className="min-w-0 border border-zinc-800 bg-[#13151a] p-4">
            <svg
              viewBox="0 0 300 300"
              role="img"
              aria-label="Radar chart of current and target maturity. Exact scores are in the adjacent inputs."
              className="mx-auto w-full max-w-[300px]"
            >
              <g transform="translate(150 150)">
                {[1, 2, 3, 4, 5].map((ring) => (
                  <circle
                    key={ring}
                    r={ring * 22}
                    fill="none"
                    stroke="#3f3f46"
                  />
                ))}
                {maturityNames.map((_, i) => {
                  const angle = (i * Math.PI) / 3 - Math.PI / 2;
                  return (
                    <line
                      key={i}
                      x2={Math.cos(angle) * 110}
                      y2={Math.sin(angle) * 110}
                      stroke="#52525b"
                    />
                  );
                })}
                {(["target", "maturity"] as const).map((key) => (
                  <polygon
                    key={key}
                    points={state[key]
                      .map((value, i) => {
                        const angle = (i * Math.PI) / 3 - Math.PI / 2;
                        return `${Math.cos(angle) * value * 22},${Math.sin(angle) * value * 22}`;
                      })
                      .join(" ")}
                    fill={key === "target" ? "#10b98133" : "#f59e0b44"}
                    stroke={key === "target" ? "#10b981" : "#f59e0b"}
                    strokeWidth="2"
                  />
                ))}
              </g>
            </svg>
            <p className="text-center text-xs text-slate-300">
              <span className="text-amber-400">■</span> Current　
              <span className="text-emerald-400">■</span> Target
            </p>
          </div>
        </div>
      </section>
      <section className={sectionClass} aria-labelledby="memo-heading">
        <h2
          id="memo-heading"
          className="text-2xl font-semibold tracking-[-0.035em]"
        >
          05 / Decision memo
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          One-page HTML or Markdown generated locally from the current inputs.
          The HTML has print styles; use your browser’s Print command for a
          one-page handoff.
        </p>
        <article className="mt-5 min-w-0 border border-zinc-800 bg-[#13151a] p-5">
          <h3 className="text-xl font-semibold">
            Synthetic platform decision memo
          </h3>
          <p className="mt-2 text-xs text-amber-300">{SYNTHETIC_DATA_NOTICE}</p>
          {Object.entries(memo).map(([label, value]) => (
            <div key={label} className="mt-4">
              <h4 className="font-semibold capitalize">{label}</h4>
              <p className="break-words text-sm text-slate-300">{value}</p>
            </div>
          ))}
        </article>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              download(
                "synthetic-strategy-memo.html",
                decisionMemo(memo, "html"),
                "text/html"
              )
            }
          >
            Download HTML
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() =>
              download(
                "synthetic-strategy-memo.md",
                decisionMemo(memo, "markdown"),
                "text/markdown"
              )
            }
          >
            Download Markdown
          </button>
        </div>
      </section>
    </div>
  );
}
