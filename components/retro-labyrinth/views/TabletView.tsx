"use client";

import React from "react";
import {
  HoldDpad,
  TouchButton,
  TouchControlsGate,
} from "@/components/arcade/mobile";
import { TabletStage } from "@/components/arcade/stage";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useLabyrinthSession } from "@/components/retro-labyrinth/RetroLabyrinthSession";
import {
  LabyrinthLayout,
  type LabyrinthStage,
  type LabyrinthStageParts,
  type LabyrinthStageProps,
} from "@/components/retro-labyrinth/parts/LabyrinthLayout";
import { MARKET_CLOSED_REASON } from "@/components/retro-labyrinth/run-rules";
import {
  PHONE_TOOL_LABELS,
  WEAPON_SHORT_LABELS,
} from "@/components/retro-labyrinth/labels";

/** The short name a touch key shows for the weapon in a loadout slot. */
function toolLabel(
  weaponId: string | undefined,
  weaponName: string | undefined
): string {
  if (!weaponId) return "---";
  return (
    PHONE_TOOL_LABELS[weaponId as keyof typeof PHONE_TOOL_LABELS] ||
    WEAPON_SHORT_LABELS[weaponId as keyof typeof WEAPON_SHORT_LABELS] ||
    weaponName ||
    weaponId
  );
}

/** The room's badge: its number on a run, its subnet in the campaign. */
function useRoomBadge(): string {
  const { gameMode, roomIndex, stage } = useLabyrinthSession().session.view;
  return gameMode === "roguelike"
    ? `ROOM ${String(roomIndex + 1).padStart(2, "0")}`
    : `SUBNET 0${stage}`;
}

