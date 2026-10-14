"use client";

import React from "react";
import { IconCrosshair, IconSparkles } from "@tabler/icons-react";
import { TouchButton, TouchControlsGate } from "@/components/arcade/mobile";
import type { LaserType } from "@/lib/laser-loon";

/** The four optics in key order, as the dock lays them out. */
const OPTICS: ReadonlyArray<{
  type: LaserType;
  key: string;
  label: string;
  tone: string;
}> = [
  { type: "ruby-laser", key: "1", label: "Ruby", tone: "ll-tone-ruby" },
  { type: "cyan-pulse", key: "2", label: "Pulse", tone: "ll-tone-pulse" },
  { type: "aurora-wave", key: "3", label: "Aurora", tone: "ll-tone-aurora" },
  { type: "ice-cannon", key: "4", label: "Cryo", tone: "ll-tone-cryo" },
];

interface LoonTouchControlsProps {
  laserType: LaserType;
  /** Tremolo charge, 0 to 100. */
  energyPercent: number;
  /** True when the Tremolo can be spent: a full meter, or the sandbox. */
  tremoloReady: boolean;
  /** True while a run is being played, so the Fire key shows it is live. */
  live: boolean;
  onSelectLaser: (type: LaserType) => void;
  onFirePress: () => void;
  onFireRelease: () => void;
  onTremolo: () => void;
}

/**
 * The on-screen controls of the Laser Loon touch cabinet (#2081): the four
 * optics (keys 1 to 4), the Loon Tremolo and a Fire key that is held to shoot.
 *
 * Fire is its own control rather than a side effect of touching the arena.
 * One finger on the arena only aims and steers; the other thumb holds Fire.
 * That way a drag to dodge never shoots at the wrong place, a tap to aim never
 * wastes a Cryo-Mortar, and the beam can sweep across a boss while the aiming
 * finger moves. Every key is at least 56px, past the cabinet's 44px floor. The
 * controls hide while a keyboard is in use and return on the next touch.
 *
 * @param props - The game's state and handlers.
 * @returns The dock.
 */
export const LoonTouchControls: React.FC<LoonTouchControlsProps> = ({
  laserType,
  energyPercent,
  tremoloReady,
  live,
  onSelectLaser,
  onFirePress,
  onFireRelease,
  onTremolo,
}) => (
  <TouchControlsGate>
    <div
      role="group"
      aria-label="Laser Loon touch controls"
      data-testid="loon-touch-controls"
      className="ll-dock"
    >
      <div role="group" aria-label="Optics" className="ll-dock-optics">
        {OPTICS.map((optic) => (
          <TouchButton
            key={optic.type}
            label={`Optic ${optic.key}: ${optic.label}`}
            aria-pressed={laserType === optic.type}
            haptic={false}
            onPress={() => onSelectLaser(optic.type)}
            className={`ll-key ll-optic ${optic.tone}`}
          >
            <span aria-hidden="true" className="ll-optic-key">
              {optic.key}
            </span>
            <span aria-hidden="true">{optic.label}</span>
          </TouchButton>
        ))}
      </div>

      <div className="ll-dock-actions">
        <TouchButton
          label={
            tremoloReady
              ? "Loon Tremolo, ready"
              : `Loon Tremolo, ${Math.round(energyPercent)} percent charged`
          }
          disabled={!tremoloReady}
          onPress={onTremolo}
          data-ready={tremoloReady ? "true" : "false"}
          className="ll-key ll-tremolo"
        >
          <span
            aria-hidden="true"
            className="ll-tremolo-fill"
            style={{
              transform: `scaleX(${Math.min(100, energyPercent) / 100})`,
            }}
          />
          <IconSparkles className="ll-key-icon" aria-hidden="true" />
          <span aria-hidden="true" className="ll-tremolo-text">
            <span>Tremolo</span>
            <span>
              {tremoloReady ? "Ready" : `${Math.round(energyPercent)}%`}
            </span>
          </span>
        </TouchButton>

        <TouchButton
          label="Fire (hold)"
          onPress={onFirePress}
          onRelease={onFireRelease}
          data-live={live ? "true" : "false"}
          className="ll-key ll-fire"
        >
          <IconCrosshair className="ll-key-icon" aria-hidden="true" />
          <span aria-hidden="true">Fire</span>
        </TouchButton>
      </div>
    </div>
  </TouchControlsGate>
);
