// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ProtocolDriftGame } from "@/components/protocol-drift/ProtocolDriftGame";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import { CabinetTouchContext } from "@/components/arcade/mobile/CabinetTouchContext";
import { CHIP_WIDTH, clampChip } from "@/components/protocol-drift/graph-model";
import { CHIP_DRAG_TYPE } from "@/components/protocol-drift/PipelineCanvas";
import { LONG_PRESS_MS } from "@/components/arcade/mobile/gesture";
import { installFlowMocks } from "./ui-helpers";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useReactFlow: () => ({
      fitView: vi.fn(),
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      setViewport: vi.fn(),
      screenToFlowPosition: (p: { x: number; y: number }) => p,
    }),
  };
});

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

const store = () => useProtocolDriftStore.getState();
const chip = (kind: string) =>
  screen.getByRole("button", { name: new RegExp(`add ${kind} `, "i") });
const status = () => screen.getByTestId("chip-pick-status");
const pane = () => document.querySelector<HTMLElement>(".react-flow__pane")!;

async function startTracer(touch: boolean) {
  render(
    <CabinetTouchContext.Provider value={touch}>
      <ProtocolDriftGame />
    </CabinetTouchContext.Provider>
  );
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Tracer bullet/));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /accept assignment/i }));
  });
}

/** A still finger held on the element past the long-press time. */
async function longPress(el: HTMLElement, pointerType = "touch") {
  const at = { pointerId: 7, pointerType, clientX: 10, clientY: 10 };
  fireEvent.pointerDown(el, at);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, LONG_PRESS_MS + 50));
  });
  fireEvent.pointerUp(el, at);
  // The browser's click after the press; the gesture swallows it.
  await act(async () => {
    fireEvent.click(el);
  });
}

describe("Protocol Drift toolbox tap-to-pick, tap-to-place (#2360)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("on touch a long-press picks a chip and a tap on the canvas places it there", async () => {
    await startTracer(true);
    expect(screen.getByText("Hold a chip to place it")).toBeTruthy();
    const source = chip("SourceIngest");
    expect(source.getAttribute("aria-pressed")).toBe("false");

    await longPress(source);
    // The long-press picked the chip and its trailing click added nothing.
    expect(store().nodes).toHaveLength(0);
    expect(source.getAttribute("aria-pressed")).toBe("true");
    expect(status().textContent).toMatch(/^Picked SourceIngest chip\./);
    expect(screen.getByTestId("chip-pick-banner").textContent).toContain(
      "Tap the canvas to place SourceIngest."
    );

    await act(async () => {
      fireEvent.click(pane(), { clientX: 400, clientY: 300 });
    });
    await waitFor(() => expect(store().nodes).toHaveLength(1));
    expect(store().nodes[0].position).toEqual(
      clampChip("SourceIngest", { x: 400 - CHIP_WIDTH / 2, y: 280 })
    );
    expect(status().textContent).toBe(
      "Placed SourceIngest chip on the canvas."
    );
    expect(source.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByTestId("chip-pick-banner")).toBeNull();
  });

  it("a tap on the picked chip, the banner's Cancel or Escape puts it back", async () => {
    await startTracer(true);
    const source = chip("SourceIngest");

    await longPress(source);
    await act(async () => {
      fireEvent.click(source);
    });
    expect(status().textContent).toBe("Put SourceIngest chip back.");
    expect(store().nodes).toHaveLength(0);

    await longPress(source);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    expect(source.getAttribute("aria-pressed")).toBe("false");

    await longPress(source);
    const root = document.querySelector<HTMLElement>(
      "[data-game='protocol-drift']"
    )!;
    expect(root.dataset.escapeDocks).toBe("true");
    await act(async () => {
      fireEvent.keyDown(root, { key: "Escape" });
    });
    expect(source.getAttribute("aria-pressed")).toBe("false");
    expect(store().nodes).toHaveLength(0);
  });

  it("a Pencil long-press picks like a finger (ADR 0061)", async () => {
    await startTracer(true);
    const extract = chip("ExtractField");
    await longPress(extract, "pen");
    expect(extract.getAttribute("aria-pressed")).toBe("true");
  });

  it("a plain tap on touch still adds the chip at a clear spot", async () => {
    await startTracer(true);
    await act(async () => {
      fireEvent.click(chip("SourceIngest"));
    });
    await waitFor(() => expect(store().nodes).toHaveLength(1));
  });

  it("desktop keeps drag and click-to-add and has no pick", async () => {
    await startTracer(false);
    const source = chip("SourceIngest");
    expect(source.getAttribute("draggable")).toBe("true");
    expect(source.hasAttribute("aria-pressed")).toBe(false);
    expect(screen.queryByText("Hold a chip to place it")).toBeNull();

    // A mouse long-press does not pick on desktop: the click still adds.
    await longPress(source, "mouse");
    await act(async () => {
      fireEvent.click(source);
    });
    await waitFor(() => expect(store().nodes.length).toBeGreaterThan(0));
    expect(screen.queryByTestId("chip-pick-banner")).toBeNull();

    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      effectAllowed: "",
    };
    fireEvent.dragStart(chip("ExtractField"), { dataTransfer });
    expect(data.get(CHIP_DRAG_TYPE)).toBe("ExtractField");
  });
});
