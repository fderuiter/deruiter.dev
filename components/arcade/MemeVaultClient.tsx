"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { IntentLink } from "@/components/ui/IntentLink";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  MEME_QUOTES,
  SOUNDBOARD_BUTTONS,
  EASTER_EGG_ACHIEVEMENTS,
  ASCII_COWSAY,
  ASCII_DUCK,
  ASCII_LASER_LOON,
  ASCII_TRAIN,
  SANDBOX_TERMINAL_HREF,
} from "@/lib/meme-data";
import { playMemeSound } from "@/lib/meme-audio";
import { useAudio } from "@/components/providers/AudioProvider";
import { FieldManualButton } from "@/components/FieldManualButton";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  IconSparkles,
  IconTrophy,
  IconVolume,
  IconVolumeOff,
  IconCopy,
  IconCheck,
  IconTerminal,
  IconArrowLeft,
  IconRocket,
  IconMessage2,
  IconSchool,
} from "@tabler/icons-react";
import { Oscilloscope } from "@/components/arcade/meme-vault/Oscilloscope";
import { SamplerPads } from "@/components/arcade/meme-vault/SamplerPads";
import { TrophyShelf } from "@/components/arcade/meme-vault/TrophyShelf";
import { VaultHero } from "@/components/arcade/meme-vault/VaultHero";
import { EchoConsole } from "@/components/arcade/meme-vault/EchoConsole";
import { useMemeVaultSession } from "@/components/arcade/meme-vault/useMemeVaultSession";
import { TutorialOverlay, useTutorialRun } from "@/components/arcade/tutorial";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  MEME_VAULT_TUTORIAL,
  MEME_VAULT_TUTORIAL_SIGNALS,
} from "@/lib/meme-vault";

/**
 * A copy button's word, shown on a phone or a touch screen so the 44px key
 * says what it does (#3521); a desktop keeps the bare icon. The button's
 * aria-label still names it in full.
 */
function CopyLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="hidden text-xs pointer-coarse:inline max-md:inline"
    >
      {children}
    </span>
  );
}

