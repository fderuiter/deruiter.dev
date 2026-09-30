import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  WILDCARDS_PER_RUN,
  applyDifficulty,
  beginStudy,
  createStudy,
  endDay,
  finalizeStudy,
  getEvent,
  inbox,
  resolveEvent,
  scheduleWildcards,
  type Difficulty,
  type StudyEvent,
  type StudyState,
} from "@/lib/study-director";
import { verdictFor } from "@/components/study-director/closeout";
import { dailyHeadline } from "@/components/study-director/headline";
import { DecisionPanel } from "@/components/study-director/DecisionPanel";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

function fresh(seed: string, difficulty: Difficulty = "standard"): StudyState {
  return applyDifficulty(
    createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM),
    difficulty
  );
}

type Pick = (e: StudyEvent) => { option: string; documented: boolean };

const score = (e: StudyEvent["options"][number]): number =>
  Object.values(e.effects.meters ?? {}).reduce((a, b) => a + (b ?? 0), 0) -
  (e.effects.slipDays ?? 0) * 2 -
  (e.effects.spend ?? 0) / 2000;

const STRATEGIES: Record<string, Pick> = {
  careful: (e) => ({
    option: [...e.options].sort((a, b) => score(b) - score(a))[0].id,
    documented: true,
  }),
  literal: (e) => ({ option: e.options[0].id, documented: true }),
  cheap: (e) => ({
    option: [...e.options].sort((a, b) => a.attentionCost - b.attentionCost)[0]
      .id,
    documented: false,
  }),
};

function play(seed: string, pick: Pick, difficulty?: Difficulty): StudyState {
  let s = beginStudy(fresh(seed, difficulty));
  for (let guard = 0; guard < 200 && s.status === "running"; guard += 1) {
    for (const event of inbox(s)) {
      const choice = pick(event);
      let r = resolveEvent(s, event.id, choice.option, choice.documented);
      if (!r.ok && choice.documented)
        r = resolveEvent(s, event.id, choice.option, false);
      if (r.ok) s = r.state;
    }
    s = endDay(s);
  }
  return s;
}

