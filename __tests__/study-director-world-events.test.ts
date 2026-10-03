// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  dashboard,
  endDay,
  getEvent,
  inbox,
  type StudyState,
} from "@/lib/study-director";
import {
  ASSIGNMENT_LOAD,
  CRO_FLOOR,
  DAY_START,
  MEETING_MINUTES,
  RETRY_MINUTES,
  TEAM_INTERACTIONS,
  answerCall,
  bondFor,
  brushOff,
  channelFor,
  decide,
  delegate,
  deskView,
  documentAtDesk,
  edcScreen,
  endMeeting,
  goHome,
  hallwayCatch,
  ignoreCall,
  interact,
  nightlyCapacity,
  openAtDesk,
  phoneCalls,
  placePeople,
  ringingCall,
  sendToVoicemail,
  startDay,
  startMeeting,
  step,
  talk,
  withBond,
  workTheNight,
  newWorld,
  type WorldState,
} from "@/lib/study-director-world";

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

const morning = (seed = "ev-1") => startDay(newWorld(seed, "standard")).world;

/** Advances whole days (going home and coming back) until a test holds. */
function until(world: WorldState, test: (w: WorldState) => boolean, max = 40) {
  let w = world;
  for (let i = 0; i < max && !test(w); i += 1)
    w = startDay(goHome(w).world).world;
  if (!test(w)) throw new Error("condition never held");
  return w;
}

const waitingFor = (id: string) => (w: WorldState) =>
  inbox(w.study).some((e) => e.id === id);

function withSites(
  world: WorldState,
  patch: (s: StudyState["sites"][number]) => object
): WorldState {
  return {
    ...world,
    study: {
      ...world.study,
      sites: world.study.sites.map((s) => ({ ...s, ...patch(s) })),
    },
  };
}

const inConference = (w: WorldState): WorldState => ({
  ...w,
  player: { x: 15, y: 10, facing: "down" },
  location: "conference",
});

describe("events reach the player through people, the phone and the desk (#1689)", () => {
  it("routes team messages to people, callers to the phone and the rest to mail", () => {
    const world = morning();
    expect(channelFor(world, { from: "Maya (Data Manager)" })).toEqual({
      kind: "person",
      memberId: "maya",
    });
    expect(channelFor(world, { from: "Walt (Monitoring)" })).toEqual({
      kind: "person",
      memberId: "walt",
    });
    expect(
      channelFor(world, { from: "Arcadia Therapeutics (Sponsor)" }).kind
    ).toBe("phone");
    expect(channelFor(world, { from: "Site 02 coordinator" }).kind).toBe(
      "phone"
    );
    expect(channelFor(world, { from: "IT Helpdesk" }).kind).toBe("mail");
  });

  it("has the sender stop you in the hallway once, and a brush-off costs a little trust", () => {
    const world = until(morning("hall-1"), waitingFor("stat-endpoint-two"));
    const priya = placePeople(world).find((p) => p.memberId === "priya");
    if (!priya) throw new Error("Priya is not in");
    const near = {
      ...world,
      player: { x: priya.x, y: priya.y + 1, facing: "up" as const },
    };
    expect(hallwayCatch(near, placePeople(near))).toEqual({
      memberId: "priya",
      eventId: "stat-endpoint-two",
    });
    expect(hallwayCatch(world, placePeople(world))).toBeNull();
    const t0 = bondFor(near, "priya").trust;
    const brushed = brushOff(near, "stat-endpoint-two");
    expect(hallwayCatch(brushed, placePeople(brushed))).toBeNull();
    expect(bondFor(brushed, "priya").trust).toBeLessThan(t0);
  });
});

