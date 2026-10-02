"use client";

import React, { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_RUN_CHOICE,
  challengeChoice,
  challengeOrigin,
  dailySeed,
  normalizeSeed,
  isChoiceUnlocked,
  sponsorOptions,
  stakeOptions,
  unlockedStake,
  type Challenge,
  type CustomScenarioSpec,
  type RunChoice,
  type RunOrigin,
  type SponsorId,
  type Unlocks,
} from "@/lib/trial-and-error";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  freshSeed,
  useUtcToday,
} from "@/components/trial-and-error/useChallenge";
import { DeckBuilder } from "@/components/trial-and-error/DeckBuilder";

type Choice = "RANDOM" | "SEEDED" | "DAILY";

const BUTTON =
  "min-h-[48px] border px-4 py-3 text-xs font-bold uppercase tracking-wider touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]";

const OPTION =
  "flex min-h-[44px] items-start gap-3 border p-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400";

const RADIO = "mt-0.5 h-5 w-5 shrink-0 accent-amber-400";

interface NewRunProps {
  /** A challenge link's seed, sponsor and stake, which pre-fill the dialog. */
  challenge: Challenge | null;
  /** The current run has moves that starting over would discard. */
  discards: boolean;
  /** The sponsors and stakes this browser has unlocked (#950). */
  unlocks: Unlocks;
  /** The current run's sponsor and stake, pre-selected when still open. */
  current?: RunChoice;
  onStart: (
    seed: string,
    origin: RunOrigin,
    choice: RunChoice,
    customScenario?: CustomScenarioSpec
  ) => void;
  onClose: () => void;
}

/** Whether a choice is the challenge link's own sponsor and stake. */
function isLinked(linked: RunChoice | null, choice: RunChoice): boolean {
  return (
    linked !== null &&
    linked.sponsorId === choice.sponsorId &&
    linked.stake === choice.stake
  );
}

/**
 * Whether a sponsor and stake may be started here: unlocked in this
 * browser, or exactly the challenge link's.
 */
function isAllowed(
  unlocks: Unlocks,
  linked: RunChoice | null,
  choice: RunChoice
): boolean {
  return isChoiceUnlocked(unlocks, choice) || isLinked(linked, choice);
}

/** The choice a dialog opens on: the link's, the current run's, or the default. */
function initialChoice(
  unlocks: Unlocks,
  linked: RunChoice | null,
  current: RunChoice | undefined
): RunChoice {
  if (linked) return linked;
  if (current && isChoiceUnlocked(unlocks, current)) return current;
  return DEFAULT_RUN_CHOICE;
}

/** The note a pre-selected option from a challenge link carries. */
function LinkNote() {
  return (
    <span className="block text-amber-300" data-testid="challenge-choice-note">
      From a challenge link
    </span>
  );
}

/**
 * New Run (#1528, #950): start the campaign on a random seed, a seed typed
 * in or opened from a challenge link, or today's Daily Protocol, under a
 * chosen sponsor and GCP-audit stake. Locked sponsors and stakes stay in the
 * list, disabled, each saying how to unlock it. A challenge link's sponsor
 * and stake can always be played, unlocked here or not, so a friend's run
 * replays. The Daily Protocol is always Virtual Biotech at stake 1. A
 * focus-trapped dialog; Escape or Cancel closes it and nothing changes.
 */
