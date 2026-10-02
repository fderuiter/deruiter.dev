// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  SPONSOR_REQUESTS,
  SPONSOR_STARTING_MOOD,
  SPONSOR_MAX_FOLLOW_UPS,
  SPONSOR_FOLLOW_UP_MOOD_PENALTY,
  SPONSOR_DROPPED_MOOD_PENALTY,
  createInitialSponsorState,
  tickSponsor,
  resolveSponsorChoice,
  pickSponsorRequest,
  getFollowUpSubject,
  getSponsorMoodLabel,
  applySponsorSubmissionBoost,
  applySponsorSkeletonsToReport,
  describePhaseClearForm483,
  getSponsorMoodDecayPerSecond,
  SPONSOR_BOOST_TAPER_START,
  SPONSOR_MOOD_DECAY_PER_SECOND,
  generateBIMOReport,
  createInitialScoreState,
  createInitialAuditorState,
  SponsorState,
} from "../lib/clinical-trial-chaos";

const zero = () => 0;

function withArrivedRequest(): SponsorState {
  const { state } = tickSponsor(createInitialSponsorState(1), 1.5, zero);
  return state;
}

describe("Clinical Trial Chaos - Sponsor inbox", () => {
  it("declares unique requests, each with three choices", () => {
    const ids = SPONSOR_REQUESTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of SPONSOR_REQUESTS) {
      expect(r.choices).toHaveLength(3);
      expect(r.deadlineSeconds).toBeGreaterThan(0);
    }
  });

  it("delivers the first email once the initial delay elapses", () => {
    const initial = createInitialSponsorState(5);
    const early = tickSponsor(initial, 2, zero);
    expect(early.state.activeRequest).toBeNull();
    expect(early.events).toHaveLength(0);

    const arrived = tickSponsor(early.state, 3.5, zero);
    expect(arrived.state.activeRequest?.request.id).toBe(
      SPONSOR_REQUESTS[0].id
    );
    expect(arrived.events[0]).toMatchObject({ type: "request_arrived" });
  });

  it("decays mood over time", () => {
    const { state } = tickSponsor(createInitialSponsorState(100), 10, zero);
    expect(state.mood).toBeLessThan(SPONSOR_STARTING_MOOD);
  });

  it("escalates unanswered emails into follow-ups, then drops them", () => {
    let state = withArrivedRequest();
    const deadline = state.activeRequest!.request.deadlineSeconds;

    for (let i = 1; i <= SPONSOR_MAX_FOLLOW_UPS; i++) {
      const moodBefore = state.mood;
      const res = tickSponsor(state, i === 1 ? deadline + 0.1 : 12.1, zero);
      state = res.state;
      expect(res.events[0]).toMatchObject({ type: "follow_up" });
      expect(state.activeRequest?.followUps).toBe(i);
      expect(state.mood).toBeLessThan(
        moodBefore - SPONSOR_FOLLOW_UP_MOOD_PENALTY + 0.01
      );
    }

    const dropped = tickSponsor(state, 12.1, zero);
    expect(dropped.events[0]).toMatchObject({
      type: "request_dropped",
      moodDelta: -SPONSOR_DROPPED_MOOD_PENALTY,
    });
    expect(dropped.state.activeRequest).toBeNull();
    expect(dropped.state.ignored).toBe(1);
  });

  it("terminates the contract when mood reaches zero", () => {
    const state: SponsorState = { ...createInitialSponsorState(100), mood: 1 };
    const res = tickSponsor(state, 10, zero);
    expect(res.state.mood).toBe(0);
    expect(res.events).toContainEqual({ type: "contract_terminated" });
    // Already terminated: no further events.
    expect(tickSponsor(res.state, 10, zero).events).toHaveLength(0);
  });

  it("applies choice effects and records skeletons", () => {
    const state = withArrivedRequest();
    const request = state.activeRequest!.request;
    const idx = request.choices.findIndex((c) => c.effects.skeleton);
    expect(idx).toBeGreaterThanOrEqual(0);

    const res = resolveSponsorChoice(state, idx, zero);
    expect(res.effects).toBe(request.choices[idx].effects);
    expect(res.outcome).toBe(request.choices[idx].outcome);
    expect(res.state.skeletons).toHaveLength(1);
    expect(res.state.activeRequest).toBeNull();
    expect(res.state.handled).toBe(1);
    expect(res.state.mood).toBeCloseTo(
      Math.min(100, state.mood + request.choices[idx].effects.sponsorMood)
    );
  });

  it("ignores choices when there is no active email or the index is invalid", () => {
    const idle = createInitialSponsorState();
    expect(resolveSponsorChoice(idle, 0).effects).toBeNull();
    const active = withArrivedRequest();
    expect(resolveSponsorChoice(active, 9).state).toBe(active);
  });

  it("does not repeat the previous email back-to-back", () => {
    const last = SPONSOR_REQUESTS[0].id;
    expect(pickSponsorRequest(zero, last).id).not.toBe(last);
    expect(pickSponsorRequest(() => 0.99999, null).id).toBe(
      SPONSOR_REQUESTS[SPONSOR_REQUESTS.length - 1].id
    );
  });

  it("formats follow-up subjects and mood labels", () => {
    const r = SPONSOR_REQUESTS[0];
    expect(getFollowUpSubject(r, 1)).toContain("circling back");
    expect(getFollowUpSubject(r, 2)).toContain("manager");
    expect(getSponsorMoodLabel(0)).toContain("another CRO");
    expect(getSponsorMoodLabel(90)).not.toBe(getSponsorMoodLabel(30));
  });

  it("boosts mood on submissions, capped at 100", () => {
    const s = { ...createInitialSponsorState(), mood: 99.5 };
    expect(applySponsorSubmissionBoost(s, true).mood).toBe(100);
    expect(applySponsorSubmissionBoost(s, false).mood).toBe(100);
    const dead = { ...createInitialSponsorState(), mood: 0 };
    expect(applySponsorSubmissionBoost(dead, true).mood).toBe(0);
  });

  it("tapers the submission boost as satisfaction climbs (#1327)", () => {
    const at = (mood: number) =>
      applySponsorSubmissionBoost(
        { ...createInitialSponsorState(), mood },
        true
      ).mood - mood;
    expect(at(SPONSOR_BOOST_TAPER_START)).toBe(5);
    expect(at(80)).toBeCloseTo(2.5);
    expect(at(95)).toBeCloseTo(1.25);
    expect(
      applySponsorSubmissionBoost(
        { ...createInitialSponsorState(), mood: 40 },
        false
      ).mood
    ).toBe(43);
  });

  it("decays faster in later phases so phase 3 keeps the pressure on (#1327)", () => {
    expect(getSponsorMoodDecayPerSecond(1)).toBe(SPONSOR_MOOD_DECAY_PER_SECOND);
    expect(getSponsorMoodDecayPerSecond(2)).toBeGreaterThan(
      getSponsorMoodDecayPerSecond(1)
    );
    expect(getSponsorMoodDecayPerSecond(3)).toBeGreaterThan(
      getSponsorMoodDecayPerSecond(2)
    );
    const start = createInitialSponsorState(1000);
    const p1 = tickSponsor(start, 10, zero).state.mood;
    const p3 = tickSponsor(start, 10, zero, getSponsorMoodDecayPerSecond(3))
      .state.mood;
    expect(p1).toBeCloseTo(start.mood - 3.5);
    expect(p3).toBeCloseTo(start.mood - 8);
  });

  it("a fast phase 3 player no longer pins satisfaction at 100% (#1327)", () => {
    // One clean lock every 4 s for three minutes.
    let state = createInitialSponsorState(100000);
    for (let t = 0; t < 180; t += 4) {
      state = tickSponsor(
        state,
        4,
        zero,
        getSponsorMoodDecayPerSecond(3)
      ).state;
      state = applySponsorSubmissionBoost(state, true);
    }
    expect(state.mood).toBeLessThan(90);
    expect(state.mood).toBeGreaterThan(50);
  });

  it("surfaces skeletons as BIMO findings and escalates the verdict", () => {
    const clean = generateBIMOReport(
      {
        ...createInitialScoreState(),
        subjectsSubmitted: 5,
        cleanSubmissions: 5,
      },
      createInitialAuditorState()
    );
    expect(clean.verdict).toMatch(/^NAI/);
    expect(applySponsorSkeletonsToReport(clean, [])).toBe(clean);

    const skeletons = SPONSOR_REQUESTS.flatMap((r) =>
      r.choices.flatMap((c) => (c.effects.skeleton ? [c.effects.skeleton] : []))
    );
    const minor = skeletons.filter((s) => s.severity === "Minor");
    const critical = skeletons.filter((s) => s.severity === "Critical");

    const minorReport = applySponsorSkeletonsToReport(clean, minor.slice(0, 1));
    expect(minorReport.verdict).toMatch(/^VAI/);
    expect(minorReport.findings.at(-1)?.id).toBe("FND-SPONSOR-1");
    expect(minorReport.overallScore).toBe(clean.overallScore - 4);

    const criticalReport = applySponsorSkeletonsToReport(clean, critical);
    expect(criticalReport.verdict).toMatch(/^OAI/);
    expect(criticalReport.summary).toContain("sponsor-pleasing shortcut");
  });

  // #899 (option b): a phase can clear with an OAI report. The end panel must
  // own that verdict and list what caused it rather than say "audit passed".
  it("explains a phase-clear Form 483 from Critical skeletons and audit violations", () => {
    const clean = generateBIMOReport(
      createInitialScoreState(),
      createInitialAuditorState()
    );
    expect(describePhaseClearForm483(clean, 0)).toBeNull();

    const skeletons = SPONSOR_REQUESTS.flatMap((r) =>
      r.choices.flatMap((c) => (c.effects.skeleton ? [c.effects.skeleton] : []))
    );
    const minor = skeletons.filter((s) => s.severity === "Minor");
    const critical = skeletons.filter((s) => s.severity === "Critical");

    // VAI keeps today's wording.
    expect(
      describePhaseClearForm483(
        applySponsorSkeletonsToReport(clean, minor.slice(0, 1)),
        0
      )
    ).toBeNull();

    const oai = applySponsorSkeletonsToReport(clean, critical.slice(0, 1));
    expect(describePhaseClearForm483(oai, 0)).toEqual([
      critical[0].description,
    ]);

    const violations = generateBIMOReport(
      { ...createInitialScoreState(), auditViolations: 3 },
      createInitialAuditorState()
    );
    const causes = describePhaseClearForm483(violations, 3);
    expect(causes?.at(-1)).toContain("3 audit violations");
  });
});
