import React, { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { DialogueLine } from "@/lib/study-director-world";
import {
  DialogueBox,
  type Speaker,
} from "@/components/study-director-world/DialogueBox";
import { OverlayButton } from "@/components/study-director-world/TeamPieces";

const LINES: DialogueLine[] = [
  { kind: "information", text: "The queries are down to twelve." },
  { kind: "warning", text: "Walt has not answered the monitor." },
];
const FULL = LINES.map((l) => l.text).join("");

const MAYA: Speaker = {
  name: "Maya",
  role: "Data manager",
  member: { role: "dataManager", workload: 60 },
  hearts: 3,
};

const Harness: React.FC<{
  lines?: DialogueLine[];
  reducedMotion?: boolean;
  speaker?: Speaker;
  onClose?: () => void;
  onChoose?: (n: number) => void;
}> = ({
  lines = LINES,
  reducedMotion = false,
  speaker = MAYA,
  onClose = () => {},
  onChoose = () => {},
}) => {
  const first = useRef<HTMLButtonElement>(null);
  return (
    <DialogueBox
      titleId="t"
      speaker={speaker}
      subtitle="Choose an answer: 1 to 2"
      lines={lines}
      reducedMotion={reducedMotion}
      testId="box"
      onClose={onClose}
      onKeyDown={(e) => {
        const n = Number(e.key);
        if (n === 1 || n === 2) onChoose(n);
      }}
      initialFocusRef={first}
    >
      <OverlayButton ref={first}>1 First choice</OverlayButton>
      <OverlayButton>2 Second choice</OverlayButton>
    </DialogueBox>
  );
};

/** Lets the typing run for `ms`, one tick at a time as a browser would. */
const run = (ms: number) => {
  for (let t = 0; t < ms; t += 20)
    act(() => {
      vi.advanceTimersByTime(20);
    });
};

/** The part of the text that is still transparent. */
const hidden = () =>
  Array.from(document.querySelectorAll("li span.opacity-0"))
    .map((n) => n.textContent)
    .join("");

describe("DialogueBox", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("names the speaker with a portrait, role and trust hearts", () => {
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Maya" })).toBeTruthy();
    expect(screen.getByText("Data manager")).toBeTruthy();
    expect(screen.getByTestId("speaker-hearts").textContent).toMatch(
      /3 of 5 hearts/
    );
    expect(document.querySelector("svg[data-strain]")).toBeTruthy();
  });

  it("falls back to initials for someone who is not on the team", () => {
    render(
      <Harness speaker={{ name: "Arcadia Therapeutics", role: "Sponsor" }} />
    );
    expect(document.querySelector("svg[data-strain]")).toBeNull();
    expect(screen.getByText("AT")).toBeTruthy();
    expect(screen.queryByTestId("speaker-hearts")).toBeNull();
  });

  it("types the lines out while keeping the whole text in the page", () => {
    render(<Harness />);
    const box = screen.getByTestId("box");
    expect(box.dataset.typing).toBe("typing");
    for (const l of LINES) expect(box.textContent).toContain(l.text);
    expect(hidden().length).toBeGreaterThan(0);
    run(200);
    const midway = hidden().length;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(FULL.length);
    run(5000);
    expect(hidden()).toBe("");
    expect(box.dataset.typing).toBe("done");
  });

  it("finishes at once on Space or Enter and does not press the focused button", () => {
    const onChoose = vi.fn();
    render(<Harness onChoose={onChoose} />);
    const box = screen.getByTestId("box");
    fireEvent.keyDown(box, { key: " " });
    expect(hidden()).toBe("");
    expect(box.dataset.typing).toBe("done");
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("passes choice keys through, while typing and after", () => {
    const onChoose = vi.fn();
    render(<Harness onChoose={onChoose} />);
    const box = screen.getByTestId("box");
    fireEvent.keyDown(box, { key: "2" });
    expect(onChoose).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(box, { key: " " });
    fireEvent.keyDown(box, { key: "1" });
    expect(onChoose).toHaveBeenLastCalledWith(1);
  });

  it("shows everything immediately under reduced motion", () => {
    render(<Harness reducedMotion />);
    expect(hidden()).toBe("");
    expect(screen.getByTestId("box").dataset.typing).toBe("done");
    expect(screen.queryByText(/Space or Enter shows the rest/)).toBeNull();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId("box"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps typing from where it was when lines are added, and restarts for a new talk", () => {
    const { rerender } = render(<Harness />);
    run(5000);
    expect(hidden()).toBe("");
    const more: DialogueLine[] = [
      ...LINES,
      { kind: "opportunity", text: "She can take the amendment." },
    ];
    rerender(<Harness lines={more} />);
    const left = hidden().length;
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual("She can take the amendment.".length);
    rerender(
      <Harness lines={[{ kind: "joke", text: "A different conversation." }]} />
    );
    expect(hidden().length).toBeGreaterThan(0);
  });
});
