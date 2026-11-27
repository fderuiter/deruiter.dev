import React, { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockStorage } from "./helpers/storage-mock";
import { act, cleanup, renderHook } from "@testing-library/react";
import { z } from "zod";
import {
  createArcadeStore,
  type ArcadeSession,
} from "@/components/arcade/views";
import {
  CabinetPauseProvider,
  RESTORE_FAILED_NOTICE,
  createPauseController,
  useRunSnapshot,
} from "@/components/arcade/pause";
import {
  createRng,
  createRunFairness,
  createStepClock,
  runSnapshotKey,
  type FairnessPolicy,
} from "@/lib/arcade";

/**
 * Resume restores a saved run all or nothing (#3803). Each fixture fails at a
 * different point of the restore, after something in the session has already
 * changed, and the fresh run must come back whole.
 */

const announce = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));

interface CounterState {
  count: number;
  level: number;
}
type Intent = { readonly type: "set"; readonly state: CounterState };

const counterState = z.object({
  count: z.number().int(),
  level: z.number().int(),
});
const format = { schema: 1, state: counterState };

const policy: FairnessPolicy = {
  levels: { aimAssist: ["off", "strong"] },
  assistsFor: (input): Record<string, string | boolean> =>
    input === "touch" ? { aimAssist: "strong" } : {},
};

/** A session with a stream, a step clock and fairness tags. */
function makeSession(start: CounterState) {
  const store = createArcadeStore<CounterState, Intent>(
    start,
    (_, intent) => intent.state
  );
  const session = {
    ...store,
    snapshot: () => store.getState(),
    restore: (data: unknown) =>
      store.dispatch({ type: "set", state: counterState.parse(data) }),
    tuning: {},
    rng: createRng(7),
    clock: createStepClock(),
    fairness: createRunFairness(policy),
  } satisfies ArcadeSession<CounterState, Intent>;
  return session;
}

function wrapperFor() {
  const controller = createPauseController({
    gameId: "fixture",
    view: "phone",
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CabinetPauseProvider controller={controller}>
        {children}
      </CabinetPauseProvider>
    );
  }
  return Wrapper;
}

/** Saves a run with count 9, level 3, a moved stream, step 60 and touch tags. */
function seedSave() {
  const saved = makeSession({ count: 9, level: 3 });
  saved.rng.next();
  saved.rng.next();
  saved.rng.next();
  for (let i = 0; i < 4; i++) saved.clock.advance(0.25);
  saved.fairness.noteView("phone");
  saved.fairness.noteInput("touch");
  const wrapper = wrapperFor();
  const first = renderHook(() => useRunSnapshot(saved, format), { wrapper });
  act(() => first.result.current.save());
  first.unmount();
  return wrapper;
}

/** The fresh run's whole state, to compare before and after Resume. */
function freshRun(session: ReturnType<typeof makeSession>) {
  return {
    state: session.getState(),
    rngState: session.rng.getState(),
    step: session.clock.getStep(),
    tags: session.fairness.getTags(),
  };
}

function hasSave() {
  return window.localStorage.getItem(runSnapshotKey("fixture")) !== null;
}

describe("useRunSnapshot restores a saved run all or nothing (#3803)", () => {
  beforeEach(() => {
    resetMockStorage();
    announce.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("rolls back a session restore that changed state and then threw", () => {
    const wrapper = seedSave();
    const fresh = makeSession({ count: 1, level: 1 });
    fresh.fairness.noteView("desktop");
    fresh.fairness.noteInput("keyboard");
    const before = freshRun(fresh);
    let calls = 0;
    const restore = fresh.restore;
    fresh.restore = (data: unknown) => {
      calls += 1;
      if (calls === 1) {
        // Half a restore: the count lands, the level never does.
        fresh.dispatch({
          type: "set",
          state: { ...fresh.getState(), count: 9 },
        });
        throw new Error("level table missing");
      }
      restore(data);
    };

    const { result } = renderHook(() => useRunSnapshot(fresh, format), {
      wrapper,
    });
    expect(result.current.saved).not.toBeNull();
    act(() => result.current.resumeSaved());

    expect(freshRun(fresh)).toEqual(before);
    expect(result.current.saved).toBeNull();
    expect(hasSave()).toBe(false);
    expect(announce).toHaveBeenCalledWith(RESTORE_FAILED_NOTICE, "polite");
  });

  it("rolls back state when the stream fails to restore", () => {
    const wrapper = seedSave();
    const fresh = makeSession({ count: 2, level: 1 });
    const before = freshRun(fresh);
    const setState = fresh.rng.setState;
    let rngCalls = 0;
    fresh.rng = {
      ...fresh.rng,
      setState: (state: number) => {
        rngCalls += 1;
        if (rngCalls === 1) throw new RangeError("stream rejected");
        setState(state);
      },
    };

    const { result } = renderHook(() => useRunSnapshot(fresh, format), {
      wrapper,
    });
    act(() => result.current.resumeSaved());

    expect(freshRun(fresh)).toEqual(before);
    expect(hasSave()).toBe(false);
    expect(announce).toHaveBeenCalledWith(RESTORE_FAILED_NOTICE, "polite");
  });

  it("rolls back state, stream and step when the fairness tags fail to restore", () => {
    const wrapper = seedSave();
    const fresh = makeSession({ count: 3, level: 2 });
    fresh.fairness.noteView("desktop");
    const before = freshRun(fresh);
    const restoreTags = fresh.fairness.restore;
    let tagCalls = 0;
    fresh.fairness = {
      ...fresh.fairness,
      restore: (tags) => {
        tagCalls += 1;
        if (tagCalls === 1) throw new Error("unknown assist");
        restoreTags(tags);
      },
    };

    const { result } = renderHook(() => useRunSnapshot(fresh, format), {
      wrapper,
    });
    act(() => result.current.resumeSaved());

    expect(freshRun(fresh)).toEqual(before);
    expect(hasSave()).toBe(false);
  });

  it("restores every part of a good save and announces nothing", () => {
    const wrapper = seedSave();
    const fresh = makeSession({ count: 0, level: 0 });

    const { result } = renderHook(() => useRunSnapshot(fresh, format), {
      wrapper,
    });
    act(() => result.current.resumeSaved());

    expect(fresh.getState()).toEqual({ count: 9, level: 3 });
    expect(fresh.clock.getStep()).toBe(60);
    expect(fresh.fairness.getTags().inputs).toEqual(["touch"]);
    expect(announce).not.toHaveBeenCalledWith(RESTORE_FAILED_NOTICE, "polite");
  });

  it("keeps the pending save from being overwritten before the player chooses", () => {
    const wrapper = seedSave();
    const raw = window.localStorage.getItem(runSnapshotKey("fixture"));
    const fresh = makeSession({ count: 0, level: 0 });

    const { result } = renderHook(() => useRunSnapshot(fresh, format), {
      wrapper,
    });
    act(() => result.current.save());

    expect(window.localStorage.getItem(runSnapshotKey("fixture"))).toBe(raw);
  });
});
