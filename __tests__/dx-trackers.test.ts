// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildTrackerReport,
  countClaims,
  fetchTrackerData,
  findChecklistDrift,
  formatTrackerReport,
  parseChecklist,
} from "@/lib/dx/trackers";

const EPIC = [
  "## Required scope",
  "- [x] #2705 Truthful compliance wording (PR #2712)",
  "- [ ] #2789 Correct the PHI and SAE glossary definitions",
  "- [x] #2583 to #2590 merged",
  "  - [ ] #2769 v1 part: SDTM DM/AE defects",
  "- [ ] One integrated Playwright journey, coordinated through #2689",
  "- [x] ~~#2534~~ done",
  "* [X] **#2630** part 1 (PR #2767)",
  "```",
  "- [ ] #9999 inside a fence",
  "```",
  "Not a checklist: #2691",
].join("\n");

describe("parseChecklist (#2792)", () => {
  it("takes the issue that opens each checklist line", () => {
    expect(
      parseChecklist(EPIC).map(({ line, checked, issue }) => [
        line,
        checked,
        issue,
      ])
    ).toEqual([
      [2, true, 2705],
      [3, false, 2789],
      [4, true, 2583],
      [5, false, 2769],
      [7, true, 2534],
      [8, true, 2630],
    ]);
  });
});

describe("findChecklistDrift (#2792)", () => {
  const states = new Map<number, "open" | "closed">([
    [2705, "closed"],
    [2789, "closed"],
    [2583, "closed"],
    [2769, "open"],
    [2630, "open"],
  ]);

  it("reports unticked closed issues, ticked open ones and unresolved references", () => {
    const { drift, unresolved } = findChecklistDrift(
      [{ number: 2691, body: EPIC }],
      states
    );
    expect(drift.map(({ kind, item }) => [kind, item.issue])).toEqual([
      ["unticked-closed", 2789],
      ["ticked-open", 2630],
    ]);
    expect(drift[0]).toMatchObject({ epic: 2691, item: { line: 3 } });
    expect(unresolved).toEqual([2534]);
  });

  it("finds nothing when every tick agrees", () => {
    expect(
      findChecklistDrift(
        [{ number: 1, body: "- [x] #2\n- [ ] #3" }],
        new Map([
          [2, "closed"],
          [3, "open"],
        ])
      )
    ).toEqual({ drift: [], unresolved: [] });
  });
});

describe("countClaims (#2792)", () => {
  it("counts each claim per assignee and lane label, most claims first", () => {
    expect(
      countClaims([
        {
          number: 3,
          labels: ["status:in-progress", "lane:4"],
          assignees: ["a"],
        },
        { number: 1, labels: ["status:in-progress"], assignees: ["a", "b"] },
        { number: 2, labels: ["status:in-progress"], assignees: [] },
      ])
    ).toEqual([
      { holder: "@a", issues: [1, 3] },
      { holder: "@b", issues: [1] },
      { holder: "lane:4", issues: [3] },
      { holder: "unassigned", issues: [2] },
    ]);
  });
});

describe("formatTrackerReport (#2792)", () => {
  it("prints each section with counts and counts a claim once in the total", () => {
    const text = formatTrackerReport(
      buildTrackerReport(
        "o/r",
        [{ number: 2691, body: EPIC }],
        new Map([[2789, "closed"]]),
        [{ number: 7, labels: [], assignees: ["a", "b"] }]
      )
    );
    expect(text).toContain("Tracker drift for o/r (1 open epics)");
    expect(text).toContain("Unticked, but the issue is closed: 1");
    expect(text).toContain("  #2691:3 - [ ] #2789 Correct the PHI");
    expect(text).toContain("Ticked, but the issue is open");
    expect(text).toContain("Unresolved references: #2534 #2583");
    expect(text).toContain("status:in-progress claims: 1");
    expect(text).toContain("  @a: 1 (#7)");
  });
});

describe("fetchTrackerData (#2792)", () => {
  type Call = {
    url: string;
    init: { headers: Record<string, string>; body?: string };
  };
  const respond = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => data,
  });

  function fakeGitHub(calls: Call[]) {
    return async (url: string, init: Call["init"]) => {
      calls.push({ url, init });
      if (url.includes("labels=type%3Aepic")) {
        return respond([
          {
            number: 2691,
            title: "Release gate",
            state: "open",
            body: "- [ ] #10 a\n- [x] #11 b",
            labels: [{ name: "type:epic" }],
            assignees: [],
          },
        ]);
      }
      if (url.includes("labels=status%3Ain-progress")) {
        return respond([
          {
            number: 11,
            title: "b",
            state: "open",
            labels: ["status:in-progress"],
            assignees: [{ login: "fred" }],
          },
          {
            number: 12,
            title: "pr",
            state: "open",
            labels: [],
            pull_request: {},
          },
        ]);
      }
      return respond({
        data: {
          repository: { i10: { state: "CLOSED" }, i11: { state: "OPEN" } },
        },
      });
    };
  }

  it("reads both label lists and one batched GraphQL query", async () => {
    const calls: Call[] = [];
    const report = await fetchTrackerData("o/r", "t0ken", fakeGitHub(calls));
    expect(calls.map(({ url }) => url.split("?")[0])).toEqual([
      "https://api.github.com/repos/o/r/issues",
      "https://api.github.com/repos/o/r/issues",
      "https://api.github.com/graphql",
    ]);
    expect(calls[2].init.body).toContain("i10: issueOrPullRequest(number: 10)");
    expect(report.drift.map(({ kind }) => kind)).toEqual([
      "unticked-closed",
      "ticked-open",
    ]);
    expect(report.claims).toEqual([{ holder: "@fred", issues: [11] }]);
    expect(JSON.stringify(report)).not.toContain("t0ken");
  });

  it("leaves states unresolved and sends no token without one", async () => {
    const calls: Call[] = [];
    const report = await fetchTrackerData("o/r", undefined, fakeGitHub(calls));
    expect(calls).toHaveLength(2);
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(report.drift).toEqual([]);
    expect(report.unresolved).toEqual([10, 11]);
  });

  it("rejects a malformed repository and a failed response", async () => {
    await expect(fetchTrackerData("nope", undefined)).rejects.toThrow(
      /owner\/name/
    );
    await expect(
      fetchTrackerData("o/r", undefined, async () => ({
        ok: false,
        status: 403,
        json: async () => ({}),
      }))
    ).rejects.toThrow(/403/);
  });
});
