// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildTrackerReport,
  countClaims,
  fetchTrackerData,
  findChecklistDrift,
  findStaleClaims,
  formatTrackerReport,
  parseChecklist,
  toClaimActivity,
} from "@/lib/dx/trackers";

const NOW = new Date("2026-10-25T12:00:00Z");

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

describe("findStaleClaims (#2830)", () => {
  const claim = (number: number, assignees: string[] = []) => ({
    number,
    title: `claim ${number}`,
    labels: ["status:in-progress"],
    assignees,
  });
  const quiet = {
    openPullRequests: [],
    lastPushAt: null,
    lastCommentAt: null,
  };

  it("flags a claim only when no PR, push or comment falls in the window", () => {
    const activity = new Map([
      [1, { ...quiet, openPullRequests: [9] }],
      [2, { ...quiet, lastPushAt: "2026-10-25T01:00:00Z" }],
      [3, { ...quiet, lastCommentAt: "2026-10-24T13:00:00Z" }],
      [
        4,
        {
          ...quiet,
          lastPushAt: "2026-10-23T09:00:00Z",
          lastCommentAt: "2026-10-24T11:59:00Z",
        },
      ],
      [5, quiet],
    ]);
    expect(
      findStaleClaims(
        [claim(1), claim(2), claim(3), claim(4, ["fred"]), claim(5), claim(6)],
        activity,
        NOW
      )
    ).toEqual([
      {
        issue: 5,
        title: "claim 5",
        holders: ["unassigned"],
        lastActivityAt: null,
      },
      {
        issue: 4,
        title: "claim 4",
        holders: ["@fred"],
        lastActivityAt: "2026-10-24T11:59:00.000Z",
      },
    ]);
  });

  it("measures the window from the time it is given", () => {
    const activity = new Map([
      [7, { ...quiet, lastCommentAt: "2026-10-25T11:00:00Z" }],
    ]);
    expect(findStaleClaims([claim(7)], activity, NOW, 30 * 60_000)).toEqual([
      expect.objectContaining({ issue: 7 }),
    ]);
  });
});

describe("toClaimActivity (#2830)", () => {
  it("keeps open linked PRs, standalone-number branches and the last comment", () => {
    expect(
      toClaimActivity(2830, {
        issue: {
          comments: { nodes: [{ createdAt: "2026-10-25T10:00:00Z" }] },
          closedByPullRequestsReferences: {
            nodes: [
              { number: 40, state: "OPEN" },
              { number: 41, state: "MERGED" },
            ],
          },
          timelineItems: {
            nodes: [
              { source: { number: 42, state: "OPEN" } },
              { subject: { number: 40, state: "OPEN" } },
              { source: { number: 43, state: "CLOSED" } },
              {},
              null,
            ],
          },
        },
        refs: {
          nodes: [
            {
              name: "feat/dx-stale-claims-2830",
              target: { committedDate: "2026-10-24T08:00:00Z" },
            },
            {
              name: "fix/2830-follow-up",
              target: { committedDate: "2026-10-25T09:00:00Z" },
            },
            {
              name: "fix/other-28301",
              target: { committedDate: "2026-10-25T11:00:00Z" },
            },
            { name: "tag-like", target: null },
          ],
        },
      })
    ).toEqual({
      openPullRequests: [40, 42],
      lastPushAt: "2026-10-25T09:00:00Z",
      lastCommentAt: "2026-10-25T10:00:00Z",
    });
  });

  it("reports no activity for an issue GitHub did not return", () => {
    expect(toClaimActivity(1, { issue: null, refs: null })).toEqual({
      openPullRequests: [],
      lastPushAt: null,
      lastCommentAt: null,
    });
  });
});

describe("formatTrackerReport (#2792)", () => {
  it("prints each section with counts and counts a claim once in the total", () => {
    const text = formatTrackerReport(
      buildTrackerReport(
        "o/r",
        [{ number: 2691, body: EPIC }],
        new Map([[2789, "closed"]]),
        [{ number: 7, title: "t", labels: [], assignees: ["a", "b"] }]
      )
    );
    expect(text).toContain("Tracker drift for o/r (1 open epics)");
    expect(text).toContain("Unticked, but the issue is closed: 1");
    expect(text).toContain("  #2691:3 - [ ] #2789 Correct the PHI");
    expect(text).toContain("Ticked, but the issue is open");
    expect(text).toContain("Unresolved references: #2534 #2583");
    expect(text).toContain("status:in-progress claims: 1");
    expect(text).toContain("  @a: 1 (#7)");
    expect(text).toContain(
      "Stale claims: not checked (claim activity was not read)"
    );
  });

  it("lists stale claims with their holders and last activity (#2830)", () => {
    const text = formatTrackerReport(
      buildTrackerReport(
        "o/r",
        [],
        new Map(),
        [
          {
            number: 7,
            title: "Quiet claim",
            labels: ["lane:4"],
            assignees: [],
          },
        ],
        {
          byIssue: new Map([
            [
              7,
              {
                openPullRequests: [],
                lastPushAt: null,
                lastCommentAt: "2026-10-23T08:00:00Z",
              },
            ],
          ]),
          now: NOW,
        }
      )
    );
    expect(text).toContain(
      "Stale claims (no open PR, push or comment in 24 h): 1"
    );
    expect(text).toContain(
      "  #7 lane:4 last activity 2026-10-23T08:00:00.000Z: Quiet claim"
    );
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
      if (init.body?.includes("issueOrPullRequest")) {
        return respond({
          data: {
            repository: { i10: { state: "CLOSED" }, i11: { state: "OPEN" } },
          },
        });
      }
      return respond({
        data: {
          repository: {
            c11: {
              comments: { nodes: [{ createdAt: "2026-10-23T12:00:00Z" }] },
              closedByPullRequestsReferences: { nodes: [] },
              timelineItems: { nodes: [] },
            },
            b11: { nodes: [] },
          },
        },
      });
    };
  }

  it("reads both label lists, then batched GraphQL for states and activity", async () => {
    const calls: Call[] = [];
    const report = await fetchTrackerData(
      "o/r",
      "t0ken",
      fakeGitHub(calls),
      NOW
    );
    expect(calls.map(({ url }) => url.split("?")[0])).toEqual([
      "https://api.github.com/repos/o/r/issues",
      "https://api.github.com/repos/o/r/issues",
      "https://api.github.com/graphql",
      "https://api.github.com/graphql",
    ]);
    expect(calls[2].init.body).toContain("i10: issueOrPullRequest(number: 10)");
    expect(calls[3].init.body).toContain("c11: issue(number: 11)");
    expect(calls[3].init.body).toContain(
      'b11: refs(refPrefix: \\"refs/heads/\\", query: \\"11\\"'
    );
    expect(report.drift.map(({ kind }) => kind)).toEqual([
      "unticked-closed",
      "ticked-open",
    ]);
    expect(report.claims).toEqual([{ holder: "@fred", issues: [11] }]);
    expect(report.staleClaims).toEqual([
      {
        issue: 11,
        title: "b",
        holders: ["@fred"],
        lastActivityAt: "2026-10-23T12:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(report)).not.toContain("t0ken");
  });

  it("leaves states unresolved and sends no token without one", async () => {
    const calls: Call[] = [];
    const report = await fetchTrackerData("o/r", undefined, fakeGitHub(calls));
    expect(calls).toHaveLength(2);
    expect(calls[0].init.headers.Authorization).toBeUndefined();
    expect(report.drift).toEqual([]);
    expect(report.unresolved).toEqual([10, 11]);
    expect(report.staleClaims).toBeNull();
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
