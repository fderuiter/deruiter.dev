import { CHIP_SPECS, type ChipKind } from "@/lib/protocol-drift";

/**
 * Why a wire between two pins is refused, in the player's words (#2167):
 * the pins carry different data, or the wire would run back up across the
 * Conservation Wall.
 */
export function wireRefusal(
  sourceKind: ChipKind,
  sourceHandle: string,
  targetKind: ChipKind,
  targetHandle: string
): string {
  const out = CHIP_SPECS[sourceKind].outputs.find(
    (port) => port.handle === sourceHandle
  );
  const inp = CHIP_SPECS[targetKind].inputs.find(
    (port) => port.handle === targetHandle
  );
  const names = `${sourceKind}.${sourceHandle} to ${targetKind}.${targetHandle}`;
  if (!out || !inp) return `Can't wire ${names}: wire an output to an input.`;
  if (out.type !== inp.type)
    return `Can't wire ${names}: it sends ${out.type} data and the pin takes ${inp.type}.`;
  return `Can't wire ${names}: data only flows down across the Conservation Wall.`;
}
