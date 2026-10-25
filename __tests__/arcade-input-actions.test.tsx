// @vitest-environment jsdom
//
// #2356: the arcade's one input action layer.

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import {
  ActionInputController,
  ActionSinkProvider,
  actionHintText,
  actionKeyLabel,
  codeForKeyEvent,
  controlsFromActions,
  defineActions,
  findActionConflicts,
  keyNameForCode,
  manualControlsFromActions,
  resolveActionHint,
  useActionInput,
  type ActionInput,
  type ActionMap,
  type GamepadLike,
} from "@/lib/arcade";
import {
  TouchButton,
  HoldDpad,
  controlHintFromAction,
  resolveControlHint,
} from "@/components/arcade/mobile";
import {
  DUCK_ACTIONS,
  DUCK_CABINET_GROUPS,
} from "@/lib/working-with-duck-actions";

const ACTIONS = defineActions(
  {
    jump: {
      kind: "press",
      keys: ["Space", "KeyW"],
      label: "Jump",
      gamepad: { buttons: [0] },
      gamepadLabel: "A",
      group: "move",
    },
    fire: {
      kind: "hold",
      keys: ["KeyJ", "KeyZ"],
      label: "Fire",
      touchLabel: "Hold Fire",
      group: "move",
    },
    step: {
      kind: "press",
      keys: ["ArrowRight"],
      label: "Step",
      repeat: true,
      preventDefault: true,
    },
    menu: { kind: "press", keys: ["KeyM"], label: "Menu", onControls: true },
    move: {
      kind: "axis2d",
      keys: {
        up: ["ArrowUp"],
        down: ["ArrowDown"],
        left: ["KeyA"],
        right: ["KeyD"],
      },
      label: "Move",
      gamepad: { stick: "left", dpad: true },
    },
    drag: { kind: "pointer", label: "Drag" },
  },
  { groups: { move: { label: "Jump and Fire" } } }
);

type Name = (typeof ACTIONS.names)[number];

