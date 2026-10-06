/**
 * Read-only views of a shift for the front ends: the kitchen display, the
 * POS ticket strip, captions and the pay stub. Nothing here changes state.
 */

import {
  MENU_ITEM_LABELS,
  MODIFIER_LABELS,
  POS_MENU,
  SCORE_COMPLETED_BONUS,
  SCORE_LATE_PENALTY,
  SCORE_PER_SERVED,
} from "../presets";
import type {
  KdsTicket,
  Order,
  OrderItem,
  PosNode,
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
  if (isAgeLocked(item.itemId)) {
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
 * The arcade score for a shift: points per car served, less for late ones,
 * plus a bonus for making it to close. Never negative.
 */
export function scoreShift(state: ShiftState): number {
  const { served, late } = state.tallies;
  const bonus = state.outcome === "completed" ? SCORE_COMPLETED_BONUS : 0;
  return Math.max(
    0,
    served * SCORE_PER_SERVED - late * SCORE_LATE_PENALTY + bonus
  );
}