/** The tablet's HUD row. The phone has its own (LabyrinthPhoneHud). */
function TabletHud({ parts, optionsButtonRef }: LabyrinthStageProps) {
  const {
    wallShiftLabel,
    playerHp,
    maxPlayerHp,
    gameMode,
    boss,
    score,
    currentRam,
    maxRam,
  } = useLabyrinthSession().session.view;
  const roomBadge = useRoomBadge();
  const threatLevel = parts.threat;
  return (
    <div className="flex h-full w-full min-w-0 items-center gap-2 pl-1 text-xs font-bold">
      <span
        className="shrink-0 text-neutral-300"
        data-testid="labyrinth-phone-floor"
      >
        {roomBadge}
      </span>
      {wallShiftLabel && (
        <span
          className="hidden landscape:min-[700px]:inline shrink-0 text-amber-300"
          data-testid="labyrinth-wall-telegraph-phone"
        >
          {wallShiftLabel}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1">
        <span className="text-neutral-400">HP</span>
        <span className="h-2 w-10 overflow-hidden rounded-full border border-neutral-800 bg-neutral-900">
          <span
            className={`block h-full motion-safe:transition-all motion-safe:duration-200 ${
              playerHp > 50
                ? "bg-emerald-500"
                : playerHp > 25
                  ? "bg-amber-500"
                  : "bg-rose-500"
            }`}
            style={{ width: `${Math.max(0, (playerHp / maxPlayerHp) * 100)}%` }}
          />
        </span>
        <span className="text-neutral-300" data-testid="labyrinth-phone-hp">
          {playerHp}
        </span>
      </span>
      {gameMode === "roguelike" && boss && (
        <span
          className="shrink-0 text-rose-400"
          data-testid="labyrinth-phone-boss"
        >
          BOSS {boss.defeated ? "DOWN" : boss.hp}
        </span>
      )}
      <span className="min-w-0 flex-1" aria-hidden="true" />
      <span
        className="shrink-0 text-zinc-100"
        data-testid="labyrinth-phone-score"
      >
        {score}
      </span>
      <span
        className="flex shrink-0 items-center gap-1"
        data-testid="labyrinth-phone-ram"
      >
        {threatLevel !== "none" && (
          <span
            role="status"
            className={`font-bold uppercase ${
              threatLevel === "red" ? "text-rose-400" : "text-amber-400"
            }`}
          >
            {threatLevel === "red" ? "Patrol adjacent" : "Patrol 2 steps out"}
          </span>
        )}
        <span className="text-slate-400">RAM</span>
        <span className="text-neutral-300">
          {currentRam}/{maxRam}
        </span>
      </span>
      <button
        ref={optionsButtonRef}
        type="button"
        onClick={parts.onOptions}
        aria-expanded={parts.optionsOpen}
        aria-controls="labyrinth-options-sheet"
        className="h-11 shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-bold text-zinc-200 touch-manipulation active:scale-[0.98]"
      >
        Options
      </button>
    </div>
  );
}

/**
 * The portrait tablet's tools. Below 480px each key fills its share of the
 * dock, a size container; from 480px a key is the stage's `--touch-key`.
 */
function PortraitToolGrid({ parts }: { readonly parts: LabyrinthStageParts }) {
  const { session } = useLabyrinthSession();
  const { loadout, weapons, marketOpen } = session.view;
  const { intents } = session;
  return (
    <div
      role="group"
      aria-label="Tools and actions"
      className="grid grid-cols-2 gap-1 portrait:min-[480px]:w-max portrait:min-[480px]:gap-2"
    >
      {[0, 1, 2].map((slotIdx) => {
        const weaponId = loadout[slotIdx];
        // A starter slot holding EMP would duplicate the EMP key, so the key
        // stands for it alone.
        if (weaponId === "emp_blast") return null;
        const weapon = weaponId ? weapons[weaponId] : null;
        const hasAmmo = !!weapon && weapon.ammo > 0;
        const shortLabel = toolLabel(weaponId, weapon?.name);
        return (
          <TouchButton
            key={`tool-${slotIdx}`}
            label={
              hasAmmo
                ? `${shortLabel}: fire tool ${slotIdx + 1}`
                : `${shortLabel}: out of ammo`
            }
            disabled={!hasAmmo}
            onPress={() => intents.fireTool(slotIdx)}
            className="relative flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] flex-col items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-1 text-amber-300 disabled:opacity-40"
          >
            {parts.showKeyHints && (
              <span
                aria-hidden="true"
                className="absolute left-1.5 top-1 text-xs leading-none text-amber-200/80"
              >
                {slotIdx + 1}
              </span>
            )}
            <span className="max-w-full truncate text-xs leading-tight portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)]">
              {shortLabel}
            </span>
          </TouchButton>
        );
      })}
      <TouchButton
        label="EMP: fire an EMP burst"
        onPress={intents.emp}
        className="flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)] font-bold text-slate-200"
      >
        EMP
      </TouchButton>
      <TouchButton
        label="Exploit: cycle to the next tool and fire it"
        onPress={intents.exploit}
        className="flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] items-center justify-center rounded-lg border border-cyan-700/60 bg-cyan-950/50 text-xs portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)] font-bold text-cyan-200"
      >
        EXPLOIT
      </TouchButton>
      <TouchButton
        label={
          marketOpen
            ? "Market: open the darknet market"
            : `Market: ${MARKET_CLOSED_REASON}`
        }
        disabled={!marketOpen}
        onPress={parts.openMarket}
        className="disabled:opacity-40 flex h-11 w-14 portrait:h-[calc((100cqh-0.5rem)/3)] portrait:w-[calc((100cqw-0.25rem)/2)] portrait:min-[480px]:h-[var(--touch-key)] portrait:min-[480px]:w-[var(--touch-key)] items-center justify-center rounded-lg border border-amber-700/50 bg-amber-950/40 text-xs portrait:text-sm portrait:min-[480px]:text-[calc(var(--touch-key)*0.16)] font-bold text-amber-300"
      >
        Market
      </TouchButton>
    </div>
  );
}

/** The route card: the room, its route nodes, the exit and the wall countdown. */
function TabletRouteCard() {
  const { tspNodes, exitLocked, wallShiftLabel } =
    useLabyrinthSession().session.view;
  const roomBadge = useRoomBadge();
  const roomNodes = tspNodes ?? [];
  const routeVisited = roomNodes.filter((node) => node.visited).length;
  return (
    <section
      aria-label="Route"
      data-testid="labyrinth-tablet-route"
      className="flex min-h-0 flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold uppercase tracking-wider text-zinc-400">
          {roomBadge}
        </span>
        {roomNodes.length > 0 && (
          <span className="font-bold text-zinc-300">
            {routeVisited}/{roomNodes.length}
          </span>
        )}
      </div>
      {roomNodes.length > 0 && (
        <ul aria-label="Route nodes" className="grid grid-cols-4 gap-1">
          {roomNodes.map((node, index) => (
            <li
              key={`${node.x},${node.y}`}
              aria-label={`Node ${index + 1} ${node.visited ? "visited" : "not visited"}`}
              className={`flex h-7 items-center justify-center rounded border text-xs font-bold ${
                node.visited
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : "border-zinc-700 text-zinc-400"
              }`}
            >
              {index + 1}
            </li>
          ))}
        </ul>
      )}
      <span
        className={`font-bold uppercase tracking-wider ${
          exitLocked ? "text-rose-400" : "text-emerald-400"
        }`}
      >
        {exitLocked ? "Exit locked" : "Exit open"}
      </span>
      {wallShiftLabel && (
        <span className="font-bold text-amber-300">{wallShiftLabel}</span>
      )}
    </section>
  );
}

/**
 * The objective card: what opens the exit, the boss bar, EMP and the latest
 * tool answer. Portrait shows EMP in the room status above it instead.
 */
function TabletObjectiveCard({
  showEmp,
  toast,
}: {
  readonly showEmp: boolean;
  readonly toast: string | null;
}) {
  const { runComplete, exitLock, gameMode, boss, dronesStunned, weapons } =
    useLabyrinthSession().session.view;
  const empWeapon = weapons.emp_blast;
  return (
    <section
      aria-label="Objective"
      data-testid="labyrinth-tablet-objective"
      className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-xs"
    >
      {!runComplete && (
        <p className="line-clamp-3 font-bold text-zinc-300">
          <span className="text-amber-400">OBJECTIVE</span>{" "}
          {exitLock.locked ? exitLock.objective : "Reach the exit"}
        </p>
      )}
      {gameMode === "roguelike" && boss && (
        <div
          className="flex flex-col gap-1"
          data-testid="labyrinth-tablet-boss"
        >
          <div className="flex items-center justify-between gap-2 font-bold">
            <span className="text-rose-400">BOSS</span>
            <span className="text-zinc-200">
              {boss.defeated ? "DOWN" : `${boss.hp}/${boss.maxHp}`}
            </span>
          </div>
          <span className="block h-2 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
            <span
              className="block h-full bg-rose-500 motion-safe:transition-[width] motion-safe:duration-200"
              style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
            />
          </span>
          {!boss.defeated && boss.phaseTitle && (
            <span className="truncate text-zinc-400">{boss.phaseTitle}</span>
          )}
        </div>
      )}
      {showEmp && (
        <span
          className={`${dronesStunned ? "text-cyan-300" : "text-amber-300"}`}
        >
          {empWeapon && empWeapon.maxAmmo >= 999
            ? `EMP ∞ · ${empWeapon.ramCost ?? 0} RAM`
            : `EMP ${empWeapon?.ammo ?? 0}/${empWeapon?.maxAmmo ?? 0}`}
          {dronesStunned ? " · stunned" : ""}
        </span>
      )}
      {toast && (
        <p className="line-clamp-2 text-amber-200" aria-hidden="true">
          {toast}
        </p>
      )}
    </section>
  );
}

const TABLET_KEY_CLASS =
  "relative flex h-12 w-full flex-col items-center justify-center rounded-lg border px-1 text-xs font-bold disabled:opacity-40";

/** The landscape tablet's tools: all five slots, EMP, Exploit and Market. */
function TabletToolGrid({ openMarket }: { readonly openMarket: () => void }) {
  const { session } = useLabyrinthSession();
  const { loadout, weapons, marketOpen } = session.view;
  const { intents } = session;
  return (
    <div
      role="group"
      aria-label="Tools and actions"
      className="grid grid-cols-[repeat(4,minmax(3rem,auto))] gap-1"
    >
      {[0, 1, 2, 3, 4].map((slotIdx) => {
        const weaponId = loadout[slotIdx];
        const weapon = weaponId ? weapons[weaponId] : null;
        const hasAmmo = !!weapon && weapon.ammo > 0;
        const shortLabel = toolLabel(weaponId, weapon?.name);
        // The name starts with the key's visible text, so speech input can say
        // what it reads.
        let label = `T${slotIdx + 1}: tool ${slotIdx + 1} is empty`;
        if (weaponId) {
          label = hasAmmo
            ? `T${slotIdx + 1} ${shortLabel}: fire tool ${slotIdx + 1}`
            : `T${slotIdx + 1} ${shortLabel}: tool ${slotIdx + 1} is out of ammo`;
        }
        return (
          <TouchButton
            key={`tablet-tool-${slotIdx}`}
            label={label}
            disabled={!hasAmmo}
            onPress={() => intents.fireTool(slotIdx)}
            className={`${TABLET_KEY_CLASS} border-zinc-700 bg-zinc-900 text-amber-300`}
          >
            <span className="leading-none text-amber-200/80">
              T{slotIdx + 1}
            </span>{" "}
            <span className="max-w-full truncate leading-tight">
              {shortLabel}
            </span>
          </TouchButton>
        );
      })}
      <TouchButton
        label="EMP: fire an EMP burst"
        onPress={intents.emp}
        className={`${TABLET_KEY_CLASS} border-slate-700 bg-slate-900 text-slate-200`}
      >
        EMP
      </TouchButton>
      <TouchButton
        label="Exploit: cycle to the next tool and fire it"
        onPress={intents.exploit}
        className={`${TABLET_KEY_CLASS} border-cyan-700/60 bg-cyan-950/50 text-cyan-200`}
      >
        EXPLOIT
      </TouchButton>
      <TouchButton
        label={
          marketOpen
            ? "Market: open the darknet market"
            : `Market: ${MARKET_CLOSED_REASON}`
        }
        disabled={!marketOpen}
        onPress={openMarket}
        className={`${TABLET_KEY_CLASS} border-amber-700/50 bg-amber-950/40 text-amber-300`}
      >
        MARKET
      </TouchButton>
    </div>
  );
}

/**
 * The tablet stage (#2358). Landscape (#2860): the route over the d-pad, the
 * maze, and the objective over the tools, one column each side. Portrait
 * (#2861): the maze takes the first full-width row at its own height, the
 * room panel the next, and the movement and tool docks share the rest, so
 * the controls sit under the thumbs. Each portrait dock is a size container
 * below 480px, so its keys scale to fill it. From 480px a key is at most a
 * third of half the screen, so the d-pad fits its column on an iPad mini
 * and a left hand's mirrored d-pad stays on screen (#2862). The stage
 * mirrors the docks for left-handed players.
 */
function TabletLayoutStage({ parts, optionsButtonRef }: LabyrinthStageProps) {
  const { intents } = useLabyrinthSession().session;
  const portrait = useMediaQuery("(orientation: portrait)");
  return (
    <TabletStage
      hud={<TabletHud parts={parts} optionsButtonRef={optionsButtonRef} />}
      portraitFill="dock"
      // The playfield already pads 4px, which the toolbar inset counts too.
      className="[--arcade-stage-edge:4px]"
      classNames={{
        hud: "border-b border-neutral-900/60",
        body: "portrait:min-[480px]:pb-[max(0.75rem,env(safe-area-inset-bottom))] portrait:min-[480px]:[--touch-key:clamp(80px,min(16vw,calc((50vw_-_2rem)/3)),120px)]",
        // The room panel shows on a portrait screen 480px wide or more.
        status: "hidden portrait:min-[480px]:block",
        moveDock:
          "portrait:grid portrait:grid-cols-1 portrait:grid-rows-1 portrait:[container-type:size] portrait:min-[480px]:self-end portrait:min-[480px]:justify-items-start portrait:min-[480px]:[container-type:normal]",
        actionDock:
          "portrait:h-full portrait:items-center portrait:justify-center portrait:[container-type:size] portrait:min-[480px]:h-auto portrait:min-[480px]:self-end portrait:min-[480px]:items-end portrait:min-[480px]:[container-type:normal]",
      }}
      moveDock={
        portrait ? (
          <TouchControlsGate>
            <HoldDpad
              onMove={intents.move}
              large
              paused={parts.controlsPaused}
            />
          </TouchControlsGate>
        ) : (
          // Landscape: each column is a card on top and its keys in the
          // bottom corner, under a thumb. Keys are 48px.
          <div className="flex min-h-0 w-[13.25rem] flex-1 flex-col justify-between gap-2 pb-3">
            <TabletRouteCard />
            <div className="flex justify-start">
              <TouchControlsGate>
                <HoldDpad onMove={intents.move} paused={parts.controlsPaused} />
              </TouchControlsGate>
            </div>
          </div>
        )
      }
      status={
        portrait ? (
          <div className="flex min-h-0 flex-col gap-2">
            {parts.roomPanel}
            <div className="grid min-h-0 grid-cols-2 gap-2">
              <TabletRouteCard />
              <TabletObjectiveCard showEmp={false} toast={parts.toast} />
            </div>
          </div>
        ) : (
          parts.roomPanel
        )
      }
      actionDock={
        portrait ? (
          <TouchControlsGate>
            <PortraitToolGrid parts={parts} />
          </TouchControlsGate>
        ) : (
          <div className="flex min-h-0 w-[14.5rem] flex-1 flex-col justify-between gap-2 pb-3">
            <TabletObjectiveCard showEmp toast={parts.toast} />
            <div className="flex justify-end">
              <TouchControlsGate>
                <TabletToolGrid openMarket={parts.openMarket} />
              </TouchControlsGate>
            </div>
          </div>
        )
      }
    >
      {parts.maze}
    </TabletStage>
  );
}

/**
 * The tablet's stage for the shared layout: a portrait maze takes the full
 * width at its own 5:3 shape, so the docks get the height below it.
 */
const TABLET_STAGE: LabyrinthStage = {
  mazeClassName:
    "portrait:w-full portrait:aspect-[5/3] portrait:h-auto portrait:flex-none",
  orientationHint: true,
  Stage: TabletLayoutStage,
};

/**
 * Retro Labyrinth's tablet view (ADR 0062, #2859). The cabinet picks it for
 * a coarse pointer with room to spare, so it lays out the touch cabinet on
 * its own tablet stage (#2860, #2861, #2967) and reads no device.
 */
export function TabletView({
  isMounted = true,
}: {
  readonly isMounted?: boolean;
}) {
  return <LabyrinthLayout isMounted={isMounted} touchStage={TABLET_STAGE} />;
}
