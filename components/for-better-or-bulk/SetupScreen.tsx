"use client";

/**
 * The plan before the clock starts: two website features built months ago,
 * one warehouse run inside the budget, and who is at the keyboard.
 */

import React, { useState } from "react";
import {
  BUDGET,
  CAPABILITIES,
  CAPABILITY_PICKS,
  FOOD_PRICES,
  LANTERN_PRICE,
  ROSE_PRICES,
  cartTotal,
  validateSetup,
  type CapabilityId,
  type FoodTier,
  type RoseTier,
  type Setup,
} from "@/lib/for-better-or-bulk";
import type { ControlMode } from "./input";

const ROSE_OPTIONS: readonly { id: RoseTier; label: string; note: string }[] = [
  {
    id: "modest",
    label: "Modest",
    note: "Bouquets only. The gardens do the rest.",
  },
  { id: "full", label: "Full", note: "Bouquets and four centerpieces." },
  { id: "yes", label: "Yes", note: "Everything, plus petals down the aisle." },
];

const FOOD_OPTIONS: readonly { id: FoodTier; label: string; note: string }[] = [
  {
    id: "enough",
    label: "Enough",
    note: "One batch of everything. Don't burn it.",
  },
  { id: "lots", label: "Lots", note: "A spare batch, in case of grill." },
  {
    id: "feed-rochester",
    label: "Feed Rochester",
    note: "Two spares. Pack more coolers.",
  },
];

interface SetupScreenProps {
  initial: Setup;
  initialMode: ControlMode;
  onStart: (setup: Setup, mode: ControlMode) => void;
}

