import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { PHASES, STUDY_24_081 } from "@/lib/study-director";
import { phaseSpans, radarPoints } from "@/components/study-director/geometry";
import { HealthRadar } from "@/components/study-director/HealthRadar";
import { strain } from "@/components/study-director/Portrait";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

const FULL = {
  integrity: 100,
  compliance: 100,
  timeline: 100,
  budget: 100,
  client: 100,
  team: 100,
};

describe("radarPoints", () => {
  it("puts the first axis straight up and scales by value", () => {
    const [top, second] = radarPoints([100, 50, 0, 0, 0, 0], 100, 80);
    expect(top[0]).toBeCloseTo(100);
    expect(top[1]).toBeCloseTo(20);
    // Second axis is 60 degrees clockwise at half radius.
    expect(second[0]).toBeCloseTo(100 + 40 * Math.cos(-Math.PI / 6));
    expect(second[1]).toBeCloseTo(100 + 40 * Math.sin(-Math.PI / 6));
  });

  it("clamps values outside 0 to 100", () => {
    const [p] = radarPoints([250], 0, 10);
    expect(Math.hypot(p[0], p[1])).toBeCloseTo(10);
    const [q] = radarPoints([-40], 0, 10);
    expect(Math.hypot(q[0], q[1])).toBeCloseTo(0);
  });
});

describe("phaseSpans", () => {
  it("covers every planned day once, in phase order", () => {
    const spans = phaseSpans(STUDY_24_081.durationDays);
    expect(spans[0].start).toBe(1);
    expect(spans[spans.length - 1].end).toBe(STUDY_24_081.durationDays);
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i].start).toBe(spans[i - 1].end + 1);
      expect(PHASES.indexOf(spans[i].phase)).toBeGreaterThan(
        PHASES.indexOf(spans[i - 1].phase)
      );
    }
  });
});

describe("strain", () => {
  it("marks members stretched above 70% and overloaded above 85%", () => {
    expect(strain(70)).toBe("ok");
    expect(strain(71)).toBe("stretched");
    expect(strain(86)).toBe("overloaded");
  });
});

describe("HealthRadar", () => {
  afterEach(cleanup);

  it("describes the meters and names the weakest", () => {
    render(<HealthRadar meters={{ ...FULL, budget: 20 }} baseline={null} />);
    const radar = screen.getByRole("img", { name: /Study health/ });
    expect(radar.getAttribute("aria-label")).toMatch(/Weakest: Budget/);
    expect(screen.queryByTestId("study-health-baseline")).toBeNull();
  });

  it("draws the start-of-day outline when given a baseline", () => {
    render(<HealthRadar meters={FULL} baseline={{ ...FULL, team: 50 }} />);
    expect(screen.getByTestId("study-health-baseline")).toBeTruthy();
  });
});

describe("Study Director desk graphics", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the phase timeline, radar and unverified sites on day 1", () => {
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    expect(
      screen.getByTestId("study-phase-timeline").getAttribute("aria-label")
    ).toMatch(/Protocol phase, day 1 of 77/);
    expect(screen.getByTestId("study-health-radar")).toBeTruthy();
    expect(screen.getAllByText("Unverified")).toHaveLength(5);
  });

  it("shows how a decision moved the meters against the start of the day", () => {
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Sure, we'll add them/ })
    );
    const health = screen.getByRole("region", { name: "Study health" });
    expect(within(health).getByText("Start of today")).toBeTruthy();
    expect(within(health).getAllByText(/^[+−]\d+$/).length).toBeGreaterThan(0);
  });

  it("marks an audited site with its day and real numbers", () => {
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    fireEvent.click(screen.getByRole("button", { name: "Audit Site 01" }));
    expect(screen.getByText(/Audited day 1/)).toBeTruthy();
    expect(screen.getAllByText("Unverified")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Audit Site 01" }).textContent
    ).toBe("Re-audit");
  });
});
