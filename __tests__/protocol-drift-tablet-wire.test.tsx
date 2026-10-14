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
import { placeChip } from "@/components/protocol-drift/PipelineCanvas";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import { resolveTouchWire } from "@/components/protocol-drift/touch-wire";
import { CabinetTouchContext } from "@/components/arcade/mobile/CabinetTouchContext";
import {
  groupTouchWirePairs,
  touchWirePairs,
} from "@/components/protocol-drift/touch-wire";
import {
  TOUCH_TITLE_PX,
  chipHeight,
  touchZoomFloor,
} from "@/components/protocol-drift/graph-model";
import { CHIP_SPECS, type ChipKind } from "@/lib/protocol-drift";
import { installFlowMocks } from "./protocol-drift/ui-helpers";

const flow = vi.hoisted(() => ({ fitView: vi.fn() }));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useReactFlow: () => ({
      fitView: flow.fitView,
      setViewport: vi.fn(),
      screenToFlowPosition: (p: { x: number; y: number }) => p,
    }),
  };
});

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

const store = () => useProtocolDriftStore.getState();

/** Renders the workbench on the touch cabinet and accepts the tracer brief. */
async function startDraft() {
  render(
    <CabinetTouchContext.Provider value={true}>
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

/** Places chips by tap (the toolbox buttons) and returns their node ids. */
async function placeAll(kinds: Parameters<typeof placeChip>[0][]) {
  for (const kind of kinds) {
    const before = store().nodes.length;
    await act(async () => {
      placeChip(kind);
    });
    await waitFor(() => expect(store().nodes.length).toBe(before + 1));
  }
  return store().nodes.map((node) => node.id);
}

describe("Protocol Drift tap-to-wire on the touch cabinet (#2045)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    localStorage.clear();
    flow.fitView.mockClear();
  });
  afterEach(() => {
    cleanup();
  });

  it("one valid pair wires at once, with no sheet", async () => {
    await startDraft();
    const [ingest, extract] = await placeAll(["SourceIngest", "ExtractField"]);
    const kinds = ["SourceIngest", "ExtractField"] as const;
    expect(touchWirePairs(kinds[0], kinds[1])).toHaveLength(1);
    const before = store().edges.length;
    await act(async () => {
      store().setWireFrom(ingest);
      await resolveTouchWire(ingest, extract);
    });
    expect(store().edges.length).toBe(before + 1);
    expect(store().wireFrom).toBeNull();
    expect(store().wireSheet).toBeNull();
    expect(store().notice?.text).toContain("Wired SourceIngest.raw_entry");
  });

  it("several valid pairs open a sheet, and picking one wires it", async () => {
    await startDraft();
    const [, extract, pivot] = await placeAll([
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
    ]);
    expect(
      touchWirePairs("ExtractField", "PivotToObservation").length
    ).toBeGreaterThan(1);
    await act(async () => {
      await resolveTouchWire(extract, pivot);
    });
    expect(store().wireSheet).toEqual({ source: extract, target: pivot });
    const sheet = screen.getByTestId("touch-wire-sheet");
    expect(sheet.getAttribute("role")).toBe("dialog");
    const before = store().edges.length;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "sbp to sbp" }));
    });
    await waitFor(() => expect(store().edges.length).toBe(before + 1));
    expect(store().wireSheet).toBeNull();
    expect(screen.queryByTestId("touch-wire-sheet")).toBeNull();
  });

  it("a pair that no port accepts is reported, and nothing is wired", async () => {
    await startDraft();
    const [ingest, , , sink] = await placeAll([
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
      "CDISCSink",
    ]);
    const before = store().edges.length;
    await act(async () => {
      await resolveTouchWire(sink, ingest);
    });
    expect(store().edges.length).toBe(before);
    expect(store().notice?.text).toContain("No wire can run");
    expect(store().wireFrom).toBeNull();
  });

  it("the wire-from action starts a wire, and Cancel stops it", async () => {
    await startDraft();
    const [ingest] = await placeAll(["SourceIngest"]);
    await act(async () => {
      store().setNodes(
        store().nodes.map((node) => ({ ...node, selected: node.id === ingest }))
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Wire from SourceIngest" })
      );
    });
    expect(store().wireFrom).toBe(ingest);
    expect(
      screen.getByText(/Wiring from SourceIngest: tap a target chip/)
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel wiring" }));
    });
    expect(store().wireFrom).toBeNull();
  });

  it("Escape cancels a started wire without leaving the cabinet", async () => {
    await startDraft();
    const [ingest] = await placeAll(["SourceIngest"]);
    const root = document.querySelector<HTMLElement>(
      "[data-game='protocol-drift']"
    )!;
    await act(async () => {
      store().setWireFrom(ingest);
    });
    expect(root.getAttribute("data-escape-docks")).toBe("true");
    await act(async () => {
      fireEvent.keyDown(root, { key: "Escape" });
    });
    expect(store().wireFrom).toBeNull();
    expect(root.hasAttribute("data-escape-docks")).toBe(false);
  });

  it("the Fit button frames the whole pipeline with fitView", async () => {
    await startDraft();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Fit$/ }));
    });
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    expect(flow.fitView.mock.calls[0][0]).toMatchObject({
      duration: 0,
      minZoom: touchZoomFloor(),
      maxZoom: 1,
    });
  });

  it("the zoom floor keeps the shortest chip 44px and its title 12px on screen", () => {
    const floor = touchZoomFloor();
    const kinds = Object.keys(CHIP_SPECS) as ChipKind[];
    const shortest = Math.min(...kinds.map((kind) => chipHeight(kind)));
    expect(shortest * floor).toBeGreaterThanOrEqual(44);
    expect(TOUCH_TITLE_PX * floor).toBeGreaterThanOrEqual(12);
  });

  it("a wire can not be started while the clock runs, and the reason is shown", async () => {
    await startDraft();
    const [ingest] = await placeAll(["SourceIngest"]);
    const previous = store().snapshot;
    await act(async () => {
      store().setNodes(
        store().nodes.map((node) => ({ ...node, selected: node.id === ingest }))
      );
      useProtocolDriftStore.setState({
        snapshot: { ...previous!, fsmState: "RUNNING" },
      });
    });
    try {
      const wire = screen.getByRole("button", {
        name: "Wire from SourceIngest",
      });
      expect((wire as HTMLButtonElement).disabled).toBe(true);
      expect(
        screen.getByText("Pause the clock to rewire").getAttribute("aria-live")
      ).toBe("polite");
      expect(store().wireFrom).toBeNull();
    } finally {
      await act(async () => {
        useProtocolDriftStore.setState({ snapshot: previous });
      });
    }
  });

  it("same-name pairs are grouped first, and the other pairs wait behind Show all", async () => {
    await startDraft();
    const [, extract, pivot] = await placeAll([
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
    ]);
    const grouped = groupTouchWirePairs(
      touchWirePairs("ExtractField", "PivotToObservation")
    );
    expect(
      grouped.matching.map((p) => `${p.sourceHandle} to ${p.targetHandle}`)
    ).toEqual(
      expect.arrayContaining(["sbp to sbp", "dbp to dbp", "pulse to pulse"])
    );
    expect(grouped.other.length).toBeGreaterThan(0);
    await act(async () => {
      await resolveTouchWire(extract, pivot);
    });
    expect(screen.getByText("Matching fields")).toBeTruthy();
    expect(screen.getByRole("button", { name: "sbp to sbp" })).toBeTruthy();
    const showAll = screen.getByRole("button", { name: "Show all" });
    expect(showAll.getAttribute("aria-expanded")).toBe("false");
    const firstOther = grouped.other[0];
    const otherName = `${firstOther.sourceHandle} to ${firstOther.targetHandle}`;
    expect(screen.queryByRole("button", { name: otherName })).toBeNull();
    await act(async () => {
      fireEvent.click(showAll);
    });
    expect(screen.getByText("Other pairs")).toBeTruthy();
    expect(screen.getByRole("button", { name: otherName })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Show all" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });
});

describe("touch pair grouping", () => {
  it("puts same-name pairs first and splits the rest", () => {
    const grouped = groupTouchWirePairs([
      { sourceHandle: "a", targetHandle: "b" },
      { sourceHandle: "x", targetHandle: "x" },
    ]);
    expect(grouped.matching).toEqual([
      { sourceHandle: "x", targetHandle: "x" },
    ]);
    expect(grouped.other).toEqual([{ sourceHandle: "a", targetHandle: "b" }]);
  });
});
