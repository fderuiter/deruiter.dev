"use client";

import React from "react";
import {
  IconBolt,
  IconClock,
  IconCoffee,
  IconSparkles,
} from "@tabler/icons-react";
import { TouchControlsGate } from "@/components/arcade/mobile";
import {
  getPowerUpRefusal,
  POWER_UP_REFUSAL_LABELS,
} from "@/lib/clinical-trial-chaos";
import type {
  CDISCDomain,
  ClinicalSubject,
  PowerUpInventory,
  PowerUpType,
  StationConfig,
} from "@/lib/clinical-trial-chaos/types";

/** The four lifelines in key order (Q, W, E, R). */
const LIFELINES: ReadonlyArray<{
  type: PowerUpType;
  /** The name on the key; the full name is its accessible name. */
  short: string;
  icon: React.ReactNode;
}> = [
  {
    type: "fda-coffee-break",
    short: "Coffee Break",
    icon: <IconCoffee className="cc-dock-icon" aria-hidden="true" />,
  },
  {
    type: "auto-clean",
    short: "Auto-Clean",
    icon: <IconSparkles className="cc-dock-icon" aria-hidden="true" />,
  },
  {
    type: "query-extension",
    short: "Query Ext.",
    icon: <IconClock className="cc-dock-icon" aria-hidden="true" />,
  },
  {
    type: "fast-sign",
    short: "Fast-Track",
    icon: <IconBolt className="cc-dock-icon" aria-hidden="true" />,
  },
];

interface ChaosTouchDockProps {
  /** The active stations in key order, so the first is key 1. */
  stations: readonly StationConfig[];
  /** The open dossier, or null when the queue is empty. */
  activeSubject: ClinicalSubject | null;
  /** Stations whose data the open dossier matches. */
  matchingDomains: readonly CDISCDomain[];
  /** True once every flagged field on the open dossier is fixed. */
  readyToRoute: boolean;
  /** The station a dispatch just reached, for the flash. */
  flashStationId: CDISCDomain | null;
  /** The station a GCP spot inspection is watching, if any. */
  watchedStationId: CDISCDomain | null;
  powerUps: PowerUpInventory;
  onRoute: (domain: CDISCDomain) => void;
  onLifeline: (type: PowerUpType) => void;
}

/**
 * The on-screen keys of the Clinical Trial Chaos touch cabinet (#2105): a key
 * for every station (1 to 8, as many as the phase has opened) and for the four
 * lifelines (Q, W, E, R). The same buttons the desktop floor keeps in its
 * station strip and its side rail, moved to the bottom edge where a thumb
 * rests. The dock sits inside the game's keyboard boundary, so the 1 to 8 and
 * Q W E R keys keep working beside it, and it hides while a keyboard is in use
 * and returns on the next touch (`TouchControlsGate`).
 *
 * A key acts when the tap completes rather than when it lands. A station key
 * can open the signature dialog, and a press that opened a dialog under the
 * finger would let the lift land on one of its buttons. Keys keep the board's
 * focus, so Enter and Space stay the game's next-step keys after a tap.
 *
 * @param props - The shift state and the handlers for each key.
 * @returns The dock.
 */
export function ChaosTouchDock({
  stations,
  activeSubject,
  matchingDomains,
  readyToRoute,
  flashStationId,
  watchedStationId,
  powerUps,
  onRoute,
  onLifeline,
}: ChaosTouchDockProps) {
  return (
    <TouchControlsGate>
      <div
        role="group"
        aria-label="Clinical Trial Chaos touch controls"
        data-testid="cc-touch-dock"
        className="cc-dock"
      >
        <div
          role="group"
          aria-label="Route to station"
          data-testid="cc-dock-stations"
          className="cc-dock-stations"
          style={{
            gridTemplateColumns: `repeat(${stations.length}, minmax(0, 1fr))`,
          }}
        >
          {stations.map((station, index) => {
            const matches =
              !!activeSubject && matchingDomains.includes(station.id);
            const accepts = matches && readyToRoute;
            const state = accepts
              ? "accepts"
              : matches
                ? "fix"
                : activeSubject
                  ? "other"
                  : "idle";
            return (
              <button
                key={station.id}
                type="button"
                aria-label={`Station ${index + 1}: ${station.label}${
                  watchedStationId === station.id
                    ? ", watched by the FDA investigator"
                    : ""
                }`}
                aria-keyshortcuts={String(index + 1)}
                data-state={state}
                data-flash={flashStationId === station.id ? "true" : "false"}
                data-watched={
                  watchedStationId === station.id ? "true" : "false"
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onRoute(station.id)}
                className="cc-key cc-station min-h-12"
              >
                <span
                  aria-hidden="true"
                  className="cc-station-bar"
                  style={{ backgroundColor: station.color }}
                />
                <span aria-hidden="true" className="cc-station-top">
                  <span className="cc-key-num">{index + 1}</span>
                  <span className="cc-station-id">{station.id}</span>
                </span>
                <span aria-hidden="true" className="cc-station-state">
                  {accepts
                    ? "Accepts ✓"
                    : matches
                      ? "Fix first"
                      : activeSubject
                        ? "Other"
                        : "Idle"}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="group"
          aria-label="Lifelines"
          data-testid="cc-dock-lifelines"
          className="cc-dock-lifelines"
        >
          {LIFELINES.map(({ type, short, icon }) => {
            const p = powerUps[type];
            const ready = p.charge >= p.maxCharge;
            const active = p.activeSecondsRemaining > 0;
            const refusal = getPowerUpRefusal(
              powerUps,
              type,
              true,
              activeSubject
            );
            const blocked =
              refusal === "nothing_to_clean" || refusal === "no_dossier"
                ? POWER_UP_REFUSAL_LABELS[refusal]
                : null;
            const status = active
              ? `${Math.ceil(p.activeSecondsRemaining)}s`
              : blocked
                ? blocked
                : ready
                  ? "Ready"
                  : `${p.charge}/${p.maxCharge}`;
            return (
              <button
                key={type}
                type="button"
                aria-label={`Lifeline ${p.hotkey}: ${p.name}, ${status}`}
                aria-keyshortcuts={p.hotkey}
                disabled={refusal !== null}
                data-state={active ? "active" : ready ? "ready" : "charging"}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onLifeline(type)}
                className="cc-key cc-lifeline min-h-12"
              >
                <span
                  aria-hidden="true"
                  className="cc-lifeline-fill"
                  style={{
                    transform: `scaleX(${Math.min(1, p.charge / p.maxCharge)})`,
                  }}
                />
                {icon}
                <span aria-hidden="true" className="cc-lifeline-text">
                  <span className="cc-lifeline-name">
                    <span className="cc-key-num">{p.hotkey}</span>
                    <span className="cc-lifeline-label">{short}</span>
                  </span>
                  <span className="cc-lifeline-status">{status}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </TouchControlsGate>
  );
}
