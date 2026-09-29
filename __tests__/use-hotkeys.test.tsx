import React, { useRef } from "react";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isEditableElement,
  isWithinKeyboardBoundary,
  matchesHotkey,
  parseHotkey,
  useHotkeys,
  type UseHotkeysOptions,
} from "@/hooks/useHotkeys";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const key = (
  k: string,
  mods: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey">
  > = {}
) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("parseHotkey", () => {
  it("parses modifiers case-insensitively and lower-cases the key", () => {
    expect(parseHotkey("Mod+Shift+K")).toEqual({
      key: "k",
      mod: true,
      ctrl: false,
      meta: false,
      alt: false,
      shift: true,
    });
    expect(parseHotkey("cmd+option+P")).toMatchObject({
      key: "p",
      meta: true,
      alt: true,
    });
  });

  it("resolves key aliases", () => {
    expect(parseHotkey("Esc").key).toBe("escape");
    expect(parseHotkey("Space").key).toBe(" ");
    expect(parseHotkey("Ctrl+Plus")).toMatchObject({ key: "+", ctrl: true });
  });
});

describe("matchesHotkey", () => {
  it("maps Mod to Command on Apple platforms and Ctrl elsewhere", () => {
    expect(matchesHotkey(key("k", { metaKey: true }), "Mod+K", true)).toBe(
      true
    );
    expect(matchesHotkey(key("k", { ctrlKey: true }), "Mod+K", true)).toBe(
      false
    );
    expect(matchesHotkey(key("k", { ctrlKey: true }), "Mod+K", false)).toBe(
      true
    );
    expect(matchesHotkey(key("k", { metaKey: true }), "Mod+K", false)).toBe(
      false
    );
  });

  it("requires Ctrl, Meta and Alt to match exactly", () => {
    expect(matchesHotkey(key("k"), "K", false)).toBe(true);
    expect(matchesHotkey(key("k", { ctrlKey: true }), "K", false)).toBe(false);
    expect(matchesHotkey(key("k", { altKey: true }), "K", false)).toBe(false);
    expect(matchesHotkey(key("k"), "Mod+K", false)).toBe(false);
  });

  it("only requires Shift when the hotkey names it", () => {
    expect(matchesHotkey(key("?", { shiftKey: true }), "?", false)).toBe(true);
    expect(matchesHotkey(key("K"), "Shift+K", false)).toBe(false);
    expect(matchesHotkey(key("K", { shiftKey: true }), "Shift+K", false)).toBe(
      true
    );
  });
});

describe("isEditableElement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("treats inputs, textareas, selects and contenteditable regions as editable", () => {
    document.body.innerHTML = `
      <input id="i" /><textarea id="t"></textarea><select id="s"></select>
      <div contenteditable="true"><span id="ce"></span></div>
      <div contenteditable=""><span id="ce-empty"></span></div>
      <div contenteditable="false"><span id="ce-off"></span></div>
      <button id="b"></button>`;
    for (const id of ["i", "t", "s", "ce", "ce-empty"]) {
      expect(isEditableElement(document.getElementById(id))).toBe(true);
    }
    expect(isEditableElement(document.getElementById("ce-off"))).toBe(false);
    expect(isEditableElement(document.getElementById("b"))).toBe(false);
    expect(isEditableElement(null)).toBe(false);
    expect(isEditableElement(window)).toBe(false);
  });

  it("detects keyboard boundaries separately", () => {
    document.body.innerHTML = `<div data-keyboard-boundary="true"><button id="in"></button></div><button id="out"></button>`;
    expect(isWithinKeyboardBoundary(document.getElementById("in"))).toBe(true);
    expect(isWithinKeyboardBoundary(document.getElementById("out"))).toBe(
      false
    );
    expect(isEditableElement(document.getElementById("in"))).toBe(false);
  });
});

function Harness({
  hotkeys,
  handler,
  options,
  scoped = false,
}: {
  hotkeys: string | string[];
  handler: (e: KeyboardEvent, hotkey: string) => void;
  options?: UseHotkeysOptions;
  scoped?: boolean;
}) {
  const scopeRef = useRef<HTMLDivElement>(null);
  useHotkeys(hotkeys, handler, {
    ...options,
    ...(scoped ? { targetRef: scopeRef } : {}),
  });
  return (
    <div>
      <input data-testid="input" />
      <button data-testid="outside">outside</button>
      <div ref={scopeRef}>
        <button data-testid="inside">inside</button>
      </div>
      <div data-keyboard-boundary="true">
        <button data-testid="boundary">boundary</button>
      </div>
    </div>
  );
}

