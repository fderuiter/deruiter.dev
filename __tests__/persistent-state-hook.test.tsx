/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  type MockStorage,
  ThrowingStorage,
  resetMockStorage,
} from "./helpers/storage-mock";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { usePersistentState } from "@/hooks/usePersistentState";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("usePersistentState Hook", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = resetMockStorage();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function TestComponent({
    storageKey,
    initialVal,
  }: {
    storageKey: string;
    initialVal: string;
  }) {
    const [val, setVal] = usePersistentState(storageKey, initialVal);
    return (
      <div>
        <span data-testid="val">{val}</span>
        <button
          data-testid="set-direct"
          onClick={() => setVal("updated_direct")}
        />
        <button
          data-testid="set-fn"
          onClick={() => setVal((prev) => `${prev}_fn`)}
        />
      </div>
    );
  }

  it("hydrates from localStorage and supports direct and functional updates", async () => {
    mockStorage.setItem("my_key", JSON.stringify("hydrated_value"));

    await act(async () => {
      root.render(<TestComponent storageKey="my_key" initialVal="default" />);
    });

    expect(container.querySelector('[data-testid="val"]')?.textContent).toBe(
      "hydrated_value"
    );

    // Direct update
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="set-direct"]')
        ?.click();
    });

    expect(container.querySelector('[data-testid="val"]')?.textContent).toBe(
      "updated_direct"
    );
    expect(mockStorage.getItem("my_key")).toContain("updated_direct");

    // Functional update
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="set-fn"]')
        ?.click();
    });

    expect(container.querySelector('[data-testid="val"]')?.textContent).toBe(
      "updated_direct_fn"
    );
    expect(mockStorage.getItem("my_key")).toContain("updated_direct_fn");
  });

  it("handles localStorage read and write exceptions gracefully", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    resetMockStorage(new ThrowingStorage());

    await act(async () => {
      root.render(<TestComponent storageKey="err_key" initialVal="fallback" />);
    });

    expect(container.querySelector('[data-testid="val"]')?.textContent).toBe(
      "fallback"
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="set-direct"]')
        ?.click();
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