function key(
  type: "keydown" | "keyup",
  init: KeyboardEventInit,
  target: EventTarget = window
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function bind(
  options: Parameters<typeof useActionInput>[2] = {},
  map: ActionMap<Name> = ACTIONS
) {
  const inputs: ActionInput<Name>[] = [];
  const hook = renderHook(
    ({ enabled }: { enabled: boolean }) =>
      useActionInput(map, (input) => inputs.push(input), {
        onConflict: () => {},
        ...options,
        enabled,
      }),
    { initialProps: { enabled: true } }
  );
  const seen = () =>
    inputs.map(
      (i) => `${i.action}:${i.phase}${i.repeat ? ":repeat" : ""}:${i.source}`
    );
  return { inputs, seen, hook };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("defineActions and labels", () => {
  it("keeps definition order and freezes the map", () => {
    expect(ACTIONS.names).toEqual([
      "jump",
      "fire",
      "step",
      "menu",
      "move",
      "drag",
    ]);
    expect(Object.isFrozen(ACTIONS)).toBe(true);
    expect(Object.isFrozen(ACTIONS.actions)).toBe(true);
  });

  it("names physical keys the way players read them", () => {
    expect(keyNameForCode("KeyQ")).toBe("Q");
    expect(keyNameForCode("Digit1")).toBe("1");
    expect(keyNameForCode("Numpad1")).toBe("1");
    expect(keyNameForCode("ArrowUp")).toBe("↑");
    expect(keyNameForCode("Escape")).toBe("Esc");
    expect(actionKeyLabel(ACTIONS.actions.jump)).toBe("Space / W");
    expect(actionKeyLabel(ACTIONS.actions.move)).toBe("↑ / ↓ / A / D");
    expect(actionKeyLabel(DUCK_ACTIONS.actions["toy-1"])).toBe("1");
  });

  it("reads the key's character when a keyboard sends no code", () => {
    expect(codeForKeyEvent({ code: "", key: "q" })).toBe("KeyQ");
    expect(codeForKeyEvent({ code: "", key: "Q" })).toBe("KeyQ");
    expect(codeForKeyEvent({ code: "", key: "1" })).toBe("Digit1");
    expect(codeForKeyEvent({ code: "", key: " " })).toBe("Space");
    expect(codeForKeyEvent({ code: "", key: "Escape" })).toBe("Escape");
    // A real code wins, so an AZERTY A (code KeyQ) is the Q position.
    expect(codeForKeyEvent({ code: "KeyQ", key: "a" })).toBe("KeyQ");
  });
});

describe("useActionInput keyboard phases", () => {
  it("fires a press once on key down and nothing on key up", () => {
    const { seen } = bind();
    key("keydown", { code: "Space", key: " " });
    key("keyup", { code: "Space", key: " " });
    expect(seen()).toEqual(["jump:down:keyboard"]);
  });

  it("matches by physical key, whatever the layout prints", () => {
    const { seen } = bind();
    // AZERTY prints "z" on the KeyW position.
    key("keydown", { code: "KeyW", key: "z" });
    expect(seen()).toEqual(["jump:down:keyboard"]);
  });

  it("holds until the last bound key is released", () => {
    const { seen } = bind();
    key("keydown", { code: "KeyJ", key: "j" });
    key("keydown", { code: "KeyZ", key: "z" });
    key("keyup", { code: "KeyJ", key: "j" });
    expect(seen()).toEqual(["fire:down:keyboard"]);
    key("keyup", { code: "KeyZ", key: "z" });
    expect(seen()).toEqual(["fire:down:keyboard", "fire:up:keyboard"]);
  });

  it("builds an axis vector from four key sets", () => {
    const { inputs } = bind();
    key("keydown", { code: "KeyD", key: "d" });
    key("keydown", { code: "ArrowUp", key: "ArrowUp" });
    key("keyup", { code: "KeyD", key: "d" });
    key("keyup", { code: "ArrowUp", key: "ArrowUp" });
    expect(inputs.map((i) => [i.action, i.phase, i.value])).toEqual([
      ["move", "change", { x: 1, y: 0 }],
      ["move", "change", { x: 1, y: -1 }],
      ["move", "change", { x: 0, y: -1 }],
      ["move", "change", { x: 0, y: 0 }],
    ]);
  });

  it("ignores keys bound to nothing and pointer actions", () => {
    const { inputs } = bind();
    key("keydown", { code: "KeyX", key: "x" });
    expect(inputs).toHaveLength(0);
  });
});

describe("useActionInput repeat", () => {
  it("drops auto-repeat for an action that does not ask for it", () => {
    const { seen } = bind();
    key("keydown", { code: "Space", key: " " });
    key("keydown", { code: "Space", key: " ", repeat: true });
    key("keydown", { code: "Space", key: " ", repeat: true });
    expect(seen()).toEqual(["jump:down:keyboard"]);
  });

  it("repeats an action that asks for it, marked as a repeat", () => {
    const { seen } = bind();
    key("keydown", { code: "ArrowRight", key: "ArrowRight" });
    const held = key("keydown", {
      code: "ArrowRight",
      key: "ArrowRight",
      repeat: true,
    });
    expect(seen()).toEqual(["step:down:keyboard", "step:down:repeat:keyboard"]);
    expect(held.defaultPrevented).toBe(true);
  });

  it("does not re-press a hold on a repeat", () => {
    const { seen } = bind();
    key("keydown", { code: "KeyJ", key: "j" });
    key("keydown", { code: "KeyJ", key: "j", repeat: true });
    expect(seen()).toEqual(["fire:down:keyboard"]);
  });
});

describe("useActionInput release", () => {
  it("releases every held action when the window blurs", () => {
    const { seen } = bind();
    key("keydown", { code: "KeyJ", key: "j" });
    key("keydown", { code: "KeyD", key: "d" });
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(seen()).toEqual([
      "fire:down:keyboard",
      "move:change:keyboard",
      "fire:up:keyboard",
      "move:change:keyboard",
    ]);
    // The key up that follows the blur releases nothing twice.
    key("keyup", { code: "KeyJ", key: "j" });
    expect(seen()).toHaveLength(4);
  });

  it("releases every held action when the page is hidden", () => {
    const { seen } = bind();
    key("keydown", { code: "KeyJ", key: "j" });
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    visibility.mockRestore();
    expect(seen()).toEqual(["fire:down:keyboard", "fire:up:keyboard"]);
  });

  it("releases a hold when the binding is disabled", () => {
    const { seen, hook } = bind();
    key("keydown", { code: "KeyJ", key: "j" });
    hook.rerender({ enabled: false });
    expect(seen()).toEqual(["fire:down:keyboard", "fire:up:keyboard"]);
    key("keydown", { code: "Space", key: " " });
    expect(seen()).toHaveLength(2);
  });
});

describe("useActionInput focus and fields", () => {
  it.each([
    ["a text input", '<input type="text" />'],
    ["an input with no type", "<input />"],
    ["a textarea", "<textarea></textarea>"],
    ["a contenteditable region", '<div contenteditable="true"></div>'],
  ])("leaves keys typed into %s alone", (_name, html) => {
    document.body.innerHTML = html;
    const field = document.body.firstElementChild as HTMLElement;
    const { inputs } = bind();
    const event = key("keydown", { code: "ArrowRight", key: "a" }, field);
    key("keydown", { code: "KeyM", key: "m" }, field);
    expect(inputs).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves Space on a focused button to the button, unless the action opts in", () => {
    document.body.innerHTML = "<button>Go</button>";
    const button = document.querySelector("button")!;
    const { seen } = bind();
    const space = key("keydown", { code: "Space", key: " " }, button);
    key("keydown", { code: "KeyM", key: "m" }, button);
    expect(space.defaultPrevented).toBe(false);
    expect(seen()).toEqual(["menu:down:keyboard"]);
  });

  it("acts only while focus is inside the scope", () => {
    document.body.innerHTML =
      '<div id="game" tabindex="-1"></div><div id="page" tabindex="-1"></div>';
    const game = document.getElementById("game")!;
    const page = document.getElementById("page")!;
    const scopeRef = { current: game };
    const { seen } = bind({ scopeRef });
    page.focus();
    const outside = key("keydown", { code: "ArrowRight", key: "ArrowRight" });
    expect(seen()).toEqual([]);
    expect(outside.defaultPrevented).toBe(false);
    game.focus();
    key("keydown", { code: "ArrowRight", key: "ArrowRight" });
    expect(seen()).toEqual(["step:down:keyboard"]);
  });

  it("leaves Ctrl, Alt and Meta chords to the browser unless asked", () => {
    const strict = bind();
    key("keydown", { code: "Space", key: " ", ctrlKey: true });
    key("keydown", { code: "Space", key: " ", metaKey: true });
    expect(strict.inputs).toHaveLength(0);
    cleanup();
    const loose = bind({ modifiers: "any" });
    key("keydown", { code: "Space", key: " ", altKey: true });
    expect(loose.seen()).toEqual(["jump:down:keyboard"]);
  });

  it("picks the action of the current context when two share a key", () => {
    const map = defineActions({
      highFive: {
        kind: "press",
        keys: ["KeyW"],
        label: "High Five",
        context: "room",
      },
      steer: { kind: "press", keys: ["KeyW"], label: "Steer", context: "park" },
    });
    let context = "room";
    const inputs: string[] = [];
    renderHook(() =>
      useActionInput(map, (input) => inputs.push(input.action), {
        getContext: () => context,
      })
    );
    key("keydown", { code: "KeyW", key: "w" });
    context = "park";
    key("keydown", { code: "KeyW", key: "w" });
    expect(inputs).toEqual(["highFive", "steer"]);
  });

  it("calls the latest handler without re-binding", () => {
    const first = vi.fn();
    const second = vi.fn();
    const add = vi.spyOn(window, "addEventListener");
    const { rerender } = renderHook(
      ({ handler }: { handler: (input: ActionInput<Name>) => void }) =>
        useActionInput(ACTIONS, handler),
      { initialProps: { handler: first } }
    );
    const bindings = add.mock.calls.filter(([t]) => t === "keydown").length;
    rerender({ handler: second });
    key("keydown", { code: "Space", key: " " });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter(([t]) => t === "keydown").length).toBe(
      bindings
    );
    add.mockRestore();
  });
});

describe("conflict detection", () => {
  it("flags a key bound twice in one context and the cabinet's keys", () => {
    const map = defineActions({
      a: { kind: "press", keys: ["KeyQ"], label: "A" },
      b: { kind: "press", keys: ["KeyQ"], label: "B", context: "x" },
      full: { kind: "press", keys: ["KeyF"], label: "Flip" },
      back: { kind: "press", keys: ["Escape"], label: "Back" },
    });
    expect(findActionConflicts(map)).toEqual([
      { code: "KeyF", actions: ["full"], reason: "cabinet" },
      { code: "Escape", actions: ["back"], reason: "cabinet" },
      { code: "KeyQ", actions: ["a", "b"], reason: "duplicate" },
    ]);
  });

  it("allows a shared key across contexts and a cabinet key that yields", () => {
    const map = defineActions({
      a: { kind: "press", keys: ["KeyQ"], label: "A", context: "x" },
      b: { kind: "press", keys: ["KeyQ"], label: "B", context: "y" },
      pause: {
        kind: "press",
        keys: ["Escape"],
        label: "Pause",
        yieldsToCabinet: true,
      },
    });
    expect(findActionConflicts(map)).toEqual([]);
  });

  it("checks against the cabinet's actual keys", () => {
    const map = defineActions({
      flip: { kind: "press", keys: ["KeyF"], label: "Flip" },
    });
    expect(findActionConflicts(map, { reserved: ["Escape"] })).toEqual([]);
  });

  it("reports conflicts from the hook, or warns once without a handler", () => {
    const map = defineActions({
      flip: { kind: "press", keys: ["KeyF"], label: "Flip" },
    });
    const onConflict = vi.fn();
    renderHook(() => useActionInput(map, () => {}, { onConflict }));
    expect(onConflict).toHaveBeenCalledWith([
      { code: "KeyF", actions: ["flip"], reason: "cabinet" },
    ]);
    cleanup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() => useActionInput(map, () => {}));
    renderHook(() => useActionInput(map, () => {}));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("KeyF");
    warn.mockRestore();
  });

  it("finds no conflicts in Working With Duck's map", () => {
    expect(findActionConflicts(DUCK_ACTIONS)).toEqual([]);
  });
});