export function NewRun({
  challenge,
  discards,
  unlocks,
  current,
  onStart,
  onClose,
}: NewRunProps) {
  const today = useUtcToday();
  const linked =
    challenge && !challenge.daily ? challengeChoice(challenge) : null;
  const [choice, setChoice] = useState<Choice>(challenge ? "SEEDED" : "RANDOM");
  const [typed, setTyped] = useState(challenge?.seed ?? "");
  const [error, setError] = useState<string | null>(null);
  const [deckBuilderOpen, setDeckBuilderOpen] = useState(false);
  const [runChoice, setRunChoice] = useState<RunChoice>(() =>
    initialChoice(unlocks, linked, current)
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const ref = useFocusTrap<HTMLDivElement>(true, {
    onEscape: onClose,
    initialFocusRef: challenge ? inputRef : firstRef,
  });
  const id = useId();
  const errorId = `${id}-error`;
  const daily = choice === "DAILY";
  const sponsors = sponsorOptions(unlocks);
  const stakes = stakeOptions(unlocks, runChoice.sponsorId);

  // Switching sponsor keeps the stake when it is open for the new one, and
  // otherwise takes the link's stake or the highest unlocked one.
  const pickSponsor = (sponsorId: SponsorId) => {
    const keep = { sponsorId, stake: runChoice.stake };
    if (isAllowed(unlocks, linked, keep)) {
      setRunChoice(keep);
    } else if (linked?.sponsorId === sponsorId) {
      setRunChoice(linked);
    } else {
      const top = unlockedStake(unlocks, sponsorId) ?? 1;
      setRunChoice({ sponsorId, stake: Math.min(runChoice.stake, top) });
    }
  };

  const start = () => {
    if (choice === "RANDOM") {
      onStart(freshSeed(), { kind: "RANDOM" }, runChoice);
      return;
    }
    if (choice === "DAILY") {
      if (today) {
        onStart(
          dailySeed(today),
          { kind: "DAILY", date: today },
          DEFAULT_RUN_CHOICE
        );
      }
      return;
    }
    // A typed seed must be a codec seed, so a typo is caught rather than
    // played as a named seed; a challenge link's own seed always starts.
    const seed =
      challenge && typed.trim() === challenge.seed
        ? challenge.seed
        : normalizeSeed(typed);
    if (!seed) {
      setError(
        "Enter 8 letters or digits, like 7K3M-Q9PX. Hyphens and case don't matter."
      );
      inputRef.current?.focus();
      return;
    }
    // A challenge link's Daily Protocol keeps its date as long as the seed
    // was not changed.
    const origin =
      challenge && challenge.seed === seed
        ? challengeOrigin(challenge)
        : ({ kind: "SEEDED" } as const);
    onStart(
      seed,
      origin,
      origin.kind === "DAILY" ? DEFAULT_RUN_CHOICE : runChoice,
      challenge?.customScenario
    );
  };

  const option = (value: Choice) => ({
    type: "radio" as const,
    name: `${id}-choice`,
    value,
    checked: choice === value,
    onChange: () => {
      setChoice(value);
      setError(null);
    },
    className: "mt-0.5 h-5 w-5 shrink-0 accent-amber-400",
  });

  return createPortal(
    <div
      data-te-cabinet=""
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-heading`}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto border border-zinc-700 bg-[color:var(--te-surface-0)] p-4 font-mono text-[color:var(--te-text)]"
        data-testid="new-run"
      >
        <h2
          id={`${id}-heading`}
          className="text-sm font-bold uppercase tracking-wider text-zinc-100"
        >
          New run
        </h2>
        {challenge && (
          <p className="mt-2 text-xs text-amber-300 break-words">
            {challenge.daily
              ? `Challenge link: the Daily Protocol for ${challenge.daily} (UTC).`
              : "Challenge link: the same seed and the same moves play the same run."}
          </p>
        )}
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <fieldset className="grid gap-2 text-xs">
            <legend className="sr-only">Seed</legend>
            <label className="flex min-h-[48px] cursor-pointer items-start gap-3 border border-zinc-800 p-3 hover:bg-zinc-900">
              <input ref={firstRef} {...option("RANDOM")} />
              <span className="min-w-0 break-words">
                <span className="font-bold uppercase tracking-wider">
                  Random seed
                </span>
                <span className="block text-zinc-400">A fresh study.</span>
              </span>
            </label>
            <div className="border border-zinc-800 p-3">
              <label className="flex min-h-[24px] cursor-pointer items-start gap-3">
                <input {...option("SEEDED")} />
                <span className="font-bold uppercase tracking-wider">
                  Enter a seed
                </span>
              </label>
              <label
                className="mt-2 block text-zinc-400"
                htmlFor={`${id}-seed`}
              >
                Seed, from a friend or a past run
              </label>
              <input
                ref={inputRef}
                id={`${id}-seed`}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                value={typed}
                placeholder="7K3M-Q9PX"
                onFocus={() => setChoice("SEEDED")}
                onChange={(event) => {
                  setTyped(event.target.value);
                  setChoice("SEEDED");
                  setError(null);
                }}
                aria-invalid={error !== null}
                aria-describedby={error ? errorId : undefined}
                className="mt-1 min-h-[44px] w-full min-w-0 border border-zinc-600 bg-[color:var(--te-surface-1)] px-3 font-mono text-sm uppercase tracking-widest text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                data-testid="new-run-seed"
              />
              {error && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-1 text-rose-300 break-words"
                >
                  {error}
                </p>
              )}
            </div>
            <label
              className={`flex min-h-[48px] items-start gap-3 border border-zinc-800 p-3 ${today ? "cursor-pointer hover:bg-zinc-900" : "opacity-60"}`}
            >
              <input {...option("DAILY")} disabled={!today} />
              <span className="min-w-0 break-words">
                <span className="font-bold uppercase tracking-wider">
                  Daily Protocol
                </span>
                <span className="block text-zinc-400" data-testid="daily-date">
                  {today
                    ? `${today} (UTC): everyone plays the same run today.`
                    : "Checking today's date…"}
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset
            className="mt-4 grid gap-2 text-xs"
            disabled={daily}
            aria-describedby={daily ? `${id}-daily-note` : undefined}
            data-testid="sponsor-picker"
          >
            <legend className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Sponsor
            </legend>
            {daily && (
              <p
                id={`${id}-daily-note`}
                className="text-zinc-400 break-words"
                data-testid="daily-choice-note"
              >
                The Daily Protocol is always Virtual Biotech at stake 1, so
                everyone plays the same run.
              </p>
            )}
            {sponsors.map(({ sponsor, lockedReason }) => {
              const fromLink = linked?.sponsorId === sponsor.id;
              const open = lockedReason === null || fromLink;
              const describedBy = `${id}-sponsor-${sponsor.id}`;
              const checked =
                (daily ? DEFAULT_RUN_CHOICE : runChoice).sponsorId ===
                sponsor.id;
              return (
                <label
                  key={sponsor.id}
                  className={`${OPTION} ${checked ? "border-amber-400/70" : "border-zinc-800"} ${open && !daily ? "cursor-pointer hover:bg-zinc-900" : "opacity-70"}`}
                  data-testid="sponsor-option"
                  data-locked={open ? undefined : ""}
                >
                  <input
                    type="radio"
                    name={`${id}-sponsor`}
                    value={sponsor.id}
                    checked={checked}
                    disabled={!open}
                    onChange={() => pickSponsor(sponsor.id)}
                    aria-labelledby={`${describedBy}-name`}
                    aria-describedby={describedBy}
                    className={RADIO}
                  />
                  <span className="min-w-0 break-words">
                    <span
                      id={`${describedBy}-name`}
                      className="font-bold uppercase tracking-wider"
                    >
                      {sponsor.name}
                    </span>
                    <span id={describedBy} className="block text-zinc-400">
                      {open ? (
                        <>
                          {sponsor.description}
                          {sponsor.twist && (
                            <span className="block text-zinc-300">
                              {sponsor.twist}
                            </span>
                          )}
                        </>
                      ) : (
                        <span data-testid="locked-reason">
                          Locked. {lockedReason}
                        </span>
                      )}
                      {fromLink && lockedReason !== null && <LinkNote />}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <fieldset
            className="mt-4 grid gap-2 text-xs"
            disabled={daily}
            data-testid="stake-picker"
          >
            <legend className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Stake: GCP audit level
            </legend>
            <p className="text-zinc-400 break-words">
              Each stake keeps every rule of the stakes below it.
            </p>
            {stakes.map(({ level, lockedReason }) => {
              const here = {
                sponsorId: runChoice.sponsorId,
                stake: level.stake,
              };
              const open = isAllowed(unlocks, linked, here);
              const fromLink = lockedReason !== null && isLinked(linked, here);
              const describedBy = `${id}-stake-${level.stake}`;
              const checked =
                (daily ? DEFAULT_RUN_CHOICE : runChoice).stake === level.stake;
              return (
                <label
                  key={level.stake}
                  className={`${OPTION} ${checked ? "border-amber-400/70" : "border-zinc-800"} ${open && !daily ? "cursor-pointer hover:bg-zinc-900" : "opacity-70"}`}
                  data-testid="stake-option"
                  data-locked={open ? undefined : ""}
                >
                  <input
                    type="radio"
                    name={`${id}-stake`}
                    value={level.stake}
                    checked={checked}
                    disabled={!open}
                    onChange={() => setRunChoice(here)}
                    aria-labelledby={`${describedBy}-name`}
                    aria-describedby={describedBy}
                    className={RADIO}
                  />
                  <span className="min-w-0 break-words">
                    <span
                      id={`${describedBy}-name`}
                      className="font-bold uppercase tracking-wider tabular-nums"
                    >
                      {level.stake}. {level.name}
                    </span>
                    <span id={describedBy} className="block text-zinc-400">
                      {open ? (
                        level.rule
                      ) : (
                        <span data-testid="locked-reason">
                          Locked. {lockedReason}
                        </span>
                      )}
                      {fromLink && <LinkNote />}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {discards && (
            <p className="mt-3 text-xs text-amber-300 break-words">
              Starting a new run ends the current one.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              className={`${BUTTON} border-amber-500 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
            >
              Start run
            </button>
            <button
              type="button"
              onClick={() => setDeckBuilderOpen(true)}
              className={`${BUTTON} border-amber-500/60 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30`}
              data-testid="open-deck-builder-btn"
            >
              Deck Builder
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${BUTTON} border-zinc-600 text-zinc-300 hover:bg-zinc-800`}
            >
              Cancel [Esc]
            </button>
          </div>
        </form>
        {deckBuilderOpen && (
          <DeckBuilder
            initialSpec={challenge?.customScenario}
            onStartCustomRun={(spec) => {
              onClose();
              onStart(freshSeed(), { kind: "SEEDED" }, runChoice, spec);
            }}
            onClose={() => setDeckBuilderOpen(false)}
          />
        )}
      </div>
    </div>,

    document.fullscreenElement ?? document.body
  );
}
