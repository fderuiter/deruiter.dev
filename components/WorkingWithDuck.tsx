"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import Link from "next/link";
import { clamp } from "@/lib/game-utils";
import Image from "next/image";
import { useAudio } from "@/components/providers/AudioProvider";
import { useTelemetry } from "@/hooks/useTelemetry";
import { FieldManualButton } from "@/components/FieldManualButton";
import { FullscreenButton } from "@/components/arcade/FullscreenButton";
import { DynamicTabletOrientationHint as TabletOrientationHint } from "@/components/arcade/DynamicTabletOrientationHint";
import { useGameFullscreen as useFullscreen } from "@/components/arcade/CabinetFullscreen";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import {
  safeGetItem,
  safeGetRawItem,
  safeSetRawItem,
} from "@/lib/safe-storage";
import { useDuckService } from "@/hooks/useDuckService";
import { useResponsiveCanvas } from "@/hooks/useResponsiveCanvas";
import { useCanvasResolution } from "@/hooks/useCanvasResolution";
import { applyCanvasScale } from "@/lib/arcade";
import { useAnimationFrame } from "@/hooks/useAnimationFrame";
import { useHotkeys } from "@/hooks/useHotkeys";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconRotate,
  IconBone,
  IconBallTennis,
  IconSparkles,
  IconTrees,
  IconHeart,
  IconBrandGithub,
  IconInfinity,
  IconBriefcase,
  IconVolume,
  IconVolumeOff,
  IconBook,
  IconX,
  IconAlertTriangle,
  IconPhoto,
  IconPalette,
  IconMusic,
  IconMusicOff,
  IconInfoCircle,
  IconShirt,
  IconDroplet,
  IconCheck,
  IconCode,
} from "@tabler/icons-react";
import {
  WorkingWithDuckState,
  DuckBehaviorState,
  DuckAccessory,
  createInitialDuckGameState,
  stepDuckGame,
  startDraggingDuck,
  dragDuckTo,
  releaseDuck,
  activeCodeBurst,
  applySqueakyToy,
  applyKongToy,
  scrubBelly,
  mopIndoorPuddle,
  enterBathtub,
  scrubBathtub,
  rinseBathtub,
  exitBathtub,
  enterDogPark,
  throwParkBall,
  jumpParkHurdle,
  steerParkDuck,
  tapParkWhistle,
  exitDogPark,
  shouldSyncDuckHudState,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DESK_BOUNDS,
  RUG_BOUNDS,
  DOG_BED_BOUNDS,
  BACK_DOOR_BOUNDS,
  WATER_BOWL_BOUNDS,
  FOOD_BOWL_BOUNDS,
  BATHTUB_BOUNDS,
  DUCK_FACTS,
  SPRINTS,
  SoundCue,
} from "@/lib/working-with-duck-engine";

/** Fixed simulation step for the Duck loop: the engine is tuned to 60 ticks/sec (#600). */
const DUCK_FIXED_STEP_MS = 1000 / 60;
/** Most fixed steps one rendered frame may replay after a long gap. */
const DUCK_MAX_CATCHUP_STEPS = 8;

/** Keys the Duck keyboard handler acts on, named for `useHotkeys`. */
const DUCK_HOTKEY_KEYS = [
  "p",
  "1",
  "2",
  "3",
  "4",
  "q",
  "w",
  "e",
  "r",
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
] as const;

/**
 * Every Ctrl/Alt/Meta combination the old window listener accepted. It never
 * checked modifiers, and useHotkeys matches Ctrl, Alt and Meta exactly, so
 * each one is listed. Shift needs no entry: useHotkeys ignores it unless a
 * hotkey names it.
 */
const DUCK_HOTKEY_MODIFIERS = [
  "",
  "Ctrl+",
  "Alt+",
  "Meta+",
  "Ctrl+Alt+",
  "Ctrl+Meta+",
  "Alt+Meta+",
  "Ctrl+Alt+Meta+",
] as const;

const DUCK_HOTKEYS: readonly string[] = DUCK_HOTKEY_KEYS.flatMap((key) =>
  DUCK_HOTKEY_MODIFIERS.map((modifiers) => `${modifiers}${key}`)
);

const subscribeStorage = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};

const getHighScoreSnapshot = () => {
  if (typeof window === "undefined") return "0";
  try {
    return safeGetRawItem("working_with_duck_high_score") || "0";
  } catch {
    return "0";
  }
};

const getServerSnapshot = () => "0";

// Validates and loads previously earned scrapbook unlocks before any
// initial persistence write, so a corrupted/missing/inaccessible entry
// can never silently replace valid saved progress with the [1] default
// (#599). Unknown or malformed ids are dropped rather than crashing play;
// createInitialDuckGameState re-validates against DUCK_FACTS and always
// includes the baseline id 1.
const getStoredUnlockedFacts = (): number[] => {
  if (typeof window === "undefined") return [1];
  try {
    // Stored as a plain JSON array. safeGetItem returns null when the key is
    // missing or storage is unavailable, and the raw string for malformed JSON.
    const parsed = safeGetItem<unknown>("working_with_duck_unlocked_facts");
    if (!Array.isArray(parsed)) return [1];
    return parsed.filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id)
    );
  } catch {
    return [1];
  }
};

// --- Pure Drawing Helpers Outside Component ---

