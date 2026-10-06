"use client";

import { useStore } from "zustand";
import {
  getKdsTickets,
  type KdsTicket,
  type PosCursor,
} from "@/lib/patty-drive-thru";
import type { BoothActions, BoothState, BoothStore } from "./store";

/** Reads one slice of the booth store; re-renders only when it changes. */
export function useBooth<T>(
  store: BoothStore,
  selector: (state: BoothState & BoothActions) => T
): T {
  return useStore(store, selector);
}

/** How often ticket ages refresh on screen, per second. */
const TICKET_REFRESH_PER_SEC = 4;

/**
 * The open orders as tickets, refreshed when an order or the POS changes and
 * a few times a second for ages, rather than on every frame.
 */
export function useTickets(store: BoothStore): {
  tickets: KdsTicket[];
  pos: PosCursor;
} {
  const orders = useStore(store, (s) => s.shift.orders);
  const pos = useStore(store, (s) => s.shift.pos);
  const time = useStore(
    store,
    (s) =>
      Math.floor(s.shift.time * TICKET_REFRESH_PER_SEC) / TICKET_REFRESH_PER_SEC
  );
  return { tickets: getKdsTickets({ orders, pos, time }), pos };
}
