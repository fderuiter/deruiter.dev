import { describe, it, expect, vi } from "vitest";
import {
  createHoldRepeater,
  HOLD_REPEAT_DELAY_MS,
  HOLD_REPEAT_INTERVAL_MS,
} from "@/components/arcade/mobile/holdRepeat";
import {
  swipeDirection,
  SWIPE_THRESHOLD_PX,
} from "@/components/arcade/mobile/swipe";

/** A fake clock: `setTimer` queues callbacks that `advance` runs in time order. */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const queue = new Map<number, { at: number; run: () => void }>();
  return {
    setTimer(callback: () => void, ms: number) {
      const id = nextId++;
      queue.set(id, { at: now + ms, run: callback });
      return id;
    },
    clearTimer(handle: unknown) {
      queue.delete(handle as number);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let due: [number, { at: number; run: () => void }] | null = null;
        for (const entry of queue) {
          if (entry[1].at <= end && (!due || entry[1].at < due[1].at))
            due = entry;
        }
        if (!due) break;
        now = due[1].at;
        queue.delete(due[0]);
        due[1].run();
      }
      now = end;
    },
    pending() {
      return queue.size;
    },
  };
}

describe("createHoldRepeater", () => {
  it("uses the keyboard-like pace by default", () => {
    expect(HOLD_REPEAT_DELAY_MS).toBe(220);
    expect(HOLD_REPEAT_INTERVAL_MS).toBe(140);
  });

  it("a quick tap produces exactly one step", () => {
    const clock = fakeClock();
    const tick = vi.fn();
    const repeater = createHoldRepeater(tick, clock);

    repeater.start();
    expect(tick).toHaveBeenCalledTimes(1);
    repeater.stop();
    clock.advance(2000);

    expect(tick).toHaveBeenCalledTimes(1);
    expect(clock.pending()).toBe(0);
    expect(repeater.active).toBe(false);
  });

  it("a hold ticks at once, waits the delay, then repeats at the interval", () => {
    const clock = fakeClock();
    const tick = vi.fn();
    const repeater = createHoldRepeater(tick, {
      ...clock,
      delayMs: 200,
      intervalMs: 100,
    });

    repeater.start();
    expect(tick).toHaveBeenCalledTimes(1);

    clock.advance(199);
    expect(tick).toHaveBeenCalledTimes(1);
    clock.advance(1);
    expect(tick).toHaveBeenCalledTimes(2);
    clock.advance(100);
    expect(tick).toHaveBeenCalledTimes(3);
    clock.advance(250);
    expect(tick).toHaveBeenCalledTimes(5);

    repeater.stop();
    clock.advance(1000);
    expect(tick).toHaveBeenCalledTimes(5);
  });

  it("a second start during a hold does not add a step or a second timer", () => {
    const clock = fakeClock();
    const tick = vi.fn();
    const repeater = createHoldRepeater(tick, clock);

    repeater.start();
    repeater.start();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(clock.pending()).toBe(1);
    repeater.stop();
  });

  it("stop with nothing held is harmless", () => {
    const tick = vi.fn();
    const repeater = createHoldRepeater(tick, fakeClock());
    expect(() => repeater.stop()).not.toThrow();
    expect(tick).not.toHaveBeenCalled();
  });
});

describe("swipeDirection", () => {
  it("reads the dominant axis", () => {
    expect(swipeDirection(60, 4)).toBe("right");
    expect(swipeDirection(-60, -4)).toBe("left");
    expect(swipeDirection(3, 60)).toBe("down");
    expect(swipeDirection(-3, -60)).toBe("up");
  });

  it("treats drags shorter than the threshold as taps", () => {
    expect(swipeDirection(0, 0)).toBeNull();
    expect(swipeDirection(SWIPE_THRESHOLD_PX - 1, 0)).toBeNull();
    expect(swipeDirection(0, -(SWIPE_THRESHOLD_PX - 1))).toBeNull();
  });

  it("counts a drag at exactly the threshold", () => {
    expect(swipeDirection(SWIPE_THRESHOLD_PX, 0)).toBe("right");
  });

  it("honours an explicit threshold", () => {
    expect(swipeDirection(10, 0, 8)).toBe("right");
    expect(swipeDirection(10, 0, 12)).toBeNull();
  });
});
