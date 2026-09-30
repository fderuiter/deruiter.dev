"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useKonamiCode } from "@/hooks/useKonamiCode";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAppEvent } from "@/hooks/useAppEvent";
import {
  IconSparkles,
  IconDeviceGamepad2,
  IconX,
  IconTerminal,
  IconCheck,
} from "@tabler/icons-react";

/** The route the overlay's call to action links to. */
const MEME_VAULT_PATH = "/arcade/meme-vault";

/**
 * How the overlay was opened: the typed Konami code, or a shortcut such as the
 * Meme Vault's chaos button, a Command Palette action or a terminal command.
 * Only the typed code earns the "Konami Sequence Detected" copy (#1328).
 */
type ChaosSource = "konami" | "shortcut";

export const RetroChaosOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<ChaosSource>("konami");
  const pathname = usePathname();
  const onVaultPage = pathname === MEME_VAULT_PATH;

  const handleKonami = useCallback(() => {
    setSource("konami");
    setIsOpen(true);
  }, []);

  const { resetActivation } = useKonamiCode(handleKonami);

  const overlayRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: () => {
      setIsOpen(false);
      resetActivation();
    },
    returnFocus: true,
  });

  // Listen for manual trigger events from Command Palette or Secret buttons
  useAppEvent("trigger_retro_chaos", () => {
    setSource("shortcut");
    setIsOpen(true);
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md font-mono"
          role="dialog"
          aria-modal="true"
          aria-label="Retro Chaos Mode Notification"
        >
          {/* CRT Scanline and Phosphor Glow Layer */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/30 via-slate-950/80 to-black/95 opacity-80" />
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] opacity-60" />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative z-10 w-full max-w-xl p-6 sm:p-8 rounded-2xl border-2 border-emerald-500/50 bg-slate-900/95 shadow-[0_0_50px_rgba(16,185,129,0.25)] text-slate-100 overflow-hidden"
          >
            {/* Top Close Button */}
            <button
              onClick={() => {
                setIsOpen(false);
                resetActivation();
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Close Chaos Overlay"
            >
              <IconX className="w-5 h-5" />
            </button>

            {/* Header Badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <IconSparkles className="w-3.5 h-3.5 animate-spin" />
                {source === "konami"
                  ? "Konami Sequence Detected"
                  : "Retro Chaos Mode"}
              </span>
              {source === "konami" && (
                <span className="text-xs text-slate-400">
                  ↑ ↑ ↓ ↓ ← → ← → B A
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
              <IconDeviceGamepad2 className="w-8 h-8 text-emerald-400 inline-block" />
              {source === "konami"
                ? "Retro Chaos Mode Unlocked!"
                : "Retro Chaos Mode On"}
            </h2>

            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {/* Say what actually happened: the vault itself is open to
                  everyone, so neither path unlocks it (#1556). */}
              {source === "konami" ? (
                <>
                  You typed the Konami code and earned the{" "}
                  <strong>Konami Code Pioneer</strong> trophy. The site footer
                  now keeps a Meme Vault link on every page.
                </>
              ) : (
                <>
                  Retro Chaos Mode is just for fun: a fanfare and the status
                  board below. It doesn&apos;t change how any page works.
                </>
              )}
            </p>

            {/* Meme Badges Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6 text-xs">
              <div className="flex min-w-0 items-start gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                <IconCheck className="w-4 h-4 mt-px text-emerald-400 shrink-0" />
                <span className="min-w-0 break-words leading-snug">
                  Duck: 100% Good Boy
                </span>
              </div>
              <div className="flex min-w-0 items-start gap-2 p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
                <IconCheck className="w-4 h-4 mt-px text-cyan-400 shrink-0" />
                <span className="min-w-0 break-words leading-snug">
                  Laser Loon: Ready
                </span>
              </div>
              <div className="flex min-w-0 items-start gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300">
                <IconCheck className="w-4 h-4 mt-px text-amber-400 shrink-0" />
                <span className="min-w-0 break-words leading-snug">
                  21 CFR Part 11: Valid
                </span>
              </div>
              <div className="flex min-w-0 items-start gap-2 p-2 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-300">
                <IconCheck className="w-4 h-4 mt-px text-purple-400 shrink-0" />
                <span className="min-w-0 break-words leading-snug">
                  32KB RAM: 0 Leaks
                </span>
              </div>
              <div className="flex min-w-0 items-start gap-2 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
                <IconCheck className="w-4 h-4 mt-px text-rose-400 shrink-0" />
                <span className="min-w-0 break-words leading-snug">
                  Friday Push: Armed
                </span>
              </div>
              <div className="flex min-w-0 items-start gap-2 p-2 rounded-lg bg-teal-950/40 border border-teal-500/30 text-teal-300">
                <IconCheck className="w-4 h-4 mt-px text-teal-400 shrink-0" />
                <span className="min-w-0 break-words leading-snug">
                  RFC 418: Teapot Warm
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {!onVaultPage && (
                <Link
                  href={MEME_VAULT_PATH}
                  onClick={() => {
                    setIsOpen(false);
                    resetActivation();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-colors focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                >
                  <IconDeviceGamepad2 className="w-4 h-4" />
                  Enter Secret Meme Vault
                </Link>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  resetActivation();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-sm font-semibold transition-colors focus:ring-2 focus:ring-slate-400 focus:outline-none"
              >
                <IconTerminal className="w-4 h-4" />
                Keep Exploring
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