describe("hint text across modalities", () => {
  it("reads the touch label on touch and pen, the key elsewhere", () => {
    const fire = ACTIONS.actions.fire;
    expect(resolveActionHint(fire, "touch")).toBe("Hold Fire");
    expect(resolveActionHint(fire, "pen")).toBe("Hold Fire");
    expect(resolveActionHint(fire, "keyboard")).toBe("Press J / Z");
    expect(resolveActionHint(fire, "mouse")).toBe("Press J / Z");
    // No button named: a gamepad reads the keyboard phrase.
    expect(resolveActionHint(fire, "gamepad")).toBe("Press J / Z");
  });

  it("names the gamepad button and defaults the touch phrase to Tap", () => {
    const jump = ACTIONS.actions.jump;
    expect(resolveActionHint(jump, "gamepad")).toBe("Press A");
    expect(resolveActionHint(jump, "touch")).toBe("Tap Jump");
  });

  it("reads a pointer action's touch phrase on a keyboard too", () => {
    expect(actionHintText(ACTIONS.actions.drag).desktop).toBe("Tap Drag");
  });

  it("feeds useControlHint's resolver from an action", () => {
    const hint = controlHintFromAction(DUCK_ACTIONS.actions.space);
    expect(hint).toEqual({
      key: "Space",
      touch: "Tap Work Sprint",
      desktop: "Press Space",
    });
    expect(resolveControlHint(hint, true)).toBe("Tap Work Sprint");
    expect(resolveControlHint(hint, false)).toBe("Press Space");
  });
});

