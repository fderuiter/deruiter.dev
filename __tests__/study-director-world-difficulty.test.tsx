import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  CRO_FLOOR,
  WORLD_SAVE_KEY,
  getStation,
  hudReadout,
  newWorld,
  parseWorld,
  serializeWorld,
  startDay,
  type WorldState,
} from "@/lib/study-director-world";
import {
  DIFFICULTIES,
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  WILDCARDS_PER_RUN,
  beginStudy,
  createStudy,
  endDay,
  finalizeStudy,
  type Difficulty,
  type FinalReport,
} from "@/lib/study-director";
import {
  CAREER_KEY,
  emptyCareer,
  loadCareer,
  mergeCareers,
  parseCareer,
  recordRun,
} from "@/components/study-director/career";
import { PersonnelFile } from "@/components/study-director/PersonnelFile";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

const INTRO_KEY = "study_director_world_intro_seen";
const LABEL: Record<Difficulty, string> = {
  calm: "Calm protocol",
  standard: "Standard",
  rescue: "Rescue study",
};

/** A saved world as JSON, with its study's difficulty removed, as before #2058. */
function legacySave(world: WorldState): string {
  const raw = JSON.parse(serializeWorld(world));
  delete raw.study.difficulty;
  return JSON.stringify(raw);
}

/** A world on the study's last day, standing at the car. */
function lastDayAtTheCar(difficulty: Difficulty): WorldState {
  const world = startDay(newWorld(`diff-${difficulty}`, difficulty)).world;
  const car = getStation(CRO_FLOOR, "exit");
  if (!car) throw new Error("no car on the floor");
  const { study } = world;
  return {
    ...world,
    study: { ...study, day: study.setup.durationDays + study.slipDays - 1 },
    location: "parking",
    player: { x: car.x - 1, y: car.y, facing: "right" },
  };
}

function finished(seed: string, difficulty?: Difficulty): FinalReport {
  let s = beginStudy(
    createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
  );
  if (difficulty) s = { ...s, difficulty };
  for (let i = 0; i < 200 && s.status === "running"; i += 1) s = endDay(s);
  return finalizeStudy(s);
}

function withGrade(
  report: FinalReport,
  grade: "A" | "B" | "C" | "D" | "F",
  stars: FinalReport["evaluations"]["sponsor"]["stars"]
): FinalReport {
  return {
    ...report,
    evaluations: {
      ...report.evaluations,
      regulatory: { grade, gaps: 0 },
      sponsor: { ...report.evaluations.sponsor, stars },
    },
  };
}

function savedWorld(): WorldState | null {
  return parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));
}

beforeEach(() => {
  globalThis.localStorage?.clear?.();
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("office save: difficulty", () => {
  it("loads a save without a difficulty as standard", () => {
    const world = startDay(newWorld("legacy-1", "standard")).world;
    const parsed = parseWorld(legacySave(world));
    expect(parsed?.study.difficulty).toBe("standard");
    expect(parsed && hudReadout(parsed).difficulty).toBe("standard");
  });

  it("keeps each difficulty through a save and treats nonsense as standard", () => {
    for (const d of DIFFICULTIES) {
      const world = startDay(newWorld(`keep-${d}`, d)).world;
      expect(parseWorld(serializeWorld(world))?.study.difficulty).toBe(d);
    }
    const raw = JSON.parse(
      serializeWorld(startDay(newWorld("odd-1", "calm")).world)
    );
    raw.study.difficulty = "nightmare";
    expect(parseWorld(JSON.stringify(raw))?.study.difficulty).toBe("standard");
  });

  it("matches what the intro says each difficulty changes", () => {
    const at = (d: Difficulty) => newWorld("compare-1", d).study;
    const standard = at("standard");
    expect(at("calm").setup.budget).toBe(
      Math.round(standard.setup.budget * 1.15)
    );
    expect(at("rescue").slipDays - standard.slipDays).toBe(6);
    expect(WILDCARDS_PER_RUN).toEqual({ calm: 2, standard: 3, rescue: 4 });
    // The office's own meters do not change with the difficulty.
    const calm = newWorld("compare-1", "calm");
    const rescue = newWorld("compare-1", "rescue");
    expect([calm.energy, calm.focus, calm.minute]).toEqual([
      rescue.energy,
      rescue.focus,
      rescue.minute,
    ]);
  });
});

describe("office: choosing the difficulty", () => {
  it("offers it in the first-run intro and starts the run on it", () => {
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const intro = screen.getByTestId("world-intro");
    expect(within(intro).getByText(/two surprise events/)).toBeTruthy();
    fireEvent.click(within(intro).getByRole("radio", { name: /Rescue study/ }));
    fireEvent.click(
      within(intro).getByRole("button", { name: "Start the day" })
    );
    expect(screen.getByTestId("world-difficulty").textContent).toBe(
      "Rescue study"
    );
    expect(savedWorld()?.study.difficulty).toBe("rescue");
  });

  it("offers it beside the floor until the run is touched, and keeps it on reload", () => {
    globalThis.localStorage.setItem(INTRO_KEY, "1");
    const first = render(<StudyDirectorWorld onExit={vi.fn()} />);
    expect(screen.getByTestId("world-difficulty").textContent).toBe("Standard");
    const seed = savedWorld()?.study.seed;
    fireEvent.click(screen.getByRole("radio", { name: /Calm protocol/ }));
    expect(screen.getByTestId("world-difficulty").textContent).toBe(
      "Calm protocol"
    );
    // Same study, new starting conditions.
    expect(savedWorld()?.study.seed).toBe(seed);
    expect(savedWorld()?.study.difficulty).toBe("calm");

    // A reload before doing anything can still change its mind.
    first.unmount();
    const second = render(<StudyDirectorWorld onExit={vi.fn()} />);
    expect(screen.getByTestId("world-difficulty").textContent).toBe(
      "Calm protocol"
    );
    expect(screen.getByTestId("world-conditions")).toBeTruthy();

    // The first action fixes it.
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])
      fireEvent.keyDown(screen.getByTestId("world-playfield"), { key });
    expect(screen.queryByTestId("world-conditions")).toBeNull();
    second.unmount();
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    expect(screen.queryByTestId("world-conditions")).toBeNull();
    expect(screen.getByTestId("world-difficulty").textContent).toBe(
      "Calm protocol"
    );
  });

  it("does not offer it when resuming a run already under way", () => {
    globalThis.localStorage.setItem(INTRO_KEY, "1");
    const world = startDay(newWorld("under-way", "standard")).world;
    globalThis.localStorage.setItem(
      WORLD_SAVE_KEY,
      legacySave({ ...world, minute: world.minute + 30 })
    );
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    expect(screen.queryByTestId("world-conditions")).toBeNull();
    expect(screen.getByTestId("world-difficulty").textContent).toBe("Standard");
  });
});

