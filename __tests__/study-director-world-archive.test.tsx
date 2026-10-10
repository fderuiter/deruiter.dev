import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { finalizeStudy } from "@/lib/study-director";
import {
  HISTORY_LIMIT,
  WORLD_SAVE_KEY,
  closeVisit,
  endMeeting,
  exportDialogueCsv,
  exportMeetingsCsv,
  exportSiteVisitsCsv,
  exportWorldRetrospectiveJson,
  goHome,
  newWorld,
  parseWorld,
  performCheck,
  serializeWorld,
  startDay,
  startMeeting,
  travel,
  type MeetingReport,
  type SiteVisitReport,
  type WorldState,
} from "@/lib/study-director-world";
import { MeetingArchive } from "@/components/study-director/MeetingArchive";
import { ReportView } from "@/components/study-director/ReportView";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

const fresh = (seed = "archive"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

const meeting = (day: number, over: Partial<MeetingReport> = {}) =>
  ({
    kind: "team",
    day,
    minutes: 45,
    personMinutes: 135,
    attendees: ["Maya Lin", "Walt Reyes"],
    changes: ["Maya felt heard"],
    raised: [],
    verdict: "Some of it was useful.",
    ...over,
  }) satisfies MeetingReport;

const visit = (day: number): SiteVisitReport => ({
  siteId: "site-01",
  siteName: "Site 01",
  day,
  checks: ["consent"],
  audited: true,
  findings: [
    {
      field: "unsignedSource",
      label: "Unsigned source",
      actual: 7,
      reported: 1,
      hidden: true,
      text: "Unsigned source: 7. The dashboard showed 1.",
    },
  ],
  unchecked: ["Deviations"],
  learned: [],
  verdict: "The dashboard was kinder than the site.",
});

describe("Study Director world: meeting and site visit history (#1877)", () => {
  it("files each meeting with its day when it ends", () => {
    const world = {
      ...fresh(),
      player: { x: 15, y: 10, facing: "down" as const },
      location: "conference",
    };
    const started = expectOk(startMeeting(world, "team", ["maya", "walt"]));
    const ended = expectOk(endMeeting(started.world));
    expect(ended.world.meetingHistory).toEqual([ended.report]);
    expect(ended.report.day).toBe(world.study.day);
  });

  it("files each site visit when it closes", () => {
    const base = fresh();
    let world = expectOk(travel({ ...base, minute: 9 * 60 }, "site-03")).world;
    world = expectOk(performCheck(world, "consent")).world;
    const closed = closeVisit(world);
    expect(closed.world.siteVisitHistory).toEqual([closed.report]);
  });

  it("keeps only the newest entries", () => {
    const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) =>
      meeting(i + 1)
    );
    const world = {
      ...fresh(),
      player: { x: 15, y: 10, facing: "down" as const },
      location: "conference",
      meetingHistory: many,
    };
    const started = expectOk(startMeeting(world, "team", ["maya"]));
    const ended = expectOk(endMeeting(started.world));
    expect(ended.world.meetingHistory).toHaveLength(HISTORY_LIMIT);
    expect(ended.world.meetingHistory?.at(-1)).toEqual(ended.report);
    expect(ended.world.meetingHistory?.[0].day).toBe(7);
  });

  it("survives the night and a save", () => {
    const world = {
      ...fresh(),
      meetingHistory: [meeting(1)],
      siteVisitHistory: [visit(2)],
    };
    const home = goHome(world).world;
    expect(home.meetingHistory).toEqual([meeting(1)]);
    const loaded = parseWorld(serializeWorld(home));
    expect(loaded?.meetingHistory).toEqual([meeting(1)]);
    expect(loaded?.siteVisitHistory).toEqual([visit(2)]);
  });

  it("loads an older save with empty history", () => {
    const {
      meetingHistory: _m,
      siteVisitHistory: _s,
      ...old
    } = {
      ...fresh(),
      meetingHistory: [meeting(1)],
      siteVisitHistory: [visit(1)],
    };
    const loaded = parseWorld(JSON.stringify(old));
    expect(loaded).not.toBeNull();
    expect(loaded?.meetingHistory ?? []).toEqual([]);
    expect(loaded?.siteVisitHistory ?? []).toEqual([]);
  });

  it("drops malformed entries instead of trusting them, and caps a long save", () => {
    const raw = JSON.parse(
      serializeWorld({
        ...fresh(),
        meetingHistory: Array.from({ length: HISTORY_LIMIT + 10 }, (_, i) =>
          meeting(i + 1)
        ),
        siteVisitHistory: [visit(1)],
      })
    );
    raw.meetingHistory.push(
      { kind: "party", day: 1 },
      { ...meeting(3), attendees: [7] },
      "nonsense",
      null
    );
    raw.siteVisitHistory.push({ siteId: "site-02" }, 5, {
      ...visit(4),
      findings: [{ label: "no text" }],
    });
    const loaded = parseWorld(JSON.stringify(raw));
    expect(loaded?.meetingHistory).toHaveLength(HISTORY_LIMIT);
    expect(loaded?.meetingHistory?.every((m) => m.kind === "team")).toBe(true);
    expect(loaded?.siteVisitHistory).toEqual([visit(1)]);
  });
});

