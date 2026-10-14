// @vitest-environment jsdom
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
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
import { PROTOCOL_DRIFT_AUTO_PAUSE_EVENT } from "@/components/protocol-drift/auto-pause";
import { CabinetTouchContext } from "@/components/arcade/mobile/CabinetTouchContext";
import { installFlowMocks } from "./protocol-drift/ui-helpers";

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));

/** Renders the workbench inside the touch cabinet, or on desktop (#2045). */
function renderGame(touch: boolean) {
  return render(
    <CabinetTouchContext.Provider value={touch}>
      <ProtocolDriftGame />
    </CabinetTouchContext.Provider>
  );
}

const root = () =>
  document.querySelector<HTMLElement>("[data-game='protocol-drift']")!;

async function click(name: RegExp | string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function openBriefing(touch: boolean) {
  renderGame(touch);
  await screen.findByRole("dialog", { name: /Trial Briefing/ });
}

/** Accepts the tracer assignment, so the workbench is in DRAFT. */
async function startTracer(touch: boolean) {
  await openBriefing(touch);
  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Tracer bullet/));
  });
  await click(/accept assignment/i);
}

/** Loads the reference tracer pipeline through the text view's control. */
async function loadTracerReference() {
  await act(async () => {
    fireEvent.click(screen.getByText(/Pipeline as text/));
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/Load a reference pipeline/), {
      target: { value: "tracer" },
    });
  });
  await click("Load");
}

describe("Protocol Drift on the touch cabinet (#2045)", () => {
  beforeAll(() => installFlowMocks());
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("the touch workbench fills the stage instead of the desktop fixed height", async () => {
    renderGame(true);
    await screen.findByRole("dialog", { name: /Trial Briefing/ });
    expect(root().className).toContain("pd-touch");
    expect(root().className).not.toContain("h-[max(760px");
  });

  it("the desktop workbench keeps its fixed height and has no touch class", async () => {
    renderGame(false);
    await screen.findByRole("dialog", { name: /Trial Briefing/ });
    expect(root().className).not.toContain("pd-touch");
    expect(root().className).toContain("h-[max(760px,calc(100dvh-8rem))]");
    expect(root().hasAttribute("data-escape-docks")).toBe(false);
  });

  it("the touch cabinet keeps the toolbox and the site rail open, with no collapse toggles", async () => {
    await startTracer(true);
    expect(
      screen.queryAllByRole("button", { name: /^(Chips|Sites|Collapse)$/ })
    ).toEqual([]);
    expect(screen.getByLabelText("Chip toolbox").className).toContain(
      "pd-touch-toolbox"
    );
    expect(screen.getByLabelText("Site rail").className).toContain(
      "pd-touch-rail"
    );
    // Full chip names, not the one-letter initials of a collapsed toolbox.
    expect(
      screen.getByRole("button", { name: "Add SourceIngest chip" }).textContent
    ).toContain("SourceIngest");
  });

  it("the desktop toolbox and rail keep their collapse toggles", async () => {
    await startTracer(false);
    // jsdom has no layout, so the panels start compact ("Chips" / "Sites").
    expect(
      screen.getAllByRole("button", { name: /^(Chips|Sites|Collapse)$/ })
    ).toHaveLength(2);
    expect(screen.getByLabelText("Chip toolbox").className).not.toContain(
      "pd-touch-toolbox"
    );
  });

  it("the briefing holds Escape on the touch cabinet, and not on desktop", async () => {
    await openBriefing(true);
    const touchDialog = screen.getByRole("dialog", { name: /Trial Briefing/ });
    expect(touchDialog.getAttribute("data-escape-holds")).toBe("true");
    cleanup();
    await openBriefing(false);
    const desktopDialog = screen.getByRole("dialog", {
      name: /Trial Briefing/,
    });
    expect(desktopDialog.hasAttribute("data-escape-holds")).toBe(false);
  });

  it("the inspector is a closed bar until opened, then a sheet that Escape closes", async () => {
    await startTracer(true);
    expect(
      root()
        .querySelector('[data-testid="inspector"]')
        ?.getAttribute("data-expanded")
    ).toBe("false");
    expect(screen.queryByTestId("inspector-sheet")).toBeNull();
    await click(/Expand \(I\)/);
    expect(root().getAttribute("data-escape-docks")).toBe("true");
    const sheet = screen.getByTestId("inspector-sheet");
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    // Escape, pressed inside the sheet, closes the sheet and keeps the cabinet.
    const close = screen.getByRole("button", {
      name: /Close Forensic Inspector/,
    });
    await act(async () => {
      fireEvent.keyDown(close, { key: "Escape" });
    });
    expect(useProtocolDriftStore.getState().inspectorExpanded).toBe(false);
    expect(screen.queryByTestId("inspector-sheet")).toBeNull();
    expect(root().hasAttribute("data-escape-docks")).toBe(false);
  });

  it("the inspector sheet closes on its backdrop and on its 44px close button", async () => {
    await startTracer(true);
    await click(/Expand \(I\)/);
    await act(async () => {
      fireEvent.click(screen.getByTestId("inspector-sheet-backdrop"));
    });
    expect(useProtocolDriftStore.getState().inspectorExpanded).toBe(false);
    await click(/Expand \(I\)/);
    const close = screen.getByRole("button", {
      name: /Close Forensic Inspector/,
    });
    expect(close.className).toContain("min-h-11");
    await act(async () => {
      fireEvent.click(close);
    });
    expect(useProtocolDriftStore.getState().inspectorExpanded).toBe(false);
  });

  it("the inspector's expand and dock controls are at least 44px tall in the touch cabinet", async () => {
    // Controls are sized in the scoped CSS, so the touch cabinet's rule must
    // name the button class the inspector uses.
    const css = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/protocol-drift/protocol-drift-touch.css"
      ),
      "utf8"
    );
    expect(css).toMatch(
      /\.pd-touch button,\s*\.pd-touch summary \{\s*min-height: 44px;/
    );
    await startTracer(true);
    expect(screen.getByRole("button", { name: /Expand \(I\)/ })).toBeTruthy();
  });

  it("the clock pauses on the cabinet's auto-pause event while it runs", async () => {
    await startTracer(true);
    await loadTracerReference();
    await click("Run Local Test");
    await click("Publish Revision");
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED");
    await act(async () => {
      fireEvent.keyDown(root(), { key: " " });
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("RUNNING");
    await act(async () => {
      window.dispatchEvent(new Event(PROTOCOL_DRIFT_AUTO_PAUSE_EVENT));
    });
    await vi.waitFor(() =>
      expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED")
    );
  });

  it("the auto-pause event leaves a paused clock alone", async () => {
    await startTracer(true);
    await loadTracerReference();
    await click("Run Local Test");
    await click("Publish Revision");
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED");
    await act(async () => {
      window.dispatchEvent(new Event(PROTOCOL_DRIFT_AUTO_PAUSE_EVENT));
    });
    expect(useProtocolDriftStore.getState().snapshot?.fsmState).toBe("PAUSED");
  });
});
