import React, { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  PhoneStage,
  TabletStage,
  useStageFit,
  type UseStageFitOptions,
  type UseStageFitResult,
} from "@/components/arcade/stage";
import { CounterSessionHolder } from "./fixtures/three-view-game/session";
import PhoneView from "./fixtures/three-view-game/PhoneView";
import TabletView from "./fixtures/three-view-game/TabletView";

/** A ResizeObserver double the test fires by hand. */
class ManualResizeObserver {
  static instances: ManualResizeObserver[] = [];
  readonly targets: Element[] = [];
  disconnected = false;
  constructor(private readonly callback: ResizeObserverCallback) {
    ManualResizeObserver.instances.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    this.callback([], fromPartial<ResizeObserver>({}));
  }
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalMatchMedia = window.matchMedia;
const originalDpr = window.devicePixelRatio;

/** Matches `(orientation: portrait)` when `portrait` is set; nothing else. */
function stubViewport(portrait: boolean) {
  const listeners: Array<() => void> = [];
  window.matchMedia = vi.fn((query: string) =>
    fromPartial<MediaQueryList>({
      matches: portrait && query === "(orientation: portrait)",
      media: query,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.push(listener);
      },
      removeEventListener: vi.fn(),
    })
  );
  return listeners;
}

function setDpr(value: number) {
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value,
  });
}

/** Sizes every element's bounding box; returns a setter for later sizes. */
function stubSlot(width: number, height: number) {
  const size = { width, height };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () =>
      fromPartial<DOMRect>({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: size.width,
        height: size.height,
        right: size.width,
        bottom: size.height,
      })
  );
  return (nextWidth: number, nextHeight: number) => {
    size.width = nextWidth;
    size.height = nextHeight;
  };
}

const MAZE_OPTIONS: UseStageFitOptions = {
  aspect: { width: 240, height: 144 },
  scale: "fractional",
};

