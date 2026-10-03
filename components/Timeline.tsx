"use client";

import React, { useState } from "react";
import { hexToRgba } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBriefcase,
  IconFlame,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import { designManifest } from "@/lib/design-manifest";
import { RichNarrative } from "@/components/RichNarrative";
import { usePersona } from "@/components/providers/PersonaProvider";
import { useTerminology } from "@/components/providers/TerminologyProvider";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { dictionary, TimelineItem } from "@/lib/i18n-dictionary";
import type { TimelineMode } from "@/hooks/useTimelineState";

export type { TimelineItem };

const TIMELINE_ANNOUNCEMENTS: Record<TimelineMode, string> = {
  professional:
    "Timeline switched to Professional Summary: a concise overview of responsibilities and systems impact for each role.",
  "behind-the-scenes":
    "Timeline switched to Behind the Scenes Reality: the candid version of each role, engineering stories included.",
};

const MODE_LABELS: Record<TimelineMode, string> = {
  professional: "Professional Summary",
  "behind-the-scenes": "Behind the Scenes Reality",
};

export const Timeline: React.FC = () => {
  const { persona, setPersona } = usePersona();
  const { simplified } = useTerminology();
  const { announce } = useAnnouncer();
  const [localMode, setLocalMode] = useState<TimelineMode | null>(null);
  const [cardOverrides, setCardOverrides] = useState<
    Record<number, TimelineMode>
  >({});

  const globalMode: TimelineMode = localMode ?? persona;

  const [prevPersona, setPrevPersona] = useState(persona);
  if (persona !== prevPersona) {
    setPrevPersona(persona);
    setLocalMode(null);
    setCardOverrides({});
  }

  const handleGlobalToggle = (mode: TimelineMode) => {
    setLocalMode(mode);
    setPersona(mode);
    setCardOverrides({});
    announce(TIMELINE_ANNOUNCEMENTS[mode], "assertive");
  };

  const getCardMode = (idx: number): TimelineMode => {
    return cardOverrides[idx] ?? globalMode;
  };

  const handleCardToggle = (idx: number, role: string) => {
    const nextMode: TimelineMode =
      getCardMode(idx) === "professional"
        ? "behind-the-scenes"
        : "professional";
    setCardOverrides((prev) => ({
      ...prev,
      [idx]: nextMode,
    }));
    announce(`${role} now shows ${MODE_LABELS[nextMode]}.`, "polite");
  };

  const dict = simplified ? dictionary.simplified : dictionary.detailed;
  const activeTimeline = dict.timeline;

  return (
    <div className="w-full max-w-3xl mx-auto py-6 sm:py-8 relative select-none">
      {/* Global View Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mb-12 sm:mb-16 px-4 py-3 bg-[#13151a]/90 border border-white/10 rounded-2xl backdrop-blur-md w-full shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs font-mono text-zinc-400 self-start sm:self-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-bold text-zinc-200">Perspective:</span>
          </div>
          <span
            id="timeline-perspective-desc"
            className="text-[11px] text-zinc-400"
          >
            {globalMode === "behind-the-scenes"
              ? "The candid version, engineering stories included"
              : "Responsibilities & systems impact"}
          </span>
        </div>

        <div
          className="flex p-0.5 bg-black/60 border border-white/10 rounded-xl text-xs font-mono w-full sm:w-auto"
          role="group"
          aria-label="Timeline Reading Perspective"
          aria-describedby="timeline-perspective-desc"
        >
          <button
            type="button"
            onClick={() => handleGlobalToggle("behind-the-scenes")}
            aria-pressed={globalMode === "behind-the-scenes"}
            aria-label="Behind the Scenes Reality: Candid reality and engineering stories"
            title="Behind the Scenes Reality: Candid reality and engineering stories"
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg font-bold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              globalMode === "behind-the-scenes"
                ? "bg-[#1f232d] text-amber-300 border border-amber-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            }`}
          >
            <IconFlame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">
              BEHIND THE SCENES REALITY
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleGlobalToggle("professional")}
            aria-pressed={globalMode === "professional"}
            aria-label="Professional Summary: Concise overview of technical responsibilities and systems impact"
            title="Professional Summary: Concise overview of technical responsibilities and systems impact"
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg font-bold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              globalMode === "professional"
                ? "bg-[#1f232d] text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            }`}
          >
            <IconBriefcase className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] sm:text-xs">PROFESSIONAL SUMMARY</span>
          </button>
        </div>
      </div>

      {/* Vertical Rail Line */}
      <div className="absolute left-3 sm:left-4 md:left-1/2 top-28 bottom-0 w-0.5 bg-gradient-to-b from-amber-500/40 via-amber-500/15 to-transparent -translate-x-1/2" />

      <div className="space-y-10 sm:space-y-14">
        {activeTimeline.map((item, idx) => {
          const isLeft = idx % 2 === 0;
          const currentMode = getCardMode(idx);
          const isReality = currentMode === "behind-the-scenes";

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.8,
                delay: idx * 0.08,
                ...designManifest.motion.springs.timeline,
              }}
              className={`relative flex flex-col md:flex-row items-start md:items-center ${
                isLeft ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Timeline Bullet Node */}
              <div
                className={`absolute left-3 sm:left-4 md:left-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#0d0e11] border-2 -translate-x-1/2 z-10 flex items-center justify-center transition-colors duration-300 ${
                  isReality ? "border-amber-400" : "border-cyan-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                    isReality ? "bg-amber-400" : "bg-cyan-400"
                  }`}
                />
              </div>

              {/* Card Container */}
              <div
                className={`w-full md:w-[46%] pl-7 sm:pl-10 md:pl-0 ${isLeft ? "md:pr-10 md:text-right" : "md:pl-10"}`}
              >
                <div
                  style={
                    {
                      "--timeline-glow": `0 0 25px ${
                        isReality
                          ? hexToRgba(designManifest.colors.warning, 0.05)
                          : hexToRgba(designManifest.colors["brand-cyan"], 0.05)
                      }`,
                    } as React.CSSProperties
                  }
                  className={`p-4 sm:p-6 bg-[#13151a]/85 border rounded-2xl backdrop-blur-md transition-all duration-300 group shadow-lg ${
                    isReality
                      ? "border-amber-500/25 hover:border-amber-500/45"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div
                    className={`flex items-center justify-between gap-2 mb-3 ${isLeft ? "md:flex-row-reverse" : ""}`}
                  >
                    <span
                      className={`text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 border rounded-md transition-colors duration-300 ${
                        isReality
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
                          : "bg-cyan-500/10 text-cyan-300 border-cyan-500/25"
                      }`}
                    >
                      {item.period}
                    </span>

                    {/* Quick Flip Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleCardToggle(idx, item.role)}
                      aria-label={`${isReality ? "Behind the Scenes" : "Professional"} view of ${item.role}. Switch to ${MODE_LABELS[isReality ? "professional" : "behind-the-scenes"]}`}
                      title="Toggle perspective for this role"
                      className={`inline-flex items-center gap-1 min-h-8 px-2.5 py-1 text-[10px] font-mono rounded-lg border transition-colors cursor-pointer ${
                        isReality
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                          : "bg-white/5 text-zinc-300 border-white/10 hover:text-white hover:border-white/20"
                      }`}
                    >
                      <IconSwitchHorizontal className="w-3 h-3 shrink-0" />
                      <span>
                        {isReality ? "Behind the Scenes" : "Professional"}
                      </span>
                    </button>
                  </div>

                  <h3 className="text-sm sm:text-base md:text-lg font-bold text-zinc-100 group-hover:text-white transition-colors">
                    {item.role}
                  </h3>
                  <h4 className="text-xs font-mono font-semibold text-zinc-400 mt-1">
                    {item.company}
                  </h4>

                  {/* Animated Content Transition */}
                  <div className="mt-3 min-h-[70px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentMode}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className={`text-xs leading-relaxed font-sans ${
                          isReality
                            ? "text-amber-200/90 italic"
                            : "text-zinc-300"
                        }`}
                      >
                        <RichNarrative
                          html={
                            isReality
                              ? item.realityDescription
                              : item.professionalDescription
                          }
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Tag Chips */}
                  <div
                    className={`flex flex-wrap gap-1.5 mt-4 ${isLeft ? "md:justify-end" : ""}`}
                  >
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-[9px] font-mono bg-black/40 border border-white/10 text-zinc-400 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
