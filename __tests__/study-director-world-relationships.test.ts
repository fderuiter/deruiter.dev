// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COFFEE_RUNS_PER_DAY,
  COVER_COOLDOWN_DAYS,
  TRUSTED_TRUST,
  bondFor,
  earlyWarning,
  heartsFor,
  knowsQuirk,
  nightlyCapacity,
  newWorld,
  parseWorld,
  relate,
  relationshipCard,
  relationshipOptions,
  serializeWorld,
  startDay,
  withBond,
  type RelationshipAction,
  type WorldState,
} from "@/lib/study-director-world";

const fresh = (seed = "rel-1"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

const trusting = (w: WorldState, id: string, trust: number) =>
  withBond(w, id, { trust });

function take(w: WorldState, id: string, action: RelationshipAction) {
  const r = relate(w, id, action);
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r;
}

const maya = "maya";
const available = (w: WorldState, id: string, action: RelationshipAction) =>
  relationshipOptions(w, id).find((o) => o.action === action);

describe("coffee", () => {
  it("costs ten minutes and earns a little trust, once a day each", () => {
    const w = fresh();
    const before = bondFor(w, maya).trust;
    const r = take(w, maya, "coffee");
    expect(r.world.minute).toBe(w.minute + 10);
    expect(bondFor(r.world, maya).trust).toBeGreaterThan(before);
    expect(bondFor(r.world, maya).coffeeDay).toBe(1);
    expect(available(r.world, maya, "coffee")).toMatchObject({
      available: false,
    });
    // Asking again does nothing and costs nothing.
    const again = take(r.world, maya, "coffee");
    expect(again.world).toBe(r.world);
    expect(again.lines[0].text).toMatch(/had a coffee from you today/);
  });

  it("is limited to a couple of runs a day across the team", () => {
    let w = fresh();
    const ids = w.study.team.map((m) => m.id);
    for (let i = 0; i < COFFEE_RUNS_PER_DAY; i += 1)
      w = take(w, ids[i], "coffee").world;
    const option = available(w, ids[COFFEE_RUNS_PER_DAY], "coffee");
    expect(option?.available).toBe(false);
    expect(option?.reason).toMatch(/coffee run/);
    const refused = take(w, ids[COFFEE_RUNS_PER_DAY], "coffee");
    expect(refused.world).toBe(w);
  });

  it("lands better once you know how they take it", () => {
    const w = trusting(fresh(), maya, 50);
    const blind = take(w, maya, "coffee");
    const asked = take(
      trusting(take(w, maya, "askAbout").world, maya, 50),
      maya,
      "coffee"
    );
    const gainBlind = bondFor(blind.world, maya).trust - 50;
    const gainKnown = bondFor(asked.world, maya).trust - 50;
    expect(gainKnown).toBeGreaterThan(gainBlind);
    expect(asked.lines[0].text).toMatch(/exactly right/);
  });
});

describe("a small favour", () => {
  it("takes workload off them and earns trust, once a day", () => {
    const w = fresh();
    const before = w.study.team.find((m) => m.id === maya)?.workload ?? 0;
    const r = take(w, maya, "favour");
    expect(r.world.minute).toBe(w.minute + 20);
    expect(
      r.world.study.team.find((m) => m.id === maya)?.workload
    ).toBeLessThan(before);
    expect(bondFor(r.world, maya).favourDay).toBe(1);
    expect(available(r.world, maya, "favour")?.available).toBe(false);
  });

  it("is refused when there is nothing to help with", () => {
    const w = fresh();
    const idle = {
      ...w,
      study: {
        ...w.study,
        team: w.study.team.map((m) => ({ ...m, workload: 10 })),
      },
    };
    expect(available(idle, maya, "favour")?.reason).toMatch(
      /nothing they need/
    );
    expect(take(idle, maya, "favour").world).toBe(idle);
  });
});

describe("asking about them", () => {
  it("teaches the quirk once, and only to someone who will talk", () => {
    const w = fresh();
    const wary = trusting(w, maya, 20);
    expect(available(wary, maya, "askAbout")?.reason).toMatch(/not ready/);
    const open = trusting(w, maya, 50);
    const r = take(open, maya, "askAbout");
    expect(knowsQuirk(r.world, maya)).toBe(true);
    expect(r.world.observations?.some((o) => o.id === "quirk:maya")).toBe(true);
    expect(r.world.minute).toBe(open.minute + 15);
    expect(available(r.world, maya, "askAbout")?.reason).toMatch(
      /already know/
    );
  });

  it("gives every team member a quirk and a coffee order", () => {
    let w = fresh();
    for (const m of w.study.team) {
      w = trusting(w, m.id, 60);
      const r = take(w, m.id, "askAbout");
      const text = r.lines.map((l) => l.text).join(" ");
      expect(text).toContain(m.name);
      expect(text).toMatch(/coffee/);
    }
  });
});

describe("covering for you", () => {
  const tired = (w: WorldState, over = 90): WorldState => ({
    ...w,
    overtime: over,
    energy: 30,
  });

  it("needs four hearts, tired enough, and not too often", () => {
    const w = fresh();
    const known = tired(trusting(w, maya, TRUSTED_TRUST));
    expect(heartsFor(TRUSTED_TRUST)).toBe(4);
    expect(
      available(tired(trusting(w, maya, 50)), maya, "cover")?.reason
    ).toMatch(/does not know you well enough/);
    expect(
      available(trusting(w, maya, TRUSTED_TRUST), maya, "cover")?.reason
    ).toMatch(/do not need covering/);
    expect(available(known, maya, "cover")?.available).toBe(true);
  });

  it("gives back an hour and some energy, and spends some goodwill", () => {
    const w = tired(trusting(fresh(), maya, 80));
    const r = take(w, maya, "cover");
    expect(r.world.overtime).toBe(30);
    expect(r.world.energy).toBeGreaterThan(w.energy);
    expect(bondFor(r.world, maya).trust).toBeLessThan(80);
    expect(bondFor(r.world, maya).coverDay).toBe(1);
  });

  it("cools down for a few days", () => {
    const w = tired(trusting(fresh(), maya, 90));
    const once = take(w, maya, "cover").world;
    const soon = {
      ...tired(once),
      study: { ...once.study, day: 1 + COVER_COOLDOWN_DAYS - 1 },
    };
    expect(available(soon, maya, "cover")?.reason).toMatch(/recently/);
    const later = {
      ...tired(once),
      study: { ...once.study, day: 1 + COVER_COOLDOWN_DAYS },
    };
    expect(available(later, maya, "cover")?.available).toBe(true);
  });
});

describe("what trust unlocks", () => {
  it("lets a trusted member get through one more unit a night", () => {
    const w = fresh();
    const member = w.study.team[0];
    expect(nightlyCapacity(member, TRUSTED_TRUST - 1)).toBe(
      nightlyCapacity(member)
    );
    expect(nightlyCapacity(member, TRUSTED_TRUST)).toBe(
      nightlyCapacity(member) + 1
    );
  });

  it("gives an early warning only from someone who trusts you, after day one", () => {
    const w = fresh();
    expect(earlyWarning(w)).toBeNull();
    const day2 = { ...w, study: { ...w.study, day: 2 } };
    expect(earlyWarning(day2)).toBeNull();
    const quiet = trusting(day2, "walt", TRUSTED_TRUST);
    // Nothing wrong at any site: nothing to warn about.
    expect(
      earlyWarning({
        ...quiet,
        study: {
          ...quiet.study,
          sites: quiet.study.sites.map((s) => ({
            ...s,
            openQueries: 0,
            deviations: 0,
            unsignedSource: 0,
            eligibilityConcerns: 0,
          })),
        },
      })
    ).toBeNull();
    const trusted = {
      ...quiet,
      study: {
        ...quiet.study,
        sites: quiet.study.sites.map((s, i) => ({
          ...s,
          openQueries: i === 1 ? 40 : 0,
        })),
      },
    };
    const warning = earlyWarning(trusted);
    expect(warning?.text).toBe(
      `Walt has a feeling about ${trusted.study.sites[1].name}. Worth a look this week.`
    );
    // The place, never the count.
    expect(warning?.text).not.toMatch(/40|quer/);
    expect(
      earlyWarning({ ...trusted, study: { ...trusted.study, day: 1 } })
    ).toBeNull();
  });

  it("shows trust only as hearts on the card", () => {
    const w = trusting(fresh(), maya, 90);
    const card = relationshipCard(w, maya);
    expect(card?.hearts).toBe(5);
    expect(JSON.stringify(card)).not.toMatch(/"trust"/);
  });
});

describe("saving", () => {
  it("keeps relationship days and the plan across a save", () => {
    let w = fresh();
    w = take(w, maya, "coffee").world;
    w = take(w, maya, "favour").world;
    w = { ...w, plan: { day: 1, priority: "people", handled: ["lunch"] } };
    const back = parseWorld(serializeWorld(w));
    expect(back?.bonds?.maya.coffeeDay).toBe(1);
    expect(back?.bonds?.maya.favourDay).toBe(1);
    expect(back?.plan).toEqual({
      day: 1,
      priority: "people",
      handled: ["lunch"],
    });
  });

  it("drops a damaged plan instead of trusting it", () => {
    const w = fresh();
    const raw = JSON.parse(serializeWorld(w));
    raw.plan = { day: "soon", priority: "everything" };
    expect(parseWorld(JSON.stringify(raw))?.plan).toBeUndefined();
    raw.plan = { day: 2, priority: "everything", handled: [3, "lunch"] };
    expect(parseWorld(JSON.stringify(raw))?.plan).toEqual({
      day: 2,
      priority: null,
      handled: ["lunch"],
    });
  });
});