function drawAccessories(
  ctx: CanvasRenderingContext2D,
  accessory: DuckAccessory,
  _duckState?: DuckBehaviorState
) {
  if (accessory === "none") return;

  if (accessory === "bucket-hat") {
    // Adidas Black Bucket Hat perched stylishly on head
    ctx.save();
    ctx.translate(22, -10);
    ctx.fillStyle = "#18181b";
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 1;

    // Hat Crown
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hat Brim
    ctx.beginPath();
    ctx.ellipse(0, 4, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // White Trefoil Stripes
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-4, -2, 8, 1.5);
    ctx.fillRect(-3, 1, 6, 1.2);
    ctx.restore();
  } else if (accessory === "bowtie") {
    // Executive Tech CEO Bowtie at neck
    ctx.save();
    ctx.translate(14, 0);
    ctx.fillStyle = "#0284c7";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;

    // Left wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(6, -5);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center knot
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (accessory === "bandana") {
    // Red Adventure Bandana
    ctx.save();
    ctx.translate(12, 0);
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#b91c1c";
    ctx.lineWidth = 1;

    // Triangle Fold
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(8, 0);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Polka dots
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-2, -3, 1, 0, Math.PI * 2);
    ctx.arc(-2, 3, 1, 0, Math.PI * 2);
    ctx.arc(2, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (accessory === "rain-boots") {
    // Yellow Rubber Rain Boots on all 4 paws
    const drawBoot = (bx: number, by: number) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#ca8a04";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-4, -4, 8, 8, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawBoot(-14, -14);
    drawBoot(-14, 14);
    drawBoot(12, -14);
    drawBoot(12, 14);
  }
}

/**
 * Draws centred text, nudged horizontally so the whole string stays on the
 * canvas. Duck's status labels and floating alerts follow him to the walls,
 * where centring on his position clipped them at the edge (#1550).
 */
function fillCenteredTextInCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number
) {
  const halfWidth = ctx.measureText(text).width / 2;
  const margin = 6;
  const minX = margin + halfWidth;
  const maxX = CANVAS_WIDTH - margin - halfWidth;
  ctx.fillText(text, minX > maxX ? CANVAS_WIDTH / 2 : clamp(x, minX, maxX), y);
}

function drawDuckPuppy(
  ctx: CanvasRenderingContext2D,
  duck: {
    x: number;
    y: number;
    angle: number;
    state: DuckBehaviorState;
    isCarryingBall: boolean;
    tailWagAngle?: number;
  },
  ticks: number,
  bellyRubProgress: number = 0,
  accessory: DuckAccessory = "none",
  isMuddy: boolean = false
) {
  ctx.save();
  ctx.translate(duck.x, duck.y);

  if (duck.state === "THE_FLOP") {
    // Outer Fluffy Fur Aura
    ctx.fillStyle = isMuddy ? "#a16207" : "#faf5ee";
    ctx.strokeStyle = isMuddy ? "#78350f" : "#fde68a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Soft Pink Belly Patch with Pulsing Glow on touch
    const tummyPulse = Math.sin(ticks * 0.15) * 3;
    ctx.fillStyle = "rgba(236, 72, 153, 0.2)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 22 + tummyPulse, 16 + tummyPulse, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fdf2f8";
    ctx.beginPath();
    ctx.ellipse(0, 2, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly fluff texture
    ctx.strokeStyle = "#fbcfe8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-6, 2, 5, 0, Math.PI);
    ctx.arc(6, 2, 5, 0, Math.PI);
    ctx.stroke();

    // Paws up in the air with brown pads
    const drawPawUp = (px: number, py: number, rot: number) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(rot);
      ctx.fillStyle = isMuddy ? "#78350f" : "#ffffff";
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#78350f";
      ctx.beginPath();
      ctx.ellipse(0, 2, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-4, -5, 1.8, 0, Math.PI * 2);
      ctx.arc(0, -7, 1.8, 0, Math.PI * 2);
      ctx.arc(4, -5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    drawPawUp(-18, -16, -0.4);
    drawPawUp(18, -16, 0.4);
    drawPawUp(-20, 16, -0.2);
    drawPawUp(20, 16, 0.2);

    // Floppy ears spread wide on floor
    ctx.fillStyle = isMuddy ? "#854d0e" : "#fef08a";
    ctx.strokeStyle = "#fcd34d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-24, -22, 8, 16, -0.6, 0, Math.PI * 2);
    ctx.ellipse(24, -22, 8, 16, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cute rounded marshmallow head
    ctx.fillStyle = isMuddy ? "#a16207" : "#ffffff";
    ctx.strokeStyle = "#fde68a";
    ctx.beginPath();
    ctx.ellipse(0, -22, 20, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Happy curved sleeping puppy eyes
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-7, -24, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, -24, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Big button nose
    ctx.fillStyle = "#18181b";
    ctx.beginPath();
    ctx.arc(0, -18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-1, -19, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Blushing puppy cheeks
    ctx.fillStyle = "#f472b6";
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(-13, -19, 4.5, 0, Math.PI * 2);
    ctx.arc(13, -19, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Belly Rub Progress Ring Overlay above Duck
    ctx.fillStyle = "#ec4899";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`❤️ SCRUB TUMMY (${Math.round(bellyRubProgress)}%)`, 0, -46);

    // Progress Bar Track
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(-35, -40, 70, 6);
    ctx.fillStyle = "#ec4899";
    ctx.fillRect(-35, -40, (70 * Math.min(100, bellyRubProgress)) / 100, 6);
    ctx.strokeStyle = "#fbcfe8";
    ctx.lineWidth = 1;
    ctx.strokeRect(-35, -40, 70, 6);

    ctx.restore();
    return;
  }

  if (duck.state === "NAP_TIME") {
    const breath = Math.sin(ticks * 0.05) * 1.5;
    ctx.fillStyle = isMuddy ? "#854d0e" : "#faf5ee";
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 2;

    // Body ball
    ctx.beginPath();
    ctx.arc(0, 0, 24 + breath, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Fur texture
    ctx.fillStyle = isMuddy ? "#713f12" : "#ffffff";
    ctx.beginPath();
    ctx.arc(-4, -4, 18, 0, Math.PI * 2);
    ctx.fill();

    // Golden Floppy ear draped over face
    ctx.fillStyle = "#fef08a";
    ctx.strokeStyle = "#fcd34d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-10, -6, 7, 13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sleeping eye & nose
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-14, 4, 3.5, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = "#18181b";
    ctx.beginPath();
    ctx.arc(-18, 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Snooze Zzz
    ctx.fillStyle = "#c084fc";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Zzz...", -18, -26 - Math.sin(ticks * 0.08) * 4);
    ctx.restore();
    return;
  }

  // Walking / Roaming / Zooming Rotation
  ctx.rotate(duck.angle);

  // 1. Feathery Plume Tail with dynamic wagging wave
  const tailWag = duck.tailWagAngle ?? Math.sin(ticks * 0.3) * 0.4;
  ctx.save();
  ctx.translate(-22, 0);
  ctx.rotate(tailWag);
  ctx.fillStyle = isMuddy ? "#78350f" : "#faf5ee";
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.bezierCurveTo(-15, -8, -25, -2, -32, 4);
  ctx.bezierCurveTo(-24, 10, -10, 8, 0, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 2. Hind Paws & Haunches
  ctx.fillStyle = isMuddy ? "#78350f" : "#faf5ee";
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-14, -14, 10, 7, -0.2, 0, Math.PI * 2);
  ctx.ellipse(-14, 14, 10, 7, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 3. Plush Cream Body
  ctx.fillStyle = isMuddy ? "#a16207" : "#ffffff";
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 4. Front Paws
  ctx.fillStyle = isMuddy ? "#78350f" : "#faf5ee";
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(12, -14, 7, 5, 0.3, 0, Math.PI * 2);
  ctx.ellipse(12, 14, 7, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 5. Floppy Ears
  const earFlap = duck.state === "ZOOMIES" ? Math.sin(ticks * 0.4) * 0.15 : 0;
  ctx.fillStyle = isMuddy ? "#854d0e" : "#fef08a";
  ctx.strokeStyle = "#fcd34d";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(16, -12, 7, 10, -0.35 + earFlap, 0, Math.PI * 2);
  ctx.ellipse(16, 12, 7, 10, 0.35 - earFlap, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 6. Cute Marshmallow Head & Fluffy Cheeks
  ctx.fillStyle = isMuddy ? "#a16207" : "#ffffff";
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(20, 0, 15, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 7. Soulful Puppy Eyes
  ctx.fillStyle = "#18181b";
  ctx.beginPath();
  ctx.arc(24, -5, 3.2, 0, Math.PI * 2);
  ctx.arc(24, 5, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(23, -6, 1.2, 0, Math.PI * 2);
  ctx.arc(23, 4, 1.2, 0, Math.PI * 2);
  ctx.arc(25, -4, 0.6, 0, Math.PI * 2);
  ctx.arc(25, 6, 0.6, 0, Math.PI * 2);
  ctx.fill();

  // 8. Soft Muzzle & Charcoal Button Nose
  ctx.fillStyle = isMuddy ? "#854d0e" : "#ffffff";
  ctx.beginPath();
  ctx.ellipse(29, 0, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#18181b";
  ctx.beginPath();
  ctx.ellipse(32, 0, 3.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Happy Pink Tongue
  if (
    duck.state === "ZOOMIES" ||
    duck.state === "FETCHING_BALL" ||
    duck.state === "NO_TAKE_THROW" ||
    duck.state === "PERFORMING_TRICK"
  ) {
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.ellipse(33, 2, 4, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Equipped Accessories
  drawAccessories(ctx, accessory, duck.state);

  // Tennis ball in mouth
  if (duck.isCarryingBall) {
    ctx.fillStyle = "#84cc16";
    ctx.beginPath();
    ctx.arc(36, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();

  // Thought Bubble above Duck
  if (duck.state === "NO_TAKE_THROW") {
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    fillCenteredTextInCanvas(
      ctx,
      "🎾 NO TAKE! (Press 4 or Call Drop It)",
      duck.x,
      duck.y - 34
    );
  } else if (duck.state === "SNIFFING_POTTY") {
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    fillCenteredTextInCanvas(ctx, "🚽 DRAG TO DOOR!", duck.x, duck.y - 34);
  } else if (duck.state === "ZOOMIES") {
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    fillCenteredTextInCanvas(ctx, "⚡ ZOOMIES!", duck.x, duck.y - 34);
  } else if (duck.state === "SNEAKY_CHEW") {
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    fillCenteredTextInCanvas(ctx, "😈 SNEAKY CHEW!", duck.x, duck.y - 34);
  } else if (duck.state === "PERFORMING_TRICK") {
    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    fillCenteredTextInCanvas(ctx, "✨ GOOD BOY TRICK!", duck.x, duck.y - 34);
  } else if (duck.state === "DRINKING_WATER") {
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    fillCenteredTextInCanvas(ctx, "💧 Lap Lap Lap...", duck.x, duck.y - 34);
  } else if (duck.state === "EATING_KIBBLE") {
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    fillCenteredTextInCanvas(ctx, "🍖 Munch Crunch...", duck.x, duck.y - 34);
  }
}

function drawOfficeScene(
  ctx: CanvasRenderingContext2D,
  state: WorkingWithDuckState
) {
  // 1. Hardwood Floor
  ctx.fillStyle = "#1e1b18";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Floor Planks
  ctx.strokeStyle = "#292524";
  ctx.lineWidth = 1;
  for (let y = 0; y < CANVAS_HEIGHT; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  // Office Window on Top Wall
  ctx.fillStyle = "#0c4a6e";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.fillRect(360, 10, 85, 48);
  ctx.strokeRect(360, 10, 85, 48);

  // Sky & Clouds in Window
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(362, 12, 81, 44);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(380, 25, 8, 0, Math.PI * 2);
  ctx.arc(392, 22, 10, 0, Math.PI * 2);
  ctx.arc(405, 25, 8, 0, Math.PI * 2);
  ctx.fill();

  // Window Frame Crossbars
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(402, 10);
  ctx.lineTo(402, 58);
  ctx.moveTo(360, 34);
  ctx.lineTo(445, 34);
  ctx.stroke();

  // Squirrel at the Window
  if (state.activeSurpriseEvent?.type === "squirrel-window") {
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.arc(425, 42, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(433, 36, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(340, 62, 125, 20);
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(340, 62, 125, 20);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("🐿️ CLICK WINDOW (+200)", 402, 75);
  }

  // 2. Cozy Plush Rug
  ctx.fillStyle = "#3f3f46";
  ctx.strokeStyle = "#71717a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(
    RUG_BOUNDS.x,
    RUG_BOUNDS.y,
    RUG_BOUNDS.width,
    RUG_BOUNDS.height,
    24
  );
  ctx.fill();
  ctx.stroke();

  // Rug Pattern
  ctx.strokeStyle = "#52525b";
  ctx.lineWidth = 1.5;
  for (
    let rx = RUG_BOUNDS.x + 20;
    rx < RUG_BOUNDS.x + RUG_BOUNDS.width - 10;
    rx += 30
  ) {
    ctx.beginPath();
    ctx.moveTo(rx, RUG_BOUNDS.y + 10);
    ctx.lineTo(rx, RUG_BOUNDS.y + RUG_BOUNDS.height - 10);
    ctx.stroke();
  }

  // 3. Desk & Developer Workspace
  ctx.fillStyle = "#18181b";
  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(
    DESK_BOUNDS.x,
    DESK_BOUNDS.y,
    DESK_BOUNDS.width,
    DESK_BOUNDS.height,
    16
  );
  ctx.fill();
  ctx.stroke();

  // Monitors
  ctx.fillStyle = "#09090b";
  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 1.5;
  ctx.fillRect(DESK_BOUNDS.x + 15, DESK_BOUNDS.y + 15, 65, 45);
  ctx.strokeRect(DESK_BOUNDS.x + 15, DESK_BOUNDS.y + 15, 65, 45);

  ctx.fillRect(DESK_BOUNDS.x + 90, DESK_BOUNDS.y + 15, 65, 45);
  ctx.strokeRect(DESK_BOUNDS.x + 90, DESK_BOUNDS.y + 15, 65, 45);

  // Code lines simulation
  ctx.fillStyle = "#22d3ee";
  ctx.fillRect(DESK_BOUNDS.x + 20, DESK_BOUNDS.y + 22, 35, 3);
  ctx.fillStyle = "#a855f7";
  ctx.fillRect(DESK_BOUNDS.x + 20, DESK_BOUNDS.y + 28, 48, 3);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(DESK_BOUNDS.x + 20, DESK_BOUNDS.y + 34, 40, 3);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(DESK_BOUNDS.x + 20, DESK_BOUNDS.y + 40, 25, 3);

  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(DESK_BOUNDS.x + 95, DESK_BOUNDS.y + 22, 40, 3);
  ctx.fillStyle = "#34d399";
  ctx.fillRect(DESK_BOUNDS.x + 95, DESK_BOUNDS.y + 28, 50, 3);
  ctx.fillStyle = "#f43f5e";
  ctx.fillRect(DESK_BOUNDS.x + 95, DESK_BOUNDS.y + 34, 30, 3);

  // Developer Avatar Head & Chair
  ctx.fillStyle = "#27272a";
  ctx.beginPath();
  ctx.arc(DESK_BOUNDS.x + 85, DESK_BOUNDS.y + 100, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#52525b";
  ctx.stroke();

  ctx.fillStyle = "#e4e4e7";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.fillText("YOU", DESK_BOUNDS.x + 85, DESK_BOUNDS.y + 104);

  // Interactive Code Prompt overlay on Desk
  ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
  ctx.fillRect(DESK_BOUNDS.x + 20, DESK_BOUNDS.y + 125, 130, 22);
  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 1;
  ctx.strokeRect(DESK_BOUNDS.x + 20, DESK_BOUNDS.y + 125, 130, 22);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 9px monospace";
  ctx.fillText(
    "💻 FOCUS SPRINT (SPACE)",
    DESK_BOUNDS.x + 85,
    DESK_BOUNDS.y + 140
  );

  // 4. Dog Bed
  ctx.fillStyle = "#581c87";
  ctx.strokeStyle = "#a855f7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(
    DOG_BED_BOUNDS.x + DOG_BED_BOUNDS.width / 2,
    DOG_BED_BOUNDS.y + DOG_BED_BOUNDS.height / 2,
    DOG_BED_BOUNDS.width / 2,
    DOG_BED_BOUNDS.height / 2,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#7e22ce";
  ctx.beginPath();
  ctx.ellipse(
    DOG_BED_BOUNDS.x + DOG_BED_BOUNDS.width / 2,
    DOG_BED_BOUNDS.y + DOG_BED_BOUNDS.height / 2,
    DOG_BED_BOUNDS.width / 2 - 12,
    DOG_BED_BOUNDS.height / 2 - 10,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#e9d5ff";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    "DUCK'S BED",
    DOG_BED_BOUNDS.x + DOG_BED_BOUNDS.width / 2,
    DOG_BED_BOUNDS.y + DOG_BED_BOUNDS.height / 2 + 3
  );

  // 5. Office Stations (Water & Food Bowls)
  // Water Bowl
  ctx.fillStyle = "#0284c7";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(
    WATER_BOWL_BOUNDS.x + 25,
    WATER_BOWL_BOUNDS.y + 20,
    22,
    16,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.ellipse(
    WATER_BOWL_BOUNDS.x + 25,
    WATER_BOWL_BOUNDS.y + 20,
    18 * (state.officeStations.waterLevel / 100),
    12 * (state.officeStations.waterLevel / 100),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 8px monospace";
  ctx.fillText(
    `💧 ${Math.round(state.officeStations.waterLevel)}%`,
    WATER_BOWL_BOUNDS.x + 25,
    WATER_BOWL_BOUNDS.y + 42
  );

  // Food Bowl
  ctx.fillStyle = "#d97706";
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(
    FOOD_BOWL_BOUNDS.x + 25,
    FOOD_BOWL_BOUNDS.y + 20,
    22,
    16,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.ellipse(
    FOOD_BOWL_BOUNDS.x + 25,
    FOOD_BOWL_BOUNDS.y + 20,
    18 * (state.officeStations.foodLevel / 100),
    12 * (state.officeStations.foodLevel / 100),
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 8px monospace";
  ctx.fillText(
    `🍖 ${Math.round(state.officeStations.foodLevel)}%`,
    FOOD_BOWL_BOUNDS.x + 25,
    FOOD_BOWL_BOUNDS.y + 42
  );

  // 6. Bathtub Washroom Door / Station
  const isMuddy = state.isMuddy;
  ctx.fillStyle = isMuddy ? "#0369a1" : "#0f172a";
  ctx.strokeStyle = isMuddy ? "#38bdf8" : "#334155";
  ctx.lineWidth = isMuddy ? 3 : 1.5;
  ctx.beginPath();
  ctx.roundRect(
    BATHTUB_BOUNDS.x,
    BATHTUB_BOUNDS.y,
    BATHTUB_BOUNDS.width,
    BATHTUB_BOUNDS.height,
    12
  );
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isMuddy ? "#38bdf8" : "#94a3b8";
  ctx.font = "bold 9px monospace";
  ctx.fillText(
    "🛁 BATHTUB",
    BATHTUB_BOUNDS.x + BATHTUB_BOUNDS.width / 2,
    BATHTUB_BOUNDS.y + 35
  );
  ctx.fillText(
    isMuddy ? "🧼 NEEDS WASH!" : "(CLEAN)",
    BATHTUB_BOUNDS.x + BATHTUB_BOUNDS.width / 2,
    BATHTUB_BOUNDS.y + 50
  );

  // 7. Back Door to Yard
  const isPottyUrgent =
    state.bladder > 75 ||
    state.duck.state === "SNIFFING_POTTY" ||
    state.duck.state === "DRAGGED";

  ctx.fillStyle = isPottyUrgent ? "#065f46" : "#064e3b";
  ctx.strokeStyle = isPottyUrgent ? "#34d399" : "#10b981";
  ctx.lineWidth = isPottyUrgent ? 3 : 2;
  ctx.beginPath();
  ctx.roundRect(
    BACK_DOOR_BOUNDS.x,
    BACK_DOOR_BOUNDS.y,
    BACK_DOOR_BOUNDS.width,
    BACK_DOOR_BOUNDS.height,
    12
  );
  ctx.fill();
  ctx.stroke();

  if (isPottyUrgent) {
    const pulse = Math.sin(state.ticks * 0.15) * 3;
    ctx.save();
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(
      BACK_DOOR_BOUNDS.x - 4 - pulse,
      BACK_DOOR_BOUNDS.y - 4 - pulse,
      BACK_DOOR_BOUNDS.width + 8 + pulse * 2,
      BACK_DOOR_BOUNDS.height + 8 + pulse * 2
    );
    ctx.setLineDash([]);

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(state.duck.x, state.duck.y);
    ctx.lineTo(
      BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width / 2,
      BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height / 2
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.fillStyle = "#047857";
  ctx.fillRect(
    BACK_DOOR_BOUNDS.x + 10,
    BACK_DOOR_BOUNDS.y + 10,
    BACK_DOOR_BOUNDS.width - 20,
    BACK_DOOR_BOUNDS.height - 20
  );

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    "BACK DOOR",
    BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width / 2,
    BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height / 2 - 4
  );
  ctx.fillText(
    isPottyUrgent ? "👉 DROP HERE" : "(POTTY YARD)",
    BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width / 2,
    BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height / 2 + 8
  );

  // Amazon Delivery Parcel Knock
  if (state.activeSurpriseEvent?.type === "amazon-delivery") {
    ctx.fillStyle = "#78350f";
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.fillRect(BACK_DOOR_BOUNDS.x - 30, BACK_DOOR_BOUNDS.y + 40, 24, 24);
    ctx.strokeRect(BACK_DOOR_BOUNDS.x - 30, BACK_DOOR_BOUNDS.y + 40, 24, 24);
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("📦", BACK_DOOR_BOUNDS.x - 18, BACK_DOOR_BOUNDS.y + 57);

    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(BACK_DOOR_BOUNDS.x - 70, BACK_DOOR_BOUNDS.y + 10, 80, 20);
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 1;
    ctx.strokeRect(BACK_DOOR_BOUNDS.x - 70, BACK_DOOR_BOUNDS.y + 10, 80, 20);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 8px monospace";
    ctx.fillText(
      "📦 SIGN PACKAGE",
      BACK_DOOR_BOUNDS.x - 30,
      BACK_DOOR_BOUNDS.y + 23
    );
  }

  // 8. Portfolio Hazards
  state.hazards.forEach((hazard) => {
    const isTargeted = state.activeHazardTarget === hazard.id;
    ctx.save();

    if (isTargeted) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        hazard.x,
        hazard.y,
        hazard.radius + 8 + Math.sin(state.ticks * 0.2) * 4,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      const maxTimer = state.duck.maxStateTimer || 240;
      const progress = Math.max(0, state.duck.stateTimer / maxTimer);
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        hazard.x,
        hazard.y,
        hazard.radius + 14,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress
      );
      ctx.stroke();

      ctx.fillStyle = "#f97316";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        "🦴 DROP KONG / CALL DROP IT!",
        hazard.x,
        hazard.y - hazard.radius - 10
      );
    }

    ctx.fillStyle = hazard.isChewed ? "#7f1d1d" : "#27272a";
    ctx.strokeStyle = isTargeted ? "#f87171" : "#52525b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isTargeted ? "#fca5a5" : "#e4e4e7";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    let icon = "📊";
    if (hazard.id === "power-cable" || hazard.id === "server-cable")
      icon = "⚡";
    if (hazard.id === "audit-file" || hazard.id === "clinical-db") icon = "📑";
    if (hazard.id === "laptop" || hazard.id === "garmin-watch") icon = "💻";
    if (hazard.id === "pitch-deck" || hazard.id === "resume") icon = "📊";
    ctx.fillText(icon, hazard.x, hazard.y + 5);

    ctx.fillStyle = isTargeted ? "#f87171" : "#a1a1aa";
    ctx.font = "9px monospace";
    ctx.fillText(
      hazard.name.split(" ")[0],
      hazard.x,
      hazard.y + hazard.radius + 12
    );

    ctx.restore();
  });

  // 9. Indoor Bladder Puddles
  if (state.indoorPuddles && state.indoorPuddles.length > 0) {
    state.indoorPuddles.forEach((puddle) => {
      ctx.save();
      // Outer puddle spill
      ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        puddle.x,
        puddle.y,
        puddle.radius * 1.25,
        puddle.radius * 0.85,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.stroke();

      // Inner puddle ripple
      ctx.fillStyle = "rgba(14, 165, 233, 0.55)";
      ctx.beginPath();
      ctx.ellipse(
        puddle.x,
        puddle.y,
        puddle.radius * 0.7,
        puddle.radius * 0.45,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Mop Progress Bar if scrubbing
      if (puddle.mopProgress > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(puddle.x - 25, puddle.y - 28, 50, 6);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(
          puddle.x - 25,
          puddle.y - 28,
          (50 * Math.min(100, puddle.mopProgress)) / 100,
          6
        );
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(puddle.x - 25, puddle.y - 28, 50, 6);
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#000000";
      ctx.shadowBlur = 4;
      ctx.fillText("🧹 CLICK / SCRUB TO MOP", puddle.x, puddle.y + 4);
      ctx.restore();
    });
  }

  // 10. Thrown Ball in room
  if (state.ball && state.ball.active) {
    ctx.fillStyle = "#84cc16";
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 10. Procedural Duck Puppy Rendering
  drawDuckPuppy(
    ctx,
    state.duck,
    state.ticks,
    state.bellyRubProgress,
    state.activeAccessory,
    state.isMuddy
  );

  // 11. Floating Particles
  state.particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;

    if (p.shape === "heart") {
      ctx.font = `${p.size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("❤️", p.x, p.y);
    } else if (p.shape === "star") {
      ctx.font = `${p.size}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("Z", p.x, p.y);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 12. Floating Text Alerts
  state.floatingAlerts.forEach((a) => {
    ctx.save();
    ctx.globalAlpha = a.alpha;
    ctx.fillStyle = a.color;
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 6;
    fillCenteredTextInCanvas(ctx, a.text, a.x, a.y);
    ctx.restore();
  });
}

function drawDogParkScene(
  ctx: CanvasRenderingContext2D,
  state: WorkingWithDuckState,
  aimParkStart: { x: number; y: number } | null = null
) {
  const park = state.parkState;

  // 1. Lush Green Grass
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Grass texture accents
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 2;
  for (let gx = 30; gx < CANVAS_WIDTH; gx += 50) {
    for (let gy = 40; gy < CANVAS_HEIGHT; gy += 60) {
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 4, gy - 8);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 4, gy - 10);
      ctx.stroke();
    }
  }

  // 2. Mud Puddles
  park.puddles.forEach((puddle) => {
    ctx.fillStyle = "#78350f";
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(
      puddle.x,
      puddle.y,
      puddle.radius * 1.3,
      puddle.radius,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.ellipse(
      puddle.x - 5,
      puddle.y - 4,
      puddle.radius * 0.7,
      puddle.radius * 0.5,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = "#fde68a";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MUD PUDDLE!", puddle.x, puddle.y + 4);
  });

  // 3. Agility Hurdles
  park.hurdles.forEach((hurdle) => {
    ctx.fillStyle = hurdle.cleared ? "#15803d" : "#ea580c";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.fillRect(
      hurdle.x - hurdle.width / 2,
      hurdle.y - hurdle.height / 2,
      hurdle.width,
      hurdle.height
    );
    ctx.strokeRect(
      hurdle.x - hurdle.width / 2,
      hurdle.y - hurdle.height / 2,
      hurdle.width,
      hurdle.height
    );

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      hurdle.cleared ? "CLEARED" : "JUMP (SPACE)",
      hurdle.x,
      hurdle.y - hurdle.height / 2 - 6
    );
  });

  // 4. Friendly Dog NPCs
  park.friends.forEach((friend) => {
    ctx.save();
    ctx.translate(friend.x, friend.y);
    ctx.fillStyle = friend.breed === "corgi" ? "#d97706" : "#facc15";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#18181b";
    ctx.font = "12px sans-serif";
    ctx.fillText(friend.breed === "corgi" ? "🦊" : "🐕", 0, 4);

    ctx.fillStyle = friend.greeted ? "#4ade80" : "#ffffff";
    ctx.font = "bold 9px monospace";
    ctx.fillText(friend.greeted ? `❤️ ${friend.name}` : friend.name, 0, 22);
    ctx.restore();
  });

  // 5. Golden Bonus Bones
  park.bones.forEach((bone) => {
    if (!bone.collected) {
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.strokeStyle = "#ca8a04";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(
        bone.x,
        bone.y,
        14 + Math.sin(state.ticks * 0.1) * 2,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🦴", bone.x, bone.y + 6);
      ctx.restore();
    }
  });

  // 6. Player at left side
  ctx.fillStyle = "#27272a";
  ctx.beginPath();
  ctx.arc(80, 250, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.fillText("YOU", 80, 254);

  // 7. Thrown Ball / Frisbee Trajectory
  if (park.status === "thrown" || park.status === "retrieving") {
    if (park.mode === "frisbee") {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.ellipse(park.ballX, park.ballY, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#84cc16";
      ctx.beginPath();
      ctx.arc(park.ballX, park.ballY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Aim Line when aiming
  if (park.status === "aim" && aimParkStart) {
    ctx.strokeStyle = "#a3e635";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(90, 250);
    ctx.lineTo(aimParkStart.x, aimParkStart.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 8. Duck in Park with Jump Offset
  const jumpOffset = park.jumpHeight || 0;
  drawDuckPuppy(
    ctx,
    {
      x: park.duckX,
      y: park.duckY - jumpOffset,
      angle: park.duckAngle,
      state: park.status === "retrieving" ? "FETCHING_BALL" : "IDLE_ROAM",
      isCarryingBall: park.status === "retrieving",
    },
    state.ticks,
    0,
    state.activeAccessory,
    park.status === "muddy"
  );

  // Park Instructions Overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(CANVAS_WIDTH / 2 - 220, 15, 440, 52);
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(CANVAS_WIDTH / 2 - 220, 15, 440, 52);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  if (park.status === "aim") {
    ctx.fillText(
      "🎾 Phase 1: Click & Drag on field to Launch!",
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Duck will sprint across to fetch & jump obstacles",
      CANVAS_WIDTH / 2,
      50
    );
  } else if (park.status === "thrown" || park.status === "retrieving") {
    ctx.fillStyle = "#facc15";
    ctx.fillText(
      `🐾 Steer Duck (Mouse) · Jump Hurdles (Space) · Bones: ${park.bonesCollected}/3`,
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Dodge mud puddles, jump hurdles & greet park friends!",
      CANVAS_WIDTH / 2,
      50
    );
  } else if (park.status === "success") {
    ctx.fillStyle = "#4ade80";
    ctx.fillText(
      `🌟 Perfect Fetch! Duck retrieved ball & ${park.bonesCollected} bones!`,
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Click 'Return to Office' for 30s Tired Puppy Buff",
      CANVAS_WIDTH / 2,
      50
    );
  } else if (park.status === "muddy") {
    ctx.fillStyle = "#f87171";
    ctx.fillText(
      "💦 Duck splashed in mud! Needs a quick bath in the Washroom!",
      CANVAS_WIDTH / 2,
      34
    );
    ctx.fillText(
      "Click 'Return to Office' to wash in Bathtub",
      CANVAS_WIDTH / 2,
      50
    );
  }
}

function drawBathtubScene(
  ctx: CanvasRenderingContext2D,
  state: WorkingWithDuckState
) {
  const bath = state.bathtubState;

  // 1. Cozy Pastel Blue Bathroom Tiles
  ctx.fillStyle = "#0c4a6e";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Tiles Grid
  ctx.strokeStyle = "#0369a1";
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  // 2. Porcelain Bathtub
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#bae6fd";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(200, 120, 400, 260, 40);
  ctx.fill();
  ctx.stroke();

  // Water inside Tub
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.roundRect(220, 140, 360, 220, 30);
  ctx.fill();

  // 3. Duck Sitting in Bathtub (Chin on ledge surrender pose)
  ctx.save();
  ctx.translate(400, 240);

  // Wet fluffy duck body
  ctx.fillStyle =
    bath.soapLather > 30 ? "#f0fdf4" : state.isMuddy ? "#a16207" : "#faf5ee";
  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 45, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cute head resting on bathtub rim
  ctx.fillStyle =
    bath.soapLather > 30 ? "#ffffff" : state.isMuddy ? "#854d0e" : "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, -25, 25, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Droopy relaxed bath ears
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.ellipse(-28, -20, 8, 16, -0.4, 0, Math.PI * 2);
  ctx.ellipse(28, -20, 8, 16, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Surrendered calm bath eyes
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(-8, -28, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.arc(8, -28, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // Nose
  ctx.fillStyle = "#18181b";
  ctx.beginPath();
  ctx.arc(0, -20, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 4. Soap Foam & Bubbles
  bath.bubbles.forEach((b) => {
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // 5. Bathtub HUD & Progress Card
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(CANVAS_WIDTH / 2 - 200, 20, 400, 75);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.strokeRect(CANVAS_WIDTH / 2 - 200, 20, 400, 75);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.fillText("🛁 DUCK'S BATHTUB WASHROOM", CANVAS_WIDTH / 2, 42);

  // Lather & Rinse Progress Bar
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillRect(CANVAS_WIDTH / 2 - 150, 52, 300, 10);

  const latherWidth = (300 * Math.min(100, bath.soapLather)) / 100;
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(CANVAS_WIDTH / 2 - 150, 52, latherWidth, 10);

  const rinseWidth = (300 * Math.min(100, bath.rinseLevel)) / 100;
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(CANVAS_WIDTH / 2 - 150, 52, rinseWidth, 10);

  ctx.fillStyle = "#e0f2fe";
  ctx.font = "bold 10px monospace";
  if (bath.soapLather < 100) {
    ctx.fillText(
      `🧼 Scrub Cursor to Lather Soap (${Math.round(bath.soapLather)}%)`,
      CANVAS_WIDTH / 2,
      80
    );
  } else if (bath.rinseLevel < 100) {
    ctx.fillText(
      `🚿 Click 'Rinse Spray' Button Below (${Math.round(bath.rinseLevel)}%)`,
      CANVAS_WIDTH / 2,
      80
    );
  } else {
    ctx.fillStyle = "#4ade80";
    ctx.fillText(
      "✨ 100% Clean! Click 'Finish Bath & Return'",
      CANVAS_WIDTH / 2,
      80
    );
  }
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: WorkingWithDuckState,
  aimParkStart: { x: number; y: number } | null = null
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (state.inDogPark) {
    drawDogParkScene(ctx, state, aimParkStart);
    return;
  }

  if (state.inBathtub) {
    drawBathtubScene(ctx, state);
    return;
  }

  drawOfficeScene(ctx, state);
}

// --- Main React Component ---

type InterruptionReason =
  "manual" | "scrapbook" | "wardrobe" | "manual_guide" | "hidden";

interface WorkingWithDuckProps {
  /**
   * Test/debug seam only: seeds both gameStateRef and uiState with this
   * exact state at mount instead of a fresh createInitialDuckGameState()
   * call. Lets a real-component + real-engine test drive straight to a
   * specific (e.g. near-terminal) state without simulating thousands of
   * ticks or mocking the engine module (#655). Not used by any production
   * caller.
   */
  initialState?: WorkingWithDuckState;
}

export const WorkingWithDuck: React.FC<WorkingWithDuckProps> = ({
  initialState,
}) => {
  const rawHighScore = useSyncExternalStore(
    subscribeStorage,
    getHighScoreSnapshot,
    getServerSnapshot
  );
  const loadedHighScore = parseInt(rawHighScore, 10) || 0;

  const { playNote, muted, setMuted } = useAudio();
  const { recordEvent } = useTelemetry();

  const createDefaultState = () =>
    createInitialDuckGameState(
      1,
      "campaign",
      undefined,
      getStoredUnlockedFacts()
    );

  // Core Game State Ref for 60 FPS deterministic engine
  const gameStateRef = useRef<WorkingWithDuckState>(
    initialState ?? createDefaultState()
  );
  // UI React State for rendering HUD, modals, and overlays
  const [uiState, setUiState] = useState<WorkingWithDuckState>(
    () => initialState ?? createDefaultState()
  );
  const [isManualPauseActive, setIsManualPauseActive] = useState(false);
  const isManuallyPaused = uiState.status === "paused" && isManualPauseActive;
  const [isScrapbookOpen, setIsScrapbookOpen] = useState(false);
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [activeScrapbookIndex, setActiveScrapbookIndex] = useState(0);
  const [scrapbookViewMode, setScrapbookViewMode] = useState<
    "photo" | "vector"
  >("photo");
  const [mobileTab, setMobileTab] = useState<"toys" | "tricks" | "actions">(
    "toys"
  );
  const isDraggingDuckStateRef = useRef(false);
  // A pointer drag that ends while the sprint is paused cannot drop Duck
  // (releaseDuck is a no-op while paused, #1645), so the drop waits for the
  // sprint to resume instead of leaving Duck held.
  const pendingDragReleaseRef = useRef(false);
  const isThrowingParkBallRef = useRef(false);
  const aimParkStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isMusicMuted, setIsMusicMuted] = useState(false);

  const { announce } = useAnnouncer();
  const { dispatchCommand, interactHazard } = useDuckService();

  // Single gateway for every gameStateRef mutation: gameStateRef.current and
  // uiState are always written together from the same computed value, so the
  // 60fps-loop ref and the throttled HUD state can never diverge by a call
  // site forgetting to update one of them (#598, #655). `shouldSync` lets the
  // hot per-frame tick path opt out of a React re-render per tick while still
  // going through this one path; every discrete user action defaults to
  // always syncing.
  const applyTransition = useCallback(
    (
      updater: (state: WorkingWithDuckState) => WorkingWithDuckState,
      shouldSync: (next: WorkingWithDuckState) => boolean = () => true
    ): WorkingWithDuckState => {
      const next = updater(gameStateRef.current);
      gameStateRef.current = next;
      if (shouldSync(next)) {
        setUiState(next);
      }
      return next;
    },
    []
  );

  const handleGiveTreat = useCallback(() => {
    applyTransition((state) => {
      const res = dispatchCommand({ type: "treat", state });
      return res.success ? res.data.state : state;
    });
  }, [applyTransition, dispatchCommand]);

  const handlePerformTrick = useCallback(
    (trick: "SIT" | "HIGH_FIVE" | "DROP_IT" | "SPIN") => {
      applyTransition((state) => {
        const res = dispatchCommand({ type: "trick", state, trick });
        return res.success ? res.data.state : state;
      });
    },
    [applyTransition, dispatchCommand]
  );

  const handleEquipAccessory = useCallback(
    (accessory: DuckAccessory) => {
      applyTransition((state) => {
        const res = dispatchCommand({ type: "accessory", state, accessory });
        return res.success ? res.data.state : state;
      });
    },
    [applyTransition, dispatchCommand]
  );

  const handleAdvanceLevel = useCallback(() => {
    applyTransition((state) => {
      const res = dispatchCommand({ type: "advance_level", state });
      return res.success ? res.data.state : state;
    });
  }, [applyTransition, dispatchCommand]);

  // Fixed-timestep simulation clock: the engine's tick balance (work
  // increments, timers, combo decay) was tuned assuming 60 ticks/sec, so
  // the loop below advances the simulation by real elapsed time in whole
  // FIXED_STEP_MS chunks instead of once per rendered frame. That keeps
  // gameplay speed identical at 30/60/120Hz instead of scaling with the
  // display's refresh rate (#600).
  const lastFrameTimeRef = useRef<number | null>(null);
  const stepAccumulatorRef = useRef(0);

  // Coordinated Interruption Management (#602): tracks active interruption
  // reasons (manual pause, scrapbook, wardrobe, document-hidden). Play only
  // advances when there are zero active interruptions. Closing one dialog
  // does not override another active interruption or manual pause.
  const activeInterruptionsRef = useRef<Set<InterruptionReason>>(new Set());
  const wasRunningBeforeInterruptionRef = useRef(false);

  const addInterruption = useCallback(
    (reason: InterruptionReason) => {
      const currentStatus = gameStateRef.current.status;
      if (currentStatus === "running") {
        wasRunningBeforeInterruptionRef.current = true;
        activeInterruptionsRef.current.add(reason);
        stepAccumulatorRef.current = 0;
        lastFrameTimeRef.current = null;
        applyTransition((state) => ({ ...state, status: "paused" }));
      } else if (currentStatus === "paused") {
        activeInterruptionsRef.current.add(reason);
      }
    },
    [applyTransition]
  );

  const removeInterruption = useCallback(
    (reason: InterruptionReason) => {
      activeInterruptionsRef.current.delete(reason);
      if (
        activeInterruptionsRef.current.size === 0 &&
        wasRunningBeforeInterruptionRef.current
      ) {
        wasRunningBeforeInterruptionRef.current = false;
        stepAccumulatorRef.current = 0;
        lastFrameTimeRef.current = null;
        applyTransition((state) => {
          if (state.status !== "paused") return state;
          const resumed: WorkingWithDuckState = { ...state, status: "running" };
          if (pendingDragReleaseRef.current) {
            pendingDragReleaseRef.current = false;
            return releaseDuck(resumed);
          }
          return resumed;
        });
      }
    },
    [applyTransition]
  );

  const toggleManualPause = useCallback(() => {
    const currentStatus = gameStateRef.current.status;
    if (currentStatus === "running") {
      setIsManualPauseActive(true);
      addInterruption("manual");
    } else if (currentStatus === "paused") {
      if (activeInterruptionsRef.current.has("manual")) {
        setIsManualPauseActive(false);
        removeInterruption("manual");
      } else {
        setIsManualPauseActive(true);
        addInterruption("manual");
      }
    }
  }, [addInterruption, removeInterruption]);

  const openScrapbook = useCallback(() => {
    setIsScrapbookOpen(true);
    addInterruption("scrapbook");
  }, [addInterruption]);

  const closeScrapbook = useCallback(() => {
    setIsScrapbookOpen(false);
    removeInterruption("scrapbook");
  }, [removeInterruption]);

  const openWardrobe = useCallback(() => {
    setIsWardrobeOpen(true);
    addInterruption("wardrobe");
  }, [addInterruption]);

  const closeWardrobe = useCallback(() => {
    setIsWardrobeOpen(false);
    removeInterruption("wardrobe");
  }, [removeInterruption]);

  const openManualsCountRef = useRef(0);

  const handleManualOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        openManualsCountRef.current += 1;
        setIsManualOpen(true);
        addInterruption("manual_guide");
      } else {
        openManualsCountRef.current = Math.max(
          0,
          openManualsCountRef.current - 1
        );
        if (openManualsCountRef.current === 0) {
          setIsManualOpen(false);
          removeInterruption("manual_guide");
        }
      }
    },
    [addInterruption, removeInterruption]
  );

  // Document visibility change listener (suspends simulation when tab is backgrounded)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        addInterruption("hidden");
      } else {
        removeInterruption("hidden");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [addInterruption, removeInterruption]);

  // Reset interruption state when session concludes or returns to idle
  useEffect(() => {
    if (
      uiState.status === "won" ||
      uiState.status === "failed" ||
      uiState.status === "idle"
    ) {
      wasRunningBeforeInterruptionRef.current = false;
      activeInterruptionsRef.current.clear();
      openManualsCountRef.current = 0;
    }
  }, [uiState.status]);

  const winTrapRef = useFocusTrap<HTMLDivElement>(uiState.status === "won", {
    onEscape: () => {
      handleAdvanceLevel();
    },
  });

  const failTrapRef = useFocusTrap<HTMLDivElement>(
    uiState.status === "failed",
    {
      onEscape: () => {
        applyTransition(() => {
          const next = createInitialDuckGameState(
            uiState.currentLevel,
            uiState.mode,
            undefined,
            uiState.unlockedFacts
          );
          next.status = "running";
          return next;
        });
      },
    }
  );

  const wardrobeTrapRef = useFocusTrap<HTMLDivElement>(isWardrobeOpen, {
    onEscape: () => closeWardrobe(),
  });

  const scrapbookTrapRef = useFocusTrap<HTMLDivElement>(isScrapbookOpen, {
    onEscape: () => closeScrapbook(),
  });

  const pauseTrapRef = useFocusTrap<HTMLDivElement>(
    uiState.status === "paused" &&
      isManuallyPaused &&
      !isScrapbookOpen &&
      !isWardrobeOpen &&
      !isManualOpen,
    {
      onEscape: () => toggleManualPause(),
    }
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toGameCoordinates } = useResponsiveCanvas({
    canvasRef,
    internalWidth: CANVAS_WIDTH,
    internalHeight: CANVAS_HEIGHT,
    maxDpr: 2.0,
  });
  // Sharp on HiDPI screens; drawing stays in the 800x500 logical space.
  const canvasScaleRef = useCanvasResolution({
    canvasRef,
    logicalWidth: CANVAS_WIDTH,
    logicalHeight: CANVAS_HEIGHT,
    // Resizing clears the bitmap; repaint in case the loop is idle.
    onResize: (scale) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      applyCanvasScale(ctx, scale);
      drawCanvas(ctx, gameStateRef.current, aimParkStartRef.current);
    },
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const [_isNearViewport, setIsNearViewport] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return true;
    }
    return false;
  });

  // Native IntersectionObserver to defer loading high-res scrapbook photos until container is within 200px of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsNearViewport(true);
          }
        });
      },
      { rootMargin: "200px" }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);
  const lastBellyScrubPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef);

  // Web Audio Procedural Synthesizer for Duck Sound Effects & Lo-Fi Beats
  const playSoundCue = useCallback(
    (cue: SoundCue) => {
      if (muted) return;
      try {
        if (cue === "tippy-tap") {
          playNote(700 + Math.random() * 200, 0.015);
        } else if (cue === "squeak") {
          playNote(1200, 0.05);
          setTimeout(() => playNote(1650, 0.04), 30);
        } else if (cue === "bark") {
          playNote(340, 0.06);
          setTimeout(() => playNote(220, 0.08), 25);
        } else if (cue === "belly-rub") {
          playNote(523.25 + Math.random() * 100, 0.08);
        } else if (cue === "whistle") {
          playNote(1760, 0.08);
          setTimeout(() => playNote(2093, 0.06), 40);
        } else if (cue === "snore") {
          playNote(160, 0.25);
        } else if (cue === "ding") {
          playNote(523.25, 0.08);
          setTimeout(() => playNote(659.25, 0.08), 60);
          setTimeout(() => playNote(783.99, 0.12), 120);
        } else if (cue === "fail") {
          playNote(220, 0.15);
          setTimeout(() => playNote(180, 0.2), 100);
        } else if (cue === "door-knock") {
          playNote(140, 0.06);
          setTimeout(() => playNote(130, 0.06), 90);
          setTimeout(() => playNote(140, 0.06), 180);
        } else if (cue === "squirrel-chirp") {
          playNote(2200, 0.04);
          setTimeout(() => playNote(2600, 0.04), 50);
        } else if (cue === "hiccup") {
          playNote(650, 0.03);
        } else if (cue === "combo-fanfare") {
          playNote(523.25, 0.06);
          setTimeout(() => playNote(659.25, 0.06), 50);
          setTimeout(() => playNote(783.99, 0.06), 100);
          setTimeout(() => playNote(1046.5, 0.12), 150);
        } else if (cue === "trick-chime") {
          playNote(880, 0.06);
          setTimeout(() => playNote(1174.66, 0.08), 50);
        } else if (cue === "paw-clap") {
          playNote(440, 0.04);
          setTimeout(() => playNote(880, 0.04), 25);
        } else if (cue === "spin-whoosh") {
          playNote(300, 0.06);
          setTimeout(() => playNote(600, 0.06), 40);
        } else if (cue === "bath-soap") {
          playNote(900 + Math.random() * 300, 0.03);
        } else if (cue === "bath-rinse") {
          playNote(400, 0.1);
          setTimeout(() => playNote(500, 0.1), 60);
        } else if (cue === "water-lap") {
          playNote(600, 0.03);
        } else if (cue === "crunch-kibble") {
          playNote(250, 0.03);
        } else if (cue === "code-type") {
          playNote(1200 + Math.random() * 200, 0.015);
        } else if (cue === "frisbee-throw") {
          playNote(700, 0.08);
          setTimeout(() => playNote(950, 0.08), 50);
        }
      } catch {}
    },
    [muted, playNote]
  );

  const playSoundCueRef = useRef(playSoundCue);
  useEffect(() => {
    playSoundCueRef.current = playSoundCue;
  }, [playSoundCue]);

  // Procedural Lo-Fi Background Music Loop
  useEffect(() => {
    if (muted || isMusicMuted || uiState.status !== "running") return;

    const chords = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
      [293.66, 349.23, 440.0, 523.25], // Dm7
      [196.0, 246.94, 293.66, 349.23], // G7
    ];

    let chordIdx = 0;
    const interval = setInterval(() => {
      try {
        const chord = chords[chordIdx];
        chord.forEach((freq, i) => {
          setTimeout(() => {
            playNote(freq, 0.35);
          }, i * 40);
        });
        chordIdx = (chordIdx + 1) % chords.length;
      } catch {}
    }, 2400);

    return () => clearInterval(interval);
  }, [muted, isMusicMuted, uiState.status, playNote]);

  // Sync high scores safely to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Raw writes keep the stored bytes: a bare numeric string and a plain
      // JSON array, exactly as before safeStorage.
      if (uiState.highScore > loadedHighScore) {
        safeSetRawItem(
          "working_with_duck_high_score",
          String(uiState.highScore)
        );
      }
      if (uiState.unlockedFacts.length > 0) {
        safeSetRawItem(
          "working_with_duck_unlocked_facts",
          JSON.stringify(uiState.unlockedFacts)
        );
      }
    } catch {}
  }, [uiState.highScore, uiState.unlockedFacts, loadedHighScore]);

  // Main 60 FPS Canvas Game Loop
  //
  // The loop stops only while the canvas context is lost; idle, paused and
  // finished sessions keep drawing, exactly as before. The context listeners
  // set a ref that guards the frame already in flight and a state flag that
  // stops the loop; restoring the context starts a fresh one.
  const contextLostRef = useRef(false);
  const [isContextLost, setIsContextLost] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLostRef.current = true;
      setIsContextLost(true);
    };

    const handleContextRestored = () => {
      contextLostRef.current = false;
      // Discard elapsed wall-clock time across the context-loss gap so
      // resuming doesn't replay it as a burst of catch-up steps.
      lastFrameTimeRef.current = null;
      stepAccumulatorRef.current = 0;
      setIsContextLost(false);
    };

    canvas.addEventListener("contextlost", handleContextLost);
    canvas.addEventListener("contextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("contextlost", handleContextLost);
      canvas.removeEventListener("contextrestored", handleContextRestored);
    };
  }, []);

  // Simulation runs on a fixed 60Hz timestep (the engine's tick balance —
  // work increments, timers, combo decay — was tuned assuming 60 ticks/sec)
  // driven by real elapsed time, not once per rendered frame, so gameplay
  // speed stays identical whether the display is 30, 60, or 120Hz (#600).
  // The loop's own delta is unclamped (maxDeltaMs: Infinity); the catch-up
  // cap below is the only clamp, as before. lastFrameTimeRef holds the
  // loop's clock (elapsedMs) at the previous frame, so the difference
  // between two frames is the real gap between them.
  useAnimationFrame(
    (_deltaMs, clockMs) => {
      if (contextLostRef.current) return;

      const previousClock = lastFrameTimeRef.current;
      lastFrameTimeRef.current = clockMs;
      const state = gameStateRef.current;

      if (state.status !== "running") {
        // Not simulating (idle/won/lost/paused): don't let time spent here
        // accumulate into a catch-up burst whenever play resumes.
        stepAccumulatorRef.current = 0;
        lastFrameTimeRef.current = null;
      } else {
        // There's no previous frame to diff against right after a sprint
        // starts (or resumes from a context-loss reset): treat it as
        // exactly one fixed step rather than zero, so play advances on the
        // very next frame instead of silently priming the clock first.
        // Every later frame uses real measured elapsed time, clamped so a
        // dropped frame, a backgrounded tab, or that same gap can't be
        // replayed as a runaway catch-up burst.
        const elapsedMs =
          previousClock === null
            ? DUCK_FIXED_STEP_MS
            : Math.min(
                clockMs - previousClock,
                DUCK_FIXED_STEP_MS * DUCK_MAX_CATCHUP_STEPS
              );
        stepAccumulatorRef.current += elapsedMs;

        let stepsThisFrame = 0;
        while (
          stepAccumulatorRef.current >= DUCK_FIXED_STEP_MS &&
          stepsThisFrame < DUCK_MAX_CATCHUP_STEPS &&
          gameStateRef.current.status === "running"
        ) {
          let cuesToPlay: SoundCue[] = [];
          // Throttle UI update every 4 ticks (~15 updates/sec of simulated
          // time for DOM performance), but always flush immediately on a
          // terminal win/fail transition so the victory/failure panel is
          // never hidden behind a stale throttled frame.
          applyTransition((state) => {
            const stepped = stepDuckGame(state);
            if (stepped.soundCueQueue.length > 0) {
              cuesToPlay = stepped.soundCueQueue;
              return { ...stepped, soundCueQueue: [] };
            }
            return stepped;
          }, shouldSyncDuckHudState);
          stepAccumulatorRef.current -= DUCK_FIXED_STEP_MS;
          stepsThisFrame++;

          // Process sound cue queue
          cuesToPlay.forEach((cue) => playSoundCueRef.current(cue));
        }
      }

      // Draw canvas frame
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const scale = canvasScaleRef.current;
          applyCanvasScale(ctx, scale);
          drawCanvas(ctx, gameStateRef.current, aimParkStartRef.current);
        }
      }
    },
    { isActive: !isContextLost, maxDeltaMs: Infinity }
  );

  // Keyboard Shortcuts (1-4 for hotbar items, Q-W-E-R for tricks, Space for coding/jumping)
  //
  // DUCK_HOTKEYS lists every key the handler acts on under every Ctrl, Alt
  // and Meta combination, because the listener never checked modifiers.
  // The container is a keyboard boundary, so the binding opts in to it; the
  // handler keeps its own interactive-target and focus checks.
  useHotkeys(
    DUCK_HOTKEYS,
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const interactiveTag =
        target?.tagName === "BUTTON" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "A";
      const interactiveRole =
        target?.getAttribute?.("role") === "button" ||
        target?.getAttribute?.("role") === "link" ||
        target?.getAttribute?.("role") === "menuitem" ||
        target?.getAttribute?.("role") === "tab";
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        interactiveTag ||
        interactiveRole
      ) {
        return;
      }

      // Restrict key listener to only fire when focus is within our container
      if (
        !containerRef.current ||
        !containerRef.current.contains(document.activeElement)
      ) {
        return;
      }

      const state = gameStateRef.current;
      if (e.key === "p" || e.key === "P") {
        if (state.status === "running" || state.status === "paused") {
          e.preventDefault();
          toggleManualPause();
        }
      } else if (state.status === "paused") {
        // A paused sprint is frozen (#1645): only P acts. Swallow Space and
        // the arrows so they don't scroll the page behind the pause overlay.
        if (e.code === "Space" || e.key.startsWith("Arrow")) {
          e.preventDefault();
        }
      } else if (e.key === "1") {
        if (!state.inDogPark && !state.inBathtub) {
          applyTransition((state) => ({
            ...state,
            selectedItem: "tennis-ball",
          }));
        }
      } else if (e.key === "2") {
        if (!state.inDogPark && !state.inBathtub) {
          applyTransition((state) => ({ ...state, selectedItem: "kong" }));
        }
      } else if (e.key === "3") {
        if (!state.inDogPark && !state.inBathtub) {
          applyTransition((state) => ({
            ...state,
            selectedItem: "squeaky-toy",
          }));
        }
      } else if (e.key === "4") {
        handleGiveTreat();
      } else if (e.key === "q" || e.key === "Q") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("SIT");
        }
      } else if (e.key === "w" || e.key === "W") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("HIGH_FIVE");
        } else if (state.inDogPark) {
          applyTransition((state) =>
            steerParkDuck(state, state.parkState.duckY - 25)
          );
        }
      } else if (e.key === "e" || e.key === "E") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("DROP_IT");
        }
      } else if (e.key === "r" || e.key === "R") {
        if (!state.inDogPark && !state.inBathtub) {
          handlePerformTrick("SPIN");
        }
      } else if (e.code === "Space") {
        e.preventDefault();
        if (state.inDogPark) {
          applyTransition((state) => jumpParkHurdle(state));
        } else if (!state.inBathtub) {
          applyTransition((state) => activeCodeBurst(state));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.inDogPark) {
          applyTransition((state) =>
            steerParkDuck(state, state.parkState.duckY - 25)
          );
        } else {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextY = Math.max(50, next.duck.y - 25);
            return dragDuckTo(next, next.duck.x, nextY);
          });
          announce(
            `Dragging Duck up. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (state.inDogPark) {
          applyTransition((state) =>
            steerParkDuck(state, state.parkState.duckY + 25)
          );
        } else {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextY = Math.min(CANVAS_HEIGHT - 50, next.duck.y + 25);
            return dragDuckTo(next, next.duck.x, nextY);
          });
          announce(
            `Dragging Duck down. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (!state.inDogPark) {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextX = Math.max(50, next.duck.x - 25);
            return dragDuckTo(next, nextX, next.duck.y);
          });
          announce(
            `Dragging Duck left. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!state.inDogPark) {
          const s = applyTransition((state) => {
            let next = state;
            if (next.duck.state !== "DRAGGED") {
              next = startDraggingDuck(next);
            }
            const nextX = Math.min(CANVAS_WIDTH - 25, next.duck.x + 25);
            return dragDuckTo(next, nextX, next.duck.y);
          });
          announce(
            `Dragging Duck right. Horizontal position ${Math.round(s.duck.x)}, vertical position ${Math.round(s.duck.y)}. Press Enter to drop.`,
            "polite"
          );
        }
      } else if (e.key === "Enter") {
        if (state.duck.state === "DRAGGED") {
          e.preventDefault();
          const s = applyTransition((state) => releaseDuck(state));
          let dropLocation = "on the floor";
          if (s.inBathtub) dropLocation = "in the bathtub";
          else if (
            s.duck.x >= BACK_DOOR_BOUNDS.x &&
            s.duck.x <= BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width &&
            s.duck.y >= BACK_DOOR_BOUNDS.y &&
            s.duck.y <= BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height
          ) {
            dropLocation = "outside to potty";
          }
          announce(`Dropped Duck ${dropLocation}.`, "polite");
        }
      }
    },
    { allowInKeyboardBoundary: true }
  );

  // Ends a pointer drag. While paused the drop is deferred until the sprint
  // resumes (see pendingDragReleaseRef), so it can't score with the clock
  // stopped (#1645).
  const endPointerDrag = useCallback(
    (state: WorkingWithDuckState): WorkingWithDuckState => {
      isDraggingDuckStateRef.current = false;
      if (state.status === "paused") {
        pendingDragReleaseRef.current = true;
        return state;
      }
      return releaseDuck(state);
    },
    []
  );

  // Global Window Pointer Up & Cancel Handler (Prevents Drag Locking Off-Canvas)
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      const state = gameStateRef.current;
      if (
        state.inDogPark &&
        isThrowingParkBallRef.current &&
        aimParkStartRef.current
      ) {
        isThrowingParkBallRef.current = false;
        const powerX = (aimParkStartRef.current.x - 90) * 0.08;
        const powerY = (aimParkStartRef.current.y - 250) * 0.06;
        applyTransition((state) => throwParkBall(state, powerX, powerY));
        aimParkStartRef.current = null;
        return;
      }

      if (isDraggingDuckStateRef.current) {
        applyTransition((state) => endPointerDrag(state));
      }
    };

    const handleGlobalPointerCancel = () => {
      let needsUpdate = false;
      applyTransition(
        (state) => {
          let next = state;
          if (isThrowingParkBallRef.current) {
            isThrowingParkBallRef.current = false;
            aimParkStartRef.current = null;
            needsUpdate = true;
          }
          if (isDraggingDuckStateRef.current) {
            next = endPointerDrag(next);
            needsUpdate = true;
          }
          return next;
        },
        () => needsUpdate
      );
    };

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerCancel);
    window.addEventListener("mouseup", handleGlobalPointerUp);
    window.addEventListener("touchend", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerCancel);
      window.removeEventListener("mouseup", handleGlobalPointerUp);
      window.removeEventListener("touchend", handleGlobalPointerUp);
    };
  }, [applyTransition, endPointerDrag]);

  // Reactive metrics and status changes screen reader announcer
  const lastAnnouncedBladderRef = useRef(false);
  const lastAnnouncedExcitementRef = useRef(false);
  const lastAnnouncedStatusRef = useRef<string | null>(null);
  const lastAnnouncedWorkProgressRef = useRef(0);

  useEffect(() => {
    if (!uiState) return;

    // Announce status changes
    if (uiState.status !== lastAnnouncedStatusRef.current) {
      if (uiState.status === "won") {
        announce(
          "Sprint completed! Duck is asleep and work is done.",
          "assertive"
        );
      } else if (uiState.status === "failed") {
        announce("Sprint failed. Duck got a time-out.", "assertive");
      } else if (
        uiState.status === "running" &&
        lastAnnouncedStatusRef.current === "idle"
      ) {
        announce(
          `${uiState.mode === "endless" ? "Run" : "Sprint"} started.`,
          "polite"
        );
      } else if (uiState.status === "paused") {
        announce(
          `${uiState.mode === "endless" ? "Run" : "Sprint"} paused.`,
          "polite"
        );
      } else if (
        uiState.status === "running" &&
        lastAnnouncedStatusRef.current === "paused"
      ) {
        announce(
          `${uiState.mode === "endless" ? "Run" : "Sprint"} resumed.`,
          "polite"
        );
      }
      lastAnnouncedStatusRef.current = uiState.status;
    }

    // Announce high bladder
    const isBladderHigh = uiState.bladder > 80;
    if (isBladderHigh && !lastAnnouncedBladderRef.current) {
      announce(
        "Warning: Duck bladder is full. Drag the duck to the back door immediately!",
        "assertive"
      );
      lastAnnouncedBladderRef.current = true;
    } else if (!isBladderHigh) {
      lastAnnouncedBladderRef.current = false;
    }

    // Announce high excitement
    const isExcitementHigh = uiState.excitement > 80;
    if (isExcitementHigh && !lastAnnouncedExcitementRef.current) {
      announce(
        "Warning: Duck excitement is high. Call Sit (Q) or take a dog park trip!",
        "polite"
      );
      lastAnnouncedExcitementRef.current = true;
    } else if (!isExcitementHigh) {
      lastAnnouncedExcitementRef.current = false;
    }

    // Announce major work progress milestones (every 25%)
    const pct = Math.min(
      100,
      Math.round((uiState.workProgress / uiState.targetWorkProgress) * 100)
    );
    const milestone = Math.floor(pct / 25) * 25;
    if (milestone > lastAnnouncedWorkProgressRef.current && milestone > 0) {
      announce(`Work progress is at ${milestone} percent.`, "polite");
      lastAnnouncedWorkProgressRef.current = milestone;
    } else if (pct === 0) {
      lastAnnouncedWorkProgressRef.current = 0;
    }
  }, [uiState, announce]);

  // Canvas Mouse Interactions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toGameCoordinates(e.clientX, e.clientY);

    const state = gameStateRef.current;

    // A paused sprint ignores the canvas (#1645).
    if (state.status === "paused") return;

    // Bathtub Mode Mouse Scrubbing
    if (state.inBathtub) {
      applyTransition((state) => scrubBathtub(state, x, y));
      return;
    }

    // Dog Park Aiming & Throwing
    if (state.inDogPark) {
      if (state.parkState.status === "aim") {
        aimParkStartRef.current = { x, y };
        isThrowingParkBallRef.current = true;
      }
      return;
    }

    // Check click on surprise event target
    if (state.activeSurpriseEvent) {
      if (
        state.activeSurpriseEvent.type === "squirrel-window" &&
        x >= 340 &&
        x <= 465 &&
        y <= 85
      ) {
        applyTransition((state) => ({
          ...state,
          activeSurpriseEvent: null,
          totalScore: state.totalScore + 200,
          comboStreak: state.comboStreak + 1,
          soundCueQueue: [...state.soundCueQueue, "combo-fanfare"],
          floatingAlerts: [
            ...state.floatingAlerts,
            {
              id: state.nextAlertId,
              x: 400,
              y: 80,
              text: "🐿️ Squirrel Watched! (+200 pts)",
              color: "#38bdf8",
              alpha: 1,
              vy: -1.2,
            },
          ],
        }));
        return;
      }

      if (
        state.activeSurpriseEvent.type === "amazon-delivery" &&
        x >= BACK_DOOR_BOUNDS.x - 70 &&
        x <= BACK_DOOR_BOUNDS.x + 30 &&
        y >= BACK_DOOR_BOUNDS.y + 10 &&
        y <= BACK_DOOR_BOUNDS.y + 70
      ) {
        applyTransition((state) => ({
          ...state,
          activeSurpriseEvent: null,
          totalScore: state.totalScore + 150,
          comboStreak: state.comboStreak + 1,
          soundCueQueue: [...state.soundCueQueue, "combo-fanfare"],
          floatingAlerts: [
            ...state.floatingAlerts,
            {
              id: state.nextAlertId,
              x: BACK_DOOR_BOUNDS.x,
              y: BACK_DOOR_BOUNDS.y + 30,
              text: "📦 Package Retrieved! (+150 pts)",
              color: "#f59e0b",
              alpha: 1,
              vy: -1.2,
            },
          ],
        }));
        return;
      }
    }

    // Check if clicked directly on Desk for Active Code Burst
    if (
      x >= DESK_BOUNDS.x &&
      x <= DESK_BOUNDS.x + DESK_BOUNDS.width &&
      y >= DESK_BOUNDS.y &&
      y <= DESK_BOUNDS.y + DESK_BOUNDS.height
    ) {
      applyTransition((state) => activeCodeBurst(state));
      return;
    }

    // Check if clicked directly on Stations
    if (
      x >= WATER_BOWL_BOUNDS.x &&
      x <= WATER_BOWL_BOUNDS.x + WATER_BOWL_BOUNDS.width &&
      y >= WATER_BOWL_BOUNDS.y &&
      y <= WATER_BOWL_BOUNDS.y + WATER_BOWL_BOUNDS.height
    ) {
      applyTransition((state) => {
        const res = dispatchCommand({
          type: "station",
          state,
          station: "water",
        });
        return res.success ? res.data.state : state;
      });
      return;
    }

    if (
      x >= FOOD_BOWL_BOUNDS.x &&
      x <= FOOD_BOWL_BOUNDS.x + FOOD_BOWL_BOUNDS.width &&
      y >= FOOD_BOWL_BOUNDS.y &&
      y <= FOOD_BOWL_BOUNDS.y + FOOD_BOWL_BOUNDS.height
    ) {
      applyTransition((state) => {
        const res = dispatchCommand({
          type: "station",
          state,
          station: "food",
        });
        return res.success ? res.data.state : state;
      });
      return;
    }

    if (
      x >= BATHTUB_BOUNDS.x &&
      x <= BATHTUB_BOUNDS.x + BATHTUB_BOUNDS.width &&
      y >= BATHTUB_BOUNDS.y &&
      y <= BATHTUB_BOUNDS.y + BATHTUB_BOUNDS.height
    ) {
      applyTransition((state) => enterBathtub(state));
      return;
    }

    // Check if clicked directly on indoor puddle for mopping
    if (state.indoorPuddles && state.indoorPuddles.length > 0) {
      const clickedPuddle = state.indoorPuddles.some(
        (p) => Math.hypot(x - p.x, y - p.y) <= p.radius + 15
      );
      if (clickedPuddle) {
        applyTransition((state) => mopIndoorPuddle(state, x, y));
        return;
      }
    }

    // Check if clicked directly on Duck
    const duckDist = Math.hypot(x - state.duck.x, y - state.duck.y);
    if (duckDist < 38) {
      if (state.duck.state === "NO_TAKE_THROW") {
        handleGiveTreat();
        return;
      }
      applyTransition(
        (state) => startDraggingDuck(state),
        () => false
      );
      isDraggingDuckStateRef.current = true;
      return;
    }

    // Use Selected Hotbar Item on Canvas click
    applyTransition((state) => {
      if (state.selectedItem === "squeaky-toy") {
        const res = interactHazard({
          state,
          action: "distract_with_squeaky",
          x,
          y,
        });
        return res.success ? res.data.state : state;
      } else if (state.selectedItem === "kong") {
        const res = interactHazard({
          state,
          action: "distract_with_kong",
          x,
          y,
        });
        return res.success ? res.data.state : state;
      } else if (state.selectedItem === "tennis-ball") {
        const res = dispatchCommand({
          type: "throw_ball",
          state,
          targetX: x,
          targetY: y,
        });
        return res.success ? res.data.state : state;
      } else if (state.selectedItem === "treat") {
        const res = dispatchCommand({ type: "treat", state });
        return res.success ? res.data.state : state;
      }
      return state;
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toGameCoordinates(e.clientX, e.clientY);

    const state = gameStateRef.current;

    if (state.status === "paused") return;

    // Bathtub Mode Scrubbing
    if (state.inBathtub) {
      applyTransition((state) => scrubBathtub(state, x, y));
      return;
    }

    // Dog Park Mouse Steering during retrieval
    if (state.inDogPark) {
      if (isThrowingParkBallRef.current) {
        aimParkStartRef.current = { x, y };
      } else if (state.parkState.status === "retrieving") {
        applyTransition(
          (state) => steerParkDuck(state, y),
          () => false
        );
      }
      return;
    }

    // Dragging Duck
    if (isDraggingDuckStateRef.current) {
      applyTransition(
        (state) => dragDuckTo(state, x, y),
        () => false
      );
      return;
    }

    // Scrub / Mop Indoor Puddle on Hover & Scrub
    if (state.indoorPuddles && state.indoorPuddles.length > 0) {
      const hoveringPuddle = state.indoorPuddles.some(
        (p) => Math.hypot(x - p.x, y - p.y) <= p.radius + 15
      );
      if (hoveringPuddle) {
        applyTransition((state) => mopIndoorPuddle(state, x, y));
      }
    }

    // Belly Rubbing during The Flop
    if (state.duck.state === "THE_FLOP") {
      const movedDist = Math.hypot(
        x - lastBellyScrubPosRef.current.x,
        y - lastBellyScrubPosRef.current.y
      );
      if (movedDist > 12) {
        lastBellyScrubPosRef.current = { x, y };
        applyTransition((state) => {
          const res = dispatchCommand({ type: "pet", state, x, y });
          return res.success ? res.data.state : state;
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    const state = gameStateRef.current;

    if (
      state.inDogPark &&
      isThrowingParkBallRef.current &&
      aimParkStartRef.current
    ) {
      isThrowingParkBallRef.current = false;
      const powerX = (aimParkStartRef.current.x - 90) * 0.08;
      const powerY = (aimParkStartRef.current.y - 250) * 0.06;
      applyTransition((state) => throwParkBall(state, powerX, powerY));
      aimParkStartRef.current = null;
      return;
    }

    if (isDraggingDuckStateRef.current) {
      applyTransition((state) => endPointerDrag(state));
    }
  };

  const lastPointerTimeRef = useRef(0);

  const handleCanvasPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    lastPointerTimeRef.current = Date.now();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignored for environments without pointer capture mock
    }
    const fakeMouseEvent = {
      clientX: e.clientX,
      clientY: e.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    handleCanvasMouseDown(fakeMouseEvent);
  };

  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const fakeMouseEvent = {
      clientX: e.clientX,
      clientY: e.clientY,
    } as React.MouseEvent<HTMLCanvasElement>;
    handleCanvasMouseMove(fakeMouseEvent);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    handleCanvasMouseUp();
  };

  const handleCanvasPointerCancel = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    let needsUpdate = false;
    applyTransition(
      (state) => {
        let next = state;
        if (isDraggingDuckStateRef.current) {
          next = endPointerDrag(next);
          needsUpdate = true;
        }
        if (isThrowingParkBallRef.current) {
          isThrowingParkBallRef.current = false;
          aimParkStartRef.current = null;
          needsUpdate = true;
        }
        return next;
      },
      () => needsUpdate
    );
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      handleCanvasMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as unknown as React.MouseEvent<HTMLCanvasElement>);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      handleCanvasMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as unknown as React.MouseEvent<HTMLCanvasElement>);
    }
  };

  const handleTouchEnd = () => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    handleCanvasMouseUp();
  };

  const handleTouchCancel = () => {
    if (Date.now() - lastPointerTimeRef.current < 100) return;
    let needsUpdate = false;
    applyTransition(
      (state) => {
        let next = state;
        if (isDraggingDuckStateRef.current) {
          next = endPointerDrag(next);
          needsUpdate = true;
        }
        if (isThrowingParkBallRef.current) {
          isThrowingParkBallRef.current = false;
          aimParkStartRef.current = null;
          needsUpdate = true;
        }
        return next;
      },
      () => needsUpdate
    );
  };

  const currentSprint =
    SPRINTS.find((s) => s.level === uiState.currentLevel) || SPRINTS[0];

  // Guided Onboarding Hint Text
  let tutorialHint: string | null = null;
  if (uiState.status === "running" && uiState.inDogPark) {
    // Scene tips show on every sprint: the controls change with the scene.
    tutorialHint =
      "🌲 Dog Park: drag on the field and let go to throw, steer Duck with the mouse, W or the arrow keys, and press Space to jump. Work, Excitement and Bladder pause until you return to the office.";
  } else if (uiState.status === "running" && uiState.inBathtub) {
    tutorialHint =
      "🛁 Bath time: move your cursor over the tub to lather Duck, then Rinse until he's clean and Finish Bath. Work, Excitement and Bladder pause until you're back in the office.";
  } else if (uiState.currentLevel === 1 && uiState.status === "running") {
    if (uiState.duck.state === "THE_FLOP") {
      tutorialHint =
        "💖 Duck flopped on his back! Move your cursor back & forth over his belly!";
    } else if (
      uiState.duck.state === "SNIFFING_POTTY" ||
      uiState.bladder > 80
    ) {
      tutorialHint =
        "🚽 Duck needs to go! Click and drag Duck over to the Back Door!";
    } else if (uiState.duck.state === "SNEAKY_CHEW") {
      tutorialHint =
        "⚠️ Duck is eyeing your work! Drop a Kong (2) or Call Drop It (E) to save it!";
    } else if (uiState.duck.state === "NO_TAKE_THROW") {
      tutorialHint =
        "🎾 Duck caught the ball! Press (4) to trade a treat or (E) for Drop It!";
    } else if (uiState.excitement > 80) {
      tutorialHint =
        "⚡ Excitement is high! Call Sit (Q) or take a Dog Park trip!";
    } else {
      tutorialHint =
        "💡 Tip: Work advances automatically. Press Space for active coding bursts & try training tricks (Q-W-E-R)!";
    }
  }

  const sessionLabel = uiState.mode === "endless" ? "Run" : "Sprint";
  const displayedHighScore = Math.max(uiState.highScore, loadedHighScore);

  // Paused play is frozen (#1645); toys and tricks only work in the office
  // (#1647). Disabled controls point at the reason via aria-describedby.
  const isPlayFrozen = uiState.status === "paused";
  const isAwayFromOffice = uiState.inDogPark || uiState.inBathtub;
  const officeOnlyDisabled = isPlayFrozen || isAwayFromOffice;
  const pausedReasonId = isPlayFrozen ? "duck-paused-reason" : undefined;
  const officeOnlyReasonId = isPlayFrozen
    ? "duck-paused-reason"
    : isAwayFromOffice
      ? "duck-office-only-reason"
      : undefined;

  const renderPauseButton = (isQuickMeta: boolean) => (
    <button
      onClick={toggleManualPause}
      disabled={uiState.status !== "running" && !isManuallyPaused}
      className={`${
        isQuickMeta ? "p-2" : "p-2.5"
      } rounded-xl border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.98] ${
        uiState.status !== "running" && !isManuallyPaused
          ? "border-zinc-800/40 bg-zinc-900/30 text-zinc-600 cursor-not-allowed"
          : isManuallyPaused
            ? "border-amber-500/50 bg-amber-500/20 text-amber-300 hover:text-white cursor-pointer"
            : "border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white cursor-pointer"
      }`}
      title={
        isManuallyPaused
          ? `Resume ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
          : `Pause ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
      }
      aria-label={
        isManuallyPaused
          ? `Resume ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
          : `Pause ${sessionLabel}${isQuickMeta ? " (P)" : ""}`
      }
    >
      {isManuallyPaused ? (
        <IconPlayerPlay className="w-4 h-4 text-amber-400 fill-current" />
      ) : (
        <IconPlayerPause className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-keyboard-boundary="true"
      className={`relative w-full max-w-5xl mx-auto select-none font-sans outline-none ${
        isFullscreen
          ? "fixed inset-0 z-50 w-full h-[100dvh] max-h-[100dvh] max-w-none rounded-none bg-black p-2 sm:p-4 overflow-y-auto overflow-x-hidden flex flex-col justify-between"
          : ""
      }`}
    >
      {/* Tablet Orientation Recommendation */}
      <TabletOrientationHint />

      {/* Top Status & Meters HUD */}
      <div
        data-testid="duck-hud-meters"
        className="mb-3 sm:mb-4 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 [@media(max-height:650px)]:mb-1.5 [@media(max-height:650px)]:grid-cols-4 [@media(max-height:650px)]:gap-1.5"
      >
        {/* Work Progress Meter */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2.5 sm:p-3.5 backdrop-blur-md [@media(max-height:650px)]:p-1.5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono mb-1">
            <span className="text-zinc-400 font-bold flex items-center gap-1 sm:gap-1.5 truncate">
              <IconBriefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
              <span>Work Progress</span>
            </span>
            <span className="text-brand-cyan font-bold shrink-0 ml-1">
              {Math.min(
                100,
                Math.round(
                  (uiState.workProgress / uiState.targetWorkProgress) * 100
                )
              )}
              %
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.min(
              100,
              Math.round(
                (uiState.workProgress / uiState.targetWorkProgress) * 100
              )
            )}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Work Progress"
            className="w-full bg-zinc-950 rounded-full h-2 sm:h-2.5 overflow-hidden border border-zinc-800"
          >
            <div
              className="h-full w-full bg-gradient-to-r from-cyan-500 to-teal-400 origin-left transform-gpu"
              style={{
                transform: `scaleX(${Math.min(1, uiState.workProgress / uiState.targetWorkProgress)})`,
                transformOrigin: "left",
                willChange: "transform",
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1 text-[9px] sm:text-[10px] font-mono text-zinc-400 [@media(max-height:650px)]:hidden">
            <span className="truncate">
              {uiState.mode === "endless"
                ? "Endless Mode"
                : currentSprint.title.split(":")[0]}
            </span>
            <span className="text-teal-400 font-bold shrink-0 ml-1">
              {uiState.multiplier.toFixed(1)}× Speed
            </span>
          </div>
        </div>

        {/* Excitement / Zoomies Meter */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2.5 sm:p-3.5 backdrop-blur-md [@media(max-height:650px)]:p-1.5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono mb-1">
            <span className="text-zinc-400 font-bold flex items-center gap-1 sm:gap-1.5 truncate">
              <IconSparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
              <span>Excitement</span>
            </span>
            <span
              className={`font-bold shrink-0 ml-1 ${
                uiState.excitement > 80
                  ? "text-amber-400 animate-pulse"
                  : "text-zinc-300"
              }`}
            >
              {Math.round(uiState.excitement)}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(uiState.excitement)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Duck Excitement Meter"
            className="w-full bg-zinc-950 rounded-full h-2 sm:h-2.5 overflow-hidden border border-zinc-800"
          >
            <div
              className={`h-full w-full origin-left transform-gpu ${
                uiState.excitement > 80
                  ? "bg-gradient-to-r from-amber-500 to-rose-500"
                  : "bg-gradient-to-r from-sky-400 to-amber-400"
              }`}
              style={{
                transform: `scaleX(${clamp(uiState.excitement / 100, 0, 1)})`,
                transformOrigin: "left",
                willChange: "transform",
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1 text-[9px] sm:text-[10px] font-mono text-zinc-400 [@media(max-height:650px)]:hidden">
            <span className="truncate">
              {uiState.excitement > 85 ? "⚠️ ZOOMIES" : "Fetch / Sit"}
            </span>
            {uiState.calmBuffTimer > 0 && (
              <span className="text-emerald-400 shrink-0 ml-1">
                Calm Active
              </span>
            )}
          </div>
        </div>

        {/* Bladder / Potty Meter */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2.5 sm:p-3.5 backdrop-blur-md [@media(max-height:650px)]:p-1.5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono mb-1">
            <span className="text-zinc-400 font-bold flex items-center gap-1 sm:gap-1.5 truncate">
              <IconAlertTriangle
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${uiState.bladder > 80 ? "text-rose-400 animate-bounce" : "text-sky-400"}`}
              />
              <span>Bladder Clock</span>
            </span>
            <span
              className={`font-bold shrink-0 ml-1 ${uiState.bladder > 80 ? "text-rose-400" : "text-zinc-300"}`}
            >
              {Math.round(uiState.bladder)}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(uiState.bladder)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Duck Bladder Clock Meter"
            className="w-full bg-zinc-950 rounded-full h-2 sm:h-2.5 overflow-hidden border border-zinc-800"
          >
            <div
              className={`h-full w-full origin-left transform-gpu ${
                uiState.bladder > 85
                  ? "bg-rose-500 animate-pulse"
                  : "bg-gradient-to-r from-cyan-400 to-sky-500"
              }`}
              style={{
                transform: `scaleX(${clamp(uiState.bladder / 100, 0, 1)})`,
                transformOrigin: "left",
                willChange: "transform",
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1 text-[9px] sm:text-[10px] font-mono text-zinc-400 [@media(max-height:650px)]:hidden">
            <span className="truncate">
              {uiState.duck.state === "SNIFFING_POTTY"
                ? "🚨 TO DOOR!"
                : "Drag to Door"}
            </span>
          </div>
        </div>

        {/* Naughty vs Good Boy Scale */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2.5 sm:p-3.5 backdrop-blur-md [@media(max-height:650px)]:p-1.5">
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono mb-1">
            <span className="text-zinc-400 font-bold flex items-center gap-1 sm:gap-1.5 truncate">
              <IconHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
              <span>Good Boy Scale</span>
            </span>
            <span className="text-amber-300 font-bold shrink-0 ml-1">
              {Math.round(uiState.naughtyVsGood)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(uiState.naughtyVsGood)}
            aria-valuemin={-100}
            aria-valuemax={100}
            aria-label="Naughty versus Good Boy Scale"
            className="w-full bg-zinc-950 rounded-full h-2 sm:h-2.5 overflow-hidden border border-zinc-800 relative"
          >
            <div
              className="h-full w-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 origin-left transform-gpu"
              style={{
                transform: `scaleX(${clamp((uiState.naughtyVsGood + 100) / 200, 0, 1)})`,
                transformOrigin: "left",
                willChange: "transform",
              }}
            />
            {/* Center line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40" />
          </div>
          <div className="flex justify-between items-center mt-1 text-[9px] sm:text-[10px] font-mono">
            <span className="text-rose-400 font-semibold">Naughty</span>
            <span className="text-emerald-400 font-semibold">
              Good Boy (2.5×)
            </span>
          </div>
        </div>
      </div>

      {/* Running Score (#1646): mirrors the sr-only outputs below */}
      <div
        data-testid="duck-hud-score"
        aria-hidden="true"
        className="mb-2 sm:mb-3 flex items-center justify-end gap-3 text-[11px] sm:text-xs font-mono tabular-nums [@media(max-height:650px)]:mb-1.5"
      >
        <span className="min-w-0 text-zinc-400">
          Score{" "}
          <span
            data-testid="duck-hud-score-value"
            className="text-amber-300 font-bold"
          >
            {uiState.totalScore}
          </span>
        </span>
        <span className="min-w-0 text-zinc-400">
          High Score{" "}
          <span
            data-testid="duck-hud-highscore-value"
            className="text-emerald-400 font-bold"
          >
            {displayedHighScore}
          </span>
        </span>
      </div>

      {/* Guided Tutorial Hint Banner */}
      {tutorialHint && (
        <div className="mb-3 px-4 py-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/10 backdrop-blur-md flex items-center gap-2 text-xs font-mono text-brand-cyan animate-fadeIn [@media(max-height:500px)]:hidden">
          <IconInfoCircle className="w-4 h-4 shrink-0" />
          <span>{tutorialHint}</span>
        </div>
      )}

      {/* Main Canvas Screen Container */}
      <div className="relative rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
        <FullscreenButton
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
          variant="floating"
        />
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerCancel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          style={{ touchAction: "none" }}
          role="application"
          aria-label="Workspace Pet Companion Simulator. Focus this container to operate simulator. Press Tab to select items, Arrow keys to drag the duck around the canvas to guide actions like potty and bath, and Q, W, E, R to issue training commands."
          tabIndex={0}
          className={
            isFullscreen
              ? "max-h-[var(--layout-viewport-budget,calc(100dvh-var(--header-height,80px)-var(--layout-dock-height,64px)))] max-h-[calc(100dvh-var(--header-height,80px)-var(--footer-height,48px))] max-w-full aspect-[800/500] object-contain block cursor-crosshair touch-none my-auto mx-auto [@media(max-height:500px)]:max-h-[45dvh] focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              : "w-[min(100%,max(28rem,calc((100dvh-29rem)*1.6)))] mx-auto h-auto aspect-[800/500] cursor-crosshair block touch-none [@media(max-height:500px)]:w-auto [@media(max-height:500px)]:max-w-full [@media(max-height:500px)]:max-h-[52dvh] [@media(max-height:500px)]:mx-auto focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          }
        />

        {/* Start Overlay Screen */}
        {uiState.status === "idle" && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-y-auto">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan mb-2 sm:mb-4 shrink-0">
              <IconBone className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-xl sm:text-3xl font-extrabold font-mono text-white mb-1 sm:mb-2">
              Working With <span className="text-brand-cyan">Duck</span>
            </h2>
            <p className="text-[11px] sm:text-xs font-mono text-amber-300 font-bold mb-1 sm:mb-2">
              {uiState.mode === "endless"
                ? "Endless Mode · High Score Challenge"
                : currentSprint.title}
            </p>
            <p className="max-w-md text-[11px] sm:text-sm text-zinc-300 font-mono mb-4 sm:mb-6 leading-relaxed line-clamp-3 sm:line-clamp-none">
              {uiState.mode === "endless"
                ? "Infinite sprints with accelerating puppy impulses. Keep Duck entertained and protect the codebase!"
                : currentSprint.description}
            </p>
            <p
              data-testid="duck-start-highscore"
              className="-mt-2 mb-4 sm:-mt-3 sm:mb-6 text-[11px] sm:text-xs font-mono tabular-nums text-zinc-400"
            >
              High Score{" "}
              <span className="text-emerald-400 font-bold">
                {displayedHighScore}
              </span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  activeInterruptionsRef.current.clear();
                  wasRunningBeforeInterruptionRef.current = false;
                  applyTransition((state) => ({ ...state, status: "running" }));
                  recordEvent("working-with-duck", "project_click").catch(
                    () => {}
                  );
                }}
                className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-brand-cyan text-black font-mono font-bold text-xs sm:text-sm hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <IconPlayerPlay className="w-4 h-4 fill-current" />
                <span>
                  {uiState.mode === "endless"
                    ? "Start Endless Mode"
                    : `Start Sprint ${uiState.currentLevel}`}
                </span>
              </button>

              <button
                onClick={openScrapbook}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 font-mono text-xs hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <IconBook className="w-4 h-4" />
                <span>Duck Scrapbook</span>
              </button>

              <button
                onClick={openWardrobe}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 font-mono text-xs hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <IconShirt className="w-4 h-4 text-amber-400" />
                <span>Wardrobe</span>
              </button>

              <FieldManualButton
                manualId="working-with-duck"
                label="Manual"
                onOpenChange={handleManualOpenChange}
                isHotkeyOwner={false}
              />
            </div>
          </div>
        )}

        {/* Paused Overlay Screen */}
        {uiState.status === "paused" &&
          isManuallyPaused &&
          !isScrapbookOpen &&
          !isWardrobeOpen &&
          !isManualOpen && (
            <div
              ref={pauseTrapRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="duck-pause-overlay-heading"
              data-testid="duck-pause-overlay"
              className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20 overflow-y-auto"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 sm:mb-4 shrink-0">
                <IconPlayerPause className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h2
                id="duck-pause-overlay-heading"
                className="text-xl sm:text-3xl font-extrabold font-mono text-white mb-1 sm:mb-2"
              >
                {sessionLabel} <span className="text-amber-400">Paused</span>
              </h2>
              <p className="text-[11px] sm:text-xs font-mono text-amber-300 font-bold mb-1 sm:mb-2">
                {uiState.mode === "endless"
                  ? "Endless Mode · Paused"
                  : `Sprint ${uiState.currentLevel} · Paused`}
              </p>
              <p className="max-w-md text-[11px] sm:text-sm text-zinc-300 font-mono mb-4 sm:mb-6 leading-relaxed">
                Duck is taking a quick breather. Press{" "}
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-amber-300 font-mono text-[11px]">
                  P
                </kbd>{" "}
                or click below to resume.
              </p>
              <button
                onClick={toggleManualPause}
                className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-amber-400 text-black font-mono font-bold text-xs sm:text-sm hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(251,191,36,0.4)] flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <IconPlayerPlay className="w-4 h-4 fill-current" />
                <span>Resume {sessionLabel}</span>
              </button>
            </div>
          )}

        {/* Combo Streak Notification Overlay */}
        {uiState.comboStreak >= 2 && (
          <div className="absolute top-4 right-4 z-20 px-3.5 py-1.5 rounded-xl border border-amber-400/40 bg-zinc-900/90 text-amber-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-1.5 animate-pulse">
            <span>⚡ {uiState.comboStreak}× COMBO STREAK</span>
          </div>
        )}

        {/* Skill Toast Easter Egg */}
        {uiState.activeSkillToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl border border-emerald-500/40 bg-zinc-900/90 backdrop-blur-md text-white shadow-2xl flex items-center gap-2.5 animate-bounce">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold uppercase">
              {uiState.activeSkillToast.badge}
            </span>
            <span className="text-xs font-mono text-zinc-300">
              {uiState.activeSkillToast.text}
            </span>
          </div>
        )}
      </div>

      {/* Unified Tactile Action Dock */}
      <div
        data-testid="duck-action-dock"
        className="mt-3 sm:mt-4 flex flex-col gap-2.5 font-mono [@media(max-height:650px)]:mt-1.5 [@media(max-height:650px)]:gap-1.5"
      >
        <span id="duck-paused-reason" className="sr-only">
          {sessionLabel} paused. Press P or Resume {sessionLabel} to continue.
        </span>
        <span id="duck-office-only-reason" className="sr-only">
          Toys and tricks only work in the office. Return to the office to use
          them.
        </span>
        {/* --- MOBILE VIEWPORT CONTROL DECK (<md, or any short/landscape viewport) --- */}
        <div className="flex [@media(min-width:768px)_and_(min-height:560px)]:hidden flex-col gap-2">
          {/* Segmented Switcher Tabs */}
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800 gap-1 text-xs font-bold">
            <button
              onClick={() => setMobileTab("toys")}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                mobileTab === "toys"
                  ? "bg-brand-cyan text-black shadow-md font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>🧸 Toys</span>
              {uiState.duck.state === "NO_TAKE_THROW" && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setMobileTab("tricks")}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                mobileTab === "tricks"
                  ? "bg-brand-cyan text-black shadow-md font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>✨ Tricks</span>
              {uiState.excitement > 80 && (
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setMobileTab("actions")}
              className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                mobileTab === "actions"
                  ? "bg-brand-cyan text-black shadow-md font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span>⚡ Actions</span>
              {(uiState.inDogPark || uiState.inBathtub || uiState.isMuddy) && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Mobile Tab 1: Toys & Treats */}
          {mobileTab === "toys" && (
            <div className="grid grid-cols-2 gap-2 animate-fadeIn">
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "tennis-ball",
                  }));
                }}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "tennis-ball"
                    ? "border-brand-cyan bg-brand-cyan/25 text-brand-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "border-zinc-800 bg-zinc-900/80 text-zinc-300 active:bg-zinc-800"
                }`}
              >
                <IconBallTennis className="w-4 h-4 text-lime-400 shrink-0" />
                <span>Tennis Ball</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "kong",
                  }));
                }}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "kong"
                    ? "border-brand-cyan bg-brand-cyan/25 text-brand-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "border-zinc-800 bg-zinc-900/80 text-zinc-300 active:bg-zinc-800"
                }`}
              >
                <span>🦴 Kong Chew</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "squeaky-toy",
                  }));
                }}
                className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "squeaky-toy"
                    ? "border-brand-cyan bg-brand-cyan/25 text-brand-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "border-zinc-800 bg-zinc-900/80 text-zinc-300 active:bg-zinc-800"
                }`}
              >
                <IconBone className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Squeaky</span>
              </button>

              <button
                disabled={isPlayFrozen}
                aria-describedby={pausedReasonId}
                onClick={handleGiveTreat}
                className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-300 active:bg-amber-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
              >
                <span>🍖 Give Treat</span>
              </button>
            </div>
          )}

          {/* Mobile Tab 2: Training Tricks */}
          {mobileTab === "tricks" && (
            <div className="grid grid-cols-2 gap-2 animate-fadeIn">
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SIT")}
                className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-sky-500/40 bg-sky-500/10 text-sky-300 active:bg-sky-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
              >
                <span>🪑 Sit (Calm)</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("HIGH_FIVE")}
                className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-pink-500/40 bg-pink-500/10 text-pink-300 active:bg-pink-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
              >
                <span>🐾 High Five</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("DROP_IT")}
                className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 active:bg-emerald-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
              >
                <span>✋ Drop It!</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SPIN")}
                className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-purple-500/40 bg-purple-500/10 text-purple-300 active:bg-purple-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-[0.98]"
              >
                <span>🌀 Spin Trick</span>
              </button>
            </div>
          )}

          {/* Mobile Tab 3: Actions & Mini-games */}
          {mobileTab === "actions" && (
            <div className="flex flex-col gap-2 animate-fadeIn">
              {!uiState.inDogPark && !uiState.inBathtub ? (
                <>
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => activeCodeBurst(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed w-full py-3 px-4 rounded-2xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 min-h-[48px] cursor-pointer touch-manipulation select-none"
                  >
                    <IconCode className="w-4 h-4" />
                    <span>Focus Work Sprint</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => enterDogPark(state));
                      }}
                      className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 active:bg-emerald-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95"
                    >
                      <IconTrees className="w-4 h-4" />
                      <span>Dog Park 🌲</span>
                    </button>

                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => enterBathtub(state));
                      }}
                      className={`disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                        uiState.isMuddy
                          ? "border-sky-400 bg-sky-500/20 text-sky-300 animate-pulse"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 active:text-white"
                      }`}
                    >
                      <IconDroplet className="w-4 h-4 text-sky-400" />
                      <span>Bathtub 🛁</span>
                    </button>
                  </div>
                </>
              ) : uiState.inBathtub ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => rinseBathtub(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl bg-sky-500 text-black font-bold text-xs active:bg-sky-400 transition-all flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  >
                    <IconDroplet className="w-4 h-4" />
                    <span>Rinse Spray 🚿</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => exitBathtub(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs active:bg-zinc-800 transition-colors flex items-center justify-center min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95"
                  >
                    <span>Finish Bath →</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => jumpParkHurdle(state));
                      }}
                      className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl bg-amber-400 text-black font-bold text-xs active:bg-amber-300 transition-all flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95 shadow-[0_0_12px_rgba(250,204,21,0.3)]"
                    >
                      <span>🦘 Jump Hurdle</span>
                    </button>

                    <button
                      disabled={isPlayFrozen}
                      aria-describedby={pausedReasonId}
                      onClick={() => {
                        applyTransition((state) => tapParkWhistle(state));
                      }}
                      className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-bold transition-all flex items-center justify-center min-h-[48px] cursor-pointer touch-manipulation select-none active:scale-95"
                    >
                      <span>Whistle 📢</span>
                    </button>
                  </div>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      const isSuccess = uiState.parkState.status === "success";
                      applyTransition((state) => exitDogPark(state, isSuccess));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed w-full py-2.5 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs active:bg-zinc-800 transition-colors flex items-center justify-center min-h-[44px] cursor-pointer touch-manipulation select-none active:scale-95"
                  >
                    <span>Return to Office →</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Meta Controls Strip */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 border-t border-zinc-800/80">
            {renderPauseButton(false)}

            <button
              onClick={openWardrobe}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-amber-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title="Wardrobe"
            >
              <IconShirt className="w-4 h-4" />
            </button>

            <button
              onClick={openScrapbook}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title="Scrapbook"
            >
              <IconBook className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsMusicMuted(!isMusicMuted)}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title={isMusicMuted ? "Unmute Music" : "Mute Music"}
            >
              {isMusicMuted ? (
                <IconMusicOff className="w-4 h-4 text-zinc-500" />
              ) : (
                <IconMusic className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <button
              onClick={() => setMuted(!muted)}
              className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              title={muted ? "Unmute Audio" : "Mute Audio"}
            >
              {muted ? (
                <IconVolumeOff className="w-4 h-4" />
              ) : (
                <IconVolume className="w-4 h-4 text-brand-cyan" />
              )}
            </button>

            <FieldManualButton
              manualId="working-with-duck"
              label="Manual"
              onOpenChange={handleManualOpenChange}
              isHotkeyOwner={true}
            />
            <FullscreenButton
              isFullscreen={isFullscreen}
              onToggle={toggleFullscreen}
              variant="header"
            />
          </div>
        </div>

        {/* --- DESKTOP VIEWPORT HOTBAR (>=md and tall enough to fit 3 rows) --- */}
        <div className="hidden [@media(min-width:768px)_and_(min-height:560px)]:flex flex-col gap-3">
          {/* Desktop Row 1: Toys [1-4] + Tricks [Q-W-E-R] */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Toys & Treats */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "tennis-ball",
                  }));
                }}
                aria-pressed={uiState.selectedItem === "tennis-ball"}
                className={`disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "tennis-ball"
                    ? "border-brand-cyan bg-brand-cyan/20 text-brand-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-white"
                }`}
                title="Throw ball to play fetch & drain Excitement"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-zinc-500">
                  1
                </span>
                <IconBallTennis className="w-3.5 h-3.5 text-lime-400" />
                <span>Tennis Ball</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "kong",
                  }));
                }}
                aria-pressed={uiState.selectedItem === "kong"}
                className={`disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "kong"
                    ? "border-brand-cyan bg-brand-cyan/20 text-brand-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-white"
                }`}
                title="Drop chew toy to distract Duck away from desk hazards"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-zinc-500">
                  2
                </span>
                <span>Kong Chew</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => {
                  applyTransition((state) => ({
                    ...state,
                    selectedItem: "squeaky-toy",
                  }));
                }}
                aria-pressed={uiState.selectedItem === "squeaky-toy"}
                className={`disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                  uiState.selectedItem === "squeaky-toy"
                    ? "border-brand-cyan bg-brand-cyan/20 text-brand-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:text-white"
                }`}
                title="Squeak to instantly get Duck's attention and recall"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-zinc-500">
                  3
                </span>
                <IconBone className="w-3.5 h-3.5" />
                <span>Squeaky</span>
              </button>

              <button
                disabled={isPlayFrozen}
                aria-describedby={pausedReasonId}
                onClick={handleGiveTreat}
                aria-pressed={uiState.selectedItem === "treat"}
                className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/70 text-amber-300 hover:border-amber-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95"
                title="Give treat (trades ball during No Take Only Throw)"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-zinc-500">
                  4
                </span>
                <span>Treat 🍖</span>
              </button>
            </div>

            {/* Training Tricks [Q-W-E-R] */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SIT")}
                className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                title="Command Sit: Calms Excitement (-20) & boosts Good Boy scale"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-sky-400">
                  Q
                </span>
                <span>Sit 🪑</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("HIGH_FIVE")}
                className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border border-pink-500/40 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                title="Command High Five: Morale boost (+45 pts) & tail wag"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-pink-400">
                  W
                </span>
                <span>High Five 🐾</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("DROP_IT")}
                className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                title="Command Drop It: Immediately drops stolen hazards or ball (+60-75 pts)"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-emerald-400">
                  E
                </span>
                <span>Drop It ✋</span>
              </button>

              <button
                disabled={officeOnlyDisabled}
                aria-describedby={officeOnlyReasonId}
                onClick={() => handlePerformTrick("SPIN")}
                className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-[0.98]"
                title="Command Spin: Playful trick (+50 pts) with 360 rotation"
              >
                <span className="px-1 py-0.5 rounded bg-zinc-950 text-[9px] text-purple-400">
                  R
                </span>
                <span>Spin 🌀</span>
              </button>
            </div>
          </div>

          {/* Desktop Row 2: Active Desk Coding + Office Stations + Dog Park + Meta */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Active Action Button */}
            <div className="flex items-center gap-2">
              {!uiState.inDogPark && !uiState.inBathtub ? (
                <button
                  disabled={isPlayFrozen}
                  aria-describedby={pausedReasonId}
                  onClick={() => {
                    applyTransition((state) => activeCodeBurst(state));
                  }}
                  className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400 active:scale-95 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 cursor-pointer touch-manipulation select-none"
                  title="Focus work sprint at desk (Spacebar)"
                >
                  <IconCode className="w-4 h-4" />
                  <span>Focus Work Sprint (Space)</span>
                </button>
              ) : uiState.inBathtub ? (
                <div className="flex items-center gap-2">
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => rinseBathtub(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-sky-500 text-black font-bold text-xs hover:bg-sky-400 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  >
                    <IconDroplet className="w-4 h-4" />
                    <span>Shower Rinse Spray 🚿</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => exitBathtub(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs hover:bg-zinc-800 transition-colors cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
                  >
                    <span>Finish Bath &amp; Return →</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => jumpParkHurdle(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs hover:bg-amber-300 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none shadow-[0_0_12px_rgba(250,204,21,0.3)]"
                  >
                    <span>🦘 Agility Jump (Space)</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => tapParkWhistle(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-bold transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
                  >
                    <span>Whistle 📢</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      const isSuccess = uiState.parkState.status === "success";
                      applyTransition((state) => exitDogPark(state, isSuccess));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200 text-xs hover:bg-zinc-800 transition-colors cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
                  >
                    <span>Return to Office →</span>
                  </button>
                </div>
              )}

              {!uiState.inDogPark && !uiState.inBathtub && (
                <>
                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => enterDogPark(state));
                    }}
                    className="disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95"
                  >
                    <IconTrees className="w-4 h-4" />
                    <span>Dog Park 🌲</span>
                  </button>

                  <button
                    disabled={isPlayFrozen}
                    aria-describedby={pausedReasonId}
                    onClick={() => {
                      applyTransition((state) => enterBathtub(state));
                    }}
                    className={`disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                      uiState.isMuddy
                        ? "border-sky-400 bg-sky-500/20 text-sky-300 animate-pulse"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <IconDroplet className="w-4 h-4 text-sky-400" />
                    <span>Bathtub 🛁</span>
                  </button>
                </>
              )}
            </div>

            {/* Quick Meta Controls */}
            <div className="flex items-center gap-2">
              {renderPauseButton(true)}

              <button
                onClick={openWardrobe}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-amber-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title="Duck Wardrobe & Accessories"
              >
                <IconShirt className="w-4 h-4" />
              </button>

              <button
                onClick={openScrapbook}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title="Duck Scrapbook & Facts"
              >
                <IconBook className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsMusicMuted(!isMusicMuted)}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title={isMusicMuted ? "Unmute Lo-Fi Music" : "Mute Lo-Fi Music"}
              >
                {isMusicMuted ? (
                  <IconMusicOff className="w-4 h-4 text-zinc-500" />
                ) : (
                  <IconMusic className="w-4 h-4 text-emerald-400" />
                )}
              </button>

              <button
                onClick={() => setMuted(!muted)}
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
                title={muted ? "Unmute Audio" : "Mute Audio"}
              >
                {muted ? (
                  <IconVolumeOff className="w-4 h-4" />
                ) : (
                  <IconVolume className="w-4 h-4 text-brand-cyan" />
                )}
              </button>

              <FieldManualButton
                manualId="working-with-duck"
                label="Manual"
                onOpenChange={handleManualOpenChange}
                isHotkeyOwner={true}
              />
              <FullscreenButton
                isFullscreen={isFullscreen}
                onToggle={toggleFullscreen}
                variant="header"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Win / Nap Time Modal */}
      {uiState.status === "won" && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div
            ref={winTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duck-win-dialog-heading"
            className="max-w-lg w-full max-h-[90dvh] overflow-y-auto rounded-3xl border border-brand-cyan/40 bg-zinc-950 p-4 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-center font-mono"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mx-auto flex items-center justify-center mb-3">
              <IconSparkles className="w-6 h-6 sm:w-8 sm:h-8 animate-pulse" />
            </div>

            <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
              {uiState.mode === "endless"
                ? "Endless Milestone"
                : currentSprint.title}{" "}
              Completed!
            </span>

            <h3
              id="duck-win-dialog-heading"
              className="text-xl sm:text-2xl font-bold text-white mt-2 sm:mt-3 mb-1 sm:mb-2"
            >
              Duck is Asleep &amp; Work is Done! 💤
            </h3>

            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Sprint Score:{" "}
              <strong className="text-amber-300 font-bold">
                {uiState.totalScore}
              </strong>{" "}
              · High Score:{" "}
              <strong className="text-brand-cyan">{displayedHighScore}</strong>
            </p>

            {/* Unlocked Polaroid Card */}
            {uiState.latestUnlockedFact && (
              <div className="mb-4 sm:mb-6 rounded-2xl bg-white p-2.5 sm:p-3 shadow-2xl text-black rotate-1 max-w-[220px] sm:max-w-xs mx-auto">
                <div className="relative w-full aspect-[4/3] sm:aspect-square rounded-lg overflow-hidden bg-amber-50 mb-2 border border-zinc-200">
                  <Image
                    src={uiState.latestUnlockedFact.photoUrl}
                    alt={uiState.latestUnlockedFact.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 220px, 320px"
                  />
                </div>
                <h4 className="font-bold text-xs text-zinc-900">
                  {uiState.latestUnlockedFact.title}
                </h4>
                <p className="text-[10px] sm:text-[11px] text-zinc-600 font-sans mt-1 leading-snug line-clamp-3 sm:line-clamp-none">
                  {uiState.latestUnlockedFact.fact}
                </p>
              </div>
            )}

            {/* Progression CTA - Immediate & Prominent on Mobile */}
            <div className="mb-4">
              <button
                onClick={handleAdvanceLevel}
                className="w-full py-3 px-4 rounded-xl bg-brand-cyan text-black font-bold text-xs sm:text-sm hover:bg-white active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer min-h-[44px] touch-manipulation select-none"
              >
                <span>
                  {uiState.currentLevel < 5
                    ? `Proceed to Sprint ${uiState.currentLevel + 1} →`
                    : "Play Endless Mode →"}
                </span>
              </button>
            </div>

            {/* Victory lap: replay or explore */}
            <div className="pt-4 border-t border-zinc-800/80">
              <p className="text-[11px] sm:text-xs text-zinc-300 mb-3 font-sans leading-relaxed">
                Every cable survived, the puppy pads held, and the office budget
                spreadsheet is still unchewed. Duck has earned a nap, and you
                have earned a victory lap.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {uiState.currentLevel < 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      applyTransition((state) => {
                        const next = createInitialDuckGameState(
                          5,
                          "endless",
                          state.unlockedAccessories,
                          state.unlockedFacts
                        );
                        next.status = "running";
                        return next;
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-brand-cyan/20 border border-brand-cyan/50 text-cyan-300 hover:bg-brand-cyan hover:text-black font-bold text-xs transition-all flex items-center gap-1.5 min-h-[40px] cursor-pointer active:scale-[0.98]"
                  >
                    <IconInfinity className="w-3.5 h-3.5" />
                    <span>Play Endless Mode</span>
                  </button>
                )}

                <Link
                  href="/case-studies"
                  className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 text-xs hover:border-zinc-600 transition-colors flex items-center gap-1.5 min-h-[40px]"
                >
                  <IconBriefcase className="w-3.5 h-3.5" />
                  <span>Browse Case Studies</span>
                </Link>

                <a
                  href="https://github.com/fderuiter"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 text-xs hover:border-zinc-600 transition-colors flex items-center gap-1.5 min-h-[40px]"
                >
                  <IconBrandGithub className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fail / Time Out Modal */}
      {uiState.status === "failed" && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div
            ref={failTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duck-fail-dialog-heading"
            className="max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-3xl border border-rose-500/40 bg-zinc-950 p-6 sm:p-8 shadow-[0_0_50px_rgba(244,63,94,0.2)] text-center font-mono"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-4">
              <IconAlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <h3
              id="duck-fail-dialog-heading"
              className="text-xl sm:text-2xl font-bold text-white mb-2"
            >
              Duck Got a Time-Out! 🐾
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-sans">
              Too many sneaky chews and missed potty breaks tilted the scale
              fully red. Take a breath and try again!
            </p>

            <button
              onClick={() => {
                applyTransition(() => {
                  const next = createInitialDuckGameState(
                    uiState.currentLevel,
                    uiState.mode,
                    undefined,
                    uiState.unlockedFacts
                  );
                  next.status = "running";
                  return next;
                });
              }}
              className="w-full py-3 rounded-xl bg-rose-500 text-white font-mono font-bold text-xs sm:text-sm hover:bg-rose-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] touch-manipulation select-none"
            >
              <IconRotate className="w-4 h-4" />
              <span>Retry Sprint {uiState.currentLevel}</span>
            </button>
          </div>
        </div>
      )}

      {/* Accessory Wardrobe Modal */}
      {isWardrobeOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div
            ref={wardrobeTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duck-wardrobe-dialog-heading"
            className="max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6 font-mono relative"
          >
            <button
              onClick={closeWardrobe}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
            >
              <IconX className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4 sm:mb-6">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <IconShirt className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="duck-wardrobe-dialog-heading"
                  className="text-base sm:text-lg font-bold text-white"
                >
                  Duck&apos;s Wardrobe
                </h3>
                <p className="text-[11px] sm:text-xs text-zinc-400">
                  Equip unlocked accessories
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
              {[
                {
                  id: "none",
                  name: "Natural Fluffy Coat",
                  desc: "Pure English Cream marshmallow vibes",
                  icon: "🐾",
                },
                {
                  id: "bucket-hat",
                  name: "Adidas Bucket Hat",
                  desc: "Fact #5 · +10 Charisma & street style",
                  icon: "🧢",
                },
                {
                  id: "bowtie",
                  name: "Tech CEO Bowtie",
                  desc: "+0.2× Multiplier boost for executive standups",
                  icon: "👔",
                },
                {
                  id: "bandana",
                  name: "Adventure Bandana",
                  desc: "Crimson polka-dot outdoor explorer gear",
                  icon: "🧣",
                },
                {
                  id: "rain-boots",
                  name: "Yellow Mud Boots",
                  desc: "100% Mud puddle immunity at the Dog Park!",
                  icon: "🥾",
                },
              ].map((acc) => {
                const isUnlocked = uiState.unlockedAccessories.includes(
                  acc.id as DuckAccessory
                );
                const isSelected = uiState.activeAccessory === acc.id;

                return (
                  <button
                    key={acc.id}
                    disabled={!isUnlocked}
                    onClick={() =>
                      handleEquipAccessory(acc.id as DuckAccessory)
                    }
                    aria-checked={isSelected}
                    role="radio"
                    className={`w-full p-2.5 sm:p-3 rounded-2xl border text-left flex items-center justify-between transition-all min-h-[48px] min-w-[44px] cursor-pointer touch-manipulation select-none active:scale-95 ${
                      isSelected
                        ? "border-brand-cyan bg-brand-cyan/15 text-white shadow-md"
                        : isUnlocked
                          ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                          : "border-zinc-800/50 bg-zinc-900/30 text-zinc-600 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span className="text-xl sm:text-2xl shrink-0">
                        {acc.icon}
                      </span>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-2">
                          <span>{acc.name}</span>
                          {!isUnlocked && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400">
                              Locked
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {acc.desc}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <IconCheck className="w-4 h-4 text-brand-cyan shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Polaroid Scrapbook Modal */}
      {isScrapbookOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div
            ref={scrapbookTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duck-scrapbook-dialog-heading"
            className="max-w-xl w-full max-h-[90dvh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-8 font-mono relative"
          >
            <button
              onClick={closeScrapbook}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
            >
              <IconX className="w-4 h-4" />
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6 pr-8 sm:pr-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                  <IconBook className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    id="duck-scrapbook-dialog-heading"
                    className="text-base sm:text-lg font-bold text-white"
                  >
                    Duck&apos;s Polaroid Scrapbook
                  </h3>
                  <p className="text-[11px] sm:text-xs text-zinc-400">
                    Real puppy milestones &amp; vector art
                  </p>
                </div>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 p-1">
                <button
                  onClick={() => setScrapbookViewMode("photo")}
                  className={`px-2.5 sm:px-3 py-1 min-h-[44px] min-w-[44px] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                    scrapbookViewMode === "photo"
                      ? "bg-brand-cyan text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <IconPhoto className="w-3.5 h-3.5" />
                  <span>Real Photos 📷</span>
                </button>

                <button
                  onClick={() => setScrapbookViewMode("vector")}
                  className={`px-2.5 sm:px-3 py-1 min-h-[44px] min-w-[44px] rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                    scrapbookViewMode === "vector"
                      ? "bg-brand-cyan text-black shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <IconPalette className="w-3.5 h-3.5" />
                  <span>Vector Art 🎨</span>
                </button>
              </div>
            </div>

            {/* Scrapbook Carousel Card */}
            {(() => {
              const currentFact = DUCK_FACTS[activeScrapbookIndex];
              const isUnlocked = uiState.unlockedFacts.includes(
                currentFact.level
              );
              const activeImageSource =
                scrapbookViewMode === "photo"
                  ? currentFact.photoUrl
                  : currentFact.svgUrl;

              return (
                <div className="rounded-2xl bg-white p-3 sm:p-4 text-black shadow-2xl">
                  <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden bg-zinc-100 mb-2.5 sm:mb-3 border border-zinc-200">
                    {isUnlocked ? (
                      <Image
                        src={activeImageSource}
                        alt={currentFact.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 280px, 480px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
                        <IconBone className="w-8 h-8 mb-2 opacity-40" />
                        <span className="text-xs font-mono font-bold">
                          Locked Milestone
                        </span>
                        <span className="text-[10px] font-sans mt-1">
                          Complete Sprint {currentFact.level} to unlock this
                          milestone!
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-900">
                      {isUnlocked
                        ? currentFact.title
                        : `Sprint ${currentFact.level} Secret`}
                    </h4>
                    <span className="text-[10px] font-mono font-bold text-zinc-500">
                      Card {activeScrapbookIndex + 1} of {DUCK_FACTS.length}
                    </span>
                  </div>

                  <p className="text-[11px] sm:text-xs text-zinc-700 font-sans leading-relaxed">
                    {isUnlocked
                      ? currentFact.fact
                      : "Play through the campaign levels to reveal real photos, artwork, and stories about Duck."}
                  </p>

                  {isUnlocked && (
                    <p className="text-[10px] sm:text-[11px] text-zinc-500 italic font-sans mt-1.5 sm:mt-2">
                      &ldquo;{currentFact.caption}&rdquo;
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Carousel Navigation */}
            <div className="mt-3 sm:mt-4 flex items-center justify-between gap-2">
              <button
                disabled={activeScrapbookIndex === 0}
                onClick={() =>
                  setActiveScrapbookIndex((i) => Math.max(0, i - 1))
                }
                className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              >
                ← Prev
              </button>

              <div className="flex gap-1.5 items-center">
                {DUCK_FACTS.map((f, idx) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveScrapbookIndex(idx)}
                    className={`relative min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer touch-manipulation select-none active:scale-95`}
                    aria-label={`Go to card ${idx + 1}`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        activeScrapbookIndex === idx
                          ? "bg-brand-cyan scale-125"
                          : "bg-zinc-800 hover:bg-zinc-600"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <button
                disabled={activeScrapbookIndex === DUCK_FACTS.length - 1}
                onClick={() =>
                  setActiveScrapbookIndex((i) =>
                    Math.min(DUCK_FACTS.length - 1, i + 1)
                  )
                }
                className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation select-none active:scale-95"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen Accessible DOM Fallback Subtree */}
      <div
        className="sr-only"
        aria-label="Working with Duck Accessible Subtree"
      >
        <fieldset>
          <legend>Working with Duck Companion State and Controls</legend>

          <div role="group" aria-label="Duck Companion Telemetry and Status">
            <output htmlFor="duck-score">
              Sprint Score: {uiState.totalScore}
            </output>
            <output htmlFor="duck-highscore">
              High Score: {displayedHighScore}
            </output>
            <output htmlFor="duck-level">
              Sprint Level: {uiState.currentLevel}
            </output>
            <output htmlFor="duck-work">
              Work Progress:{" "}
              {Math.min(
                100,
                Math.round(
                  (uiState.workProgress / uiState.targetWorkProgress) * 100
                )
              )}
              %
            </output>
            <output htmlFor="duck-excitement">
              Excitement: {Math.round(uiState.excitement)}%
            </output>
            <output htmlFor="duck-bladder">
              Bladder: {Math.round(uiState.bladder)}%
            </output>
            <output htmlFor="duck-accessory">
              Equipped Accessory: {uiState.activeAccessory}
            </output>
            <output htmlFor="duck-location">
              Location:{" "}
              {uiState.inBathtub
                ? "Bathtub"
                : uiState.inDogPark
                  ? "Dog Park"
                  : "Office Workspace"}
            </output>
          </div>

          <div role="group" aria-label="Duck Companion Interactive Actions">
            <button
              type="button"
              onClick={() => {
                if (uiState.status === "idle") {
                  applyTransition((state) => ({ ...state, status: "running" }));
                  announce("Started Duck Companion Simulation.", "polite");
                }
              }}
              disabled={uiState.status === "running"}
            >
              Launch Sprint {uiState.currentLevel || 1}
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                handleGiveTreat();
                announce("Gave a delicious treat to the duck.", "polite");
              }}
            >
              Give Treat
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => applySqueakyToy(state, 400, 250));
                announce("Played with squeaky toy.", "polite");
              }}
            >
              Use Squeaky Toy
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => applyKongToy(state, 400, 250));
                announce("Gave Kong toy filled with peanut butter.", "polite");
              }}
            >
              Use Kong Toy
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => scrubBelly(state, 400, 250));
                announce("Gave duck a belly rub.", "polite");
              }}
            >
              Scratch Belly Rub
            </button>

            <button
              type="button"
              disabled={isPlayFrozen}
              onClick={() => {
                applyTransition((state) => activeCodeBurst(state));
                announce("Triggered code burst developer session.", "polite");
              }}
            >
              Trigger Code Burst
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("SIT");
                announce("Commanded duck to Sit.", "polite");
              }}
            >
              Trick: Sit
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("HIGH_FIVE");
                announce("Commanded duck to High Five.", "polite");
              }}
            >
              Trick: High Five
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("DROP_IT");
                announce("Commanded duck to Drop It.", "polite");
              }}
            >
              Trick: Drop It
            </button>

            <button
              type="button"
              disabled={officeOnlyDisabled}
              onClick={() => {
                handlePerformTrick("SPIN");
                announce("Commanded duck to Spin.", "polite");
              }}
            >
              Trick: Spin
            </button>

            {!uiState.inBathtub && (
              <button
                type="button"
                disabled={isPlayFrozen}
                onClick={() => {
                  applyTransition((state) => enterBathtub(state));
                  announce("Entered bathtub for duck bath time.", "polite");
                }}
              >
                Enter Bathtub
              </button>
            )}

            {uiState.inBathtub && (
              <>
                <button
                  type="button"
                  disabled={isPlayFrozen}
                  onClick={() => {
                    applyTransition((state) =>
                      scrubBathtub(state, Date.now(), 1)
                    );
                    announce("Scrubbed duck with soapy bubbles.", "polite");
                  }}
                >
                  Scrub Duck
                </button>
                <button
                  type="button"
                  disabled={isPlayFrozen}
                  onClick={() => {
                    applyTransition((state) => rinseBathtub(state));
                    announce("Rinsed duck with warm water.", "polite");
                  }}
                >
                  Rinse Duck
                </button>
                <button
                  type="button"
                  disabled={isPlayFrozen}
                  onClick={() => {
                    applyTransition((state) => exitBathtub(state));
                    announce("Exited bathtub clean and refreshed.", "polite");
                  }}
                >
                  Exit Bathtub
                </button>
              </>
            )}
          </div>
        </fieldset>
      </div>
    </div>
  );
};