describe("Study Director world: exports (#1877)", () => {
  const world: WorldState = {
    ...fresh("export"),
    meetingHistory: [
      meeting(3, { changes: ['Said "fine", then wasn\'t'], raised: ["e1"] }),
    ],
    siteVisitHistory: [visit(4)],
    observations: [
      {
        id: "o1",
        day: 3,
        source: "Maya Lin",
        text: "Site 03 has about 20 open queries",
        area: "data",
        siteId: "site-03",
      },
    ],
  };
  const report = finalizeStudy({ ...world.study, status: "complete" });

  it("writes one CSV row per meeting, escaping quotes and commas", () => {
    const lines = exportMeetingsCsv(world).split("\n");
    expect(lines[0]).toBe(
      "Day,Kind,Minutes,Person minutes,Attendees,What changed,Raised,Verdict"
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      '3,team,45,135,Maya Lin; Walt Reyes,"Said ""fine"", then wasn\'t",e1,Some of it was useful.'
    );
  });

  it("writes site visits and dialogue", () => {
    const visits = exportSiteVisitsCsv(world).split("\n");
    expect(visits[0]).toBe(
      "Day,Site ID,Site,Checks,Audited,Findings,Unchecked,Verdict"
    );
    expect(visits[1]).toContain("4,site-01,Site 01,consent,yes");
    const dialogue = exportDialogueCsv(world).split("\n");
    expect(dialogue[0]).toBe("Day,Source,Text,Area,Site ID");
    expect(dialogue[1]).toBe(
      "3,Maya Lin,Site 03 has about 20 open queries,data,site-03"
    );
  });

  it("adds the run to the retrospective JSON and leaves it empty without one", () => {
    const parsed = JSON.parse(exportWorldRetrospectiveJson(report, world));
    expect(parsed.meetings).toHaveLength(1);
    expect(parsed.siteVisits).toHaveLength(1);
    expect(parsed.observations).toHaveLength(1);
    expect(parsed.decisions).toBeDefined();
    const bare = JSON.parse(
      exportWorldRetrospectiveJson(report, fresh("bare"))
    );
    expect(bare.meetings).toEqual([]);
  });
});

describe("Study Director world: the meeting archive (#1877)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists meetings newest first and shows the one you pick", () => {
    render(
      <MeetingArchive
        meetings={[
          meeting(3),
          meeting(7, {
            kind: "sponsor",
            attendees: [],
            changes: ["The sponsor appreciated hearing it from you directly"],
            verdict: "Worth the hour.",
          }),
        ]}
      />
    );
    const tabs = within(screen.getByRole("list", { name: "Meetings" }))
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(tabs).toEqual(["Day 7 · Sponsor", "Day 3 · Team"]);
    expect(screen.getByTestId("meeting-archive-entry").textContent).toMatch(
      /Day 7: Sponsor call.*Worth the hour\./
    );
    fireEvent.click(screen.getByRole("button", { name: "Day 3 · Team" }));
    expect(screen.getByTestId("meeting-archive-entry").textContent).toMatch(
      /Day 3: Team meeting.*With Maya Lin, Walt Reyes.*Maya felt heard/
    );
  });

  it("says so when nothing has been held", () => {
    render(<MeetingArchive meetings={[]} />);
    expect(screen.getByTestId("meeting-archive-empty")).toBeTruthy();
  });

  it("is reachable from the desk and returns to it", () => {
    globalThis.localStorage.setItem(
      WORLD_SAVE_KEY,
      serializeWorld({
        ...fresh("desk"),
        player: { x: 4, y: 3, facing: "up" },
        location: "office",
        meetingHistory: [meeting(2)],
      })
    );
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    fireEvent.keyDown(screen.getByTestId("world-playfield"), { key: "e" });
    const desk = screen.getByRole("dialog", { name: "Your desk" });
    fireEvent.click(
      within(desk).getByRole("button", { name: "Meeting archive (1)" })
    );
    const archive = screen.getByRole("dialog", { name: "Meeting archive" });
    expect(archive.textContent).toMatch(/Day 2: Team meeting/);
    fireEvent.click(
      within(archive).getByRole("button", { name: /Back to desk/ })
    );
    expect(screen.getByRole("dialog", { name: "Your desk" })).toBeTruthy();
  });

  it("shows the office run and its exports on the closeout, and nothing for a desk run", () => {
    const world: WorldState = {
      ...fresh("report"),
      meetingHistory: [meeting(5)],
    };
    const report = finalizeStudy({ ...world.study, status: "complete" });
    const { rerender } = render(
      <ReportView report={report} world={world} onRestart={() => {}} />
    );
    const actions = screen.getByTestId("office-export-actions");
    expect(
      within(actions)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual([
      "Export Meetings CSV",
      "Export Site Visits CSV",
      "Export Dialogue CSV",
    ]);
    expect(screen.getByTestId("meeting-archive-entry").textContent).toMatch(
      /Day 5/
    );
    rerender(<ReportView report={report} onRestart={() => {}} />);
    expect(screen.queryByTestId("office-export-actions")).toBeNull();
  });
});
