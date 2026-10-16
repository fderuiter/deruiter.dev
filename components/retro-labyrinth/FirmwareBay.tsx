"use client";

import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import { IconCpu } from "@tabler/icons-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  FIRMWARE_MAX_TIER,
  FIRMWARE_UPGRADES,
  firmwareTierCost,
  type FirmwareTiers,
  type FirmwareUpgradeId,
} from "@/lib/dungeon";

interface FirmwareBayProps {
  /** Crypto banked on the profile across runs. */
  readonly bankedCrypto: number;
  /** The tiers the profile owns. */
  readonly firmware: FirmwareTiers;
  readonly onBuy: (id: FirmwareUpgradeId) => void;
  readonly onClose: () => void;
}

/**
 * The between-runs firmware shop as a modal dialog (#2085). It spends the
 * profile's banked crypto on the four firmware tracks; each track shows its
 * tier as text and as filled pips, so the state never rests on colour alone.
 *
 * @param props - The banked crypto, owned tiers and the two actions.
 * @returns The dialog.
 */
export function FirmwareBay({
  bankedCrypto,
  firmware,
  onBuy,
  onClose,
}: FirmwareBayProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, {
    initialFocusRef: closeRef,
    onEscape: onClose,
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      data-testid="labyrinth-firmware-bay"
      className="absolute inset-0 bg-neutral-950/98 backdrop-blur-md flex flex-col items-center justify-between p-2.5 rounded-lg border border-zinc-700 z-40"
    >
      <div className="w-full flex flex-wrap justify-between items-center gap-1 text-xs font-bold text-amber-300 border-b border-zinc-800 pb-1">
        <h2 id={titleId} className="flex items-center gap-1 text-xs font-bold">
          <IconCpu className="w-3.5 h-3.5" aria-hidden="true" />
          <span>FIRMWARE BAY</span>
        </h2>
        <span data-testid="labyrinth-banked-crypto">
          🪙 {bankedCrypto} Crypto Banked
        </span>
      </div>
      <p className="w-full text-[11px] text-neutral-400 mt-1">
        Upgrades are permanent and apply from your next run. Every room banks
        all the crypto it earned, whatever you spent at the Market.
      </p>

      <ul
        aria-label="Firmware upgrades"
        className="w-full flex-1 min-h-0 my-1 grid grid-cols-1 content-start gap-1 overflow-y-auto pr-1 [@media(pointer:coarse)_and_(orientation:landscape)]:grid-cols-2"
      >
        {FIRMWARE_UPGRADES.map((upgrade) => {
          const tier = firmware[upgrade.id];
          const cost = firmwareTierCost(firmware, upgrade.id);
          const maxed = cost === null;
          const affordable = !maxed && bankedCrypto >= cost;
          return (
            <li
              key={upgrade.id}
              className="flex min-w-0 items-center justify-between gap-1 p-1 bg-neutral-900/80 border border-neutral-800 rounded text-xs"
            >
              <div className="flex items-center gap-1 min-w-0">
                <span aria-hidden="true">{upgrade.icon}</span>
                <div className="min-w-0">
                  <div className="text-neutral-200 font-bold">
                    {upgrade.name}{" "}
                    <span className="font-mono text-neutral-300">
                      Tier {tier}/{FIRMWARE_MAX_TIER}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-neutral-400">
                    <span aria-hidden="true" className="font-mono">
                      {"■".repeat(tier)}
                      {"□".repeat(FIRMWARE_MAX_TIER - tier)}
                    </span>
                    <span className="min-w-0 break-words">
                      {upgrade.perTier}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onBuy(upgrade.id)}
                disabled={!affordable}
                aria-label={
                  maxed
                    ? `${upgrade.name} is at its top tier`
                    : `Buy ${upgrade.name} tier ${tier + 1} for ${cost} crypto`
                }
                className="shrink-0 min-h-11 min-w-11 px-2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 disabled:opacity-40 font-bold cursor-pointer whitespace-nowrap [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 [@media(pointer:fine)]:py-0.5"
              >
                {maxed ? "Maxed" : `🪙 ${cost}`}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="w-full min-h-11 py-0.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded text-xs font-bold cursor-pointer [@media(pointer:fine)]:min-h-0"
      >
        Close Firmware Bay
      </button>
    </div>
  );
}
