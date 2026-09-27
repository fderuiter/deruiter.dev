"use client";

import React from "react";
import { CPU_COSTS, type DeviationView } from "@/lib/trial-and-error";
import { POPULATION_LABEL } from "@/components/trial-and-error/cards/CardFace";

interface DeviationCardProps {
  deviation: DeviationView;
}

/** "A, B and C". */
const listOf = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * A protocol deviation that just landed (#1087): a calm card naming the
 * finding and the outputs it staled. It never blocks play, and the table's
 * announcement already reads it out, so it is not a live region itself.
 */
export function DeviationCard({ deviation }: DeviationCardProps) {
  const { staled } = deviation;
  return (
    <section
      aria-labelledby="deviation-heading"
      className="mt-3 min-w-0 border border-amber-400/60 bg-[color:var(--te-surface-1)] p-3 text-xs"
      data-testid="deviation-card"
    >
      <h3
        id="deviation-heading"
        className="font-bold uppercase tracking-wider text-amber-300 break-words"
      >
        Protocol deviation: {deviation.name}
      </h3>
      <p className="mt-1 text-zinc-300 break-words">{deviation.flavor}</p>
      <p className="mt-1 text-zinc-400 break-words tabular-nums">
        {deviation.subjectId} left{" "}
        {listOf(deviation.populations.map((p) => POPULATION_LABEL[p]))}. The
        snapshot is now {deviation.snapshot.id}.
      </p>
      {staled.length > 0 ? (
        <>
          <p
            className="mt-1 text-rose-300 break-words"
            data-testid="deviation-staled"
          >
            {staled.length === 1
              ? "1 output went stale"
              : `${staled.length} outputs went stale`}
            : {staled.join(", ")}.
          </p>
          <p
            className="mt-1 text-zinc-300 break-words"
            data-testid="deviation-next"
          >
            Next: recompile a stale output (R, {CPU_COSTS.RECOMPILE} CPU) or
            discard it. Fresh draws compile against {deviation.snapshot.id}.
          </p>
        </>
      ) : (
        <p
          className="mt-1 text-zinc-400 break-words"
          data-testid="deviation-staled"
        >
          No output in hand went stale. Play on.
        </p>
      )}
    </section>
  );
}
