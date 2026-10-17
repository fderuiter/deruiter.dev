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
import {
  CHIP_WIDTH,
  chipHeight,
  type ChipNode,
} from "@/components/protocol-drift/graph-model";
import { WORLD_WIDTH } from "@/components/protocol-drift/touch-frame";
import { CHIP_SPECS, laneBounds, type ChipKind } from "@/lib/protocol-drift";
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

/** The 13 chips of a full study, in the order a player builds Wave 1 and on. */
const FULL_STUDY_KINDS: ChipKind[] = [
  "SourceIngest",
  "ExtractField",
  "RegexSplit",
  "DateLocaleNormalizer",
  "UnitStandardizer",
  "UnitStandardizer",
  "PivotToObservation",
  "CDISCSink",
  "UnitStandardizer",
  "UnitStandardizer",
  "AmendmentRouter",
  "SnapshotHandoff",
  "PairAndDerive",
];

function overlaps(a: ChipNode, b: ChipNode): boolean {
  return (
    a.position.x < b.position.x + CHIP_WIDTH &&
    b.position.x < a.position.x + CHIP_WIDTH &&
    a.position.y < b.position.y + chipHeight(b.data.kind) &&
    b.position.y < a.position.y + chipHeight(a.data.kind)
  );
}

describe("desktop toolbox placement (#2324)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("13 toolbox adds never overlap and stay inside their lanes", async () => {
    render(
      <CabinetTouchContext.Provider value={false}>
        <ProtocolDriftGame />
      </CabinetTouchContext.Provider>
    );
    await screen.findByRole("dialog", { name: /Trial Briefing/ });
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/Full study/));
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /accept assignment/i })
      );
    });

    // A toolbox button is a native button: Enter and Space activate it with
    // the same click handler, so this is the click and keyboard path.
    for (const kind of FULL_STUDY_KINDS) {
      const before = store().nodes.length;
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: `Add ${kind} chip` })
        );
      });
      await waitFor(() => expect(store().nodes.length).toBe(before + 1));
    }

    const nodes = store().nodes;
    expect(nodes).toHaveLength(FULL_STUDY_KINDS.length);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(
          overlaps(nodes[i], nodes[j]),
          `${nodes[i].id} overlaps ${nodes[j].id}`
        ).toBe(false);
      }
    }
    for (const node of nodes) {
      const { min, max } = laneBounds(CHIP_SPECS[node.data.kind].lane);
      expect(node.position.y, node.id).toBeGreaterThanOrEqual(min);
      expect(node.position.y, node.id).toBeLessThanOrEqual(max);
      expect(node.position.x, node.id).toBeGreaterThanOrEqual(0);
      expect(node.position.x + CHIP_WIDTH, node.id).toBeLessThanOrEqual(
        WORLD_WIDTH
      );
    }
  });
});
