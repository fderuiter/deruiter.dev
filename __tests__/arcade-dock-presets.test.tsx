// @vitest-environment jsdom
// #2359: touch-control presets on the action layer. Each preset takes action
// ids from the game's ActionMap, names its keys from it, sends through the
// nearest ActionSinkProvider, takes several fingers, lets go on blur, works
// from a keyboard, follows handedness and comes in three sizes.
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import axe from "axe-core";
import {
  ActionSinkProvider,
  defineActions,
  type ActionInput,
} from "@/lib/arcade";
import {
  ActionCluster,
  ActionDock,
  ActionStrip,
  DOCK_KEY_PX,
  DpadDock,
  DragPad,
  HoldButton,
  StickDock,
  axisVector,
  type DockSize,
} from "@/components/arcade/mobile/docks";

const ACTIONS = defineActions({
  moveUp: {
    kind: "press",
    keys: ["ArrowUp"],
    label: "Step north",
    repeat: true,
  },
  moveDown: { kind: "press", keys: ["ArrowDown"], label: "Step south" },
  moveLeft: { kind: "press", keys: ["ArrowLeft"], label: "Step west" },
  moveRight: { kind: "press", keys: ["ArrowRight"], label: "Step east" },
  move: {
    kind: "axis2d",
    keys: { up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"] },
    label: "Walk",
  },
  jump: { kind: "press", keys: ["Space"], label: "Jump" },
  dash: { kind: "press", keys: ["KeyX"], label: "Dash" },
  charge: { kind: "hold", keys: ["KeyC"], label: "Charge" },
  map: { kind: "press", keys: ["KeyM"], label: "Map" },
  bag: { kind: "press", keys: ["KeyB"], label: "Bag" },
  call: { kind: "press", keys: ["KeyK"], label: "Call" },
});
type Name = keyof typeof ACTIONS.actions;

const SIZES: readonly DockSize[] = ["sm", "md", "lg"];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function withSink(ui: React.ReactNode) {
  const inputs: ActionInput<Name>[] = [];
  const result = render(
    <ActionSinkProvider<Name>
      actions={ACTIONS}
      onAction={(input) => inputs.push(input)}
    >
      {ui}
    </ActionSinkProvider>
  );
  const log = () =>
    inputs.map((input) =>
      input.value
        ? `${input.action}:${input.value.x},${input.value.y}`
        : `${input.action}:${input.phase}${input.repeat ? "*" : ""}`
    );
  return { ...result, inputs, log };
}

const down = (el: Element, pointerId: number, x = 0, y = 0) =>
  fireEvent.pointerDown(el, { pointerId, clientX: x, clientY: y, button: 0 });
const move = (el: Element, pointerId: number, x: number, y: number) =>
  fireEvent.pointerMove(el, { pointerId, clientX: x, clientY: y });
const up = (el: Element, pointerId: number) =>
  fireEvent.pointerUp(el, { pointerId });

async function noAxeViolations(container: Element) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  });
  expect(result.violations).toEqual([]);
}

