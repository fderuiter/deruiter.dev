"use client";

import React from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type {
  DialogueLine,
  LineKind,
  RelationshipCard,
} from "@/lib/study-director-world";

const KIND_LABEL: Record<LineKind, string> = {
  information: "Info",
  warning: "Warning",
  opportunity: "Opening",
  relationship: "Read",
  joke: "Aside",
};

const KIND_CLASS: Record<LineKind, string> = {
  information: "border-[var(--sd-steel)]/50 text-[var(--sd-steel)]",
  warning: "border-[var(--sd-amber)]/60 text-amber-300",
  opportunity: "border-[var(--sd-emerald)]/60 text-emerald-300",
  relationship: "border-zinc-600 text-zinc-300",
  joke: "border-zinc-700 text-zinc-400",
};

/** Lines of dialogue, each tagged with what it carries. */
export const DialogueLines: React.FC<{ lines: readonly DialogueLine[] }> = ({
  lines,
}) => (
  <ul className="space-y-2 text-xs leading-relaxed">
    {lines.map((l, i) => (
      <li key={i} className="flex min-w-0 items-start gap-2">
        <span
          className={`mt-px shrink-0 border px-1 text-[9px] font-semibold tracking-wide uppercase ${KIND_CLASS[l.kind]}`}
        >
          {KIND_LABEL[l.kind]}
        </span>
        <span className="min-w-0 break-words text-zinc-100">
          {l.text}
          {l.trustDelta ? (
            <span
              className={`ml-1 ${l.trustDelta > 0 ? "text-emerald-300" : "text-[var(--sd-red)]"}`}
            >
              {l.trustDelta > 0 ? "(trust up)" : "(trust down)"}
            </span>
          ) : null}
        </span>
      </li>
    ))}
  </ul>
);

const Segments: React.FC<{ value: 1 | 2 | 3 | 4; tone: string }> = ({
  value,
  tone,
}) => (
  <span aria-hidden="true" className="flex gap-0.5">
    {[1, 2, 3, 4].map((n) => (
      <span
        key={n}
        className={`block h-1.5 w-4 ${n <= value ? tone : "bg-zinc-800"}`}
      />
    ))}
  </span>
);

/**
 * A relationship card: trust as hearts, stress and workload as rough bars
 * with a word each. Never an exact number.
 */
export const RelationshipCardView: React.FC<{ card: RelationshipCard }> = ({
  card,
}) => (
  <section
    aria-label={`${card.name}'s relationship card`}
    data-testid="relationship-card"
    className="min-w-0 border border-[var(--sd-hairline)] bg-[var(--sd-surface-2)] p-2 text-[11px]"
  >
    <p className="font-semibold text-zinc-100">
      {card.name}{" "}
      <span className="font-normal text-[var(--sd-muted)]">· {card.role}</span>
    </p>
    <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
      <dt className="text-[var(--sd-muted)]">Trust</dt>
      <dd>
        <span aria-hidden="true" className="tracking-widest text-amber-300">
          {"♥".repeat(card.hearts)}
          <span className="text-zinc-700">{"♥".repeat(5 - card.hearts)}</span>
        </span>
        <span className="sr-only">{card.hearts} of 5 hearts</span>
      </dd>
      <dt className="text-[var(--sd-muted)]">Stress</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <Segments
          value={card.stressBars}
          tone={
            card.stressBars >= 3 ? "bg-[var(--sd-red)]" : "bg-[var(--sd-amber)]"
          }
        />
        <span className="min-w-0 break-words text-zinc-300">
          {card.stressLabel}
        </span>
      </dd>
      <dt className="text-[var(--sd-muted)]">Workload</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <Segments
          value={card.workloadBars}
          tone={
            card.workloadBars >= 3
              ? "bg-[var(--sd-red)]"
              : "bg-[var(--sd-steel)]"
          }
        />
        <span className="min-w-0 break-words text-zinc-300">
          {card.workloadLabel}
        </span>
      </dd>
      <dt className="text-[var(--sd-muted)]">On</dt>
      <dd className="min-w-0 break-words text-zinc-300">
        {card.task}
        {card.owns ? " (owns it)" : ""}
      </dd>
    </dl>
  </section>
);

/** A small action button in an overlay. */
export const OverlayButton: React.FC<
  React.ComponentPropsWithRef<"button"> & { primary?: boolean }
> = ({ primary, className = "", ...rest }) => (
  <button
    type="button"
    {...rest}
    className={`min-h-[36px] border px-3 py-1 text-left text-xs active:scale-[0.98] disabled:opacity-50 ${
      primary
        ? "border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20"
        : "border-zinc-700 text-zinc-200 hover:border-[var(--sd-amber)]"
    } ${className}`}
  />
);

/**
 * A modal overlay over the floor: focus is trapped inside, Escape closes
 * it and focus returns to where it came from.
 */
export const Overlay: React.FC<{
  titleId: string;
  title: string;
  subtitle?: string;
  testId: string;
  role?: "dialog" | "alertdialog";
  onClose: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}> = ({
  titleId,
  title,
  subtitle,
  testId,
  role = "dialog",
  onClose,
  onKeyDown,
  initialFocusRef,
  returnFocusTo,
  children,
}) => {
  const trapRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef,
    onEscape: onClose,
    returnFocusTo,
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={trapRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        onKeyDown={onKeyDown}
        className="sd-enter max-h-[85dvh] w-full max-w-xl min-w-0 overflow-y-auto border border-[var(--sd-hairline-strong)] bg-[var(--sd-surface)] p-4 font-mono text-[var(--sd-text)]"
      >
        <h3 id={titleId} className="text-sm font-bold break-words">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] break-words text-[var(--sd-muted)]">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    </div>
  );
};
