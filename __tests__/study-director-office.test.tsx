import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  beginStudy,
  createStudy,
  type Meters,
  type StudyState,
} from "@/lib/study-director";
import { OfficeScene } from "@/components/study-director/OfficeScene";
import { describeScene, sceneFor } from "@/components/study-director/scene";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

const FULL: Meters = {
  integrity: 90,
  compliance: 90,
  timeline: 90,
  budget: 90,
  client: 90,
  team: 90,
};

function study(): StudyState {
  return beginStudy(
    createStudy(
      "office-seed",
      STUDY_24_081,
      STUDY_24_081_SITES,
      STUDY_24_081_TEAM
    )
  );
}

function withSites(
  state: StudyState,
  openQueries: number,
  documentationDebt = 0,
  slipDays = 0
): StudyState {
  return {
    ...state,
    documentationDebt,
    slipDays,
    sites: state.sites.map((s, i) => ({
      ...s,
      openQueries: i === 0 ? openQueries : 0,
    })),
  };
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("sceneFor", () => {
  it("draws a calm office for a healthy study", () => {
    const scene = sceneFor(withSites(study(), 0), FULL);
    expect(scene.paperStacks).toBe(0);
    expect(scene.stickyNotes).toBe(0);
    expect(scene.redMarks).toBe(0);
    expect(scene.plant).toBe("thriving");
    expect(scene.smoke).toBe(false);
    expect(scene.fire).toBe(false);
  });

  it("piles paper by open queries and notes by documentation debt, with caps", () => {
    const scene = sceneFor(withSites(study(), 30, 40, 10), FULL);
    expect(scene.paperStacks).toBe(2);
    expect(scene.stickyNotes).toBe(3);
    expect(scene.redMarks).toBe(2);
    const capped = sceneFor(withSites(study(), 500, 100, 90), FULL);
    expect(capped.paperStacks).toBe(4);
    expect(capped.stickyNotes).toBe(6);
    expect(capped.redMarks).toBe(3);
  });

  it("wilts the plant with team morale", () => {
    const s = study();
    expect(sceneFor(s, { ...FULL, team: 59 }).plant).toBe("droopy");
    expect(sceneFor(s, { ...FULL, team: 34 }).plant).toBe("wilted");
  });

  it("smoulders under 35 and burns under 20 on any meter", () => {
    const s = study();
    const smoke = sceneFor(s, { ...FULL, budget: 34 });
    expect([smoke.smoke, smoke.fire]).toEqual([true, false]);
    const fire = sceneFor(s, { ...FULL, compliance: 19 });
    expect([fire.smoke, fire.fire]).toEqual([true, true]);
  });

  it("adds a coffee cup for each attention point spent today", () => {
    const s = study();
    expect(sceneFor({ ...s, attention: 5 }, FULL).cups).toBe(1);
    expect(sceneFor({ ...s, attention: 3 }, FULL).cups).toBe(3);
    expect(sceneFor({ ...s, attention: 0 }, FULL).cups).toBe(4);
  });

  it("blinks the phone only while a critical message waits", () => {
    const s = study();
    expect(sceneFor(s, FULL).phoneBlink).toBe(false);
    expect(sceneFor(s, FULL, { criticalCount: 1 }).phoneBlink).toBe(true);
  });

  it("runs the clock through the working day as attention is spent", () => {
    const s = study();
    expect(sceneFor({ ...s, attention: 5 }, FULL).hour).toBe(9);
    expect(sceneFor({ ...s, attention: 0 }, FULL).hour).toBe(17);
    expect(sceneFor(s, FULL, { night: true }).hour).toBeGreaterThan(21);
  });

  it("counts days since a decision last added a deviation", () => {
    const s = { ...study(), day: 20 };
    expect(sceneFor(s, FULL).daysSinceDeviation).toBe(19);
    const withDeviation: StudyState = {
      ...s,
      log: [
        {
          day: 14,
          eventId: "e",
          optionId: "o",
          label: "Waive it",
          documented: false,
          attentionSpent: 1,
          effects: { sites: [{ siteId: "x", deviations: 2 }] },
        },
      ],
    };
    expect(sceneFor(withDeviation, FULL).daysSinceDeviation).toBe(6);
    expect(sceneFor(s, FULL).deviationLogged).toBe(false);
    expect(sceneFor(withDeviation, FULL).deviationLogged).toBe(true);
  });
});

describe("describeScene", () => {
  it("says what is on screen, including the fire and the denial", () => {
    const scene = sceneFor(withSites(study(), 13, 13, 1), {
      ...FULL,
      team: 10,
    });
    const text = describeScene(scene);
    expect(text).toContain("One stack of unanswered queries");
    expect(text).toContain("One undocumented decision");
    expect(text).toContain("marked up in red");
    expect(text).toContain("The plant has wilted.");
    expect(text).toContain("The waste bin is on fire.");
    expect(text).toContain("says everything is fine");
  });
});

describe("OfficeScene", () => {
  it("renders an image with the scene description and the fire flag", () => {
    const s = study();
    const scene = sceneFor(s, { ...FULL, client: 5 }, { pinned: "C" });
    render(<OfficeScene scene={scene} />);
    const img = screen.getByRole("img", { name: /Study Director's office/ });
    expect(img.getAttribute("aria-label")).toContain("Pinned to the board: C");
    expect(screen.getByTestId("study-office").getAttribute("data-fire")).toBe(
      "true"
    );
  });

  it("appears on the desk once the study starts", () => {
    render(<StudyDirectorGame />);
    expect(screen.queryByTestId("study-office")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    expect(screen.getByTestId("study-office")).toBeTruthy();
  });
});
