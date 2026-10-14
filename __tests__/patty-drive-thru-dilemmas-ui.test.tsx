import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  DILEMMAS,
  DILEMMA_WINDOW_LONG_SEC,
  DILEMMA_WINDOW_SEC,
  getDilemmaDiaryLines,
  type ShiftState,
} from "@/lib/patty-drive-thru";

const frame = vi.hoisted(() => ({
  callback: null as null | ((deltaMs: number) => void),
  active: false,
}));

const sound = vi.hoisted(() => ({
  playSequence: vi.fn(),
  playNoise: vi.fn(),
  stopAll: vi.fn(),
}));

vi.mock("@/hooks/useAnimationFrame", () => ({
  useAnimationFrame: (
    callback: (deltaMs: number) => void,
    options: { isActive?: boolean } = {}
  ) => {
    frame.callback = callback;
    frame.active = options.isActive ?? true;
  },
}));

vi.mock("@/lib/audio/sound-engine", () => ({
  getSoundEngine: () => sound,
}));

vi.mock("@/lib/arcade-achievements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/arcade-achievements")>()),
  recordArcadeScore: vi.fn(),
  recordArcadeMilestone: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function BoothSceneStub() {
      return <div data-testid="pdt-booth-canvas" />;
    },
}));

import { PattyDriveThruGame } from "@/components/patty-drive-thru/PattyDriveThruGame";
import { DilemmaPrompt } from "@/components/patty-drive-thru/DilemmaPrompt";
import { ShiftEndPage } from "@/components/patty-drive-thru/DiaryPages";
import { createBoothStore } from "@/components/patty-drive-thru/store";

/** A shift nobody has to play to reach its first dilemma. */
const CALM = {
  seed: "ui-calm",
  durationSec: 180,
  idleRatePerSec: 0,
  sosLossExpired: 0,
};

function game(): HTMLElement {
  return screen.getByTestId("pdt-game");
}

/** Runs the shift loop, wiping now and then so the manager stays quiet. */
function workUntilDilemma(limitSec = 90) {
  for (let i = 0; i < limitSec * 10; i++) {
    if (screen.queryByTestId("pdt-dilemma")) return;
    act(() => {
      if (frame.active) frame.callback?.(100);
    });
    if (i % 30 === 0) fireEvent.keyDown(game(), { key: "w" });
  }
  throw new Error("no dilemma within the limit");
}

beforeEach(() => {
  frame.callback = null;
  frame.active = false;
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/arcade/patty-drive-thru");
});

afterEach(() => {
  cleanup();
});

describe("the dilemma prompt (#2087)", () => {
  it("shows the question, two 44px answers and the time left, and answers on click", () => {
    const store = createBoothStore(CALM);
    store.getState().clockIn();
    const { container } = render(<DilemmaPrompt store={store} />);
    expect(container.textContent).toBe("");

    act(() => {
      while (!store.getState().shift.dilemma) store.getState().tick(0.5);
    });
    const open = store.getState().shift.dilemma!;
    const dilemma = DILEMMAS[open.dilemmaId];
    const prompt = screen.getByTestId("pdt-dilemma");
    expect(prompt.textContent).toContain(dilemma.prompt);
    expect(
      screen
        .getByRole("meter", { name: "Time to decide" })
        .getAttribute("aria-valuemax")
    ).toBe(String(DILEMMA_WINDOW_SEC));
    // The live region carries the question and how to answer it.
    expect(store.getState().announcement).toContain(dilemma.prompt);
    expect(store.getState().announcement).toMatch(/Press Q to .*, or E to /);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const [index, button] of buttons.entries()) {
      expect(button.className).toContain("min-h-11");
      expect(button.getAttribute("aria-keyshortcuts")).toBe(["Q", "E"][index]);
      expect(button.textContent).toContain(dilemma.options[index].label);
    }

    fireEvent.click(buttons[1]);
    expect(screen.queryByTestId("pdt-dilemma")).toBeNull();
    expect(store.getState().shift.dilemmaChoices[0]).toMatchObject({
      dilemmaId: dilemma.id,
      optionId: dilemma.options[1].id,
      timedOut: false,
    });
    expect(store.getState().announcement).toBe(
      `You chose: ${dilemma.options[1].label}.`
    );
  });

  it("captions a dilemma the clock answered", () => {
    const store = createBoothStore(CALM);
    store.getState().clockIn();
    while (store.getState().shift.dilemmaChoices.length === 0)
      store.getState().tick(0.5);
    expect(store.getState().caption?.text).toBe(
      "Too slow. Somebody decided for you."
    );
    expect(store.getState().shift.dilemmaChoices[0].timedOut).toBe(true);
  });
});

describe("dilemmas in the booth (#2087)", () => {
  it("answers with Q while the booth keeps running", () => {
    render(
      <PattyDriveThruGame
        config={{ seed: "ui-keys", durationSec: 180 }}
        initialView="flat"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
    workUntilDilemma();
    const id = screen.getByTestId("pdt-dilemma").getAttribute("data-dilemma");
    const dilemma = DILEMMAS[id as keyof typeof DILEMMAS];
    // The order screen is still there, and still taking keys.
    expect(screen.getByTestId("pdt-key-legend").textContent).toContain(
      "Q / E answer"
    );
    fireEvent.keyDown(game(), { key: "q" });
    expect(screen.queryByTestId("pdt-dilemma")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      `You chose: ${dilemma.options[0].label}.`
    );
  });

  it("offers a longer timer on the intro page", () => {
    render(
      <PattyDriveThruGame
        config={{ seed: "ui-long", durationSec: 180 }}
        initialView="flat"
      />
    );
    const box = screen.getByRole("checkbox", { name: /More time to decide/ });
    expect((box as HTMLInputElement).checked).toBe(false);
    fireEvent.click(box);
    expect((box as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clock in" }));
    workUntilDilemma();
    expect(
      screen
        .getByRole("meter", { name: "Time to decide" })
        .getAttribute("aria-valuemax")
    ).toBe(String(DILEMMA_WINDOW_LONG_SEC));
  });

  it("writes the answers on the end page under the ending they led to", () => {
    const store = createBoothStore(CALM);
    store.getState().clockIn();
    while (store.getState().phase === "shift") {
      const { shift } = store.getState();
      if (shift.dilemma) {
        const crew = {
          "stale-fries": "toss",
          "short-till": "cover",
          "shake-machine": "broken",
          "long-break": "cover",
        } as const;
        store
          .getState()
          .act({
            type: "chooseDilemma",
            optionId: crew[shift.dilemma.dilemmaId],
          });
      }
      store.getState().tick(0.5);
    }
    const shift: ShiftState = store.getState().shift;
    render(<ShiftEndPage shift={shift} log={[]} onClockIn={() => {}} />);
    const page = screen.getByTestId("pdt-end");
    expect(page.getAttribute("data-ending")).toBe("walkout");
    expect(screen.getByRole("heading", { name: "Walkout" })).toBeTruthy();
    const choices = screen.getByTestId("pdt-choices");
    for (const line of getDilemmaDiaryLines(shift.dilemmaChoices))
      expect(choices.textContent).toContain(line);
  });
});
