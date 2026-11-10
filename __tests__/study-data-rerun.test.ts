import { describe, expect, it } from "vitest";
import { isEmptyRunDiff } from "@/lib/study-data";
import { createStudyDataSession } from "@/components/study-data/pipeline-session";
import type { RerunResult, RunSummary } from "@/components/study-data/protocol";

async function firstRun() {
  const session = createStudyDataSession();
  const summary = (await session.handle({
    id: 1,
    type: "run",
    seed: 301,
    nSubjects: 12,
  })) as RunSummary;
  return { session, summary };
}

describe("rerun message (#3160)", () => {
  it("gives an empty diff for an unchanged design", async () => {
    const { session, summary } = await firstRun();
    const result = (await session.handle({
      id: 2,
      type: "rerun",
      design: summary.design,
    })) as RerunResult;
    expect(isEmptyRunDiff(result.diff)).toBe(true);
    expect(result.summary.runId).toBe(summary.runId + 1);
    expect(result.summary.counts).toEqual(summary.counts);
    expect(result.summary.coreView).toEqual(summary.coreView);
  });

  it("gives a non-empty diff when a visit moves", async () => {
    const { session, summary } = await firstRun();
    const visits = summary.design.visits.map((visit, index) =>
      index === summary.design.visits.length - 1
        ? { ...visit, targetDay: visit.targetDay + 30 }
        : visit
    );
    const result = (await session.handle({
      id: 2,
      type: "rerun",
      design: { ...summary.design, visits },
    })) as RerunResult;
    expect(isEmptyRunDiff(result.diff)).toBe(false);
    expect(result.summary.coreView).toBeNull();
  });

  it("refuses a rerun before any run", async () => {
    const session = createStudyDataSession();
    const design = (await firstRun()).summary.design;
    await expect(
      session.handle({ id: 1, type: "rerun", design })
    ).rejects.toThrow(/Run the pipeline first/);
  });
});
