"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  TouchButton,
  TouchControlsGate,
  useCabinetTouch,
} from "@/components/arcade/mobile";
import {
  ActionCluster,
  DOCK_KEY_CLASS,
  DpadDock,
} from "@/components/arcade/mobile/docks";
import { BottomSheet } from "@/components/arcade/mobile/ui";
import { PhoneStage } from "@/components/arcade/stage";
import {
  ActionSinkProvider,
  type ActionDefinition,
  type ActionMap,
} from "@/lib/arcade";
import {
  LABYRINTH_ACTIONS,
  type LabyrinthActionName,
} from "@/lib/retro-labyrinth/actions";
import type { Weapon, WeaponId } from "@/lib/dungeon";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";
import {
  LabyrinthLayout,
  type LabyrinthStage,
  type LabyrinthStageProps,
} from "@/components/retro-labyrinth/parts/LabyrinthLayout";
import { LabyrinthPhoneHud } from "@/components/retro-labyrinth/parts/LabyrinthPhoneHud";
import { useDockSizeForPhone } from "@/components/retro-labyrinth/parts/phone-dock-size";
import {
  PHONE_TOOL_LABELS,
  WEAPON_SHORT_LABELS,
} from "@/components/retro-labyrinth/labels";
import { MARKET_CLOSED_REASON } from "@/components/retro-labyrinth/run-rules";

/** The phone d-pad's arrows, each one of the map's move actions (#2919). */
const PHONE_DPAD_ACTIONS = {
  up: "move-up",
  down: "move-down",
  left: "move-left",
  right: "move-right",
} as const satisfies Record<string, LabyrinthActionName>;

/** One loadout slot as a touch key shows it. */
interface ToolSlot {
  readonly weaponId: WeaponId | undefined;
  /** The short name on the key, or "---" for an empty slot. */
  readonly label: string;
  readonly hasAmmo: boolean;
}

function toolSlot(
  loadout: readonly WeaponId[],
  weapons: Readonly<Record<WeaponId, Weapon>>,
  slotIdx: number
): ToolSlot {
  const weaponId = loadout[slotIdx];
  const weapon = weaponId ? weapons[weaponId] : null;
  return {
    weaponId,
    label: weaponId
      ? PHONE_TOOL_LABELS[weaponId] ||
        WEAPON_SHORT_LABELS[weaponId] ||
        weapon?.name ||
        weaponId
      : "---",
    hasAmmo: !!weapon && weapon.ammo > 0,
  };
}

/**
 * The action map the phone docks name their keys from (#2919): the game's
 * own map, with each tool named for the class's loadout and the EMP key
 * short enough for a 44px key.
 */
function phoneActionMap(
  slots: readonly ToolSlot[]
): ActionMap<LabyrinthActionName> {
  const actions: Record<LabyrinthActionName, ActionDefinition> = {
    ...LABYRINTH_ACTIONS.actions,
  };
  slots.forEach((slot, slotIdx) => {
    const action = `tool-${slotIdx + 1}` as LabyrinthActionName;
    actions[action] = { ...actions[action], label: slot.label };
  });
  actions.emp = { ...actions.emp, label: "EMP" };
  return { ...LABYRINTH_ACTIONS, actions };
}

/**
 * The phone's HUD has no room for the wall countdown, so it sits on the maze
 * where the toast does while no toast is up (#2918).
 */
function PhoneWallTelegraph({ toast }: { readonly toast: string | null }) {
  const { wallShiftLabel } = useLabyrinthSession().session.view;
  if (!wallShiftLabel || toast) return null;
  return (
    <div
      data-testid="labyrinth-wall-telegraph-phone"
      className="pointer-events-none absolute bottom-2 left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2 rounded border border-amber-500/40 bg-zinc-950/90 px-3 py-1 text-center text-xs font-bold text-amber-300"
    >
      {wallShiftLabel}
    </div>
  );
}

/**
 * The phone stage (#2918): the HUD row over the d-pad column, the maze and
 * the tool column. The phone only plays landscape (it asks a portrait phone
 * to turn), and the stage mirrors the columns for left-handed players. The
 * maze takes the largest 5:3 box between the columns.
 */
