// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  DarknetMarket,
  type MarketRow,
} from "@/components/retro-labyrinth/parts/DarknetMarket";
import { RoomClearedCard } from "@/components/retro-labyrinth/parts/RoomClearedCard";
import { ROOM_CLEAR_HINT } from "@/components/retro-labyrinth/control-hints";
import { resolveControlHint } from "@/components/arcade/mobile";

const COARSE = "(pointer: coarse)";

function installMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const ROWS: MarketRow[] = [
  {
    id: "ram",
    name: "RAM",
    icon: "R",
    description: "more ram",
    note: null,
    disabled: false,
    label: "🪙 40",
  },
  {
    id: "chip",
    name: "Chip",
    icon: "C",
    description: "a chip",
    note: null,
    disabled: true,
    label: "🪙 90",
  },
];

describe("DarknetMarket on a coarse pointer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("is a labelled modal dialog whose title is a level-two heading", () => {
    installMatchMedia([COARSE]);
    render(
      <DarknetMarket
        crypto={50}
        rows={ROWS}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", {
      name: /DARKNET EXPLOIT BLACK-MARKET/,
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(
      screen.getByRole("heading", { level: 2, name: /DARKNET/ })
    ).toBeTruthy();
  });

  it("makes the item list a labelled, focusable region", () => {
    installMatchMedia([COARSE]);
    render(
      <DarknetMarket
        crypto={50}
        rows={ROWS}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const region = screen.getByRole("region", { name: "Market items" });
    expect(region.getAttribute("tabindex")).toBe("0");
  });

  it("gives every price button and the close button a 44px touch target", () => {
    installMatchMedia([COARSE]);
    render(
      <DarknetMarket
        crypto={50}
        rows={ROWS}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />
    );
    for (const name of ["🪙 40", "🪙 90", "Close Darknet Market"]) {
      expect(screen.getByRole("button", { name }).className).toContain(
        "min-h-11"
      );
    }
  });

  it("buys an affordable item by tap and disables the one it cannot afford", () => {
    installMatchMedia([COARSE]);
    const onBuy = vi.fn();
    render(
      <DarknetMarket crypto={50} rows={ROWS} onBuy={onBuy} onClose={vi.fn()} />
    );
    expect(
      (screen.getByRole("button", { name: "🪙 90" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "🪙 40" }));
    expect(onBuy).toHaveBeenCalledWith("ram");
  });

  it("closes by tapping the close button and on Escape", () => {
    installMatchMedia([COARSE]);
    const onClose = vi.fn();
    render(
      <DarknetMarket
        crypto={50}
        rows={ROWS}
        onBuy={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Close Darknet Market" })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("moves focus into the dialog when it opens", async () => {
    installMatchMedia([COARSE]);
    render(
      <DarknetMarket
        crypto={50}
        rows={ROWS}
        onBuy={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("Close Darknet Market")
    );
  });
});

describe("RoomClearedCard on a coarse pointer", () => {
  afterEach(() => {
    cleanup();
  });

  const base = {
    isFinalRoom: false,
    campaignRoomCount: 4,
    runMoves: [12],
    runCrypto: 30,
    movesCount: 12,
    roomCrypto: 30,
    score: 120,
    highScore: 500,
    hint: resolveControlHint(ROOM_CLEAR_HINT, true),
    onNextRoom: vi.fn(),
    onRestart: vi.fn(),
  };

  it("offers Tap Next Room in a roguelike run, and Next Room advances", () => {
    installMatchMedia([COARSE]);
    const onNextRoom = vi.fn();
    render(<RoomClearedCard {...base} showNextRoom onNextRoom={onNextRoom} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "MAINFRAME TIER BREACHED" })
    ).toBeTruthy();
    expect(screen.getByText("Tap Next Room to continue")).toBeTruthy();
    const next = screen.getByRole("button", { name: "Next Room" });
    expect(next.className).toContain("min-h-11");
    fireEvent.click(next);
    expect(onNextRoom).toHaveBeenCalledTimes(1);
  });

  it("offers Play Again outside a roguelike run, with a 44px target", () => {
    installMatchMedia([COARSE]);
    const onRestart = vi.fn();
    render(
      <RoomClearedCard {...base} showNextRoom={false} onRestart={onRestart} />
    );
    const again = screen.getByRole("button", { name: "Play Again" });
    expect(again.className).toContain("min-h-11");
    fireEvent.click(again);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("ends a finished run with a New Run button and its own heading", () => {
    installMatchMedia([COARSE]);
    render(
      <RoomClearedCard
        {...base}
        isFinalRoom
        runMoves={[12, 9, 7, 5]}
        showNextRoom={false}
        hint="Tap New Run to start over from Room 01"
      />
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "RUN COMPLETE" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Run" })).toBeTruthy();
    expect(screen.getByTestId("labyrinth-run-rooms").textContent).toBe(
      "R01 12 · R02 9 · R03 7 · R04 5"
    );
  });
});
