"use client";

import React, { useEffect, useRef, useState } from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import { FieldManualButton } from "@/components/FieldManualButton";
import { downloadFile } from "@/lib/download";
import { clamp } from "@/lib/game-utils";
import {
  ARRIVAL_GAP_MAX_SEC,
  ARRIVAL_GAP_MIN_SEC,
  CLOSING_NOTE,
  COMPANION_POST_PATH,
  DIARY_INTRO,
  DILEMMA_WINDOW_LONG_SEC,
  DILEMMA_WINDOW_SEC,
  DISPENSER_FAIL_CHANCE,
  FIRST_ARRIVAL_SEC,
  IDLE_GRACE_SEC,
  IDLE_RATE_PER_SEC,
  MAX_ITEMS_PER_ORDER,
  MAX_OPEN_ORDERS,
  MENU_ITEM_LABELS,
  MODIFIER_ITEMS,
  MODIFIER_LABELS,
  ORDERABLE_ITEMS,
  SCENARIO_LIMITS,
  SCENARIO_PRESETS,
  SOS_GAIN_FAST,
  SOS_GAIN_ON_TIME,
  SOS_LOSS_EXPIRED,
  SOS_LOSS_LATE,
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

type DialKey = keyof ShiftScenario;

const DIAL_KEYS = Object.keys(SCENARIO_LIMITS) as DialKey[];

/** The two arrival-gap dials, shown side by side as one question. */
const GAP_DIALS = ["arrivalGapMinSec", "arrivalGapMaxSec"] as const;

/** How each custom-shift dial is asked about on the intro page (#2519). */
const DIAL_LABELS: Readonly<Record<DialKey, string>> = {
  arrivalGapMinSec: "Shortest",
  arrivalGapMaxSec: "Longest",
  firstArrivalSec: "First car arrives after (seconds)",
  sosLossExpired: "Speed of service lost per expired order",
  sosLossLate: "Speed of service lost per late order",
  sosGainOnTime: "Speed of service gained per on-time order",
  sosGainFast: "Speed of service gained per fast order",
  idleGraceSec: "Grace before standing still is noticed (seconds)",
  idleRatePerSec:
    "How fast the manager notices, once he does (points a second)",
  dispenserFailChance: "Chance the drink machine drops a cup (percent)",
};

/** The dispenser chance is a 0 to 1 fraction, shown as a percent. */
function dialScale(key: DialKey): number {
  return key === "dispenserFailChance" ? 100 : 1;
}

/** A dial's range in the units the player types. */
function dialRange(key: DialKey): readonly [number, number] {
  const [min, max] = SCENARIO_LIMITS[key];
  return [min * dialScale(key), max * dialScale(key)];
}

type DialValues = Readonly<Record<DialKey, number>>;
type DialDrafts = Readonly<Record<DialKey, string>>;

/** A custom shift starts from the standard shift's numbers. */
const STANDARD_DIALS: DialValues = {
  arrivalGapMinSec: ARRIVAL_GAP_MIN_SEC,
  arrivalGapMaxSec: ARRIVAL_GAP_MAX_SEC,
  firstArrivalSec: FIRST_ARRIVAL_SEC,
  sosLossExpired: SOS_LOSS_EXPIRED,
  sosLossLate: SOS_LOSS_LATE,
  sosGainOnTime: SOS_GAIN_ON_TIME,
  sosGainFast: SOS_GAIN_FAST,
  idleGraceSec: IDLE_GRACE_SEC,
  idleRatePerSec: IDLE_RATE_PER_SEC,
  dispenserFailChance: DISPENSER_FAIL_CHANCE * 100,
};

function draftsOf(values: DialValues): DialDrafts {
  const drafts = {} as Record<DialKey, string>;
  for (const key of DIAL_KEYS) drafts[key] = String(values[key]);
  return drafts;
}

/**
 * Settles what the player typed: each dial is held to its range, and a
 * blank or unreadable entry goes back to the value it had. The shortest
 * gap never ends up longer than the longest: the dial just changed wins,
 * and the other one moves to meet it.
 */
function settleDials(
  drafts: DialDrafts,
  values: DialValues,
  changed?: DialKey
): DialValues {
  const next = { ...values } as Record<DialKey, number>;
  for (const key of changed ? [changed] : DIAL_KEYS) {
    const typed = drafts[key].trim();
    const parsed = typed === "" ? Number.NaN : Number(typed);
    if (!Number.isFinite(parsed)) continue;
    const [min, max] = dialRange(key);
    next[key] = clamp(parsed, min, max);
  }
  if (next.arrivalGapMinSec > next.arrivalGapMaxSec) {
    if (changed === "arrivalGapMaxSec")
      next.arrivalGapMinSec = next.arrivalGapMaxSec;
    else next.arrivalGapMaxSec = next.arrivalGapMinSec;
  }
  return next;
}

interface DraftItem {
  readonly key: number;
  readonly itemId: MenuItemId;
  readonly modifier: ModifierId | null;
}

interface DraftOrder {
  readonly key: number;
  readonly items: readonly DraftItem[];
}

const DEFAULT_ORDERS: readonly DraftOrder[] = [
  {
    key: 1,
    items: [
      { key: 2, itemId: "burger", modifier: "no-pickles" },
      { key: 3, itemId: "soda", modifier: null },
    ],
  },
  {
    key: 4,
    items: [
      { key: 5, itemId: "cheeseburger", modifier: null },
      { key: 6, itemId: "fries", modifier: null },
    ],
  },
];

/** The modifiers an item can take, such as no pickles on a burger. */
function modifiersFor(itemId: MenuItemId): ModifierId[] {
  return (Object.keys(MODIFIER_ITEMS) as ModifierId[]).filter((modifier) =>
    MODIFIER_ITEMS[modifier].includes(itemId)
  );
}

/** The custom shift's dials and order queue while the player sets them up. */
function useCustomShift() {
  const [values, setValues] = useState<DialValues>(STANDARD_DIALS);
  const [drafts, setDrafts] = useState<DialDrafts>(() =>
    draftsOf(STANDARD_DIALS)
  );
  const [orders, setOrders] = useState<readonly DraftOrder[]>(DEFAULT_ORDERS);
  const nextKey = useRef(100);
  const newKey = () => (nextKey.current += 1);

  const typeDial = (key: DialKey, typed: string) =>
    setDrafts({ ...drafts, [key]: typed });

  const settle = (changed?: DialKey): DialValues => {
    const settled = settleDials(drafts, values, changed);
    setValues(settled);
    setDrafts(draftsOf(settled));
    return settled;
  };

  const updateOrder = (
    orderKey: number,
    change: (items: readonly DraftItem[]) => readonly DraftItem[]
  ) =>
    setOrders(
      orders.map((order) =>
        order.key === orderKey
          ? { ...order, items: change(order.items) }
          : order
      )
    );

  const addOrder = () => {
    if (orders.length >= MAX_OPEN_ORDERS) return;
    setOrders([
      ...orders,
      {
        key: newKey(),
        items: [{ key: newKey(), itemId: "burger", modifier: null }],
      },
    ]);
  };

  const removeOrder = (orderKey: number) => {
    if (orders.length <= 1) return;
    setOrders(orders.filter((order) => order.key !== orderKey));
  };

  const addItem = (orderKey: number) =>
    updateOrder(orderKey, (items) =>
      items.length >= MAX_ITEMS_PER_ORDER
        ? items
        : [...items, { key: newKey(), itemId: "fries", modifier: null }]
    );

  const removeItem = (orderKey: number, itemKey: number) =>
    updateOrder(orderKey, (items) =>
      items.length <= 1 ? items : items.filter((item) => item.key !== itemKey)
    );

  const setItem = (orderKey: number, itemKey: number, itemId: MenuItemId) =>
    updateOrder(orderKey, (items) =>
      items.map((item) =>
        item.key !== itemKey
          ? item
          : {
              ...item,
              itemId,
              modifier:
                item.modifier && modifiersFor(itemId).includes(item.modifier)
                  ? item.modifier
                  : null,
            }
      )
    );

  const setModifier = (
    orderKey: number,
    itemKey: number,
    modifier: ModifierId | null
  ) =>
    updateOrder(orderKey, (items) =>
      items.map((item) => (item.key === itemKey ? { ...item, modifier } : item))
    );

  /** Settles every dial and returns the config to clock in with. */
  const toConfig = (): Partial<ShiftConfig> => {
    const settled = settle();
    const dials = {} as Record<DialKey, number>;
    for (const key of DIAL_KEYS) dials[key] = settled[key] / dialScale(key);
    return {
      ...dials,
      customOrders: orders.map((order) => ({
        items: order.items.map(({ itemId, modifier }) => ({
          itemId,
          modifier,
        })),
      })),
    };
  };

  return {
    drafts,
    orders,
    typeDial,
    settle,
    addOrder,
    removeOrder,
    addItem,
    removeItem,
    setItem,
    setModifier,
    toConfig,
  };
}

type CustomShift = ReturnType<typeof useCustomShift>;

const FIELD_CLASS =
  "min-h-12 w-full min-w-0 rounded border border-[var(--pdt-paper-rule)] bg-[var(--pdt-paper)] px-2 font-mono text-sm text-[var(--pdt-paper-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]";

const SMALL_BUTTON_CLASS =
  "min-h-12 min-w-12 rounded border-2 border-[var(--pdt-paper-rule)] px-3 font-mono text-xs font-bold uppercase tracking-wide active:scale-[0.98] hover:bg-black/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]";

/** One number field of the custom shift, settled when it loses focus. */
function DialField({
  dial,
  custom,
  label,
}: {
  dial: DialKey;
  custom: CustomShift;
  label: string;
}) {
  const [min, max] = dialRange(dial);
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-bold break-words">
        {label}{" "}
        <span className="font-normal text-[var(--pdt-paper-dim)]">
          ({min} to {max})
        </span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="any"
        value={custom.drafts[dial]}
        onChange={(event) => custom.typeDial(dial, event.target.value)}
        onBlur={() => custom.settle(dial)}
        className={FIELD_CLASS}
        data-testid={`pdt-dial-${dial}`}
      />
    </label>
  );
}

