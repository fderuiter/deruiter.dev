"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FieldManualButton } from "@/components/FieldManualButton";
import { downloadFile } from "@/lib/download";
import { clamp } from "@/lib/game-utils";
import {
  CLOSING_NOTE,
  COMPANION_POST_PATH,
  DIARY_INTRO,
  DILEMMA_WINDOW_LONG_SEC,
  DILEMMA_WINDOW_SEC,
  MAX_ITEMS_PER_ORDER,
  MAX_OPEN_ORDERS,
  MENU_ITEM_LABELS,
  ORDERABLE_ITEMS,
  SCENARIO_LIMITS,
  SCENARIO_PRESETS,
  WEEK_DAYS,
  carryMeters,
  computePayStub,
  exportShiftTelemetryCsv,
  exportShiftTelemetryJson,
  formatCents,
  getDilemmaDiaryLines,
  getShiftEnding,
  getWeekDay,
  getWeekDayDiaryLines,
  getWeekEnding,
  getWeekNetCents,
  isStandardScenario,
  isWeekOver,
  scoreWeek,
  scoreShift,
  describeShiftScore,
  type CustomOrderTemplate,
  type MenuItemId,
  type ModifierId,
  type ScenarioId,
  type ShiftConfig,
  type ShiftLogEntry,
  type ShiftScenario,
  type ShiftState,
  type WeekDayResult,
  type WeekState,
} from "@/lib/patty-drive-thru";

const PAGE_CLASS =
  "pdt-diary mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4 rounded-md border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] p-5 text-[var(--pdt-paper-ink)] sm:p-7";

/** The bump-bar yellow button that starts a shift. */
function ShiftButton({
  ref,
  onClick,
  children,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="min-h-12 rounded border-2 border-[var(--pdt-bump-edge)] bg-[var(--pdt-bump)] px-5 font-mono text-sm font-bold uppercase tracking-wide text-[var(--pdt-ink)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
    >
      {children}
    </button>
  );
}

/** A quieter outlined button for the second choice on a page. */
function SecondaryButton({
  onClick,
  children,
  testId,
}: {
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="min-h-12 rounded border-2 border-[var(--pdt-paper-rule)] px-4 font-mono text-xs font-bold uppercase tracking-wide active:scale-[0.98] hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
    >
      {children}
    </button>
  );
}

/** Moves focus to a page's main button when the page appears. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

/** An interactive dial input for shift configuration that allows free typing before clamping on blur/submit. */
function DialInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  testId: string;
}) {
  const [inputValue, setInputValue] = useState<string>(String(value));
  const [prevValue, setPrevValue] = useState<number>(value);

  if (prevValue !== value) {
    setPrevValue(value);
    setInputValue(String(value));
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      const clamped = min;
      setInputValue(String(clamped));
      onChange(clamped);
    } else {
      const clamped = clamp(parsed, min, max);
      setInputValue(String(clamped));
      onChange(clamped);
    }
  };

  return (
    <label className="flex flex-col gap-1 font-mono">
      <span className="text-[11px] font-semibold">
        {label} [{min} - {max}]
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className="rounded border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] px-2 py-1 text-xs font-mono text-[var(--pdt-paper-ink)]"
        data-testid={testId}
      />
    </label>
  );
}

