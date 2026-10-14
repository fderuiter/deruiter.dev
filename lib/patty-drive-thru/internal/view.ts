/**
 * Read-only views of a shift for the front ends: the kitchen display, the
 * POS ticket strip, captions and the pay stub. Nothing here changes state.
 */

import {
  MENU_ITEM_LABELS,
  MODIFIER_LABELS,
  POS_MENU,
  SCORE_COMPLETED_BONUS,
  SCORE_DIGNITY_PER_POINT,
  SCORE_FAST_BUMP_BONUS,
  SCORE_LATE_PENALTY,
  SCORE_PER_SERVED,
} from "../presets";
import type {
  KdsTicket,
  Order,
  OrderItem,
  PosNode,
  ShiftScoreBreakdown,
  ShiftState,
  TicketLine,
  TicketLineStatus,
  TicketSource,
} from "../types";
import { getKdsBand, getOrderAge, isAgeLocked, isOrderReady } from "./engine";

function lineStatus(
  state: TicketSource,
  order: Order,
  item: OrderItem
): TicketLineStatus {
  if (item.dropped) return "dropped";
  if (item.rung) return "rung";
  if (isAgeLocked(item.itemId, state.config)) {
    const ready = order.coworkerReadyAt;
    if (ready === null) return "locked";
    return state.time < ready ? "brewing" : "ready-to-ring";
  }
  return "to-ring";
}

function toLine(
  state: TicketSource,
  order: Order,
  item: OrderItem
): TicketLine {
  return {
    itemId: item.itemId,
    label: MENU_ITEM_LABELS[item.itemId],
    modifier: item.modifier,
    modifierPending: item.modifier !== null && !item.modifierDone,
    status: lineStatus(state, order, item),
  };
}

/** One order as the kitchen display shows it. */
export function getKdsTicket(state: TicketSource, order: Order): KdsTicket {
  const lines = order.items.map((item) => toLine(state, order, item));
  const ageSec = getOrderAge(state, order);
  const ready = order.coworkerReadyAt;
  return {
    orderId: order.id,
    ageSec,
    band: getKdsBand(ageSec),
    lines,
    ready: isOrderReady(order),
    active: state.pos.activeOrderId === order.id,
    needsCoworker: lines.some((line) => line.status === "locked"),
    coworkerReadyIn:
      ready !== null && state.time < ready ? ready - state.time : null,
  };
}

/** Every open order, oldest first, as the kitchen display shows them. */
export function getKdsTickets(state: TicketSource): KdsTicket[] {
  return state.orders.map((order) => getKdsTicket(state, order));
}

/** The labels from the home screen to the open POS screen. */
export function getPosBreadcrumb(state: Pick<ShiftState, "pos">): string[] {
  const labels = [POS_MENU.label];
  let node: PosNode = POS_MENU;
  for (const id of state.pos.path) {
    const next = node.children?.find((child) => child.id === id);
    if (!next || !next.children) return [POS_MENU.label];
    labels.push(next.label);
    node = next;
  }
  return labels;
}

/** An order read aloud, the way a customer says it: "Burger, no pickles; soda". */
export function describeOrder(order: Order): string {
  return order.items
    .map((item, index) => {
      const label = MENU_ITEM_LABELS[item.itemId];
      const spoken = index === 0 ? label : label.toLowerCase();
      return item.modifier
        ? `${spoken}, ${MODIFIER_LABELS[item.modifier].toLowerCase()}`
        : spoken;
    })
    .join("; ");
}

/** Seconds left in the shift, never negative. */
export function getTimeLeft(state: ShiftState): number {
  return Math.max(0, state.config.durationSec - state.time);
}

/** A clock reading such as "2:05". Non-finite or negative input reads "0:00". */
export function formatClock(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

/** Whole cents as dollars, such as "$19.79" or "-$3.00". */
export function formatCents(cents: number): string {
  const value = Number.isFinite(cents) ? Math.round(cents) : 0;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const dollars = Math.floor(abs / 100);
  const rest = (abs % 100).toString().padStart(2, "0");
  return `${sign}$${dollars}.${rest}`;
}

/**
 * How a shift's score is made up (#2057): points per car served, a deduction
 * per late car, a bonus per order bumped while still green, the points the
 * clean-order streak earned, and, only for a shift that reaches close, the
 * closing bonus plus a bonus for the Dignity still standing. Every part is
 * read from the shift's tallies and meters, so the same shift always scores
 * the same.
 */
export function getShiftScoreBreakdown(state: ShiftState): ShiftScoreBreakdown {
  const { served, late, fastBumps, streakPoints } = state.tallies;
  const closed = state.outcome === "completed";
  const parts = {
    served: served * SCORE_PER_SERVED,
    late: -late * SCORE_LATE_PENALTY,
    speed: fastBumps * SCORE_FAST_BUMP_BONUS,
    streak: streakPoints,
    closing: closed ? SCORE_COMPLETED_BONUS : 0,
    dignity: closed
      ? Math.round(Math.max(0, state.meters.dignity) * SCORE_DIGNITY_PER_POINT)
      : 0,
  };
  const sum =
    parts.served +
    parts.late +
    parts.speed +
    parts.streak +
    parts.closing +
    parts.dignity;
  return { ...parts, total: Math.max(0, sum) };
}

/**
 * The arcade score for a shift: the total of `getShiftScoreBreakdown`, which
 * rewards cars served, speed, clean orders and the Dignity kept to close, and
 * docks late cars. Never negative.
 */
export function scoreShift(state: ShiftState): number {
  return getShiftScoreBreakdown(state).total;
}

/**
 * How a shift's score adds up, in one line for the end card (#1938, #2057),
 * for example "16 cars x 10 - 2 late x 5 + 9 fast x 5 + 48 streak + 50 for
 * closing + 72 Dignity". The closing and Dignity parts appear only when the
 * shift reached close.
 */
export function describeShiftScore(state: ShiftState): string {
  const { served, late, fastBumps } = state.tallies;
  const breakdown = getShiftScoreBreakdown(state);
  const parts = [
    `${served} ${served === 1 ? "car" : "cars"} x ${SCORE_PER_SERVED}`,
    `- ${late} late x ${SCORE_LATE_PENALTY}`,
    `+ ${fastBumps} fast x ${SCORE_FAST_BUMP_BONUS}`,
    `+ ${breakdown.streak} streak`,
  ];
  if (state.outcome === "completed") {
    parts.push(`+ ${breakdown.closing} for closing`);
    parts.push(`+ ${breakdown.dignity} Dignity`);
  }
  return parts.join(" ");
}
