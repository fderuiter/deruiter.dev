import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  buildRetrospectiveExport,
  createStudy,
  exportDialogueCsv,
  exportMeetingsCsv,
  exportRetrospectiveJson,
  exportSiteVisitsCsv,
  finalizeStudy,
  type FinalReport,
} from "@/lib/study-director";
import {
  createWorld,
  endMeeting,
  goHome,
  parseWorld,
  serializeWorld,
  startMeeting,
  closeVisit,
  type WorldState,
  type MeetingReport,
  type SiteVisitReport,
  type Observation,
} from "@/lib/study-director-world";
import { MeetingReplayPanel } from "@/components/study-director-world/MeetingReplayPanel";
import { ReportView } from "@/components/study-director/ReportView";

const setupTestWorld = (): WorldState => {
  const study = createStudy(
    "persistence-test-seed",
    STUDY_24_081,
    STUDY_24_081_SITES,
    STUDY_24_081_TEAM
  );
  return createWorld(study);
};

describe("World State Meeting Persistence & Retrospective Exports", () => {
  it("endMeeting appends meeting report with day to world.meetingHistory", () => {
    let world = setupTestWorld();
    world = {
      ...world,
      location: "conference",
      player: { x: 15, y: 10, facing: "down" },
    };

    const startRes = startMeeting(world, "team", ["maya", "devon"]);
    expect(startRes.ok).toBe(true);
    if (!startRes.ok) return;

    world = startRes.world;
    const endRes = endMeeting(world);
    expect(endRes.ok).toBe(true);
    if (!endRes.ok) return;

    const nextWorld = endRes.world;
    expect(nextWorld.meetingHistory).toBeDefined();
    expect(nextWorld.meetingHistory?.length).toBe(1);
    const report = nextWorld.meetingHistory![0];
    expect(report.kind).toBe("team");
    expect(report.day).toBe(world.study.day);
    expect(report.attendees.length).toBeGreaterThan(0);
    expect(report.verdict).toBeDefined();
  });

  it("closeVisit appends site visit report to world.siteVisitHistory", () => {
    let world = setupTestWorld();
    world = {
      ...world,
      visit: {
        siteId: "site-01",
        mapId: "site:site-01",
        day: 2,
        arrivedAt: 500,
        number: 1,
        checks: ["consent"],
        observations: [
          { check: "consent", text: "Consent forms signed", tone: "good" },
        ],
      },
    };

    const closeRes = closeVisit(world);
    expect(closeRes.report).not.toBeNull();
    expect(closeRes.world.siteVisitHistory?.length).toBe(1);
    expect(closeRes.world.siteVisitHistory![0].siteId).toBe("site-01");
    expect(closeRes.world.siteVisitHistory![0].day).toBe(2);
  });

  it("saving and reloading preserves meetingHistory and siteVisitHistory and falls back to [] for older saves", () => {
    let world = setupTestWorld();
    const sampleMeeting: MeetingReport = {
      kind: "team",
      day: 3,
      minutes: 45,
      personMinutes: 135,
      attendees: ["Maya Lin", "Devon Park"],
      changes: ["Maya: Protocol gap discussed"],
      raised: ["event-01"],
      verdict: "Worth the hour.",
    };
    const sampleVisit: SiteVisitReport = {
      siteId: "site-01",
      siteName: "Metro General",
      day: 4,
      checks: ["consent"],
      audited: true,
      findings: [],
      unchecked: [],
      learned: [],
      verdict: "Honest site.",
    };

    world = {
      ...world,
      meetingHistory: [sampleMeeting],
      siteVisitHistory: [sampleVisit],
    };

    const serialized = serializeWorld(world);
    const parsed = parseWorld(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed?.meetingHistory).toEqual([sampleMeeting]);
    expect(parsed?.siteVisitHistory).toEqual([sampleVisit]);

    // Test fallback for older save strings without meetingHistory/siteVisitHistory
    const oldSaveRaw = JSON.stringify({
      version: 1,
      study: world.study,
      minute: 480,
      energy: 100,
      focus: 100,
      coffees: 0,
      overtime: 0,
      fatigue: 0,
      location: "lobby",
      player: world.player,
      walked: 0,
      known: [],
    });

    const parsedOld = parseWorld(oldSaveRaw);
    expect(parsedOld).not.toBeNull();
    expect(parsedOld?.meetingHistory).toEqual([]);
    expect(parsedOld?.siteVisitHistory).toEqual([]);
  });

  it("goHome preserves completed meeting history, site visit history, and observations", () => {
    let world = setupTestWorld();
    const sampleMeeting: MeetingReport = {
      kind: "sponsor",
      day: 1,
      minutes: 45,
      personMinutes: 90,
      attendees: ["Sponsor Rep"],
      changes: ["Agreed on budget"],
      raised: [],
      verdict: "Some of it was useful.",
    };
    const sampleObs: Observation = {
      id: "obs-1",
      day: 1,
      source: "Maya",
      text: "Data entry delayed",
      area: "data",
    };

    world = {
      ...world,
      meetingHistory: [sampleMeeting],
      observations: [sampleObs],
    };

    const night = goHome(world);
    expect(night.world.meetingHistory).toEqual([sampleMeeting]);
    expect(night.world.observations).toEqual([sampleObs]);
  });

  it("buildRetrospectiveExport and exportRetrospectiveJson include meetings, siteVisits, and observations", () => {
    const study = createStudy(
      "export-test-seed",
      STUDY_24_081,
      STUDY_24_081_SITES,
      STUDY_24_081_TEAM
    );
    const report: FinalReport = finalizeStudy({
      ...study,
      day: 10,
      status: "complete",
    });

    const world = createWorld(study);
    const sampleMeeting: MeetingReport = {
      kind: "team",
      day: 5,
      minutes: 45,
      personMinutes: 135,
      attendees: ["Maya"],
      changes: ["Discussion"],
      raised: ["ev1"],
      verdict: "Worth the hour.",
    };
    const sampleObs: Observation = {
      id: "o1",
      day: 5,
      source: "Devon",
      text: "Safety alert",
      area: "safety",
    };
    world.meetingHistory = [sampleMeeting];
    world.observations = [sampleObs];

    const exportObj = buildRetrospectiveExport(report, world);
    expect(exportObj.meetings).toEqual([sampleMeeting]);
    expect(exportObj.siteVisits).toEqual([]);
    expect(exportObj.observations).toEqual([sampleObs]);

    const json = exportRetrospectiveJson(report, world);
    const parsed = JSON.parse(json);
    expect(parsed.meetings).toBeDefined();
    expect(parsed.siteVisits).toBeDefined();
    expect(parsed.observations).toBeDefined();
    expect(parsed.meetings.length).toBe(1);
    expect(parsed.meetings[0].day).toBe(5);
  });

  it("exportMeetingsCsv, exportSiteVisitsCsv, and exportDialogueCsv produce valid CSV outputs", () => {
    const study = createStudy(
      "csv-test-seed",
      STUDY_24_081,
      STUDY_24_081_SITES,
      STUDY_24_081_TEAM
    );
    const report: FinalReport = finalizeStudy({
      ...study,
      day: 10,
      status: "complete",
    });

    const world = createWorld(study);
    world.meetingHistory = [
      {
        kind: "team",
        day: 3,
        minutes: 45,
        personMinutes: 135,
        attendees: ["Maya Lin", "Devon Park"],
        changes: ["Maya: Discussed timeline, short delay"],
        raised: ["event-01"],
        verdict: "Worth the hour.",
      },
    ];
    world.siteVisitHistory = [
      {
        siteId: "site-01",
        siteName: "Metro Hospital",
        day: 4,
        checks: ["consent", "eligibility"],
        audited: true,
        findings: [
          {
            field: "openQueries",
            label: "Open Queries",
            actual: 3,
            reported: 0,
            hidden: true,
            text: "3 hidden open queries",
          },
        ],
        unchecked: ["drugAccountability"],
        learned: [],
        verdict: "Discrepancy found.",
      },
    ];
    world.observations = [
      {
        id: "obs-1",
        day: 3,
        source: "Maya Lin",
        text: 'Reported: "Queries spiking"',
        area: "data",
        siteId: "site-01",
      },
    ];

    const meetingsCsv = exportMeetingsCsv(report, world);
    const meetingsLines = meetingsCsv.split("\n");
    expect(meetingsLines[0]).toBe(
      "Kind,Day,Minutes,Person Minutes,Attendees,Changes,Raised,Verdict"
    );
    expect(meetingsLines[1]).toContain("team,3,45,135");
    expect(meetingsLines[1]).toContain("Maya Lin; Devon Park");

    const siteVisitsCsv = exportSiteVisitsCsv(report, world);
    const siteVisitsLines = siteVisitsCsv.split("\n");
    expect(siteVisitsLines[0]).toBe(
      "Site ID,Site Name,Day,Checks,Audited,Findings,Unchecked,Verdict"
    );
    expect(siteVisitsLines[1]).toContain("site-01,Metro Hospital,4");

    const dialogueCsv = exportDialogueCsv(report, world);
    const dialogueLines = dialogueCsv.split("\n");
    expect(dialogueLines[0]).toBe("ID,Day,Source,Text,Area,Site ID");
    expect(dialogueLines[1]).toContain(
      'obs-1,3,Maya Lin,"Reported: ""Queries spiking""",data,site-01'
    );
  });
});

