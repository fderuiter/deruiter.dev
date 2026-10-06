/**
 * The player's head in the booth (ADR 0059, decision 5). The player stands
 * still and pivots: turn keys and mouse drags move where the head is going,
 * and the head eases after it, which gives the camera a small, tired drag.
 * Pure functions, so the 3D scene and the tests share one definition.
 */

import { clamp } from "../../game-utils";
import {
  LOOK_EASE_PER_SEC,
  LOOK_PITCH_MAX,
  LOOK_PITCH_MIN,
  LOOK_PRESETS,
  LOOK_SIDE_THRESHOLD,
  LOOK_TURN_SPEED,
  LOOK_YAW_LIMIT,
} from "../presets";
import type { BoothFacing, LookInput, LookPreset, LookState } from "../types";

const SETTLED_RADIANS = 0.0005;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clampYaw(yaw: number): number {
  return clamp(yaw, -LOOK_YAW_LIMIT, LOOK_YAW_LIMIT);
}

function clampPitch(pitch: number): number {
  return clamp(pitch, LOOK_PITCH_MIN, LOOK_PITCH_MAX);
}

/** A head at rest, aimed at a preset (the counter by default). */
export function createLook(
  preset: LookPreset = LOOK_PRESETS.counter
): LookState {
  const yaw = clampYaw(finiteOr(preset.yaw, 0));
  const pitch = clampPitch(finiteOr(preset.pitch, 0));
  return { yaw, pitch, targetYaw: yaw, targetPitch: pitch };
}

/**
 * Advances the head by `dtSec`. Turn keys and drags move the target, which
 * is held inside the booth's half turn either way; the head then eases toward
 * it. Non-finite input is ignored, and a non-positive step only applies the
 * drag.
 */
export function stepLook(
  look: LookState,
  input: LookInput,
  dtSec: number
): LookState {
  const dt = Number.isFinite(dtSec) && dtSec > 0 ? Math.min(dtSec, 0.1) : 0;
  const turn = clamp(finiteOr(input.turn, 0), -1, 1);
  const targetYaw = clampYaw(
    look.targetYaw + turn * LOOK_TURN_SPEED * dt + finiteOr(input.dragYaw, 0)
  );
  const targetPitch = clampPitch(
    look.targetPitch + finiteOr(input.dragPitch, 0)
  );
  const ease = 1 - Math.exp(-LOOK_EASE_PER_SEC * dt);
  const yaw = look.yaw + (targetYaw - look.yaw) * ease;
  const pitch = look.pitch + (targetPitch - look.pitch) * ease;
  return {
    yaw: Math.abs(targetYaw - yaw) < SETTLED_RADIANS ? targetYaw : yaw,
    pitch:
      Math.abs(targetPitch - pitch) < SETTLED_RADIANS ? targetPitch : pitch,
    targetYaw,
    targetPitch,
  };
}

/** Points the head at a preset; it eases there over the next steps. */
export function aimLook(look: LookState, preset: LookPreset): LookState {
  return {
    ...look,
    targetYaw: clampYaw(finiteOr(preset.yaw, look.targetYaw)),
    targetPitch: clampPitch(finiteOr(preset.pitch, look.targetPitch)),
  };
}

/** True when the head has caught up with where it is going. */
export function isLookSettled(look: LookState): boolean {
  return look.yaw === look.targetYaw && look.pitch === look.targetPitch;
}

/** Which part of the booth the head is facing. */
export function getFacing(look: LookState): BoothFacing {
  if (look.yaw > LOOK_SIDE_THRESHOLD) return "window";
  if (look.yaw < -LOOK_SIDE_THRESHOLD) return "kitchen";
  return "counter";
}
