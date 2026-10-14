import { describe, it, expect, vi, afterEach } from "vitest";
import React, { useCallback, useRef, useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { InspectionRoundDialog } from "@/components/clinical-trial-chaos/InspectionRoundDialog";
import {
  advanceInspection,
  answerInspectionQuestion,
  createInspectionRecord,
  createInspectionRound,
  extendInspectionTimer,
  INSPECTION_EXTENSION_SECONDS,
  INSPECTION_RECORD_SECONDS,
  isInspectionComplete,
  setInspectionTimerEnabled,
  tickInspectionTimer,
  type InspectionRound,
  type SponsorSkeleton,
} from "@/lib/clinical-trial-chaos";
import { createSeededRandom } from "@/lib/game-utils";

function makeRound(skeletons: SponsorSkeleton[] = []): InspectionRound {
  const records = Array.from({ length: 6 }, (_, i) =>
    createInspectionRecord(
      {
        id: `s-${i}`,
        subjectLabel: `SUBJ-${2000 + i}`,
        studySite: "Site 014",
        status: "submitted",
        timeRemaining: 30,
        maxTime: 30,
        createdAt: 0,
        observations: [
          {
            id: `o-${i}`,
            field: "Height",
            rawValue: `${170 + i} m`,
            correctedValue: `${170 + i} cm`,
            currentValue: `${170 + i} cm`,
            destination: "VS",
            errorType: "unit-error",
            isResolved: true,
          },
        ],
      },
      "VS",
      { method: "signed", reason: "Intent to Submit", signatures: 1 }
    )
  );
  return createInspectionRound(records, skeletons, createSeededRandom(2089));
}

function Harness({
  initial,
  onDone,
}: {
  initial: InspectionRound;
  onDone: (round: InspectionRound) => void;
}) {
  const [round, setRound] = useState<InspectionRound | null>(initial);
  const returnRef = useRef<HTMLButtonElement | null>(null);
  const onTick = useCallback(
    (s: number) => setRound((r) => (r ? tickInspectionTimer(r, s) : r)),
    []
  );
  return (
    <div>
      <button ref={returnRef} type="button">
        board
      </button>
      {round && (
        <InspectionRoundDialog
          round={round}
          returnFocusTo={returnRef}
          onAnswer={(id) =>
            setRound((r) => (r ? answerInspectionQuestion(r, id) : r))
          }
          onNext={() => {
            const next = advanceInspection(round);
            if (isInspectionComplete(next)) {
              onDone(next);
              setRound(null);
            } else {
              setRound(next);
            }
          }}
          onExtend={() => setRound((r) => (r ? extendInspectionTimer(r) : r))}
          onSetTimerEnabled={(on) =>
            setRound((r) => (r ? setInspectionTimerEnabled(r, on) : r))
          }
          onTick={onTick}
        />
      )}
    </div>
  );
}

describe("InspectionRoundDialog (#2089)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("asks a question, reveals the record after an answer, and moves on", () => {
    const round = makeRound();
    render(<Harness initial={round} onDone={vi.fn()} />);

    const dialog = screen.getByRole("dialog", {
      name: /FDA inspection: closing interview/i,
    });
    expect(dialog).toBeTruthy();
    expect(
      screen.getByText(`Question 1 of ${round.questions.length}`)
    ).toBeTruthy();
    expect(screen.getByText(round.questions[0].prompt)).toBeTruthy();

    const right = round.questions[0].options.find(
      (o) => o.outcome === "correct"
    )!;
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(escape(right.label)) })
    );

    expect(screen.getByTestId("cc-inspection-feedback").textContent).toContain(
      "Matches the audit trail."
    );
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(
      screen.getByText(`Question 2 of ${round.questions.length}`)
    ).toBeTruthy();
  });

  it("picks an answer with the number keys", () => {
    const round = makeRound();
    render(<Harness initial={round} onDone={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "1" });
    expect(screen.getByTestId("cc-inspection-feedback")).toBeTruthy();
  });

  it("runs the timer out, and can extend it or turn it off", () => {
    vi.useFakeTimers();
    render(<Harness initial={makeRound()} onDone={vi.fn()} />);
    const timer = screen.getByRole("timer");
    expect(timer.getAttribute("aria-label")).toBe(
      `${INSPECTION_RECORD_SECONDS} seconds left`
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: `More time (+${INSPECTION_EXTENSION_SECONDS}s)`,
      })
    );
    expect(screen.getByRole("timer").textContent).toBe(
      `${INSPECTION_RECORD_SECONDS + INSPECTION_EXTENSION_SECONDS}s`
    );

    const untimed = screen.getByRole("switch", { name: "Untimed interview" });
    fireEvent.click(untimed);
    expect(untimed.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "Timer off"
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryByTestId("cc-inspection-feedback")).toBeNull();

    fireEvent.click(untimed);
    act(() => {
      vi.advanceTimersByTime(
        (INSPECTION_RECORD_SECONDS + INSPECTION_EXTENSION_SECONDS + 1) * 1000
      );
    });
    expect(screen.getByTestId("cc-inspection-feedback").textContent).toContain(
      "Time ran out"
    );
  });

  it("asks about each sponsor skeleton and files the report at the end", () => {
    const onDone = vi.fn();
    const skeleton: SponsorSkeleton = {
      id: "skel-x",
      category: "Data Integrity",
      severity: "Critical",
      description: "312 queries closed in four minutes.",
      regulation: "21 CFR § 11.10(e) - Audit trail of operator actions",
    };
    const round = makeRound([skeleton]);
    render(<Harness initial={round} onDone={onDone} />);

    for (let i = 0; i < round.questions.length; i++) {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "1" });
      const isLast = i === round.questions.length - 1;
      if (isLast) {
        expect(
          screen.getByText("312 queries closed in four minutes.")
        ).toBeTruthy();
      }
      fireEvent.click(
        screen.getByRole("button", {
          name: isLast ? "File the inspection report" : "Next question",
        })
      );
    }
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps every control at least 44px tall for tablets", () => {
    render(<Harness initial={makeRound()} onDone={vi.fn()} />);
    for (const button of screen.getAllByRole("button")) {
      if (button.textContent === "board") continue;
      expect(button.className).toContain("min-h-[44px]");
    }
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
