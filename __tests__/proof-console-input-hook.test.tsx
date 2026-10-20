import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import type React from "react";
import { useProofConsoleInput } from "@/app/proof/useProofConsoleInput";

function key(
  name: string,
  modifiers: Partial<
    Pick<React.KeyboardEvent, "shiftKey" | "ctrlKey" | "altKey" | "metaKey">
  > = {}
) {
  return fromPartial<React.KeyboardEvent<HTMLInputElement>>({
    key: name,
    preventDefault: vi.fn(),
    ...modifiers,
  });
}

function setup() {
  const options = {
    onSubmit: vi.fn(),
    onEscape: vi.fn(),
    playAutocomplete: vi.fn(),
  };
  const hook = renderHook(() => useProofConsoleInput(options));
  const type = (value: string) =>
    act(() => hook.result.current.setConsoleInput(value));
  const submit = (value: string) => {
    type(value);
    act(() =>
      hook.result.current.handleConsoleSubmit(
        fromPartial<React.FormEvent>({ preventDefault: vi.fn() })
      )
    );
  };
  const press = (event: React.KeyboardEvent<HTMLInputElement>) => {
    act(() => hook.result.current.handleConsoleKeyDown(event));
    return event;
  };
  return { ...hook, options, type, submit, press };
}

describe("useProofConsoleInput", () => {
  it("submits a trimmed line and clears the draft", () => {
    const { result, options, submit } = setup();
    submit("  connect C E  ");
    expect(options.onSubmit).toHaveBeenCalledWith("connect C E");
    expect(result.current.consoleInput).toBe("");
  });

  it("does not submit a blank line", () => {
    const { options, submit } = setup();
    submit("    ");
    expect(options.onSubmit).not.toHaveBeenCalled();
  });

  it("walks back through history with Up and forward with Down", () => {
    const { result, submit, press } = setup();
    submit("help");
    submit("list");
    expect(press(key("ArrowUp")).preventDefault).toHaveBeenCalled();
    expect(result.current.consoleInput).toBe("list");
    press(key("ArrowUp"));
    expect(result.current.consoleInput).toBe("help");
    // Up at the oldest entry stays put.
    press(key("ArrowUp"));
    expect(result.current.consoleInput).toBe("help");
    press(key("ArrowDown"));
    expect(result.current.consoleInput).toBe("list");
    press(key("ArrowDown"));
    expect(result.current.consoleInput).toBe("");
    // Down past the newest entry does nothing more.
    const down = press(key("ArrowDown"));
    expect(down.preventDefault).toHaveBeenCalled();
    expect(result.current.consoleInput).toBe("");
  });

  it("ignores Up with no history", () => {
    const { result, type, press } = setup();
    type("draft");
    press(key("ArrowUp"));
    expect(result.current.consoleInput).toBe("draft");
  });

  it("completes the suggestion on Tab", () => {
    const { result, options, type, press } = setup();
    type("conn");
    expect(result.current.suggestion).toBeTruthy();
    const suggestion = result.current.suggestion;
    const tab = press(key("Tab"));
    expect(tab.preventDefault).toHaveBeenCalled();
    expect(result.current.consoleInput).toBe(suggestion);
    expect(options.playAutocomplete).toHaveBeenCalled();
  });

  it("keeps completing when the audio context throws", () => {
    const { result, options, type, press } = setup();
    options.playAutocomplete.mockImplementation(() => {
      throw new Error("muted");
    });
    type("conn");
    const suggestion = result.current.suggestion;
    press(key("Tab"));
    expect(result.current.consoleInput).toBe(suggestion);
  });

  it("lets Tab move focus when there is nothing to complete or a modifier is held", () => {
    const { result, type, press } = setup();
    type("");
    expect(press(key("Tab")).preventDefault).not.toHaveBeenCalled();
    type("conn");
    for (const modifier of ["shiftKey", "ctrlKey", "altKey", "metaKey"]) {
      const event = press(key("Tab", { [modifier]: true }));
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
    expect(result.current.consoleInput).toBe("conn");
  });

  it("hands Escape to the page", () => {
    const { options, press } = setup();
    const esc = press(key("Escape"));
    expect(esc.preventDefault).toHaveBeenCalled();
    expect(options.onEscape).toHaveBeenCalledTimes(1);
  });

  it("leaves other keys alone", () => {
    const { result, options, type, press } = setup();
    type("ab");
    expect(press(key("a")).preventDefault).not.toHaveBeenCalled();
    expect(result.current.consoleInput).toBe("ab");
    expect(options.onEscape).not.toHaveBeenCalled();
  });
});
