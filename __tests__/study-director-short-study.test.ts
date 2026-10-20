// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EVENT_CALENDAR_DAYS,
  RESCUE_SLIP_DAYS,
  STUDY_24_081,
  STUDY_24_081_SHORT,
  STUDY_24_081_SHORT_SITES,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  STUDY_EVENTS,
  applyDifficulty,
  beginStudy,
  calendarScale,
  createStudy,
  endDay,
  eventDay,
  inbox,
  resolveEvent,
  scaleDays,
  studyLength,
  studyPreset,
  type StudyState,
} from "@/lib/study-director";
import { guestDay } from "@/lib/study-director-world";

function shortStudy(seed: string): StudyState {
  const preset = studyPreset("short");
  return beginStudy(createStudy(seed, preset.setup, preset.sites, preset.team));
}

describe("short study preset", () => {
  it("is the same protocol, shorter, with fewer subjects and sites", () => {
    expect(STUDY_24_081_SHORT.durationDays).toBe(35);
    expect(STUDY_24_081_SHORT.subjects).toBe(24);
    expect(STUDY_24_081_SHORT_SITES.map((s) => s.id)).toEqual([
      "site-01",
      "site-02",
      "site-03",
    ]);
    expect(STUDY_24_081_SHORT.sponsor).toEqual(STUDY_24_081.sponsor);
    expect(studyLength(STUDY_24_081_SHORT)).toBe("short");
    expect(studyLength(STUDY_24_081)).toBe("full");
    expect(studyPreset("full").setup).toBe(STUDY_24_081);
    expect(studyPreset("full").sites).toBe(STUDY_24_081_SITES);
    expect(studyPreset("short").team).toBe(STUDY_24_081_TEAM);
  });

  it("scales from the full study's calendar", () => {
    expect(EVENT_CALENDAR_DAYS).toBe(STUDY_24_081.durationDays);
    expect(calendarScale(STUDY_24_081)).toBe(1);
    expect(calendarScale(STUDY_24_081_SHORT)).toBeCloseTo(35 / 77);
    // A custom scenario of any length keeps the calendar it always had.
    expect(calendarScale({ ...STUDY_24_081, durationDays: 40 })).toBe(1);
  });
});

describe("full study unchanged", () => {
  it("keeps every event on its written day", () => {
    const state = createStudy(
      "full-1",
      STUDY_24_081,
      STUDY_24_081_SITES,
      STUDY_24_081_TEAM
    );
    for (const event of STUDY_EVENTS)
      expect(eventDay(state, event)).toBe(event.day);
  });

  it("starts a rescue six days behind", () => {
    const study = applyDifficulty(
      createStudy("r-1", STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM),
      "rescue"
    );
    expect(study.slipDays).toBe(RESCUE_SLIP_DAYS);
  });
});

describe("short study calendar", () => {
  const study = shortStudy("short-cal");
  const last = STUDY_24_081_SHORT.durationDays - 1;

  it("lands every scripted event inside the study, in the same order", () => {
    // Late events (#2093) are written past the planned end, for slipped runs.
    const scripted = STUDY_EVENTS.filter(
      (e) => !e.followUp && e.day < EVENT_CALENDAR_DAYS
    );
    for (const event of scripted) {
      const day = eventDay(study, event);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(last);
    }
    const byWritten = [...scripted].sort((a, b) => a.day - b.day);
    const days = byWritten.map((e) => eventDay(study, e));
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  it("leaves room for every follow-up chain, even answered on the last day", () => {
    for (const event of STUDY_EVENTS) {
      for (const option of event.options) {
        for (const s of option.schedule ?? []) {
          const latestAnswer = eventDay(study, event) + event.ttl - 1;
          const lands = latestAnswer + scaleDays(s.inDays, study.setup);
          expect(lands, `${event.id} -> ${s.eventId}`).toBeLessThanOrEqual(
            last
          );
        }
      }
    }
  });

  it("fires each follow-up when its source is answered the scheduling way", () => {
    for (const source of STUDY_EVENTS) {
      for (const option of source.options) {
        for (const s of option.schedule ?? []) {
          let state = shortStudy(`chain-${source.id}`);
          let answered = false;
          let fired = false;
          for (let i = 0; i < 60 && state.status === "running"; i += 1) {
            const due = inbox(state);
            if (!answered && due.some((e) => e.id === source.id)) {
              const result = resolveEvent(state, source.id, option.id, true);
              expect(result.ok).toBe(true);
              if (result.ok) state = result.state;
              answered = true;
            }
            if (inbox(state).some((e) => e.id === s.eventId)) {
              fired = true;
              break;
            }
            state = endDay(state);
          }
          expect(answered, source.id).toBe(true);
          expect(fired, `${source.id} -> ${s.eventId}`).toBe(true);
        }
      }
    }
  });

  it("draws its wildcards inside the study", () => {
    const wild = new Set(
      STUDY_EVENTS.filter((e) => e.wildcard).map((e) => e.id)
    );
    for (const seed of ["w-1", "w-2", "w-3", "w-4"]) {
      const drawn = shortStudy(seed).scheduled.filter((s) =>
        wild.has(s.eventId)
      );
      expect(drawn.length).toBeGreaterThan(0);
      for (const s of drawn) expect(s.day).toBeLessThanOrEqual(last);
    }
  });

  it("finishes on its own planned day when nothing slips", () => {
    let state = shortStudy("finish-1");
    state = { ...state, scheduled: [] };
    for (let i = 0; i < 100 && state.status === "running"; i += 1)
      state = endDay(state);
    expect(state.status).toBe("complete");
    expect(state.day).toBe(35 + state.slipDays);
    expect(state.sites.reduce((n, s) => n + s.enrolled, 0)).toBeLessThanOrEqual(
      24
    );
  });

  it("starts a rescue proportionally fewer days behind", () => {
    const preset = studyPreset("short");
    const rescue = applyDifficulty(
      createStudy("r-2", preset.setup, preset.sites, preset.team),
      "rescue"
    );
    expect(rescue.slipDays).toBe(3);
  });

  it("brings both visitors inside the study", () => {
    for (const seed of ["g-1", "g-2", "g-3", "g-4", "g-5"]) {
      for (const id of ["sponsorVisit", "vendorMeeting"] as const) {
        const day = guestDay(seed, id, STUDY_24_081_SHORT);
        expect(day).toBeGreaterThanOrEqual(2);
        expect(day).toBeLessThanOrEqual(last);
        // The full study's visitors keep their days.
        expect(guestDay(seed, id, STUDY_24_081)).toBe(guestDay(seed, id));
      }
    }
  });
});
