// @vitest-environment node
// Study Director 10/10 audit, third pass: visitors are announced (#2188) and
// interruptions vary, lapse and are not blamed on an absent player (#2189).
import { describe, expect, it } from "vitest";
import { computeMeters } from "@/lib/study-director";
import {
  CRO_FLOOR,
  INTERRUPTION_TIMES,
  carOutcome,
  eveningWrapUp,
  excuseAway,
  guestDay,
  guestsExpected,
  newWorld,
  pendingInterruption,
  scheduleFor,
  settleGuests,
  startDay,
  travel,
  type WorldState,
} from "@/lib/study-director-world";
import { todaysTasks } from "@/components/study-director-world/stage-model";

const fresh = (seed = "audit-2188"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

/** The morning of a given study day, as the player arrives. */
function morningOf(seed: string, day: number) {
  const w = newWorld(seed, "standard");
  return startDay({ ...w, study: { ...w.study, day } });
}

describe("Study Director audit: visitors are announced (#2188)", () => {
  const seed = "audit-2188";
  const sponsorDay = guestDay(
    seed,
    "sponsorVisit",
    newWorld(seed, "standard").study.setup
  );

  it("names the sponsor's visit and its time in the morning digest", () => {
    const { digest } = morningOf(seed, sponsorDay);
    expect(digest.lines.map((l) => l.text).join(" ")).toMatch(
      /Imogen Vale of Arcadia Therapeutics visits at 2:00 PM/
    );
    const { digest: before } = morningOf(seed, sponsorDay - 1);
    expect(before.lines.map((l) => l.text).join(" ")).not.toMatch(
      /Imogen Vale/
    );
  });

  it("keeps the visit on the Today list and warns at the car", () => {
    const { world } = morningOf(seed, sponsorDay);
    expect(guestsExpected(world).map((g) => g.id)).toEqual(["sponsorVisit"]);
    expect(
      todaysTasks(world).some((t) =>
        /Imogen Vale .* visits at 2:00 PM/.test(t.text)
      )
    ).toBe(true);
    expect(carOutcome(world).lines.join(" ")).toMatch(
      /Nobody will meet them if you go/
    );
  });

  it("gives missing the vendor a cost the player can read", () => {
    const vendorDay = guestDay(
      seed,
      "vendorMeeting",
      newWorld(seed, "standard").study.setup
    );
    const { world } = morningOf(seed, vendorDay);
    const late = { ...world, minute: 17 * 60 };
    const settled = settleGuests(late);
    expect(settled.lines[0].tone).toBe("bad");
    expect(computeMeters(settled.world.study).compliance).toBeLessThan(
      computeMeters(late.study).compliance
    );
  });
});

describe("Study Director audit: interruptions (#2189)", () => {
  it("does not repeat one within a week", () => {
    const w = fresh("audit-2189");
    const ids = Array.from({ length: 7 }, (_, d) =>
      scheduleFor({ ...w, study: { ...w.study, day: d + 1 } }).map(
        (s) => s.interruption.id
      )
    ).flat();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("serves lunch at midday", () => {
    const w = fresh("audit-2189");
    for (let day = 1; day <= 14; day++) {
      const lunch = scheduleFor({ ...w, study: { ...w.study, day } }).find(
        (s) => s.interruption.id === "lunch"
      );
      if (lunch) expect(lunch.at).toBe(INTERRUPTION_TIMES[1]);
    }
  });

  it("does not blame the player for what came up while they were at a site", () => {
    const w = fresh("audit-2189");
    const out = travel({ ...w, minute: 9 * 60 }, "site-01");
    if (!out.ok) throw new Error(out.reason);
    const back = travel({ ...out.world, minute: 16 * 60 }, CRO_FLOOR.id);
    if (!back.ok) throw new Error(back.reason);
    const returned = back.world;
    // At most one interruption is still waiting, not three stacked up.
    const waiting = pendingInterruption(returned);
    const blamed = eveningWrapUp({ ...returned, minute: 17 * 60 })
      .map((l) => l.text)
      .filter((t) => t.includes("go unanswered"));
    expect(blamed.length).toBeLessThanOrEqual(waiting ? 1 : 0);
  });

  it("excuses nothing when nothing came up", () => {
    const early = { ...fresh("audit-2189"), minute: 9 * 60 };
    expect(excuseAway(early)).toBe(early);
  });
});
