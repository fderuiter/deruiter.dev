"use client";

import React, { useEffect, useRef } from "react";
import type { SoundboardButton } from "@/lib/meme-data";
import { renderPadPictogram } from "./pictograms";
import { padIndexForKey, padKeyLabel } from "./vault-geometry";

interface SamplerPadsProps {
  pads: readonly SoundboardButton[];
  /** Id of the pad whose sound is playing, or null. */
  activeId: string | null;
  onPress: (pad: SoundboardButton) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * The sampler face: eight square graphite pads in a 4 by 2 grid (2 by 4 in a
 * narrow container). Each pad carries a key-cap label and a pictogram, lights
 * emerald while its sound plays, and answers to keys 1 to 8.
 */
export function SamplerPads({ pads, activeId, onPress }: SamplerPadsProps) {
  const onPressRef = useRef(onPress);
  const padsRef = useRef(pads);
  useEffect(() => {
    onPressRef.current = onPress;
    padsRef.current = pads;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // A modal (command palette, chaos overlay) owns the keyboard.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const index = padIndexForKey(event.key);
      if (index === null) return;
      const pad = padsRef.current[index];
      if (!pad) return;
      event.preventDefault();
      onPressRef.current(pad);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2.5 @lg:grid-cols-4 @lg:gap-3">
        {pads.map((pad, index) => {
          const isLit = activeId === pad.id;
          const key = padKeyLabel(index);
          return (
            <button
              key={pad.id}
              type="button"
              onClick={() => onPress(pad)}
              aria-label={`Play ${pad.label}`}
              aria-keyshortcuts={key}
              aria-describedby={`meme-pad-desc-${pad.id}`}
              data-lit={isLit ? "true" : "false"}
              className="meme-pad group relative isolate flex min-h-[7.5rem] min-w-0 flex-col justify-between overflow-hidden rounded-lg border border-white/[0.08] bg-[#1a1d24] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_0_#08090b] transition-transform duration-75 hover:border-white/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13151a] active:scale-[0.98] @lg:aspect-square @lg:p-4"
            >
              {/* Emerald press glow: an opacity-only layer, lit while the
                  pad's sound plays. */}
              <span aria-hidden="true" className="meme-pad-glow" />
              <span className="relative flex items-start justify-between gap-2">
                <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-white/[0.12] bg-[#0d0e11] px-1.5 font-mono text-[11px] font-semibold tabular-nums text-zinc-300 shadow-[0_1px_0_rgba(255,255,255,0.06)] group-data-[lit=true]:border-emerald-500/60 group-data-[lit=true]:text-emerald-300">
                  {key}
                </kbd>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  {pad.category}
                </span>
              </span>
              {renderPadPictogram(pad.id, {
                stroke: 1.5,
                className:
                  "relative mx-auto my-2 h-8 w-8 shrink-0 text-zinc-400 transition-colors duration-75 group-hover:text-zinc-200 group-data-[lit=true]:text-emerald-300 @lg:h-11 @lg:w-11",
              })}
              <span className="relative min-w-0">
                <span className="block text-[13px] font-semibold leading-tight text-zinc-100 @lg:text-sm">
                  {pad.label}
                </span>
                <span
                  id={`meme-pad-desc-${pad.id}`}
                  className="mt-1 hidden font-sans text-[11px] leading-snug text-zinc-500 @3xl:line-clamp-2"
                >
                  {pad.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
