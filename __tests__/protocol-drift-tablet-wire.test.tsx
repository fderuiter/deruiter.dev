// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import type { ChipNode } from "@/components/protocol-drift/graph-model";
import {
  CHIP_WIDTH,
  TOUCH_TITLE_PX,
  chipHeight,
  touchZoomFloor,
} from "@/components/protocol-drift/graph-model";
import { touchChipSpot } from "@/components/protocol-drift/PipelineCanvas";
import { CHIP_SPECS, type ChipKind } from "@/lib/protocol-drift";
import { installFlowMocks } from "./protocol-drift/ui-helpers";

const flow = vi.hoisted(() => ({
  fitView: vi.fn(),
  setViewport: vi.fn(),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    useReactFlow: () => ({
      fitView: flow.fitView,
      getViewport: () => ({ x: 0, y: 0, zoom: 0.8 }),
      setViewport: flow.setViewport,
      screenToFlowPosition: (p: { x: number; y: number }) => p,
    }),
  };
});

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

const store = () => useProtocolDriftStore.getState();

/** Renders the workbench on the touch cabinet and accepts the tracer brief. */
async function startDraft(touch = true) {
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
    flow.setViewport.mockClear();
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
    // Same-name pairs remain, so the sheet stays open and marks the wire.
    expect(store().wireSheet).toEqual({ source: extract, target: pivot });
    const wired = screen.getByRole("button", { name: "sbp to sbp, wired" });
    expect((wired as HTMLButtonElement).disabled).toBe(true);
    expect(sheet.textContent).toContain("1 of 5 matching fields wired.");
    for (const name of ["dbp to dbp", "pulse to pulse"]) {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name }));
      });
    }
    await waitFor(() => expect(store().edges.length).toBe(before + 3));
    // The standing pairs are still open, so Done closes the sheet.
    expect(store().wireSheet).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
    });
    expect(store().wireSheet).toBeNull();
    expect(screen.queryByTestId("touch-wire-sheet")).toBeNull();
  });

  it("Done closes the pair sheet and keeps the wires made", async () => {
    await startDraft();
    const [, extract, pivot] = await placeAll([
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
    ]);
    await act(async () => {
      await resolveTouchWire(extract, pivot);
    });
    const before = store().edges.length;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "sbp to sbp" }));
    });
    await waitFor(() => expect(store().edges.length).toBe(before + 1));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
    });
    expect(screen.queryByTestId("touch-wire-sheet")).toBeNull();
    expect(store().edges.length).toBe(before + 1);
    expect(store().notice?.text).toBe("Done wiring.");
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
      screen.getByText("Wiring from SourceIngest: pick a target")
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

  it("Fit frames the chips with fitView, at the floor and with padding", async () => {
    await startDraft();
    const [ingest] = await placeAll(["SourceIngest", "ExtractField"]);
    flow.fitView.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Fit$/ }));
    });
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    expect(flow.fitView.mock.calls[0][0]).toMatchObject({
      duration: 0,
      minZoom: touchZoomFloor(),
      maxZoom: 1,
    });
    expect(flow.fitView.mock.calls[0][0].padding).toBeGreaterThan(0);
    expect(flow.fitView.mock.calls[0][0].nodes).toEqual(
      expect.arrayContaining([{ id: ingest }])
    );
  });

  it("Fit with no chips frames the tabulation lane, never the empty world", async () => {
    await startDraft();
    await act(async () => {
      store().setNodes([]);
    });
    flow.fitView.mockClear();
    flow.setViewport.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Fit$/ }));
    });
    expect(flow.fitView).not.toHaveBeenCalled();
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

describe("touch chip placement (#2045)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    localStorage.clear();
    flow.setViewport.mockClear();
  });
  afterEach(() => {
    cleanup();
  });

  it("a chip added on touch never overlaps a chip already on the canvas", () => {
    const kinds = [
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
      "CDISCSink",
      "SourceIngest",
      "CDISCSink",
      "ExtractField",
    ] as const;
    const nodes: ChipNode[] = [];
    kinds.forEach((kind, i) => {
      const position = touchChipSpot(kind, nodes);
      nodes.push({
        id: `${kind}-${i}`,
        type: "chip",
        position,
        data: { kind },
      });
    });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const overlap =
          a.position.x < b.position.x + CHIP_WIDTH &&
          b.position.x < a.position.x + CHIP_WIDTH &&
          a.position.y < b.position.y + chipHeight(b.data.kind) &&
          b.position.y < a.position.y + chipHeight(a.data.kind);
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("a toolbox add on touch frames the chips and announces the add", async () => {
    await startDraft(true);
    flow.fitView.mockClear();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /add SourceIngest /i })
      );
    });
    await waitFor(() => expect(flow.fitView).toHaveBeenCalled());
    expect(flow.fitView.mock.calls.at(-1)?.[0].nodes).toHaveLength(1);
    expect(store().notice?.text).toBe("Added SourceIngest.");
  });

  it("the toolbox add on desktop frames the chips without a toast (#2167)", async () => {
    await startDraft(false);
    flow.fitView.mockClear();
    flow.setViewport.mockClear();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /add SourceIngest /i })
      );
    });
    await waitFor(() => expect(store().nodes.length).toBeGreaterThan(0));
    expect(flow.fitView).toHaveBeenCalled();
    expect(store().notice?.text ?? "").not.toMatch(/^Added /);
  });
});

