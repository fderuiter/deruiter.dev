// Patty's Drive-Thru 10/10 re-audit, first pass: tickets show the number key
// that picks them (#2135), dilemma prompts never name their own speaker
// (#2136), and the paper diary draws its form controls in the light scheme
// (#2137).
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { BOOTH_CREW, DILEMMAS, type DilemmaId } from "@/lib/patty-drive-thru";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { createBoothStore } from "@/components/patty-drive-thru/store";
import { KdsBoard } from "@/components/patty-drive-thru/KdsBoard";
import { Register } from "@/components/patty-drive-thru/Register";

afterEach(() => {
  cleanup();
});

/**
 * A shift where the first car has already given up, so the order in slot 1
 * is car #2: the slot and the order number differ.
 */
function storeWithShiftedSlots() {
  const store = createBoothStore({
    seed: "audit-2135",
    durationSec: 600,
    firstArrivalSec: 0,
    arrivalGapMinSec: 1,
    arrivalGapMaxSec: 1,
    idleRatePerSec: 0,
    sosLossExpired: 0,
  });
  store.getState().clockIn();
  act(() => {
    for (let i = 0; i < 160; i += 1) store.getState().tick(0.5);
  });
  return store;
}

describe("number keys match the tickets (#2135)", () => {
  it("shows each ticket's slot key beside its order number", () => {
    const store = storeWithShiftedSlots();
    const first = store.getState().shift.orders[0];
    expect(first.id).toBeGreaterThan(1);

    render(<KdsBoard store={store} />);
    const keys = screen.getAllByTestId("pdt-ticket-key");
    expect(keys.map((key) => key.textContent)).toEqual(
      keys.map((_, index) => String(index + 1))
    );
    expect(keys[0].parentElement?.textContent).toBe(`1#${first.id}`);
  });

  it("puts the slot key on the register's order buttons", () => {
    const store = storeWithShiftedSlots();
    const first = store.getState().shift.orders[0];
    render(<Register store={store} />);
    const strip = screen.getByRole("toolbar", { name: "Open orders" });
    const button = within(strip).getAllByRole("button")[0];
    expect(button.textContent).toBe(`1#${first.id}`);
    expect(button.getAttribute("aria-keyshortcuts")).toBe("1");
  });

  it("lists the pause key in the Field Manual", () => {
    const keys = GAME_MANUALS["patty-drive-thru"].controls.map((c) => c.key);
    expect(keys).toContain("P or Esc");
  });
});

describe("dilemma prompts (#2136)", () => {
  const NAMES = {
    manager: BOOTH_CREW.manager,
    coworker: BOOTH_CREW.coworker,
  } as const;

  it.each(Object.keys(DILEMMAS) as DilemmaId[])(
    "%s does not name its own speaker",
    (id) => {
      const dilemma = DILEMMAS[id];
      const name = NAMES[dilemma.speaker as keyof typeof NAMES];
      if (name) expect(dilemma.prompt).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(dilemma.prompt).not.toMatch(/\b(asks|says|wants to know)\b/);
    }
  );
});

describe("diary form controls (#2137)", () => {
  it("draws radios and checkboxes in the light scheme on the paper", () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), "app/arcade/arcade.css"),
      "utf8"
    );
    const rule = css.match(/\[data-pdt-cabinet\] \.pdt-diary \{([^}]*)\}/);
    expect(rule?.[1]).toMatch(/color-scheme:\s*light/);
    expect(rule?.[1]).toMatch(/accent-color:/);
  });
});