describe("the phone rings, interrupts and takes time (#1689)", () => {
  it("rings in working hours, after the morning starts, spaced apart", () => {
    let checked = 0;
    let world = morning("ring-1");
    for (let d = 0; d < 30; d += 1) {
      const calls = phoneCalls(world);
      const start = DAY_START + world.study.routine * 45;
      for (const c of calls) {
        expect(c.ringAt).toBeGreaterThanOrEqual(start + 15);
        expect(c.ringAt).toBeLessThanOrEqual(16 * 60 + 30);
        checked += 1;
      }
      for (let i = 1; i < calls.length; i += 1)
        expect(calls[i].ringAt - calls[i - 1].ringAt).toBeGreaterThanOrEqual(
          20
        );
      world = startDay(goHome(world).world).world;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("is scheduled before its time, rings from it, and a step across the time sets it ringing", () => {
    const world = morning("ring-2");
    const [call] = phoneCalls(world);
    expect(call.eventId).toBe("sponsor-biomarkers");
    expect(ringingCall({ ...world, minute: call.ringAt - 1 })).toBeNull();
    // Stand in the corridor and take a step across the ring time.
    const walker: WorldState = {
      ...world,
      minute: call.ringAt - 0.25,
      player: { x: 20, y: 8, facing: "left" },
      location: "corridor",
    };
    expect(ringingCall(walker)).toBeNull();
    const stepped = expectOk(step(walker, "left", CRO_FLOOR, []));
    expect(ringingCall(stepped.world)?.eventId).toBe("sponsor-biomarkers");
    expect(ringingCall({ ...stepped.world, location: "home" })).toBeNull();
    // Away on a site visit, the desk phone cannot reach you.
    expect(
      ringingCall({
        ...stepped.world,
        map: "site-01",
        visit: {
          siteId: "site-01",
          mapId: "site-01",
          day: stepped.world.study.day,
          arrivedAt: stepped.world.minute,
          number: 1,
          checks: [],
          observations: [],
        },
      })
    ).toBeNull();
  });

  it("rings again after being ignored, stops for voicemail, and answering takes ten minutes", () => {
    const world = morning("ring-3");
    const [call] = phoneCalls(world);
    const now = { ...world, minute: call.ringAt };
    const ignored = ignoreCall(now, call.eventId);
    expect(ringingCall(ignored)).toBeNull();
    expect(
      ringingCall({ ...ignored, minute: call.ringAt + RETRY_MINUTES })?.eventId
    ).toBe(call.eventId);
    const vm = sendToVoicemail(now, call.eventId);
    expect(ringingCall({ ...vm, minute: 16 * 60 })).toBeNull();
    expect(deskView(vm).voicemail.map((v) => v.eventId)).toEqual([
      call.eventId,
    ]);
    const answered = expectOk(answerCall(now, call.eventId));
    expect(answered.world.minute).toBe(call.ringAt + 10);
    expect(ringingCall(answered.world)).toBeNull();
    expect(answered.dialogue.choices.map((c) => c.id)).toEqual(
      getEvent(call.eventId)?.options.map((o) => o.id)
    );
  });

  it("keeps quiet during a meeting", () => {
    const world = inConference(morning("ring-4"));
    const [call] = phoneCalls(world);
    const meeting = expectOk(
      startMeeting({ ...world, minute: call.ringAt - 5 }, "sponsor", [])
    );
    expect(ringingCall({ ...meeting.world, minute: call.ringAt })).toBeNull();
  });
});

describe("world actions translate into domain calls (#1689)", () => {
  it("turns a dialogue choice into resolveEvent, undocumented, with the option's debt", () => {
    const world = morning("dec-1");
    const option = getEvent("sponsor-biomarkers")?.options.find(
      (o) => o.id === "accept"
    );
    const result = expectOk(decide(world, "sponsor-biomarkers", "accept"));
    const record = result.world.study.log.at(-1);
    expect(record).toMatchObject({
      eventId: "sponsor-biomarkers",
      optionId: "accept",
      documented: false,
    });
    expect(result.world.study.handled).toContain("sponsor-biomarkers");
    expect(result.world.study.documentationDebt).toBe(
      world.study.documentationDebt + (option?.debtIfUndocumented ?? 0)
    );
    expect(result.world.minute).toBe(world.minute);
    expect(deskView(result.world).undocumented.map((u) => u.eventId)).toEqual([
      "sponsor-biomarkers",
    ]);
  });

  it("charges the conversation's time when answering someone in the hallway", () => {
    const world = until(morning("dec-2"), waitingFor("stat-endpoint-two"));
    const id = getEvent("stat-endpoint-two")?.options[0].id ?? "";
    expect(
      expectOk(decide(world, "stat-endpoint-two", id, "hallway")).world.minute
    ).toBe(world.minute + 10);
  });

  it("documents at the desk in twenty minutes and repays the debt in full the same day", () => {
    const decided = expectOk(
      decide(morning("doc-1"), "sponsor-biomarkers", "accept")
    ).world;
    const filed = expectOk(documentAtDesk(decided, "sponsor-biomarkers"));
    expect(filed.world.minute).toBe(decided.minute + 20);
    expect(filed.world.study.log.at(-1)?.documented).toBe(true);
    expect(filed.world.study.documentationDebt).toBe(0);
    expect(deskView(filed.world).undocumented).toEqual([]);
    expect(documentAtDesk(filed.world, "sponsor-biomarkers").ok).toBe(false);
  });

  it("repays only half when written up on a later day", () => {
    const decided = expectOk(
      decide(morning("doc-2"), "sponsor-biomarkers", "accept")
    ).world;
    const later = startDay(goHome(decided).world).world;
    const debt = later.study.documentationDebt;
    const filed = expectOk(documentAtDesk(later, "sponsor-biomarkers"));
    expect(filed.world.study.documentationDebt).toBeCloseTo(debt - 3, 5);
  });

  it("reads mail and returns calls at the desk for ten minutes each", () => {
    const world = morning("desk-1");
    const call = expectOk(openAtDesk(world, "sponsor-biomarkers", "callback"));
    expect(call.world.minute).toBe(world.minute + 10);
    expect(phoneCalls(call.world)[0].status).toBe("answered");
    expect(call.dialogue.via).toBe("callback");
  });

  it("opens the desk, the EDC and a conversation from E", () => {
    const world = morning("desk-2");
    const atPhone = { ...world, player: { x: 4, y: 3, facing: "up" as const } };
    expect(interact(atPhone, CRO_FLOOR, [], TEAM_INTERACTIONS)?.panel).toEqual({
      kind: "desk",
    });
    const atEdc = { ...world, player: { x: 4, y: 5, facing: "up" as const } };
    expect(interact(atEdc, CRO_FLOOR, [], TEAM_INTERACTIONS)?.panel).toEqual({
      kind: "edc",
    });
    const people = placePeople(world);
    const maya = people.find((p) => p.memberId === "maya");
    if (!maya) throw new Error("no Maya");
    const facing = {
      ...world,
      player: { x: maya.x, y: maya.y + 1, facing: "up" as const },
    };
    expect(
      interact(facing, CRO_FLOOR, people, TEAM_INTERACTIONS)?.panel
    ).toEqual({ kind: "dialogue", memberId: "maya" });
  });

  it("shows the dashboard beside what the player has actually been told", () => {
    const base = withBond(
      withSites(morning("edc-1"), (s) =>
        s.id === "site-03" ? { openQueries: 20 } : {}
      ),
      "maya",
      { trust: 80 }
    );
    expect(edcScreen(base).find((r) => r.area === "data")?.seen).toEqual([]);
    const told = expectOk(talk(base, "maya")).world;
    const row = edcScreen(told).find((r) => r.area === "data");
    expect(row?.reported).toBe(dashboard(told.study).data.summary);
    expect(row?.seen[0]?.text).toMatch(/Site 03 has about 20 open queries/);
  });
});

describe("meetings report time against change (#1689)", () => {
  it("seats attendees, costs forty-five minutes of everyone's time and adds to their load", () => {
    const world = inConference(morning("meet-1"));
    expect(
      startMeeting(
        { ...world, player: { x: 35, y: 12, facing: "up" } },
        "team",
        ["maya"]
      ).ok
    ).toBe(false);
    const started = expectOk(startMeeting(world, "team", ["maya", "walt"]));
    const seated = placePeople(started.world).filter(
      (p) => p.activity === "meeting"
    );
    expect(seated.map((p) => p.memberId).sort()).toEqual(["maya", "walt"]);
    expect(seated.every((p) => p.room === "conference")).toBe(true);
    const ended = expectOk(endMeeting(started.world));
    expect(ended.world.minute).toBe(world.minute + MEETING_MINUTES);
    expect(ended.world.meeting).toBeNull();
    expect(ended.report.personMinutes).toBe(MEETING_MINUTES * 3);
    const load = (w: WorldState, id: string) =>
      w.study.team.find((m) => m.id === id)?.workload ?? 0;
    expect(load(ended.world, "maya")).toBe(load(world, "maya") + 2);
  });

  it("says a meeting that changed nothing could have been an email", () => {
    const world = inConference(
      withBond(morning("meet-2"), "lee", { trust: 20 })
    );
    const ended = expectOk(
      endMeeting(expectOk(startMeeting(world, "team", ["lee"])).world)
    );
    expect(ended.report.changes).toEqual([]);
    expect(ended.report.verdict).toBe("Could have been an email.");
  });

  it("surfaces what trusting people would say in private, and raises their messages", () => {
    let world = until(morning("meet-3"), waitingFor("stat-endpoint-two"));
    world = withSites(world, (s) =>
      s.id === "site-03" ? { openQueries: 20 } : {}
    );
    world = inConference(withBond(world, "maya", { trust: 80 }));
    const ended = expectOk(
      endMeeting(expectOk(startMeeting(world, "team", ["maya", "priya"])).world)
    );
    expect(
      ended.report.changes.some((c) => /Maya: Site 03 has about 20/.test(c))
    ).toBe(true);
    expect(ended.report.raised).toContain("stat-endpoint-two");
    expect(ended.world.raised).toContain("stat-endpoint-two");
    expect(ended.report.verdict).not.toBe("Could have been an email.");
  });

  it("counts decisions made on a sponsor call and warms the sponsor", () => {
    const world = inConference(morning("meet-4"));
    const started = expectOk(startMeeting(world, "sponsor", []));
    const decided = expectOk(
      decide(started.world, "sponsor-biomarkers", "assess", "meeting")
    );
    const ended = expectOk(endMeeting(decided.world));
    expect(
      ended.report.changes.some((c) =>
        /Decided in the room: Add them after/.test(c)
      )
    ).toBe(true);
    expect(ended.world.study.adjust.client).toBe(
      decided.world.study.adjust.client + 2
    );
    expect(ended.world.minute).toBe(world.minute + 45);
  });
});

describe("delegation and ownership (#1689)", () => {
  const backlog = (seed: string) =>
    withSites(morning(seed), (s) =>
      s.id === "site-03" ? { openQueries: 12 } : {}
    );
  const load = (w: WorldState, id: string) =>
    w.study.team.find((m) => m.id === id)?.workload ?? 0;

  it("records an assignment in the domain and lands it over the nights through capacity", () => {
    const world = backlog("del-1");
    const assigned = expectOk(delegate(world, "maya", "assign"));
    expect(assigned.world.minute).toBe(world.minute + 10);
    expect(assigned.world.study.log.at(-1)).toMatchObject({
      eventId: "world:assign:maya:1",
      documented: true,
    });
    expect(load(assigned.world, "maya")).toBe(
      load(world, "maya") + ASSIGNMENT_LOAD
    );
    const job = assigned.world.assignments?.[0];
    expect(job).toMatchObject({
      stream: "queries",
      siteId: "site-03",
      amount: 12,
      remaining: 12,
    });
    const maya = assigned.world.study.team.find((m) => m.id === "maya");
    const capacity = maya ? nightlyCapacity(maya) : 0;
    const night = workTheNight(assigned.world);
    expect(
      night.world.study.sites.find((s) => s.id === "site-03")?.openQueries
    ).toBe(12 - capacity);
    expect(night.world.assignments?.[0].remaining).toBe(12 - capacity);
    expect(night.lines[0].text).toMatch(
      /Maya worked on query resolution at Site 03/
    );
  });

  it("finishes, takes the load back off, and rewards reviewing it", () => {
    let world = expectOk(delegate(backlog("del-2"), "maya", "assign")).world;
    const loaded = load(world, "maya");
    for (
      let i = 0;
      i < 5 && (world.assignments?.[0].remaining ?? 0) > 0;
      i += 1
    )
      world = workTheNight(world).world;
    expect(world.assignments?.[0].remaining).toBe(0);
    expect(load(world, "maya")).toBe(loaded - ASSIGNMENT_LOAD);
    const t0 = bondFor(world, "maya").trust;
    const reviewed = expectOk(delegate(world, "maya", "review"));
    expect(reviewed.world.minute).toBe(world.minute + 20);
    expect(bondFor(reviewed.world, "maya").trust).toBeGreaterThan(t0);
    expect(reviewed.world.assignments?.[0].reviewed).toBe(true);
  });

  it("gives ownership to a member who is coached twice and trusts you", () => {
    let world = withBond(backlog("own-1"), "maya", { trust: 62 });
    const first = expectOk(delegate(world, "maya", "coach"));
    expect(first.owns).toBeUndefined();
    expect(first.world.minute).toBe(world.minute + 45);
    world = startDay(goHome(first.world).world).world;
    const second = expectOk(delegate(world, "maya", "coach"));
    expect(second.owns).toBe("queries");
    expect(bondFor(second.world, "maya").owns).toBe("queries");
    const before =
      second.world.study.sites.find((s) => s.id === "site-03")?.openQueries ??
      0;
    const night = workTheNight(second.world);
    expect(
      night.world.study.sites.find((s) => s.id === "site-03")?.openQueries
    ).toBeLessThan(before);
    expect(
      night.lines.some((l) => /Maya kept query resolution moving/.test(l.text))
    ).toBe(true);
  });

  it("has Walt, owning monitoring, visit a site every third day", () => {
    const base = withSites(
      withBond(morning("own-2"), "walt", { owns: "monitoring" }),
      (s) => (s.id === "site-03" ? { unsignedSource: 4 } : {})
    );
    const onThird = { ...base, study: { ...base.study, day: 3 } };
    const night = workTheNight(onThird);
    const site = night.world.study.sites.find((s) => s.id === "site-03");
    expect(site?.lastAuditedDay).toBe(3);
    expect(site?.unsignedSource).toBe(3);
    expect(
      workTheNight({ ...base, study: { ...base.study, day: 4 } }).lines
    ).toEqual([]);
  });

  it("escalates for contract help and lets the player take work over", () => {
    const world = backlog("del-3");
    const escalated = expectOk(delegate(world, "maya", "escalate"));
    expect(escalated.world.study.spent).toBe(world.study.spent + 3000);
    expect(load(escalated.world, "maya")).toBe(
      Math.max(0, load(world, "maya") - 15)
    );
    const taken = expectOk(delegate(world, "maya", "takeOver"));
    expect(taken.world.minute).toBe(world.minute + 60);
    expect(
      taken.world.study.sites.find((s) => s.id === "site-03")?.openQueries
    ).toBe(9);
    expect(taken.world.study.log.at(-1)?.eventId).toBe("world:takeOver:maya:1");
  });

  it("asks status as a talk, and reports work landing in the overnight report", () => {
    const world = backlog("del-4");
    const asked = expectOk(delegate(world, "dana", "askStatus"));
    expect(asked.world.minute).toBe(world.minute + 10);
    expect(asked.lines[0].text).toMatch(/^Dana is /);
    const assigned = expectOk(delegate(world, "maya", "assign")).world;
    const home = goHome(assigned);
    expect(home.report.lines[0].text).toMatch(
      /Maya worked on query resolution/
    );
  });
});

describe("going home and the next morning (#1689)", () => {
  it("opens the morning with who wants a word and what is still to write up", () => {
    let world = expectOk(
      decide(morning("dig-1"), "sponsor-biomarkers", "accept")
    ).world;
    world = until(world, waitingFor("stat-endpoint-two"));
    const digest = startDay(goHome(world).world).digest;
    expect(digest.lines.map((l) => l.text)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Priya .*wants? a word/),
        expect.stringMatching(/1 decision still to write up/),
      ])
    );
  });

  it("clears a meeting left open when the player goes home", () => {
    const started = expectOk(
      startMeeting(inConference(morning("dig-2")), "sponsor", [])
    ).world;
    expect(goHome(started).world.meeting).toBeNull();
    expect(endDay(started.study).day).toBe(started.study.day + 1);
  });
});