describe("Meeting Replay & Report UI Components", () => {
  afterEach(cleanup);

  it("renders MeetingReplayPanel with meeting tabs, transcript, raised concerns and verdict", () => {
    const sampleMeetings: MeetingReport[] = [
      {
        kind: "team",
        day: 3,
        minutes: 45,
        personMinutes: 135,
        attendees: ["Maya Lin", "Devon Park"],
        changes: ["Maya: Discussion about enrollment goals"],
        raised: ["event-03"],
        verdict: "Worth the hour.",
      },
      {
        kind: "sponsor",
        day: 7,
        minutes: 45,
        personMinutes: 90,
        attendees: ["Sponsor Rep"],
        changes: ["Agreed on budget extension"],
        raised: [],
        verdict: "Some of it was useful.",
      },
    ];

    const handleClose = vi.fn();
    render(
      <MeetingReplayPanel meetings={sampleMeetings} onClose={handleClose} />
    );

    expect(screen.getByTestId("meeting-replay-panel")).toBeDefined();
    expect(screen.getByText("Meeting Archive & Replay")).toBeDefined();
    expect(screen.getByText("Day 3 Team")).toBeDefined();
    expect(screen.getByText("Day 7 Sponsor")).toBeDefined();

    // Check selected meeting details
    expect(screen.getByText("Day 3 · Team Meeting")).toBeDefined();
    expect(
      screen.getByText("Maya: Discussion about enrollment goals")
    ).toBeDefined();
    expect(screen.getByText("• event-03")).toBeDefined();
    expect(screen.getByText("Worth the hour.")).toBeDefined();

    // Switch to second meeting tab
    fireEvent.click(screen.getByText("Day 7 Sponsor"));
    expect(screen.getByText("Day 7 · Sponsor Call")).toBeDefined();
    expect(screen.getByText("Agreed on budget extension")).toBeDefined();

    // Close button
    fireEvent.click(screen.getByText("Close Replay"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders export buttons for meetings, site visits, dialogue CSVs and replay button in ReportView", () => {
    const study = createStudy(
      "ui-report-seed",
      STUDY_24_081,
      STUDY_24_081_SITES,
      STUDY_24_081_TEAM
    );
    const report: FinalReport = finalizeStudy({
      ...study,
      day: 10,
      status: "complete",
    });

    const world = createWorld(study);
    world.meetingHistory = [
      {
        kind: "team",
        day: 3,
        minutes: 45,
        personMinutes: 135,
        attendees: ["Maya Lin"],
        changes: ["Discussed site recruitment"],
        raised: [],
        verdict: "Worth the hour.",
      },
    ];

    render(<ReportView report={report} world={world} onRestart={() => {}} />);

    expect(screen.getByText("Export Meetings CSV")).toBeDefined();
    expect(screen.getByText("Export Site Visits CSV")).toBeDefined();
    expect(screen.getByText("Export Dialogue CSV")).toBeDefined();

    const replayBtn = screen.getByTestId("report-meeting-replay-button");
    expect(replayBtn).toBeDefined();

    // Clicking Replay Meetings button opens MeetingReplayPanel
    fireEvent.click(replayBtn);
    expect(screen.getByTestId("meeting-replay-panel")).toBeDefined();
    expect(screen.getByText("Discussed site recruitment")).toBeDefined();
  });
});