function box(el: Element, width: number, height: number, left = 0, top = 0) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("DpadDock (#2359)", () => {
  it("names each arrow from the map and repeats a held arrow as the keyboard does", () => {
    vi.useFakeTimers();
    const { log } = withSink(
      <DpadDock
        map={ACTIONS}
        actions={{
          up: "moveUp",
          down: "moveDown",
          left: "moveLeft",
          right: "moveRight",
        }}
      />
    );
    const north = screen.getByRole("button", { name: "Step north" });
    expect(screen.getByRole("button", { name: "Step east" })).toBeTruthy();
    down(north, 1);
    act(() => vi.advanceTimersByTime(1000));
    up(north, 1);
    const sent = log();
    expect(sent[0]).toBe("moveUp:down");
    expect(
      sent.filter((entry) => entry === "moveUp:down*").length
    ).toBeGreaterThan(0);
    expect(sent.at(-1)).toBe("moveUp:up");
  });

  it("adds up arrows held at once on an 8-way axis pad, and lets go on blur", () => {
    const { log } = withSink(<DpadDock map={ACTIONS} axis="move" ways={8} />);
    expect(screen.getAllByRole("button")).toHaveLength(8);
    const north = screen.getByRole("button", { name: "Walk: up" });
    const east = screen.getByRole("button", { name: "Walk: right" });
    down(north, 1);
    down(east, 2);
    expect(log().at(-1)).toBe("move:0.71,-0.71");
    up(north, 1);
    expect(log().at(-1)).toBe("move:1,0");
    fireEvent.blur(window);
    expect(log().at(-1)).toBe("move:0,0");
  });

  it("has no diagonals on a 4-way axis pad, and Enter presses an arrow", () => {
    const { log } = withSink(<DpadDock map={ACTIONS} axis="move" />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    const west = screen.getByRole("button", { name: "Walk: left" });
    fireEvent.keyDown(west, { key: "Enter" });
    fireEvent.keyUp(west, { key: "Enter" });
    expect(log()).toEqual(["move:-1,0", "move:0,0"]);
  });

  it.each(SIZES)("sizes its keys at %s", (size) => {
    withSink(<DpadDock map={ACTIONS} axis="move" size={size} />);
    const key = screen.getByRole("button", { name: "Walk: up" });
    const px = DOCK_KEY_PX[size];
    expect(px).toBeGreaterThanOrEqual(44);
    expect(key.className).toContain(
      size === "sm" ? "h-11 w-11" : `h-[${px}px] w-[${px}px]`
    );
  });

  it("has zero axe violations", async () => {
    const { container } = withSink(
      <main>
        <DpadDock map={ACTIONS} axis="move" ways={8} />
      </main>
    );
    await noAxeViolations(container);
  });
});

describe("StickDock and DragPad (#2359)", () => {
  it("reads a dead zone, then tilt up to the rim", () => {
    expect(axisVector(5, 0, 50, 0.15)).toEqual({ x: 0, y: 0 });
    expect(axisVector(50, 0, 50, 0.15)).toEqual({ x: 1, y: 0 });
    expect(axisVector(500, 0, 50, 0.15)).toEqual({ x: 1, y: 0 });
    expect(axisVector(0, -29, 50, 0.15).y).toBe(-0.51);
    expect(axisVector(0, 0, 50, 0.15)).toEqual({ x: 0, y: 0 });
  });

  it("steers from the stick's centre, follows only the first thumb, and returns to centre on release", () => {
    const { log } = withSink(<StickDock map={ACTIONS} action="move" />);
    const stick = screen.getByRole("group", { name: "Walk" });
    expect(stick.getAttribute("aria-roledescription")).toBe("stick");
    box(stick, 128, 128);
    down(stick, 1, 64, 64);
    move(stick, 1, 128, 64);
    // A second thumb on the stick is ignored.
    down(stick, 2, 0, 64);
    move(stick, 2, 0, 0);
    expect(log()).toEqual(["move:1,0"]);
    up(stick, 1);
    expect(log().at(-1)).toBe("move:0,0");
  });

  it("measures from where the thumb lands when floating", () => {
    const { log } = withSink(
      <StickDock map={ACTIONS} action="move" origin="floating" />
    );
    const stick = screen.getByRole("group", { name: "Walk" });
    box(stick, 128, 128);
    down(stick, 1, 100, 100);
    expect(log()).toEqual([]);
    move(stick, 1, 100, 36);
    expect(log()).toEqual(["move:0,-1"]);
  });

  it("lets go on blur and when the game pauses", () => {
    const { log, rerender } = withSink(
      <StickDock map={ACTIONS} action="move" />
    );
    const stick = screen.getByRole("group", { name: "Walk" });
    box(stick, 128, 128);
    down(stick, 1, 64, 64);
    move(stick, 1, 64, 0);
    fireEvent.blur(window);
    expect(log()).toEqual(["move:0,-1", "move:0,0"]);
    down(stick, 2, 64, 64);
    move(stick, 2, 128, 64);
    // The stick lets go before the provider takes its new handler.
    rerender(
      <ActionSinkProvider<Name> actions={ACTIONS} onAction={() => {}}>
        <StickDock map={ACTIONS} action="move" paused />
      </ActionSinkProvider>
    );
    expect(log().slice(-2)).toEqual(["move:1,0", "move:0,0"]);
  });

  it("steers with the arrow keys", () => {
    const { log } = withSink(<DragPad map={ACTIONS} action="move" />);
    const pad = screen.getByRole("group", { name: "Walk" });
    fireEvent.keyDown(pad, { key: "ArrowUp" });
    fireEvent.keyDown(pad, { key: "ArrowLeft" });
    fireEvent.keyUp(pad, { key: "ArrowUp" });
    fireEvent.keyUp(pad, { key: "ArrowLeft" });
    expect(log()).toEqual([
      "move:0,-1",
      "move:-0.71,-0.71",
      "move:-1,0",
      "move:0,0",
    ]);
  });

  it("drags relative to where the thumb lands on the pad", () => {
    const { log } = withSink(
      <DragPad map={ACTIONS} action="move" reach={40} />
    );
    const pad = screen.getByRole("group", { name: "Walk" });
    expect(pad.getAttribute("aria-roledescription")).toBe("drag pad");
    box(pad, 300, 140);
    down(pad, 7, 250, 20);
    move(pad, 7, 290, 20);
    up(pad, 7);
    expect(log()).toEqual(["move:1,0", "move:0,0"]);
  });

  it.each(SIZES)("sizes the stick and the pad at %s", (size) => {
    withSink(
      <>
        <StickDock map={ACTIONS} action="move" size={size} />
        <DragPad map={ACTIONS} action="move" size={size} />
      </>
    );
    const stick = screen.getByTestId("dock-stick");
    const pad = screen.getByTestId("dock-drag-pad");
    const stickPx = parseInt(stick.style.width, 10);
    expect(stickPx).toBeGreaterThanOrEqual(112);
    expect(parseInt(pad.style.minHeight, 10)).toBe(stickPx);
  });

  it("has zero axe violations", async () => {
    const { container } = withSink(
      <main>
        <StickDock map={ACTIONS} action="move" />
        <DragPad map={ACTIONS} action="dash" />
      </main>
    );
    await noAxeViolations(container);
  });
});

describe("ActionCluster (#2359)", () => {
  const cluster = (handedness?: "left" | "right", size?: DockSize) => (
    <ActionCluster
      map={ACTIONS}
      actions={["jump", "dash", "map", "bag", "call"]}
      handedness={handedness}
      size={size}
    />
  );

  it("holds four actions at most, named from the map", () => {
    withSink(cluster());
    expect(
      screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))
    ).toEqual(["Jump", "Dash", "Map", "Bag"]);
  });

  it("takes a finger per button and Enter or Space from a keyboard", () => {
    const { log } = withSink(cluster());
    const jump = screen.getByRole("button", { name: "Jump" });
    const dash = screen.getByRole("button", { name: "Dash" });
    down(jump, 1);
    down(dash, 2);
    up(jump, 1);
    up(dash, 2);
    fireEvent.keyDown(jump, { key: " " });
    fireEvent.keyUp(jump, { key: " " });
    expect(log()).toEqual([
      "jump:down",
      "dash:down",
      "jump:up",
      "dash:up",
      "jump:down",
      "jump:up",
    ]);
  });

  it("releases everything held when the window blurs", () => {
    const { log } = withSink(cluster());
    down(screen.getByRole("button", { name: "Jump" }), 1);
    down(screen.getByRole("button", { name: "Dash" }), 2);
    fireEvent.blur(window);
    expect(log().slice(2).sort()).toEqual(["dash:up", "jump:up"]);
  });

  it("mirrors the arc for a left thumb", () => {
    const { rerender } = withSink(cluster("right"));
    const column = (name: string) =>
      screen.getByRole("button", { name }).style.gridColumn;
    expect(column("Dash")).toBe("3");
    expect(column("Map")).toBe("1");
    rerender(
      <ActionSinkProvider actions={ACTIONS} onAction={() => {}}>
        {cluster("left")}
      </ActionSinkProvider>
    );
    expect(column("Dash")).toBe("1");
    expect(column("Map")).toBe("3");
  });

  it.each(SIZES)("sizes its buttons at %s", (size) => {
    withSink(cluster("right", size));
    const px = DOCK_KEY_PX[size];
    expect(screen.getByRole("button", { name: "Jump" }).className).toContain(
      size === "sm" ? "h-11 w-11" : `h-[${px}px] w-[${px}px]`
    );
  });

  it("has zero axe violations", async () => {
    const { container } = withSink(<main>{cluster()}</main>);
    await noAxeViolations(container);
  });
});

