"use client";

import { createContext, useContext } from "react";
import {
  usePickPlace,
  type PickPlace,
} from "@/components/arcade/mobile/usePickPlace";
import type { ChipKind } from "@/lib/protocol-drift";
import { useProtocolDriftStore } from "./store";
import { canRewire } from "./touch-wire";

/** Where a picked chip goes: its top-left corner in canvas (flow) coordinates. */
interface ChipSpot {
  x: number;
  y: number;
}

/** The toolbox chip in hand on the touch cabinet, shared by toolbox and canvas. */
export type ChipPick = PickPlace<ChipKind, ChipSpot>;

/**
 * Null outside the workbench, so a toolbox or canvas rendered on its own (in
 * a test) has no pick and keeps tap-to-add.
 */
export const ChipPickContext = createContext<ChipPick | null>(null);

/** The chip pick of the surrounding workbench, or null. */
export function useChipPickContext(): ChipPick | null {
  return useContext(ChipPickContext);
}

const chipLabel = (kind: ChipKind) => `${kind} chip`;
const canvasLabel = () => "the canvas";

/**
 * Touch replacement for dragging a chip out of the toolbox, which HTML5 drag
 * cannot do on a touch screen (#2360). A long-press on a toolbox chip picks
 * it and a tap on the canvas places it there; tapping the chip again or
 * Escape puts it back. Desktop keeps its drag.
 *
 * @returns The pick state for the workbench to share through `ChipPickContext`.
 */
export function useChipPick(): ChipPick {
  return usePickPlace<ChipKind, ChipSpot>({
    itemLabel: chipLabel,
    slotLabel: canvasLabel,
    canPlace: () =>
      canRewire(useProtocolDriftStore.getState().snapshot?.fsmState),
    onPlace: (kind, spot) => {
      void useProtocolDriftStore.getState().addChip(kind, spot);
    },
  });
}
