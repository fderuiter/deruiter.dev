import {
  CHIP_SPECS,
  isWireCompatible,
  type ChipKind,
} from "@/lib/protocol-drift";
import { useProtocolDriftStore } from "./store";

/** One output port wired to one input port (#2045 tap-to-wire). */
export interface WirePair {
  sourceHandle: string;
  targetHandle: string;
}

/** States in which the pipeline may be rewired (the clock is paused). */
const REWIRABLE = new Set([
  "DRAFT",
  "VALIDATE",
  "DEPLOY_READY",
  "PAUSED",
  "WAVE_REVIEW",
]);

/** True when a wire may be started or finished in this FSM state (#2045). */
export function canRewire(fsm: string | undefined): boolean {
  return fsm !== undefined && REWIRABLE.has(fsm);
}

/** The pair list split into same-name pairs and the rest. */
export interface GroupedWirePairs {
  matching: WirePair[];
  other: WirePair[];
}

/** Same-name pairs (sbp to sbp) come first; the rest are kept apart. */
export function groupTouchWirePairs(pairs: WirePair[]): GroupedWirePairs {
  return {
    matching: pairs.filter((p) => p.sourceHandle === p.targetHandle),
    other: pairs.filter((p) => p.sourceHandle !== p.targetHandle),
  };
}

/**
 * Every output-to-input pair the canvas would accept between two chips. The
 * canvas's isValidConnection asks the same question, so a tap-wired pair is
 * always a pair a drag could have made.
 */
export function touchWirePairs(source: ChipKind, target: ChipKind): WirePair[] {
  const pairs: WirePair[] = [];
  for (const output of CHIP_SPECS[source].outputs) {
    for (const input of CHIP_SPECS[target].inputs) {
      if (isWireCompatible(source, output.handle, target, input.handle)) {
        pairs.push({
          sourceHandle: output.handle,
          targetHandle: input.handle,
        });
      }
    }
  }
  return pairs;
}

/** Connects one pair through the store, then reports the result. */
async function connectPair(
  sourceId: string,
  targetId: string,
  pair: WirePair
): Promise<void> {
  const store = useProtocolDriftStore.getState();
  const source = store.nodes.find((n) => n.id === sourceId);
  const target = store.nodes.find((n) => n.id === targetId);
  store.setWireSheet(null);
  store.setWireFrom(null);
  const ok = await store.connect({
    source: sourceId,
    target: targetId,
    sourceHandle: pair.sourceHandle,
    targetHandle: pair.targetHandle,
  });
  const names = `${source?.data.kind ?? "chip"}.${pair.sourceHandle} to ${target?.data.kind ?? "chip"}.${pair.targetHandle}`;
  store.notify(
    ok ? "info" : "warn",
    ok ? `Wired ${names}.` : `Could not wire ${names}.`
  );
}

/**
 * Handles a tap on a second chip while a wire is started. One valid pair is
 * wired at once; none is reported; several open the pair list.
 */
export async function resolveTouchWire(
  sourceId: string,
  targetId: string
): Promise<void> {
  const store = useProtocolDriftStore.getState();
  const source = store.nodes.find((n) => n.id === sourceId);
  const target = store.nodes.find((n) => n.id === targetId);
  if (!source || !target) {
    store.setWireFrom(null);
    return;
  }
  const pairs = touchWirePairs(source.data.kind, target.data.kind);
  if (pairs.length === 0) {
    store.setWireFrom(null);
    store.notify(
      "warn",
      `No wire can run from ${source.data.kind} to ${target.data.kind}.`
    );
    return;
  }
  if (pairs.length === 1) {
    await connectPair(sourceId, targetId, pairs[0]);
    return;
  }
  store.setWireFrom(sourceId);
  store.setWireSheet({ source: sourceId, target: targetId });
  store.notify(
    "info",
    `Choose a wire from ${source.data.kind} to ${target.data.kind}.`
  );
}

/** Wires the pair the player picked from the pair list. */
export function pickTouchWire(
  sourceId: string,
  targetId: string,
  pair: WirePair
): Promise<void> {
  return connectPair(sourceId, targetId, pair);
}
