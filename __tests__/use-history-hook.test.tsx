import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHistory } from "@/hooks/useHistory";

describe("useHistory", () => {
  it("initializes with provided value and empty stacks", () => {
    const { result } = renderHook(() => useHistory("initial"));
    expect(result.current.state).toBe("initial");
    expect(result.current.past).toEqual([]);
    expect(result.current.future).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("initializes with lazy initializer function", () => {
    const { result } = renderHook(() => useHistory(() => [1, 2, 3]));
    expect(result.current.state).toEqual([1, 2, 3]);
  });

  it("handles commit with values and functional updates", () => {
    const { result } = renderHook(() => useHistory<number>(0));
    act(() => result.current.commit(1));
    expect(result.current.state).toBe(1);
    expect(result.current.past).toEqual([0]);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.set((prev) => prev + 5));
    expect(result.current.state).toBe(6);
    expect(result.current.past).toEqual([0, 1]);
  });

  it("supports undo and redo", () => {
    const { result } = renderHook(() => useHistory<number>(10));
    act(() => result.current.commit(20));
    act(() => result.current.commit(30));

    expect(result.current.state).toBe(30);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(result.current.state).toBe(20);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.state).toBe(10);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.state).toBe(20);
    act(() => result.current.redo());
    expect(result.current.state).toBe(30);
    expect(result.current.canRedo).toBe(false);
  });

  it("discards redo stack when a new commit occurs after undo", () => {
    const { result } = renderHook(() => useHistory("A"));
    act(() => result.current.commit("B"));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.commit("C"));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toBe("C");
    expect(result.current.past).toEqual(["A"]);
  });

  it("enforces capacity limit on past stack", () => {
    const { result } = renderHook(() => useHistory<number>(0, { capacity: 5 }));
    for (let i = 1; i <= 10; i++) {
      act(() => result.current.commit(i));
    }
    expect(result.current.state).toBe(10);
    expect(result.current.past.length).toBe(5);
    expect(result.current.past).toEqual([5, 6, 7, 8, 9]);

    let undoCount = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      undoCount++;
    }
    expect(undoCount).toBe(5);
    expect(result.current.state).toBe(5);
  });

  it("allows setting present state without recording undo step", () => {
    const { result } = renderHook(() => useHistory("orig"));
    act(() => result.current.setWithoutUndo("updated"));
    expect(result.current.state).toBe("updated");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.past).toEqual([]);
  });

  it("resets to new state and clears both past and future stacks", () => {
    const { result } = renderHook(() => useHistory("orig"));
    act(() => result.current.commit("v1"));
    act(() => result.current.commit("v2"));
    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.reset("fresh"));
    expect(result.current.state).toBe("fresh");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.past).toEqual([]);
    expect(result.current.future).toEqual([]);
  });

  it("ignores no-op commits when isEqual option is provided", () => {
    const { result } = renderHook(() =>
      useHistory(["item1"], {
        isEqual: (a, b) =>
          a.length === b.length && a.every((val, i) => val === b[i]),
      })
    );
    act(() => result.current.commit(["item1"]));
    expect(result.current.past).toEqual([]);
    expect(result.current.canUndo).toBe(false);
  });

  it("ignores no-op commits when updater returns referentially equal present state", () => {
    const { result } = renderHook(() => useHistory(["a", "b"]));
    act(() => result.current.set((prev) => prev));
    expect(result.current.past).toEqual([]);
    expect(result.current.canUndo).toBe(false);
  });
});
