"use client";

import React, { useId } from "react";
import {
  IconAdjustmentsHorizontal,
  IconBriefcase,
  IconChevronDown,
  IconFlame,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useAudio } from "@/components/providers/AudioProvider";
import { usePersona } from "@/components/providers/PersonaProvider";
import { useAnnouncer } from "@/components/providers/A11yProvider";
import { useFontPreference } from "@/hooks/useFontPreference";
import { PERSONA_ANNOUNCEMENTS, type PersonaType } from "@/lib/persona";

type PreferencesVariant = "popover" | "drawer";

const SOUND_PROFILES = [
  { id: "8-bit", label: "8-Bit", announce: "8-bit retro" },
  { id: "90s-retro", label: "90s", announce: "90s retro" },
  { id: "ambient", label: "Ambient", announce: "ambient pad" },
] as const;

const READING_MODE_HELP: Record<PersonaType, string> = {
  "behind-the-scenes":
    "Behind the Scenes Mode: The candid version, with the engineering stories left in.",
  professional:
    "Professional Mode: A concise overview of responsibilities and systems impact.",
};

/**
 * The single preferences surface: reading mode, sound and text, in labelled
 * sections. The desktop menu and the mobile drawer render this same panel, so
 * a preference reads and behaves the same on both. Every control keeps its
 * original storage key through the providers and hooks it reads.
 */
