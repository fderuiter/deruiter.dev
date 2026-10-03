"use client";

import { useCallback, useMemo, useRef, type RefObject } from "react";
import { useCabinetSetup } from "@/components/arcade/CabinetSetupContext";
import {
  crtCalibrationForFilter,
  type CabinetCrtFilter,
  type CRTCalibrationConfig,
} from "@/lib/arcade";

/** Largest shake offset, in CSS pixels, whatever a game asks for. */
export const ARCADE_FX_MAX_SHAKE_PX = 6;

/** Narrowest viewport, in CSS pixels, that gets shake and flash. */
export const ARCADE_FX_MIN_VIEWPORT_PX = 768;

const SHAKE_DURATION_MS = 220;
const FLASH_DURATION_MS = 160;

/** How much of a requested shake each Setup Wizard setting lets through. */
const SHAKE_SCALE = { none: 0, subtle: 0.5, high: 1 } as const;

/** Options for {@link useArcadeFx}. */
export interface ArcadeFxOptions {
  /**
   * The game's own effects toggle, if it has one. Defaults to true. Effects
   * run only when this and the cabinet's Setup Wizard setting both allow them.
   */
  enabled?: boolean;
}

/** Feedback effects returned by {@link useArcadeFx}. */
export interface ArcadeFx {
  /** Attach to the element that shakes, usually the canvas wrapper. */
  stageRef: RefObject<HTMLDivElement | null>;
  /**
   * Attach to an absolutely positioned overlay inside the stage with
   * `opacity: 0` and `pointer-events: none`. Flash fades it in and out.
   */
  flashRef: RefObject<HTMLDivElement | null>;
  /**
   * Shakes the stage by up to `px` CSS pixels, scaled by the Setup Wizard's
   * screen shake setting and capped at {@link ARCADE_FX_MAX_SHAKE_PX}.
   */
  shake: (px: number) => void;
  /** Briefly shows the flash overlay in `color`. */
  flash: (color?: string) => void;
  /** Freezes the game for `ms` milliseconds; read it with `isHitStopped`. */
  hitStop: (ms: number) => void;
  /** True while a hit stop is running. Call it from the game loop. */
  isHitStopped: () => boolean;
  /**
   * The Setup Wizard's CRT setting, or `off` outside a cabinet. The cabinet
   * draws the CRT layer itself; a game reads this only to match it, for
   * example to skip a CRT pass of its own.
   */
  crtFilter: CabinetCrtFilter;
  /**
   * The calibration for `crtFilter` from `lib/arcade/crt-pipeline.ts`, for a
   * game that draws its CRT inside its canvas with `renderCRTEffects`.
   * Null when the setting is `off`.
   */
  crtCalibration: CRTCalibrationConfig | null;
}

function prefersCalmEffects(): boolean {
  if (typeof window === "undefined") return true;
  if (window.innerWidth < ARCADE_FX_MIN_VIEWPORT_PX) return true;
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Shared arcade feedback: screen shake, a colour flash and hit stop, plus the
 * Setup Wizard's CRT setting.
 *
 * Shake and flash animate only `transform` and `opacity` through the Web
 * Animations API, so they cost no React renders and no game-loop work. Both
 * are skipped under `prefers-reduced-motion`, below a 768px viewport, and
 * when the cabinet's Setup Wizard sets screen shake to none. Hit stop is a
 * timestamp the game loop checks, so a game decides what freezing means.
 * Both wizard settings, `screenShake` and `crtFilter`, are read through
 * the cabinet's setup context.
 *
 * @param options - The game's own effects toggle.
 * @returns Refs to attach and the effect triggers.
 */
export function useArcadeFx(options: ArcadeFxOptions = {}): ArcadeFx {
  const { enabled = true } = options;
  const setup = useCabinetSetup();
  const shakeScale = SHAKE_SCALE[setup?.config.screenShake ?? "subtle"];
  const crtFilter: CabinetCrtFilter = setup?.config.crtFilter ?? "off";
  const crtCalibration = useMemo(
    () => crtCalibrationForFilter(crtFilter),
    [crtFilter]
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const hitStopUntilRef = useRef(0);

  const shake = useCallback(
    (px: number) => {
      const el = stageRef.current;
      const amount = Math.min(ARCADE_FX_MAX_SHAKE_PX, px * shakeScale);
      if (!enabled || amount < 0.5 || !el || prefersCalmEffects()) return;
      if (typeof el.animate !== "function") return;
      const offset = () => (Math.random() * 2 - 1) * amount;
      el.animate(
        [
          { transform: "translate(0, 0)" },
          { transform: `translate(${offset()}px, ${offset()}px)` },
          { transform: `translate(${offset() * 0.6}px, ${offset() * 0.6}px)` },
          { transform: `translate(${offset() * 0.3}px, ${offset() * 0.3}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: SHAKE_DURATION_MS, easing: "ease-out" }
      );
    },
    [enabled, shakeScale]
  );

  const flash = useCallback(
    (color = "#ffffff") => {
      const el = flashRef.current;
      if (!enabled || shakeScale === 0 || !el || prefersCalmEffects()) return;
      if (typeof el.animate !== "function") return;
      el.style.backgroundColor = color;
      el.animate([{ opacity: 0 }, { opacity: 0.35 }, { opacity: 0 }], {
        duration: FLASH_DURATION_MS,
        easing: "ease-out",
      });
    },
    [enabled, shakeScale]
  );

  const hitStop = useCallback((ms: number) => {
    hitStopUntilRef.current = Math.max(
      hitStopUntilRef.current,
      performance.now() + ms
    );
  }, []);

  const isHitStopped = useCallback(
    () => performance.now() < hitStopUntilRef.current,
    []
  );

  return useMemo(
    () => ({
      stageRef,
      flashRef,
      shake,
      flash,
      hitStop,
      isHitStopped,
      crtFilter,
      crtCalibration,
    }),
    [shake, flash, hitStop, isHitStopped, crtFilter, crtCalibration]
  );
}