function PhoneLayoutStage({ parts, optionsButtonRef }: LabyrinthStageProps) {
  const { view, intents } = useLabyrinthSession().session;
  const { gameStatus, loadout, weapons, marketOpen } = view;
  const dockSize = useDockSizeForPhone();
  const toolSlots = useMemo(
    () => [0, 1, 2, 3, 4].map((slot) => toolSlot(loadout, weapons, slot)),
    [loadout, weapons]
  );
  const phoneActions = useMemo(() => phoneActionMap(toolSlots), [toolSlots]);

  // The More sheet (#2919) holds tools 4 and 5 and the Market. A pick there
  // waits for the sheet's pause to lift, so it acts on the running room
  // rather than the paused one.
  const [moreOpen, setMoreOpen] = useState(false);
  const pendingMoreRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (moreOpen || gameStatus !== "playing") return;
    const pending = pendingMoreRef.current;
    pendingMoreRef.current = null;
    pending?.();
  }, [moreOpen, gameStatus]);
  // Picks in the More sheet close it first; the pick runs once the room
  // plays again.
  const pickFromMore = (pick: () => void) => {
    pendingMoreRef.current = pick;
    setMoreOpen(false);
  };

  // The action column (#2919): the class's first three tools and EMP in a
  // thumb arc, then Exploit and More. A starter slot holding EMP would
  // duplicate the EMP key, so the key stands for it alone. Each key sends its
  // action through the stage's action sink, named from the action map.
  const clusterActions: LabyrinthActionName[] = [
    ...toolSlots
      .slice(0, 3)
      .flatMap((slot, slotIdx) =>
        slot.weaponId && slot.weaponId !== "emp_blast"
          ? [`tool-${slotIdx + 1}` as LabyrinthActionName]
          : []
      ),
    "emp",
  ];
  const clusterDisabled: Partial<Record<LabyrinthActionName, boolean>> =
    Object.fromEntries(
      toolSlots
        .slice(0, 3)
        .map((slot, slotIdx) => [`tool-${slotIdx + 1}`, !slot.hasAmmo])
    );
  const keyClass = DOCK_KEY_CLASS[dockSize];

  return (
    // The docks send their actions to the same handler the keys and the
    // gamepad use (#2919).
    <ActionSinkProvider actions={LABYRINTH_ACTIONS} onAction={parts.onAction}>
      <PhoneStage
        orientation="landscape"
        // The playfield already pads 4px, which the toolbar inset counts too.
        className="[--arcade-stage-edge:4px]"
        hud={
          <LabyrinthPhoneHud
            optionsButtonRef={optionsButtonRef}
            optionsOpen={parts.optionsOpen}
            onOptions={parts.onOptions}
          />
        }
        // The controls sit in a gate: a keyboard hides them, a touch brings
        // them back (ADR 0061).
        moveDock={
          <TouchControlsGate>
            {/* The keys follow the device's key size; a held arrow repeats
                at 220ms, then every 140ms. */}
            <DpadDock
              map={phoneActions}
              actions={PHONE_DPAD_ACTIONS}
              size={dockSize}
              paused={parts.controlsPaused || moreOpen}
            />
          </TouchControlsGate>
        }
        actionDock={
          <TouchControlsGate>
            <div className="flex flex-col items-center gap-1">
              <ActionCluster
                map={phoneActions}
                actions={clusterActions}
                disabled={clusterDisabled}
                size={dockSize}
              />
              <div className="flex gap-1">
                <TouchButton
                  action="exploit"
                  label={phoneActions.actions.exploit.label}
                  className={`${keyClass} flex items-center justify-center rounded-xl border border-cyan-700/60 bg-cyan-950/50 text-xs font-bold text-cyan-200`}
                >
                  {phoneActions.actions.exploit.label}
                </TouchButton>
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={moreOpen}
                  className={`${keyClass} flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-200 touch-manipulation active:scale-[0.98]`}
                >
                  More
                </button>
              </div>
            </div>
          </TouchControlsGate>
        }
      >
        {parts.maze}
      </PhoneStage>
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        initialSnap="half"
        testId="labyrinth-more-sheet"
      >
        <div className="grid grid-cols-3 gap-2 font-mono">
          {[3, 4].map((slotIdx) => {
            const slot = toolSlots[slotIdx];
            // The name starts with the key's visible text, so speech input
            // can say what it reads.
            const key = `T${slotIdx + 1} ${slot.label}`;
            let label = `${key}: tool ${slotIdx + 1} is empty`;
            if (slot.weaponId) {
              label = slot.hasAmmo
                ? `${key}: fire tool ${slotIdx + 1}`
                : `${key}: tool ${slotIdx + 1} is out of ammo`;
            }
            return (
              <button
                key={`more-tool-${slotIdx}`}
                type="button"
                aria-label={label}
                disabled={!slot.hasAmmo}
                onClick={() => pickFromMore(() => intents.fireTool(slotIdx))}
                className="flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs font-bold text-amber-300 touch-manipulation active:scale-[0.98] disabled:opacity-40"
              >
                <span className="text-amber-200/80">T{slotIdx + 1}</span>{" "}
                <span className="max-w-full truncate">{slot.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-label={
              marketOpen
                ? "Market: open the darknet market"
                : `Market: ${MARKET_CLOSED_REASON}`
            }
            disabled={!marketOpen}
            onClick={() => pickFromMore(parts.openMarket)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-amber-700/50 bg-amber-950/40 px-2 text-xs font-bold text-amber-300 touch-manipulation active:scale-[0.98] disabled:opacity-40"
          >
            {phoneActions.actions.market.label}
          </button>
        </div>
        {!marketOpen && (
          <p className="mt-2 text-xs text-zinc-400">{MARKET_CLOSED_REASON}</p>
        )}
      </BottomSheet>
    </ActionSinkProvider>
  );
}

/**
 * The phone's stage for the shared layout. The maze fills the box between
 * the columns, the backing store stops at 2x to save the phone's fill rate,
 * and the phone asks to turn rather than showing the orientation hint.
 */
const PHONE_STAGE: LabyrinthStage = {
  mazeClassName: "",
  maxDpr: 2,
  orientationHint: false,
  MazeOverlay: PhoneWallTelegraph,
  Stage: PhoneLayoutStage,
};

/**
 * Retro Labyrinth's phone view (ADR 0062, #2917). The cabinet picks it for a
 * phone-sized screen, and on a touch cabinet it plays on the phone stage: a
 * one-row HUD over the d-pad column, the maze and the tool column (#2918).
 * A phone-sized window worked with a mouse is not a touch cabinet, so it
 * reads the cabinet's touch state and keeps the desktop controls there; the
 * three-view guard allow-lists it for that.
 */
export function PhoneView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  const touch = useCabinetTouch();
  return (
    <LabyrinthLayout
      isMounted={isMounted}
      touchStage={touch ? PHONE_STAGE : undefined}
    />
  );
}
