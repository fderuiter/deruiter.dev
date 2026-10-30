import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useStudyDirectorSession } from "@/components/study-director/useStudyDirectorSession";
import { useStudyDirectorWorldSession } from "@/components/study-director-world/useStudyDirectorWorldSession";
import { STUDY_DIRECTOR_AUTO_PAUSE_EVENT } from "@/components/study-director-world/auto-pause";

/**
 * The Study Director sessions on their own (#3437): the desk advances a day,
 * and the office's clock stops when the cabinet pauses a walk, without
 * rendering either view.
 */

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/arcade/study-director");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useStudyDirectorSession (the desk)", () => {
  it("starts a study on day 1 and advances one day at the end of it", () => {
    const { result } = renderHook(() =>
      useStudyDirectorSession({ touch: false, officeFirst: false })
    );
    expect(result.current.worldMode).toBe(false);
    expect(result.current.state).toBeNull();

    act(() => result.current.startNew());
    const first = result.current.state!;
    expect(first.status).toBe("running");

    act(() => result.current.finishDay());
    expect(result.current.state!.day).toBe(first.day + 1);
    expect(result.current.notice).toMatch(
      new RegExp(`^Day ${first.day + 1}\\.`)
    );
  });

  it("saves the running study as the day advances", () => {
    const { result } = renderHook(() =>
      useStudyDirectorSession({ touch: false, officeFirst: false })
    );
    act(() => result.current.startNew());
    act(() => result.current.finishDay());
    const reopened = renderHook(() =>
      useStudyDirectorSession({ touch: false, officeFirst: false })
    );
    expect(reopened.result.current.saved?.day).toBe(result.current.state!.day);
  });
});

describe("useStudyDirectorWorldSession (the office)", () => {
  /** An office session with a walk under way to the farthest place listed. */
  function walking() {
    vi.useFakeTimers();
    const hook = renderHook(() =>
      useStudyDirectorWorldSession({ onExit: () => {}, touch: false })
    );
    const entries = hook.result.current.directory
      .map((entry) => ({
        entry,
        minutes: hook.result.current.minutesTo(entry) ?? 0,
      }))
      .filter((e) => e.minutes > 2)
      .sort((a, b) => b.minutes - a.minutes);
    expect(entries.length).toBeGreaterThan(0);
    act(() => hook.result.current.walkTo(entries[0].entry));
    expect(hook.result.current.walk).not.toBeNull();
    return hook;
  }

  it("moves the clock as a walk steps", () => {
    const { result } = walking();
    const before = result.current.world.minute;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.world.minute).toBeGreaterThan(before);
  });

  it("stops the walk and the clock when the cabinet pauses", () => {
    const { result } = walking();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      window.dispatchEvent(new Event(STUDY_DIRECTOR_AUTO_PAUSE_EVENT));
    });
    expect(result.current.walk).toBeNull();
    expect(result.current.notice).toBe("Paused. You stopped walking.");

    const paused = result.current.world.minute;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.world.minute).toBe(paused);
  });
});