describe("wildcards", () => {
  it("draws a seeded set of distinct wildcards across the study", () => {
    for (const difficulty of ["calm", "standard", "rescue"] as const) {
      const s = scheduleWildcards(fresh("wild-seed", difficulty));
      expect(s.scheduled).toHaveLength(WILDCARDS_PER_RUN[difficulty]);
      const ids = s.scheduled.map((x) => x.eventId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const { eventId, day } of s.scheduled) {
        expect(getEvent(eventId)?.wildcard).toBe(true);
        expect(day).toBeGreaterThanOrEqual(8);
        expect(day).toBeLessThanOrEqual(
          Math.round(STUDY_24_081.durationDays * 0.85)
        );
      }
    }
  });

  it("is the same for the same seed, different across seeds, and leaves other draws alone", () => {
    const a = scheduleWildcards(fresh("same"));
    expect(scheduleWildcards(fresh("same")).scheduled).toEqual(a.scheduled);
    expect(a.draws).toBe(0);
    const seen = new Set(
      ["s1", "s2", "s3", "s4", "s5", "s6"].map((seed) =>
        JSON.stringify(scheduleWildcards(fresh(seed)).scheduled)
      )
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("reaches the inbox on its day", () => {
    let s = beginStudy(fresh("inbox-wild"));
    const [first] = s.scheduled;
    while (s.day < first.day) s = endDay(s);
    expect(inbox(s).map((e) => e.id)).toContain(first.eventId);
  });
});

describe("difficulty", () => {
  it("gives calm more budget and rescue a late, over-spent start", () => {
    const standard = fresh("d");
    const calm = fresh("d", "calm");
    const rescue = fresh("d", "rescue");
    expect(standard.difficulty).toBe("standard");
    expect(calm.setup.budget).toBeGreaterThan(standard.setup.budget);
    expect(calm.adjust.client).toBeGreaterThan(0);
    expect(rescue.slipDays).toBe(6);
    expect(rescue.spent).toBeGreaterThan(0);
    expect(rescue.documentationDebt).toBeGreaterThan(0);
    expect(rescue.adjust.client).toBeLessThan(0);
  });
});

describe("callbacks", () => {
  function atConsent(): StudyState {
    let s = beginStudy(fresh("callback"));
    while (!inbox(s).some((e) => e.id === "cowboy-pi-consent")) s = endDay(s);
    return s;
  }

  it("brings back a waived consent signature, and only then", () => {
    const waived = resolveEvent(
      atConsent(),
      "cowboy-pi-consent",
      "slide",
      false
    );
    const firm = resolveEvent(atConsent(), "cowboy-pi-consent", "firm", false);
    if (!waived.ok || !firm.ok) throw new Error("setup failed");
    let a = waived.state;
    let b = firm.state;
    while (a.day < 45) a = endDay(a);
    while (b.day < 45) b = endDay(b);
    expect(inbox(a).map((e) => e.id)).toContain("callback-consent-monitor");
    expect(inbox(b).map((e) => e.id)).not.toContain("callback-consent-monitor");
  });

  it("names the earlier decision on the desk", () => {
    const waived = resolveEvent(
      atConsent(),
      "cowboy-pi-consent",
      "slide",
      false
    );
    if (!waived.ok) throw new Error("setup failed");
    const day = waived.state.log.at(-1)!.day;
    render(
      <DecisionPanel
        state={waived.state}
        event={getEvent("callback-consent-monitor")}
        documented={false}
        onDocumentedChange={() => {}}
        onChoose={() => {}}
        footer={null}
      />
    );
    expect(screen.getByTestId("study-callback").textContent).toBe(
      `Because of day ${day}: you chose “Let it slide this once”.`
    );
  });
});

describe("balance", () => {
  it("replays identically from the same seed and choices", () => {
    expect(JSON.stringify(play("replay", STRATEGIES.careful))).toBe(
      JSON.stringify(play("replay", STRATEGIES.careful))
    );
  });

  it("makes every verdict tier reachable and rewards careful play", () => {
    const headlines = new Set<string>();
    const scores: Record<string, number[]> = {};
    for (const [name, pick] of Object.entries(STRATEGIES)) {
      for (const seed of ["b1", "b2", "b3"]) {
        const v = verdictFor(finalizeStudy(play(seed, pick)));
        headlines.add(v.headline);
        (scores[name] ??= []).push(v.score);
      }
    }
    headlines.add(
      verdictFor(
        finalizeStudy(play("b1", () => ({ option: "", documented: false })))
      ).headline
    );
    expect(headlines.size).toBe(4);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(scores.careful)).toBeGreaterThan(mean(scores.literal));
    expect(mean(scores.literal)).toBeGreaterThan(mean(scores.cheap));
  });
});

describe("daily headline", () => {
  it("leads with a meter on fire and keeps the quote", () => {
    const s = beginStudy(fresh("headline"));
    const burning = { ...s, adjust: { ...s.adjust, compliance: -95 } };
    expect(dailyHeadline(burning)).toMatch(
      /^Day 1: Compliance at \d+\. Study Director: “Everything is fine\.”$/
    );
  });

  it("calls a calm day suspicious", () => {
    let s = beginStudy(fresh("headline-quiet"));
    for (let i = 0; i < 40 && dailyHeadline(s).includes("critical"); i += 1)
      s = endDay(s);
    expect(dailyHeadline(s)).toMatch(/^Day \d+: /);
  });
});

describe("difficulty on the briefing", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts the study at the chosen difficulty and prints the headline", () => {
    render(<StudyDirectorGame />);
    expect(
      (screen.getByRole("radio", { name: /Standard/ }) as HTMLInputElement)
        .checked
    ).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Rescue study/ }));
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    const saved = JSON.parse(
      window.localStorage.getItem("study_director_save_v1") ?? "{}"
    ) as StudyState;
    expect(saved.difficulty).toBe("rescue");
    expect(saved.slipDays).toBe(6);
    expect(screen.getByTestId("study-headline").textContent).toMatch(
      /^Day 1: /
    );
  });

  it("takes the difficulty from a shared link", () => {
    window.history.replaceState(null, "", "/#seed=abc&difficulty=calm");
    render(<StudyDirectorGame />);
    expect(
      (screen.getByRole("radio", { name: /Calm protocol/ }) as HTMLInputElement)
        .checked
    ).toBe(true);
  });
});