export function PreferencesPanel({ variant }: { variant: PreferencesVariant }) {
  const drawer = variant === "drawer";
  const headingId = useId();
  const readingId = useId();
  const readingHelpId = useId();
  const soundId = useId();
  const textId = useId();
  const { persona, setPersona } = usePersona();
  const { volume, muted, profile, setVolume, setMuted, setProfile } =
    useAudio();
  const { isDyslexic, toggleDyslexiaMode } = useFontPreference();
  const { announce } = useAnnouncer();

  const selectPersona = (next: PersonaType) => {
    setPersona(next);
    announce(PERSONA_ANNOUNCEMENTS[next], "assertive");
  };

  const toggleMuted = () => {
    setMuted(!muted);
    announce(muted ? "Sound on." : "Sound muted.", "polite");
  };

  const selectProfile = (next: (typeof SOUND_PROFILES)[number]) => {
    setProfile(next.id);
    announce(`Sound profile: ${next.announce}.`, "polite");
  };

  const toggleDyslexia = () => {
    toggleDyslexiaMode();
    announce(
      isDyslexic
        ? "Dyslexia font mode disabled. Using Atkinson Hyperlegible and Lexend."
        : "Dyslexia font mode enabled. Using OpenDyslexic typeface.",
      "polite"
    );
  };

  const sectionHeading =
    "text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400";
  const segment = drawer ? "min-h-11" : "min-h-9";
  const compact = drawer ? "min-h-11" : "min-h-8";

  return (
    <div
      className="flex min-w-0 flex-col gap-4"
      role="group"
      aria-labelledby={headingId}
    >
      <p
        id={headingId}
        className="text-[11px] font-mono font-bold tracking-wider text-zinc-300"
      >
        PREFERENCES
      </p>

      <section
        aria-labelledby={readingId}
        className="flex min-w-0 flex-col gap-2"
      >
        <h3 id={readingId} className={sectionHeading}>
          Reading mode
        </h3>
        <p
          id={readingHelpId}
          className="text-[11px] font-sans leading-normal text-zinc-400"
        >
          {READING_MODE_HELP[persona]}
        </p>
        <div
          className="flex rounded-xl border border-zinc-800 bg-zinc-900/85 p-0.5 text-[10px] font-mono select-none"
          role="group"
          aria-label="Reading Mode Selection"
          aria-describedby={readingHelpId}
        >
          <button
            type="button"
            onClick={() => selectPersona("behind-the-scenes")}
            aria-pressed={persona === "behind-the-scenes"}
            aria-label="Switch to Behind the Scenes Mode: Candid reality and engineering stories"
            title="Behind the Scenes Mode: Candid reality and engineering stories"
            className={cn(
              segment,
              "min-w-0 flex-1 rounded-lg px-2 font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
              persona === "behind-the-scenes"
                ? "bg-zinc-950 text-amber-400 border border-amber-400/20"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            )}
          >
            <IconFlame className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>{drawer ? "BEHIND THE SCENES" : "STORY"}</span>
          </button>
          <button
            type="button"
            onClick={() => selectPersona("professional")}
            aria-pressed={persona === "professional"}
            aria-label="Switch to Professional Mode: Concise overview of technical responsibilities and systems impact"
            title="Professional Mode: Concise overview of technical responsibilities and systems impact"
            className={cn(
              segment,
              "min-w-0 flex-1 rounded-lg px-2 font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
              persona === "professional"
                ? "bg-zinc-950 text-brand-cyan border border-brand-cyan/20"
                : "text-zinc-400 hover:text-zinc-200 border border-transparent"
            )}
          >
            <IconBriefcase className="h-3.5 w-3.5 shrink-0 text-brand-cyan" />
            <span>PROFESSIONAL</span>
          </button>
        </div>
      </section>

      <section
        aria-labelledby={soundId}
        className="flex min-w-0 flex-col gap-2 border-t border-zinc-800 pt-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id={soundId} className={sectionHeading}>
            Sound · {muted ? "off" : profile}
          </h3>
          <button
            type="button"
            onClick={toggleMuted}
            aria-pressed={muted}
            className={cn(
              compact,
              "flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2 text-[10px] font-mono font-bold text-brand-cyan cursor-pointer hover:border-brand-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            )}
          >
            {muted ? (
              <IconVolumeOff className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <IconVolume className="h-3.5 w-3.5" />
            )}
            {muted ? "Unmute" : "Mute"}
          </button>
        </div>
        <div className="flex justify-between text-[10px] font-mono text-zinc-500">
          <span>Volume</span>
          <span>{Math.round(volume * 100)}%</span>
        </div>
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="100"
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(parseFloat(e.target.value) / 100)}
          disabled={muted}
          className={cn(
            "w-full cursor-pointer accent-brand-cyan disabled:cursor-not-allowed disabled:opacity-40",
            drawer && "h-3"
          )}
        />
        <div className="grid grid-cols-3 gap-1.5">
          {SOUND_PROFILES.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={muted}
              onClick={() => selectProfile(option)}
              aria-pressed={profile === option.id}
              className={cn(
                compact,
                "min-w-0 rounded-lg border px-1 text-[10px] font-mono cursor-pointer active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan",
                profile === option.id
                  ? "border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section
        aria-labelledby={textId}
        className="flex min-w-0 flex-col gap-2 border-t border-zinc-800 pt-3"
      >
        <h3 id={textId} className={sectionHeading}>
          Text
        </h3>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="text-sm font-bold text-amber-400"
              aria-hidden="true"
            >
              Aa
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] font-mono font-bold text-zinc-300">
                Dyslexia font
              </span>
              <span className="text-[9px] font-mono text-zinc-500">
                OpenDyslexic mode
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleDyslexia}
            aria-pressed={isDyslexic}
            aria-label={
              isDyslexic
                ? "Disable OpenDyslexic font mode"
                : "Enable OpenDyslexic font mode"
            }
            className={cn(
              compact,
              "shrink-0 rounded-lg border px-3 text-[10px] font-mono font-bold cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
              isDyslexic
                ? "border-amber-400/50 bg-amber-400/15 text-amber-300"
                : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-white"
            )}
          >
            {isDyslexic ? "ON" : "OFF"}
          </button>
        </div>
      </section>
    </div>
  );
}

interface PreferencesMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  triggerRef: React.Ref<HTMLButtonElement>;
}

/**
 * The top bar's one preferences control: a disclosure button that opens the
 * shared panel. Escape handling and focus restoration live in the Navbar, next
 * to the other desktop disclosures.
 */
export function PreferencesMenu({
  isOpen,
  onToggle,
  onClose,
  triggerRef,
}: PreferencesMenuProps) {
  const { muted } = useAudio();

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open navigation preferences"
        aria-controls="navigation-preferences"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-mono text-zinc-300 cursor-pointer transition-colors hover:border-brand-cyan/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40"
      >
        <IconAdjustmentsHorizontal className="h-3.5 w-3.5 text-brand-cyan" />
        <span>Preferences</span>
        {muted && (
          <IconVolumeOff
            className="h-3 w-3 text-zinc-500"
            role="img"
            aria-label="Sound muted"
          />
        )}
        <IconChevronDown
          className={cn(
            "h-3 w-3 text-zinc-500 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation preferences"
            className="fixed inset-0 z-40 cursor-default"
            onClick={onClose}
          />
          <div
            id="navigation-preferences"
            className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
          >
            <PreferencesPanel variant="popover" />
          </div>
        </>
      )}
    </div>
  );
}