function OptionButton({
  selected,
  onClick,
  children,
  role = "radio",
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role?: "radio" | "checkbox";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-11 min-w-0 flex-col items-start rounded border px-3 py-2 text-left font-mono text-xs active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)] disabled:opacity-40 ${
        selected
          ? "border-[var(--fbb-accent)] bg-[var(--fbb-selected)] text-[var(--fbb-text)]"
          : "border-[var(--fbb-rule)] bg-[var(--fbb-panel)] text-[var(--fbb-dim)]"
      }`}
    >
      {children}
    </button>
  );
}

export function SetupScreen({
  initial,
  initialMode,
  onStart,
}: SetupScreenProps) {
  const [capabilities, setCapabilities] = useState<readonly CapabilityId[]>(
    initial.capabilities
  );
  const [roses, setRoses] = useState<RoseTier>(initial.cart.roses);
  const [food, setFood] = useState<FoodTier>(initial.cart.food);
  const [lanterns, setLanterns] = useState(initial.cart.lanterns);
  const [relaxed, setRelaxed] = useState(initial.relaxed);
  const [mode, setMode] = useState<ControlMode>(initialMode);

  const setup: Setup = {
    capabilities,
    cart: { roses, food, lanterns },
    relaxed,
  };
  const total = cartTotal(setup.cart);
  const check = validateSetup(setup);

  const toggleCapability = (id: CapabilityId) => {
    if (capabilities.includes(id))
      setCapabilities(capabilities.filter((c) => c !== id));
    else if (capabilities.length < CAPABILITY_PICKS)
      setCapabilities([...capabilities, id]);
  };

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-5 p-3 font-mono text-[var(--fbb-text)] sm:p-6"
      data-testid="fbb-setup"
    >
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold tracking-[-0.035em]">
          Friday, 10/10/25. Setup starts at 9:00.
        </h2>
        <p className="mt-1 max-w-3xl text-xs text-[var(--fbb-dim)]">
          You bought everything at the warehouse. Someone still has to turn it
          into a wedding by 4:00.
        </p>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide">
          Months ago, Fred built the website. Pick {CAPABILITY_PICKS} features (
          {capabilities.length} of {CAPABILITY_PICKS})
        </legend>
        <div className="grid min-w-0 gap-2 @2xl:grid-cols-2">
          {(Object.keys(CAPABILITIES) as CapabilityId[]).map((id) => {
            const selected = capabilities.includes(id);
            return (
              <OptionButton
                key={id}
                role="checkbox"
                selected={selected}
                disabled={!selected && capabilities.length >= CAPABILITY_PICKS}
                onClick={() => toggleCapability(id)}
              >
                <span className="font-bold text-[var(--fbb-text)]">
                  {CAPABILITIES[id].label}
                </span>
                <span className="mt-0.5">{CAPABILITIES[id].summary}</span>
              </OptionButton>
            );
          })}
        </div>
      </fieldset>

      <div className="grid min-w-0 gap-4 @3xl:grid-cols-2">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide">
            Kirkland roses
          </legend>
          <div
            role="radiogroup"
            aria-label="Kirkland roses"
            className="flex min-w-0 flex-col gap-2"
          >
            {ROSE_OPTIONS.map((option) => (
              <OptionButton
                key={option.id}
                selected={roses === option.id}
                onClick={() => setRoses(option.id)}
              >
                <span className="font-bold text-[var(--fbb-text)]">
                  {option.label} · ${ROSE_PRICES[option.id]}
                </span>
                <span className="mt-0.5">{option.note}</span>
              </OptionButton>
            ))}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide">
            Food, drinks and sheet cake
          </legend>
          <div
            role="radiogroup"
            aria-label="Food, drinks and sheet cake"
            className="flex min-w-0 flex-col gap-2"
          >
            {FOOD_OPTIONS.map((option) => (
              <OptionButton
                key={option.id}
                selected={food === option.id}
                onClick={() => setFood(option.id)}
              >
                <span className="font-bold text-[var(--fbb-text)]">
                  {option.label} · ${FOOD_PRICES[option.id]}
                </span>
                <span className="mt-0.5">{option.note}</span>
              </OptionButton>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex min-w-0 flex-wrap gap-2">
        <OptionButton
          role="checkbox"
          selected={lanterns}
          onClick={() => setLanterns(!lanterns)}
        >
          <span className="font-bold text-[var(--fbb-text)]">
            Paper lanterns · ${LANTERN_PRICE}
          </span>
          <span className="mt-0.5">Four hooks to hang before dusk.</span>
        </OptionButton>
        <OptionButton
          role="checkbox"
          selected={relaxed}
          onClick={() => setRelaxed(!relaxed)}
        >
          <span className="font-bold text-[var(--fbb-text)]">
            Relaxed clock
          </span>
          <span className="mt-0.5">More time between 9:00 and 4:00.</span>
        </OptionButton>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-xs font-bold uppercase tracking-wide">
          Who is playing
        </legend>
        <div
          role="radiogroup"
          aria-label="Who is playing"
          className="grid min-w-0 gap-2 @2xl:grid-cols-2"
        >
          <OptionButton
            selected={mode === "solo"}
            onClick={() => setMode("solo")}
          >
            <span className="font-bold text-[var(--fbb-text)]">One player</span>
            <span className="mt-0.5">
              Play both. Tab swaps between Fred and Abbi.
            </span>
          </OptionButton>
          <OptionButton
            selected={mode === "coop"}
            onClick={() => setMode("coop")}
          >
            <span className="font-bold text-[var(--fbb-text)]">
              Two players, one keyboard
            </span>
            <span className="mt-0.5">
              Fred: WASD, E, F. Abbi: arrows, Enter, Shift.
            </span>
          </OptionButton>
        </div>
      </fieldset>

      <div className="flex min-w-0 flex-wrap items-center gap-3 border-t border-[var(--fbb-rule)] pt-4">
        <p className="text-sm tabular-nums" data-testid="fbb-total">
          Total ${total} of ${BUDGET}
          <span className="ml-2 text-xs text-[var(--fbb-dim)]">
            (venue, tux and dress included)
          </span>
        </p>
        <button
          type="button"
          disabled={!check.ok}
          onClick={() => onStart(setup, mode)}
          className="min-h-11 rounded border border-[var(--fbb-accent)] bg-[var(--fbb-accent)] px-4 text-xs font-bold uppercase tracking-wide text-[#0d0e11] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fbb-focus)] disabled:opacity-40"
        >
          Start setup
        </button>
        {!check.ok ? (
          <p role="alert" className="text-xs text-[var(--fbb-alert)]">
            {check.reason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
