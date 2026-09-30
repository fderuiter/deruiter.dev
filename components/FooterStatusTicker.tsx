"use client";

import React, {
  useState,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  STATUS_TICKER_ITEMS,
  unlockAchievement,
  isVaultUnlocked,
} from "@/lib/meme-data";
import { playMemeSound } from "@/lib/meme-audio";
import { onAppEvent } from "@/lib/event-bus";
import { generateId } from "@/lib/utils";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { useInterval } from "@/hooks/useInterval";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";

function subscribeVaultUnlock(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const offVaultChange = onAppEvent("meme_vault_unlocked_change", callback);
  window.addEventListener("storage", callback);
  return () => {
    offVaultChange();
    window.removeEventListener("storage", callback);
  };
}

function getVaultSnapshot(): boolean {
  return isVaultUnlocked();
}

function getVaultServerSnapshot(): boolean {
  return false;
}

const DUCK_QUOTES = [
  "You could be petting me right now.",
  "The ball is under the desk again.",
  "I reviewed the code. It needs more walks.",
  "Your keyboard makes an excellent pillow.",
  "Meeting agenda: outside?",
  "I have no notes. I cannot read.",
];

interface TreatParticle {
  id: string | number;
  x: number;
  y: number;
}

export const FooterStatusTicker: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [tickerIndex, setTickerIndex] = useState(0);
  const [duckBubble, setDuckBubble] = useState<string | null>(null);
  const [duckBarks, setDuckBarks] = useState(0);
  const [treats, setTreats] = useState<TreatParticle[]>([]);

  const vaultUnlocked = useSyncExternalStore(
    subscribeVaultUnlock,
    getVaultSnapshot,
    getVaultServerSnapshot
  );

  // Rotate status ticker every 4.5 seconds. Setting `data-ticker-paused` on
  // the ticker root holds the current line: accessibility audits use it so a
  // scan cannot land mid-cross-fade, where the partial opacity reads as a
  // contrast failure (#952).
  const tickerLineRef = useRef<HTMLDivElement>(null);
  useInterval(() => {
    if (tickerLineRef.current?.closest("[data-ticker-paused]")) return;
    setTickerIndex((prev) => (prev + 1) % STATUS_TICKER_ITEMS.length);
  }, 4500);

  // The only timeout this component schedules is the quote dismissal, so
  // clearing all of them restarts that countdown.
  const { setSafeTimeout, clearAll: clearBubbleTimeout } = useSafeTimeout();

  // Handle Duck click
  const handleDuckClick = useCallback(() => {
    playMemeSound("bark");
    unlockAchievement("duck-whisperer");

    setDuckBarks((b) => b + 1);

    // Pick random quote
    const nextQuote =
      DUCK_QUOTES[Math.floor(Math.random() * DUCK_QUOTES.length)];
    setDuckBubble(nextQuote);

    // Spawn a bouncing treat particle
    const treatId = generateId("treat-");
    setTreats((prev) => [
      ...prev.slice(-4),
      { id: treatId, x: Math.random() * 40 - 20, y: -40 },
    ]);

    // Dismiss the quote bubble 3.5 seconds after the latest click. Restarting
    // the countdown keeps an earlier click from hiding a newer quote early.
    clearBubbleTimeout();
    setSafeTimeout(() => {
      setDuckBubble(null);
    }, 3500);
  }, [clearBubbleTimeout, setSafeTimeout]);

  const tickerObserverRef = useResizeObserver<HTMLDivElement>(
    (entry) => {
      const h = Math.round(entry.contentRect.height);
      if (typeof document !== "undefined" && h > 0) {
        document.documentElement.style.setProperty("--footer-height", `${h}px`);
        document.documentElement.style.setProperty("--ticker-height", `${h}px`);
      }
    },
    { trackVertical: true }
  );

  return (
    <div
      ref={tickerObserverRef}
      data-testid="footer-status-ticker"
      className="w-full border-t border-zinc-800/60 bg-zinc-950/60 backdrop-blur-md px-4 py-3 text-xs font-mono"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Live Status Ticker */}
        <div className="flex items-center gap-2.5 overflow-hidden w-full sm:w-auto">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping-settle absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-zinc-400 uppercase tracking-wider text-[10px] font-semibold shrink-0">
            Footnotes:
          </span>
          <div
            ref={tickerLineRef}
            className="h-5 overflow-hidden relative flex-1 sm:w-80"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={tickerIndex}
                initial={shouldReduceMotion ? false : { y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { y: -12, opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.25 }}
                className="text-zinc-300 truncate block"
              >
                {STATUS_TICKER_ITEMS[tickerIndex]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Interactive Mascot & Secret Vault Link */}
        <div className="flex items-center gap-4 relative">
          {/* Secret Vault Badge (if unlocked) */}
          {vaultUnlocked && (
            <Link
              href="/arcade/meme-vault"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] transition-colors"
            >
              <IconDeviceGamepad2 className="w-3.5 h-3.5" />
              <span>Meme Vault Unlocked</span>
            </Link>
          )}

          {/* Duck Mascot Button with Speech Bubble and Physics Treats */}
          <div className="relative">
            <AnimatePresence>
              {duckBubble && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: -8 }}
                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                  className="absolute bottom-full right-0 mb-2 w-56 sm:w-64 p-2.5 rounded-xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs shadow-xl z-20 pointer-events-none"
                >
                  <p className="leading-snug font-sans">{duckBubble}</p>
                  <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-amber-950/90" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bouncing Treats */}
            {treats.map((treat) => (
              <motion.span
                key={treat.id}
                initial={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                animate={{
                  y: [0, -35, 15],
                  x: treat.x,
                  opacity: [1, 1, 0],
                  scale: [1, 1.25, 0.75],
                  rotate: [0, treat.x > 0 ? 60 : -60, treat.x > 0 ? 120 : -120],
                }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="absolute -top-3 left-2 text-sm pointer-events-none z-10 select-none"
              >
                🦴
              </motion.span>
            ))}

            <button
              onClick={handleDuckClick}
              type="button"
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] transition-transform active:scale-95 focus:outline-none focus:ring-1 focus:ring-amber-400"
              title="Click to pet Duck the Golden Retriever!"
              aria-label="Pet Duck the puppy"
            >
              <span className="text-sm transition-transform group-hover:scale-125">
                🐕
              </span>
              <span className="hidden sm:inline">Duck</span>
              <span className="text-[10px] text-amber-400/80 bg-amber-400/10 px-1 rounded">
                {duckBarks > 0 ? `+${duckBarks} barks` : "pet me"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