/** The diary page shown before the player clocks in (#1814). */
export function DiaryIntroPage({
  onClockIn,
  onStartWeek,
  onResumeWeek,
  savedWeek = null,
  longerDilemmas = false,
  onLongerDilemmasChange,
}: {
  onClockIn: (
    scenario: ScenarioId,
    customConfig?: Partial<ShiftConfig>
  ) => void;
  /** True when dilemmas give the longer answer window (#2087). */
  longerDilemmas?: boolean;
  /** Turns the longer dilemma window on or off. */
  onLongerDilemmasChange?: (longer: boolean) => void;
  /** Starts a new week of shifts, Monday to Friday (#2086). */
  onStartWeek?: () => void;
  /** Picks a saved week back up at its next day. */
  onResumeWeek?: (week: WeekState) => void;
  /** A half-finished week saved in this browser, or null. */
  savedWeek?: WeekState | null;
}) {
  const buttonRef = useFocusOnMount<HTMLButtonElement>();
  const [scenario, setScenario] = useState<ScenarioId | "week">("standard");

  const [customDials, setCustomDials] = useState<
    Record<keyof ShiftScenario, number>
  >({
    arrivalGapMinSec: 6,
    arrivalGapMaxSec: 12,
    firstArrivalSec: 2,
    sosLossExpired: 15,
    sosLossLate: 5,
    sosGainOnTime: 2,
    sosGainFast: 3,
    idleGraceSec: 6,
    idleRatePerSec: 12,
    dispenserFailChance: 0.4,
  });

  const [customOrders, setCustomOrders] = useState<CustomOrderTemplate[]>([
    {
      items: [
        { itemId: "burger", modifier: "no-pickles" },
        { itemId: "soda", modifier: null },
      ],
    },
    {
      items: [
        { itemId: "cheeseburger", modifier: null },
        { itemId: "fries", modifier: null },
        { itemId: "shake", modifier: null },
      ],
    },
  ]);

  const [drawerOpen, setDrawerOpen] = useState(true);

  const resumable =
    savedWeek && !isWeekOver(savedWeek) && onResumeWeek ? savedWeek : null;

  const handleDialChange = (key: keyof ShiftScenario, rawValue: number) => {
    setCustomDials((prev) => ({ ...prev, [key]: rawValue }));
  };

  const handleAddOrder = () => {
    if (customOrders.length >= MAX_OPEN_ORDERS) return;
    setCustomOrders((prev) => [
      ...prev,
      {
        items: [{ itemId: "burger", modifier: null }],
      },
    ]);
  };

  const handleRemoveOrder = (orderIndex: number) => {
    if (customOrders.length <= 1) return;
    setCustomOrders((prev) => prev.filter((_, idx) => idx !== orderIndex));
  };

  const handleAddItem = (orderIndex: number) => {
    setCustomOrders((prev) =>
      prev.map((order, idx) => {
        if (idx !== orderIndex) return order;
        if (order.items.length >= MAX_ITEMS_PER_ORDER) return order;
        return {
          ...order,
          items: [...order.items, { itemId: "fries", modifier: null }],
        };
      })
    );
  };

  const handleRemoveItem = (orderIndex: number, itemIndex: number) => {
    setCustomOrders((prev) =>
      prev.map((order, idx) => {
        if (idx !== orderIndex) return order;
        if (order.items.length <= 1) return order;
        return {
          ...order,
          items: order.items.filter((_, iIdx) => iIdx !== itemIndex),
        };
      })
    );
  };

  const handleUpdateItem = (
    orderIndex: number,
    itemIndex: number,
    itemId: MenuItemId,
    modifier: ModifierId | null
  ) => {
    setCustomOrders((prev) =>
      prev.map((order, idx) => {
        if (idx !== orderIndex) return order;
        return {
          ...order,
          items: order.items.map((item, iIdx) =>
            iIdx === itemIndex ? { itemId, modifier } : item
          ),
        };
      })
    );
  };

  const start = () => {
    if (scenario === "week") {
      onStartWeek?.();
    } else if (scenario === "custom") {
      const clampedDials = (
        Object.keys(SCENARIO_LIMITS) as Array<keyof ShiftScenario>
      ).reduce(
        (acc, key) => {
          const [min, max] = SCENARIO_LIMITS[key];
          const val = customDials[key];
          acc[key] =
            typeof val === "number" && !isNaN(val) ? clamp(val, min, max) : min;
          return acc;
        },
        {} as Record<keyof ShiftScenario, number>
      );

      onClockIn("custom", {
        ...clampedDials,
        customOrders,
      });
    } else {
      onClockIn(scenario);
    }
  };

  const dialLabels: Record<keyof ShiftScenario, string> = {
    arrivalGapMinSec: "Min Arrival Gap (sec)",
    arrivalGapMaxSec: "Max Arrival Gap (sec)",
    firstArrivalSec: "First Arrival Delay (sec)",
    sosLossExpired: "SOS Loss (Expired)",
    sosLossLate: "SOS Loss (Late)",
    sosGainOnTime: "SOS Gain (On Time)",
    sosGainFast: "SOS Gain (Fast)",
    idleGraceSec: "Idle Grace Period (sec)",
    idleRatePerSec: "Idle Rate (/sec)",
    dispenserFailChance: "Dispenser Failure Rate (0-1)",
  };

  return (
    <article
      className={`${PAGE_CLASS} @3xl:max-w-4xl`}
      aria-labelledby="pdt-intro-title"
      data-testid="pdt-intro"
    >
      <header>
        <h2
          id="pdt-intro-title"
          className="font-mono text-2xl font-extrabold tracking-[-0.035em]"
        >
          {DIARY_INTRO.title}
        </h2>
        <p className="mt-1 font-mono text-xs uppercase tracking-wider text-[var(--pdt-paper-dim)]">
          {DIARY_INTRO.dateline}
        </p>
      </header>
      {/* Two columns on a wide cabinet, so Clock in sits above the fold
          at 1024 and 1280 (#1938). */}
      <div className="grid min-w-0 gap-4 @3xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
          {DIARY_INTRO.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="min-w-0 space-y-3">
          <fieldset className="min-w-0 space-y-1" data-testid="pdt-scenarios">
            <legend className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]">
              Which shift?
            </legend>
            {SCENARIO_PRESETS.map((preset) => (
              <label
                key={preset.id}
                className="flex min-h-11 cursor-pointer items-start gap-2 py-1 text-sm"
              >
                <input
                  type="radio"
                  name="pdt-scenario"
                  value={preset.id}
                  checked={scenario === preset.id}
                  onChange={() => setScenario(preset.id)}
                  className="mt-1 size-4 shrink-0"
                />
                <span className="min-w-0 break-words">
                  <span className="font-bold">{preset.label}.</span>{" "}
                  {preset.blurb}
                </span>
              </label>
            ))}
            {onStartWeek ? (
              <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="pdt-scenario"
                  value="week"
                  checked={scenario === "week"}
                  onChange={() => setScenario("week")}
                  className="mt-1 size-4 shrink-0"
                />
                <span className="min-w-0 break-words">
                  <span className="font-bold">A week of shifts.</span> Monday to
                  Friday, five different days. What is left of you carries into
                  the next day, and the five scores add up.
                </span>
              </label>
            ) : null}
          </fieldset>

          {scenario === "custom" ? (
            <div
              className="mt-3 space-y-4 rounded border border-[var(--pdt-paper-rule)] bg-black/5 p-3 text-xs"
              data-testid="pdt-custom-panel"
            >
              <h3 className="font-mono font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]">
                Custom Scenario Dials
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  Object.keys(SCENARIO_LIMITS) as Array<keyof ShiftScenario>
                ).map((key) => {
                  const [min, max] = SCENARIO_LIMITS[key];
                  const step = key === "dispenserFailChance" ? 0.05 : 1;
                  return (
                    <DialInput
                      key={key}
                      label={dialLabels[key]}
                      value={customDials[key]}
                      min={min}
                      max={max}
                      step={step}
                      onChange={(val) => handleDialChange(key, val)}
                      testId={`pdt-dial-${key}`}
                    />
                  );
                })}
              </div>

              {/* Custom Order Builder Drawer */}
              <div className="border-t border-[var(--pdt-paper-rule)] pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]">
                    Custom Order Queue
                  </h3>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(!drawerOpen)}
                    aria-expanded={drawerOpen}
                    aria-controls="pdt-custom-order-drawer"
                    data-testid="pdt-toggle-drawer"
                    className="font-mono text-xs font-bold underline hover:no-underline"
                  >
                    {drawerOpen
                      ? "Close Drawer"
                      : `Open Drawer (${customOrders.length}/${MAX_OPEN_ORDERS})`}
                  </button>
                </div>

                {drawerOpen ? (
                  <div
                    id="pdt-custom-order-drawer"
                    role="region"
                    aria-label="Custom Order Builder Drawer"
                    data-testid="pdt-order-builder-drawer"
                    className="mt-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-[var(--pdt-paper-dim)]">
                        Construct customer ticket sequence (max{" "}
                        {MAX_OPEN_ORDERS} orders, max {MAX_ITEMS_PER_ORDER}{" "}
                        items per order).
                      </p>
                      <button
                        type="button"
                        onClick={handleAddOrder}
                        disabled={customOrders.length >= MAX_OPEN_ORDERS}
                        data-testid="pdt-add-order"
                        className="rounded border border-[var(--pdt-bump-edge)] bg-[var(--pdt-bump)] px-2 py-1 font-mono text-[11px] font-bold uppercase text-[var(--pdt-ink)] disabled:opacity-50"
                      >
                        + Add Order
                      </button>
                    </div>

                    <div className="space-y-3">
                      {customOrders.map((order, oIdx) => (
                        <div
                          key={oIdx}
                          className="rounded border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] p-2 space-y-2"
                          data-testid={`pdt-custom-order-${oIdx}`}
                        >
                          <div className="flex items-center justify-between font-mono text-xs font-bold">
                            <span>Order #{oIdx + 1}</span>
                            {customOrders.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveOrder(oIdx)}
                                data-testid={`pdt-remove-order-${oIdx}`}
                                aria-label={`Remove Order ${oIdx + 1}`}
                                className="text-red-700 hover:underline text-[11px]"
                              >
                                Remove Order
                              </button>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            {order.items.map((item, iIdx) => (
                              <div
                                key={iIdx}
                                className="flex flex-wrap items-center gap-2 text-[11px]"
                              >
                                <label className="flex items-center gap-1">
                                  <span className="sr-only">Item</span>
                                  <select
                                    value={item.itemId}
                                    onChange={(e) =>
                                      handleUpdateItem(
                                        oIdx,
                                        iIdx,
                                        e.target.value as MenuItemId,
                                        item.modifier ?? null
                                      )
                                    }
                                    data-testid={`pdt-item-select-${oIdx}-${iIdx}`}
                                    aria-label={`Order ${oIdx + 1} Item ${iIdx + 1}`}
                                    className="rounded border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] px-1.5 py-1 font-mono"
                                  >
                                    {ORDERABLE_ITEMS.map((id) => (
                                      <option key={id} value={id}>
                                        {MENU_ITEM_LABELS[id]}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <label className="flex items-center gap-1">
                                  <span className="sr-only">Modifier</span>
                                  <select
                                    value={item.modifier ?? "none"}
                                    onChange={(e) =>
                                      handleUpdateItem(
                                        oIdx,
                                        iIdx,
                                        item.itemId,
                                        e.target.value === "none"
                                          ? null
                                          : (e.target.value as ModifierId)
                                      )
                                    }
                                    data-testid={`pdt-modifier-select-${oIdx}-${iIdx}`}
                                    aria-label={`Order ${oIdx + 1} Item ${iIdx + 1} Modifier`}
                                    className="rounded border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] px-1.5 py-1 font-mono"
                                  >
                                    <option value="none">
                                      Standard (no mod)
                                    </option>
                                    <option value="no-pickles">
                                      No Pickles
                                    </option>
                                  </select>
                                </label>

                                {order.items.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(oIdx, iIdx)}
                                    data-testid={`pdt-remove-item-${oIdx}-${iIdx}`}
                                    aria-label={`Remove Item ${iIdx + 1} from Order ${oIdx + 1}`}
                                    className="text-red-700 hover:underline text-[10px]"
                                  >
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>

                          {order.items.length < MAX_ITEMS_PER_ORDER ? (
                            <button
                              type="button"
                              onClick={() => handleAddItem(oIdx)}
                              data-testid={`pdt-add-item-${oIdx}`}
                              aria-label={`Add Item to Order ${oIdx + 1}`}
                              className="font-mono text-[10px] font-bold text-blue-800 hover:underline"
                            >
                              + Add Item ({order.items.length}/
                              {MAX_ITEMS_PER_ORDER})
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {onLongerDilemmasChange ? (
            <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={longerDilemmas}
                onChange={(event) =>
                  onLongerDilemmasChange(event.target.checked)
                }
                className="mt-1 size-4 shrink-0"
                data-testid="pdt-longer-dilemmas"
              />
              <span className="min-w-0 break-words">
                <span className="font-bold">More time to decide.</span> Now and
                then someone puts a question to you mid-shift. Answer within{" "}
                {DILEMMA_WINDOW_LONG_SEC} seconds instead of{" "}
                {DILEMMA_WINDOW_SEC}.
              </span>
            </label>
          ) : null}
          {resumable ? (
            <WeekResumePanel week={resumable} onResume={onResumeWeek!} />
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <ShiftButton ref={buttonRef} onClick={start}>
              {scenario !== "week"
                ? "Clock in"
                : resumable
                  ? "Start a new week"
                  : "Start the week"}
            </ShiftButton>
            <FieldManualButton manualId="patty-drive-thru" label="Manual" />
          </div>
        </div>
      </div>
    </article>
  );
}

interface ShiftEndPageProps {
  shift: ShiftState;
  /** Every event of the shift, for the export. */
  log: readonly ShiftLogEntry[];
  onClockIn: () => void;
  /** The best recorded score before this shift, or null if none yet. */
  previousBest?: number | null;
}

/** The best-score line under the end card's score (#1938). */
function bestLine(score: number, previousBest: number | null): string {
  if (previousBest === null || previousBest <= 0) {
    return score > 0 ? "First score on the board." : "No best yet.";
  }
  if (score > previousBest) {
    return `New best, ${score - previousBest} over your old ${previousBest}.`;
  }
  if (score === previousBest) return `Tied your best of ${previousBest}.`;
  return `Best: ${previousBest}.`;
}

/** The week so far, one cell per day, and a button to work the next one. */
function WeekResumePanel({
  week,
  onResume,
}: {
  week: WeekState;
  onResume: (week: WeekState) => void;
}) {
  const next = getWeekDay(week);
  if (!next) return null;
  return (
    <section
      aria-labelledby="pdt-resume-title"
      className="min-w-0 space-y-2 rounded border border-[var(--pdt-paper-rule)] p-3"
      data-testid="pdt-week-resume"
    >
      <h3
        id="pdt-resume-title"
        className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]"
      >
        A week in progress
      </h3>
      <WeekStrip week={week} />
      <p className="text-sm">
        Score so far {scoreWeek(week)}. {next.label} is next: {next.title}.
      </p>
      <ShiftButton onClick={() => onResume(week)}>
        {`Resume the week: ${next.label}`}
      </ShiftButton>
    </section>
  );
}

/** Monday to Friday as five cells: worked days show their score. */
function WeekStrip({ week }: { week: WeekState }) {
  return (
    <ol className="grid grid-cols-5 gap-1 font-mono text-[11px]">
      {WEEK_DAYS.map((day, index) => {
        const result = week.days[index];
        const isNext = !result && index === week.days.length;
        return (
          <li
            key={day.id}
            className={`min-w-0 rounded border px-1 py-1 text-center ${
              isNext
                ? "border-[var(--pdt-bump-edge)] font-bold"
                : "border-[var(--pdt-paper-rule)]"
            }`}
            aria-current={isNext ? "step" : undefined}
          >
            <span className="block truncate">{day.label.slice(0, 3)}</span>
            <span className="block tabular-nums">
              {result ? result.score : isNext ? "next" : "–"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PayStubTable({ shift }: { shift: ShiftState }) {
  const stub = computePayStub(shift);
  const rows: [string, number][] = [
    [
      `Gross pay (${stub.paidMinutes} min at the minimum wage)`,
      stub.grossCents,
    ],
    ["Uniform", -stub.uniformCents],
    ["Break adjustment (break not taken)", -stub.breakAdjustmentCents],
    ["Till shortage", -stub.tillShortCents],
  ];
  return (
    <>
      <h3
        id="pdt-stub-title"
        className="text-xs font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]"
      >
        Pay stub · Patty&apos;s Drive-Thru
      </h3>
      <table className="mt-1 w-full text-xs">
        <tbody>
          {rows.map(([label, cents]) => (
            <tr key={label} className="border-b border-[var(--pdt-paper-rule)]">
              <th scope="row" className="py-1 pr-2 text-left font-normal">
                {label}
              </th>
              <td className="py-1 text-right tabular-nums">
                {formatCents(cents)}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="py-1 pr-2 text-left font-bold">
              Net pay
            </th>
            <td
              className="py-1 text-right font-bold tabular-nums"
              data-testid="pdt-net-pay"
            >
              {formatCents(stub.netCents)}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function ShiftDataButtons({
  shift,
  log,
}: {
  shift: ShiftState;
  log: readonly ShiftLogEntry[];
}) {
  // A day of a week is saved as "patty-shift-<week seed>-<day>" (#2086).
  const name = `patty-shift-${shift.config.seed.replace(/:/g, "-")}`;
  return (
    <section aria-label="Shift data" className="font-mono text-xs">
      <h3 className="font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]">
        Shift data
      </h3>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            downloadFile(exportShiftTelemetryJson(shift, log), `${name}.json`, {
              mimeType: "application/json",
            })
          }
          className="min-h-11 rounded border border-[var(--pdt-paper-rule)] px-3 font-bold hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
          data-testid="pdt-export-json"
        >
          Download shift JSON
        </button>
        <button
          type="button"
          onClick={() =>
            downloadFile(exportShiftTelemetryCsv(log), `${name}.csv`, {
              mimeType: "text/csv",
            })
          }
          className="min-h-11 rounded border border-[var(--pdt-paper-rule)] px-3 font-bold hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
          data-testid="pdt-export-csv"
        >
          Download event log CSV
        </button>
      </div>
    </section>
  );
}

/** The pay stub and the closing note, shown when the shift ends. */
export function ShiftEndPage({
  shift,
  log,
  onClockIn,
  previousBest = null,
}: ShiftEndPageProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const ending = getShiftEnding(shift);

  return (
    <article
      className={PAGE_CLASS}
      aria-labelledby="pdt-end-title"
      data-testid="pdt-end"
      data-outcome={ending.outcome}
      data-ending={ending.ending}
    >
      <header>
        <h2
          id="pdt-end-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-mono text-2xl font-extrabold tracking-[-0.035em] focus:outline-none"
        >
          {ending.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed">{ending.summary}</p>
      </header>

      <ChoiceLines lines={getDilemmaDiaryLines(shift.dilemmaChoices)} />

      <section aria-labelledby="pdt-stub-title" className="font-mono">
        <PayStubTable shift={shift} />
        <p
          className="mt-2 text-xs text-[var(--pdt-paper-dim)]"
          data-testid="pdt-score"
        >
          Score {scoreShift(shift)} ({describeShiftScore(shift)})
          {isStandardScenario(shift.config)
            ? "."
            : ". Practice shift, so the score is not recorded."}
        </p>
        {isStandardScenario(shift.config) ? (
          <p
            className="text-xs text-[var(--pdt-paper-dim)]"
            data-testid="pdt-best"
          >
            {bestLine(scoreShift(shift), previousBest)}
          </p>
        ) : null}
      </section>

      <ShiftDataButtons shift={shift} log={log} />

      <ClosingNote />

      <div className="flex flex-wrap items-center gap-3">
        <ShiftButton onClick={onClockIn}>Work another shift</ShiftButton>
        <CompanionLink />
      </div>
    </article>
  );
}

/** What the player chose during the shift, one diary line each (#2087). */
function ChoiceLines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <section aria-labelledby="pdt-choices-title" data-testid="pdt-choices">
      <h3
        id="pdt-choices-title"
        className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]"
      >
        What I did
      </h3>
      <ul className="mt-1 space-y-1">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} className="text-sm leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClosingNote() {
  return (
    <section aria-label="Closing note" className="space-y-3">
      {CLOSING_NOTE.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-relaxed">
          {paragraph}
        </p>
      ))}
    </section>
  );
}

function CompanionLink() {
  return (
    <Link
      href={COMPANION_POST_PATH}
      className="inline-flex min-h-12 items-center font-mono text-xs font-bold underline underline-offset-4 hover:text-[var(--pdt-paper-dim)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
    >
      Read the notes behind this shift
    </Link>
  );
}

interface WeekDayEndPageProps {
  shift: ShiftState;
  log: readonly ShiftLogEntry[];
  /** The week with this day already added. */
  week: WeekState;
  /** Clocks in for the next day. */
  onNextDay: () => void;
  /** Leaves the week saved and goes back to the diary intro. */
  onStop: () => void;
}

/** One diary page per day of the week (#2086): date, pay stub, what happened. */
export function WeekDayEndPage({
  shift,
  log,
  week,
  onNextDay,
  onStop,
}: WeekDayEndPageProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const result = week.days.at(-1);
  const next = getWeekDay(week);
  if (!result || !next) return null;
  const preset = WEEK_DAYS[week.days.length - 1];
  const ending = getShiftEnding(shift);
  const carried = carryMeters(result);

  return (
    <article
      className={PAGE_CLASS}
      aria-labelledby="pdt-day-title"
      data-testid="pdt-day-end"
      data-day={result.day}
      data-outcome={result.outcome}
      data-ending={ending.ending}
    >
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--pdt-paper-dim)]">
          {preset.label} · day {week.days.length} of {WEEK_DAYS.length}
        </p>
        <h2
          id="pdt-day-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-mono text-2xl font-extrabold tracking-[-0.035em] focus:outline-none"
        >
          {/* The named endings belong to Friday; a day that reached close
              just closes (#2139). */}
          {preset.title}:{" "}
          {ending.outcome === "completed"
            ? "made it to close"
            : ending.title.toLowerCase()}
        </h2>
        <div className="mt-2 space-y-1" data-testid="pdt-day-lines">
          {getWeekDayDiaryLines(result).map((line) => (
            <p key={line} className="text-sm leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </header>

      <section aria-labelledby="pdt-stub-title" className="font-mono">
        <PayStubTable shift={shift} />
        <p
          className="mt-2 text-xs text-[var(--pdt-paper-dim)]"
          data-testid="pdt-score"
        >
          Day score {result.score} ({describeShiftScore(shift)}). Week so far{" "}
          {scoreWeek(week)}.
        </p>
      </section>

      <section aria-label="The week so far" className="space-y-2">
        <WeekStrip week={week} />
        <p className="text-sm" data-testid="pdt-carry">
          {next.label} is next: {next.title}. You start it with Dignity{" "}
          {carried.dignity} and drive-thru speed {carried.sos}.
        </p>
      </section>

      <ShiftDataButtons shift={shift} log={log} />

      <div className="flex flex-wrap items-center gap-3">
        <ShiftButton
          onClick={onNextDay}
        >{`Clock in for ${next.label}`}</ShiftButton>
        <SecondaryButton onClick={onStop} testId="pdt-week-stop">
          Stop for today
        </SecondaryButton>
      </div>
      <p className="font-mono text-[11px] text-[var(--pdt-paper-dim)]">
        The week is saved in this browser, so you can come back for {next.label}
        .
      </p>
    </article>
  );
}

/** The best-week line on the week summary, kept in this browser (#2086). */
function weekBestLine(total: number, previousBest: number | null): string {
  if (previousBest === null) return "New best week: your first full week.";
  if (total > previousBest) {
    return `New best week, ${total - previousBest} over your old ${previousBest}.`;
  }
  if (total === previousBest) return `Tied your best week of ${previousBest}.`;
  return `Best week: ${previousBest}.`;
}

function outcomeLabel(outcome: WeekDayResult["outcome"]): string {
  if (outcome === "docked") return "Pulled off the window";
  if (outcome === "breakdown") return "Walk-in cooler";
  return "Made it to close";
}

interface WeekSummaryPageProps {
  week: WeekState;
  /** The last day's shift, for its data export. */
  shift: ShiftState;
  log: readonly ShiftLogEntry[];
  onNewWeek: () => void;
  onBackToIntro: () => void;
  /** The best week total before this week, or null if none yet. */
  previousBest?: number | null;
}

/** The page that ends a week (#2086): the five days and the week's score. */
export function WeekSummaryPage({
  week,
  shift,
  log,
  onNewWeek,
  onBackToIntro,
  previousBest = null,
}: WeekSummaryPageProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const total = scoreWeek(week);
  const weekEnding = getWeekEnding(week);

  return (
    <article
      className={PAGE_CLASS}
      aria-labelledby="pdt-week-title"
      data-testid="pdt-week-end"
    >
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-[var(--pdt-paper-dim)]">
          Friday night
        </p>
        <h2
          id="pdt-week-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-mono text-2xl font-extrabold tracking-[-0.035em] focus:outline-none"
        >
          One week down
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          data-testid="pdt-week-ending"
          data-ending={weekEnding.ending}
        >
          <span className="font-bold">{weekEnding.title}.</span>{" "}
          {weekEnding.summary}
        </p>
      </header>

      <ol className="space-y-3" data-testid="pdt-week-days">
        {week.days.map((result, index) => (
          <li
            key={result.day}
            className="min-w-0 border-b border-[var(--pdt-paper-rule)] pb-2"
          >
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
              <span className="font-bold uppercase tracking-wider">
                {WEEK_DAYS[index].label} · {WEEK_DAYS[index].title}
              </span>
              <span className="tabular-nums">
                {outcomeLabel(result.outcome)} · {formatCents(result.netCents)}{" "}
                · {result.score} pts
              </span>
            </p>
            {getWeekDayDiaryLines(result).map((line) => (
              <p key={line} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </li>
        ))}
      </ol>

      <section className="font-mono text-xs" aria-label="Week score">
        <p data-testid="pdt-week-score" className="text-sm font-bold">
          Week score {total}. Take-home pay {formatCents(getWeekNetCents(week))}
          .
        </p>
        <p className="text-[var(--pdt-paper-dim)]" data-testid="pdt-best">
          {weekBestLine(total, previousBest)}
        </p>
        <p className="text-[var(--pdt-paper-dim)]">
          Each day&apos;s score went on the arcade board on its own.
        </p>
      </section>

      <ShiftDataButtons shift={shift} log={log} />

      <ClosingNote />

      <div className="flex flex-wrap items-center gap-3">
        <ShiftButton onClick={onNewWeek}>Work another week</ShiftButton>
        <SecondaryButton onClick={onBackToIntro}>
          Back to the diary
        </SecondaryButton>
        <CompanionLink />
      </div>
    </article>
  );
}