export const MemeVaultClient: React.FC = () => {
  const { muted, setMuted, bypassActive, bypassReason, setReducedMotionOptIn } =
    useAudio();
  // The reduced-motion opt-in lasts only while the vault is open.
  const setOptInRef = useRef(setReducedMotionOptIn);
  useEffect(() => {
    setOptInRef.current = setReducedMotionOptIn;
  });
  useEffect(() => () => setOptInRef.current?.(false), []);

  // The room's guided tutorial (#3450). The vault has no cabinet, so the
  // sampler panel is its stage: the offer shows once the panel is in view,
  // and the Tutorial button beside Sound replays it.
  const tutorialRun = useTutorialRun(MEME_VAULT_TUTORIAL);
  const { signal: tutorialSignal } = tutorialRun.value;
  const touch = useMediaQuery("(pointer: coarse)");
  // The manual is a modal: the coach card waits behind it.
  const [manualOpen, setManualOpen] = useState(false);
  const stageRef = useRef<HTMLElement | null>(null);
  const [stageSeen, setStageSeen] = useState(false);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || stageSeen || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStageSeen(true);
          observer.disconnect();
        }
      },
      // Seen once about a third of it is on screen, which on a phone is
      // the Echo strip and the first pads.
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stageSeen]);
  // The room scrolls, unlike a cabinet's stage, so each card the tutorial
  // shows is brought into view below the site header once it is placed.
  const { status: tutorialStatus, index: tutorialIndex } = tutorialRun.state;
  const offerShowing = stageSeen && tutorialRun.offered;
  useEffect(() => {
    if (!offerShowing && tutorialStatus === "idle") return;
    const bringIntoView = () => {
      const card = stageRef.current?.querySelector<HTMLElement>(
        '[data-testid^="tutorial-"][role]'
      );
      if (!card) return;
      // Clear of the fixed site header, as revealPlayArea does.
      const header = document.querySelector("header");
      const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + 12;
      const rect = card.getBoundingClientRect();
      let delta = 0;
      if (rect.top < top) delta = rect.top - top;
      else if (rect.bottom > window.innerHeight - 12) {
        delta = Math.min(rect.bottom - window.innerHeight + 12, rect.top - top);
      }
      if (delta === 0) return;
      const reduce = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
    };
    // Once placed, and again after the card's next re-measure, which can
    // move it when its control shifts.
    const timers = [60, 400].map((ms) => setTimeout(bringIntoView, ms));
    return () => timers.forEach(clearTimeout);
  }, [offerShowing, tutorialStatus, tutorialIndex]);
  const changeMuted = (next: boolean) => {
    setMuted(next);
    tutorialSignal(MEME_VAULT_TUTORIAL_SIGNALS.sound);
  };

  const {
    activeSound,
    activeSoundLabel,
    analyser,
    echo,
    handlePadPress,
    missedPad,
    silentPress,
    stampId,
    startEcho,
    totalAchievements,
    triggerChaosMode,
    unlockedCount,
    unlockedIds,
  } = useMemeVaultSession({ tutorial: tutorialRun.value });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [asciiTab, setAsciiTab] = useState<
    "cowsay" | "duck" | "loon" | "train"
  >("cowsay");
  const [reactions, setReactions] = useState<Record<string, number>>({});
  // Starting Echo brings the Echo strip and all eight pads into view, so the
  // vault never plays a sequence below the fold (#2124).
  const playAreaRef = useRef<HTMLDivElement | null>(null);
  const revealPlayArea = useCallback(() => {
    const el = playAreaRef.current;
    if (!el || typeof window === "undefined") return;
    const header = document.querySelector("header");
    const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + 12;
    const rect = el.getBoundingClientRect();
    // Not laid out (a hidden tab or a test DOM): nothing to scroll to.
    if (rect.height === 0) return;
    if (rect.top >= top && rect.bottom <= window.innerHeight) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Too tall to fit: align the bottom of the pads, keeping as much of the
    // Echo strip as the viewport allows; otherwise align its top.
    const room = window.innerHeight - top;
    const delta =
      rect.height > room
        ? rect.bottom - window.innerHeight + 8
        : rect.top - top;
    window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const onStartEcho = () => {
    startEcho();
    // After the start renders, so the strip's new lines count. A running
    // tutorial scrolls to its own card instead.
    if (!tutorialRun.value.active) requestAnimationFrame(revealPlayArea);
  };

  // React to meme card
  const handleReaction = (id: string) => {
    setReactions((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
    playMemeSound("laser");
  };

  const filteredQuotes = MEME_QUOTES.filter(
    (q) => selectedCategory === "all" || q.category === selectedCategory
  );

  const silentReason: React.ReactNode = bypassActive ? (
    bypassReason === "reduced-motion" ? (
      <>
        Sound is off while reduced motion is on.{" "}
        <button
          type="button"
          onClick={() => {
            setReducedMotionOptIn(true);
            changeMuted(false);
          }}
          className="font-semibold text-emerald-400 underline underline-offset-2 hover:text-emerald-300 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
        >
          Play sound anyway
        </button>
      </>
    ) : (
      "Sound is off while high contrast is on."
    )
  ) : muted ? (
    <>
      Sound is off.{" "}
      <button
        type="button"
        onClick={() => changeMuted(false)}
        className="font-semibold text-emerald-400 underline underline-offset-2 hover:text-emerald-300 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
      >
        Turn sound on
      </button>
    </>
  ) : null;

  const getAsciiContent = () => {
    switch (asciiTab) {
      case "cowsay":
        return ASCII_COWSAY("You found the secret handshake.");
      case "duck":
        return ASCII_DUCK();
      case "loon":
        return ASCII_LASER_LOON();
      case "train":
        return ASCII_TRAIN();
    }
  };

  return (
    <div
      data-game="meme-vault"
      className="meme-vault w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 font-mono text-zinc-100 pointer-coarse:touch-manipulation"
    >
      {/* Navigation Breadcrumb & Chaos Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <IntentLink
          href="/arcade"
          className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-100 transition-colors pointer-coarse:min-h-11"
        >
          <IconArrowLeft className="w-4 h-4" />
          <span>Back to Arcade Hub</span>
        </IntentLink>
        <Breadcrumbs path="/arcade/meme-vault" className="mr-auto" />

        <div className="flex flex-wrap items-center gap-2">
          <FieldManualButton
            manualId="meme-vault"
            variant="inline"
            onOpenChange={(open) => {
              setManualOpen(open);
              if (open) tutorialSignal(MEME_VAULT_TUTORIAL_SIGNALS.manual);
            }}
          />
          <button
            onClick={triggerChaosMode}
            title="A shortcut to the Konami show. It awards no trophy: type the code for that."
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-[#13151a] hover:bg-[#1a1d24] text-zinc-200 border border-white/[0.08] hover:border-white/[0.16] text-xs font-semibold transition-colors active:scale-[0.98] pointer-coarse:min-h-11"
          >
            <IconSparkles className="w-4 h-4 text-amber-400" />
            <span>Launch Retro Chaos Mode</span>
          </button>
        </div>
      </div>

      <VaultHero unlocked={unlockedCount} total={totalAchievements} />

      {/* Section 1: The sampler face: oscilloscope and eight pads */}
      <section
        ref={stageRef}
        className="relative mb-14"
        aria-labelledby="meme-sampler-heading"
        data-arcade-cabinet="meme-vault"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2 rounded-md bg-[#13151a] border border-white/[0.08] text-emerald-400">
              <IconVolume className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="meme-sampler-heading"
                className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-[#f4f4f6]"
              >
                8-Pad Retro Sampler
              </h2>
              <p className="text-xs text-zinc-400 font-sans">
                Every sound is generated in your browser. Press a pad, or keys 1
                to 8, or start Echo and repeat the vault&apos;s sequence.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={tutorialRun.start}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-amber-500/30 bg-[#13151a] px-3 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-400/60 hover:text-amber-200 active:scale-[0.98] pointer-coarse:min-h-11"
              data-testid="meme-tutorial-key"
            >
              <IconSchool aria-hidden="true" className="h-4 w-4" />
              <span>Tutorial</span>
            </button>
            {!bypassActive && (
              <button
                type="button"
                onClick={() => changeMuted(!muted)}
                aria-pressed={!muted}
                data-tutorial-target="sound"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-white/[0.08] bg-[#13151a] px-3 text-xs font-semibold text-zinc-300 transition-colors hover:border-white/[0.16] hover:text-zinc-100 active:scale-[0.98] pointer-coarse:min-h-11"
              >
                {muted ? (
                  <IconVolumeOff className="h-4 w-4 text-zinc-400" />
                ) : (
                  <IconVolume className="h-4 w-4 text-emerald-400" />
                )}
                <span>{muted ? "Sound off" : "Sound on"}</span>
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#13151a] p-3 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:gap-5 pointer-coarse:landscape:lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] pointer-coarse:landscape:lg:gap-5">
            {/* Echo and the pads come first, so in one column the scope sits
                below them and never pushes the pads off screen (#2124). */}
            {/* The play area takes focus during the tutorial's practice
                steps: keys 1 to 8 press the pads, Enter or Space starts
                Echo, and ? opens the manual (#3450). */}
            <div
              ref={playAreaRef}
              className="min-w-0 focus:outline-none"
              tabIndex={-1}
              data-keyboard-boundary="true"
              data-field-manual="meme-vault"
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (echo.round && echo.round.phase !== "over") return;
                onStartEcho();
              }}
            >
              {silentPress && silentReason && (
                <p
                  className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 font-sans text-xs text-amber-200"
                  data-testid="meme-silent-press"
                >
                  That pad played silently. {silentReason}
                </p>
              )}
              <EchoConsole
                round={echo.round}
                best={echo.best}
                early={echo.early}
                onStart={onStartEcho}
                onStop={echo.stop}
                silentReason={silentReason}
                missedPad={missedPad}
              />
              <SamplerPads
                pads={SOUNDBOARD_BUTTONS}
                activeId={echo.litId ?? activeSound}
                missedId={echo.missedId}
                onPress={handlePadPress}
              />
            </div>
            <div className="min-w-0">
              <Oscilloscope
                analyser={analyser}
                isPlaying={activeSound !== null || echo.litId !== null}
                soundLabel={activeSoundLabel}
                silentReason={silentReason}
              />
              <dl className="mt-3 hidden grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.08] font-mono text-[11px] pointer-coarse:text-xs max-md:text-xs tabular-nums xl:grid">
                <div className="bg-[#0d0e11] p-2.5">
                  <dt className="uppercase tracking-wider text-zinc-400">
                    Pads
                  </dt>
                  <dd className="mt-0.5 text-zinc-200">8 · keys 1–8</dd>
                </div>
                <div className="bg-[#0d0e11] p-2.5">
                  <dt className="uppercase tracking-wider text-zinc-400">
                    Output
                  </dt>
                  <dd className="mt-0.5 text-zinc-200">1 ch mono</dd>
                </div>
                <div className="col-span-2 bg-[#0d0e11] p-2.5">
                  <dt className="uppercase tracking-wider text-zinc-400">
                    Last pad
                  </dt>
                  <dd className="mt-0.5 truncate text-zinc-200">
                    {activeSoundLabel || "None yet"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* The guided tutorial's offer, coach card and closing card, over
            the sampler (#3450). */}
        <TutorialOverlay
          run={tutorialRun}
          gameName="Meme Vault"
          launched={stageSeen}
          touch={touch}
          covered={manualOpen}
        />
      </section>

      {/* Section 2: Easter Egg Trophy Shelf */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-md bg-[#13151a] border border-white/[0.08] text-amber-400">
            <IconTrophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-[#f4f4f6]">
              Easter Egg Trophy Case
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              Discover secret interactions across the terminal, footer, command
              palette, and games.
            </p>
          </div>
        </div>

        <TrophyShelf
          achievements={EASTER_EGG_ACHIEVEMENTS}
          unlockedIds={unlockedIds}
          stampId={stampId}
        />
      </section>

      {/* Section 3: Interactive Meme Deck */}
      <section className="mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-[#13151a] border border-white/[0.08] text-slate-400">
              <IconMessage2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-[#f4f4f6]">
                Engineering Meme Deck
              </h2>
              <p className="text-xs text-zinc-400 font-sans">
                A few jokes about code, clinical data, and getting through the
                workday.
              </p>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div
            role="group"
            aria-label="Filter quotes by category"
            className="flex flex-wrap gap-1.5 p-1 rounded-md bg-[#13151a] border border-white/[0.08] text-xs"
          >
            {["all", "dev", "medtech", "lore", "classic"].map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded capitalize font-semibold transition-colors active:scale-95 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-4 ${
                  selectedCategory === cat
                    ? "bg-[#1a1d24] text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuotes.map((q) => {
            const rxCount = reactions[q.id] || 0;
            return (
              <div
                key={q.id}
                className="p-5 rounded-lg border border-white/[0.08] bg-[#13151a] hover:border-white/[0.16] transition-colors flex min-w-0 flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
                    <span className="px-2 py-0.5 rounded-sm border border-white/[0.08] text-zinc-400 font-mono uppercase tracking-wider text-[10px] pointer-coarse:text-xs max-md:text-xs font-bold">
                      {q.tagline || q.category}
                    </span>
                    <CopyButton
                      text={`"${q.quote}" by ${q.author}`}
                      icon={<IconCopy className="w-4 h-4" />}
                      copiedIcon={
                        <IconCheck className="w-4 h-4 text-emerald-400" />
                      }
                      className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center pointer-coarse:gap-1.5 max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center max-md:gap-1.5"
                      title="Copy Quote"
                      label={<CopyLabel>Copy</CopyLabel>}
                      copiedLabel={<CopyLabel>Copied</CopyLabel>}
                      aria-label="Copy Quote"
                      successMessage="Copied quote to clipboard"
                    />
                  </div>

                  <blockquote className="text-sm font-sans text-zinc-100 font-medium leading-relaxed mb-4">
                    &ldquo;{q.quote}&rdquo;
                  </blockquote>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs">
                  <cite className="text-zinc-400 text-[11px] pointer-coarse:text-xs max-md:text-xs truncate max-w-[200px] sm:max-w-xs not-italic">
                    by {q.author}
                  </cite>
                  <button
                    onClick={() => handleReaction(q.id)}
                    aria-label={
                      rxCount > 0
                        ? `React to quote (${rxCount})`
                        : "React to quote"
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.08] bg-[#1a1d24] hover:border-white/[0.16] text-zinc-300 text-[11px] pointer-coarse:text-xs max-md:text-xs transition-transform active:scale-95 pointer-coarse:min-h-11 pointer-coarse:px-4"
                  >
                    <IconRocket
                      aria-hidden="true"
                      className="w-3.5 h-3.5 text-zinc-400"
                    />
                    <span>{rxCount > 0 ? rxCount : "React"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 4: ASCII Art Console */}
      <section className="mb-12">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <IconTerminal className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#f4f4f6]">
              ASCII Terminal Studio
            </h2>
          </div>

          <div
            role="group"
            aria-label="ASCII art"
            className="flex flex-wrap gap-1.5 p-1 rounded-md bg-[#13151a] border border-white/[0.08] text-xs"
          >
            {(["cowsay", "duck", "loon", "train"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={asciiTab === tab}
                onClick={() => setAsciiTab(tab)}
                className={`px-3 py-1 rounded uppercase tracking-wider text-[10px] pointer-coarse:text-xs max-md:text-xs font-bold transition-colors active:scale-95 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-4 ${
                  asciiTab === tab
                    ? "bg-[#1a1d24] text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                {tab === "loon" ? "laser loon" : tab}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-xs text-zinc-400 font-sans">
          A gallery of the terminal&apos;s ASCII art. It does not award
          trophies. Type the commands in the{" "}
          <IntentLink
            href={SANDBOX_TERMINAL_HREF}
            className="underline underline-offset-2 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            sample commands terminal
          </IntentLink>{" "}
          to earn them.
        </p>

        <div className="relative rounded-lg border border-white/[0.08] bg-[#0d0e11] p-4 sm:p-6 overflow-x-auto shadow-inner">
          <CopyButton
            text={() => getAsciiContent()}
            icon={<IconCopy className="w-4 h-4" />}
            copiedIcon={<IconCheck className="w-4 h-4 text-emerald-400" />}
            className="absolute top-4 right-4 max-md:static max-md:mb-3 p-2 rounded-lg bg-[#13151a] hover:bg-[#1a1d24] text-zinc-400 hover:text-zinc-100 border border-white/[0.08] transition-colors cursor-pointer pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center pointer-coarse:gap-1.5 max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center max-md:gap-1.5"
            title="Copy ASCII Art"
            label={<CopyLabel>Copy</CopyLabel>}
            copiedLabel={<CopyLabel>Copied</CopyLabel>}
            aria-label="Copy ASCII Art"
            successMessage="Copied ASCII art to clipboard"
          />
          <pre className="text-xs sm:text-sm text-emerald-400 font-mono leading-tight select-all">
            {getAsciiContent()}
          </pre>
        </div>
      </section>
    </div>
  );
};
