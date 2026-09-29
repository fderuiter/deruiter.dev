"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconTarget,
  IconKeyboard,
  IconShieldCheck,
  IconCpu,
  IconBulb,
  IconSparkles,
  IconCheck,
  IconArrowRight,
  IconBook2,
} from "@tabler/icons-react";
import { FieldManualData } from "@/types/game-manual";
import { useAudio } from "@/components/providers/AudioProvider";
import { ModalContainer } from "@/components/ui/ModalContainer";

/** A game action the manual offers, such as replaying a tutorial. */
export interface FieldManualAction {
  label: string;
  description?: string;
  onSelect: () => void;
}

interface FieldManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  manual: FieldManualData;
  action?: FieldManualAction;
}

type TabType = "objective" | "controls" | "rules" | "lore";

export function FieldManualModal({
  isOpen,
  onClose,
  manual,
  action,
}: FieldManualModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("objective");
  const { playHover, playAutocomplete, playSuccess } = useAudio();

  // Reset tab to objective on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setActiveTab("objective");
      }, 0);
      try {
        playSuccess();
      } catch {}
    }
  }, [isOpen, playSuccess]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    try {
      playAutocomplete();
    } catch {}
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalContainer
          isOpen={isOpen}
          onClose={onClose}
          titleId="manual-title"
          maxWidth="max-w-3xl"
          className="border border-zinc-800/80 rounded-3xl shadow-2xl shadow-cyan-950/20"
        >
          {/* Ambient Gradient Header Background */}
          <div
            className={`absolute top-0 left-0 right-0 h-36 bg-gradient-to-b ${manual.accentColor} pointer-events-none opacity-60`}
          />

          {/* Modal Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-zinc-900 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-inner text-cyan-400">
                <IconBook2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${manual.badgeBg}`}
                  >
                    {manual.badge}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    FIELD MANUAL · v2.4
                  </span>
                </div>
                <h2
                  id="manual-title"
                  className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1"
                >
                  {manual.title}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 font-sans mt-0.5">
                  {manual.subtitle}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              aria-label="Close Field Manual"
              className="p-2 rounded-xl text-zinc-400 hover:text-white bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800 transition-colors cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs Bar */}
          <div className="relative px-6 pt-2 border-b border-zinc-900/80 bg-zinc-950/60 flex gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleTabChange("objective")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === "objective"
                  ? "text-cyan-400 border-cyan-400 bg-cyan-950/20"
                  : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/40"
              }`}
            >
              <IconTarget className="w-4 h-4" />
              <span>1. Objective & Win Condition</span>
            </button>

            <button
              onClick={() => handleTabChange("controls")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === "controls"
                  ? "text-cyan-400 border-cyan-400 bg-cyan-950/20"
                  : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/40"
              }`}
            >
              <IconKeyboard className="w-4 h-4" />
              <span>2. Controls & Hotkeys</span>
            </button>

            <button
              onClick={() => handleTabChange("rules")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === "rules"
                  ? "text-cyan-400 border-cyan-400 bg-cyan-950/20"
                  : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/40"
              }`}
            >
              <IconShieldCheck className="w-4 h-4" />
              <span>3. Rules & Pro Tips</span>
            </button>

            <button
              onClick={() => handleTabChange("lore")}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                activeTab === "lore"
                  ? "text-cyan-400 border-cyan-400 bg-cyan-950/20"
                  : "text-zinc-400 hover:text-zinc-200 border-transparent hover:bg-zinc-900/40"
              }`}
            >
              <IconCpu className="w-4 h-4" />
              <span>4. Engineering Lore</span>
            </button>
          </div>

          {/* Modal Body with Custom Scroll */}
          <div className="relative flex-1 overflow-y-auto p-6 space-y-6 text-foreground font-sans">
            {/* Tab 1: Objective */}
            {activeTab === "objective" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Primary Objective Banner */}
                <div className="bg-gradient-to-r from-cyan-950/40 via-zinc-900/50 to-zinc-950 border border-cyan-500/20 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0 mt-0.5">
                      <IconTarget className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-cyan-300">
                        Primary Mission Objective
                      </h3>
                      <p className="text-sm sm:text-base text-zinc-100 font-medium leading-relaxed">
                        {manual.objective}
                      </p>
                    </div>
                  </div>
                </div>

                {action && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-zinc-900/40 p-4">
                    {action.description && (
                      <p className="min-w-0 text-sm text-zinc-300 break-words">
                        {action.description}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        action.onSelect();
                      }}
                      className="min-h-[44px] rounded-lg border border-amber-500 bg-amber-500/10 px-4 font-mono text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
                    >
                      {action.label}
                    </button>
                  </div>
                )}

                {/* Quick Summary Card */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    <IconSparkles className="w-4 h-4 text-amber-400" />
                    <span>Executive Overview</span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed font-sans">
                    {manual.quickSummary}
                  </p>
                </div>

                {/* Next Step CTA */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => handleTabChange("controls")}
                    onMouseEnter={() => playHover()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all cursor-pointer"
                  >
                    <span>Review Controls</span>
                    <IconArrowRight className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Tab 2: Controls & Hotkeys */}
            {activeTab === "controls" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-3">
                  {manual.controls.map((ctrl, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-900/40 border border-zinc-800/70 hover:border-zinc-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-white font-sans">
                          {ctrl.action}
                        </div>
                        <div className="text-xs text-zinc-400 leading-relaxed font-sans">
                          {ctrl.description}
                        </div>
                      </div>

                      {ctrl.key && (
                        <div className="shrink-0 flex items-center gap-1.5 self-start sm:self-center">
                          <kbd className="px-2.5 py-1 bg-zinc-950 border border-zinc-700/80 rounded-lg text-xs font-mono font-bold text-cyan-300 shadow-sm">
                            {ctrl.key}
                          </kbd>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => handleTabChange("objective")}
                    className="text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    ← Back to Objective
                  </button>
                  <button
                    onClick={() => handleTabChange("rules")}
                    onMouseEnter={() => playHover()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all cursor-pointer"
                  >
                    <span>Review Rules & Scoring</span>
                    <IconArrowRight className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Tab 3: Rules & Pro Tips */}
            {activeTab === "rules" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Detailed Rules */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <IconShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Core Engine Mechanics & Constraints</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {manual.rules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-4 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white font-sans">
                            {rule.title}
                          </h4>
                          {rule.badge && (
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-md">
                              {rule.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                          {rule.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pro Tips */}
                {manual.proTips.length > 0 && (
                  <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      <IconBulb className="w-4 h-4" />
                      <span>Tactical Pro Tips</span>
                    </div>
                    <ul className="space-y-1.5">
                      {manual.proTips.map((tip, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-zinc-300 font-sans"
                        >
                          <span className="text-amber-400 font-mono mt-0.5">
                            •
                          </span>
                          <span className="leading-relaxed">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => handleTabChange("controls")}
                    className="text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    ← Back to Controls
                  </button>
                  <button
                    onClick={() => handleTabChange("lore")}
                    onMouseEnter={() => playHover()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all cursor-pointer"
                  >
                    <span>Explore Engineering Lore</span>
                    <IconArrowRight className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Tab 4: Engineering Lore */}
            {activeTab === "lore" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                    <IconCpu className="w-4 h-4" />
                    <span>{manual.lore.title}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
                    {manual.lore.story}
                  </p>
                </div>

                {/* Real World Tech Stack */}
                <div className="space-y-2">
                  <div className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    Real-World Technologies & Theoretical Foundations:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {manual.lore.realWorldTech.map((tech, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono font-medium text-cyan-300 flex items-center gap-1.5"
                      >
                        <IconCheck className="w-3 h-3 text-cyan-400" />
                        <span>{tech}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={() => handleTabChange("rules")}
                    className="text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    ← Back to Rules
                  </button>
                  <button
                    onClick={onClose}
                    className="px-5 py-2 text-xs font-bold font-mono uppercase tracking-wider text-black bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    Ready to Play!
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Modal Footer Bar */}
          <div className="px-6 py-3 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Press [ESC] to close · [?] to open any time</span>
            <button
              onClick={onClose}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </ModalContainer>
      )}
    </AnimatePresence>
  );
}
