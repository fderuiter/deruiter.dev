"use client";

import React from "react";
import type {
  PuzzlerVariantDef,
  PuzzlerVariantKind,
} from "@/lib/quasi-perfect";

interface VariantPickerProps {
  variants: PuzzlerVariantDef[];
  /** The variant on the board, or null for the base level. */
  activeKind: PuzzlerVariantKind | null;
  /** True once the base level has been proved honestly. */
  unlocked: boolean;
  isCleared: (kind: PuzzlerVariantKind) => boolean;
  onSelect: (kind: PuzzlerVariantKind | null) => void;
}

/**
 * Chooses between the base level and its constrained variants (#2090).
 * Locked until the base level is proved without `sorry`. Each choice is a
 * 44px touch target, and a cleared variant says so in text, not colour alone.
 */
export const VariantPicker: React.FC<VariantPickerProps> = ({
  variants,
  activeKind,
  unlocked,
  isCleared,
  onSelect,
}) => {
  if (!unlocked) {
    return (
      <p
        data-testid="quasi-variants-locked"
        className="mt-1 text-[11px] text-zinc-400 break-words"
      >
        Prove this level without sorry to unlock {variants.length} challenge
        variant{variants.length === 1 ? "" : "s"}.
      </p>
    );
  }
  const active = variants.find((v) => v.kind === activeKind) ?? null;
  const clearedCount = variants.filter((v) => isCleared(v.kind)).length;
  const buttonClass = (on: boolean) =>
    `qp-focus min-h-[44px] min-w-[44px] rounded-lg border px-3 text-xs font-bold transition-colors active:scale-[0.98] flex items-center gap-1.5 ${
      on
        ? "qp-btn-primary border-transparent"
        : "border-[color:var(--qp-hairline)] text-zinc-300 hover:text-zinc-100"
    }`;

  return (
    <div data-testid="quasi-variant-picker" className="mt-2 min-w-0">
      <p
        id="quasi-variant-heading"
        className="text-[10px] font-bold uppercase tracking-wider text-zinc-400"
      >
        Challenge variants ·{" "}
        <span className="tabular-nums">
          {clearedCount} of {variants.length} cleared
        </span>
      </p>
      <div
        role="group"
        aria-labelledby="quasi-variant-heading"
        className="mt-1 flex flex-wrap gap-1.5"
      >
        <button
          type="button"
          aria-pressed={activeKind === null}
          onClick={() => onSelect(null)}
          className={buttonClass(activeKind === null)}
        >
          Base level
        </button>
        {variants.map((v) => {
          const cleared = isCleared(v.kind);
          const on = activeKind === v.kind;
          return (
            <button
              key={v.kind}
              type="button"
              aria-pressed={on}
              data-testid={`quasi-variant-${v.kind}`}
              data-cleared={cleared ? "true" : undefined}
              onClick={() => onSelect(v.kind)}
              className={buttonClass(on)}
            >
              <span>{v.title}</span>
              {cleared && (
                <span
                  className={`rounded border px-1 text-[10px] ${
                    on
                      ? "border-current"
                      : "border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  <span aria-hidden="true">✓ </span>Cleared
                </span>
              )}
            </button>
          );
        })}
      </div>
      {active && (
        <p
          data-testid="quasi-variant-rule"
          className="mt-1 text-[11px] text-amber-200 break-words"
        >
          <span className="font-bold">{active.title}:</span> {active.rule}
        </p>
      )}
    </div>
  );
};
