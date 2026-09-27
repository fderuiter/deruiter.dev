// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  DEMOGRAPHICS_SCENARIO,
  createTableState,
  deriveTableView,
  snapshotRef,
  type CardFace as CardFaceData,
  type CardStamp,
  type RedactedCard,
  type TableCardView,
  type TlfCard,
} from "@/lib/trial-and-error";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { CardBack } from "@/components/trial-and-error/cards/CardBack";
import { CardDetail } from "@/components/trial-and-error/cards/CardDetail";
import { CardFace } from "@/components/trial-and-error/cards/CardFace";
import { CardFlip } from "@/components/trial-and-error/cards/CardFlip";
import { MiniFigure } from "@/components/trial-and-error/cards/MiniFigure";
import { MiniTable } from "@/components/trial-and-error/cards/MiniTable";
import { StampSlot } from "@/components/trial-and-error/cards/Stamp";
import {
  CENTER_CLEARANCE_REM,
  FAN_ALLOWANCE_REM,
  handOverlap,
} from "@/components/trial-and-error/cards/hand-fit";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

function mockMedia({ reduced = true, compact = false } = {}) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches:
        (query.includes("reduce") && reduced) ||
        (query.includes("max-width") && compact),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

beforeEach(() => {
  announce.mockClear();
  mockMedia();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Act I has no efficacy outputs or Figures (#911), so the efficacy Table and
// both Figure faces are covered by these fixtures, as Act II will deal them.
const FIXTURE_CARDS: TlfCard[] = [
  {
    id: "C-T14.2.1",
    cardType: "TABLE",
    number: "Table 14.2.1",
    title: "Primary Endpoint (ANCOVA)",
    population: "FAS",
    chips: 40,
    mult: 1,
    topic: "EFF",
    csrStage: "EFFICACY",
    face: {
      kind: "TABLE",
      columns: ["Placebo", "Active", "Diff"],
      rows: [
        { label: "N", values: ["6", "5", "—"] },
        { label: "LS mean", values: ["-1.2", "-4.8", "-3.6"] },
        { label: "95% CI", values: ["—", "—", "(-6.9, -0.3)"] },
        { label: "p-value", values: ["—", "—", "0.034"] },
      ],
    },
  },
  {
    id: "C-F14.2.1",
    cardType: "FIGURE",
    number: "Figure 14.2.1",
    title: "Kaplan-Meier: Time to Response",
    population: "FAS",
    chips: 35,
    mult: 0,
    topic: "EFF",
    face: {
      kind: "FIGURE",
      plot: {
        type: "KM",
        series: [
          {
            label: "Placebo",
            points: [
              [0, 1],
              [2, 1],
              [4, 0.83],
              [8, 0.67],
              [12, 0.5],
            ],
          },
          {
            label: "Active",
            points: [
              [0, 1],
              [2, 0.8],
              [4, 0.6],
              [8, 0.4],
              [12, 0.2],
            ],
          },
        ],
      },
    },
  },
  {
    id: "C-T14.2.2",
    cardType: "TABLE",
    number: "Table 14.2.2",
    title: "Key Secondary Endpoint",
    population: "FAS",
    chips: 35,
    mult: 1,
    topic: "EFF",
    csrStage: "EFFICACY",
    face: {
      kind: "TABLE",
      columns: ["Placebo", "Active", "Diff"],
      rows: [
        { label: "N", values: ["6", "5", "—"] },
        { label: "Responders", values: ["2 (33.3)", "4 (80.0)", "—"] },
        { label: "Odds ratio", values: ["—", "—", "8.0"] },
        { label: "p-value", values: ["—", "—", "0.24"] },
      ],
    },
  },
  {
    id: "C-F14.2.2",
    cardType: "FIGURE",
    number: "Figure 14.2.2",
    title: "Forest Plot by Subgroup",
    population: "FAS",
    chips: 30,
    mult: 0,
    topic: "EFF",
    face: {
      kind: "FIGURE",
      plot: {
        type: "FOREST",
        reference: 0,
        intervals: [
          { label: "Overall", estimate: -3.6, lower: -6.9, upper: -0.3 },
          { label: "Age < 65", estimate: -4.1, lower: -8, upper: -0.2 },
          { label: "Age ≥ 65", estimate: -2.2, lower: -7.5, upper: 3.1 },
          { label: "Female", estimate: -4.4, lower: -8.6, upper: -0.2 },
        ],
      },
    },
  },
];

// Every dealt card, plus every undealt card that carries its own face data
// (undealt drafts derive their face from the draft, covered by the domain tests).
const deckView = (): TableCardView[] =>
  [...DEMOGRAPHICS_SCENARIO.deck, ...FIXTURE_CARDS].flatMap(
    (card): TableCardView[] => {
      const dealt = deriveTableView(
        DEMOGRAPHICS_SCENARIO,
        createTableState(DEMOGRAPHICS_SCENARIO)
      ).hand.find((h) => h.card.id === card.id);
      if (dealt) return [dealt];
      if (!card.face) return [];
      return [
        {
          card,
          selected: false,
          inspectable: false,
          inspected: false,
          unverified: false,
          openRedlines: 0,
          face: card.face,
          stamps: [],
          debuffed: false,
          stale: false,
          staleAlert: null,
          provenance: snapshotRef(DEMOGRAPHICS_SCENARIO.populationSnapshot),
          blank: false,
          compatiblePopulations: [],
          seals: [],
          footnoteSlots: 0,
          pairedWith: [],
          figure: null,
          blinded: false,
          faceDown: false,
          structural: null,
        },
      ];
    }
  );
const viewOf = (id: string) => deckView().find((v) => v.card.id === id)!;

describe("card faces", () => {
  it("renders every card in the scenario from its own data", () => {
    for (const view of deckView()) {
      const { container, unmount } = render(<CardFace view={view} />);
      expect(container.textContent).toContain(view.card.number);
      expect(container.textContent).toContain(`${view.card.chips} Chips`);
      const kind = container.querySelector("[data-face-kind]");
      expect(kind?.getAttribute("data-face-kind")).toBe(view.face.kind);
      if (view.face.kind === "TABLE") {
        for (const value of view.face.rows[0].values) {
          expect(kind?.textContent).toContain(value);
        }
      }
      if (view.face.kind === "LISTING") {
        expect(kind?.textContent).toContain(view.face.rows[0][0]);
      }
      unmount();
    }
  });

  it("writes the population suit out in text and flags unverified cards", () => {
    const { container } = render(<CardFace view={viewOf("C-T14.1.1-A")} />);
    expect(container.textContent).toContain("ITT");
    expect(screen.getByTestId("unverified-badge").textContent).toBe("?");
    cleanup();
    render(<CardFace view={viewOf("C-T14.2.1")} />);
    expect(screen.queryByTestId("unverified-badge")).toBeNull();
    expect(document.body.textContent).toContain("FAS");
  });

  it("matches the snapshot for each face kind", () => {
    const kinds = ["C-T14.1.2", "C-L16.2.4", "C-F14.2.1", "C-F14.2.2"];
    for (const id of kinds) {
      const { container, unmount } = render(<CardFace view={viewOf(id)} />);
      expect(container.innerHTML).toMatchSnapshot(id);
      unmount();
    }
  });

  it("renders a subject token as a cohort chip", () => {
    const token: CardFaceData = { kind: "TOKEN", cohort: "ITT", count: 12 };
    const base = viewOf("C-T14.1.2");
    render(
      <CardFace
        view={{
          ...base,
          card: { ...base.card, cardType: "SUBJECT_TOKEN", face: token },
          face: token,
        }}
      />
    );
    expect(
      document.querySelector('[data-face-kind="TOKEN"]')?.textContent
    ).toBe("ITT · N=12");
    expect(document.body.textContent).toContain("Token");
  });
});

describe("MiniTable and MiniFigure", () => {
  it("is a decorative miniature on the card and a real table in detail", () => {
    const face = viewOf("C-T14.1.2").face as Extract<
      CardFaceData,
      { kind: "TABLE" }
    >;
    const { container } = render(<MiniTable face={face} size="card" />);
    const mini = container.firstElementChild!;
    expect(mini.getAttribute("aria-hidden")).toBe("true");
    expect(mini.children).toHaveLength((face.rows.length + 1) * 4);
    cleanup();
    render(<MiniTable face={face} size="detail" caption="Disposition" />);
    const table = screen.getByRole("table", { name: "Disposition" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent)
    ).toEqual(["", "Placebo", "Active", "Total"]);
    expect(
      within(table).getByRole("rowheader", { name: "Completed" })
    ).toBeTruthy();
  });

  it("draws KM and forest plots with explicit presentation attributes", () => {
    const km = viewOf("C-F14.2.1").face;
    const forest = viewOf("C-F14.2.2").face;
    if (km.kind !== "FIGURE" || forest.kind !== "FIGURE") throw new Error();
    const { container } = render(<MiniFigure plot={km.plot} size="card" />);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path.getAttribute("fill")).toBe("none");
      expect(path.getAttribute("stroke")).toMatch(/^#/);
      // A KM curve is a step function: horizontal then vertical segments.
      expect(path.getAttribute("d")).toMatch(
        /^M[\d.]+,[\d.]+(H[\d.]+V[\d.]+)+$/
      );
    }
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
    cleanup();
    render(<MiniFigure plot={forest.plot} size="detail" label="Forest" />);
    const img = screen.getByRole("img", { name: "Forest" });
    expect(img.querySelectorAll("rect")).toHaveLength(4);
    for (const rect of img.querySelectorAll("rect")) {
      expect(rect.getAttribute("fill")).toMatch(/^#/);
    }
    expect(img.textContent).toContain("Age ≥ 65");
  });
});

describe("stamps, back and flip", () => {
  it("prints every stamp kind in the one slot, and nothing when unstamped", () => {
    const all: CardStamp[] = [
      "REDLINE",
      "QC_PASS",
      "STALE",
      "SEALED",
      "BLINDED",
    ];
    const { container } = render(<StampSlot stamps={all} />);
    expect(
      Array.from(container.querySelectorAll("[data-stamp]")).map(
        (s) => s.textContent
      )
    ).toEqual(["REDLINE", "QC ✓", "STALE", "SEALED", "BLINDED"]);
    cleanup();
    expect(render(<StampSlot stamps={[]} />).container.innerHTML).toBe("");
  });

  it("renders a face-down back that cannot carry face values", () => {
    const back: RedactedCard = { slot: "draw-8", faceDown: true };
    const { container } = render(<CardBack card={back} />);
    expect(container.textContent).toBe("T&E");
    const face = viewOf("C-T14.2.1");
    render(
      // @ts-expect-error CardBack takes a redacted card, never a face.
      <CardBack card={{ ...back, face: face.face }} />
    );
    expect(JSON.stringify(back)).toBe('{"slot":"draw-8","faceDown":true}');
  });

  it("shows the requested side of a flip", () => {
    const { container, rerender } = render(
      <CardFlip
        faceUp
        front={<b>front</b>}
        back={<i>back</i>}
        animate={false}
      />
    );
    expect(container.firstElementChild?.getAttribute("data-face-up")).toBe(
      "true"
    );
    rerender(
      <CardFlip
        faceUp={false}
        front={<b>front</b>}
        back={<i>back</i>}
        animate={false}
      />
    );
    expect(container.firstElementChild?.getAttribute("data-face-up")).toBe(
      "false"
    );
  });
});

describe("CardDetail", () => {
  it("shows the face at full legibility without revealing findings", () => {
    render(<CardDetail view={viewOf("C-T14.1.1-A")} headingId="h" />);
    expect(screen.getByRole("heading").textContent).toBe(
      "Table 14.1.1 · Demographics (Draft A)"
    );
    expect(screen.getByText("Unverified: not yet inspected")).toBeTruthy();
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("7 (63.6)");
  });

  it("names stamps and review state in words", () => {
    const base = viewOf("C-T14.1.1-A");
    render(
      <CardDetail
        view={{
          ...base,
          unverified: false,
          inspected: true,
          openRedlines: 1,
          stamps: ["REDLINE"],
        }}
        headingId="h"
      />
    );
    expect(screen.getByText("1 open redline")).toBeTruthy();
    expect(screen.getByText("redline stamp")).toBeTruthy();
  });
});

describe("hand physicality on the Card Table", () => {
  const card = (id: string) =>
    document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
  const order = () =>
    Array.from(document.querySelectorAll("[data-card-id]")).map((b) =>
      b.getAttribute("data-card-id")
    );

  it("reorders with Alt+arrows, keeps focus on the card and announces it", () => {
    render(<CardTable />);
    const first = order()[0]!;
    act(() => card(first).focus());
    fireEvent.keyDown(card(first), { key: "ArrowRight", altKey: true });
    expect(order()[1]).toBe(first);
    expect(document.activeElement).toBe(card(first));
    expect(announce).toHaveBeenLastCalledWith(
      "Table 14.1.1 moved to position 2 of 8."
    );
    fireEvent.keyDown(card(first), { key: "ArrowLeft", altKey: true });
    expect(order()[0]).toBe(first);
    fireEvent.keyDown(card(first), { key: "ArrowLeft", altKey: true });
    expect(announce).toHaveBeenLastCalledWith(
      "Table 14.1.1 is already first in the hand."
    );
  });

  it("opens the card detail with ?, and Escape closes it", () => {
    render(<CardTable />);
    act(() => card("C-T14.1.2").focus());
    fireEvent.keyDown(card("C-T14.1.2"), { key: "?" });
    const dialog = screen.getByTestId("card-detail");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(within(dialog).getByRole("heading").textContent).toContain(
      "Subject Disposition"
    );
    fireEvent.click(within(dialog).getByRole("button", { name: /Select/ }));
    expect(card("C-T14.1.2").getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("card-detail")).toBeNull();
  });

  it("on touch, a second tap on a selected card opens detail instead of deselecting", () => {
    render(<CardTable />);
    const id = "C-L16.2.4";
    fireEvent.pointerDown(card(id), { pointerType: "touch" });
    fireEvent.click(card(id));
    expect(card(id).getAttribute("aria-pressed")).toBe("true");
    fireEvent.pointerDown(card(id), { pointerType: "touch" });
    fireEvent.pointerUp(card(id), { pointerType: "touch" });
    fireEvent.click(card(id));
    expect(card(id).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("card-detail")).toBeTruthy();
  });

  it("opens detail on a long press without also toggling selection", () => {
    vi.useFakeTimers();
    render(<CardTable />);
    const id = "C-T14.3.1";
    fireEvent.pointerDown(card(id), {
      pointerType: "mouse",
      clientX: 5,
      clientY: 5,
    });
    act(() => vi.advanceTimersByTime(520));
    fireEvent.pointerUp(card(id));
    fireEvent.click(card(id));
    expect(screen.getByTestId("card-detail")).toBeTruthy();
    expect(card(id).getAttribute("aria-pressed")).toBe("false");
  });

  it("cancels a long press when the pointer moves", () => {
    vi.useFakeTimers();
    render(<CardTable />);
    const id = "C-T14.3.1";
    fireEvent.pointerDown(card(id), {
      pointerType: "mouse",
      clientX: 5,
      clientY: 5,
    });
    fireEvent.pointerMove(card(id), {
      pointerType: "mouse",
      clientX: 40,
      clientY: 5,
    });
    act(() => vi.advanceTimersByTime(520));
    expect(screen.queryByTestId("card-detail")).toBeNull();
  });

  it("shows face-down draw pile and spent stack counts", () => {
    render(<CardTable />);
    expect(screen.getByTestId("draw-pile").textContent).toContain("Deck 3");
    expect(screen.getByTestId("discard-stack").textContent).toContain(
      "Spent 0"
    );
    // Only the top three face-down slots are drawn.
    expect(
      screen.getByTestId("draw-pile").querySelectorAll("[data-slot]")
    ).toHaveLength(3);
    fireEvent.click(card("C-T14.1.2"));
    fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    expect(screen.getByTestId("discard-stack").textContent).toContain(
      "Spent 1"
    );
  });

  it("stamps a revealed redline into the card's accessible name", () => {
    render(<CardTable />);
    act(() => card("C-T14.1.1-A").focus());
    fireEvent.keyDown(card("C-T14.1.1-A"), { key: "i" });
    const drawer = screen.getByTestId("inspect-drawer");
    const cell = within(drawer)
      .getAllByRole("row")[3]
      .querySelectorAll<HTMLElement>('[role="gridcell"]')[2];
    act(() => cell.focus());
    fireEvent.keyDown(cell, { key: "Enter" });
    fireEvent.click(
      within(drawer).getByRole("button", { name: /Close Inspect/ })
    );
    expect(card("C-T14.1.1-A").getAttribute("aria-label")).toContain(
      "redline stamp"
    );
    expect(
      card("C-T14.1.1-A").querySelector('[data-stamp="REDLINE"]')
    ).toBeTruthy();
  });

  it("fans and tilts only with motion allowed at desktop widths", () => {
    mockMedia({ reduced: false, compact: false });
    render(<CardTable />);
    const hand = screen.getByTestId("hand");
    const items = Array.from(hand.children) as HTMLElement[];
    expect(items[1].style.marginLeft).toBe("-1.8rem");
    cleanup();
    mockMedia({ reduced: false, compact: true });
    render(<CardTable />);
    const compact = Array.from(
      screen.getByTestId("hand").children
    ) as HTMLElement[];
    expect(compact[1].style.marginLeft).toBe("");
  });
});

describe("fitting the hand to its row (#1181)", () => {
  it("keeps the fan's overlap when the hand already fits", () => {
    expect(
      handOverlap({ count: 8, cardRem: 10, widthRem: 90, fan: true })
    ).toBe(1.8);
    expect(
      handOverlap({ count: 5, cardRem: 10, widthRem: 90, fan: true })
    ).toBe(0);
    expect(handOverlap({ count: 1, cardRem: 10, widthRem: 5, fan: true })).toBe(
      0
    );
  });

  it("overlaps just enough for eight cards to fit a 1440px cabinet", () => {
    // The playtest's row: 887px of content at 16px per rem.
    const widthRem = 887 / 16;
    const still = handOverlap({ count: 8, cardRem: 10, widthRem, fan: false });
    expect(still).toBe(3.6);
    expect(8 * 10 - 7 * still).toBeLessThanOrEqual(widthRem);
    // The fan's tilt needs room at the ends as well.
    const fanned = handOverlap({ count: 8, cardRem: 10, widthRem, fan: true });
    expect(fanned).toBe(3.8);
    expect(8 * 10 - 7 * fanned).toBeLessThanOrEqual(
      widthRem - FAN_ALLOWANCE_REM
    );
  });

  it("keeps every card's middle in view, and scrolls past that", () => {
    const overlap = handOverlap({
      count: 12,
      cardRem: 10,
      widthRem: 30,
      fan: false,
    });
    expect(overlap).toBe(5 - CENTER_CLEARANCE_REM);
  });

  it("leaves an unmeasured row to the fan alone", () => {
    expect(
      handOverlap({ count: 8, cardRem: 10, widthRem: 0, fan: false })
    ).toBe(0);
  });
});
