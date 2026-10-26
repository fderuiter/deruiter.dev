"use client";

import { useId } from "react";
import { IconArrowRight, IconRefresh, IconTrophy } from "@tabler/icons-react";
import type {
  RouteMapRoom,
  RouteMapStep,
  RouteTier,
  RunReward,
} from "@/lib/dungeon";

/** The route map and the next-room choice (#2084). */
interface RouteChoiceProps {
  readonly seed: string;
  readonly map: readonly RouteMapStep[];
  readonly options: readonly RouteMapRoom[];
  /** Library position of the chosen next room. */
  readonly selected: number | undefined;
  readonly onSelect: (libraryIndex: number) => void;
}

/** The 1-of-3 reward pick (#2084). */
interface RewardChoiceProps {
  readonly offer: readonly RunReward[];
  /** Index of the picked reward; null takes none. */
  readonly selected: number | null;
  readonly onSelect: (index: number | null) => void;
  /** True once Enter was pressed with nothing picked (#2177). */
  readonly prompt?: boolean;
  /**
   * Why each offer cannot be taken, by offer index, such as "HP full" for a
   * Patch Kit at full HP (#2291); null or missing means it can be taken.
   */
  readonly unavailable?: readonly (string | null)[];
}

/** What the run-complete card reports about the whole run (#2291). */
interface RunSummary {
  /** The short name of each room played, in order. */
  readonly roomNames: readonly string[];
  /** HP lost across the run, retries included. */
  readonly damageTaken: number;
  /** The run's time, formatted, or null when it was not timed. */
  readonly runTime: string | null;
}

interface RoomClearedCardProps {
  readonly isFinalRoom: boolean;
  readonly campaignRoomCount: number;
  readonly runMoves: ReadonlyArray<number>;
  readonly runCrypto: number;
  readonly movesCount: number;
  readonly roomCrypto: number;
  readonly score: number;
  readonly highScore: number;
  readonly showNextRoom: boolean;
  readonly hint: string;
  readonly onNextRoom: () => void;
  readonly onRestart: () => void;
  readonly route?: RouteChoiceProps;
  readonly rewards?: RewardChoiceProps;
  /** A class this room unlocked, if any (#2085). */
  readonly notice?: string | null;
  /** Opens the between-runs Firmware Bay; shown when the run is over. */
  readonly onFirmware?: () => void;
  /** The run's figures, shown on the run-complete card. */
  readonly summary?: RunSummary;
}

const TIER_LABELS: Record<RouteTier, string> = {
  opening: "Opening",
  middle: "Middle",
  rest: "Rest stop · Market",
  boss: "Boss",
};

const REWARD_KIND_LABELS: Record<RunReward["kind"], string> = {
  weapon: "Weapon",
  heal: "Heal",
  passive: "Passive",
};

const roomNumber = (step: number) => `R${String(step + 1).padStart(2, "0")}`;

const CHOICE_CLASS =
  "flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-lg border px-2 py-1 text-left text-xs motion-safe:transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
const CHOICE_ON = "border-amber-500/70 bg-amber-500/15 text-amber-200";
const CHOICE_OFF =
  "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500";