describe("touch wire lists, independent of what is on screen (#2045)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("Choose target lists only the chips with a valid pair from the source", async () => {
    await startDraft(true);
    const kinds = Object.keys(CHIP_SPECS) as ChipKind[];
    const far = kinds.find(
      (kind) =>
        kind !== "SourceIngest" &&
        touchWirePairs("SourceIngest", kind).length === 0
    );
    expect(far).toBeDefined();
    const [ingest] = await placeAll(["SourceIngest", "ExtractField", far!]);
    await act(async () => {
      store().setWireFrom(ingest);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose target" }));
    });
    const sheet = screen.getByTestId("wire-target-sheet");
    expect(
      within(sheet).getByRole("button", { name: /^ExtractField/ })
    ).toBeTruthy();
    expect(
      within(sheet).queryByRole("button", {
        name: new RegExp(`^${far}\\b`),
      })
    ).toBeNull();
  });

  it("a target with one valid pair is wired at once from the list", async () => {
    await startDraft(true);
    const [ingest, extract] = await placeAll(["SourceIngest", "ExtractField"]);
    const before = store().edges.length;
    await act(async () => {
      store().setWireFrom(ingest);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose target" }));
    });
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId("wire-target-sheet")).getByRole("button", {
          name: /^ExtractField/,
        })
      );
    });
    await waitFor(() => expect(store().edges.length).toBe(before + 1));
    expect(screen.queryByTestId("wire-target-sheet")).toBeNull();
    expect(screen.queryByTestId("touch-wire-sheet")).toBeNull();
    expect(store().wireFrom).toBeNull();
    expect(extract).toBeTruthy();
  });

  it("a target with several valid pairs hands off to the pair sheet", async () => {
    await startDraft(true);
    const [, extract] = await placeAll([
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
    ]);
    await act(async () => {
      store().setWireFrom(extract);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose target" }));
    });
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId("wire-target-sheet")).getByRole("button", {
          name: /^PivotToObservation/,
        })
      );
    });
    expect(screen.queryByTestId("wire-target-sheet")).toBeNull();
    expect(screen.getByTestId("touch-wire-sheet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "sbp to sbp" })).toBeTruthy();
  });

  it("Wire... lists the chips that can start a wire, and picking one starts it", async () => {
    await startDraft(true);
    const [ingest] = await placeAll(["SourceIngest", "ExtractField"]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Wire…" }));
    });
    const sheet = screen.getByTestId("wire-source-sheet");
    await act(async () => {
      fireEvent.click(
        within(sheet).getByRole("button", { name: /^SourceIngest/ })
      );
    });
    expect(store().wireFrom).toBe(ingest);
    expect(screen.queryByTestId("wire-source-sheet")).toBeNull();
    expect(screen.getByRole("button", { name: "Choose target" })).toBeTruthy();
  });
});

describe("touch live text after a wire ends (#2045)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("Escape that cancels a wire replaces the live text", async () => {
    await startDraft(true);
    const [ingest] = await placeAll(["SourceIngest"]);
    await act(async () => {
      store().setWireFrom(ingest);
      store().notify("info", "Wiring from SourceIngest. Choose a target.");
    });
    await act(async () => {
      fireEvent.keyDown(
        document.querySelector<HTMLElement>("[data-game='protocol-drift']")!,
        { key: "Escape" }
      );
    });
    expect(store().wireFrom).toBeNull();
    expect(store().notice?.text).toBe("Wiring cancelled.");
  });

  it("closing the pair sheet replaces the live text", async () => {
    await startDraft(true);
    const [, extract, pivot] = await placeAll([
      "SourceIngest",
      "ExtractField",
      "PivotToObservation",
    ]);
    await act(async () => {
      await resolveTouchWire(extract, pivot);
    });
    expect(store().wireSheet).not.toBeNull();
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: "Close Wire ExtractField to PivotToObservation",
        })
      );
    });
    expect(store().wireSheet).toBeNull();
    expect(store().notice?.text).toBe("Wiring cancelled.");
  });
});
