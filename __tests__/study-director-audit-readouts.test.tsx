// Study Director 10/10 audit, second pass: readouts that tell the truth
// (#2187) and a closeout that does not flatter (#2190).
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  classifyProfile,
  type FinalReport,
  type SiteState,
} from "@/lib/study-director";
import {
  closeVisit,
  delegateDay,
  edcScreen,
  goHome,
  hudReadout,
  newWorld,
  performCheck,
  startDay,
  travel,
  type WorldState,
} from "@/lib/study-director-world";
import { verdictFor } from "@/components/study-director/closeout";
import { StatusBar } from "@/components/study-director/StatusBar";
import { WorldHud } from "@/components/study-director-world/WorldHud";

const fresh = (seed = "audit-2187"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

function withSite(
  world: WorldState,
  id: string,
  change: Partial<SiteState>
): WorldState {
  return {
    ...world,
    study: {
      ...world.study,
      day: 30,
      sites: world.study.sites.map((s) =>
        s.id === id ? { ...s, ...change } : s
      ),
    },
  };
}

afterEach(cleanup);

describe("Study Director audit: honest readouts (#2187)", () => {
  it("lists what a site visit showed in the EDC's You have seen column", () => {
    let world = withSite(fresh(), "site-03", {
      enrolled: 8,
      unsignedSource: 5,
      openQueries: 9,
    });
    world = expectOk(travel({ ...world, minute: 9 * 60 }, "site-03")).world;
    world = expectOk(performCheck(world, "sourceReview")).world;
    const { world: after, report } = closeVisit(world);
    expect(report?.audited).toBe(true);
    const data = edcScreen(after).find((r) => r.area === "data");
    expect(data?.seen.length).toBeGreaterThan(0);
    expect(data?.seen[0].source).toBe("Site 03 visit");
    expect(data?.seen[0].siteId).toBe("site-03");
  });

  it("calls only a terrified site's noise honesty", () => {
    const sites = fresh().study.sites;
    const quiet = sites.find((s) => s.coordinator !== "terrified");
    if (!quiet) throw new Error("no non-terrified site");
    let world = withSite(fresh(), quiet.id, {
      unsignedSource: 0,
      openQueries: 0,
      deviations: 0,
      eligibilityConcerns: 0,
    });
    world = expectOk(travel({ ...world, minute: 9 * 60 }, quiet.id)).world;
    world = expectOk(performCheck(world, "consent")).world;
    const { report } = closeVisit(world);
    if (report?.findings.some((f) => f.hidden)) return;
    expect(report?.verdict).not.toMatch(/honesty/);
  });

  it("shows the planned length beside the slip, not the slipped total too", () => {
    const world = fresh();
    const slipped = {
      ...world,
      study: { ...world.study, day: 9, slipDays: 1 },
    };
    const hud = hudReadout(slipped);
    render(<WorldHud hud={hud} minute={slipped.minute} />);
    const text = screen.getByTestId("world-hud").textContent ?? "";
    expect(text).toContain(`Day 9 / ${world.study.setup.durationDays}`);
    expect(text).toContain("+1");
  });

  it("says the night's spend is today's, with the running total", () => {
    const night = goHome({ ...fresh(), minute: 17 * 60 });
    const spend = night.report.lines.find((l) => / spent today, /.test(l.text));
    expect(spend?.text).toMatch(/^\$[\d,]+ spent today, \$[\d,]+ of \$[\d,]+ so far$/);
  });
});

describe("Study Director audit: an honest closeout (#2190)", () => {
  it("does not say on budget over a real overrun", () => {
    const report = (marginPct: number) =>
      fromPartial<FinalReport>({
        evaluations: {
          sponsor: { stars: 5 },
          company: { marginPct, timelineVarianceDays: 1 },
          regulatory: { grade: "A" },
        },
      });
    expect(verdictFor(report(-17.9)).line).not.toMatch(/on budget/);
    expect(verdictFor(report(-17.9)).headline).toBe(
      "Everything actually was fine."
    );
    expect(verdictFor(report(-2)).line).toMatch(/on budget/);
  });

  it("counts a delegated day as hand-offs, not an efficient operator", () => {
    let world = fresh("audit-2190");
    for (let i = 0; i < 12; i++) {
      const handed = delegateDay(world);
      if (!handed.ok) break;
      world = startDay(handed.world).world;
    }
    const delegated = world.study.log.filter((r) => r.delegated);
    expect(delegated.length).toBeGreaterThan(0);
    const result = classifyProfile(world.study);
    expect(result.profile).not.toBe("operator");
    expect(result.evidence.join(" ")).toMatch(/made by the team/);
  });

  it("hides the attention readout once the study is over", () => {
    const { study } = fresh();
    const { rerender } = render(<StatusBar state={study} />);
    expect(screen.queryByText("Attention today")).toBeTruthy();
    rerender(<StatusBar state={{ ...study, status: "complete" }} />);
    expect(screen.queryByText("Attention today")).toBeNull();
  });

  it("does not announce new mail on the last night", () => {
    const world = fresh();
    const last = {
      ...world,
      study: {
        ...world.study,
        day: world.study.setup.durationDays + world.study.slipDays - 1,
      },
    };
    const night = goHome(last);
    expect(night.report.complete).toBe(true);
    expect(night.report.lines.some((l) => /new message/.test(l.text))).toBe(
      false
    );
  });
});