describe("generated copy", () => {
  it("lists one cabinet row per group", () => {
    expect(controlsFromActions(ACTIONS)).toEqual([
      { key: "Space / W / J / Z", action: "Jump and Fire" },
    ]);
  });

  it("generates Working With Duck's cabinet list as it was written by hand", () => {
    expect(controlsFromActions(DUCK_ACTIONS, DUCK_CABINET_GROUPS)).toEqual([
      { key: "1-3 / 4", action: "Toss Toys / Trade Treats" },
      { key: "Space", action: "Work Sprint (Park: Jump)" },
      { key: "W / ↑ ↓", action: "Steer in the Park" },
      { key: "Q / W / E / R", action: "Sit / High Five / Drop It / Spin" },
    ]);
  });

  it("writes the manual's key column from the map", () => {
    expect(
      manualControlsFromActions(DUCK_ACTIONS, [
        {
          group: "door",
          action: "Answer the Door",
          description: "Press D.",
          alsoKey: "Door Click",
        },
      ])
    ).toEqual([
      {
        key: "D / Door Click",
        touch: "Tap Get the package",
        action: "Answer the Door",
        description: "Press D.",
      },
    ]);
  });

  it("writes the manual's touch column from the map's touch hints, once per phrase (#2796)", () => {
    const [row] = manualControlsFromActions(DUCK_ACTIONS, [
      { group: "tricks", action: "Training Tricks", description: "Q-W-E-R." },
    ]);
    const tricks = DUCK_ACTIONS.names
      .map((name) => DUCK_ACTIONS.actions[name])
      .filter((definition) => definition.group === "tricks")
      .map((definition) => definition.touchLabel ?? `Tap ${definition.label}`);
    expect(row.touch).toBe(Array.from(new Set(tricks)).join(" / "));
    expect(row.touch).not.toMatch(/Press|Key[A-Z]/);
  });
});