/** The run's rooms as a line of steps: cleared, here, the choice, then ahead. */
function RouteMap({ seed, map }: Pick<RouteChoiceProps, "seed" | "map">) {
  return (
    <div className="w-full max-w-md mt-1.5">
      <p className="text-xs uppercase tracking-widest text-zinc-500 font-mono">
        Route map · seed{" "}
        <span className="text-zinc-300" data-testid="labyrinth-run-seed">
          {seed}
        </span>
      </p>
      <ol
        aria-label="Route map"
        className="mt-1 flex flex-wrap justify-center gap-1 font-mono text-xs"
      >
        {map.map((step) => {
          const names =
            step.rooms.length > 0
              ? step.rooms.map((room) => room.name).join(" / ")
              : "?";
          const tone =
            step.state === "current"
              ? "border-emerald-500/50 text-emerald-300"
              : step.state === "choice"
                ? "border-amber-500/50 text-amber-200"
                : step.state === "cleared"
                  ? "border-zinc-800 text-zinc-500"
                  : "border-zinc-800 text-zinc-400";
          const status =
            step.state === "current"
              ? "cleared, you are here"
              : step.state === "choice"
                ? "next, your choice"
                : step.state === "cleared"
                  ? "cleared"
                  : "ahead";
          return (
            <li
              key={step.step}
              className={`min-w-0 rounded border px-1.5 py-0.5 break-words ${tone}`}
            >
              <span>
                {roomNumber(step.step)} {names}
              </span>
              <span className="sr-only">, {status}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The card shown when a room is cleared. A roguelike run shows its route map,
 * offers a choice of next rooms and a 1-of-3 reward pick (#2084); the last
 * room ends the run. Its buttons are at least 44px on a coarse pointer, and
 * the picks are toggle buttons reachable by Tab and read with their state.
 *
 * @param props - The run figures, the next-action flags and the two actions.
 * @returns The overlay card.
 */
export function RoomClearedCard({
  isFinalRoom,
  campaignRoomCount,
  runMoves,
  runCrypto,
  movesCount,
  roomCrypto,
  score,
  highScore,
  showNextRoom,
  hint,
  onNextRoom,
  onRestart,
  route,
  rewards,
  notice,
  onFirmware,
  summary,
}: RoomClearedCardProps) {
  const routeHeadingId = useId();
  const rewardHeadingId = useId();
  const chosenRoom = route?.options.find(
    (room) => room.libraryIndex === route.selected
  );
  const chosenReward =
    rewards && rewards.selected !== null
      ? rewards.offer[rewards.selected]
      : undefined;
  return (
    <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-sm overflow-y-auto overscroll-contain rounded-lg border border-zinc-700 z-30">
      <div className="min-h-full flex flex-col items-center justify-center text-center p-3">
        {/* The trophy sits beside the title rather than above it, so the
            card fits a 1024x768 board without a scroll (#2291). */}
        <h2 className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-widest">
          <IconTrophy className="w-4 h-4 shrink-0" aria-hidden="true" />
          {isFinalRoom ? "RUN COMPLETE" : "MAINFRAME TIER BREACHED"}
        </h2>
        {isFinalRoom && (
          <p className="text-xs text-neutral-400 mt-0.5">
            All {campaignRoomCount} rooms cleared.
          </p>
        )}
        {isFinalRoom ? (
          <>
            <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
              Run total:{" "}
              <span className="font-bold text-zinc-100">
                {runMoves.reduce((a, b) => a + b, 0)}
              </span>{" "}
              moves. Crypto earned:{" "}
              <span className="font-bold text-amber-400">+{runCrypto}</span>
            </p>
            {summary && (
              <p
                className="text-xs text-neutral-400 font-mono tabular-nums"
                data-testid="labyrinth-run-stats"
              >
                Damage taken:{" "}
                <span className="font-bold text-zinc-100">
                  {summary.damageTaken} HP
                </span>
                {summary.runTime && (
                  <>
                    {" "}
                    · Run time:{" "}
                    <span className="font-bold text-zinc-100">
                      {summary.runTime}
                    </span>
                  </>
                )}
              </p>
            )}
            <p
              className="text-xs text-neutral-400 font-mono tabular-nums"
              data-testid="labyrinth-run-rooms"
            >
              {runMoves
                .map((moves, i) => {
                  const name = summary?.roomNames[i];
                  return `${roomNumber(i)}${name ? ` ${name}` : ""} ${moves}`;
                })
                .join(" · ")}
            </p>
          </>
        ) : (
          <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
            This room:{" "}
            <span className="font-bold text-zinc-100">{movesCount}</span> moves.
            Crypto earned:{" "}
            <span className="font-bold text-amber-400">+{roomCrypto}</span>
          </p>
        )}
        {/* "Final" only once the run is over (#2291). */}
        <p className="text-xs text-neutral-400">
          {isFinalRoom ? "Final Score" : "Score"}:{" "}
          <span className="font-bold text-zinc-100">{score}</span>
          {isFinalRoom && (
            <>
              {" "}
              · High Score:{" "}
              <span className="font-bold text-amber-400">{highScore}</span>
            </>
          )}
        </p>
        {notice && (
          <p
            className="text-xs font-bold text-amber-300 mt-1"
            data-testid="labyrinth-unlock-notice"
          >
            🔓 {notice}
          </p>
        )}
        {showNextRoom && route && (
          <RouteMap seed={route.seed} map={route.map} />
        )}
        {showNextRoom && route && route.options.length > 0 && (
          <div
            role="group"
            aria-labelledby={routeHeadingId}
            className="w-full max-w-md mt-1.5"
          >
            <h3
              id={routeHeadingId}
              className="text-xs font-bold uppercase tracking-widest text-zinc-400"
            >
              {route.options.length > 1 ? "Choose the next room" : "Next room"}
            </h3>
            <div className="mt-1 flex gap-1.5">
              {route.options.map((room) => {
                const on = room.libraryIndex === route.selected;
                return (
                  <button
                    key={room.libraryIndex}
                    type="button"
                    aria-pressed={on}
                    onClick={(e) => {
                      e.stopPropagation();
                      route.onSelect(room.libraryIndex);
                    }}
                    className={`${CHOICE_CLASS} ${on ? CHOICE_ON : CHOICE_OFF}`}
                  >
                    <span className="font-bold break-words">{room.name}</span>
                    <span className="text-xs text-zinc-400">
                      {TIER_LABELS[room.tier]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {showNextRoom && rewards && (
          <div
            role="group"
            aria-labelledby={rewardHeadingId}
            data-testid="labyrinth-reward-pick"
            className="@container w-full max-w-md mt-1.5"
          >
            <h3
              id={rewardHeadingId}
              className="text-xs font-bold uppercase tracking-widest text-zinc-400"
            >
              Pick a reward
            </h3>
            <div className="mt-1 grid grid-cols-1 gap-1.5 @sm:grid-cols-3">
              {rewards.offer.map((reward, i) => {
                const on = rewards.selected === i;
                // A reward that would be wasted, such as a Patch Kit at full
                // HP, is greyed out and says why (#2291).
                const reason = rewards.unavailable?.[i] ?? null;
                return (
                  <button
                    key={`${reward.kind}-${reward.name}`}
                    type="button"
                    aria-pressed={on}
                    disabled={reason !== null && !on}
                    onClick={(e) => {
                      e.stopPropagation();
                      rewards.onSelect(on ? null : i);
                    }}
                    className={`${CHOICE_CLASS} ${on ? CHOICE_ON : CHOICE_OFF} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-zinc-700`}
                  >
                    <span className="text-xs uppercase tracking-wider text-zinc-400">
                      {REWARD_KIND_LABELS[reward.kind]}
                    </span>
                    <span className="font-bold break-words">{reward.name}</span>
                    <span className="text-xs text-zinc-400 break-words">
                      {reason ?? reward.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {showNextRoom && (route || rewards) && (
          <p
            className="text-xs text-neutral-400 mt-1.5"
            data-testid="labyrinth-next-pick"
          >
            Next: {chosenRoom ? chosenRoom.name : "the next room"} · Reward:{" "}
            {chosenReward ? chosenReward.name : "none"}
          </p>
        )}
        {showNextRoom && rewards?.prompt && rewards.selected === null && (
          <p
            className="text-xs font-bold text-amber-300 mt-1"
            data-testid="labyrinth-reward-prompt"
          >
            Pick a reward, or press Enter again to skip it.
          </p>
        )}
        <div className="flex gap-2 mt-1.5">
          {showNextRoom ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNextRoom();
              }}
              className="inline-flex items-center gap-1 min-h-11 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md [@media(pointer:fine)]:min-h-0"
            >
              <span>Next Room</span>
              <IconArrowRight className="w-3 h-3" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRestart();
              }}
              className="inline-flex items-center gap-1 min-h-11 px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 text-neutral-200 hover:text-amber-300 text-xs font-bold rounded-lg transition-all cursor-pointer [@media(pointer:fine)]:min-h-0"
            >
              <IconRefresh className="w-3 h-3" aria-hidden="true" />
              {isFinalRoom ? "New Run" : "Play Again"}
            </button>
          )}
          {onFirmware && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFirmware();
              }}
              className="inline-flex items-center gap-1 min-h-11 px-3 py-1 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-lg transition-all cursor-pointer [@media(pointer:fine)]:min-h-0"
            >
              Firmware Upgrades
            </button>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1">{hint}</p>
      </div>
    </div>
  );
}
