import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import type { StudyProtocol } from "@/lib/crf";
import { useStudyHistory } from "@/components/crf/useStudyHistory";

const version = (n: number) =>
  fromPartial<StudyProtocol>({ studyName: `v${n}` });

function setup() {
  const initial = version(0);
  const hook = renderHook(() => useStudyHistory(() => initial));
  return { ...hook, initial };
}

describe("useStudyHistory", () => {
  it("starts on the initial study with nothing to undo or redo", () => {
    const { result, initial } = setup();
    expect(result.current.study).toBe(initial);
    expect(result.current.baselineStudy).toBe(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("undoes and redoes committed edits in order", () => {
    const { result, initial } = setup();
    act(() => result.current.commit(version(1)));
    act(() => result.current.commit(version(2)));
    expect(result.current.study.studyName).toBe("v2");
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.study.studyName).toBe("v1");
    act(() => result.current.undo());
    expect(result.current.study).toBe(initial);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.study.studyName).toBe("v1");
    act(() => result.current.redo());
    expect(result.current.study.studyName).toBe("v2");
    expect(result.current.canRedo).toBe(false);
  });

  it("ignores undo and redo with nothing to step to", () => {
    const { result, initial } = setup();
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.study).toBe(initial);
  });

  it("drops anything to redo once a new edit lands", () => {
    const { result } = setup();
    act(() => result.current.commit(version(1)));
    act(() => result.current.undo());
    act(() => result.current.commit(version(2)));
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.redo());
    expect(result.current.study.studyName).toBe("v2");
  });

  it("keeps the last 21 versions to undo to", () => {
    const { result } = setup();
    for (let n = 1; n <= 30; n++) {
      act(() => result.current.commit(version(n)));
    }
    let steps = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      steps++;
    }
    expect(steps).toBe(21);
    expect(result.current.study.studyName).toBe("v9");
  });

  it("changes the study without an undo step through setStudy", () => {
    const { result } = setup();
    act(() => result.current.setStudy(version(5)));
    expect(result.current.study.studyName).toBe("v5");
    expect(result.current.canUndo).toBe(false);
  });

  it("replaces the study as an undoable step and a new baseline", () => {
    const { result, initial } = setup();
    const next = version(7);
    act(() => result.current.replace(next));
    expect(result.current.study).toBe(next);
    expect(result.current.baselineStudy).toBe(next);
    act(() => result.current.undo());
    expect(result.current.study).toBe(initial);
  });

  it("resets to a study with no history either way", () => {
    const { result } = setup();
    act(() => result.current.commit(version(1)));
    act(() => result.current.commit(version(2)));
    act(() => result.current.undo());
    const restored = version(9);
    act(() => result.current.reset(restored));
    expect(result.current.study).toBe(restored);
    expect(result.current.baselineStudy).toBe(restored);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
