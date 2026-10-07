import { createStore, type StoreApi } from "zustand/vanilla";
import {
  DEFAULT_SHIFT_CONFIG,
  EVENT_CAPTIONS,
  LOOK_PRESETS,
  aimLook,
  applyAction,
  createLook,
  createShift,
  describeOrder,
  getHeadsetLine,
  getKdsBand,
  getManagerLine,
  getOrderAge,
  isShiftOver,
  stepLook,
  stepShift,
  type LookInput,
  type LookPreset,
  type LookState,
  type ShiftAction,
  type ShiftEvent,
  type ShiftScenarioConfig,
  type ShiftState,
} from "@/lib/patty-drive-thru";

/** Who a caption comes from, which sets its style and audio channel. */
export type CaptionSpeaker = "headset" | "manager" | "coworker" | "booth";

interface BoothCaption {
  /** Increments with every caption, so the same text can show twice. */
  readonly id: number;
  readonly speaker: CaptionSpeaker;
  readonly text: string;
  /** Shift time when the caption appeared. */
  readonly at: number;
}

type BoothPhase = "intro" | "shift" | "ended";

export interface BoothState {
  readonly phase: BoothPhase;
  readonly shift: ShiftState;
  readonly look: LookState;
  /** True while the register is zoomed in and has the keyboard. */
  readonly registerOpen: boolean;
  readonly caption: BoothCaption | null;
  /** The latest screen-reader announcement. */
  readonly announcement: string;
  /** Increments on every manager yell, for the cabinet's loud moment. */
  readonly yells: number;
  /** Order ids already announced as late, so each is announced once. */
  readonly lateAnnounced: readonly number[];
}

export interface BoothActions {
  /** Starts a fresh shift from the diary intro or the end screen. */
  clockIn: (config?: Partial<ShiftScenarioConfig>) => void;
  /** Goes back to the diary intro. */
  backToIntro: () => void;
  /** Advances the shift clock. */
  tick: (dtSec: number) => void;
  /** Applies one player action. */
  act: (action: ShiftAction) => void;
  /** Advances the head with the input gathered since the last frame. */
  moveHead: (input: LookInput, dtSec: number) => void;
  /** Points the head at a preset. */
  aim: (preset: LookPreset) => void;
  /** Zooms into the register, or back out to the booth. */
  setRegisterOpen: (open: boolean) => void;
  /** Listens for every one-shot shift event; returns an unsubscribe. */
  onEvents: (listener: (events: readonly ShiftEvent[]) => void) => () => void;
}

export type BoothStore = StoreApi<BoothState & BoothActions>;

const CAPTION_PRIORITY: Partial<Record<ShiftEvent["type"], number>> = {
  "manager-yell": 6,
  "order-expired": 5,
  locked: 4,
  "drink-dropped": 4,
  "wrong-entry": 3,
  "coworker-ready": 3,
  "order-arrived": 2,
  bumped: 1,
  "drink-reentered": 1,
  wiped: 1,
};

function captionFor(
  event: ShiftEvent,
  shift: ShiftState
): { speaker: CaptionSpeaker; text: string } | null {
  switch (event.type) {
    case "order-arrived":
      return {
        speaker: "headset",
        text: getHeadsetLine(shift.config.seed, event.orderId),
      };
    case "manager-yell":
      return {
        speaker: "manager",
        text: getManagerLine(shift.config.seed, shift.tallies.yells),
      };
    case "order-expired":
      return { speaker: "booth", text: EVENT_CAPTIONS.orderExpired };
    case "locked":
      return { speaker: "booth", text: EVENT_CAPTIONS.locked };
    case "drink-dropped":
      return { speaker: "booth", text: EVENT_CAPTIONS.drinkDropped };
    case "drink-reentered":
      return { speaker: "booth", text: EVENT_CAPTIONS.drinkReentered };
    case "coworker-ready":
      return { speaker: "coworker", text: EVENT_CAPTIONS.coworkerReady };
    case "wrong-entry":
      return {
        speaker: "booth",
        text:
          event.nodeId === "bump"
            ? EVENT_CAPTIONS.notReady
            : EVENT_CAPTIONS.wrongEntry,
      };
    case "bumped":
      return {
        speaker: "booth",
        text:
          event.band === "red"
            ? EVENT_CAPTIONS.bumpedLate
            : EVENT_CAPTIONS.bumped,
      };
    case "wiped":
      return { speaker: "booth", text: EVENT_CAPTIONS.wiped };
    default:
      return null;
  }
}

/** The single most important caption among a batch of events. */
function pickCaption(
  events: readonly ShiftEvent[],
  shift: ShiftState
): { speaker: CaptionSpeaker; text: string } | null {
  let best: ShiftEvent | null = null;
  for (const event of events) {
    const rank = CAPTION_PRIORITY[event.type] ?? 0;
    if (rank > 0 && (!best || rank >= (CAPTION_PRIORITY[best.type] ?? 0))) {
      best = event;
    }
  }
  return best ? captionFor(best, shift) : null;
}

