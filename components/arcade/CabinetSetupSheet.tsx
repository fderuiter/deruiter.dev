"use client";

import React, { useId, useRef, useSyncExternalStore } from "react";
import { IconAdjustments, IconX } from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { canVibrate } from "@/lib/haptics";
import { BottomSheet } from "@/components/arcade/mobile/ui";
import {
  layoutFits,
  setDeviceSettings,
  useDeviceSettings,
  DEVICE_LAYOUT_MIN_WIDTH,
  type ArcadeDeviceSettings,
  type DeviceDockSize,
  type DeviceHandedness,
  type DeviceLayout,
} from "@/lib/arcade";

/** Props for {@link CabinetSetupSheet}. */
interface CabinetSetupSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** A phone gets a bottom sheet; every other screen a dialog. */
  readonly asSheet: boolean;
  /** Opens the game's Pre-Game Setup Wizard in place of this sheet. */
  readonly onOpenWizard: () => void;
  /** The game's own options, shown under the device settings. */
  readonly setupItems?: React.ReactNode;
  /** The Setup key, which takes focus back when the dialog closes. */
  readonly returnFocusTo?: React.RefObject<HTMLElement | null>;
}

const HANDS: ReadonlyArray<{ id: DeviceHandedness; label: string }> = [
  { id: "right", label: "Right" },
  { id: "left", label: "Left" },
];
const DOCK_SIZES: ReadonlyArray<{ id: DeviceDockSize; label: string }> = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];
const LAYOUTS: ReadonlyArray<{ id: DeviceLayout; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "phone", label: "Phone" },
  { id: "tablet", label: "Tablet" },
  { id: "desktop", label: "Desktop" },
];

function subscribeWidth(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}
const windowWidth = () => window.innerWidth;
// The sheet renders only after a tap, so the server value is never shown.
const serverWidth = () => 1024;

const OPTION_CLASS =
  "min-h-11 min-w-11 rounded-lg border px-3 text-xs font-bold touch-manipulation active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40";

function optionClass(selected: boolean): string {
  return `${OPTION_CLASS} ${
    selected
      ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
      : "border-zinc-700 bg-zinc-900 text-zinc-300"
  }`;
}

/** One row of mutually exclusive choices. */
function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly options: ReadonlyArray<{ id: T; label: string }>;
  readonly value: T;
  readonly onChange: (id: T) => void;
  readonly disabled?: (id: T) => boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            disabled={disabled?.(option.id)}
            onClick={() => onChange(option.id)}
            className={optionClass(value === option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** An on/off setting, read out as a switch. */
function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}) {
  const hintId = useId();
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-zinc-200">{label}</span>
        {hint && (
          <span id={hintId} className="text-xs text-zinc-400">
            {hint}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`${optionClass(checked)} shrink-0`}
      >
        {checked ? "On" : "Off"}
      </button>
    </div>
  );
}

/** A 0 to 1 volume as a 0 to 100 slider. */
function VolumeRow({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  const id = useId();
  const percent = Math.round(value * 100);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm text-zinc-200">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-xs text-zinc-300">
          {percent}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={percent}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="h-11 w-full accent-amber-500"
      />
    </div>
  );
}

/** The device settings, written as each control changes. */
function DeviceSettingsForm({
  settings,
  width,
}: {
  readonly settings: ArcadeDeviceSettings;
  readonly width: number;
}) {
  const vibrate = canVibrate();
  const layoutKept = !layoutFits(settings.layout, width);
  return (
    <div className="flex flex-col gap-4">
      <ChoiceRow
        label="Dominant hand"
        options={HANDS}
        value={settings.handedness}
        onChange={(handedness) => setDeviceSettings({ handedness })}
      />
      <ChoiceRow
        label="Touch key size"
        options={DOCK_SIZES}
        value={settings.dockSize}
        onChange={(dockSize) => setDeviceSettings({ dockSize })}
      />
      <div className="flex flex-col gap-1">
        <ChoiceRow
          label="Layout"
          options={LAYOUTS}
          value={settings.layout}
          onChange={(layout) => setDeviceSettings({ layout })}
          disabled={(layout) => !layoutFits(layout, width)}
        />
        <p className="text-xs text-zinc-400" data-testid="setup-layout-note">
          {layoutKept
            ? `${LAYOUTS.find((l) => l.id === settings.layout)?.label} needs a window ${DEVICE_LAYOUT_MIN_WIDTH[settings.layout]}px wide, so Auto applies until it fits.`
            : "Only the layouts that fit this window are offered."}
        </p>
      </div>
      <SwitchRow
        label="Vibration"
        hint={vibrate ? undefined : "This device cannot vibrate."}
        checked={settings.haptics && vibrate}
        disabled={!vibrate}
        onChange={(haptics) => setDeviceSettings({ haptics })}
      />
      <SwitchRow
        label="Reduced effects"
        hint="Fewer flashes and shakes, on top of the system setting."
        checked={settings.reducedEffects}
        onChange={(reducedEffects) => setDeviceSettings({ reducedEffects })}
      />
      <VolumeRow
        label="Sound effects"
        value={settings.sound}
        onChange={(sound) => setDeviceSettings({ sound })}
      />
      <VolumeRow
        label="Music"
        value={settings.music}
        onChange={(music) => setDeviceSettings({ music })}
      />
    </div>
  );
}

/**
 * The cabinet's one Setup sheet (#2923, part of #2362): this device's
 * settings for every game, the game's own options through `setupItems`, and
 * a way into the game's Pre-Game Setup Wizard. A phone gets a bottom sheet;
 * every other screen a modal dialog. Both trap focus, close on Escape and
 * hand focus back to the Setup key. Layout offers only the views that fit
 * the window; a stored choice that no longer fits is kept, and Auto applies
 * until it fits again.
 */
export function CabinetSetupSheet({
  open,
  onClose,
  asSheet,
  onOpenWizard,
  setupItems,
  returnFocusTo,
}: CabinetSetupSheetProps) {
  const settings = useDeviceSettings();
  const width = useSyncExternalStore(subscribeWidth, windowWidth, serverWidth);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useFocusTrap<HTMLElement>(open && !asSheet, {
    initialFocusRef: closeRef,
    onEscape: onClose,
    returnFocusTo,
  });

  const body = (
    <div className="flex flex-col gap-5 font-mono">
      <DeviceSettingsForm settings={settings} width={width} />
      {setupItems && (
        <section aria-label="This game" className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            This game
          </h3>
          {setupItems}
        </section>
      )}
      <button
        type="button"
        onClick={onOpenWizard}
        title="Pre-Game Setup Wizard"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-neutral-900/90 px-3 text-xs font-bold text-amber-400 touch-manipulation hover:bg-neutral-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <IconAdjustments className="h-4 w-4" aria-hidden="true" />
        Game setup: difficulty, loadout and CRT
      </button>
    </div>
  );

  if (asSheet) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Setup"
        initialSnap="full"
        testId="cabinet-setup-sheet"
      >
        {body}
      </BottomSheet>
    );
  }

  if (!open) return null;
  return (
    <div
      data-testid="cabinet-setup-backdrop"
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="cabinet-setup-sheet"
        className="flex max-h-full w-full max-w-lg min-w-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-800 bg-[#13151a] p-4 text-zinc-200 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id={titleId}
            className="font-mono text-sm font-bold uppercase tracking-wider text-amber-400"
          >
            Setup
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close setup"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <IconX className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {body}
      </section>
    </div>
  );
}