describe("ActionStrip (#2359)", () => {
  it("shows the first actions in a row and the rest behind More", () => {
    const { log } = withSink(
      <ActionStrip
        map={ACTIONS}
        actions={["jump", "dash", "map", "bag", "call"]}
        max={4}
      />
    );
    const group = screen.getByRole("group", { name: "Actions" });
    expect(
      Array.from(group.querySelectorAll("[data-dock-action]")).map((el) =>
        el.getAttribute("aria-label")
      )
    ).toEqual(["Jump", "Dash", "Map"]);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = screen.getByRole("dialog", { name: "More actions" });
    fireEvent.click(
      Array.from(sheet.querySelectorAll("button")).find(
        (b) => b.textContent === "Call"
      )!
    );
    expect(log()).toEqual(["call:down", "call:up"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has no More key when everything fits, and takes several fingers", () => {
    const { log } = withSink(
      <ActionStrip map={ACTIONS} actions={["jump", "dash"]} />
    );
    expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    down(screen.getByRole("button", { name: "Jump" }), 1);
    down(screen.getByRole("button", { name: "Dash" }), 2);
    fireEvent.blur(window);
    expect(log().slice(0, 2)).toEqual(["jump:down", "dash:down"]);
    expect(log().slice(2).sort()).toEqual(["dash:up", "jump:up"]);
  });

  it.each(SIZES)("sizes its keys at %s", (size) => {
    withSink(<ActionStrip map={ACTIONS} actions={["jump"]} size={size} />);
    const key = screen.getByRole("button", { name: "Jump" });
    expect(key.style.height).toBe(`${DOCK_KEY_PX[size]}px`);
  });

  it("has zero axe violations, with the More sheet open", async () => {
    const { container } = withSink(
      <main>
        <ActionStrip
          map={ACTIONS}
          actions={["jump", "dash", "map", "bag", "call"]}
        />
      </main>
    );
    await noAxeViolations(container);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    await noAxeViolations(container);
  });
});

describe("HoldButton (#2359)", () => {
  it("holds while any finger rests on it, and works with Enter", () => {
    const { log } = withSink(<HoldButton map={ACTIONS} action="charge" />);
    const charge = screen.getByRole("button", { name: "Charge" });
    down(charge, 1);
    down(charge, 2);
    expect(charge.hasAttribute("data-held")).toBe(true);
    up(charge, 1);
    expect(log()).toEqual(["charge:down"]);
    up(charge, 2);
    fireEvent.keyDown(charge, { key: "Enter" });
    fireEvent.keyUp(charge, { key: "Enter" });
    expect(log()).toEqual([
      "charge:down",
      "charge:up",
      "charge:down",
      "charge:up",
    ]);
    expect(charge.hasAttribute("data-held")).toBe(false);
  });

  it("lets go when the window blurs", () => {
    const { log } = withSink(<HoldButton map={ACTIONS} action="charge" />);
    down(screen.getByRole("button", { name: "Charge" }), 1);
    fireEvent.blur(window);
    expect(log()).toEqual(["charge:down", "charge:up"]);
  });

  it.each(SIZES)("is a key tall and two wide at %s", (size) => {
    withSink(<HoldButton map={ACTIONS} action="charge" size={size} />);
    const charge = screen.getByRole("button", { name: "Charge" });
    expect(charge.style.height).toBe(`${DOCK_KEY_PX[size]}px`);
    expect(charge.style.minWidth).toBe(`${DOCK_KEY_PX[size] * 2}px`);
  });

  it("has zero axe violations", async () => {
    const { container } = withSink(
      <main>
        <HoldButton map={ACTIONS} action="charge" />
      </main>
    );
    await noAxeViolations(container);
  });
});

describe("ActionDock (#2359)", () => {
  it("puts movement under the left thumb, and swaps for a left-handed player", () => {
    const sides = () =>
      Array.from(document.querySelectorAll("[data-dock-side]")).map((el) =>
        el.getAttribute("data-dock-side")
      );
    const dock = (handedness: "left" | "right") => (
      <ActionDock
        handedness={handedness}
        move={<DpadDock map={ACTIONS} axis="move" />}
        actions={<ActionCluster map={ACTIONS} actions={["jump"]} />}
      />
    );
    const { rerender, container } = withSink(dock("right"));
    expect(sides()).toEqual(["move", "actions"]);
    const frame = container.querySelector("[data-handedness]")!;
    expect(frame.className).toContain("flex-row ");
    rerender(
      <ActionSinkProvider actions={ACTIONS} onAction={() => {}}>
        {dock("left")}
      </ActionSinkProvider>
    );
    expect(container.querySelector("[data-handedness]")!.className).toContain(
      "flex-row-reverse"
    );
  });

  it("reports the tallest dock as --layout-dock-height on its stage", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const height = this.dataset.dockPreset === "dpad" ? 168 : 60;
        return { height, width: 100, top: 0, left: 0 } as DOMRect;
      }
    );
    const { unmount } = withSink(
      <div className="arcade-stage" data-testid="stage">
        <DpadDock map={ACTIONS} axis="move" />
        <HoldButton map={ACTIONS} action="charge" />
      </div>
    );
    const stage = screen.getByTestId("stage");
    expect(stage.style.getPropertyValue("--layout-dock-height")).toBe("168px");
    unmount();
    expect(stage.style.getPropertyValue("--layout-dock-height")).toBe("");
  });
});
