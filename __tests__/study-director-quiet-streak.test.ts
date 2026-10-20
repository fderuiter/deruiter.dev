// @vitest-environment node
// Study Director: the quiet-site line counts how long a site has gone
// without anyone looking (#2288), from saved state so a reload or a replay
// of the same seed says the same thing.
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  HISTORY_LIMIT,
  choosePriority,
  newWorld,
  settlePriority,
  startDay,
  type SiteVisitReport,
  type WorldState,
} from "@/lib/study-director-world";

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

const base = startDay(newWorld("quiet-2288", "standard")).world;
const QUIET = 2;
const quietSite = base.study.sites[QUIET];
const otherSite = base.study.sites[(QUIET + 1) % base.study.sites.length];

const visit = (siteId: string, day: number): SiteVisitReport =>
  fromPartial<SiteVisitReport>({ siteId, day });

/** The sites line on the night of `day`, with one silent site. */
function quietLine(day: number, visits: SiteVisitReport[] = []): string {
  const world: WorldState = {
    ...base,
    minute: 18 * 60,
    siteVisitHistory: visits,
    plan: undefined,
    study: {
      ...base.study,
      day,
      sites: base.study.sites.map((s, i) =>
        i === QUIET ? { ...s, coordinator: "invisible" as const } : s
      ),
    },
  };
  const said = settlePriority(
    expectOk(choosePriority(world, "sites")).world
  ).lines.map((l) => l.text);
  expect(said).toHaveLength(1);
  return said[0];
}

describe("the quiet-site line tracks a streak (#2288)", () => {
  it("keeps the plain line on a first quiet night", () => {
    const line = quietLine(1);
    expect(line).toContain(quietSite.name);
    expect(line).not.toMatch(/quiet for \d+ nights/);
  });

  it("counts from the start of the study when nobody has gone", () => {
    expect(quietLine(6)).toContain(
      `${quietSite.name} has been quiet for 6 nights since the study began.`
    );
  });

  it("counts from the player's last visit to that site", () => {
    const line = quietLine(12, [
      visit(quietSite.id, 3),
      visit(quietSite.id, 8),
      visit(otherSite.id, 11),
    ]);
    expect(line).toContain(
      `${quietSite.name} has been quiet for 4 nights since you last looked.`
    );
  });

  it("goes back to the plain line the night after a visit", () => {
    const line = quietLine(12, [visit(quietSite.id, 11)]);
    expect(line).toContain(quietSite.name);
    expect(line).not.toMatch(/quiet for \d+ nights/);
  });

  it("never claims more than the trimmed history can show", () => {
    const visits = Array.from({ length: HISTORY_LIMIT }, (_, i) =>
      visit(otherSite.id, 20 + i)
    );
    expect(quietLine(100, visits)).toContain(
      `${quietSite.name} has been quiet for at least 80 nights.`
    );
  });

  it("says the same thing for the same saved state", () => {
    const visits = [visit(quietSite.id, 5)];
    expect(quietLine(9, visits)).toBe(quietLine(9, visits));
  });
});