describe("action-bound touch controls", () => {
  function withSink(children: React.ReactNode, map?: ActionMap<Name>) {
    const inputs: string[] = [];
    render(
      <ActionSinkProvider
        actions={map}
        onAction={(input) =>
          inputs.push(
            `${input.action}:${input.phase}${input.repeat ? ":repeat" : ""}:${input.source}`
          )
        }
      >
        {children}
      </ActionSinkProvider>
    );
    return inputs;
  }

  it("sends a TouchButton's action down on press and up on release", () => {
    const onPress = vi.fn();
    const inputs = withSink(
      <TouchButton label="Jump" action="jump" haptic={false} onPress={onPress}>
        Jump
      </TouchButton>
    );
    const button = screen.getByRole("button", { name: "Jump" });
    fireEvent.pointerDown(button, { pointerId: 1 });
    fireEvent.pointerUp(button, { pointerId: 1 });
    expect(inputs).toEqual(["jump:down:touch", "jump:up:touch"]);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("sends nothing from a disabled button", () => {
    const inputs = withSink(
      <TouchButton label="Jump" action="jump" haptic={false} disabled>
        Jump
      </TouchButton>
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Jump" }));
    expect(inputs).toEqual([]);
  });

  it("repeats a held d-pad arrow and drops repeats the map does not allow", () => {
    vi.useFakeTimers();
    try {
      const inputs = withSink(
        <HoldDpad
          directions={["right", "up"]}
          actions={{ right: "step", up: "jump" }}
        />,
        ACTIONS
      );
      const right = screen.getByRole("button", { name: "Move Right" });
      fireEvent.pointerDown(right, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      fireEvent.pointerUp(right, { pointerId: 1 });
      const up = screen.getByRole("button", { name: "Move Up" });
      fireEvent.pointerDown(up, { pointerId: 2 });
      act(() => {
        vi.advanceTimersByTime(400);
      });
      fireEvent.pointerUp(up, { pointerId: 2 });
      expect(inputs[0]).toBe("step:down:touch");
      expect(inputs).toContain("step:down:repeat:touch");
      expect(inputs).toContain("step:up:touch");
      // Jump does not repeat, so only its press and release arrive.
      expect(inputs.filter((i) => i.startsWith("jump"))).toEqual([
        "jump:down:touch",
        "jump:up:touch",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("gamepad", () => {
  function pad(pressed: number[], axes: number[] = [0, 0, 0, 0]): GamepadLike {
    return {
      index: 0,
      connected: true,
      buttons: Array.from({ length: 16 }, (_, i) => ({
        pressed: pressed.includes(i),
      })),
      axes,
    };
  }

  it("fires a button on its edge and repeats only actions that ask", () => {
    const inputs: string[] = [];
    const map = defineActions({
      jump: {
        kind: "press",
        keys: [],
        label: "Jump",
        gamepad: { buttons: [0] },
      },
      step: {
        kind: "press",
        keys: [],
        label: "Step",
        repeat: true,
        gamepad: { buttons: [15], axes: [{ index: 0, direction: 1 }] },
      },
    });
    const controller = new ActionInputController(map, (i) =>
      inputs.push(`${i.action}:${i.phase}${i.repeat ? ":repeat" : ""}`)
    );
    controller.pollGamepads([pad([0])], 0);
    controller.pollGamepads([pad([0])], 1000);
    controller.pollGamepads([pad([])], 1100);
    controller.pollGamepads([pad([], [0.9, 0])], 2000);
    controller.pollGamepads([pad([], [0.9, 0])], 2400);
    expect(inputs).toEqual(["jump:down", "step:down", "step:down:repeat"]);
  });

  it("drives an axis from the stick and the d-pad", () => {
    const values: unknown[] = [];
    const controller = new ActionInputController(ACTIONS, (i) => {
      if (i.action === "move") values.push(i.value);
    });
    controller.pollGamepads([pad([], [0.1, 0.05, 0, 0])], 0);
    controller.pollGamepads([pad([], [0.5, -0.5, 0, 0])], 16);
    controller.pollGamepads([pad([14])], 32);
    controller.pollGamepads([pad([])], 48);
    expect(values).toEqual([
      { x: 0.5, y: -0.5 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
    ]);
  });

  it("does not re-press a held button after a release-all", () => {
    const inputs: string[] = [];
    const controller = new ActionInputController(ACTIONS, (i) =>
      inputs.push(`${i.action}:${i.phase}`)
    );
    controller.pollGamepads([pad([0])], 0);
    controller.releaseAll();
    controller.pollGamepads([pad([0])], 16);
    controller.pollGamepads([pad([])], 32);
    controller.pollGamepads([pad([0])], 48);
    expect(inputs).toEqual(["jump:down", "jump:down"]);
  });
});
