// Study Director replay audit, readouts round two (#2253): the Today count
// agrees with the EDC, EDC work counts in the wrap-up, a change order's credit
// is explained, and copy that read wrong.
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  dashboard,
  finalizeStudy,
  type DecisionRecord,
} from "@/lib/study-director";
import {
  CRO_FLOOR,
  FACINGS,
  WORLD_MAPS,
  choosePriority,
  clearQueriesAtEdc,
  describeSurroundings,
  eveningWrapUp,
  goHome,
  newWorld,
  roomAt,
  settlePriority,
  startDay,
  stepFrom,
  tileAt,
  workableQueries,
  type Station,
  type WorldMap,
  type WorldState,
} from "@/lib/study-director-world";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { todaysTasks } from "@/components/study-director-world/stage-model";
import { MeetingArchive } from "@/components/study-director/MeetingArchive";
import { ReportView } from "@/components/study-director/ReportView";

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

const fresh = (seed = "audit-2253"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

/** Every site with the same open queries, on a quiet mid-study day. */
function withQueries(world: WorldState, perSite: number): WorldState {
  return {
    ...world,
    minute: 10 * 60,
    study: {
      ...world.study,
      day: 40,
      sites: world.study.sites.map((s) => ({ ...s, openQueries: perSite })),
    },
  };
}

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

/** The world with the player on a floor tile, facing the station. */
function facing(world: WorldState, map: WorldMap, station: Station) {
  for (const f of FACINGS) {
    const at = stepFrom(station, OPPOSITE[f] as (typeof FACINGS)[number]);
    const tile = tileAt(map, at.x, at.y);
    if ((tile === "floor" || tile === "door") && roomAt(map, at.x, at.y))
      return {
        ...world,
        map: map.id,
        player: { x: at.x, y: at.y, facing: f },
      };
  }
  throw new Error(`nowhere to stand in front of ${station.name}`);
}

afterEach(cleanup);

describe("the Today query count matches the EDC (#2253)", () => {
  it("counts the queries the EDC shows, not the true backlog", () => {
    const world = withQueries(fresh(), 3);
    const shown = workableQueries(world);
    const truth = world.study.sites.length * 3;
    expect(shown).toBeLessThan(truth);
    const task = todaysTasks(world).find((t) => t.id === "queries");
    expect(task?.text).toBe(`${shown} queries shown in the EDC`);
    expect(task?.text).not.toContain(String(truth));
    expect(task?.where).toBe("EDC workstation");
  });

  it("drops the task when the EDC shows nothing to work", () => {
    // One hidden query at a quiet site: true, but nothing the EDC can work.
    const world = withQueries(fresh(), 0);
    const hidden = {
      ...world,
      study: {
        ...world.study,
        sites: world.study.sites.map((s, i) =>
          i === 0
            ? {
                ...s,
                coordinator: "invisible" as const,
                lastAuditedDay: null,
                openQueries: 1,
              }
            : s
        ),
      },
    };
    expect(workableQueries(hidden)).toBe(0);
    expect(todaysTasks(hidden).some((t) => t.id === "queries")).toBe(false);
  });

  it("tracks the queue as it is worked", () => {
    const world = withQueries(fresh(), 3);
    const worked = expectOk(clearQueriesAtEdc(world)).world;
    const task = todaysTasks(worked).find((t) => t.id === "queries");
    const left = workableQueries(worked);
    expect(left).toBeLessThan(workableQueries(world));
    if (left === 0) expect(task).toBeUndefined();
    else expect(task?.text).toContain(`${left} `);
  });

  it("has the dashboard's Data row agree with the queue button", () => {
    for (const perSite of [1, 3, 5, 7, 11]) {
      const world = withQueries(fresh(), perSite);
      const shown = workableQueries(world);
      expect(dashboard(world.study).data.summary).toBe(
        `${shown} open ${shown === 1 ? "query" : "queries"} reported`
      );
    }
  });
});

describe("EDC work counts in the wrap-up (#2253)", () => {
  it("credits a day spent only at the EDC", () => {
    let world = withQueries(fresh(), 6);
    world = expectOk(choosePriority(world, "desk")).world;
    let closed = 0;
    for (let i = 0; i < 3; i++) {
      const r = expectOk(clearQueriesAtEdc(world));
      closed += r.cleared;
      world = r.world;
    }
    expect(closed).toBeGreaterThan(0);
    const lines = eveningWrapUp(world).map((l) => l.text);
    expect(lines).not.toContain("You decided nothing today.");
    expect(lines[0]).toBe("No decisions today.");
    expect(lines[1]).toBe(`You closed ${closed} queries at the EDC.`);
    expect(lines.some((l) => /nothing crossed the desk/.test(l))).toBe(false);
    expect(lines.some((l) => /worked the query queue/.test(l))).toBe(true);
  });

  it("still says nothing was decided on a day with no work at all", () => {
    const lines = eveningWrapUp({ ...fresh(), minute: 17 * 60 }).map(
      (l) => l.text
    );
    expect(lines[0]).toBe("You decided nothing today.");
  });

  it("forgets yesterday's queries the next morning", () => {
    const world = expectOk(clearQueriesAtEdc(withQueries(fresh(), 6))).world;
    const next = startDay(goHome(world).world).world;
    expect(eveningWrapUp(next)[0].text).toBe("You decided nothing today.");
  });

  it("puts working queries in the cabinet manual, the intro and the field manual", () => {
    const read = (file: string) =>
      readFileSync(path.join(process.cwd(), file), "utf8");
    expect(read("components/arcade/StudyDirectorClient.tsx")).toMatch(
      /Work the query queue/
    );
    expect(read("components/study-director-world/WorldIntro.tsx")).toMatch(
      /Work the query queue/
    );
    expect(
      GAME_MANUALS["study-director"].controls.some((c) =>
        /query queue/.test(c.action)
      )
    ).toBe(true);
  });
});

describe("a change order's credit is explained overnight (#2253)", () => {
  it("says the money came back when the total falls", () => {
    const world = fresh();
    const record: DecisionRecord = {
      day: world.study.day,
      eventId: "finance-overrun",
      optionId: "change-order",
      label: "Raise a change order with the sponsor",
      documented: true,
      attentionSpent: 0,
      effects: { spend: -12000, meters: { client: -5 } },
    };
    const credited: WorldState = {
      ...world,
      minute: 17 * 60,
      study: {
        ...world.study,
        spent: 20000,
        log: [...world.study.log, record],
      },
    };
    const lines = goHome(credited).report.lines.map((l) => l.text);
    expect(lines).toContain(
      "A change order credited $12,000 back to the budget"
    );
    const credit = lines.indexOf(
      "A change order credited $12,000 back to the budget"
    );
    const spent = lines.findIndex((l) => / spent today, /.test(l));
    expect(credit).toBeLessThan(spent);
  });

  it("says nothing about a credit on an ordinary night", () => {
    const lines = goHome({ ...fresh(), minute: 17 * 60 }).report.lines.map(
      (l) => l.text
    );
    expect(
      lines.some((l) => /back to the budget|back in the budget/.test(l))
    ).toBe(false);
  });
});

describe("copy that read wrong (#2253)", () => {
  it("faces your car, not the Your car", () => {
    const car = CRO_FLOOR.stations.find((s) => s.id === "exit");
    if (!car) throw new Error("no car");
    const text = describeSurroundings(facing(fresh(), CRO_FLOOR, car));
    expect(text).toContain("You are facing your car.");
    expect(text).not.toMatch(/the Your/);
  });

  it("faces a coordinator or investigator by name, and other stations with the", () => {
    const map = WORLD_MAPS["site-03"];
    for (const id of ["coordinator", "pi", "sourceDocuments", "exit"]) {
      const station = map.stations.find((s) => s.id === id);
      if (!station) throw new Error(`no ${id}`);
      const text = describeSurroundings(facing(fresh(), map, station), map);
      if (id === "coordinator" || id === "pi")
        expect(text).toContain(`You are facing ${station.name}.`);
      if (id === "sourceDocuments")
        expect(text).toContain("You are facing the Source documents.");
      if (id === "exit") expect(text).toContain("You are facing your car.");
      expect(text).not.toMatch(/the (Coordinator|Investigator|Your)/);
    }
  });

  it("says 1 day behind, not 1 days behind", () => {
    const world = withQueries(fresh(), 0);
    const late = { ...world.study, slipDays: 1 };
    expect(dashboard(late).timeline.summary).toBe("1 day behind");
    expect(dashboard({ ...late, slipDays: 3 }).timeline.summary).toBe(
      "3 days behind"
    );
  });

  it("says no meetings were held on a finished study", () => {
    render(<MeetingArchive meetings={[]} finished />);
    expect(screen.getByTestId("meeting-archive-empty").textContent).toBe(
      "No meetings were held in this study."
    );
    cleanup();
    render(<MeetingArchive meetings={[]} />);
    expect(screen.getByTestId("meeting-archive-empty").textContent).toBe(
      "No meetings held yet."
    );
  });

  it("does not call the data clean beside major deviations on the closeout", () => {
    const world = fresh("closeout-2253");
    const study = {
      ...world.study,
      status: "complete" as const,
      sites: world.study.sites.map((s) => ({
        ...s,
        openQueries: 0,
        deviations: 4,
      })),
    };
    const report = finalizeStudy(study);
    expect(report.evaluations.science.majorDeviations).toBeGreaterThan(0);
    render(<ReportView report={report} world={world} onRestart={() => {}} />);
    const verdict = screen.getByRole("region", { name: "Verdict" });
    const text = verdict.textContent ?? "";
    expect(text).not.toMatch(/locked clean/);
    expect(text).not.toMatch(/Data cleanliness/);
    expect(text).toMatch(/no open queries/);
    expect(text).toMatch(
      new RegExp(
        `the ${report.evaluations.science.majorDeviations} major deviations? stays? on the record`
      )
    );
    expect(screen.getByTestId("meeting-archive-empty").textContent).toBe(
      "No meetings were held in this study."
    );
  });

  it("varies the quiet-site line from one night to the next", () => {
    const base = fresh();
    const quiet: WorldState = {
      ...base,
      minute: 18 * 60,
      study: {
        ...base.study,
        sites: base.study.sites.map((s, i) =>
          i === 2 ? { ...s, coordinator: "invisible" as const } : s
        ),
      },
    };
    const lines = new Set<string>();
    for (let day = 10; day < 14; day++) {
      const w = expectOk(
        choosePriority(
          { ...quiet, study: { ...quiet.study, day }, plan: undefined },
          "sites"
        )
      ).world;
      const said = settlePriority(w).lines.map((l) => l.text);
      expect(said).toHaveLength(1);
      expect(said[0]).toContain(quiet.study.sites[2].name);
      lines.add(said[0]);
    }
    expect(lines.size).toBeGreaterThan(1);
  });
});
