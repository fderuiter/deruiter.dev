// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  EVENT_CAPTIONS,
  HEADSET_LINES,
  LOOK_PRESETS,
  MANAGER_LINES,
  type ShiftEvent,
} from "@/lib/patty-drive-thru";
import {
  createBoothStore,
  type BoothStore,
} from "@/components/patty-drive-thru/store";

const SEED = "e2e-4";

/** Runs the shift clock in tenth-of-a-second steps. */
function run(store: BoothStore, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    store.getState().tick(0.1);
  }
}

function clockedIn(durationSec = 180): BoothStore {
  const store = createBoothStore({ seed: SEED, durationSec });
  store.getState().clockIn();
  return store;
}

describe("Patty's Drive-Thru booth store (#1813)", () => {
  it("waits on the diary page and ignores the clock and input until clock-in", () => {
    const store = createBoothStore({ seed: SEED });
    expect(store.getState().phase).toBe("intro");
    const before = store.getState().shift;
    store.getState().tick(5);
    store.getState().act({ type: "wipe" });
    expect(store.getState().shift).toBe(before);
  });

  it("clocks in with a fresh shift and announces it", () => {
    const store = clockedIn();
    const state = store.getState();
    expect(state.phase).toBe("shift");
    expect(state.shift.time).toBe(0);
    expect(state.announcement).toBe("Clocked in. The headset is on.");
    expect(state.look.yaw).toBe(LOOK_PRESETS.counter.yaw);
  });

  it("captions a new car through the headset and reads its order aloud", () => {
    const store = clockedIn();
    const heard: ShiftEvent[] = [];
    const stop = store.getState().onEvents((events) => heard.push(...events));
    run(store, 2.5);
    const state = store.getState();
    expect(heard.some((e) => e.type === "order-arrived")).toBe(true);
    expect(state.caption?.speaker).toBe("headset");
    expect(HEADSET_LINES).toContain(state.caption?.text);
    expect(state.announcement).toMatch(/^New car, order 1: Fries\./);
    stop();
    run(store, 1);
    const count = heard.length;
    run(store, 30);
    expect(heard.length).toBe(count);
  });

  it("rings, bumps and captions a served car", () => {
    const store = clockedIn();
    run(store, 2.5);
    const { act } = store.getState();
    act({ type: "bump", orderId: 1 });
    expect(store.getState().caption?.text).toBe(EVENT_CAPTIONS.notReady);
    act({ type: "selectOrder", orderId: 1 });
    act({ type: "posTap", nodeId: "sides" });
    act({ type: "posTap", nodeId: "fries" });
    act({ type: "bump", orderId: 1 });
    const state = store.getState();
    expect(state.shift.tallies.served).toBe(1);
    expect(state.caption?.text).toBe(EVENT_CAPTIONS.bumped);
    expect(state.announcement).toContain(EVENT_CAPTIONS.bumped);
  });

  it("ignores actions that change nothing", () => {
    const store = clockedIn();
    const before = store.getState();
    store.getState().act({ type: "posBack" });
    expect(store.getState()).toBe(before);
  });

  it("lets the manager yell at an idle player, flickering the lights", () => {
    const store = clockedIn();
    run(store, 16);
    const state = store.getState();
    expect(state.yells).toBeGreaterThan(0);
    expect(state.shift.tallies.yells).toBeGreaterThan(0);
    run(store, 0.1);
    const yelled = store.getState();
    expect(
      yelled.caption?.speaker === "manager"
        ? MANAGER_LINES.includes(yelled.caption.text)
        : true
    ).toBe(true);
  });

  it("announces a late order once, when it turns red", () => {
    const store = clockedIn();
    // Keep wiping so the manager never ends the shift early.
    for (let second = 0; second < 57; second += 3) {
      run(store, 3);
      store.getState().act({ type: "wipe" });
    }
    const state = store.getState();
    expect(state.phase).toBe("shift");
    const late = state.lateAnnounced;
    expect(late.length).toBeGreaterThan(0);
    run(store, 0.5);
    expect(store.getState().lateAnnounced).toEqual(late);
  });

  it("wipes the counter with a caption", () => {
    const store = clockedIn();
    store.getState().act({ type: "wipe" });
    expect(store.getState().caption).toMatchObject({
      speaker: "booth",
      text: EVENT_CAPTIONS.wiped,
    });
  });

  it("captions a flagged coworker", () => {
    const store = createBoothStore({ seed: "e2e-5", durationSec: 180 });
    store.getState().clockIn();
    run(store, 2.5);
    store.getState().act({ type: "flagCoworker", orderId: 1 });
    expect(store.getState().caption).toMatchObject({
      speaker: "coworker",
      text: EVENT_CAPTIONS.coworkerFlagged,
    });
  });

  it("ends the shift, closes the register and goes back to the diary", () => {
    const store = clockedIn(10);
    const listener = vi.fn();
    store.getState().onEvents(listener);
    store.getState().setRegisterOpen(true);
    run(store, 10.5);
    const state = store.getState();
    expect(state.phase).toBe("ended");
    expect(state.registerOpen).toBe(false);
    expect(state.announcement).toContain("The shift is over.");
    expect(
      listener.mock.calls
        .flatMap(([events]) => events as ShiftEvent[])
        .some((e) => e.type === "shift-ended")
    ).toBe(true);
    store.getState().backToIntro();
    expect(store.getState().phase).toBe("intro");
  });

  it("uses the seed it was last clocked in with", () => {
    const store = createBoothStore({ seed: SEED });
    store.getState().clockIn({ seed: "e2e-7" });
    expect(store.getState().shift.config.seed).toBe("e2e-7");
    store.getState().clockIn();
    expect(store.getState().shift.config.seed).toBe("e2e-7");
  });

  it("turns the head, aims it and zooms into the register", () => {
    const store = clockedIn();
    const start = store.getState().look;
    store.getState().moveHead({ turn: 0, dragYaw: 0, dragPitch: 0 }, 0.1);
    expect(store.getState().look).toBe(start);
    store.getState().moveHead({ turn: 1, dragYaw: 0, dragPitch: 0 }, 0.1);
    expect(store.getState().look.yaw).toBeGreaterThan(start.yaw);

    store.getState().setRegisterOpen(true);
    expect(store.getState().registerOpen).toBe(true);
    expect(store.getState().look.targetYaw).toBe(LOOK_PRESETS.register.yaw);
    const open = store.getState();
    store.getState().setRegisterOpen(true);
    expect(store.getState()).toBe(open);
    store.getState().setRegisterOpen(false);
    expect(store.getState().look.targetPitch).toBe(LOOK_PRESETS.counter.pitch);

    store.getState().aim(LOOK_PRESETS.window);
    expect(store.getState().look.targetYaw).toBe(LOOK_PRESETS.window.yaw);
  });
});