/** What a screen reader hears for a batch of events. */
function announce(events: readonly ShiftEvent[], shift: ShiftState): string {
  const parts: string[] = [];
  for (const event of events) {
    if (event.type === "order-arrived") {
      const order = shift.orders.find((o) => o.id === event.orderId);
      if (order)
        parts.push(`New car, order ${order.id}: ${describeOrder(order)}.`);
    } else if (event.type === "shift-ended") {
      parts.push("The shift is over.");
    } else {
      const caption = captionFor(event, shift);
      if (caption) parts.push(caption.text);
    }
  }
  return parts.join(" ");
}

function lateOrders(shift: ShiftState): number[] {
  return shift.orders
    .filter((order) => getKdsBand(getOrderAge(shift, order)) === "red")
    .map((order) => order.id);
}

/**
 * Creates the booth's store. The engine owns the rules; the store holds the
 * current shift, the player's head and the captions, and turns engine events
 * into captions, announcements and audio cues. Each cabinet mount gets its
 * own store, so tests and remounts never share a shift.
 */
export function createBoothStore(
  config: Partial<ShiftScenarioConfig> = DEFAULT_SHIFT_CONFIG
): BoothStore {
  const listeners = new Set<(events: readonly ShiftEvent[]) => void>();
  let captionId = 0;
  let baseConfig = config;

  return createStore<BoothState & BoothActions>()((set, get) => {
    const absorb = (shift: ShiftState, events: readonly ShiftEvent[]) => {
      const state = get();
      const caption = pickCaption(events, shift);
      let announcement = events.length > 0 ? announce(events, shift) : "";
      const open = new Set(shift.orders.map((o) => o.id));
      const known = state.lateAnnounced.filter((id) => open.has(id));
      const newlyLate = lateOrders(shift).filter((id) => !known.includes(id));
      if (newlyLate.length > 0) {
        announcement = [
          announcement,
          ...newlyLate.map((id) => `Order ${id} is in the red.`),
        ]
          .filter(Boolean)
          .join(" ");
      }
      const yelled = events.some((e) => e.type === "manager-yell");
      set({
        shift,
        phase: isShiftOver(shift) ? "ended" : state.phase,
        registerOpen: isShiftOver(shift) ? false : state.registerOpen,
        caption: caption
          ? { id: (captionId += 1), at: shift.time, ...caption }
          : state.caption,
        announcement: announcement || state.announcement,
        yells: yelled ? state.yells + 1 : state.yells,
        lateAnnounced:
          newlyLate.length > 0 || known.length !== state.lateAnnounced.length
            ? [...known, ...newlyLate]
            : state.lateAnnounced,
      });
      if (events.length > 0) {
        for (const listener of listeners) listener(events);
      }
    };

    return {
      phase: "intro",
      shift: createShift(baseConfig),
      look: createLook(),
      registerOpen: false,
      caption: null,
      announcement: "",
      yells: 0,
      lateAnnounced: [],

      clockIn: (next) => {
        if (next) baseConfig = { ...baseConfig, ...next };
        set({
          phase: "shift",
          shift: createShift(baseConfig),
          look: createLook(),
          registerOpen: false,
          caption: null,
          announcement: "Clocked in. The headset is on.",
          yells: 0,
          lateAnnounced: [],
        });
      },

      backToIntro: () => set({ phase: "intro", registerOpen: false }),

      tick: (dtSec) => {
        const state = get();
        if (state.phase !== "shift") return;
        const result = stepShift(state.shift, dtSec);
        if (result.state === state.shift) return;
        absorb(result.state, result.events);
      },

      act: (action) => {
        const state = get();
        if (state.phase !== "shift") return;
        const result = applyAction(state.shift, action);
        if (result.state === state.shift) return;
        if (action.type === "flagCoworker") {
          set({
            caption: {
              id: (captionId += 1),
              speaker: "coworker",
              text: EVENT_CAPTIONS.coworkerFlagged,
              at: state.shift.time,
            },
            announcement: EVENT_CAPTIONS.coworkerFlagged,
          });
        }
        absorb(result.state, result.events);
      },

      moveHead: (input, dtSec) => {
        const current = get().look;
        const next = stepLook(current, input, dtSec);
        if (
          next.yaw !== current.yaw ||
          next.pitch !== current.pitch ||
          next.targetYaw !== current.targetYaw ||
          next.targetPitch !== current.targetPitch
        ) {
          set({ look: next });
        }
      },

      aim: (preset) => set({ look: aimLook(get().look, preset) }),

      setRegisterOpen: (open) => {
        const state = get();
        if (state.registerOpen === open) return;
        set({
          registerOpen: open,
          look: aimLook(
            state.look,
            open ? LOOK_PRESETS.register : LOOK_PRESETS.counter
          ),
        });
      },

      onEvents: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  });
}