function TrapHarness({ onHotkey }: { onHotkey: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  useHotkeys("q", onHotkey, { ignoreWhenModalOpen: true });
  return (
    <div ref={ref}>
      <button data-testid="dialog-button">ok</button>
    </div>
  );
}

describe("useHotkeys", () => {
  afterEach(() => {
    cleanup();
  });

  it("fires the handler with the matched hotkey", () => {
    const handler = vi.fn();
    const { getByTestId } = render(
      <Harness hotkeys={["?", "h"]} handler={handler} />
    );
    fireEvent.keyDown(getByTestId("outside"), { key: "h" });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1]).toBe("h");
  });

  it("ignores typing in inputs unless allowInInputs is set", () => {
    const handler = vi.fn();
    const { getByTestId, rerender } = render(
      <Harness hotkeys="h" handler={handler} />
    );
    fireEvent.keyDown(getByTestId("input"), { key: "h" });
    expect(handler).not.toHaveBeenCalled();

    rerender(
      <Harness
        hotkeys="h"
        handler={handler}
        options={{ allowInInputs: true }}
      />
    );
    fireEvent.keyDown(getByTestId("input"), { key: "h" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores keyboard boundaries unless allowInKeyboardBoundary is set", () => {
    const handler = vi.fn();
    const { getByTestId, rerender } = render(
      <Harness hotkeys="h" handler={handler} />
    );
    fireEvent.keyDown(getByTestId("boundary"), { key: "h" });
    expect(handler).not.toHaveBeenCalled();

    rerender(
      <Harness
        hotkeys="h"
        handler={handler}
        options={{ allowInKeyboardBoundary: true }}
      />
    );
    fireEvent.keyDown(getByTestId("boundary"), { key: "h" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores IME composition events", () => {
    const handler = vi.fn();
    const { getByTestId } = render(<Harness hotkeys="h" handler={handler} />);
    fireEvent.keyDown(getByTestId("outside"), { key: "h", isComposing: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("applies preventDefault and stopPropagation only on a match", () => {
    const { getByTestId } = render(
      <Harness
        hotkeys="Ctrl+K"
        handler={() => {}}
        options={{ preventDefault: true, stopPropagation: true }}
      />
    );
    const miss = new KeyboardEvent("keydown", {
      key: "k",
      bubbles: true,
      cancelable: true,
    });
    getByTestId("outside").dispatchEvent(miss);
    expect(miss.defaultPrevented).toBe(false);

    const hit = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const stop = vi.spyOn(hit, "stopPropagation");
    getByTestId("outside").dispatchEvent(hit);
    expect(hit.defaultPrevented).toBe(true);
    expect(stop).toHaveBeenCalled();
  });

  it("scopes to targetRef when provided", () => {
    const handler = vi.fn();
    const { getByTestId } = render(
      <Harness hotkeys="h" handler={handler} scoped />
    );
    fireEvent.keyDown(getByTestId("outside"), { key: "h" });
    expect(handler).not.toHaveBeenCalled();
    fireEvent.keyDown(getByTestId("inside"), { key: "h" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("detaches when disabled and on unmount", () => {
    const handler = vi.fn();
    const { rerender, unmount } = render(
      <Harness hotkeys="h" handler={handler} options={{ enabled: false }} />
    );
    fireEvent.keyDown(window, { key: "h" });
    expect(handler).not.toHaveBeenCalled();

    rerender(<Harness hotkeys="h" handler={handler} />);
    fireEvent.keyDown(window, { key: "h" });
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(window, { key: "h" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("calls the latest handler without re-binding", () => {
    const first = vi.fn();
    const second = vi.fn();
    const addSpy = vi.spyOn(window, "addEventListener");
    const { rerender } = render(<Harness hotkeys={["h"]} handler={first} />);
    const bindings = addSpy.mock.calls.filter(([t]) => t === "keydown").length;
    rerender(<Harness hotkeys={["h"]} handler={second} />);
    fireEvent.keyDown(window, { key: "h" });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(addSpy.mock.calls.filter(([t]) => t === "keydown").length).toBe(
      bindings
    );
    addSpy.mockRestore();
  });

  it("listens on document when target is document", () => {
    const handler = vi.fn();
    render(
      <Harness
        hotkeys="Escape"
        handler={handler}
        options={{ target: "document" }}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stays quiet behind an active focus trap when ignoreWhenModalOpen is set", () => {
    const handler = vi.fn();
    const { getByTestId, unmount } = render(<TrapHarness onHotkey={handler} />);
    fireEvent.keyDown(getByTestId("dialog-button"), { key: "q" });
    expect(handler).not.toHaveBeenCalled();
    unmount();
  });
});