describe("office: every difficulty starts, saves, reloads and finishes", () => {
  it.each(DIFFICULTIES)("%s", async (d) => {
    globalThis.localStorage.setItem(INTRO_KEY, "1");
    globalThis.localStorage.setItem(
      WORLD_SAVE_KEY,
      serializeWorld(lastDayAtTheCar(d))
    );
    window.history.replaceState(null, "", "/#mode=world");
    render(<StudyDirectorGame />);
    const playfield = await screen.findByTestId("world-playfield");
    expect(screen.getByTestId("world-difficulty").textContent).toBe(LABEL[d]);
    expect(screen.queryByTestId("world-conditions")).toBeNull();
    fireEvent.keyDown(playfield, { key: "e" });
    fireEvent.click(screen.getByRole("button", { name: "Go home" }));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "See the closeout" }));
    });
    const report = await screen.findByTestId("study-report");
    expect(report.textContent).toContain(
      `Study ${STUDY_24_081.id} · ${LABEL[d]}`
    );
    // The share card names it beside the office tag.
    expect(report.textContent).toContain(`${LABEL[d]} · office run`);
    const career = loadCareer();
    expect(career.history[0].difficulty).toBe(d);
    expect(Object.keys(career.bests)).toEqual([d]);
  });
});

describe("career bests per difficulty", () => {
  it("tags each run and keeps a best on each difficulty", () => {
    let career = emptyCareer();
    career = recordRun(
      career,
      withGrade(finished("c-1", "calm"), "A", 5),
      "a"
    ).career;
    career = recordRun(
      career,
      withGrade(finished("c-2", "rescue"), "C", 2),
      "b"
    ).career;
    career = recordRun(
      career,
      withGrade(finished("c-3", "rescue"), "B", 1),
      "c"
    ).career;
    // A study from before difficulties existed plays as standard.
    career = recordRun(career, withGrade(finished("c-4"), "D", 3), "d").career;
    expect(career.history.map((r) => r.difficulty)).toEqual([
      "standard",
      "rescue",
      "rescue",
      "calm",
    ]);
    expect(career.bests).toEqual({
      calm: { grade: "A", stars: 5 },
      rescue: { grade: "B", stars: 2 },
      standard: { grade: "D", stars: 3 },
    });
    expect(career.bestGrade).toBe("A");
    expect(parseCareer(JSON.parse(JSON.stringify(career)))).toEqual(career);
  });

  it("migrates an old career file without guessing difficulties", () => {
    const old = {
      version: 1,
      started: 4,
      finished: 2,
      bestGrade: "B",
      bestStars: 4,
      titles: {},
      history: [
        {
          seed: "old-1",
          grade: "B",
          stars: 4,
          profile: "scientist",
          headline: "Fine.",
        },
      ],
    };
    globalThis.localStorage.setItem(CAREER_KEY, JSON.stringify(old));
    const career = loadCareer();
    expect(career.bestGrade).toBe("B");
    expect(career.bestStars).toBe(4);
    expect(career.bests).toEqual({});
    expect(career.history[0]).not.toHaveProperty("difficulty");
    // Bad entries are dropped; tagged runs seed missing bests.
    const cleaned = parseCareer({
      ...old,
      bests: { rescue: { grade: "Z", stars: 3 }, hard: { grade: "A" } },
      history: [{ ...old.history[0], difficulty: "calm" }],
    });
    expect(cleaned?.bests).toEqual({ calm: { grade: "B", stars: 4 } });
  });

  it("merges bests per difficulty", () => {
    const a = recordRun(
      emptyCareer(),
      withGrade(finished("m-1", "rescue"), "C", 4),
      "a"
    ).career;
    const b = recordRun(
      emptyCareer(),
      withGrade(finished("m-2", "rescue"), "A", 1),
      "b"
    ).career;
    expect(mergeCareers(a, b).bests).toEqual({
      rescue: { grade: "A", stars: 4 },
    });
  });

  it("shows the bests in the personnel file", () => {
    const career = recordRun(
      emptyCareer(),
      withGrade(finished("p-1", "rescue"), "B", 3),
      "Held together."
    ).career;
    render(<PersonnelFile career={career} onImport={vi.fn()} />);
    const bests = screen.getByTestId("study-career-bests");
    expect(bests.textContent).toMatch(/Calm protocolNone/);
    expect(bests.textContent).toMatch(/Rescue studyB/);
    expect(within(bests).getByLabelText("3 of 5 stars")).toBeTruthy();
    expect(screen.getByText(/Held together\./).textContent).toMatch(
      /Rescue study/
    );
  });
});