function Probe({
  options,
  onResult,
}: {
  options: UseStageFitOptions;
  onResult: (result: UseStageFitResult) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const result = useStageFit(ref, options);
  onResult(result);
  return (
    <div ref={ref} data-testid="slot">
      <span data-testid="box">
        {result.fit ? `${result.fit.cssWidth}x${result.fit.cssHeight}` : "none"}
      </span>
    </div>
  );
}

function renderProbe(options: UseStageFitOptions = MAZE_OPTIONS) {
  const results: UseStageFitResult[] = [];
  const view = render(
    <Probe options={options} onResult={(result) => results.push(result)} />
  );
  return { ...view, latest: () => results[results.length - 1], results };
}

beforeAll(() => {
  globalThis.ResizeObserver = ManualResizeObserver;
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  window.matchMedia = originalMatchMedia;
  setDpr(originalDpr);
});

beforeEach(() => {
  ManualResizeObserver.instances = [];
  stubViewport(false);
  setDpr(1);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useStageFit", () => {
  it("has no fit until the slot has a size", () => {
    stubSlot(0, 0);
    const { latest } = renderProbe();
    expect(latest().fit).toBeNull();
    expect(screen.getByTestId("box").textContent).toBe("none");
  });

  it("measures on mount and fits the largest fractional box", () => {
    stubSlot(500, 320);
    setDpr(2);
    const { latest } = renderProbe();
    expect(latest().slot).toEqual({ width: 500, height: 320 });
    expect(latest().fit).toMatchObject({
      cssWidth: 500,
      cssHeight: 300,
      backingWidth: 1000,
      backingHeight: 600,
      dpr: 2,
    });
  });

  it("snaps an integer box to whole device pixels per game unit", () => {
    stubSlot(500, 300);
    const { latest } = renderProbe({ ...MAZE_OPTIONS, scale: "integer" });
    expect(latest().fit).toMatchObject({
      scale: 2,
      cssWidth: 480,
      cssHeight: 288,
      backingWidth: 480,
    });
  });

  it("caps the device pixel ratio at 2 unless told otherwise", () => {
    stubSlot(500, 300);
    setDpr(3);
    const capped = renderProbe();
    expect(capped.latest().fit?.backingWidth).toBe(1000);
    cleanup();
    const lifted = renderProbe({
      ...MAZE_OPTIONS,
      maxDpr: Number.POSITIVE_INFINITY,
    });
    expect(lifted.latest().fit?.backingWidth).toBe(1500);
  });

  it("refits when the width changes or the height shrinks, not when it only grows", () => {
    const resize = stubSlot(500, 300);
    const { latest } = renderProbe();
    const observer = ManualResizeObserver.instances[0];
    expect(observer.targets).toHaveLength(1);

    // The URL bar collapses: the slot grows taller, the box stays.
    resize(500, 360);
    act(() => observer.fire());
    expect(latest().slot).toEqual({ width: 500, height: 300 });

    // The URL bar returns past the start: the box must shrink to fit.
    resize(500, 240);
    act(() => observer.fire());
    expect(latest().slot).toEqual({ width: 500, height: 240 });
    expect(latest().fit?.cssHeight).toBeLessThanOrEqual(240);

    // A rotation changes the width: the full slot is taken again.
    resize(320, 500);
    act(() => observer.fire());
    expect(latest().fit?.cssWidth).toBe(320);
  });

  it("does not re-render when an observation changes nothing", () => {
    stubSlot(500, 300);
    const { results } = renderProbe();
    const before = results.length;
    act(() => ManualResizeObserver.instances[0].fire());
    expect(results.length).toBe(before);
  });

  it("keeps the last fit when the slot collapses to nothing", () => {
    const resize = stubSlot(500, 300);
    const { latest } = renderProbe();
    resize(0, 0);
    act(() => ManualResizeObserver.instances[0].fire());
    expect(latest().fit?.cssWidth).toBe(500);
  });

  it("maps pointer positions through the canvas rect", () => {
    stubSlot(480, 288);
    const { latest } = renderProbe();
    const rect = { left: 10, top: 10, width: 480, height: 288 };
    expect(latest().toGame(250, 154, rect)).toEqual({
      x: 120,
      y: 72,
      inside: true,
    });
    expect(latest().toClient(120, 72, rect)).toEqual({ x: 250, y: 154 });
    expect(latest().toGame(0, 0, { ...rect, width: 0 })).toBeNull();
  });

  it("disconnects its observer on unmount", () => {
    stubSlot(500, 300);
    const { unmount } = renderProbe();
    const observer = ManualResizeObserver.instances[0];
    unmount();
    expect(observer.disconnected).toBe(true);
  });

  it("follows the slot to a new element", () => {
    stubSlot(500, 300);
    function Mover({ inner }: { inner: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      const { fit } = useStageFit(ref, MAZE_OPTIONS);
      const slot = (
        <div ref={ref} data-testid="moving-slot">
          {fit?.cssWidth}
        </div>
      );
      return inner ? <section>{slot}</section> : slot;
    }
    const { rerender } = render(<Mover inner={false} />);
    const first = ManualResizeObserver.instances[0];
    rerender(<Mover inner />);
    expect(first.disconnected).toBe(true);
    const second = ManualResizeObserver.instances[1];
    expect(second.targets[0]).toBe(screen.getByTestId("moving-slot"));
    expect(screen.getByTestId("moving-slot").textContent).toBe("500");
  });

  it("refits when the device pixel ratio changes", () => {
    const listeners = stubViewport(false);
    stubSlot(500, 300);
    const { latest } = renderProbe();
    expect(latest().fit?.backingWidth).toBe(500);
    setDpr(2);
    act(() => {
      for (const listener of [...listeners]) listener();
    });
    expect(latest().fit?.backingWidth).toBe(1000);
  });
});

describe("PhoneStage", () => {
  function renderPhone(
    props: Partial<React.ComponentProps<typeof PhoneStage>> = {}
  ) {
    return render(
      <PhoneStage
        hud={<span>HUD</span>}
        moveDock={<button type="button">Move</button>}
        actionDock={<button type="button">Fire</button>}
        {...props}
      >
        <canvas aria-label="Playfield" />
      </PhoneStage>
    );
  }

  it("renders the HUD row, the stage and both docks in reading order", () => {
    const { container } = renderPhone();
    const stage = container.querySelector(".arcade-stage");
    expect(stage?.getAttribute("data-stage")).toBe("phone");
    expect(stage?.getAttribute("data-handedness")).toBe("right");
    expect(stage?.querySelector(".arcade-stage-hud")?.textContent).toBe("HUD");
    const order = [
      ...container.querySelectorAll("[data-dock], [data-stage-slot]"),
    ].map((el) => el.getAttribute("data-dock") ?? "stage");
    expect(order).toEqual(["move", "stage", "action"]);
    expect(
      screen.getByLabelText("Playfield").closest("[data-stage-slot]")
    ).not.toBeNull();
  });

  it("follows the viewport's orientation, or the one it is given", () => {
    stubViewport(true);
    const portrait = renderPhone();
    expect(
      portrait.container
        .querySelector(".arcade-stage")
        ?.getAttribute("data-stage-orientation")
    ).toBe("portrait");
    cleanup();
    const forced = renderPhone({ orientation: "landscape" });
    expect(
      forced.container
        .querySelector(".arcade-stage")
        ?.getAttribute("data-stage-orientation")
    ).toBe("landscape");
  });

  it("leaves out slots it is not given", () => {
    const { container } = render(
      <PhoneStage>
        <canvas />
      </PhoneStage>
    );
    expect(container.querySelector(".arcade-stage-hud")).toBeNull();
    expect(container.querySelector("[data-dock]")).toBeNull();
    expect(container.querySelector(".arcade-stage-status")).toBeNull();
  });

  it("adds slot classes without dropping its own", () => {
    const { container } = renderPhone({
      handedness: "left",
      portraitFill: "dock",
      className: "[--arcade-stage-edge:4px]",
      classNames: { hud: "border-b", moveDock: "portrait:grid" },
      status: <p>Room status</p>,
    });
    const stage = container.querySelector(".arcade-stage");
    expect(stage?.className).toBe("arcade-stage [--arcade-stage-edge:4px]");
    expect(stage?.getAttribute("data-handedness")).toBe("left");
    expect(stage?.getAttribute("data-portrait-fill")).toBe("dock");
    expect(container.querySelector(".arcade-stage-hud")?.className).toBe(
      "arcade-stage-hud border-b"
    );
    expect(container.querySelector('[data-dock="move"]')?.className).toBe(
      "arcade-stage-dock portrait:grid"
    );
    expect(screen.getByText("Room status").parentElement?.className).toBe(
      "arcade-stage-status"
    );
  });
});

describe("TabletStage", () => {
  it("adds a named side panel on the side it is given", () => {
    const { container } = render(
      <TabletStage
        panel={<p>Run stats</p>}
        panelSide="left"
        panelLabel="Run stats"
        dockAlign="end"
      >
        <canvas />
      </TabletStage>
    );
    const stage = container.querySelector(".arcade-stage");
    expect(stage?.getAttribute("data-stage")).toBe("tablet");
    expect(stage?.getAttribute("data-dock-align")).toBe("end");
    const panel = screen.getByRole("group", { name: "Run stats" });
    expect(panel.getAttribute("data-panel-side")).toBe("left");
  });

  it("renders an unnamed panel as a plain container", () => {
    const { container } = render(
      <TabletStage panel={<p>Notes</p>}>
        <canvas />
      </TabletStage>
    );
    const panel = container.querySelector(".arcade-stage-panel");
    expect(panel?.getAttribute("role")).toBeNull();
    expect(panel?.getAttribute("data-panel-side")).toBe("right");
  });
});

describe("the three-view fixture game", () => {
  it("hosts its phone and tablet views in the stages", () => {
    const phone = render(
      <CounterSessionHolder>
        <PhoneView />
      </CounterSessionHolder>
    );
    const phoneStage = phone.container.querySelector('[data-stage="phone"]');
    expect(
      phoneStage?.querySelector("[data-stage-slot]")?.textContent
    ).toContain("Phone view: 0");
    cleanup();
    render(
      <CounterSessionHolder>
        <TabletView />
      </CounterSessionHolder>
    );
    expect(screen.getByRole("group", { name: "Fixture panel" })).toBeTruthy();
    expect(
      screen.getByText("Tablet view: 0").closest('[data-stage="tablet"]')
    ).not.toBeNull();
  });
});
