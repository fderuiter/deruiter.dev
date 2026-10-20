"use client";

import React, { useState, type ReactNode } from "react";
import {
  ArcadeSessionProvider,
  createArcadeStore,
  useSessionDispatch,
  useSessionSelector,
} from "@/components/arcade/views";

/** The fixture game's state: one counter, kept across view swaps. */
export interface CounterState {
  readonly count: number;
}

export type CounterIntent = { readonly type: "add" };

function reduce(state: CounterState, intent: CounterIntent): CounterState {
  return intent.type === "add" ? { count: state.count + 1 } : state;
}

export function CounterSessionHolder({ children }: { children: ReactNode }) {
  const [session] = useState(() =>
    createArcadeStore<CounterState, CounterIntent>({ count: 0 }, reduce)
  );
  return (
    <ArcadeSessionProvider value={session}>{children}</ArcadeSessionProvider>
  );
}

export function CounterView({ name }: { name: string }) {
  const count = useSessionSelector((state: CounterState) => state.count);
  const dispatch = useSessionDispatch<CounterIntent>();
  return (
    <div data-testid="fixture-view">
      <p>
        {name} view: {count}
      </p>
      <button type="button" onClick={() => dispatch({ type: "add" })}>
        Add one
      </button>
    </div>
  );
}
