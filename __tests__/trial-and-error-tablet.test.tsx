// @vitest-environment jsdom
//
// Trial & Error on the iPad (#2120): inside the touch cabinet the table fits
// the stage, scales its hand to the room it has, mounts its dialogs inside
// the cabinet so Escape closes them without leaving it, settles a hand that
// is still scoring when the app is backgrounded, and reads a Pencil like a
// finger. Outside the touch cabinet the markup is what it was.
import React from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { requestTeAutoPause } from "@/components/trial-and-error/auto-pause";
import {
  cardScaleFor,
  cardWidthScaleFor,
  TOUCH_CARD_REM,
} from "@/components/trial-and-error/touch-scale";
import { AUTHORED_CAMPAIGN } from "./utils/trial-and-error-authored";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

/** Resize observers the table made, so a test can report a hand-area size. */
const observers: Array<{
  callback: ResizeObserverCallback;
  target: Element | null;
}> = [];

beforeAll(() => {
  class FakeResizeObserver {
    target: Element | null = null;
    constructor(readonly callback: ResizeObserverCallback) {
      observers.push(this as never);
    }
    observe(target: Element) {
      this.target = target;
    }
    unobserve() {}
    disconnect() {
      this.target = null;
    }
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

beforeEach(() => {
  observers.length = 0;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
afterEach(cleanup);

const table = () =>
  document.querySelector<HTMLElement>(
    'section[aria-labelledby="card-table-heading"]'
  )!;

function renderTable(touch: boolean) {
  return render(
    <CabinetTouchContext.Provider value={touch}>
      <CardTable act={AUTHORED_CAMPAIGN} />
    </CabinetTouchContext.Provider>
  );
}

describe("the touch table's scoped layer", () => {
  it("applies te-touch and the card scales only inside the touch cabinet", () => {
    renderTable(true);
    expect(table().classList.contains("te-touch")).toBe(true);
    expect(table().style.getPropertyValue("--te-card-scale")).toBe("1");
    expect(table().style.getPropertyValue("--te-card-w-scale")).not.toBe("");
  });

  it("leaves the desktop table's markup alone", () => {
    renderTable(false);
    expect(table().classList.contains("te-touch")).toBe(false);
    expect(table().style.getPropertyValue("--te-card-scale")).toBe("");
    expect(document.querySelector(".te-sheet-host")).toBeNull();
  });

  it("renders a sheet host for the dialogs only in the touch cabinet", () => {
    renderTable(true);
    expect(table().querySelector(".te-sheet-host")).not.toBeNull();
  });
});

describe("dialogs inside the touch cabinet", () => {
  it("mounts the hand sheet in the table's sheet host, not the body", () => {
    renderTable(true);
    fireEvent.click(screen.getByTestId("hand-sheet-button"));
    const sheet = screen.getByTestId("hand-sheet");
    expect(table().querySelector(".te-sheet-host")?.contains(sheet)).toBe(true);
  });

  it("mounts the hand sheet in the body on desktop", () => {
    renderTable(false);
    fireEvent.click(screen.getByTestId("hand-sheet-button"));
    const sheet = screen.getByTestId("hand-sheet");
    expect(table().contains(sheet)).toBe(false);
    expect(document.body.contains(sheet)).toBe(true);
  });

  it("takes focus into a sheet at once, so Escape straight after H closes it", () => {
    renderTable(true);
    const first = document.querySelector<HTMLButtonElement>("[data-card-id]")!;
    first.focus();
    fireEvent.keyDown(first, { key: "h" });
    const sheet = screen.getByTestId("hand-sheet");
    expect(sheet.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByTestId("hand-sheet")).toBeNull();
  });

  it("opens Run Info on Shift+R even though the cabinet traps focus", () => {
    // A cabinet focus trap is active in a real touch cabinet; a table dialog
    // must still open from a key.
    renderTable(true);
    const first = document.querySelector<HTMLButtonElement>("[data-card-id]")!;
    first.focus();
    fireEvent.keyDown(first, { key: "R", shiftKey: true });
    expect(screen.getByRole("dialog", { name: /run info/i })).toBeTruthy();
  });

  it("marks a picked-up seal so the cabinet's Escape returns it to the tray", () => {
    renderTable(true);
    const card = (id: string) =>
      document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
    // Sending three cards back deals the blank shell, which earns a seal.
    for (const id of ["C-T14.1.1-A", "C-T14.1.1-B", "C-L16.2.4"]) {
      fireEvent.click(card(id));
    }
    fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    act(() => card("C-T14.1.3").focus());
    fireEvent.keyDown(card("C-T14.1.3"), { key: "a" });
    fireEvent.click(
      within(screen.getByTestId("allocate-panel")).getAllByTestId(
        "allocate-option"
      )[1]
    );
    expect(table().getAttribute("data-escape-docks")).toBeNull();
    const seal = within(screen.getByTestId("consumable-tray")).getByRole(
      "button",
      { name: /Adjudicated Endpoint/ }
    );
    fireEvent.click(seal);
    expect(table().getAttribute("data-escape-docks")).toBe("true");
    expect(table().getAttribute("data-keyboard-boundary")).toBe("true");
    fireEvent.click(seal);
    expect(table().getAttribute("data-escape-docks")).toBeNull();
  });
});

describe("the hand scales to the stage", () => {
  it("reads the hand area's height from a fitted cabinet only", () => {
    const { container } = render(
      <div data-mobile-layout="fit">
        <CabinetTouchContext.Provider value={true}>
          <CardTable act={AUTHORED_CAMPAIGN} />
        </CabinetTouchContext.Provider>
      </div>
    );
    const observer = observers.find((o) =>
      o.target?.className.includes("te-area-hand")
    );
    expect(observer).toBeDefined();
    act(() => {
      observer!.callback(
        [{ contentRect: { height: 710 } } as ResizeObserverEntry],
        observer as never
      );
    });
    const section = container.querySelector<HTMLElement>("section")!;
    expect(section.style.getPropertyValue("--te-card-scale")).toBe(
      String(cardScaleFor(710))
    );
    expect(cardScaleFor(710)).toBeGreaterThan(1);
  });

  it("does not observe the hand when the cabinet scrolls", () => {
    renderTable(true);
    expect(
      observers.some((o) => o.target?.className.includes("te-area-hand"))
    ).toBe(false);
  });

  it("keeps the desktop card for a short or unmeasured area", () => {
    expect(cardScaleFor(0)).toBe(1);
    expect(cardScaleFor(200)).toBe(1);
    expect(cardScaleFor(470)).toBe(1);
  });

  it("grows cards with the area and stops at 1.9", () => {
    expect(cardScaleFor(500)).toBe(1.15);
    expect(cardScaleFor(600)).toBeGreaterThan(cardScaleFor(500));
    expect(cardScaleFor(710)).toBe(1.9);
    expect(cardScaleFor(5000)).toBe(1.9);
  });

  it("narrows a card so a full hand of eight fits its row", () => {
    expect(cardWidthScaleFor(1.9, 0)).toBe(1);
    // A 1366px landscape row: width is held back to the height scale or less.
    const wide = cardWidthScaleFor(1.9, 60);
    expect(wide).toBeLessThanOrEqual(1.9);
    expect(wide).toBeGreaterThanOrEqual(1);
    // A 501px Split View row: narrower than the base card, never below 0.55.
    const narrow = cardWidthScaleFor(1, 501 / 16);
    expect(narrow).toBeLessThan(1);
    expect(narrow).toBeGreaterThanOrEqual(0.55);
    // Eight cards at that width, each showing half, plus the last in full.
    const rowRem = 501 / 16;
    const cardRem = TOUCH_CARD_REM * narrow;
    expect(cardRem * (1 + 7 / 2) + 0.5 * 7).toBeLessThanOrEqual(rowRem);
    expect(cardWidthScaleFor(1, 1)).toBe(0.55);
  });
});

describe("auto-pause", () => {
  it("settles a hand that is still scoring when the cabinet asks", () => {
    // Motion on, so the hand scores as a timed playback.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    renderTable(true);
    const card = document.querySelector<HTMLButtonElement>("[data-card-id]")!;
    fireEvent.click(card);
    fireEvent.click(screen.getByRole("button", { name: /^play hand/i }));
    expect(screen.queryByRole("button", { name: /skip/i })).not.toBeNull();
    act(() => requestTeAutoPause());
    expect(screen.queryByRole("button", { name: /skip/i })).toBeNull();
  });
});
