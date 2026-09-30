"use client";

import React, { useState } from "react";
import {
  Reorder,
  motion,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import type { PopulationType, TableCardView } from "@/lib/trial-and-error";
import { CardBack } from "@/components/trial-and-error/cards/CardBack";
import { CardFace } from "@/components/trial-and-error/cards/CardFace";
import { CardFlip } from "@/components/trial-and-error/cards/CardFlip";
import type { HandCardInteraction } from "@/components/trial-and-error/useHandInteraction";

const SUIT_BORDER: Record<PopulationType, string> = {
  ITT: "border-l-[color:var(--te-suit-itt)]",
  SAFETY: "border-l-[color:var(--te-suit-safety)]",
  PER_PROTOCOL: "border-l-[color:var(--te-suit-pp)]",
  FAS: "border-l-[color:var(--te-suit-fas)]",
  SCREENED: "border-l-[color:var(--te-suit-screened)]",
};

const TILT_DEG = 8;

interface HandCardProps {
  view: TableCardView;
  index: number;
  count: number;
  /** Rem this card slides under its left neighbour (see `handOverlap`). */
  overlap: number;
  /** Fan, tilt, deal and flip motion may run (≥768px, no reduced motion). */
  physical: boolean;
  /** Deal and flip motion may run (no reduced motion). */
  animate: boolean;
  label: string;
  buttonRef: (el: HTMLButtonElement | null) => void;
  /** What each input means, decided by `useHandInteraction`. */
  interaction: HandCardInteraction;
}

/**
 * One card in the hand: a physical object. It fans on an arc, lifts and tilts
 * toward the pointer, breathes at rest (CSS only), deals face down and turns
 * up, and drags by its grip to reorder. Every motion is transform or opacity.
 * What a key, tap, long press or drop means is the interaction seam's call.
 */
export function HandCard({
  view,
  index,
  count,
  overlap,
  physical,
  animate,
  label,
  buttonRef,
  interaction,
}: HandCardProps) {
  const controls = useDragControls();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const [raised, setRaised] = useState(false);

  const offset = index - (count - 1) / 2;
  const lift = (view.selected ? -14 : 0) + (raised && physical ? -8 : 0);

  return (
    <Reorder.Item
      value={view.card.id}
      as="div"
      dragListener={false}
      dragControls={controls}
      onDragEnd={interaction.onDragEnd}
      className="relative w-36 shrink-0 md:w-40"
      style={{
        marginLeft: index > 0 && overlap > 0 ? `-${overlap}rem` : undefined,
        zIndex: raised ? 20 : view.selected ? 10 : index + 1,
      }}
      initial={animate ? { opacity: 0, y: -24 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={
        animate
          ? { opacity: 0, y: -40, transition: { duration: 0.2 } }
          : { opacity: 0, transition: { duration: 0 } }
      }
    >
      <span
        aria-hidden="true"
        title="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="absolute -top-5 left-1/2 z-10 flex h-5 w-10 -translate-x-1/2 cursor-grab touch-none items-center justify-center text-[10px] leading-none text-zinc-400 active:cursor-grabbing"
        data-testid="drag-grip"
      >
        ⠿
      </span>
      <motion.button
        type="button"
        ref={buttonRef}
        tabIndex={interaction.tabIndex}
        aria-pressed={view.selected}
        aria-label={label}
        data-card-id={view.card.id}
        onClick={interaction.onClick}
        onFocus={() => {
          setRaised(true);
          interaction.onFocus();
        }}
        onBlur={() => setRaised(false)}
        onKeyDown={interaction.onKeyDown}
        onPointerEnter={() => setRaised(true)}
        onPointerLeave={() => {
          setRaised(false);
          tiltX.set(0);
          tiltY.set(0);
          interaction.onPointerEnd();
        }}
        onPointerDown={interaction.onPointerDown}
        onPointerMove={(e) => {
          interaction.onPointerMove(e);
          if (!physical || e.pointerType !== "mouse") return;
          const rect = e.currentTarget.getBoundingClientRect();
          tiltY.set(
            ((e.clientX - rect.left) / rect.width - 0.5) * 2 * TILT_DEG
          );
          tiltX.set(
            -((e.clientY - rect.top) / rect.height - 0.5) * 2 * TILT_DEG
          );
        }}
        onPointerUp={interaction.onPointerEnd}
        onPointerCancel={interaction.onPointerEnd}
        onContextMenu={interaction.onContextMenu}
        onDragOver={interaction.onDragOver}
        onDrop={interaction.onDrop}
        animate={{
          y: (physical ? offset * offset * 1.5 : 0) + lift,
          rotate: physical && !raised ? offset * 2.5 : 0,
        }}
        transition={
          animate
            ? { type: "spring", stiffness: 420, damping: 30 }
            : { duration: 0 }
        }
        style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 700 }}
        data-stale={view.stale || undefined}
        data-blank={view.blank || undefined}
        data-face-down={view.faceDown || undefined}
        className={`relative block h-[13.5rem] w-full min-w-0 border border-l-4 text-left text-xs touch-manipulation select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${view.blank ? "border-dashed border-l-zinc-500" : SUIT_BORDER[view.card.population]} ${interaction.sealTarget ? "outline outline-1 outline-dashed outline-amber-400/70" : ""} ${
          view.selected
            ? "border-amber-400 bg-[#1f1a10]"
            : "border-zinc-700 bg-[color:var(--te-surface-1)]"
        } ${raised && physical ? "shadow-lg shadow-black/60" : ""}`}
      >
        {view.pairedWith.length > 0 && (
          <span
            aria-hidden="true"
            title="Forms a TLF Pair with a card in hand"
            data-testid="pair-link"
            className="pointer-events-none absolute -right-px -top-px z-10 border border-[color:var(--te-x-mult)]/60 bg-[color:var(--te-surface-0)] px-1 font-mono text-[9px] leading-4 tracking-wider text-[color:var(--te-x-mult)]"
          >
            ⇄ PAIR
          </span>
        )}
        {view.faceDown && (
          <span
            aria-hidden="true"
            data-testid="blinded-marker"
            className="pointer-events-none absolute -left-px -top-px z-10 border border-zinc-500 bg-[color:var(--te-surface-0)] px-1 font-mono text-[9px] leading-4 tracking-wider text-zinc-300"
          >
            {view.structural
              ? `BLINDED · STRUCT ${view.structural.checks.filter((c) => c.passed).length}/${view.structural.checks.length}`
              : "BLINDED"}
          </span>
        )}
        <CardFlip
          faceUp={!view.faceDown}
          dealt
          animate={animate}
          delay={animate ? Math.min(index, 8) * 0.04 : 0}
          front={
            <span
              className="te-card-wobble block h-full p-2"
              style={{ animationDelay: `${-index * 0.9}s` }}
            >
              <CardFace view={view} />
            </span>
          }
          back={
            <CardBack
              card={{ slot: `hand-${index}`, faceDown: true }}
              className="h-full w-full"
            />
          }
        />
      </motion.button>
    </Reorder.Item>
  );
}