/** The custom shift's setup: its dials and the orders it plays (#2519). */
function CustomShiftPanel({ custom }: { custom: CustomShift }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { orders } = custom;
  return (
    <section
      aria-labelledby="pdt-custom-title"
      className="@container min-w-0 space-y-3 rounded border border-[var(--pdt-paper-rule)] p-3"
      data-testid="pdt-custom-panel"
    >
      <h3
        id="pdt-custom-title"
        className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--pdt-paper-dim)]"
      >
        Your shift
      </h3>
      <p className="text-xs leading-relaxed" data-testid="pdt-custom-practice">
        Practice only: a custom shift doesn&apos;t count toward your best score
        or trophies. A <code>?seed=</code> link doesn&apos;t carry this setup,
        so it can&apos;t share a custom shift.
      </p>
      <fieldset className="min-w-0">
        <legend className="text-xs font-bold">
          Time between cars (shortest / longest, seconds)
        </legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {GAP_DIALS.map((dial) => (
            <DialField
              key={dial}
              dial={dial}
              custom={custom}
              label={DIAL_LABELS[dial]}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid min-w-0 gap-3 @md:grid-cols-2">
        {DIAL_KEYS.filter(
          (dial) => !(GAP_DIALS as readonly DialKey[]).includes(dial)
        ).map((dial) => (
          <DialField
            key={dial}
            dial={dial}
            custom={custom}
            label={DIAL_LABELS[dial]}
          />
        ))}
      </div>
      <div className="border-t border-[var(--pdt-paper-rule)] pt-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-expanded={drawerOpen}
          aria-controls="pdt-order-builder"
          data-testid="pdt-toggle-orders"
          className={SMALL_BUTTON_CLASS}
        >
          {drawerOpen ? "Hide the orders" : "Build the orders"} ({orders.length}{" "}
          of {MAX_OPEN_ORDERS})
        </button>
        {drawerOpen ? (
          <div
            id="pdt-order-builder"
            className="mt-3 space-y-3"
            data-testid="pdt-order-builder"
          >
            <p className="text-xs leading-relaxed">
              The cars order these in turn, then start again from the first. Up
              to {MAX_OPEN_ORDERS} orders of 1 to {MAX_ITEMS_PER_ORDER} items
              each.
            </p>
            <ol className="space-y-3">
              {orders.map((order, orderIndex) => (
                <li
                  key={order.key}
                  className="min-w-0 space-y-2 rounded border border-[var(--pdt-paper-rule)] p-2"
                  data-testid={`pdt-custom-order-${orderIndex}`}
                >
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold">
                      Order {orderIndex + 1}
                    </span>
                    {orders.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => custom.removeOrder(order.key)}
                        aria-label={`Remove order ${orderIndex + 1}`}
                        className={SMALL_BUTTON_CLASS}
                      >
                        Remove order
                      </button>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {order.items.map((item, itemIndex) => {
                      const where = `order ${orderIndex + 1}, item ${itemIndex + 1}`;
                      const modifiers = modifiersFor(item.itemId);
                      return (
                        <li
                          key={item.key}
                          className="flex min-w-0 flex-wrap items-center gap-2"
                        >
                          <select
                            value={item.itemId}
                            onChange={(event) =>
                              custom.setItem(
                                order.key,
                                item.key,
                                event.target.value as MenuItemId
                              )
                            }
                            aria-label={`Item for ${where}`}
                            className={`${FIELD_CLASS} flex-1 basis-32`}
                          >
                            {ORDERABLE_ITEMS.map((id) => (
                              <option key={id} value={id}>
                                {MENU_ITEM_LABELS[id]}
                              </option>
                            ))}
                          </select>
                          {modifiers.length > 0 ? (
                            <select
                              value={item.modifier ?? ""}
                              onChange={(event) =>
                                custom.setModifier(
                                  order.key,
                                  item.key,
                                  event.target.value === ""
                                    ? null
                                    : (event.target.value as ModifierId)
                                )
                              }
                              aria-label={`Request for ${where}`}
                              className={`${FIELD_CLASS} flex-1 basis-32`}
                            >
                              <option value="">As it comes</option>
                              {modifiers.map((id) => (
                                <option key={id} value={id}>
                                  {MODIFIER_LABELS[id]}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {order.items.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                custom.removeItem(order.key, item.key)
                              }
                              aria-label={`Remove ${where}`}
                              className={SMALL_BUTTON_CLASS}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {order.items.length < MAX_ITEMS_PER_ORDER ? (
                    <button
                      type="button"
                      onClick={() => custom.addItem(order.key)}
                      aria-label={`Add an item to order ${orderIndex + 1}`}
                      className={SMALL_BUTTON_CLASS}
                    >
                      Add item
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={custom.addOrder}
              disabled={orders.length >= MAX_OPEN_ORDERS}
              data-testid="pdt-add-order"
              className={SMALL_BUTTON_CLASS}
            >
              Add order
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The diary page shown before the player clocks in (#1814). */
export function DiaryIntroPage({
  onClockIn,
  onClockInCustom,
  onStartWeek,
  onResumeWeek,
  savedWeek = null,
  longerDilemmas = false,
  onLongerDilemmasChange,
}: {
  onClockIn: (scenario: ScenarioId) => void;
  /**
   * Clocks in for a custom shift with the player's dials and orders
   * (#2519). Left out, the custom shift is not offered.
   */
  onClockInCustom?: (setup: Partial<ShiftConfig>) => void;
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
  const [scenario, setScenario] = useState<ScenarioId | "custom" | "week">(
    "standard"
  );
  const custom = useCustomShift();
  const resumable =
    savedWeek && !isWeekOver(savedWeek) && onResumeWeek ? savedWeek : null;
  const start = () => {
    if (scenario === "week") onStartWeek?.();
    else if (scenario === "custom") onClockInCustom?.(custom.toConfig());
    else onClockIn(scenario);
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
            {onClockInCustom ? (
              <label className="flex min-h-11 cursor-pointer items-start gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="pdt-scenario"
                  value="custom"
                  checked={scenario === "custom"}
                  onChange={() => setScenario("custom")}
                  className="mt-1 size-4 shrink-0"
                />
                <span className="min-w-0 break-words">
                  <span className="font-bold">Custom shift.</span> Set the
                  numbers and build the orders yourself. Practice only.
                </span>
              </label>
            ) : null}
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
          {scenario === "custom" && onClockInCustom ? (
            <CustomShiftPanel custom={custom} />
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
    <IntentLink
      href={COMPANION_POST_PATH}
      className="inline-flex min-h-12 items-center font-mono text-xs font-bold underline underline-offset-4 hover:text-[var(--pdt-paper-dim)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pdt-focus)]"
    >
      Read the notes behind this shift
    </IntentLink>
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
